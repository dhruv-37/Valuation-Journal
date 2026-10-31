import { useMemo, useState } from 'react';
import { Brain, Info, Pin, Play, Plus, Search, X, Zap } from 'lucide-react';
import type { ID, Phase } from '../../types';
import { useRecallItems, type RecallItem } from '../../hooks/useJournalData';
import { useNow } from '../../hooks/useNow';
import { INTERVAL_DAYS, MASTERED_LEVEL, isDue } from '../../lib/recall';
import { percent, phaseNumber } from '../../lib/format';
import { useActiveJournal } from '../../hooks/useActiveJournal';
import { Button } from '../ui/Button';
import { AppHeader } from '../AppHeader';
import { Select } from '../ui/Select';
import type { RecallSessionState } from './RecallSession';
import { AddToRecallDialog } from './AddToRecallDialog';
import { PromptDialog } from './PromptDialog';
import { RevisionRow } from './RevisionRow';
import { DEFAULT_FILTERS, TYPE_OPTIONS, matchesFilters, recallTypeKey, sortForRevision, type RecallFilters, type StatusFilter } from './recallItems';

interface RecallPageProps {
  phases: Phase[];
  documentCount: number;
  onSearch: () => void;
  onStart: (session: RecallSessionState) => void;
  onOpenSource: (item: RecallItem) => void;
}

const SESSION_SIZES = [
  { value: '10', label: '10 cards' },
  { value: '20', label: '20 cards' },
  { value: '50', label: '50 cards' },
  { value: 'all', label: 'All' },
];

/** The Recall dashboard: how revision is going, and the way into a session. */
export function RecallPage({ phases, documentCount, onSearch, onStart, onOpenSource }: RecallPageProps) {
  const items = useRecallItems();
  const journal = useActiveJournal();
  const [filters, setFilters] = useState<RecallFilters>(DEFAULT_FILTERS);
  const [query, setQuery] = useState('');
  const [size, setSize] = useState('20');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<RecallItem | null>(null);
  // Refreshed each minute (not continuously) so the list doesn't reorder under the cursor.
  const at = useNow();

  const all = items ?? [];
  const phaseIds = new Set(phases.map((p) => p.id));
  const inJournal = all.filter((i) => phaseIds.has(i.phaseId));

  const counts = useMemo(() => {
    const c = { total: inJournal.length, due: 0, remembered: 0, needs: 0, new: 0, mastered: 0 };
    for (const i of inJournal) {
      if (isDue(i.revision, at)) c.due++;
      if (i.revision.status === 'remembered') c.remembered++;
      if (i.revision.status === 'needs-revision') c.needs++;
      if (i.revision.status === 'new') c.new++;
      if (i.revision.status === 'remembered' && i.revision.level >= MASTERED_LEVEL) c.mastered++;
    }
    return c;
  }, [inJournal, at]);

  const byPhase = useMemo(
    () =>
      phases
        .map((phase, index) => {
          const list = inJournal.filter((i) => i.phaseId === phase.id);
          return {
            phase,
            index,
            total: list.length,
            remembered: list.filter((i) => i.revision.status === 'remembered').length,
            needs: list.filter((i) => i.revision.status === 'needs-revision').length,
            due: list.filter((i) => isDue(i.revision, at)).length,
          };
        })
        .filter((p) => p.total > 0),
    [phases, inJournal, at],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = inJournal.filter((i) => {
      if (!matchesFilters(i, filters, at)) return false;
      if (!q) return true;
      const source = i.card ?? i.extract!;
      return `${i.revision.prompt} ${source.title} ${'content' in source ? source.content : source.text} ${source.tags.join(' ')}`.toLowerCase().includes(q);
    });
    return sortForRevision(list, phases, at);
  }, [inJournal, filters, query, phases, at]);

  const types = TYPE_OPTIONS.filter((o) => inJournal.some((i) => recallTypeKey(i) === o.value));
  const filtered = filters !== DEFAULT_FILTERS || !!query;
  const set = <K extends keyof RecallFilters>(key: K, value: RecallFilters[K]) => setFilters((f) => ({ ...f, [key]: value }));

  const limit = size === 'all' ? Infinity : Number(size);
  const start = (list: RecallItem[], label: string) => {
    const ids = list.slice(0, limit).map((i) => i.revision.id);
    if (ids.length) onStart({ ids, label, nonce: Date.now() });
  };
  const dueList = sortForRevision(inJournal.filter((i) => isDue(i.revision, at)), phases, at);
  const pinnedDue = dueList.filter((i) => i.pinned);
  const deckLabel = filtered ? 'Filtered cards' : 'All cards';

  return (
    <div className="min-h-dvh">
      <AppHeader current="recall" documentCount={documentCount} onSearch={onSearch} />

      <main className="mx-auto max-w-[1320px] px-4 pb-24 sm:px-8">
        <section className="grid items-end gap-8 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-gold uppercase">{journal?.name ?? 'Journal'} · Active recall</p>
            <h1 className="mt-3 font-display text-[40px] leading-[1.05] font-medium tracking-tight text-ink sm:text-[52px]">Recall</h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
              Turn knowledge cards and extracts into flashcards. Answer from memory, then reveal the explanation. Cards you remember come back less
              often; cards you miss come back soon.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button variant="primary" icon={<Play className="size-4" />} disabled={counts.due === 0} onClick={() => start(dueList, 'Due cards')}>
                {counts.due > 0 ? `Revise ${Math.min(counts.due, limit)} due` : 'Nothing due'}
              </Button>
              {pinnedDue.length > 0 && pinnedDue.length < dueList.length && (
                <Button icon={<Zap className="size-4" />} onClick={() => start(pinnedDue, 'Pinned and due')}>
                  Pinned only · {Math.min(pinnedDue.length, limit)}
                </Button>
              )}
              <Button icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
                Add cards
              </Button>
            </div>
          </div>

          <dl className="grid grid-cols-2 divide-line rounded-2xl border border-line bg-surface shadow-card max-sm:divide-y sm:grid-cols-4 sm:divide-x">
            <Figure label="Revision cards" value={counts.total} note={`${counts.new} not yet reviewed`} />
            <Figure label="Remembered" value={counts.remembered} note={`${counts.mastered} well known`} />
            <Figure label="Needs revision" value={counts.needs} note={counts.needs ? 'coming back soon' : 'none missed'} tone={counts.needs ? 'warn' : undefined} />
            <Figure label="Due now" value={counts.due} note={counts.due ? 'ready to revise' : 'all caught up'} tone={counts.due ? 'gold' : undefined} />
          </dl>
        </section>

        {items && inJournal.length === 0 ? (
          <EmptyState onAdd={() => setAdding(true)} />
        ) : (
          <div className="grid gap-10 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
              <h2 className="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">Progress by phase</h2>
              <ul className="mt-3 space-y-1">
                {byPhase.map((p) => {
                  const active = filters.phaseId === p.phase.id;
                  return (
                    <li key={p.phase.id}>
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => set('phaseId', active ? 'all' : p.phase.id)}
                        className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${active ? 'bg-gold-soft' : 'hover:bg-surface-2'}`}
                      >
                        <span className="flex items-baseline gap-2 text-[13px]">
                          <span className="text-gold tabular">{phaseNumber(p.index)}</span>
                          <span className="min-w-0 flex-1 truncate text-ink-2">{p.phase.title}</span>
                          <span className="shrink-0 text-xs text-muted tabular">
                            {p.remembered}/{p.total}
                          </span>
                        </span>
                        <span className="mt-2 flex h-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
                          <span className="bg-gold" style={{ width: `${percent(p.remembered, p.total)}%` }} />
                          <span className="bg-type-warning/70" style={{ width: `${percent(p.needs, p.total)}%` }} />
                        </span>
                        {p.due > 0 && <span className="mt-1.5 block text-[11px] text-gold">{p.due} due</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 flex items-center gap-4 px-3 text-[11px] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1 w-3 rounded-full bg-gold" /> Remembered
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1 w-3 rounded-full bg-type-warning/70" /> Needs revision
                </span>
              </div>
              <Schedule />
            </aside>

            <section className="min-w-0" aria-label="Revision cards">
              <div className="sticky top-16 z-10 -mx-4 border-y border-line/70 bg-canvas/90 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
                <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Filter by status">
                  {(
                    [
                      ['all', 'All', counts.total],
                      ['due', 'Due', counts.due],
                      ['needs-revision', 'Needs revision', counts.needs],
                      ['remembered', 'Remembered', counts.remembered],
                      ['new', 'New', counts.new],
                    ] as [StatusFilter, string, number][]
                  ).map(([value, label, count]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={filters.status === value}
                      onClick={() => set('status', value)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        filters.status === value ? 'bg-ink text-canvas' : 'text-muted hover:bg-surface-2 hover:text-ink'
                      }`}
                    >
                      {label}
                      <span className={filters.status === value ? 'opacity-70' : 'text-faint'}>{count}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <label className="flex h-8 min-w-0 basis-full items-center gap-2 rounded-lg border border-line bg-surface px-2.5 focus-within:border-gold/70 sm:max-w-60 sm:flex-1 sm:basis-auto">
                    <Search className="size-3.5 shrink-0 text-faint" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Find a card"
                      aria-label="Find revision cards"
                      className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint"
                    />
                  </label>
                  <Select
                    label="Phase"
                    value={filters.phaseId}
                    onChange={(v) => set('phaseId', v)}
                    active={filters.phaseId !== 'all'}
                    options={[{ value: 'all', label: 'All phases' }, ...phases.map((p, i) => ({ value: p.id as ID, label: `${phaseNumber(i)} ${p.title}` }))]}
                  />
                  <Select
                    label="Type"
                    value={filters.type}
                    onChange={(v) => set('type', v)}
                    active={filters.type !== 'all'}
                    options={[{ value: 'all', label: 'All types' }, ...types]}
                  />
                  <button
                    type="button"
                    aria-pressed={filters.pinnedOnly}
                    onClick={() => set('pinnedOnly', !filters.pinnedOnly)}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium transition-colors ${
                      filters.pinnedOnly ? 'border-gold/50 bg-gold-soft text-gold' : 'border-line bg-surface text-ink-2 hover:border-line-strong'
                    }`}
                  >
                    <Pin className="size-3.5" /> Pinned
                  </button>
                  {filtered && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilters(DEFAULT_FILTERS);
                        setQuery('');
                      }}
                      className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[13px] text-muted hover:bg-surface-2 hover:text-ink"
                    >
                      <X className="size-3.5" /> Clear
                    </button>
                  )}
                </div>
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-2.5">
                  <Select label="Session" value={size} onChange={setSize} options={SESSION_SIZES} />
                  <Button size="sm" variant="primary" icon={<Play className="size-3.5" />} disabled={visible.length === 0} onClick={() => start(visible, deckLabel)}>
                    Revise {Math.min(visible.length, limit)} {filtered ? 'shown' : ''}
                  </Button>
                </div>
              </div>

              {items && visible.length === 0 && <p className="py-14 text-center text-sm text-muted">No revision cards match these filters.</p>}

              <ul className="mt-4 space-y-2.5">
                {visible.map((item) => (
                  <RevisionRow
                    key={item.revision.id}
                    item={item}
                    phases={phases}
                    at={at}
                    onRevise={() => onStart({ ids: [item.revision.id], label: 'Single card', nonce: Date.now() })}
                    onEdit={() => setEditing(item)}
                    onOpenSource={() => onOpenSource(item)}
                  />
                ))}
              </ul>
            </section>
          </div>
        )}
      </main>

      <AddToRecallDialog open={adding} onClose={() => setAdding(false)} phases={phases} />
      <PromptDialog item={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function Figure({ label, value, note, tone }: { label: string; value: number; note: string; tone?: 'gold' | 'warn' }) {
  return (
    <div className="min-w-0 px-4 py-4 sm:w-40 sm:px-5 sm:py-5">
      <dt className="text-[11px] leading-tight font-medium tracking-wide text-muted uppercase">{label}</dt>
      <dd className={`mt-2 font-display text-[30px] leading-none tracking-tight tabular ${tone === 'gold' ? 'text-gold' : tone === 'warn' ? 'text-type-warning' : 'text-ink'}`}>
        {value}
      </dd>
      <p className="mt-2 truncate text-xs text-muted">{note}</p>
    </div>
  );
}

function Schedule() {
  return (
    <div className="mt-6 rounded-2xl border border-line bg-surface/60 px-4 py-3.5 text-xs leading-relaxed text-muted">
      <p className="flex items-center gap-1.5 font-medium text-ink-2">
        <Info className="size-3.5 text-faint" /> How scheduling works
      </p>
      <p className="mt-1.5">
        <span className="text-ink-2">Remembered</span> moves a card up a step: {INTERVAL_DAYS.join(' → ')} days.{' '}
        <span className="text-ink-2">Needs revision</span> sends it back to the start and brings it back in 10 minutes.
      </p>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="flex w-full flex-col items-center rounded-3xl border border-dashed border-line-strong bg-surface/40 px-6 py-16 text-center transition-colors hover:border-gold/60 hover:bg-gold-soft/30"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-gold-soft text-gold">
        <Brain className="size-5" />
      </span>
      <span className="mt-4 font-display text-xl text-ink">Build your revision deck</span>
      <span className="mt-1.5 max-w-md text-sm text-muted">
        Choose the knowledge cards and extracts worth remembering. You can also add a single card from its menu inside any phase.
      </span>
    </button>
  );
}
