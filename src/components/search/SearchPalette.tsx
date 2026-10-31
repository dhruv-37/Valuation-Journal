import { useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CircleCheck, CornerDownLeft, Layers, ListChecks, Search } from 'lucide-react';
import { db } from '../../db/database';
import type { ID, Phase } from '../../types';
import type { FocusKind } from '../workspace/PhaseWorkspace';
import { EXTRACT_KIND_META } from '../../lib/extractKinds';
import { SnapshotThumb } from '../library/SnapshotThumb';
import { useDocumentActions } from '../documents/DocumentsContext';
import { useDocumentTextMatches } from '../../hooks/useJournalData';
import { DOCUMENT_KIND_META } from '../../lib/documents';
import { highlight, search, tokenize, type SearchResult } from '../../lib/search';
import { CARD_TYPE_META } from '../../lib/cardTypes';
import { phaseNumber } from '../../lib/format';
import { Modal } from '../ui/Modal';
import { Kbd } from '../ui/Button';

export interface SearchSelection {
  phaseId: ID;
  itemId: ID | null;
  kind: FocusKind;
}

interface SearchPaletteProps {
  open: boolean;
  onClose: () => void;
  phases: Phase[];
  onSelect: (selection: SearchSelection) => void;
}

export function SearchPalette({ open, onClose, phases, onSelect }: SearchPaletteProps) {
  return (
    <Modal open={open} onClose={onClose} hideHeader placement="top" width="max-w-2xl" labelledBy="search-input">
      <SearchBody phases={phases} onSelect={onSelect} onClose={onClose} />
    </Modal>
  );
}

const GROUP_LABEL: Record<SearchResult['kind'], string> = {
  phase: 'Phases',
  task: 'Checklist',
  card: 'Knowledge cards',
  snapshot: 'Snapshots',
  extract: 'Extracts',
  document: 'Documents',
};

function SearchBody({ phases, onSelect, onClose }: { phases: Phase[]; onSelect: (s: SearchSelection) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const data = useLiveQuery(async () => {
    const [tasks, cards, snapshots, extracts, documents] = await Promise.all([
      db.checklist.toArray(),
      db.cards.toArray(),
      db.snapshots.toArray(),
      db.extracts.toArray(),
      db.documents.toArray(),
    ]);
    return { tasks, cards, snapshots, extracts, documents };
  }, []);
  // Scanning document text is the slow part, so it follows typing with a short lag.
  const textHits = useDocumentTextMatches(useDeferredValue(query));
  const documents = useDocumentActions();

  const phaseIndex = useMemo(() => new Map(phases.map((p, i) => [p.id, i])), [phases]);
  const tokens = tokenize(query);

  const results = useMemo<SearchResult[]>(() => {
    if (!tokens.length) {
      // Empty query: quick jump to any phase.
      return phases.map((p) => ({ kind: 'phase', id: p.id, phaseId: p.id, title: p.title, snippet: p.description, field: 'Phase', score: 0 }));
    }
    if (!data) return [];
    return search(query, { phases, ...data, documentText: textHits });
  }, [query, data, phases, textHits]);

  // Group while keeping a flat order for keyboard navigation.
  const groups = (['phase', 'card', 'extract', 'document', 'snapshot', 'task'] as const)
    .map((kind) => ({ kind, items: results.filter((r) => r.kind === kind) }))
    .filter((g) => g.items.length);
  const flat = groups.flatMap((g) => g.items);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (r: SearchResult) => {
    if (r.kind === 'document') {
      // Documents open in the viewer, with the search carried into the PDF.
      onClose();
      documents.open(r.id, { query });
    } else onSelect({ phaseId: r.phaseId, itemId: r.kind === 'phase' ? null : r.id, kind: r.kind });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flat[active]) {
      e.preventDefault();
      choose(flat[active]);
    }
  };

  let index = -1;
  return (
    <div onKeyDown={onKeyDown}>
      <div className="flex items-center gap-3 border-b border-line px-5">
        <Search className="size-[18px] shrink-0 text-muted" />
        <input
          id="search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search phases, cards, documents and #tags…"
          aria-label="Search the journal"
          aria-controls="search-results"
          aria-activedescendant={flat[active] ? `search-option-${active}` : undefined}
          className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
          data-autofocus
          autoComplete="off"
          spellCheck={false}
        />
        <Kbd>Esc</Kbd>
      </div>

      <div ref={listRef} id="search-results" role="listbox" className="max-h-[min(60vh,520px)] overflow-y-auto p-2">
        {!tokens.length && <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-faint uppercase">Jump to phase</p>}
        {groups.map((group) => (
          <div key={group.kind} className="mb-1">
            {tokens.length > 0 && (
              <p className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-faint uppercase">
                {GROUP_LABEL[group.kind]} <span className="font-normal">· {group.items.length}</span>
              </p>
            )}
            {group.items.map((r) => {
              index++;
              const i = index;
              const isActive = i === active;
              const pIndex = phaseIndex.get(r.phaseId) ?? 0;
              return (
                <button
                  key={`${r.kind}-${r.id}`}
                  id={`search-option-${i}`}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  data-index={i}
                  onMouseMove={() => setActive(i)}
                  onClick={() => choose(r)}
                  className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${isActive ? 'bg-surface-2' : ''}`}
                >
                  <ResultIcon result={r} index={pIndex} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className={`truncate text-sm font-medium ${r.done ? 'text-muted line-through' : 'text-ink'}`}>
                        <Highlighted text={r.title} tokens={tokens} />
                      </span>
                    </span>
                    {r.snippet && (
                      <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-muted">
                        <Highlighted text={r.snippet} tokens={tokens} />
                      </span>
                    )}
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-faint">
                      {r.kind !== 'phase' && (
                        <span>{phaseIndex.has(r.phaseId) ? `${phaseNumber(pIndex)} · ${phases[pIndex]?.title}` : 'Unfiled document'}</span>
                      )}
                      {r.kind === 'document' && r.field === 'Content' && <span>Found in file</span>}
                      {resultTags(r).length > 0 && (
                        <span className="truncate">
                          <Highlighted text={resultTags(r).map((t) => `#${t}`).join('  ')} tokens={tokens} />
                        </span>
                      )}
                    </span>
                  </span>
                  {isActive && <CornerDownLeft className="mt-1 size-3.5 shrink-0 text-faint" />}
                </button>
              );
            })}
          </div>
        ))}
        {tokens.length > 0 && flat.length === 0 && data && (
          <p className="px-3 py-10 text-center text-sm text-muted">No results for “{query}”.</p>
        )}
      </div>

      <div className="flex items-center gap-4 border-t border-line bg-surface-2/50 px-5 py-2.5 text-[11px] text-faint">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> navigate
        </span>
        <span className="flex items-center gap-1">
          <Kbd>↵</Kbd> open
        </span>
        <span className="ml-auto hidden sm:inline">Searches titles, tags, card content and the text inside PDFs and notes</span>
      </div>
    </div>
  );
}

const resultTags = (r: SearchResult) => r.card?.tags ?? r.snapshot?.tags ?? r.extract?.tags ?? r.document?.tags ?? [];

function ResultIcon({ result, index }: { result: SearchResult; index: number }) {
  const base = 'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg';
  if (result.kind === 'phase') {
    return <span className={`${base} bg-gold-soft font-display text-sm text-gold tabular`}>{phaseNumber(index)}</span>;
  }
  if (result.kind === 'task') {
    return (
      <span className={`${base} bg-surface-2 text-muted`}>
        {result.done ? <CircleCheck className="size-4 text-gold" /> : <ListChecks className="size-4" />}
      </span>
    );
  }
  if (result.snapshot) {
    return (
      <span className={`${base} overflow-hidden border border-line bg-surface-2`}>
        <SnapshotThumb snapshot={result.snapshot} className="h-full w-full" fit="cover" />
      </span>
    );
  }
  const meta = result.card
    ? CARD_TYPE_META[result.card.type]
    : result.extract
      ? EXTRACT_KIND_META[result.extract.kind]
      : result.document
        ? DOCUMENT_KIND_META[result.document.kind]
        : null;
  const Icon = meta?.icon ?? Layers;
  return (
    <span className={`${base} ${meta?.soft ?? ''} ${meta?.text ?? ''}`} title={meta?.label}>
      <Icon className="size-4" />
    </span>
  );
}

function Highlighted({ text, tokens }: { text: string; tokens: string[] }) {
  return (
    <>
      {highlight(text, tokens).map((part, i) =>
        part.hit ? (
          <mark key={i} className="rounded-sm bg-gold/25 px-px text-ink">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}
