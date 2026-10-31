import { CARD_TYPES, EXTRACT_KINDS, type ID, type Phase } from '../../types';
import type { RecallItem } from '../../hooks/useJournalData';
import { CARD_TYPE_META } from '../../lib/cardTypes';
import { EXTRACT_KIND_META } from '../../lib/extractKinds';
import { isDue } from '../../lib/recall';

/** Text and labels for showing a revision card, derived from its source each time. */

export function recallPrompt(item: RecallItem): string {
  if (item.revision.prompt) return item.revision.prompt;
  if (item.card) return item.card.title || firstLine(item.card.content);
  const e = item.extract!;
  return e.title || `${EXTRACT_KIND_META[e.kind].label}${e.sourceDocument ? ` from ${e.sourceDocument}` : ''}`;
}

/** The answer side: the card's content or the extract's text. */
export function recallAnswer(item: RecallItem): string {
  return item.card ? item.card.content : item.extract!.text;
}

/** Where the knowledge came from: a card's source note, or an extract's document and page. */
export function recallReference(item: RecallItem): string {
  if (item.card) return item.card.source ?? '';
  const e = item.extract!;
  return [e.sourceDocument, e.location].filter(Boolean).join(', ');
}

export function recallTypeMeta(item: RecallItem) {
  return item.card ? CARD_TYPE_META[item.card.type] : EXTRACT_KIND_META[item.extract!.kind];
}

/** How the answer is set: formulas and examples in mono, quotes in the serif. */
export function recallAnswerStyle(item: RecallItem): 'mono' | 'quote' | 'prose' {
  if (item.card) {
    if (item.card.type === 'formula' || item.card.type === 'example') return 'mono';
    if (item.card.type === 'source') return 'quote';
    return 'prose';
  }
  return EXTRACT_KIND_META[item.extract!.kind].style;
}

export const recallTags = (item: RecallItem) => (item.card ?? item.extract!).tags;

/** Filter key for the type filter: `card:<type>` or `extract:<kind>`. */
export const recallTypeKey = (item: RecallItem) => (item.card ? `card:${item.card.type}` : `extract:${item.extract!.kind}`);

export const TYPE_OPTIONS = [
  ...CARD_TYPES.map((t) => ({ value: `card:${t}`, label: CARD_TYPE_META[t].label })),
  ...EXTRACT_KINDS.map((k) => ({ value: `extract:${k}`, label: `Extract · ${EXTRACT_KIND_META[k].label}` })),
];

export type StatusFilter = 'all' | 'due' | 'remembered' | 'needs-revision' | 'new';

export interface RecallFilters {
  status: StatusFilter;
  phaseId: ID | 'all';
  type: string;
  pinnedOnly: boolean;
}

export const DEFAULT_FILTERS: RecallFilters = { status: 'all', phaseId: 'all', type: 'all', pinnedOnly: false };

export function matchesFilters(item: RecallItem, f: RecallFilters, at: number): boolean {
  if (f.phaseId !== 'all' && item.phaseId !== f.phaseId) return false;
  if (f.type !== 'all' && recallTypeKey(item) !== f.type) return false;
  if (f.pinnedOnly && !item.pinned) return false;
  if (f.status === 'due') return isDue(item.revision, at);
  if (f.status !== 'all') return item.revision.status === f.status;
  return true;
}

/**
 * Revision order: due cards first (most overdue, then those needing revision,
 * then new), then the rest by due date. Phase order breaks ties so a session
 * follows the pathway.
 */
export function sortForRevision(items: RecallItem[], phases: Phase[], at: number): RecallItem[] {
  const phaseIndex = new Map(phases.map((p, i) => [p.id, i]));
  const weight = (item: RecallItem) => (item.revision.status === 'needs-revision' ? 0 : item.revision.status === 'new' ? 2 : 1);
  return [...items].sort((a, b) => {
    const dueA = isDue(a.revision, at);
    const dueB = isDue(b.revision, at);
    if (dueA !== dueB) return dueA ? -1 : 1;
    if (dueA) {
      return weight(a) - weight(b) || a.revision.dueAt - b.revision.dueAt || (phaseIndex.get(a.phaseId) ?? 0) - (phaseIndex.get(b.phaseId) ?? 0);
    }
    return a.revision.dueAt - b.revision.dueAt;
  });
}

function firstLine(text: string) {
  const line = text.split('\n')[0].trim();
  return line.length > 90 ? `${line.slice(0, 88)}…` : line || 'Untitled card';
}
