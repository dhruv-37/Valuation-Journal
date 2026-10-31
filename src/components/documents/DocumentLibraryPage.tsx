import { useDeferredValue, useMemo, useState } from 'react';
import { ArrowRight, FilePlus, Search, Upload, X } from 'lucide-react';
import { DOCUMENT_KINDS, type DocumentKind, type ID, type Phase, type ResearchDocument } from '../../types';
import { useDocumentTextMatches, useDocuments } from '../../hooks/useJournalData';
import { DOCUMENT_KIND_META, SUPPORTED_FORMATS_LABEL } from '../../lib/documents';
import { phaseNumber } from '../../lib/format';
import { tokenize } from '../../lib/search';
import { useActiveJournal } from '../../hooks/useActiveJournal';
import { Button } from '../ui/Button';
import { AppHeader } from '../AppHeader';
import { Select } from '../ui/Select';
import { DropOverlay } from '../library/DropOverlay';
import { useDocumentActions } from './DocumentsContext';
import { DocumentRow } from './DocumentRow';
import { StoragePanel } from './StoragePanel';

type SortOrder = 'newest' | 'oldest' | 'title' | 'size';
const UNFILED = 'unfiled';

const SORTS: { value: SortOrder; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'size', label: 'Largest first' },
];

const COMPARE: Record<SortOrder, (a: ResearchDocument, b: ResearchDocument) => number> = {
  newest: (a, b) => b.createdAt - a.createdAt,
  oldest: (a, b) => a.createdAt - b.createdAt,
  title: (a, b) => (a.title || a.fileName).localeCompare(b.title || b.fileName),
  size: (a, b) => b.size - a.size,
};

interface DocumentLibraryPageProps {
  phases: Phase[];
  onOpenPhase: (id: ID) => void;
  onSearch: () => void;
  /** A phase workspace is open on top; stop taking dropped files. */
  covered: boolean;
}

/** Every document in the journal, searchable (including text inside files) and organised by phase. */
export function DocumentLibraryPage({ phases, onOpenPhase, onSearch, covered }: DocumentLibraryPageProps) {
  const documents = useDocuments();
  const journal = useActiveJournal();
  const actions = useDocumentActions();

  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<DocumentKind | 'all'>('all');
  const [phase, setPhase] = useState<string>('all');
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState<SortOrder>('newest');
  const [grouped, setGrouped] = useState(true);

  const deferredQuery = useDeferredValue(query);
  const textHits = useDocumentTextMatches(deferredQuery);
  const tokens = tokenize(query);

  const all = documents ?? [];
  const tags = useMemo(() => Array.from(new Set(all.flatMap((d) => d.tags))).sort(), [all]);
  const kinds = DOCUMENT_KINDS.filter((k) => all.some((d) => d.kind === k));
  const totalBytes = all.reduce((sum, d) => sum + d.size, 0);

  const visible = useMemo(() => {
    const t = tokenize(deferredQuery);
    return all
      .filter((d) => {
        if (kind !== 'all' && d.kind !== kind) return false;
        if (tag && !d.tags.includes(tag)) return false;
        if (phase === UNFILED ? d.phaseId !== null : phase !== 'all' && d.phaseId !== phase && !d.linkedPhaseIds.includes(phase)) return false;
        if (t.length === 0) return true;
        const meta = `${d.title} ${d.fileName} ${d.description} ${d.tags.map((x) => `#${x}`).join(' ')}`.toLowerCase();
        return t.every((x) => meta.includes(x)) || textHits?.has(d.id);
      })
      .sort(COMPARE[sort]);
  }, [all, kind, tag, phase, deferredQuery, textHits, sort]);

  const groups = useMemo(() => {
    if (!grouped) return null;
    const byPhase = new Map<string, ResearchDocument[]>();
    for (const d of visible) {
      const key = d.phaseId && phases.some((p) => p.id === d.phaseId) ? d.phaseId : UNFILED;
      byPhase.set(key, [...(byPhase.get(key) ?? []), d]);
    }
    return [...phases.map((p, i) => ({ id: p.id, index: i, label: p.title })), { id: UNFILED, index: -1, label: 'Unfiled' }]
      .map((g) => ({ ...g, documents: byPhase.get(g.id) ?? [] }))
      .filter((g) => g.documents.length > 0);
  }, [grouped, visible, phases]);

  const filtered = tokens.length > 0 || kind !== 'all' || !!tag || phase !== 'all';
  const uploadTarget = { phaseId: phase !== 'all' && phase !== UNFILED ? phase : null };
  const targetPhase = phases.find((p) => p.id === uploadTarget.phaseId);
  const clear = () => {
    setQuery('');
    setKind('all');
    setTag('');
    setPhase('all');
  };

  const row = (d: ResearchDocument, showPhase: boolean) => (
    <DocumentRow
      key={d.id}
      document={d}
      phases={phases}
      showPhase={showPhase}
      tokens={tokens}
      snippet={tokens.length ? textHits?.get(d.id) : undefined}
      openQuery={tokens.length ? query : undefined}
      activeTag={tag || null}
      onTag={(t) => setTag((current) => (current === t ? '' : t))}
    />
  );

  return (
    <div className="min-h-dvh">
      <AppHeader current="documents" documentCount={all.length} onSearch={onSearch} />

      <main className="mx-auto max-w-[1320px] px-4 pb-24 sm:px-8">
        <section className="grid items-end gap-8 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-gold uppercase">{journal?.name ?? 'Journal'} · Research files</p>
            <h1 className="mt-3 font-display text-[40px] leading-[1.05] font-medium tracking-tight text-ink sm:text-[52px]">Document Library</h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
              Every report, model and filing in the journal, organised by phase. PDFs, images, text, Markdown and CSV open right here; Office files
              are kept safely for download.
            </p>
            <Button
              variant="primary"
              className="mt-6"
              icon={<Upload className="size-4" />}
              onClick={() => actions.pick(uploadTarget)}
            >
              Upload documents{targetPhase ? ` to ${phaseNumber(phases.indexOf(targetPhase))}` : ''}
            </Button>
          </div>
          <StoragePanel documentBytes={totalBytes} documentCount={all.length} />
        </section>

        {documents && all.length === 0 ? (
          <button
            type="button"
            onClick={() => actions.pick(uploadTarget)}
            className="flex w-full flex-col items-center rounded-3xl border border-dashed border-line-strong bg-surface/40 px-6 py-16 text-center transition-colors hover:border-gold/60 hover:bg-gold-soft/30"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-gold-soft text-gold">
              <FilePlus className="size-5" />
            </span>
            <span className="mt-4 font-display text-xl text-ink">Start your research library</span>
            <span className="mt-1.5 max-w-md text-sm text-muted">
              Drop files anywhere on this page or click to browse. {SUPPORTED_FORMATS_LABEL}, up to 200 MB each. You can also add documents from
              inside any phase.
            </span>
          </button>
        ) : (
          <>
            <div className="sticky top-16 z-10 -mx-4 border-y border-line/70 bg-canvas/90 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
              <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Filter documents">
                <label className="flex h-8 min-w-0 basis-full items-center gap-2 rounded-lg border border-line bg-surface px-2.5 focus-within:border-gold/70 sm:max-w-80 sm:flex-1 sm:basis-auto">
                  <Search className="size-3.5 shrink-0 text-faint" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search titles, tags and text inside files"
                    aria-label="Search documents"
                    className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint"
                  />
                  {query && (
                    <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="rounded p-0.5 text-muted hover:text-ink">
                      <X className="size-3.5" />
                    </button>
                  )}
                </label>
                <Select
                  label="Phase"
                  value={phase}
                  onChange={setPhase}
                  active={phase !== 'all'}
                  options={[
                    { value: 'all', label: 'All phases' },
                    ...phases.map((p, i) => ({ value: p.id, label: `${phaseNumber(i)} ${p.title}` })),
                    { value: UNFILED, label: 'Unfiled' },
                  ]}
                />
                <Select
                  label="Type"
                  value={kind}
                  onChange={setKind}
                  active={kind !== 'all'}
                  options={[{ value: 'all', label: 'All types' }, ...kinds.map((k) => ({ value: k, label: DOCUMENT_KIND_META[k].label }))]}
                />
                {tags.length > 0 && (
                  <Select label="Tag" value={tag} onChange={setTag} active={!!tag} options={[{ value: '', label: 'All tags' }, ...tags.map((t) => ({ value: t, label: `#${t}` }))]} />
                )}
                <Select label="Sort" value={sort} onChange={setSort} options={SORTS} />
                <button
                  type="button"
                  aria-pressed={grouped}
                  onClick={() => setGrouped((g) => !g)}
                  className={`inline-flex h-8 items-center rounded-lg border px-2.5 text-[13px] font-medium transition-colors ${
                    grouped ? 'border-gold/50 bg-gold-soft text-gold' : 'border-line bg-surface text-ink-2 hover:border-line-strong'
                  }`}
                >
                  Group by phase
                </button>
                {filtered && (
                  <button type="button" onClick={clear} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[13px] text-muted hover:bg-surface-2 hover:text-ink">
                    <X className="size-3.5" /> Clear
                    <span className="ml-1 text-faint tabular">
                      · {visible.length} of {all.length}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {documents && visible.length === 0 && (
              <p className="py-16 text-center text-sm text-muted">
                No documents match{query ? ` “${query}”` : ''}. {deferredQuery !== query && 'Searching…'}
              </p>
            )}

            {groups ? (
              groups.map((g) => (
                <section key={g.id} className="mt-10" aria-label={g.label}>
                  <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2.5">
                    <h2 className="flex min-w-0 items-baseline gap-2.5 font-display text-[21px] leading-tight text-ink">
                      {g.index >= 0 && <span className="text-[15px] text-gold tabular">{phaseNumber(g.index)}</span>}
                      <span className="truncate">{g.label}</span>
                      <span className="font-sans text-xs text-muted tabular">{g.documents.length}</span>
                    </h2>
                    {g.id !== UNFILED && (
                      <button type="button" onClick={() => onOpenPhase(g.id)} className="inline-flex shrink-0 items-center gap-1 text-xs text-muted hover:text-gold">
                        Open phase <ArrowRight className="size-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">{g.documents.map((d) => row(d, false))}</div>
                </section>
              ))
            ) : (
              <div className="mt-8 grid gap-3 lg:grid-cols-2">{visible.map((d) => row(d, true))}</div>
            )}
          </>
        )}
      </main>

      <DropOverlay
        title="Drop to add documents"
        subtitle={`${targetPhase ? `Filed under “${targetPhase.title}”` : 'Added to the library as unfiled'} · ${SUPPORTED_FORMATS_LABEL}`}
        onDrop={(files) => actions.upload(files, uploadTarget)}
        disabled={covered}
      />
    </div>
  );
}
