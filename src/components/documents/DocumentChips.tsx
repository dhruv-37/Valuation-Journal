import type { ResearchDocument } from '../../types';
import { DOCUMENT_KIND_META, formatBadge } from '../../lib/documents';
import { useDocumentActions } from './DocumentsContext';

interface DocumentChipsProps {
  documents: ResearchDocument[];
  /** 'dark' for the always-dark image viewer. */
  tone?: 'default' | 'dark';
  className?: string;
}

/** Compact links to connected documents, shown on cards, extracts and snapshots. */
export function DocumentChips({ documents, tone = 'default', className = '' }: DocumentChipsProps) {
  const actions = useDocumentActions();
  if (documents.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`} aria-label="Connected documents">
      {documents.map((d) => {
        const meta = DOCUMENT_KIND_META[d.kind];
        const Icon = meta.icon;
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => actions.open(d.id)}
            title={`Open ${d.fileName}`}
            className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition-colors ${
              tone === 'dark'
                ? 'border-white/10 bg-white/5 text-white/80 hover:border-white/25 hover:text-white'
                : 'border-line bg-surface-2/60 text-ink-2 hover:border-gold/50 hover:text-ink'
            }`}
          >
            <Icon className={`size-3.5 shrink-0 ${tone === 'dark' ? '' : meta.text}`} />
            <span className="truncate">{d.title || d.fileName}</span>
            <span className={`shrink-0 text-[10px] font-semibold ${tone === 'dark' ? 'text-white/45' : 'text-faint'}`}>{formatBadge(d.fileName, d.kind)}</span>
          </button>
        );
      })}
    </div>
  );
}
