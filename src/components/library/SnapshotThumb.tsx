import { ImageOff } from 'lucide-react';
import type { Snapshot } from '../../types';
import { useBlobUrl } from '../../hooks/useBlobUrl';

/** The stored thumbnail, letterboxed (never cropped or stretched). */
export function SnapshotThumb({ snapshot, className = '', fit = 'contain' }: { snapshot: Snapshot; className?: string; fit?: 'contain' | 'cover' }) {
  const url = useBlobUrl(`thumb:${snapshot.id}`, snapshot.thumbnail);
  if (!snapshot.thumbnail) {
    return (
      <span className={`flex items-center justify-center text-faint ${className}`}>
        <ImageOff className="size-5" />
      </span>
    );
  }
  return url ? (
    <img
      src={url}
      alt={snapshot.title || 'Snapshot'}
      draggable={false}
      loading="lazy"
      decoding="async"
      className={`${fit === 'contain' ? 'object-contain' : 'object-cover'} ${className}`}
    />
  ) : (
    <span className={className} />
  );
}
