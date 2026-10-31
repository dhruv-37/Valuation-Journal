import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Search, X } from 'lucide-react';
import { db } from '../../db/database';
import type { ID } from '../../types';
import { CARD_TYPE_META } from '../../lib/cardTypes';
import { phaseNumber } from '../../lib/format';
import { usePhases } from '../../hooks/useJournalData';

interface CardPickerProps {
  value: ID[];
  onChange: (ids: ID[]) => void;
  /** Cards from this phase are listed first. */
  currentPhaseId: ID;
}

/** Choose the knowledge cards a snapshot illustrates. */
export function CardPicker({ value, onChange, currentPhaseId }: CardPickerProps) {
  const [query, setQuery] = useState('');
  const phases = usePhases() ?? [];
  // Cards of the active journal only (through its phases).
  const phaseKey = phases.map((p) => p.id).join();
  const cards = useLiveQuery(() => db.cards.where('phaseId').anyOf(phaseKey ? phaseKey.split(',') : []).toArray(), [phaseKey]) ?? [];

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const ordered = [...phases].sort((a, b) => Number(b.id === currentPhaseId) - Number(a.id === currentPhaseId) || a.order - b.order);
    return ordered
      .map((phase) => ({
        phase,
        index: phases.indexOf(phase),
        cards: cards
          .filter((c) => c.phaseId === phase.id)
          .filter((c) => !q || `${c.title} ${c.tags.join(' ')}`.toLowerCase().includes(q))
          .sort((a, b) => a.order - b.order),
      }))
      .filter((g) => g.cards.length > 0 && (q || g.phase.id === currentPhaseId || value.some((id) => g.cards.some((c) => c.id === id))));
  }, [phases, cards, query, currentPhaseId, value]);

  const selected = cards.filter((c) => value.includes(c.id));
  const toggle = (id: ID) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="rounded-xl border border-line">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-line px-3 py-2.5">
          {selected.map((c) => (
            <span key={c.id} className="inline-flex max-w-full items-center gap-1 rounded-md bg-gold-soft py-0.5 pr-1 pl-2 text-xs text-ink-2">
              <span className="truncate">{c.title || 'Untitled card'}</span>
              <button type="button" aria-label={`Unlink ${c.title}`} onClick={() => toggle(c.id)} className="rounded p-0.5 text-muted hover:text-ink">
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
          placeholder="Find cards in any phase…"
          aria-label="Find knowledge cards"
          className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
        />
      </div>
      <div className="max-h-48 overflow-y-auto p-1.5">
        {groups.length === 0 && <p className="px-2 py-3 text-xs text-muted">{query ? 'No matching cards.' : 'This phase has no knowledge cards yet. Search to link cards from other phases.'}</p>}
        {groups.map((g) => (
          <div key={g.phase.id}>
            <p className="px-2 pt-2 pb-1 text-[10.5px] font-semibold tracking-wider text-faint uppercase">
              {phaseNumber(g.index)} · {g.phase.title}
            </p>
            {g.cards.map((c) => {
              const checked = value.includes(c.id);
              const meta = CARD_TYPE_META[c.type];
              const Icon = meta.icon;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => toggle(c.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-surface-2"
                >
                  <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${checked ? 'border-gold bg-gold text-on-gold' : 'border-line-strong'}`}>
                    {checked && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <Icon className={`size-3.5 shrink-0 ${meta.text}`} />
                  <span className="truncate text-ink-2">{c.title || 'Untitled card'}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
