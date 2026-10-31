import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { MAX_TEXT_PREVIEW_BYTES } from '../../../lib/documents';
import { formatBytes } from '../../../lib/images';
import { parseMarkdown } from '../../../lib/markdown';
import { MarkdownView } from './MarkdownView';

interface TextPreviewProps {
  blob: Blob;
  fileKey: string;
  markdown?: boolean;
}

/** Plain text, or Markdown with a formatted / source toggle. Very large files show their beginning. */
export function TextPreview({ blob, fileKey, markdown }: TextPreviewProps) {
  const [text, setText] = useState<string | null>(null);
  const [mode, setMode] = useState<'formatted' | 'source'>('formatted');
  const truncated = blob.size > MAX_TEXT_PREVIEW_BYTES;

  useEffect(() => {
    let cancelled = false;
    setText(null);
    blob
      .slice(0, MAX_TEXT_PREVIEW_BYTES)
      .text()
      .then((t) => !cancelled && setText(t));
    return () => {
      cancelled = true;
    };
    // Reload only when the file changes, not when a refresh hands us a new Blob object.
  }, [fileKey]);

  const blocks = useMemo(() => (markdown && text !== null ? parseMarkdown(text) : null), [markdown, text]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {(markdown || truncated) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-1.5 sm:px-4">
          {markdown && (
            <div className="inline-flex rounded-lg border border-line p-0.5 text-[13px]" role="group" aria-label="Markdown view">
              {(['formatted', 'source'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className={`rounded-md px-2.5 py-1 capitalize transition-colors ${mode === m ? 'bg-surface-2 font-medium text-ink' : 'text-muted hover:text-ink'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
          {truncated && (
            <span className="text-xs text-muted">
              Showing the first {formatBytes(MAX_TEXT_PREVIEW_BYTES)} of {formatBytes(blob.size)}. Download for the full file.
            </span>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto bg-surface-2 px-3 py-5 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-line bg-surface px-5 py-6 shadow-card sm:px-10 sm:py-9">
          {text === null ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <LoaderCircle className="size-4 animate-spin" /> Reading file…
            </p>
          ) : !text.trim() ? (
            <p className="text-sm text-muted">This file is empty.</p>
          ) : blocks && mode === 'formatted' ? (
            <MarkdownView blocks={blocks} />
          ) : (
            <pre className="font-mono text-[13px] leading-[1.75] break-words whitespace-pre-wrap text-ink">{text}</pre>
          )}
        </div>
      </div>
    </div>
  );
}
