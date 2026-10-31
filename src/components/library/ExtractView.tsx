import { Copy, ExternalLink, FileText, Paperclip, Pencil, Pin, PinOff, Trash } from 'lucide-react';
import type { KnowledgeExtract } from '../../types';
import { EXTRACT_KIND_META } from '../../lib/extractKinds';
import { setExtractPinned } from '../../db/repository';
import { formatDate, isSafeUrl } from '../../lib/format';
import { IconButton } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { useItemDocuments } from '../../hooks/useJournalData';
import { useDocumentActions } from '../documents/DocumentsContext';
import { DocumentChips } from '../documents/DocumentChips';

interface ExtractViewProps {
  extract: KnowledgeExtract;
  activeTag: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onTag: (tag: string) => void;
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** A saved passage set like a citation: the text first, then where it came from. */
export function ExtractView({ extract, activeTag, onEdit, onDelete, onTag }: ExtractViewProps) {
  const meta = EXTRACT_KIND_META[extract.kind];
  const Icon = meta.icon;
  const toast = useToast();
  const documentActions = useDocumentActions();
  const documents = useItemDocuments('extract', extract.id);

  const copy = async () => {
    const citation = [extract.sourceDocument, extract.location].filter(Boolean).join(', ');
    try {
      await navigator.clipboard.writeText(citation ? `${extract.text}\n— ${citation}` : extract.text);
      toast({ message: 'Extract copied to clipboard' });
    } catch {
      toast({ message: 'Copying is blocked by the browser', tone: 'error' });
    }
  };

  const hasCitation = extract.sourceDocument || extract.location || extract.url;

  return (
    <article
      data-item-id={extract.id}
      className={`group relative rounded-2xl border bg-surface shadow-card transition-[border-color,box-shadow] hover:shadow-lift ${
        extract.pinned ? 'border-gold/45' : 'border-line hover:border-line-strong'
      }`}
    >
      <div className="px-5 py-4 sm:px-7 sm:py-6">
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${meta.text} ${meta.soft}`}>
              <Icon className="size-3.5" strokeWidth={2.2} />
              {meta.label}
            </span>
            {extract.pinned && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gold">
                <Pin className="size-3 fill-current" /> Important
              </span>
            )}
            <span className="text-[11.5px] text-faint tabular">{formatDate(extract.createdAt)}</span>
          </div>
          <div className="reveal-on-hover -mt-1 -mr-1 flex items-center">
            <IconButton size="sm" label="Copy text" onClick={copy}>
              <Copy className="size-3.5" />
            </IconButton>
            <IconButton
              size="sm"
              label="Connect documents to this extract"
              onClick={() => documentActions.linkTo({ kind: 'extract', id: extract.id, label: extract.title || extract.text.slice(0, 60), phaseId: extract.phaseId })}
            >
              <Paperclip className="size-3.5" />
            </IconButton>
            <IconButton size="sm" label={extract.pinned ? 'Unmark important' : 'Mark important'} active={extract.pinned} onClick={() => setExtractPinned(extract.id, !extract.pinned)}>
              {extract.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
            </IconButton>
            <IconButton size="sm" label="Edit extract" onClick={onEdit}>
              <Pencil className="size-3.5" />
            </IconButton>
            <IconButton size="sm" label="Delete extract" onClick={onDelete} className="hover:!text-type-warning">
              <Trash className="size-3.5" />
            </IconButton>
          </div>
        </header>

        {extract.title && <h3 className="mt-3 text-[15.5px] leading-snug font-semibold text-ink">{extract.title}</h3>}

        {meta.style === 'quote' && (
          <blockquote className={`relative mt-3 border-l-2 pl-5 font-display text-[18px] leading-[1.6] whitespace-pre-wrap text-ink ${extract.kind === 'sentence' ? 'border-type-source/50' : 'border-type-concept/40'}`}>
            {extract.text}
          </blockquote>
        )}
        {meta.style === 'mono' && (
          <pre className="mt-3 overflow-x-auto rounded-xl border border-type-formula/20 bg-type-formula/[0.06] px-4 py-3.5 font-mono text-[13px] leading-[1.75] whitespace-pre-wrap text-ink">
            {extract.text}
          </pre>
        )}
        {meta.style === 'prose' && <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-wrap text-ink-2">{extract.text}</p>}

        <DocumentChips documents={documents} className="mt-4" />

        {(hasCitation || extract.tags.length > 0) && (
          <footer className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-3 text-xs text-muted">
            {(extract.sourceDocument || extract.location) && (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <FileText className="size-3.5 shrink-0 text-faint" />
                <span className="truncate">
                  {extract.sourceDocument}
                  {extract.sourceDocument && extract.location && <span className="text-faint"> · </span>}
                  {extract.location}
                </span>
              </span>
            )}
            {extract.url && isSafeUrl(extract.url) && (
              <a
                href={extract.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-64 items-center gap-1 text-gold hover:text-gold-strong hover:underline"
                title={extract.url}
              >
                <ExternalLink className="size-3.5 shrink-0" />
                <span className="truncate">{hostname(extract.url)}</span>
              </a>
            )}
            <span className="ml-auto flex flex-wrap gap-1">
              {extract.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onTag(tag)}
                  className={`rounded-md px-1.5 py-0.5 transition-colors ${activeTag === tag ? 'bg-gold-soft text-gold' : 'hover:bg-surface-2 hover:text-ink'}`}
                >
                  #{tag}
                </button>
              ))}
            </span>
          </footer>
        )}
      </div>
    </article>
  );
}
