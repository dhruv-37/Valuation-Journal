import { db } from '../db/database';
import { collectJournal, countBundle } from '../db/bundle';
import { createZip, readZipDirectory, readZipEntry, readZipText, ZipError, type ZipEntry, type ZipInput } from './zip';
import {
  CARD_TYPES,
  DOCUMENT_KINDS,
  EXTRACT_KINDS,
  type Attachment,
  type ChecklistItem,
  type DocumentText,
  type ID,
  type Journal,
  type JournalBundle,
  type JournalCounts,
  type KnowledgeCard,
  type KnowledgeExtract,
  type Phase,
  type ResearchDocument,
  type ReviewLogEntry,
  type RevisionCard,
  type Snapshot,
} from '../types';

/**
 * Backup archive format (version 1):
 *
 *   manifest.json                     format, version, schema version, date, journals
 *   journals/<n>/journal.json         every record of one journal; Blob fields replaced by {"$file": path}
 *   journals/<n>/files/<attachmentId> original images and documents, byte for byte
 *   journals/<n>/thumbs/<s|d>-<id>    snapshot and document thumbnails
 *
 * Restoring never trusts the archive: it is validated (structure, version,
 * checksums, every referenced file present), records are type-checked, and the
 * repository regenerates every id before writing (see db/bundle.ts).
 */

export const BACKUP_FORMAT = 'valuation-journal-backup';
export const BACKUP_VERSION = 1;

interface FileRef {
  $file: string;
  type: string;
}

interface ManifestJournal {
  folder: string;
  id: ID;
  name: string;
  description: string;
  counts: JournalCounts;
}

interface Manifest {
  format: string;
  version: number;
  schemaVersion: number;
  createdAt: number;
  journals: ManifestJournal[];
}

export class BackupError extends Error {}

/* ---------------------------------- Export ---------------------------------- */

export type ExportProgress = (stage: string, done: number, total: number) => void;

/** Builds a backup archive of the given journals (files included). */
export async function exportJournals(journalIds: ID[], onProgress?: ExportProgress): Promise<{ blob: Blob; fileName: string }> {
  const entries: ZipInput[] = [];
  const manifestJournals: ManifestJournal[] = [];
  for (let i = 0; i < journalIds.length; i++) {
    onProgress?.('Reading journals', i, journalIds.length);
    const bundle = await collectJournal(journalIds[i]);
    const folder = `journals/${i + 1}`;
    const ref = (path: string, blob: Blob): FileRef => {
      entries.push({ name: `${folder}/${path}`, data: blob });
      return { $file: path, type: blob.type };
    };
    const json = {
      ...bundle,
      attachments: bundle.attachments.map((a) => ({ ...a, blob: ref(`files/${a.id}`, a.blob) })),
      snapshots: bundle.snapshots.map((s) => ({ ...s, thumbnail: ref(`thumbs/s-${s.id}`, s.thumbnail) })),
      documents: bundle.documents.map((d) => ({ ...d, thumbnail: d.thumbnail ? ref(`thumbs/d-${d.id}`, d.thumbnail) : undefined })),
    };
    entries.push({ name: `${folder}/journal.json`, data: JSON.stringify(json) });
    manifestJournals.push({ folder, id: bundle.journal.id, name: bundle.journal.name, description: bundle.journal.description, counts: countBundle(bundle) });
  }
  const manifest: Manifest = { format: BACKUP_FORMAT, version: BACKUP_VERSION, schemaVersion: db.verno, createdAt: Date.now(), journals: manifestJournals };
  entries.unshift({ name: 'manifest.json', data: JSON.stringify(manifest, null, 2) });

  const blob = await createZip(entries, (done, total) => onProgress?.('Packing files', done, total));
  const date = new Date().toISOString().slice(0, 10);
  const label = manifestJournals.length === 1 ? safeFileName(manifestJournals[0].name) : 'Valuation Journal';
  return { blob, fileName: `${label} backup ${date}.zip` };
}

const safeFileName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Journal';

/* --------------------------------- Restore ---------------------------------- */

/** A journal found in a backup, checked and ready to import. */
export interface BackupJournal {
  folder: string;
  originalId: ID;
  name: string;
  description: string;
  counts: JournalCounts;
  /** Records skipped because they were malformed. */
  invalid: number;
  /** Set when this journal cannot be imported (e.g. files missing from the archive). */
  error?: string;
  /** The records, with each file still a reference into the archive. */
  data?: RawBundle;
}

export interface BackupContents {
  file: Blob;
  createdAt: number;
  version: number;
  /** True when the backup came from a newer database schema than this app's. */
  newerSchema: boolean;
  journals: BackupJournal[];
  entries: Map<string, ZipEntry>;
}

type WithFile<T, K extends keyof T> = Omit<T, K> & { [P in K]: FileRef };
interface RawBundle extends Omit<JournalBundle, 'attachments' | 'snapshots' | 'documents'> {
  attachments: WithFile<Attachment, 'blob'>[];
  snapshots: WithFile<Snapshot, 'thumbnail'>[];
  documents: (Omit<ResearchDocument, 'thumbnail'> & { thumbnail?: FileRef })[];
}

/** Opens and validates a backup archive. Nothing is written. */
export async function readBackup(file: Blob): Promise<BackupContents> {
  let entries: Map<string, ZipEntry>;
  try {
    entries = await readZipDirectory(file);
  } catch (error) {
    throw new BackupError(error instanceof ZipError ? error.message : 'The file could not be read.');
  }
  const manifestEntry = entries.get('manifest.json');
  if (!manifestEntry) throw new BackupError('This ZIP is not a Valuation Journal backup (manifest.json is missing).');
  const manifest = await parseJson<Manifest>(file, manifestEntry, 'manifest.json');
  if (manifest?.format !== BACKUP_FORMAT) throw new BackupError('This ZIP is not a Valuation Journal backup.');
  if (!isNum(manifest.version) || manifest.version > BACKUP_VERSION) {
    throw new BackupError(`This backup was made by a newer version of Valuation Journal (format ${manifest.version}); this app reads format ${BACKUP_VERSION}.`);
  }
  if (!Array.isArray(manifest.journals) || manifest.journals.length === 0) throw new BackupError('This backup contains no journals.');

  const journals: BackupJournal[] = [];
  for (const m of manifest.journals) {
    const base: BackupJournal = {
      folder: String(m?.folder ?? ''),
      originalId: String(m?.id ?? ''),
      name: isStr(m?.name) && m.name.trim() ? m.name.trim() : 'Untitled journal',
      description: isStr(m?.description) ? m.description : '',
      counts: emptyCounts(),
      invalid: 0,
    };
    try {
      const entry = entries.get(`${base.folder}/journal.json`);
      if (!entry) throw new BackupError('Its data file is missing from the archive.');
      const { bundle, invalid } = sanitize(await parseJson<unknown>(file, entry, `${base.folder}/journal.json`));
      const refs = [...bundle.attachments.map((a) => a.blob), ...bundle.snapshots.map((s) => s.thumbnail), ...bundle.documents.flatMap((d) => (d.thumbnail ? [d.thumbnail] : []))];
      const missing = refs.filter((r) => !entries.has(`${base.folder}/${r.$file}`)).length;
      if (missing > 0) throw new BackupError(`${missing} stored ${missing === 1 ? 'file is' : 'files are'} missing from the archive.`);
      journals.push({
        ...base,
        name: bundle.journal.name.trim() || base.name,
        description: bundle.journal.description,
        counts: countBundle(bundle as unknown as JournalBundle),
        invalid,
        data: bundle,
      });
    } catch (error) {
      journals.push({ ...base, error: error instanceof BackupError || error instanceof ZipError ? error.message : 'Its data could not be read.' });
    }
  }
  return {
    file,
    entries,
    createdAt: isNum(manifest.createdAt) ? manifest.createdAt : 0,
    version: manifest.version,
    newerSchema: isNum(manifest.schemaVersion) && manifest.schemaVersion > db.verno,
    journals,
  };
}

/**
 * Loads a journal's files from the archive (checking each checksum) and returns
 * a complete bundle for the repository to write. Runs before any database
 * transaction, because IndexedDB transactions cannot wait on file reads.
 */
export async function loadBackupJournal(contents: BackupContents, journal: BackupJournal, onProgress?: (done: number, total: number) => void): Promise<JournalBundle> {
  const raw = journal.data;
  if (!raw || journal.error) throw new BackupError(journal.error ?? 'This journal cannot be imported.');
  const total = raw.attachments.length + raw.snapshots.length + raw.documents.filter((d) => d.thumbnail).length;
  let done = 0;
  const load = async (ref: FileRef) => {
    const entry = contents.entries.get(`${journal.folder}/${ref.$file}`);
    if (!entry) throw new BackupError(`A stored file is missing from the archive (${ref.$file}).`);
    const blob = await readZipEntry(contents.file, entry, { type: ref.type, verify: true });
    onProgress?.(++done, total);
    return blob;
  };
  const attachments: Attachment[] = [];
  for (const a of raw.attachments) attachments.push({ ...a, blob: await load(a.blob) });
  const snapshots: Snapshot[] = [];
  for (const s of raw.snapshots) snapshots.push({ ...s, thumbnail: await load(s.thumbnail) });
  const documents: ResearchDocument[] = [];
  for (const d of raw.documents) documents.push({ ...d, thumbnail: d.thumbnail ? await load(d.thumbnail) : undefined });
  return { ...raw, attachments, snapshots, documents };
}

async function parseJson<T>(file: Blob, entry: ZipEntry, name: string): Promise<T> {
  try {
    return JSON.parse(await readZipText(file, entry)) as T;
  } catch (error) {
    if (error instanceof ZipError) throw new BackupError(error.message);
    throw new BackupError(`${name} is not valid JSON; the backup is damaged.`);
  }
}

/* ------------------------------ Record checks ------------------------------- */

// Archive content is untyped until checked, hence `any` below.

const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);
const isFileRef = (v: any): v is FileRef => !!v && isStr(v.$file) && isStr(v.type) && !v.$file.includes('..');
const oneOf = <T extends string>(list: readonly T[]) => (v: unknown): v is T => list.includes(v as T);
const hasIds = (r: any, ...keys: string[]) => !!r && typeof r === 'object' && keys.every((k) => isStr(r[k]) && r[k].length > 0);
const stamps = (r: any) => ({ createdAt: isNum(r.createdAt) ? r.createdAt : Date.now(), updatedAt: isNum(r.updatedAt) ? r.updatedAt : Date.now() });

const emptyCounts = (): JournalCounts => ({ phases: 0, tasks: 0, cards: 0, snapshots: 0, extracts: 0, documents: 0, revisions: 0, fileBytes: 0 });

/** Keeps well-formed records (normalising optional fields) and counts the rest. */
function sanitize(raw: any): { bundle: RawBundle; invalid: number } {
  if (!raw || typeof raw !== 'object' || !raw.journal) throw new BackupError('Its data file has an unexpected structure.');
  let invalid = 0;
  const list = <T>(value: unknown, check: (r: any) => boolean, shape: (r: any) => T): T[] => {
    if (!Array.isArray(value)) return [];
    const out: T[] = [];
    for (const r of value) {
      if (check(r)) out.push(shape(r));
      else invalid++;
    }
    return out;
  };

  const j = raw.journal;
  const journal: Journal = { id: isStr(j.id) ? j.id : '', name: isStr(j.name) ? j.name : '', description: isStr(j.description) ? j.description : '', ...stamps(j) };

  const phases = list<Phase>(
    raw.phases,
    (r) => hasIds(r, 'id') && isStr(r.title),
    (r) => ({ id: r.id, journalId: journal.id, order: isNum(r.order) ? r.order : 0, title: r.title, description: isStr(r.description) ? r.description : '', objectives: isStrArr(r.objectives) ? r.objectives : [], ...stamps(r) }),
  );
  const checklist = list<ChecklistItem>(
    raw.checklist,
    (r) => hasIds(r, 'id', 'phaseId') && isStr(r.text),
    (r) => ({ id: r.id, phaseId: r.phaseId, text: r.text, done: r.done === true, order: isNum(r.order) ? r.order : 0, completedAt: isNum(r.completedAt) ? r.completedAt : undefined, ...stamps(r) }),
  );
  const cards = list<KnowledgeCard>(
    raw.cards,
    (r) => hasIds(r, 'id', 'phaseId') && oneOf(CARD_TYPES)(r.type) && isStr(r.title) && isStr(r.content),
    (r) => ({ id: r.id, phaseId: r.phaseId, type: r.type, title: r.title, content: r.content, tags: isStrArr(r.tags) ? r.tags : [], pinned: r.pinned === true, order: isNum(r.order) ? r.order : 0, source: isStr(r.source) ? r.source : undefined, ...stamps(r) }),
  );
  const extracts = list<KnowledgeExtract>(
    raw.extracts,
    (r) => hasIds(r, 'id', 'phaseId') && oneOf(EXTRACT_KINDS)(r.kind) && isStr(r.text),
    (r) => ({
      id: r.id,
      phaseId: r.phaseId,
      kind: r.kind,
      title: isStr(r.title) ? r.title : '',
      text: r.text,
      sourceDocument: isStr(r.sourceDocument) ? r.sourceDocument : undefined,
      location: isStr(r.location) ? r.location : undefined,
      url: isStr(r.url) ? r.url : undefined,
      tags: isStrArr(r.tags) ? r.tags : [],
      pinned: r.pinned === true,
      ...stamps(r),
    }),
  );
  const attachments = list<WithFile<Attachment, 'blob'>>(
    raw.attachments,
    (r) => hasIds(r, 'id', 'ownerId') && oneOf(['phase', 'card', 'snapshot', 'document'] as const)(r.ownerType) && isFileRef(r.blob) && isNum(r.size),
    (r) => ({
      id: r.id,
      ownerType: r.ownerType,
      ownerId: r.ownerId,
      phaseId: isStr(r.phaseId) ? r.phaseId : '',
      kind: oneOf(['image', 'pdf', 'document', 'other'] as const)(r.kind) ? r.kind : 'other',
      fileName: isStr(r.fileName) ? r.fileName : 'file',
      mimeType: isStr(r.mimeType) ? r.mimeType : r.blob.type,
      size: r.size,
      blob: r.blob,
      caption: isStr(r.caption) ? r.caption : undefined,
      ...stamps(r),
    }),
  );
  const snapshots = list<WithFile<Snapshot, 'thumbnail'>>(
    raw.snapshots,
    (r) => hasIds(r, 'id', 'phaseId', 'attachmentId') && isFileRef(r.thumbnail),
    (r) => ({
      id: r.id,
      phaseId: r.phaseId,
      attachmentId: r.attachmentId,
      title: isStr(r.title) ? r.title : '',
      description: isStr(r.description) ? r.description : '',
      caption: isStr(r.caption) ? r.caption : '',
      tags: isStrArr(r.tags) ? r.tags : [],
      pinned: r.pinned === true,
      cardIds: isStrArr(r.cardIds) ? r.cardIds : [],
      fileName: isStr(r.fileName) ? r.fileName : 'image',
      mimeType: isStr(r.mimeType) ? r.mimeType : 'image/png',
      size: isNum(r.size) ? r.size : 0,
      width: isNum(r.width) ? r.width : 0,
      height: isNum(r.height) ? r.height : 0,
      thumbnail: r.thumbnail,
      ...stamps(r),
    }),
  );
  const documents = list<RawBundle['documents'][number]>(
    raw.documents,
    (r) => hasIds(r, 'id', 'attachmentId') && oneOf(DOCUMENT_KINDS)(r.kind) && (r.thumbnail === undefined || isFileRef(r.thumbnail)),
    (r) => ({
      id: r.id,
      journalId: journal.id,
      phaseId: isStr(r.phaseId) ? r.phaseId : null,
      attachmentId: r.attachmentId,
      title: isStr(r.title) ? r.title : '',
      description: isStr(r.description) ? r.description : '',
      tags: isStrArr(r.tags) ? r.tags : [],
      kind: r.kind,
      fileName: isStr(r.fileName) ? r.fileName : 'file',
      mimeType: isStr(r.mimeType) ? r.mimeType : 'application/octet-stream',
      size: isNum(r.size) ? r.size : 0,
      linkedPhaseIds: isStrArr(r.linkedPhaseIds) ? r.linkedPhaseIds : [],
      cardIds: isStrArr(r.cardIds) ? r.cardIds : [],
      extractIds: isStrArr(r.extractIds) ? r.extractIds : [],
      snapshotIds: isStrArr(r.snapshotIds) ? r.snapshotIds : [],
      textStatus: oneOf(['pending', 'indexed', 'none', 'failed'] as const)(r.textStatus) ? r.textStatus : 'none',
      pageCount: isNum(r.pageCount) ? r.pageCount : undefined,
      thumbnail: r.thumbnail,
      ...stamps(r),
    }),
  );
  const documentTexts = list<DocumentText>(
    raw.documentTexts,
    (r) => hasIds(r, 'documentId') && isStr(r.text),
    (r) => ({ documentId: r.documentId, text: r.text, truncated: r.truncated === true }),
  );
  const revisions = list<RevisionCard>(
    raw.revisions,
    (r) => hasIds(r, 'id', 'sourceId') && oneOf(['card', 'extract'] as const)(r.sourceType) && oneOf(['new', 'remembered', 'needs-revision'] as const)(r.status) && isNum(r.dueAt),
    (r) => ({
      id: r.id,
      journalId: journal.id,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      prompt: isStr(r.prompt) ? r.prompt : '',
      status: r.status,
      level: isNum(r.level) ? Math.max(0, Math.round(r.level)) : 0,
      reviewCount: isNum(r.reviewCount) ? r.reviewCount : 0,
      lapses: isNum(r.lapses) ? r.lapses : 0,
      lastReviewedAt: isNum(r.lastReviewedAt) ? r.lastReviewedAt : undefined,
      dueAt: r.dueAt,
      ...stamps(r),
    }),
  );
  const reviewLog = list<ReviewLogEntry>(
    raw.reviewLog,
    (r) => hasIds(r, 'id', 'revisionId') && isNum(r.reviewedAt) && oneOf(['remembered', 'needs-revision'] as const)(r.result) && !!r.before && typeof r.before === 'object',
    (r) => ({ id: r.id, revisionId: r.revisionId, journalId: journal.id, reviewedAt: r.reviewedAt, result: r.result, before: r.before }),
  );
  return {
    invalid,
    bundle: {
      journal,
      phases,
      checklist,
      cards,
      extracts,
      attachments,
      snapshots,
      documents,
      documentTexts,
      revisions,
      reviewLog,
      lastPhaseId: isStr(raw.lastPhaseId) ? raw.lastPhaseId : undefined,
    },
  };
}
