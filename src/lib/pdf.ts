import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/**
 * PDF.js is large, so it is loaded on first use (opening or indexing a PDF)
 * instead of in the main bundle. Everything runs locally: the worker, fonts,
 * character maps and decoders are served by the app itself (see vite.config.ts).
 */

type PdfjsLib = typeof import('pdfjs-dist');

let libPromise: Promise<PdfjsLib> | null = null;

export function loadPdfjs(): Promise<PdfjsLib> {
  libPromise ??= import('pdfjs-dist').then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = workerUrl;
    // The viewer components read the library from this global.
    (globalThis as unknown as { pdfjsLib: PdfjsLib }).pdfjsLib = lib;
    return lib;
  });
  return libPromise;
}

/** The page viewer (text layer, find controller). Requires the library to be loaded first. */
export async function loadPdfViewer() {
  await loadPdfjs();
  return import('pdfjs-dist/web/pdf_viewer.mjs');
}

const asset = (folder: string) => new URL(`${import.meta.env.BASE_URL}pdfjs/${folder}/`, window.location.href).href;

/** Loading parameters shared by the viewer and the text indexer. */
export function pdfSource(data: Uint8Array) {
  return {
    data,
    cMapUrl: asset('cmaps'),
    cMapPacked: true,
    standardFontDataUrl: asset('standard_fonts'),
    wasmUrl: asset('wasm'),
    iccUrl: asset('iccs'),
    // Never run scripts embedded in a PDF.
    enableScripting: false,
  };
}

export interface PdfDigest {
  text: string;
  truncated: boolean;
  pageCount: number;
  thumbnail: Blob | null;
}

const THUMB_WIDTH = 360;

/**
 * Reads a PDF's text (for search) and renders a first-page thumbnail.
 * Stops collecting text after `maxChars` so huge filings stay manageable.
 */
export async function digestPdf(blob: Blob, maxChars: number): Promise<PdfDigest> {
  const lib = await loadPdfjs();
  const task = lib.getDocument(pdfSource(new Uint8Array(await blob.arrayBuffer())));
  // A password-protected PDF can't be indexed without the password; give up quietly.
  task.onPassword = () => void task.destroy();
  const doc = await task.promise;
  try {
    let thumbnail: Blob | null = null;
    try {
      const page = await doc.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: THUMB_WIDTH / base.width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvas, viewport }).promise;
      thumbnail = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
      page.cleanup();
    } catch {
      // A thumbnail is a nicety; text indexing continues without it.
    }

    const parts: string[] = [];
    let length = 0;
    let truncated = false;
    for (let n = 1; n <= doc.numPages; n++) {
      if (length >= maxChars) {
        truncated = true;
        break;
      }
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : ''))
        .join('')
        .replace(/[ \t]+/g, ' ');
      parts.push(text);
      length += text.length;
      page.cleanup();
    }
    let text = parts.join('\n\n');
    if (text.length > maxChars) {
      text = text.slice(0, maxChars);
      truncated = true;
    }
    return { text, truncated, pageCount: doc.numPages, thumbnail };
  } finally {
    // Destroying the loading task releases the document and its worker.
    void task.destroy();
  }
}
