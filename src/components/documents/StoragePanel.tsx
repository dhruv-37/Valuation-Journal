import { useEffect, useState } from 'react';
import { HardDrive, ShieldCheck } from 'lucide-react';
import { readStorageInfo, type StorageInfo } from '../../lib/documents';
import { formatBytes } from '../../lib/images';
import { percent } from '../../lib/format';
import { ProgressBar } from '../ui/ProgressBar';
import { useToast } from '../ui/Toast';

/**
 * How much browser storage the journal uses, and whether the browser may clear
 * it under storage pressure. Everything lives in this browser profile only, so
 * this is stated plainly.
 */
export function StoragePanel({ documentBytes, documentCount }: { documentBytes: number; documentCount: number }) {
  const [info, setInfo] = useState<StorageInfo | null | undefined>(undefined);
  const toast = useToast();

  // Re-read after uploads and deletions (the document total changes).
  useEffect(() => {
    let cancelled = false;
    readStorageInfo().then((i) => !cancelled && setInfo(i));
    return () => {
      cancelled = true;
    };
  }, [documentBytes]);

  const protect = async () => {
    try {
      const granted = (await navigator.storage?.persist?.()) ?? false;
      setInfo(await readStorageInfo());
      toast(
        granted
          ? { message: 'Storage protected: the browser won’t clear it to free space.' }
          : { message: 'The browser declined for now. It may allow it after more use, or if the site is bookmarked or installed.', tone: 'error' },
      );
    } catch {
      toast({ message: 'This browser does not support protected storage.', tone: 'error' });
    }
  };

  const used = info ? percent(info.usage, info.quota) : 0;

  return (
    <div className="rounded-2xl border border-line bg-surface px-5 py-4 shadow-card sm:w-80">
      <p className="flex items-center gap-2 text-[11px] font-medium tracking-wide text-muted uppercase">
        <HardDrive className="size-3.5" /> Browser storage
      </p>
      <p className="mt-2 font-display text-[26px] leading-none tracking-tight text-ink tabular">
        {formatBytes(documentBytes)}
        <span className="ml-1.5 font-sans text-sm text-faint">
          in {documentCount} {documentCount === 1 ? 'file' : 'files'}
        </span>
      </p>
      {info ? (
        <>
          <ProgressBar value={Math.max(used, info.usage > 0 ? 1 : 0)} className="mt-3" />
          <p className="mt-2 text-xs text-muted tabular">
            Site total {formatBytes(info.usage)} of about {formatBytes(info.quota)} available
          </p>
          {info.persisted ? (
            <p className="mt-2.5 flex items-center gap-1.5 text-xs text-gold">
              <ShieldCheck className="size-3.5" /> Protected from automatic clearing
            </p>
          ) : (
            <button type="button" onClick={protect} className="mt-2.5 flex items-center gap-1.5 text-xs text-muted hover:text-gold">
              <ShieldCheck className="size-3.5" /> Ask the browser to protect this storage
            </button>
          )}
        </>
      ) : (
        info === null && <p className="mt-2 text-xs text-muted">This browser does not report storage usage.</p>
      )}
      <p className="mt-3 border-t border-line pt-3 text-[11.5px] leading-relaxed text-faint">
        Files are kept only in this browser profile. Clearing site data removes them, so keep your originals.
      </p>
    </div>
  );
}
