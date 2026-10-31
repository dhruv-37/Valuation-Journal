import { Pin, X } from 'lucide-react';
import { EXTRACT_KINDS } from '../../types';
import { EXTRACT_KIND_META } from '../../lib/extractKinds';
import { Select } from '../ui/Select';
import { DEFAULT_FILTER, isFiltered, type DateRange, type LibraryFilter, type LibraryType, type SortOrder } from './libraryFilter';

interface LibraryFiltersProps {
  value: LibraryFilter;
  onChange: (value: LibraryFilter) => void;
  tags: string[];
  resultCount: number;
}

const TYPE_OPTIONS: { value: LibraryType; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'snapshots', label: 'Snapshots' },
  { value: 'extracts', label: 'All extracts' },
  ...EXTRACT_KINDS.map((k) => ({ value: k as LibraryType, label: `Extracts · ${EXTRACT_KIND_META[k].label}` })),
];

const DATE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'any', label: 'Any time' },
  { value: '7', label: 'Past 7 days' },
  { value: '30', label: 'Past 30 days' },
  { value: '90', label: 'Past 90 days' },
];

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
];

export function LibraryFilters({ value, onChange, tags, resultCount }: LibraryFiltersProps) {
  const set = (patch: Partial<LibraryFilter>) => onChange({ ...value, ...patch });
  const tagOptions = [{ value: '', label: 'All tags' }, ...tags.map((t) => ({ value: t, label: `#${t}` }))];
  // Keep a selected tag visible even if no remaining item uses it.
  if (value.tag && !tags.includes(value.tag)) tagOptions.push({ value: value.tag, label: `#${value.tag}` });

  return (
    <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Filter library">
      <Select label="Show" value={value.type} onChange={(type) => set({ type })} options={TYPE_OPTIONS} active={value.type !== 'all'} />
      <Select label="Tag" value={value.tag} onChange={(tag) => set({ tag })} options={tagOptions} active={!!value.tag} />
      <Select label="Added" value={value.date} onChange={(date) => set({ date })} options={DATE_OPTIONS} active={value.date !== 'any'} />
      <button
        type="button"
        aria-pressed={value.importantOnly}
        onClick={() => set({ importantOnly: !value.importantOnly })}
        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium transition-colors ${
          value.importantOnly ? 'border-gold/50 bg-gold-soft text-gold' : 'border-line bg-surface text-ink-2 hover:border-line-strong'
        }`}
      >
        <Pin className={`size-3.5 ${value.importantOnly ? 'fill-current' : ''}`} />
        Important only
      </button>
      <Select label="Sort" value={value.sort} onChange={(sort) => set({ sort })} options={SORT_OPTIONS} />
      {isFiltered(value) && (
        <button
          type="button"
          onClick={() => onChange({ ...DEFAULT_FILTER, sort: value.sort })}
          className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[13px] text-muted hover:bg-surface-2 hover:text-ink"
        >
          <X className="size-3.5" /> Clear
          <span className="ml-1 text-faint tabular">· {resultCount} shown</span>
        </button>
      )}
    </div>
  );
}
