import { useEffect, useMemo, useState } from 'react';
import { FilePlus, Files, Link2, Search, Upload } from 'lucide-react';
import { DOCUMENT_KINDS, type DocumentKind, type ID, type Phase, type ResearchDocument } from '../../types';
import { DOCUMENT_KIND_META, SUPPORTED_FORMATS_LABEL } from '../../lib/documents';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { useDocumentActions } from './DocumentsContext';
import { DocumentRow } from './DocumentRow';

interface PhaseDocumentsPanelProps {
  phase: Phase;
  phases: Phase[];
  filed: ResearchDocument[];
  linked: ResearchDocument[];
  /** When search or a new upload targets a document, filters are cleared so it is visible. */
  focusItemId: ID | null;
}

/** The phase's research file: documents filed here, then documents from elsewhere linked to it. */
export function PhaseDocumentsPanel({ phase, phases, filed, linked, focusItemId }: PhaseDocumentsPanelProps) {
  const actions = useDocumentActions();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<DocumentKind | 'all'>('all');

  useEffect(() => {
    if (focusItemId) {
      setQuery('');
      setKind('all');
    }
  }, [focusItemId]);

  const all = useMemo(() => [...filed, ...linked], [filed, linked]);
  const kinds = DOCUMENT_KINDS.filter((k) => all.some((d) => d.kind === k));
  const q = query.trim().toLowerCase();
  const matches = (d: ResearchDocument) =>
    (kind === 'all' || d.kind === kind) && (!q || `${d.title} ${d.fileName} ${d.description} ${d.tags.join(' ')}`.toLowerCase().includes(q));
  const visibleFiled = filed.filter(matches);
  const visibleLinked = linked.filter(matches);
  const filtered = !!q || kind !== 'all';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Reports, models and filings that support this phase.</p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            icon={<Link2 className="size-3.5" />}
            onClick={() => actions.linkTo({ kind: 'phase', id: phase.id, label: phase.title, phaseId: phase.id })}
            title="Connect documents filed in other phases"
          >
            Link existing
          </Button>
          <Button size="sm" variant="primary" icon={<Upload className="size-3.5" />} onClick={() => actions.pick({ phaseId: phase.id })}>
            Upload documents
          </Button>
        </div>
      </div>

      {all.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface/60 px-3 py-3 sm:px-4">
          <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 focus-within:border-gold/70 sm:max-w-64">
            <Search className="size-3.5 shrink-0 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter documents"
              aria-label="Filter this phase's documents"
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint"
            />
          </label>
          {kinds.length > 1 && (
            <Select
              label="Type"
              value={kind}
              onChange={setKind}
              active={kind !== 'all'}
              options={[{ value: 'all', label: 'All types' }, ...kinds.map((k) => ({ value: k, label: DOCUMENT_KIND_META[k].label }))]}
            />
          )}
          {filtered && <span className="text-xs text-muted tabular">{visibleFiled.length + visibleLinked.length} shown</span>}
        </div>
      )}

      <section className="mt-8" aria-labelledby="phase-docs-heading">
        <Heading id="phase-docs-heading" title="Filed in this phase" count={visibleFiled.length} total={filed.length} filtered={filtered} />
        {filed.length === 0 ? (
          <button
            type="button"
            onClick={() => actions.pick({ phaseId: phase.id })}
            className="mt-4 flex w-full flex-col items-center rounded-2xl border border-dashed border-line-strong bg-surface/40 px-6 py-12 text-center transition-colors hover:border-gold/60 hover:bg-gold-soft/30"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-gold-soft text-gold">
              <FilePlus className="size-5" />
            </span>
            <span className="mt-4 font-display text-lg text-ink">Build this phase’s research file</span>
            <span className="mt-1 max-w-sm text-sm text-muted">
              Drop files anywhere on this page or click to browse. {SUPPORTED_FORMATS_LABEL}. PDFs open right here, with search.
            </span>
          </button>
        ) : visibleFiled.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No documents match.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {visibleFiled.map((d) => (
              <DocumentRow key={d.id} document={d} phases={phases} tokens={q ? [q] : []} />
            ))}
          </div>
        )}
      </section>

      {linked.length > 0 && (
        <section className="mt-10" aria-labelledby="phase-linked-docs-heading">
          <Heading id="phase-linked-docs-heading" title="Linked from other phases" count={visibleLinked.length} total={linked.length} filtered={filtered} />
          {visibleLinked.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No linked documents match.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {visibleLinked.map((d) => (
                <DocumentRow key={d.id} document={d} phases={phases} tokens={q ? [q] : []} linkedHere />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Heading({ id, title, count, total, filtered }: { id: string; title: string; count: number; total: number; filtered: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2.5">
      <h3 id={id} className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-ink uppercase">
        <Files className="size-4 text-gold" />
        {title}
      </h3>
      <span className="text-xs text-muted tabular">{filtered ? `${count} of ${total}` : total}</span>
    </div>
  );
}
