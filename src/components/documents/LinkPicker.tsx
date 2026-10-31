import { useMemo, useState, type ReactNode } from 'react';
import { Check, Search, X } from 'lucide-react';
import type { ID } from '../../types';

export interface PickerItem {
  id: ID;
  label: string;
  /** Group (usually a phase) the item is listed under. */
  groupId: string;
  icon?: ReactNode;
  /** Extra words that should match a search (tags, file name, text). */
  keywords?: string;
}

interface LinkPickerProps {
  items: PickerItem[];
  /** Groups in display order. */
  groups: { id: string; label: string }[];
  value: ID[];
  onChange: (ids: ID[]) => void;
  placeholder: string;
  /** Without a search, only this group (and groups with selected items) is listed, to keep the list short. */
  focusGroupId?: string | null;
  emptyText: string;
  maxHeight?: string;
}

/** Multi-select list grouped by phase, with a search box and removable chips for the selection. */
export function LinkPicker({ items, groups, value, onChange, placeholder, focusGroupId, emptyText, maxHeight = 'max-h-48' }: LinkPickerProps) {
  const [query, setQuery] = useState('');
  const selected = new Set(value);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const picked = new Set(value);
    return groups
      .map((g) => ({
        ...g,
        items: items.filter((i) => i.groupId === g.id && (!q || `${i.label} ${i.keywords ?? ''}`.toLowerCase().includes(q))),
      }))
      .filter((g) => g.items.length > 0 && (q || focusGroupId === undefined || g.id === focusGroupId || g.items.some((i) => picked.has(i.id))))
      .sort((a, b) => Number(b.id === focusGroupId) - Number(a.id === focusGroupId));
  }, [items, groups, query, focusGroupId, value]);

  const chosen = items.filter((i) => selected.has(i.id));
  const toggle = (id: ID) => onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="rounded-xl border border-line">
      {chosen.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-line px-3 py-2.5">
          {chosen.map((i) => (
            <span key={i.id} className="inline-flex max-w-full items-center gap-1 rounded-md bg-gold-soft py-0.5 pr-1 pl-2 text-xs text-ink-2">
              <span className="truncate">{i.label}</span>
              <button type="button" aria-label={`Remove ${i.label}`} onClick={() => toggle(i.id)} className="rounded p-0.5 text-muted hover:text-ink">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 border-b border-line px-3">
        <Search className="size-3.5 text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
        />
      </div>
      <div className={`${maxHeight} overflow-y-auto p-1.5`}>
        {visible.length === 0 && <p className="px-2 py-3 text-xs text-muted">{query ? 'Nothing matches.' : emptyText}</p>}
        {visible.map((g) => (
          <div key={g.id}>
            <p className="px-2 pt-2 pb-1 text-[10.5px] font-semibold tracking-wider text-faint uppercase">{g.label}</p>
            {g.items.map((i) => {
              const checked = selected.has(i.id);
              return (
                <button
                  key={i.id}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => toggle(i.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-surface-2"
                >
                  <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${checked ? 'border-gold bg-gold text-on-gold' : 'border-line-strong'}`}>
                    {checked && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  {i.icon && <span className="flex size-4 shrink-0 items-center justify-center">{i.icon}</span>}
                  <span className="truncate text-ink-2">{i.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
