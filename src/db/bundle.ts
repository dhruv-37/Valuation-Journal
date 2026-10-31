import { db } from './database';
import { uid } from '../lib/id';
import type { Attachment, ID, Journal, JournalBundle, JournalCounts, ResearchDocument, Snapshot } from '../types';

/**
 * Whole-journal operations: read a journal into a bundle, write a bundle as a
 * journal with fresh ids, and delete a journal with everything it owns. Used by
 * the journal and backup functions in repository.ts; components never call
 * these directly.
 *
 * Ownership: phases carry `journalId`; checklists, cards, snapshots, extracts
 * and phase-owned attachments belong to a journal through their phase;
 * documents, revisions and review logs carry `journalId`; document files are
 * found through their document.
 */

/** Every table a journal has records in. Writes that touch whole journals lock all of them. */
export const JOURNAL_TABLES = [
  db.journals,
  db.phases,
  db.checklist,
  db.cards,
  db.snapshots,
  db.extracts,
  db.documents,
  db.documentTexts,
  db.attachments,
  db.revisions,
  db.reviewLog,
  db.meta,
];

const lastPhaseKey = (journalId: ID) => `lastPhaseId:${journalId}`;

/** Reads all of a journal's records (files included as Blobs). */
export async function collectJournal(journalId: ID): Promise<JournalBundle> {
  return db.transaction('r', JOURNAL_TABLES, async () => {
    const journal = await db.journals.get(journalId);
    if (!journal) throw new Error('This journal no longer exists.');
    const phases = await db.phases.where('journalId').equals(journalId).sortBy('order');
    const phaseIds = phases.map((p) => p.id);
    const [checklist, cards, snapshots, extracts, documents, revisions, reviewLog, phaseFiles, lastPhase, legacyLastPhase] = await Promise.all([
      db.checklist.where('phaseId').anyOf(phaseIds).toArray(),
      db.cards.where('phaseId').anyOf(phaseIds).toArray(),
      db.snapshots.where('phaseId').anyOf(phaseIds).toArray(),
      db.extracts.where('phaseId').anyOf(phaseIds).toArray(),
      db.documents.where('journalId').equals(journalId).toArray(),
      db.revisions.where('journalId').equals(journalId).toArray(),
      db.reviewLog.where('journalId').equals(journalId).toArray(),
      db.attachments.where('phaseId').anyOf(phaseIds).toArray(),
      db.meta.get(lastPhaseKey(journalId)),
      db.meta.get('lastPhaseId'),
    ]);
    const [documentFiles, documentTexts] = await Promise.all([
      db.attachments.bulkGet(documents.map((d) => d.attachmentId)),
      db.documentTexts.bulkGet(documents.map((d) => d.id)),
    ]);
    const lastPhaseId = (lastPhase?.value ?? legacyLastPhase?.value) as ID | undefined;
    return {
      journal,
      phases,
      checklist,
      cards,
      snapshots,
      extracts,
      documents,
      documentTexts: documentTexts.filter((t) => !!t),
      attachments: [...phaseFiles, ...documentFiles.filter((a): a is Attachment => !!a)],
      revisions,
      reviewLog,
      lastPhaseId: lastPhaseId && phaseIds.includes(lastPhaseId) ? lastPhaseId : undefined,
    };
  });
}

/** Counts for a journal already in the database. */
export async function countJournal(journalId: ID): Promise<JournalCounts> {
  const phaseIds = (await db.phases.where('journalId').equals(journalId).primaryKeys()) as ID[];
  const [tasks, cards, extracts, revisions, snapshots, documents] = await Promise.all([
    db.checklist.where('phaseId').anyOf(phaseIds).count(),
    db.cards.where('phaseId').anyOf(phaseIds).count(),
    db.extracts.where('phaseId').anyOf(phaseIds).count(),
    db.revisions.where('journalId').equals(journalId).count(),
    db.snapshots.where('phaseId').anyOf(phaseIds).toArray(),
    db.documents.where('journalId').equals(journalId).toArray(),
  ]);
  return {
    phases: phaseIds.length,
    tasks,
    cards,
    snapshots: snapshots.length,
    extracts,
    documents: documents.length,
    revisions,
    fileBytes: snapshots.reduce((n, s) => n + s.size, 0) + documents.reduce((n, d) => n + d.size, 0),
  };
}

export function countBundle(b: JournalBundle): JournalCounts {
  return {
    phases: b.phases.length,
    tasks: b.checklist.length,
    cards: b.cards.length,
    snapshots: b.snapshots.length,
    extracts: b.extracts.length,
    documents: b.documents.length,
    revisions: b.revisions.length,
    fileBytes: b.attachments.reduce((n, a) => n + a.size, 0),
  };
}

export interface RemapResult {
  bundle: JournalBundle;
  /** Records left out because something they depend on is missing (e.g. a snapshot without its image). */
  dropped: number;
}

/**
 * Gives every record a new id and rewrites every reference to match, so the
 * bundle can be written next to its original without sharing anything.
 * References to records that are not in the bundle are removed; records that
 * cannot exist without them are left out and counted.
 */
export function remapBundle(source: JournalBundle, journal: Journal): RemapResult {
  const ids = new Map<ID, ID>();
  const fresh = <T extends { id: ID }>(list: T[]) => list.map((r) => (ids.set(r.id, uid()), r));
  const to = (old: ID | null | undefined) => (old ? ids.get(old) : undefined);
  const mapList = (list: ID[]) => list.map((x) => ids.get(x)).filter((x): x is ID => !!x);
  let dropped = 0;
  const keep = <T>(list: T[], ok: (r: T) => boolean) => {
    const kept = list.filter(ok);
    dropped += list.length - kept.length;
    return kept;
  };

  // Phases first: everything else hangs off them. Their order is renumbered 0..n-1.
  const phases = fresh([...source.phases].sort((a, b) => a.order - b.order));
  const files = new Map(source.attachments.map((a) => [a.id, a]));
  const checklist = fresh(keep(source.checklist, (t) => ids.has(t.phaseId)));
  const cards = fresh(keep(source.cards, (c) => ids.has(c.phaseId)));
  const extracts = fresh(keep(source.extracts, (e) => ids.has(e.phaseId)));
  // A snapshot or document is only useful with its file.
  const snapshots = fresh(keep(source.snapshots, (s) => ids.has(s.phaseId) && files.has(s.attachmentId)));
  const documents = fresh(keep(source.documents, (d) => files.has(d.attachmentId)));
  const owners = new Set([...phases, ...cards, ...snapshots, ...documents].map((r) => r.id));
  const attachments = fresh(keep(source.attachments, (a) => owners.has(a.ownerId)));
  const sources = { card: new Set(cards.map((c) => c.id)), extract: new Set(extracts.map((e) => e.id)) };
  const revisions = fresh(keep(source.revisions, (r) => sources[r.sourceType]?.has(r.sourceId) ?? false));
  const reviewLog = fresh(keep(source.reviewLog, (l) => ids.has(l.revisionId)));
  const texts = keep(source.documentTexts, (t) => ids.has(t.documentId));

  const journalId = journal.id;
  return {
    dropped,
    bundle: {
      journal,
      phases: phases.map((p, order) => ({ ...p, id: to(p.id)!, journalId, order })),
      checklist: checklist.map((t) => ({ ...t, id: to(t.id)!, phaseId: to(t.phaseId)! })),
      cards: cards.map((c) => ({ ...c, id: to(c.id)!, phaseId: to(c.phaseId)! })),
      extracts: extracts.map((e) => ({ ...e, id: to(e.id)!, phaseId: to(e.phaseId)! })),
      snapshots: snapshots.map(
        (s): Snapshot => ({ ...s, id: to(s.id)!, phaseId: to(s.phaseId)!, attachmentId: to(s.attachmentId)!, cardIds: mapList(s.cardIds) }),
      ),
      documents: documents.map((d): ResearchDocument => {
        const phaseId = to(d.phaseId) ?? null;
        return {
          ...d,
          id: to(d.id)!,
          journalId,
          phaseId,
          attachmentId: to(d.attachmentId)!,
          linkedPhaseIds: mapList(d.linkedPhaseIds).filter((p) => p !== phaseId),
          cardIds: mapList(d.cardIds),
          extractIds: mapList(d.extractIds),
          snapshotIds: mapList(d.snapshotIds),
        };
      }),
      documentTexts: texts.map((t) => ({ ...t, documentId: to(t.documentId)! })),
      // Document files stay outside the phase cascade (phaseId '').
      attachments: attachments.map((a) => ({ ...a, id: to(a.id)!, ownerId: to(a.ownerId)!, phaseId: a.ownerType === 'document' ? '' : (to(a.phaseId) ?? '') })),
      revisions: revisions.map((r) => ({ ...r, id: to(r.id)!, journalId, sourceId: to(r.sourceId)! })),
      reviewLog: reviewLog.map((l) => ({ ...l, id: to(l.id)!, journalId, revisionId: to(l.revisionId)! })),
      lastPhaseId: to(source.lastPhaseId),
    },
  };
}

/** Writes a remapped bundle. Call inside a transaction over JOURNAL_TABLES. */
export async function writeBundle(b: JournalBundle) {
  await db.journals.put(b.journal);
  await db.phases.bulkAdd(b.phases);
  await db.checklist.bulkAdd(b.checklist);
  await db.cards.bulkAdd(b.cards);
  await db.extracts.bulkAdd(b.extracts);
  await db.attachments.bulkAdd(b.attachments);
  await db.snapshots.bulkAdd(b.snapshots);
  await db.documents.bulkAdd(b.documents);
  await db.documentTexts.bulkPut(b.documentTexts);
  await db.revisions.bulkAdd(b.revisions);
  await db.reviewLog.bulkAdd(b.reviewLog);
  if (b.lastPhaseId) await db.meta.put({ key: lastPhaseKey(b.journal.id), value: b.lastPhaseId });
}

/**
 * Deletes everything a journal owns. The journal record itself is kept when
 * `keepJournal` is set (used when replacing a journal's contents from a backup).
 * Call inside a transaction over JOURNAL_TABLES.
 */
export async function deleteJournalRecords(journalId: ID, { keepJournal = false } = {}) {
  const phaseIds = (await db.phases.where('journalId').equals(journalId).primaryKeys()) as ID[];
  const documents = await db.documents.where('journalId').equals(journalId).toArray();
  const documentIds = documents.map((d) => d.id);
  await db.checklist.where('phaseId').anyOf(phaseIds).delete();
  await db.cards.where('phaseId').anyOf(phaseIds).delete();
  await db.snapshots.where('phaseId').anyOf(phaseIds).delete();
  await db.extracts.where('phaseId').anyOf(phaseIds).delete();
  await db.attachments.where('phaseId').anyOf(phaseIds).delete();
  await db.attachments.bulkDelete(documents.map((d) => d.attachmentId));
  await db.documentTexts.bulkDelete(documentIds);
  await db.documents.bulkDelete(documentIds);
  await db.reviewLog.where('journalId').equals(journalId).delete();
  await db.revisions.where('journalId').equals(journalId).delete();
  await db.phases.bulkDelete(phaseIds);
  await db.meta.delete(lastPhaseKey(journalId));
  if (!keepJournal) await db.journals.delete(journalId);
}
