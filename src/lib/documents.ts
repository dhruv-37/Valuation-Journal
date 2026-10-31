import { FileImage, FileSpreadsheet, FileText, FileType, Hash, Presentation, Sheet, type LucideIcon } from 'lucide-react';
import type { DocumentKind } from '../types';

/** Document intake: supported formats, how each is previewed, and size limits. */

/** How a format is shown in the viewer. Only formats the browser can render reliably get a preview. */
export type PreviewMode = 'pdf' | 'image' | 'text' | 'markdown' | 'csv' | 'none';

export interface DocumentKindMeta {
  label: string;
  icon: LucideIcon;
  text: string;
  soft: string;
  preview: PreviewMode;
  /** Whether text is read for search. */
  indexable: boolean;
  /** Application the file opens in after downloading (for non-previewable kinds). */
  opensIn?: string;
}

// Full class strings (not built dynamically) so Tailwind can detect them.
export const DOCUMENT_KIND_META: Record<DocumentKind, DocumentKindMeta> = {
  pdf: { label: 'PDF', icon: FileText, text: 'text-type-warning', soft: 'bg-type-warning/10', preview: 'pdf', indexable: true },
  spreadsheet: { label: 'Spreadsheet', icon: FileSpreadsheet, text: 'text-type-example', soft: 'bg-type-example/10', preview: 'none', indexable: false, opensIn: 'Excel' },
  csv: { label: 'CSV', icon: Sheet, text: 'text-type-example', soft: 'bg-type-example/10', preview: 'csv', indexable: true },
  word: { label: 'Word', icon: FileType, text: 'text-type-assumption', soft: 'bg-type-assumption/10', preview: 'none', indexable: false, opensIn: 'Word' },
  presentation: { label: 'PowerPoint', icon: Presentation, text: 'text-type-important', soft: 'bg-type-important/10', preview: 'none', indexable: false, opensIn: 'PowerPoint' },
  text: { label: 'Text', icon: FileText, text: 'text-type-concept', soft: 'bg-type-concept/10', preview: 'text', indexable: true },
  markdown: { label: 'Markdown', icon: Hash, text: 'text-type-decision', soft: 'bg-type-decision/10', preview: 'markdown', indexable: true },
  image: { label: 'Image', icon: FileImage, text: 'text-type-source', soft: 'bg-type-source/10', preview: 'image', indexable: false },
};

const EXTENSIONS: Record<string, { kind: DocumentKind; mime: string }> = {
  pdf: { kind: 'pdf', mime: 'application/pdf' },
  xlsx: { kind: 'spreadsheet', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  xlsm: { kind: 'spreadsheet', mime: 'application/vnd.ms-excel.sheet.macroEnabled.12' },
  xlsb: { kind: 'spreadsheet', mime: 'application/vnd.ms-excel.sheet.binary.macroEnabled.12' },
  xls: { kind: 'spreadsheet', mime: 'application/vnd.ms-excel' },
  csv: { kind: 'csv', mime: 'text/csv' },
  tsv: { kind: 'csv', mime: 'text/tab-separated-values' },
  docx: { kind: 'word', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  doc: { kind: 'word', mime: 'application/msword' },
  rtf: { kind: 'word', mime: 'application/rtf' },
  pptx: { kind: 'presentation', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  ppt: { kind: 'presentation', mime: 'application/vnd.ms-powerpoint' },
  txt: { kind: 'text', mime: 'text/plain' },
  md: { kind: 'markdown', mime: 'text/markdown' },
  markdown: { kind: 'markdown', mime: 'text/markdown' },
  png: { kind: 'image', mime: 'image/png' },
  jpg: { kind: 'image', mime: 'image/jpeg' },
  jpeg: { kind: 'image', mime: 'image/jpeg' },
  webp: { kind: 'image', mime: 'image/webp' },
  gif: { kind: 'image', mime: 'image/gif' },
};

export const DOCUMENT_ACCEPT = Object.keys(EXTENSIONS)
  .map((ext) => `.${ext}`)
  .join(',');

export const SUPPORTED_FORMATS_LABEL = 'PDF, Excel, CSV, Word, PowerPoint, TXT, Markdown and images';

/** Files larger than this are refused: IndexedDB copes, but previews and backups get unwieldy. */
export const MAX_DOCUMENT_BYTES = 200 * 1024 * 1024;
/** Above this a "saving…" notice is shown, since writing can take a few seconds. */
export const LARGE_DOCUMENT_BYTES = 25 * 1024 * 1024;
/** Searchable text kept per document (about 250 dense pages). */
export const MAX_INDEXED_CHARS = 750_000;
/** Text-like previews read at most this much, so a huge log file can't freeze the page. */
export const MAX_TEXT_PREVIEW_BYTES = 5 * 1024 * 1024;

export const extensionOf = (name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : '');

/** Classifies a file by extension first (MIME types from drag-and-drop are often blank or generic). */
export function detectDocument(file: File | Blob): { kind: DocumentKind; mimeType: string } | null {
  const name = 'name' in file ? file.name : '';
  const byExt = EXTENSIONS[extensionOf(name)];
  if (byExt) return { kind: byExt.kind, mimeType: file.type || byExt.mime };
  const byMime = Object.values(EXTENSIONS).find((e) => e.mime === file.type);
  return byMime ? { kind: byMime.kind, mimeType: file.type } : null;
}

export class DocumentError extends Error {}

/** "Damodaran beta notes" from "damodaran_beta-notes.pdf". */
export function defaultDocumentTitle(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Untitled document';
}

/** Upper-case file extension for badges ("XLSX"), falling back to the kind label. */
export function formatBadge(fileName: string, kind: DocumentKind): string {
  const ext = extensionOf(fileName);
  return ext && ext.length <= 5 ? ext.toUpperCase() : DOCUMENT_KIND_META[kind].label.toUpperCase();
}

/** "Word · DOCX", or just "PDF" when the kind and extension say the same thing. */
export function formatLabel(fileName: string, kind: DocumentKind): string {
  const label = DOCUMENT_KIND_META[kind].label;
  const badge = formatBadge(fileName, kind);
  return badge === label.toUpperCase() ? label : `${label} · ${badge}`;
}

export interface StorageInfo {
  usage: number;
  quota: number;
  persisted: boolean;
}

/** Browser storage usage for this site, when the browser reports it. */
export async function readStorageInfo(): Promise<StorageInfo | null> {
  if (!navigator.storage?.estimate) return null;
  try {
    const [{ usage = 0, quota = 0 }, persisted] = await Promise.all([
      navigator.storage.estimate(),
      navigator.storage.persisted?.() ?? Promise.resolve(false),
    ]);
    return { usage, quota, persisted };
  } catch {
    return null;
  }
}

export const isQuotaError = (error: unknown) =>
  error instanceof Error && /quota/i.test(`${error.name} ${error.message} ${(error as { inner?: Error }).inner?.name ?? ''}`);
