import { useState } from 'react';
import { Scan, ZoomIn, ZoomOut } from 'lucide-react';
import { IconButton } from '../../ui/Button';

const STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

/** Image document preview: fit to the window by default, or step through zoom levels and scroll. */
export function ImagePreview({ url, alt }: { url: string; alt: string }) {
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  const current = zoom === 'fit' ? null : zoom;
  const step = (dir: 1 | -1) => {
    const base = current ?? 1;
    const next = dir > 0 ? STEPS.find((s) => s > base + 0.001) : [...STEPS].reverse().find((s) => s < base - 0.001);
    if (next) setZoom(next);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-0.5 border-b border-line bg-surface px-2 py-1.5 sm:px-4" role="toolbar" aria-label="Image controls">
        <IconButton size="sm" label="Zoom out" onClick={() => step(-1)} disabled={current !== null && current <= STEPS[0]}>
          <ZoomOut className="size-4" />
        </IconButton>
        <button
          type="button"
          onClick={() => setZoom(zoom === 'fit' ? 1 : 'fit')}
          className="h-7 w-16 rounded-md text-[13px] text-ink-2 tabular hover:bg-surface-2"
          title={zoom === 'fit' ? 'Actual size' : 'Fit to window'}
        >
          {zoom === 'fit' ? 'Fit' : `${Math.round(zoom * 100)}%`}
        </button>
        <IconButton size="sm" label="Zoom in" onClick={() => step(1)} disabled={current !== null && current >= STEPS[STEPS.length - 1]}>
          <ZoomIn className="size-4" />
        </IconButton>
        <IconButton size="sm" label="Fit to window" active={zoom === 'fit'} onClick={() => setZoom('fit')}>
          <Scan className="size-4" />
        </IconButton>
        {natural && (
          <span className="ml-auto text-xs text-muted tabular">
            {natural.w} × {natural.h}
          </span>
        )}
      </div>
      <div className={`min-h-0 flex-1 overflow-auto bg-surface-2 p-4 sm:p-8 ${zoom === 'fit' ? 'flex items-center justify-center' : ''}`}>
        <img
          src={url}
          alt={alt}
          draggable={false}
          onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          className={`rounded-sm shadow-lift ${zoom === 'fit' ? 'max-h-full max-w-full object-contain' : 'mx-auto max-w-none'}`}
          style={current !== null && natural ? { width: natural.w * current } : undefined}
        />
      </div>
    </div>
  );
}
