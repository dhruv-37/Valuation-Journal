/** A small RFC 4180 parser for previews: quoted fields, escaped quotes, CRLF, and comma/semicolon/tab delimiters. */

export interface ParsedTable {
  rows: string[][];
  delimiter: string;
  /** True when parsing stopped at `maxRows`. */
  truncated: boolean;
}

/** Picks the delimiter that splits the first lines most consistently. */
function sniffDelimiter(sample: string): string {
  const lines = sample.split(/\r?\n/).filter(Boolean).slice(0, 10);
  let best = ',';
  let bestScore = 0;
  for (const d of [',', ';', '\t', '|']) {
    const counts = lines.map((l) => l.split(d).length - 1);
    const min = Math.min(...counts);
    // Consistent, non-zero counts across lines beat a high count on one line.
    const score = min > 0 && counts.every((c) => c === counts[0]) ? min * 2 : min;
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

export function parseCsv(text: string, maxRows: number, delimiter?: string): ParsedTable {
  const d = delimiter ?? sniffDelimiter(text.slice(0, 8000));
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0; // skip a byte-order mark

  for (; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === '') {
      quoted = true;
    } else if (c === d) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (rows.length >= maxRows) return { rows, delimiter: d, truncated: i < text.length - 1 };
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return { rows, delimiter: d, truncated: false };
}
