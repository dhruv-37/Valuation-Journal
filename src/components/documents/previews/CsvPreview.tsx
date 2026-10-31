import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { parseCsv, type ParsedTable } from '../../../lib/csv';
import { MAX_TEXT_PREVIEW_BYTES } from '../../../lib/documents';

const MAX_ROWS = 2000;

const DELIMITER_LABEL: Record<string, string> = { ',': 'comma', ';': 'semicolon', '\t': 'tab', '|': 'pipe' };

/** CSV/TSV as a table with a sticky header row. Long files show their first rows. */
export function CsvPreview({ blob, fileKey }: { blob: Blob; fileKey: string }) {
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [headerRow, setHeaderRow] = useState(true);
  const cutByBytes = blob.size > MAX_TEXT_PREVIEW_BYTES;

  useEffect(() => {
    let cancelled = false;
    setTable(null);
    blob
      .slice(0, MAX_TEXT_PREVIEW_BYTES)
      .text()
      .then((text) => !cancelled && setTable(parseCsv(text, MAX_ROWS + 1)));
    return () => {
      cancelled = true;
    };
    // Reload only when the file changes, not when a refresh hands us a new Blob object.
  }, [fileKey]);

  if (!table) {
    return (
      <p className="flex h-full items-center justify-center gap-2 text-sm text-muted">
        <LoaderCircle className="size-4 animate-spin" /> Reading table…
      </p>
    );
  }

  const columns = table.rows.reduce((max, r) => Math.max(max, r.length), 0);
  const head = headerRow ? (table.rows[0] ?? null) : null;
  const rest = headerRow ? table.rows.slice(1) : table.rows;
  const body = rest.slice(0, MAX_ROWS);
  const partial = table.truncated || cutByBytes || rest.length > MAX_ROWS;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-surface px-3 py-2 text-xs text-muted sm:px-4">
        <span className="tabular">
          {body.length.toLocaleString()} {body.length === 1 ? 'row' : 'rows'}
          {partial && ' shown (first part of the file)'} · {columns} {columns === 1 ? 'column' : 'columns'} · {DELIMITER_LABEL[table.delimiter] ?? table.delimiter}-separated
        </span>
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" checked={headerRow} onChange={(e) => setHeaderRow(e.target.checked)} className="accent-gold" />
          First row is a header
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-surface">
        {table.rows.length === 0 ? (
          <p className="p-6 text-sm text-muted">This file is empty.</p>
        ) : (
          <table className="min-w-full border-separate border-spacing-0 text-left font-mono text-[12.5px] tabular">
            {head && (
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="sticky left-0 z-10 border-r border-b border-line bg-surface-2 px-2 py-1.5 text-right text-faint" />
                  {Array.from({ length: columns }, (_, c) => (
                    <th key={c} className="border-r border-b border-line bg-surface-2 px-3 py-1.5 font-sans font-semibold whitespace-nowrap text-ink">
                      {head[c] ?? ''}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {body.map((row, r) => (
                <tr key={r} className="hover:bg-gold-soft/40">
                  <td className="sticky left-0 border-r border-b border-line bg-surface px-2 py-1 text-right text-faint">{r + 1}</td>
                  {Array.from({ length: columns }, (_, c) => (
                    <td key={c} className="max-w-[28rem] truncate border-r border-b border-line px-3 py-1 text-ink-2" title={row[c]}>
                      {row[c] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
