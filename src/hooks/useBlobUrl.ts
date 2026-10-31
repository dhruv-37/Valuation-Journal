import { useEffect, useState } from 'react';

/**
 * Object URLs for blobs stored in IndexedDB.
 *
 * Every live-query refresh returns new Blob objects for the same image, so URLs
 * are cached by a stable key (the image never changes once stored) and shared
 * between components. Each URL is reference-counted and revoked shortly after
 * the last component using it unmounts, so memory is released.
 */

interface Entry {
  url: string;
  refs: number;
  timer?: number;
}

const cache = new Map<string, Entry>();
const RELEASE_DELAY_MS = 1500;

/** Takes a reference to the URL for `key`, creating it if needed. Call `release` when done. */
function acquire(key: string, blob: Blob): { url: string; release: () => void } {
  let entry = cache.get(key);
  if (!entry) {
    entry = { url: URL.createObjectURL(blob), refs: 0 };
    cache.set(key, entry);
  }
  window.clearTimeout(entry.timer);
  entry.refs++;
  const held = entry;
  let released = false;
  return {
    url: entry.url,
    release: () => {
      if (released || cache.get(key) !== held) return;
      released = true;
      held.refs--;
      if (held.refs <= 0) {
        // Delay so quick remounts (tab switches, re-renders) reuse the URL.
        held.timer = window.setTimeout(() => {
          if (held.refs <= 0) {
            URL.revokeObjectURL(held.url);
            cache.delete(key);
          }
        }, RELEASE_DELAY_MS);
      }
    },
  };
}

export function useBlobUrl(key: string | null, blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => (key ? cache.get(key)?.url ?? null : null));
  const hasBlob = !!blob;

  useEffect(() => {
    if (!key || !blob) {
      setUrl(null);
      return;
    }
    const handle = acquire(key, blob);
    setUrl(handle.url);
    return handle.release;
    // The key identifies immutable content; a new Blob object for the same key is the same image.
  }, [key, hasBlob]);

  return url;
}

/** Saves a stored file to the user's downloads folder under its original name. */
export function downloadBlob(key: string, blob: Blob, fileName: string) {
  const handle = acquire(key, blob);
  const link = document.createElement('a');
  link.href = handle.url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  // Released after the usual delay, which gives the browser time to start the download.
  handle.release();
}

/** Number of live object URLs (for debugging and tests). */
export const liveBlobUrlCount = () => cache.size;
