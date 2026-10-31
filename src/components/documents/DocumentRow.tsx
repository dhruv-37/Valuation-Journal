import { Download, Link2, Pencil, Trash } from 'lucide-react';
import type { Phase, ResearchDocument } from '../../types';
import { DOCUMENT_KIND_META, formatBadge } from '../../lib/documents';
import { formatDate, phaseNumber } from '../../lib/format';
import { formatBytes } from '../../lib/images';
import { highlight } from '../../lib/search';
import { IconButton } from '../ui/Button';
import { useDocumentActions } from './DocumentsContext';
import { DocumentThumb } from './DocumentThumb';

interface DocumentRowProps {
  document: ResearchDocument;
  phases: Phase[];
  /** Show which phase the document is filed under (Document Library). */
  showPhase?: boolean;
  /** Search words to highlight, and text around a match inside the file. */
  tokens?: string[];
  snippet?: string;
  activeTag?: string | null;
  onTag?: (tag: string) => void;
  /** Search text passed to the PDF viewer when opened. */
  openQuery?: string;
  /** Marks a document that is filed elsewhere but linked here. */
  linkedHere?: boolean;
}

export function DocumentRow({ document: doc, phases, showPhase, tokens = [], snippet, activeTag, onTag, openQuery, linkedHere }: DocumentRowProps) {
  const actions = useDocumentActions();
  const meta = DOCUMENT_KIND_META[doc.kind];
  const links = doc.cardIds.length + doc.extractIds.length + doc.snapshotIds.length + doc.linkedPhaseIds.length;
  const phaseIndex = doc.phaseId ? phases.findIndex((p) => p.id === doc.phaseId) : -1;

  return (
    <article
      data-item-id={doc.id}
      className="group relative flex gap-3.5 rounded-2xl border border-line bg-surface p-3 shadow-card transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-lift sm:gap-4 sm:p-3.5"
    >
      <button
        type="button"
        onClick={() => actions.open(doc.id, { query: openQuery })}
        className="absolute inset-0 rounded-2xl"
        aria-label={`Open ${doc.title || doc.fileName}`}
      />
      <DocumentThumb document={doc} className="pointer-events-none h-[72px] w-[54px] shrink-0 rounded-lg border border-line" />

      <div className="pointer-events-none min-w-0 flex-1 py-0.5">
        <h3 className="truncate text-[15px] leading-snug font-semibold text-ink">
          <Marked text={doc.title || doc.fileName} tokens={tokens} />
        </h3>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted tabular">
          <span className={`font-semibold ${meta.text}`}>{formatBadge(doc.fileName, doc.kind)}</span>
          <span>{formatBytes(doc.size)}</span>
          {doc.pageCount ? <span>{doc.pageCount} pp.</span> : null}
          <span>{formatDate(doc.createdAt)}</span>
          {showPhase && (
            <span className="truncate">{phaseIndex >= 0 ? `${phaseNumber(phaseIndex)} · ${phases[phaseIndex].title}` : 'Unfiled'}</span>
          )}
          {linkedHere && <span className="text-gold">Linked from {phaseIndex >= 0 ? `phase ${phaseNumber(phaseIndex)}` : 'the library'}</span>}
        </p>
        {snippet ? (
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-ink-2">
            <Marked text={snippet} tokens={tokens} />
          </p>
        ) : (
          doc.description && <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-ink-2">{doc.description}</p>
        )}
        {(doc.tags.length > 0 || links > 0) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            {links > 0 && (
              <span className="inline-flex items-center gap-1 text-[11.5px] text-muted" title="Connected phases, cards, extracts and snapshots">
                <Link2 className="size-3" /> {links}
              </span>
            )}
            {doc.tags.map((tag) =>
              onTag ? (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onTag(tag)}
                  className={`pointer-events-auto relative rounded-md px-1.5 py-0.5 text-[11.5px] transition-colors ${
                    activeTag === tag ? 'bg-gold-soft text-gold' : 'text-muted hover:bg-surface-2 hover:text-ink'
                  }`}
                >
                  #<Marked text={tag} tokens={tokens} />
                </button>
              ) : (
                <span key={tag} className="px-1 text-[11.5px] text-muted">
                  #{tag}
                </span>
              ),
            )}
          </div>
        )}
      </div>

      <div className="reveal-on-hover relative -mt-0.5 -mr-0.5 flex shrink-0 flex-col items-center sm:flex-row sm:items-start">
        <IconButton size="sm" label="Download" onClick={() => actions.download(doc)}>
          <Download className="size-3.5" />
        </IconButton>
        <IconButton size="sm" label="Edit details and connections" onClick={() => actions.edit(doc.id)}>
          <Pencil className="size-3.5" />
        </IconButton>
        <IconButton size="sm" label="Delete document" onClick={() => actions.remove(doc)} className="hover:!text-type-warning">
          <Trash className="size-3.5" />
        </IconButton>
      </div>
    </article>
  );
}

function Marked({ text, tokens }: { text: string; tokens: string[] }) {
  if (!tokens.length) return <>{text}</>;
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
