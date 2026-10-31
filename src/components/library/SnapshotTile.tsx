import { Link2, Pencil, Pin, PinOff, Trash } from 'lucide-react';
import type { Snapshot } from '../../types';
import { setSnapshotPinned } from '../../db/repository';
import { formatDate } from '../../lib/format';
import { IconButton } from '../ui/Button';
import { SnapshotThumb } from './SnapshotThumb';

interface SnapshotTileProps {
  snapshot: Snapshot;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTag: (tag: string) => void;
  activeTag: string | null;
}

/** A gallery plate: the image on a mat, then title, caption and catalogue details. */
export function SnapshotTile({ snapshot, onOpen, onEdit, onDelete, onTag, activeTag }: SnapshotTileProps) {
  return (
    <figure
      data-item-id={snapshot.id}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-surface shadow-card transition-[border-color,box-shadow] hover:shadow-lift ${
        snapshot.pinned ? 'border-gold/45' : 'border-line hover:border-line-strong'
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`View ${snapshot.title || 'snapshot'}`}
        className="relative block aspect-[4/3] w-full overflow-hidden border-b border-line bg-surface-2"
      >
        <SnapshotThumb snapshot={snapshot} className="absolute inset-0 h-full w-full p-3 transition-transform duration-300 group-hover:scale-[1.02]" />
        <span className="absolute bottom-2 left-2 rounded-md bg-canvas/85 px-1.5 py-0.5 text-[10.5px] font-medium tracking-wide text-muted uppercase backdrop-blur-sm tabular">
          {snapshot.mimeType.split('/')[1].replace('jpeg', 'jpg')} · {snapshot.width}×{snapshot.height}
        </span>
      </button>

      <div className="reveal-on-hover absolute top-2 right-2 flex items-center rounded-lg border border-line bg-surface/95 p-0.5 shadow-card backdrop-blur">
        <IconButton size="sm" label={snapshot.pinned ? 'Unpin snapshot' : 'Pin snapshot'} active={snapshot.pinned} onClick={() => setSnapshotPinned(snapshot.id, !snapshot.pinned)}>
          {snapshot.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
        </IconButton>
        <IconButton size="sm" label="Edit snapshot" onClick={onEdit}>
          <Pencil className="size-3.5" />
        </IconButton>
        <IconButton size="sm" label="Delete snapshot" onClick={onDelete} className="hover:!text-type-warning">
          <Trash className="size-3.5" />
        </IconButton>
      </div>
      {snapshot.pinned && (
        <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-md bg-gold-soft px-1.5 py-0.5 text-[11px] font-medium text-gold">
          <Pin className="size-3 fill-current" /> Pinned
        </span>
      )}

      <figcaption className="flex flex-1 flex-col px-4 pt-3 pb-3.5">
        <h3 className="line-clamp-2 text-[14.5px] leading-snug font-semibold text-ink">{snapshot.title || 'Untitled snapshot'}</h3>
        {(snapshot.caption || snapshot.description) && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">{snapshot.caption || snapshot.description}</p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-3 text-[11.5px] text-faint">
          <span className="tabular">{formatDate(snapshot.createdAt)}</span>
          {snapshot.cardIds.length > 0 && (
            <span className="inline-flex items-center gap-1" title="Linked knowledge cards">
              <Link2 className="size-3" />
              {snapshot.cardIds.length}
            </span>
          )}
          {snapshot.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onTag(tag)}
              className={`rounded px-1 transition-colors ${activeTag === tag ? 'bg-gold-soft text-gold' : 'hover:bg-surface-2 hover:text-ink'}`}
            >
              #{tag}
            </button>
          ))}
        </div>
      </figcaption>
    </figure>
  );
}
