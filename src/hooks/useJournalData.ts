import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { DEFAULT_JOURNAL_ID } from '../lib/id';
import { excerpt, tokenize } from '../lib/search';
import type { ChecklistItem, ID, KnowledgeCard, KnowledgeExtract, Phase, PhaseStats, ResearchDocument, Snapshot } from '../types';

/** All phases of the journal, in pathway order. `undefined` while loading. */
export function usePhases() {
  return useLiveQuery(() => db.phases.where('journalId').equals(DEFAULT_JOURNAL_ID).sortBy('order'), []);
}

/** Task / card / library counts per phase, for the overview. */
export function usePhaseStats() {
  return useLiveQuery(async () => {
    // Index keys only for snapshots/extracts/documents: avoids loading thumbnails just to count them.
    const [tasks, cards, snapshotPhaseIds, extractPhaseIds, documentPhaseIds, documentLinkedPhaseIds] = await Promise.all([
      db.checklist.toArray(),
      db.cards.toArray(),
      db.snapshots.orderBy('phaseId').keys(),
      db.extracts.orderBy('phaseId').keys(),
      db.documents.orderBy('phaseId').keys(),
      db.documents.orderBy('linkedPhaseIds').keys(),
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
  }, []);
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

export function useLastVisitedPhaseId() {
  return useLiveQuery(async () => (await db.meta.get('lastPhaseId'))?.value as ID | undefined, []);
}

/** Every tag in use across cards, snapshots, extracts and documents, for suggestions. */
export function useAllTags() {
  return (
    useLiveQuery(async () => {
      const lists = await Promise.all([
        db.cards.orderBy('tags').uniqueKeys(),
        db.snapshots.orderBy('tags').uniqueKeys(),
        db.extracts.orderBy('tags').uniqueKeys(),
        db.documents.orderBy('tags').uniqueKeys(),
      ]);
      return Array.from(new Set(lists.flat() as string[])).sort();
    }, []) ?? []
  );
}

/* --------------------------------- Documents -------------------------------- */

const newestFirst = (a: ResearchDocument, b: ResearchDocument) => b.createdAt - a.createdAt;

/** Every document in the journal, newest first. `undefined` while loading. */
export function useDocuments() {
  return useLiveQuery(async () => (await db.documents.where('journalId').equals(DEFAULT_JOURNAL_ID).toArray()).sort(newestFirst), []);
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
  return useLiveQuery(async () => {
    const tokens = tokenize(query);
    const hits = new Map<ID, string>();
    if (tokens.length === 0) return hits;
    await db.documentTexts.each((entry) => {
      const lower = entry.text.toLowerCase();
      if (tokens.every((t) => lower.includes(t))) hits.set(entry.documentId, excerpt(entry.text, tokens));
    });
    return hits;
  }, [query]);
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
