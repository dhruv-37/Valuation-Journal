import { db } from './database';
import { uid } from '../lib/id';
import { getActiveJournalId } from '../lib/activeJournal';
import { JOURNAL_TABLES, collectJournal, deleteJournalRecords, lastBackupKey, remapBundle, writeBundle } from './bundle';
import { buildStarterJournal } from './seed';
import { prepareImage } from '../lib/images';
import { normaliseUrl } from '../lib/format';
import { formatBytes } from '../lib/images';
import {
  DOCUMENT_KIND_META,
  DocumentError,
  MAX_DOCUMENT_BYTES,
  SUPPORTED_FORMATS_LABEL,
  defaultDocumentTitle,
  detectDocument,
  readStorageInfo,
} from '../lib/documents';
import type {
  Attachment,
  CardType,
  ChecklistItem,
  DocumentTextStatus,
  ExtractKind,
  ID,
  Journal,
  JournalBundle,
  KnowledgeCard,
  KnowledgeExtract,
  Phase,
  ResearchDocument,
  ReviewLogEntry,
  ReviewResult,
  RevisionCard,
  RevisionSourceType,
  Snapshot,
} from '../types';
import { nextSchedule, scheduleOf } from '../lib/recall';

/**
 * All writes go through these functions so the UI never touches tables directly.
 * Reads use live queries (see hooks/useJournalData.ts) and re-render automatically.
 */

const now = () => Date.now();

/* ---------------------------------- Phases --------------------------------- */

async function orderedPhaseIds(journalId: ID): Promise<ID[]> {
  const phases = await db.phases.where('journalId').equals(journalId).sortBy('order');
  return phases.map((p) => p.id);
}

/** New phases go into the journal on screen. */

export async function createPhase(input: { title: string; description?: string; objectives?: string[] }) {
  const journalId = getActiveJournalId();
  const ids = await orderedPhaseIds(journalId);
  const phase: Phase = {
    id: uid(),
    journalId,
    order: ids.length,
    title: input.title.trim() || 'Untitled phase',
    description: input.description?.trim() ?? '',
    objectives: input.objectives ?? [],
    createdAt: now(),
    updatedAt: now(),
  };
  await db.phases.add(phase);
  return phase;
}

export async function updatePhase(id: ID, changes: Partial<Pick<Phase, 'title' | 'description' | 'objectives'>>) {
  await db.phases.update(id, { ...changes, updatedAt: now() });
}

/**
 * Deletes a phase and everything that belongs to it. Documents filed under it
 * are kept in the Document Library as unfiled (their files are not phase-owned).
 */
export async function deletePhase(id: ID) {
  const tables = [db.phases, db.checklist, db.cards, db.attachments, db.snapshots, db.extracts, db.documents, db.revisions, db.reviewLog];
  await db.transaction('rw', tables, async () => {
    const phase = await db.phases.get(id);
    if (!phase) return;
    const [cardIds, snapshotIds, extractIds] = (await Promise.all([
      db.cards.where('phaseId').equals(id).primaryKeys(),
      db.snapshots.where('phaseId').equals(id).primaryKeys(),
      db.extracts.where('phaseId').equals(id).primaryKeys(),
    ])) as ID[][];
    await unlinkCardsFromSnapshots(cardIds);
    await unlinkFromDocuments({ cardIds, snapshotIds, extractIds, phaseId: id });
    await removeRevisionsOf('card', cardIds);
    await removeRevisionsOf('extract', extractIds);
    await db.checklist.where('phaseId').equals(id).delete();
    await db.cards.where('phaseId').equals(id).delete();
    await db.snapshots.where('phaseId').equals(id).delete();
    await db.extracts.where('phaseId').equals(id).delete();
    await db.attachments.where('phaseId').equals(id).delete();
    await db.phases.delete(id);
    const remaining = await orderedPhaseIds(phase.journalId);
    await writePhaseOrder(remaining);
  });
}

async function writePhaseOrder(ids: ID[]) {
  await Promise.all(ids.map((id, order) => db.phases.update(id, { order })));
}

export async function reorderPhases(ids: ID[]) {
  await db.transaction('rw', db.phases, () => writePhaseOrder(ids));
}

export async function movePhase(id: ID, delta: -1 | 1) {
  await db.transaction('rw', db.phases, async () => {
    const phase = await db.phases.get(id);
    if (!phase) return;
    const ids = await orderedPhaseIds(phase.journalId);
    const from = ids.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    await writePhaseOrder(ids);
  });
}

/* --------------------------------- Checklist -------------------------------- */

export async function addTask(phaseId: ID, text: string) {
  const items = await db.checklist.where('phaseId').equals(phaseId).toArray();
  const order = items.reduce((max, t) => Math.max(max, t.order), -1) + 1;
  const item: ChecklistItem = { id: uid(), phaseId, text: text.trim(), done: false, order, createdAt: now(), updatedAt: now() };
  await db.checklist.add(item);
  return item;
}

export async function updateTaskText(id: ID, text: string) {
  await db.checklist.update(id, { text: text.trim(), updatedAt: now() });
}

export async function setTaskDone(id: ID, done: boolean) {
  await db.checklist.update(id, { done, completedAt: done ? now() : undefined, updatedAt: now() });
}

export async function deleteTask(id: ID) {
  await db.checklist.delete(id);
}

/* ------------------------------ Knowledge cards ----------------------------- */

export interface CardInput {
  type: CardType;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  source?: string;
}

export async function createCard(phaseId: ID, input: CardInput) {
  const cards = await db.cards.where('phaseId').equals(phaseId).toArray();
  // New cards go to the top of the (unpinned) list.
  const order = cards.reduce((min, c) => Math.min(min, c.order), 0) - 1;
  const card: KnowledgeCard = { id: uid(), phaseId, order, ...normaliseCard(input), createdAt: now(), updatedAt: now() };
  await db.cards.add(card);
  return card;
}

export async function updateCard(id: ID, input: CardInput) {
  await db.cards.update(id, { ...normaliseCard(input), updatedAt: now() });
}

export async function setCardPinned(id: ID, pinned: boolean) {
  await db.cards.update(id, { pinned, updatedAt: now() });
}

export async function deleteCard(id: ID) {
  await db.transaction('rw', [db.cards, db.attachments, db.snapshots, db.documents, db.revisions, db.reviewLog], async () => {
    await db.attachments.where('[ownerType+ownerId]').equals(['card', id]).delete();
    await unlinkCardsFromSnapshots([id]);
    await unlinkFromDocuments({ cardIds: [id] });
    await removeRevisionsOf('card', [id]);
    await db.cards.delete(id);
  });
}

/** Removes deleted cards from any snapshot that referenced them (snapshots themselves are kept). */
async function unlinkCardsFromSnapshots(cardIds: ID[]) {
  if (cardIds.length === 0) return;
  const gone = new Set(cardIds);
  await db.snapshots
    .where('cardIds')
    .anyOf(cardIds)
    .modify((s) => {
      s.cardIds = s.cardIds.filter((c) => !gone.has(c));
    });
}

function normaliseCard(input: CardInput): CardInput {
  return {
    type: input.type,
    title: input.title.trim(),
    content: input.content.trim(),
    tags: normaliseTags(input.tags),
    pinned: input.pinned,
    source: input.source?.trim() || undefined,
  };
}

export function normaliseTags(tags: string[]): string[] {
  const clean = tags.map((t) => t.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-')).filter(Boolean);
  return Array.from(new Set(clean));
}

/* --------------------------------- Snapshots -------------------------------- */

export interface SnapshotInput {
  title: string;
  description: string;
  caption: string;
  tags: string[];
  pinned: boolean;
  cardIds: ID[];
}

/** Stores the full image as an attachment and the metadata + thumbnail as a snapshot. */
export async function addSnapshot(
  phaseId: ID,
  file: File | Blob,
  options: { title: string; cardIds?: ID[] },
): Promise<Snapshot> {
  const image = await prepareImage(file); // throws ImageError for unsupported or unreadable files
  const attachmentId = uid();
  const snapshotId = uid();
  const fileName = 'name' in file && file.name ? file.name : `screenshot.${image.mimeType.split('/')[1]}`;
  const stamp = now();

  const attachment: Attachment = {
    id: attachmentId,
    ownerType: 'snapshot',
    ownerId: snapshotId,
    phaseId,
    kind: 'image',
    fileName,
    mimeType: image.mimeType,
    size: image.blob.size,
    blob: image.blob,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const snapshot: Snapshot = {
    id: snapshotId,
    phaseId,
    attachmentId,
    title: options.title.trim(),
    description: '',
    caption: '',
    tags: [],
    pinned: false,
    cardIds: options.cardIds ?? [],
    fileName,
    mimeType: image.mimeType,
    size: image.blob.size,
    width: image.width,
    height: image.height,
    thumbnail: image.thumbnail,
    createdAt: stamp,
    updatedAt: stamp,
  };

  await db.transaction('rw', [db.attachments, db.snapshots], async () => {
    await db.attachments.add(attachment);
    await db.snapshots.add(snapshot);
  });
  return snapshot;
}

export async function updateSnapshot(id: ID, input: SnapshotInput) {
  await db.snapshots.update(id, {
    title: input.title.trim(),
    description: input.description.trim(),
    caption: input.caption.trim(),
    tags: normaliseTags(input.tags),
    pinned: input.pinned,
    cardIds: Array.from(new Set(input.cardIds)),
    updatedAt: now(),
  });
}

export async function setSnapshotPinned(id: ID, pinned: boolean) {
  await db.snapshots.update(id, { pinned, updatedAt: now() });
}

/** Deletes the snapshot and its stored image (connected documents are kept). */
export async function deleteSnapshot(id: ID) {
  await db.transaction('rw', [db.snapshots, db.attachments, db.documents], async () => {
    await db.attachments.where('[ownerType+ownerId]').equals(['snapshot', id]).delete();
    await unlinkFromDocuments({ snapshotIds: [id] });
    await db.snapshots.delete(id);
  });
}

/* --------------------------------- Extracts --------------------------------- */

export interface ExtractInput {
  kind: ExtractKind;
  title: string;
  text: string;
  sourceDocument?: string;
  location?: string;
  url?: string;
  tags: string[];
  pinned: boolean;
}

function normaliseExtract(input: ExtractInput): ExtractInput {
  return {
    kind: input.kind,
    title: input.title.trim(),
    text: input.text.trim(),
    sourceDocument: input.sourceDocument?.trim() || undefined,
    location: input.location?.trim() || undefined,
    url: normaliseUrl(input.url),
    tags: normaliseTags(input.tags),
    pinned: input.pinned,
  };
}

export async function createExtract(phaseId: ID, input: ExtractInput) {
  const extract: KnowledgeExtract = { id: uid(), phaseId, ...normaliseExtract(input), createdAt: now(), updatedAt: now() };
  await db.extracts.add(extract);
  return extract;
}

export async function updateExtract(id: ID, input: ExtractInput) {
  await db.extracts.update(id, { ...normaliseExtract(input), updatedAt: now() });
}

export async function setExtractPinned(id: ID, pinned: boolean) {
  await db.extracts.update(id, { pinned, updatedAt: now() });
}

export async function deleteExtract(id: ID) {
  await db.transaction('rw', [db.extracts, db.documents, db.revisions, db.reviewLog], async () => {
    await unlinkFromDocuments({ extractIds: [id] });
    await removeRevisionsOf('extract', [id]);
    await db.extracts.delete(id);
  });
}

/* --------------------------------- Documents -------------------------------- */

/** Where a new document goes and what it is connected to from the start. */
export interface DocumentTarget {
  phaseId: ID | null;
  cardId?: ID;
  extractId?: ID;
  snapshotId?: ID;
}

/**
 * Stores the file as an attachment and its metadata as a document, in one
 * transaction. Text indexing and thumbnails happen afterwards in the background
 * (see lib/documentProcessing.ts), so saving is never blocked by parsing.
 */
export async function addDocument(file: File, target: DocumentTarget): Promise<ResearchDocument> {
  const detected = detectDocument(file);
  const name = file.name || 'file';
  if (!detected) throw new DocumentError(`“${name}” is not a supported format. Supported: ${SUPPORTED_FORMATS_LABEL}.`);
  if (file.size === 0) throw new DocumentError(`“${name}” is empty.`);
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new DocumentError(`“${name}” is ${formatBytes(file.size)}. Files up to ${formatBytes(MAX_DOCUMENT_BYTES)} can be stored.`);
  }
  const storage = await readStorageInfo();
  if (storage && storage.quota > 0 && storage.quota - storage.usage < file.size * 1.1) {
    throw new DocumentError(
      `Not enough browser storage for “${name}” (${formatBytes(file.size)}): about ${formatBytes(Math.max(0, storage.quota - storage.usage))} is free.`,
    );
  }

  const meta = DOCUMENT_KIND_META[detected.kind];
  // A filed document belongs to its phase's journal; an unfiled one to the journal on screen.
  const journalId = (target.phaseId && (await db.phases.get(target.phaseId))?.journalId) || getActiveJournalId();
  const attachmentId = uid();
  const documentId = uid();
  const stamp = now();
  // Re-wrap so the stored blob always carries a usable MIME type.
  const blob = file.type === detected.mimeType ? file : new Blob([file], { type: detected.mimeType });

  const attachment: Attachment = {
    id: attachmentId,
    ownerType: 'document',
    ownerId: documentId,
    phaseId: '',
    kind: detected.kind === 'pdf' ? 'pdf' : detected.kind === 'image' ? 'image' : 'document',
    fileName: name,
    mimeType: detected.mimeType,
    size: file.size,
    blob,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const document: ResearchDocument = {
    id: documentId,
    journalId,
    phaseId: target.phaseId,
    attachmentId,
    title: defaultDocumentTitle(name),
    description: '',
    tags: [],
    kind: detected.kind,
    fileName: name,
    mimeType: detected.mimeType,
    size: file.size,
    linkedPhaseIds: [],
    cardIds: target.cardId ? [target.cardId] : [],
    extractIds: target.extractId ? [target.extractId] : [],
    snapshotIds: target.snapshotId ? [target.snapshotId] : [],
    textStatus: meta.indexable || meta.preview === 'image' ? 'pending' : 'none',
    createdAt: stamp,
    updatedAt: stamp,
  };

  await db.transaction('rw', [db.attachments, db.documents], async () => {
    await db.attachments.add(attachment);
    await db.documents.add(document);
  });
  return document;
}

export interface DocumentInput {
  title: string;
  description: string;
  tags: string[];
  phaseId: ID | null;
  linkedPhaseIds: ID[];
  cardIds: ID[];
  extractIds: ID[];
  snapshotIds: ID[];
}

export async function updateDocument(id: ID, input: DocumentInput) {
  await db.documents.update(id, {
    title: input.title.trim(),
    description: input.description.trim(),
    tags: normaliseTags(input.tags),
    phaseId: input.phaseId,
    linkedPhaseIds: Array.from(new Set(input.linkedPhaseIds)).filter((p) => p !== input.phaseId),
    cardIds: Array.from(new Set(input.cardIds)),
    extractIds: Array.from(new Set(input.extractIds)),
    snapshotIds: Array.from(new Set(input.snapshotIds)),
    updatedAt: now(),
  });
}

/** Deletes the document, its stored file and its search text. */
export async function deleteDocument(id: ID) {
  await db.transaction('rw', [db.documents, db.attachments, db.documentTexts], async () => {
    await db.attachments.where('[ownerType+ownerId]').equals(['document', id]).delete();
    await db.documentTexts.delete(id);
    await db.documents.delete(id);
  });
}

/** Result of background processing: searchable text, page count, thumbnail. */
export interface DocumentDigest {
  status: DocumentTextStatus;
  text?: string;
  truncated?: boolean;
  pageCount?: number;
  thumbnail?: Blob | null;
}

export async function saveDocumentDigest(id: ID, digest: DocumentDigest) {
  await db.transaction('rw', [db.documents, db.documentTexts], async () => {
    // The document may have been deleted while it was being processed.
    if (!(await db.documents.get(id))) return;
    if (digest.text) await db.documentTexts.put({ documentId: id, text: digest.text, truncated: !!digest.truncated });
    const changes: Partial<ResearchDocument> = { textStatus: digest.status };
    if (digest.pageCount) changes.pageCount = digest.pageCount;
    if (digest.thumbnail) changes.thumbnail = digest.thumbnail;
    // Not a user edit, so updatedAt is left alone.
    await db.documents.update(id, changes);
  });
}

export type DocumentLinkKind = 'card' | 'extract' | 'snapshot' | 'phase';

const LINK_FIELD = { card: 'cardIds', extract: 'extractIds', snapshot: 'snapshotIds', phase: 'linkedPhaseIds' } as const;

/**
 * Sets which documents are connected to one knowledge item (or phase), from the
 * item's side. Links are stored on the documents, so this adds and removes the
 * item's id across them in one transaction.
 */
export async function setItemDocuments(kind: DocumentLinkKind, itemId: ID, documentIds: ID[]) {
  const field = LINK_FIELD[kind];
  const wanted = new Set(documentIds);
  await db.transaction('rw', db.documents, async () => {
    const current = new Set((await db.documents.where(field).equals(itemId).primaryKeys()) as ID[]);
    const changed = [...new Set([...current, ...wanted])].filter((id) => current.has(id) !== wanted.has(id));
    if (changed.length === 0) return;
    await db.documents
      .where('id')
      .anyOf(changed)
      .modify((d) => {
        const list = d[field].filter((x) => x !== itemId);
        // A document filed under this phase is already connected to it.
        if (wanted.has(d.id) && !(kind === 'phase' && d.phaseId === itemId)) list.push(itemId);
        d[field] = list;
        d.updatedAt = now();
      });
  });
}

/** Removes deleted items (and a deleted phase) from every document that referenced them. */
async function unlinkFromDocuments(gone: { cardIds?: ID[]; extractIds?: ID[]; snapshotIds?: ID[]; phaseId?: ID }) {
  const cards = new Set(gone.cardIds ?? []);
  const extracts = new Set(gone.extractIds ?? []);
  const snapshots = new Set(gone.snapshotIds ?? []);
  const lookups: Promise<ID[]>[] = [];
  if (cards.size) lookups.push(db.documents.where('cardIds').anyOf([...cards]).primaryKeys() as Promise<ID[]>);
  if (extracts.size) lookups.push(db.documents.where('extractIds').anyOf([...extracts]).primaryKeys() as Promise<ID[]>);
  if (snapshots.size) lookups.push(db.documents.where('snapshotIds').anyOf([...snapshots]).primaryKeys() as Promise<ID[]>);
  if (gone.phaseId) {
    lookups.push(db.documents.where('linkedPhaseIds').equals(gone.phaseId).primaryKeys() as Promise<ID[]>);
    lookups.push(db.documents.where('phaseId').equals(gone.phaseId).primaryKeys() as Promise<ID[]>);
  }
  const ids = Array.from(new Set((await Promise.all(lookups)).flat()));
  if (ids.length === 0) return;
  await db.documents
    .where('id')
    .anyOf(ids)
    .modify((d) => {
      d.cardIds = d.cardIds.filter((c) => !cards.has(c));
      d.extractIds = d.extractIds.filter((e) => !extracts.has(e));
      d.snapshotIds = d.snapshotIds.filter((s) => !snapshots.has(s));
      if (gone.phaseId) {
        d.linkedPhaseIds = d.linkedPhaseIds.filter((p) => p !== gone.phaseId);
        if (d.phaseId === gone.phaseId) d.phaseId = null;
      }
    });
}

/* ---------------------------------- Recall ---------------------------------- */

/**
 * Adds cards or extracts to Recall. Sources already in Recall are skipped, so
 * this never creates duplicates. Returns how many were added.
 */
export async function addToRecall(sourceType: RevisionSourceType, sourceIds: ID[]): Promise<number> {
  if (sourceIds.length === 0) return 0;
  const table = sourceType === 'card' ? db.cards : db.extracts;
  return db.transaction('rw', [db.revisions, table, db.phases], async () => {
    const existing = new Set(
      (await db.revisions.where('[sourceType+sourceId]').anyOf(sourceIds.map((id) => [sourceType, id])).toArray()).map((r) => r.sourceId),
    );
    const sources = (await table.bulkGet(sourceIds.filter((id) => !existing.has(id)))).filter((s) => !!s);
    const phases = new Map((await db.phases.bulkGet([...new Set(sources.map((s) => s.phaseId))])).filter((p) => !!p).map((p) => [p.id, p]));
    const stamp = now();
    const added: RevisionCard[] = [];
    for (const source of sources) {
      const phase = phases.get(source.phaseId);
      if (!phase) continue;
      added.push({
        id: uid(),
        journalId: phase.journalId,
        sourceType,
        sourceId: source.id,
        prompt: '',
        status: 'new',
        level: 0,
        reviewCount: 0,
        lapses: 0,
        dueAt: stamp,
        createdAt: stamp,
        updatedAt: stamp,
      });
    }
    await db.revisions.bulkAdd(added);
    return added.length;
  });
}

/** Removes a revision card and its history. The source card or extract is kept. */
export async function removeFromRecall(revisionIds: ID[]) {
  await db.transaction('rw', [db.revisions, db.reviewLog], async () => {
    await db.reviewLog.where('revisionId').anyOf(revisionIds).delete();
    await db.revisions.bulkDelete(revisionIds);
  });
}

export async function updateRevisionPrompt(id: ID, prompt: string) {
  await db.revisions.update(id, { prompt: prompt.trim(), updatedAt: now() });
}

/** Records a review and reschedules the card. Returns the log entry id (for undo). */
export async function reviewRevision(id: ID, result: ReviewResult): Promise<ID | null> {
  return db.transaction('rw', [db.revisions, db.reviewLog], async () => {
    const card = await db.revisions.get(id);
    if (!card) return null;
    const at = now();
    const entry: ReviewLogEntry = { id: uid(), revisionId: id, journalId: card.journalId, reviewedAt: at, result, before: scheduleOf(card) };
    await db.reviewLog.add(entry);
    await db.revisions.update(id, { ...nextSchedule(card, result, at), updatedAt: at });
    return entry.id;
  });
}

/** Undoes one review: restores the schedule saved with it and drops it from the history. */
export async function undoReview(logId: ID) {
  await db.transaction('rw', [db.revisions, db.reviewLog], async () => {
    const entry = await db.reviewLog.get(logId);
    if (!entry) return;
    const { lastReviewedAt, ...rest } = entry.before;
    // Dexie's update() removes a field set to undefined, which is what a never-reviewed card needs.
    await db.revisions.update(entry.revisionId, { ...rest, lastReviewedAt, updatedAt: now() });
    await db.reviewLog.delete(logId);
  });
}

/** Removes the revision cards (and history) of deleted sources. Call inside a transaction that includes both tables. */
async function removeRevisionsOf(sourceType: RevisionSourceType, sourceIds: ID[]) {
  if (sourceIds.length === 0) return;
  const ids = (await db.revisions.where('[sourceType+sourceId]').anyOf(sourceIds.map((id) => [sourceType, id])).primaryKeys()) as ID[];
  if (ids.length === 0) return;
  await db.reviewLog.where('revisionId').anyOf(ids).delete();
  await db.revisions.bulkDelete(ids);
}

/* ----------------------------------- Meta ----------------------------------- */

/** Remembers the last phase opened, per journal (for "Resume" on the overview). */
export async function setLastVisitedPhase(id: ID) {
  const phase = await db.phases.get(id);
  if (phase) await db.meta.put({ key: `lastPhaseId:${phase.journalId}`, value: id });
}

/**
 * Records a successful backup export for each journal it included, for the
 * overview's backup reminder. Per journal, so exporting one journal doesn't
 * hide the reminder for another. Restoring a backup never calls this.
 */
export async function recordBackupExport(journalIds: ID[]) {
  const at = now();
  await db.meta.bulkPut(journalIds.map((id) => ({ key: lastBackupKey(id), value: at })));
}

/* --------------------------------- Journals --------------------------------- */

export type JournalTemplate = { kind: 'dcf' } | { kind: 'empty' } | { kind: 'copy'; journalId: ID };

export interface JournalInput {
  name: string;
  description: string;
}

/** A name not used by another journal: "Name", else "Name (2)", "Name (3)"… */
export async function uniqueJournalName(name: string, exceptId?: ID): Promise<string> {
  const base = name.trim() || 'Untitled journal';
  const taken = new Set((await db.journals.toArray()).filter((j) => j.id !== exceptId).map((j) => j.name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base} (${n})`.toLowerCase())) return `${base} (${n})`;
}

/**
 * Creates a journal from the starter DCF template, as an empty workspace, or as
 * an independent copy of another journal (every record and file duplicated
 * with new ids). Returns the new journal.
 */
export async function createJournal(input: JournalInput, template: JournalTemplate): Promise<Journal> {
  const stamp = now();
  const journal: Journal = { id: uid(), name: await uniqueJournalName(input.name), description: input.description.trim(), createdAt: stamp, updatedAt: stamp };

  if (template.kind === 'copy') {
    // Read first, then write: the copy is made from one consistent read.
    const source = await collectJournal(template.journalId);
    const { bundle } = remapBundle(source, journal);
    await db.transaction('rw', JOURNAL_TABLES, () => writeBundle(bundle));
    return journal;
  }

  await db.transaction('rw', [db.journals, db.phases, db.checklist, db.cards, db.extracts], async () => {
    await db.journals.add(journal);
    if (template.kind === 'dcf') {
      const starter = buildStarterJournal(journal.id, journal);
      await db.phases.bulkAdd(starter.phases);
      await db.checklist.bulkAdd(starter.tasks);
      await db.cards.bulkAdd(starter.cards);
      await db.extracts.bulkAdd(starter.extracts);
    }
  });
  return journal;
}

export async function updateJournal(id: ID, input: JournalInput) {
  await db.journals.update(id, { name: await uniqueJournalName(input.name, id), description: input.description.trim(), updatedAt: now() });
}

/**
 * Permanently deletes a journal and everything it owns, files included, in one
 * transaction. The last remaining journal cannot be deleted.
 */
export async function deleteJournal(id: ID) {
  await db.transaction('rw', JOURNAL_TABLES, async () => {
    if ((await db.journals.count()) <= 1) throw new Error('The last journal cannot be deleted.');
    await deleteJournalRecords(id);
  });
}

export type BundleImport = { mode: 'new'; name: string } | { mode: 'replace'; journalId: ID };

/**
 * Writes a journal from a backup. "new" adds it as a separate journal; "replace"
 * swaps the contents of an existing journal for the backup's, keeping its id.
 * Ids are always regenerated, so nothing collides with records already here.
 * Returns the journal and how many broken records were left out.
 */
export async function importJournalBundle(source: JournalBundle, target: BundleImport): Promise<{ journal: Journal; dropped: number }> {
  const stamp = now();
  return db.transaction('rw', JOURNAL_TABLES, async () => {
    let journal: Journal;
    if (target.mode === 'replace') {
      const existing = await db.journals.get(target.journalId);
      if (!existing) throw new Error('The journal to replace no longer exists.');
      journal = { ...existing, name: source.journal.name || existing.name, description: source.journal.description, updatedAt: stamp };
      await deleteJournalRecords(existing.id, { keepJournal: true });
    } else {
      journal = { id: uid(), name: await uniqueJournalName(target.name), description: source.journal.description, createdAt: source.journal.createdAt || stamp, updatedAt: stamp };
    }
    const { bundle, dropped } = remapBundle(source, journal);
    await writeBundle(bundle);
    return { journal, dropped };
  });
}
