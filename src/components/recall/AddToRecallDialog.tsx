import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Pin, Search } from 'lucide-react';
import { db } from '../../db/database';
import type { ID, KnowledgeCard, KnowledgeExtract, Phase } from '../../types';
import { addToRecall } from '../../db/repository';
import { CARD_TYPE_META } from '../../lib/cardTypes';
import { EXTRACT_KIND_META } from '../../lib/extractKinds';
import { phaseNumber } from '../../lib/format';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { useToast } from '../ui/Toast';
import { TYPE_OPTIONS } from './recallItems';

interface Candidate {
  key: string;
  kind: 'card' | 'extract';
  id: ID;
  phaseId: ID;
  title: string;
  typeKey: string;
  pinned: boolean;
  card?: KnowledgeCard;
  extract?: KnowledgeExtract;
}

/** Choose cards and extracts (not yet in Recall) to turn into revision cards. */
export function AddToRecallDialog({ open, onClose, phases }: { open: boolean; onClose: () => void; phases: Phase[] }) {
  return (
    <Modal open={open} onClose={onClose} title="Add to Recall" labelledBy="add-recall-title" width="max-w-2xl">
      <AddBody phases={phases} onClose={onClose} />
    </Modal>
  );
}

function AddBody({ phases, onClose }: { phases: Phase[]; onClose: () => void }) {
  const toast = useToast();
  const phaseIds = phases.map((p) => p.id);
  const data = useLiveQuery(async () => {
    const [cards, extracts, revisions] = await Promise.all([
      db.cards.where('phaseId').anyOf(phaseIds).toArray(),
      db.extracts.where('phaseId').anyOf(phaseIds).toArray(),
      db.revisions.toArray(),
    ]);
    return { cards, extracts, inRecall: new Set(revisions.map((r) => `${r.sourceType}:${r.sourceId}`)) };
  }, [phaseIds.join()]);

  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState<string>('all');
  const [type, setType] = useState('all');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);

  const candidates = useMemo<Candidate[]>(() => {
    if (!data) return [];
    const list: Candidate[] = [
      ...data.cards.map((c) => ({ key: `card:${c.id}`, kind: 'card' as const, id: c.id, phaseId: c.phaseId, title: c.title || c.content.slice(0, 90), typeKey: `card:${c.type}`, pinned: c.pinned, card: c })),
      ...data.extracts.map((e) => ({ key: `extract:${e.id}`, kind: 'extract' as const, id: e.id, phaseId: e.phaseId, title: e.title || e.text.slice(0, 90), typeKey: `extract:${e.kind}`, pinned: e.pinned, extract: e })),
    ];
    return list.filter((c) => !data.inRecall.has(c.key));
  }, [data]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates.filter((c) => {
      if (phase !== 'all' && c.phaseId !== phase) return false;
      if (type !== 'all' && c.typeKey !== type) return false;
      if (pinnedOnly && !c.pinned) return false;
      if (!q) return true;
      const body = c.card ? `${c.card.content} ${c.card.tags.join(' ')}` : `${c.extract!.text} ${c.extract!.tags.join(' ')}`;
      return `${c.title} ${body}`.toLowerCase().includes(q);
    });
  }, [candidates, query, phase, type, pinnedOnly]);

  // Drop selections that no longer exist (e.g. added from elsewhere).
  useEffect(() => {
    setSelected((s) => {
      const keys = new Set(candidates.map((c) => c.key));
      const next = new Set([...s].filter((k) => keys.has(k)));
      return next.size === s.size ? s : next;
    });
  }, [candidates]);

  const groups = phases
    .map((p, index) => ({ phase: p, index, items: visible.filter((c) => c.phaseId === p.id) }))
    .filter((g) => g.items.length > 0);

  const allVisibleSelected = visible.length > 0 && visible.every((c) => selected.has(c.key));
  const toggle = (key: string) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  const toggleAll = () =>
    setSelected((s) => {
      const next = new Set(s);
      for (const c of visible) {
        if (allVisibleSelected) next.delete(c.key);
        else next.add(c.key);
      }
      return next;
    });

  const types = TYPE_OPTIONS.filter((o) => candidates.some((c) => c.typeKey === o.value));

  const add = async () => {
    setSaving(true);
    try {
      const chosen = candidates.filter((c) => selected.has(c.key));
      const added =
        (await addToRecall('card', chosen.filter((c) => c.kind === 'card').map((c) => c.id))) +
        (await addToRecall('extract', chosen.filter((c) => c.kind === 'extract').map((c) => c.id)));
      toast({ message: `${added} ${added === 1 ? 'card' : 'cards'} added to Recall` });
      onClose();
    } catch {
      toast({ message: 'The cards could not be added.', tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="space-y-2.5 border-b border-line px-5 py-3.5 sm:px-6">
        <label className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 focus-within:border-gold/70">
          <Search className="size-3.5 shrink-0 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find cards and extracts"
            aria-label="Find cards and extracts"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint"
            data-autofocus
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            label="Phase"
            value={phase}
            onChange={setPhase}
            active={phase !== 'all'}
            options={[{ value: 'all', label: 'All phases' }, ...phases.map((p, i) => ({ value: p.id, label: `${phaseNumber(i)} ${p.title}` }))]}
          />
          <Select label="Type" value={type} onChange={setType} active={type !== 'all'} options={[{ value: 'all', label: 'All types' }, ...types]} />
          <button
            type="button"
            aria-pressed={pinnedOnly}
            onClick={() => setPinnedOnly((p) => !p)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium transition-colors ${
              pinnedOnly ? 'border-gold/50 bg-gold-soft text-gold' : 'border-line bg-surface text-ink-2 hover:border-line-strong'
            }`}
          >
            <Pin className="size-3.5" /> Pinned
          </button>
          <button type="button" onClick={toggleAll} disabled={visible.length === 0} className="ml-auto rounded-lg px-2 py-1 text-[13px] font-medium text-gold hover:bg-gold-soft disabled:opacity-40">
            {allVisibleSelected ? 'Clear selection' : `Select ${visible.length} shown`}
          </button>
        </div>
      </div>

      <div className="max-h-[52vh] overflow-y-auto px-3 py-2 sm:px-4">
        {data && candidates.length === 0 && (
          <p className="px-3 py-12 text-center text-sm text-muted">Every card and extract in this journal is already in Recall.</p>
        )}
        {data && candidates.length > 0 && visible.length === 0 && <p className="px-3 py-12 text-center text-sm text-muted">Nothing matches these filters.</p>}
        {groups.map((g) => (
          <div key={g.phase.id} className="mb-2">
            <p className="sticky top-0 z-[1] bg-surface px-2 pt-2.5 pb-1 text-[10.5px] font-semibold tracking-wider text-faint uppercase">
              {phaseNumber(g.index)} · {g.phase.title}
            </p>
            {g.items.map((c) => {
              const meta = c.card ? CARD_TYPE_META[c.card.type] : EXTRACT_KIND_META[c.extract!.kind];
              const Icon = meta.icon;
              const checked = selected.has(c.key);
              return (
                <button
                  key={c.key}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => toggle(c.key)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[13px] hover:bg-surface-2"
                >
                  <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${checked ? 'border-gold bg-gold text-on-gold' : 'border-line-strong'}`}>
                    {checked && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <Icon className={`size-3.5 shrink-0 ${meta.text}`} aria-label={meta.label} />
                  <span className="min-w-0 flex-1 truncate text-ink-2">{c.title || 'Untitled'}</span>
                  {c.pinned && <Pin className="size-3 shrink-0 fill-current text-gold" aria-label="Pinned" />}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-line bg-surface-2/50 px-5 py-3.5 sm:px-6">
        <span className="text-xs text-muted tabular">{selected.size} selected</span>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={selected.size === 0 || saving} onClick={add}>
            Add {selected.size || ''} to Recall
          </Button>
        </div>
      </div>
    </>
  );
}
