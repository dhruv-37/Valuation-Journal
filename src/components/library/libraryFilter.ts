import { EXTRACT_KINDS, type ExtractKind, type KnowledgeExtract, type Snapshot } from '../../types';

export type LibraryType = 'all' | 'snapshots' | 'extracts' | ExtractKind;
export type DateRange = 'any' | '7' | '30' | '90';
export type SortOrder = 'newest' | 'oldest';

export interface LibraryFilter {
  type: LibraryType;
  tag: string;
  importantOnly: boolean;
  date: DateRange;
  sort: SortOrder;
}

export const DEFAULT_FILTER: LibraryFilter = { type: 'all', tag: '', importantOnly: false, date: 'any', sort: 'newest' };

export const isFiltered = (f: LibraryFilter) =>
  f.type !== DEFAULT_FILTER.type || f.tag !== '' || f.importantOnly || f.date !== 'any';

const isExtractKind = (t: LibraryType): t is ExtractKind => (EXTRACT_KINDS as readonly string[]).includes(t);

export const showsSnapshots = (f: LibraryFilter) => f.type === 'all' || f.type === 'snapshots';
export const showsExtracts = (f: LibraryFilter) => f.type !== 'snapshots';

function common<T extends { tags: string[]; pinned: boolean; createdAt: number }>(items: T[], f: LibraryFilter) {
  const since = f.date === 'any' ? 0 : Date.now() - Number(f.date) * 24 * 60 * 60 * 1000;
  const filtered = items.filter(
    (i) => (!f.tag || i.tags.includes(f.tag)) && (!f.importantOnly || i.pinned) && i.createdAt >= since,
  );
  const dir = f.sort === 'newest' ? -1 : 1;
  // Important items stay on top; date order within each group.
  return filtered.sort((a, b) => Number(b.pinned) - Number(a.pinned) || dir * (a.createdAt - b.createdAt));
}

export function filterSnapshots(snapshots: Snapshot[], f: LibraryFilter) {
  return showsSnapshots(f) ? common(snapshots, f) : [];
}

export function filterExtracts(extracts: KnowledgeExtract[], f: LibraryFilter) {
  if (!showsExtracts(f)) return [];
  return common(isExtractKind(f.type) ? extracts.filter((e) => e.kind === f.type) : extracts, f);
}
