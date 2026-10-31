import { Download, ShieldCheck } from 'lucide-react';
import type { ResearchDocument } from '../../../types';
import { DOCUMENT_KIND_META, formatBadge } from '../../../lib/documents';
import { formatBytes } from '../../../lib/images';
import { Button } from '../../ui/Button';

/**
 * Office files (Excel, Word, PowerPoint) can't be rendered faithfully in the
 * browser without a cloud viewer, so instead of a broken preview this says so
 * plainly and offers the original file.
 */
export function NoPreview({ document, onDownload }: { document: ResearchDocument; onDownload: () => void }) {
  const meta = DOCUMENT_KIND_META[document.kind];
  const Icon = meta.icon;
  return (
    <div className="flex h-full items-center justify-center overflow-y-auto bg-surface-2 p-5 sm:p-8">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 text-center shadow-card sm:p-8">
        <span className={`mx-auto flex size-16 items-center justify-center rounded-2xl ${meta.soft} ${meta.text}`}>
          <Icon className="size-8" strokeWidth={1.6} />
        </span>
        <p className="mt-4 text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">
          {formatBadge(document.fileName, document.kind)} · {formatBytes(document.size)}
        </p>
        <h3 className="mt-1 font-display text-xl leading-snug break-words text-ink">{document.fileName}</h3>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {meta.label} files can’t be previewed reliably inside the browser without sending them to an online viewer, which this journal
          never does. Download the file to open it in {meta.opensIn ?? 'its usual application'}.
        </p>
        <Button variant="primary" className="mt-5" icon={<Download className="size-4" />} onClick={onDownload}>
          Download {formatBadge(document.fileName, document.kind)}
        </Button>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-faint">
          <ShieldCheck className="size-3.5" /> The original file is stored unchanged in this browser.
        </p>
        {document.kind === 'spreadsheet' && (
          <p className="mt-3 text-xs text-muted">Tip: save a sheet as CSV to see it as a table here.</p>
        )}
      </div>
    </div>
  );
}
