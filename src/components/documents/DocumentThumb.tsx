import type { ResearchDocument } from '../../types';
import { useBlobUrl } from '../../hooks/useBlobUrl';
import { DOCUMENT_KIND_META, formatBadge } from '../../lib/documents';

/** First-page or image thumbnail when one exists; otherwise the format's icon and extension. */
export function DocumentThumb({ document, className = '' }: { document: ResearchDocument; className?: string }) {
  const url = useBlobUrl(document.thumbnail ? `dthumb:${document.id}` : null, document.thumbnail);
  const meta = DOCUMENT_KIND_META[document.kind];
  const Icon = meta.icon;

  if (url) {
    return (
      <span className={`relative block overflow-hidden bg-surface ${className}`}>
        <img src={url} alt="" draggable={false} className="h-full w-full object-cover object-top" />
        <span className={`absolute right-1 bottom-1 rounded px-1 py-px text-[9px] font-bold tracking-wide ${meta.text} bg-surface/90`}>
          {formatBadge(document.fileName, document.kind)}
        </span>
      </span>
    );
  }
  return (
    <span className={`flex flex-col items-center justify-center gap-1 ${meta.soft} ${meta.text} ${className}`}>
      <Icon className="size-[42%] max-h-7 max-w-7" strokeWidth={1.7} />
      <span className="text-[9px] font-bold tracking-wide">{formatBadge(document.fileName, document.kind)}</span>
    </span>
  );
}
