import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { lastBackupKey } from '../db/bundle';
import { DEFAULT_JOURNAL_ID } from '../lib/id';
import { useNow } from './useNow';
import { useActiveJournalId } from './useActiveJournal';
import { isDue } from '../lib/recall';
import { excerpt, tokenize } from '../lib/search';
import type {
  ChecklistItem,
  ID,
  KnowledgeCard,
  KnowledgeExtract,
  Phase,
  PhaseStats,
  ResearchDocument,
  RevisionCard,
  RevisionSourceType,
  Snapshot,
} from '../types';

/**
 * Ids of a journal's phases. Checklists, cards, snapshots and extracts belong to
 * a journal through their phase, so this is how their queries are scoped.
 */
export async function journalPhaseIds(journalId: ID): Promise<ID[]> {
  return (await db.phases.where('journalId').equals(journalId).primaryKeys()) as ID[];
}

/** All phases of the active journal, in pathway order. `undefined` while loading. */
export function usePhases() {
  const journalId = useActiveJournalId();
  return useLiveQuery(async () => (journalId ? db.phases.where('journalId').equals(journalId).sortBy('order') : undefined), [journalId]);
}

/** Task / card / library counts per phase of the active journal, for the overview. */
export function usePhaseStats() {
  const journalId = useActiveJournalId();
  return useLiveQuery(async () => {
    if (!journalId) return undefined;
    const phaseIds = await journalPhaseIds(journalId);
    // Index keys only for snapshots/extracts/documents: avoids loading thumbnails just to count them.
    const [tasks, cards, snapshotPhaseIds, extractPhaseIds, documentPhaseIds, documentLinkedPhaseIds] = await Promise.all([
      db.checklist.where('phaseId').anyOf(phaseIds).toArray(),
      db.cards.where('phaseId').anyOf(phaseIds).toArray(),
      db.snapshots.where('phaseId').anyOf(phaseIds).keys(),
      db.extracts.where('phaseId').anyOf(phaseIds).keys(),
      db.documents.where('phaseId').anyOf(phaseIds).keys(),
      db.documents.where('linkedPhaseIds').anyOf(phaseIds).keys(),
    ]);
    const stats = new Map<ID, PhaseStats>();
    const get = (id: ID) => {
      let s = stats.get(id);
      if (!s) stats.set(id, (s = { tasks: 0, done: 0, cards: 0, pinned: 0, snapshots: 0, extracts: 0, documents: 0 }));
      return s;
    };
    for (const t of tasks) {
      const s = get(t.phaseId);
      s.tasks++;
      if (t.done) s.done++;
    }
    for (const c of cards) {
      const s = get(c.phaseId);
      s.cards++;
      if (c.pinned) s.pinned++;
    }
    for (const id of snapshotPhaseIds) get(id as ID).snapshots++;
    for (const id of extractPhaseIds) get(id as ID).extracts++;
    // Unfiled documents have no phaseId and so are not in the index.
    for (const id of [...documentPhaseIds, ...documentLinkedPhaseIds]) get(id as ID).documents++;
    return stats;
  }, [journalId]);
}

export function sortCards(cards: KnowledgeCard[]) {
  return [...cards].sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.order - b.order || b.createdAt - a.createdAt);
}

/** Pinned first, then newest first. */
export function sortByPinnedThenNewest<T extends { pinned: boolean; createdAt: number }>(items: T[]) {
  return [...items].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt);
}

export interface PhaseDetail {
  phase: Phase;
  tasks: ChecklistItem[];
  cards: KnowledgeCard[];
  snapshots: Snapshot[];
  extracts: KnowledgeExtract[];
  /** Snapshots (from any phase) linked to this phase's cards. */
  linkedSnapshots: Snapshot[];
}

/** Everything the phase workspace needs, in one live query. */
export function usePhaseDetail(phaseId: ID | null) {
  return useLiveQuery(async (): Promise<PhaseDetail | null> => {
    if (!phaseId) return null;
    const [phase, tasks, cards, snapshots, extracts] = await Promise.all([
      db.phases.get(phaseId),
      db.checklist.where('phaseId').equals(phaseId).sortBy('order'),
      db.cards.where('phaseId').equals(phaseId).toArray(),
      db.snapshots.where('phaseId').equals(phaseId).toArray(),
      db.extracts.where('phaseId').equals(phaseId).toArray(),
    ]);
    if (!phase) return null;
    const cardIds = cards.map((c) => c.id);
    const linked = cardIds.length ? await db.snapshots.where('cardIds').anyOf(cardIds).distinct().toArray() : [];
    return {
      phase,
      tasks,
      cards: sortCards(cards),
      snapshots: sortByPinnedThenNewest(snapshots),
      extracts: sortByPinnedThenNewest(extracts),
      linkedSnapshots: linked.sort((a, b) => a.createdAt - b.createdAt),
    };
  }, [phaseId]);
}

/** Last phase opened in the active journal (each journal remembers its own). */
export function useLastVisitedPhaseId() {
  const journalId = useActiveJournalId();
  return useLiveQuery(async () => {
    if (!journalId) return undefined;
    const own = (await db.meta.get(`lastPhaseId:${journalId}`))?.value as ID | undefined;
    // Before Milestone 5 there was one journal and one shared key.
    if (own || journalId !== DEFAULT_JOURNAL_ID) return own;
    return (await db.meta.get('lastPhaseId'))?.value as ID | undefined;
  }, [journalId]);
}

/** When the active journal was last included in an exported backup: `null` if never, `undefined` while loading. */
export function useLastBackupAt() {
  const journalId = useActiveJournalId();
  return useLiveQuery(async () => {
    if (!journalId) return undefined;
    return ((await db.meta.get(lastBackupKey(journalId)))?.value as number | undefined) ?? null;
  }, [journalId]);
}

/** Every tag in use across the active journal's cards, snapshots, extracts and documents, for suggestions. */
export function useAllTags() {
  const journalId = useActiveJournalId();
  return (
    useLiveQuery(async () => {
      if (!journalId) return [];
      const phaseIds = await journalPhaseIds(journalId);
      const [cards, snapshots, extracts, documents] = await Promise.all([
        db.cards.where('phaseId').anyOf(phaseIds).toArray(),
        db.snapshots.where('phaseId').anyOf(phaseIds).toArray(),
        db.extracts.where('phaseId').anyOf(phaseIds).toArray(),
        db.documents.where('journalId').equals(journalId).toArray(),
      ]);
      return Array.from(new Set([...cards, ...snapshots, ...extracts, ...documents].flatMap((r) => r.tags))).sort();
    }, [journalId]) ?? []
  );
}

/* --------------------------------- Documents -------------------------------- */

const newestFirst = (a: ResearchDocument, b: ResearchDocument) => b.createdAt - a.createdAt;

/** Every document in the active journal, newest first. `undefined` while loading. */
export function useDocuments() {
  const journalId = useActiveJournalId();
  return useLiveQuery(
    async () => (journalId ? (await db.documents.where('journalId').equals(journalId).toArray()).sort(newestFirst) : undefined),
    [journalId],
  );
}

export function useDocument(id: ID | null) {
  return useLiveQuery(async () => (id ? (await db.documents.get(id)) ?? null : null), [id]);
}

/** Documents filed under a phase, and those filed elsewhere but linked to it. */
export function usePhaseDocuments(phaseId: ID) {
  return useLiveQuery(async () => {
    const [filed, linked] = await Promise.all([
      db.documents.where('phaseId').equals(phaseId).toArray(),
      db.documents.where('linkedPhaseIds').equals(phaseId).toArray(),
    ]);
    return { filed: filed.sort(newestFirst), linked: linked.sort(newestFirst) };
  }, [phaseId]);
}

/**
 * Documents whose stored text contains every word of `query`, mapped to an
 * excerpt around the first match. Scans the text table, so callers should pass
 * a deferred query.
 */
export function useDocumentTextMatches(query: string) {
  const journalId = useActiveJournalId();
  return useLiveQuery(async () => {
    const tokens = tokenize(query);
    const hits = new Map<ID, string>();
    if (tokens.length === 0 || !journalId) return hits;
    // Only this journal's texts are read.
    const ids = (await db.documents.where('journalId').equals(journalId).primaryKeys()) as ID[];
    const texts = await db.documentTexts.bulkGet(ids);
    for (const entry of texts) {
      if (!entry) continue;
      const lower = entry.text.toLowerCase();
      if (tokens.every((t) => lower.includes(t))) hits.set(entry.documentId, excerpt(entry.text, tokens));
    }
    return hits;
  }, [query, journalId]);
}

/** The stored file behind a document or snapshot. */
export function useAttachmentBlob(attachmentId: ID | null | undefined) {
  return useLiveQuery(async () => (attachmentId ? (await db.attachments.get(attachmentId))?.blob ?? null : null), [attachmentId]);
}

/** Documents connected to one knowledge card, extract or snapshot. */
export function useItemDocuments(kind: 'card' | 'extract' | 'snapshot', itemId: ID) {
  const field = kind === 'card' ? 'cardIds' : kind === 'extract' ? 'extractIds' : 'snapshotIds';
  return useLiveQuery(async () => (await db.documents.where(field).equals(itemId).toArray()).sort(newestFirst), [field, itemId]) ?? [];
}

/* ---------------------------------- Recall ---------------------------------- */

/** A revision card joined with the card or extract it was made from. */
export interface RecallItem {
  revision: RevisionCard;
  card?: KnowledgeCard;
  extract?: KnowledgeExtract;
  phaseId: ID;
  pinned: boolean;
}

/** Every revision card of the active journal with its source. `undefined` while loading. */
export function useRecallItems() {
  const journalId = useActiveJournalId();
  return useLiveQuery(async () => {
    if (!journalId) return undefined;
    const revisions = await db.revisions.where('journalId').equals(journalId).toArray();
    const cardIds = revisions.filter((r) => r.sourceType === 'card').map((r) => r.sourceId);
    const extractIds = revisions.filter((r) => r.sourceType === 'extract').map((r) => r.sourceId);
    const [cards, extracts] = await Promise.all([db.cards.bulkGet(cardIds), db.extracts.bulkGet(extractIds)]);
    const cardMap = new Map(cards.filter((c) => !!c).map((c) => [c.id, c]));
    const extractMap = new Map(extracts.filter((e) => !!e).map((e) => [e.id, e]));
    const items: RecallItem[] = [];
    for (const revision of revisions) {
      const card = revision.sourceType === 'card' ? cardMap.get(revision.sourceId) : undefined;
      const extract = revision.sourceType === 'extract' ? extractMap.get(revision.sourceId) : undefined;
      const source = card ?? extract;
      // Deletes remove revisions with their source; this only guards against a half-loaded state.
      if (!source) continue;
      items.push({ revision, card, extract, phaseId: source.phaseId, pinned: source.pinned });
    }
    return items;
  }, [journalId]);
}

/** The revision card made from one card or extract, or null when it is not in Recall. */
export function useSourceRevision(sourceType: RevisionSourceType, sourceId: ID) {
  return useLiveQuery(async () => (await db.revisions.where('[sourceType+sourceId]').equals([sourceType, sourceId]).first()) ?? null, [sourceType, sourceId]);
}

/** Number of revision cards due now, for the main navigation badge. Re-checked every minute. */
export function useDueRevisionCount() {
  const now = useNow();
  const journalId = useActiveJournalId();
  return useLiveQuery(async () => (journalId ? db.revisions.where('journalId').equals(journalId).filter((r) => isDue(r)).count() : 0), [now, journalId]);
}
