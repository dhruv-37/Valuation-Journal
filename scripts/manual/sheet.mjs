// Checking aid. Usage: node scripts/manual/sheet.mjs <pdf file> <out.png> [scale] [first] [last] [cols]
// Renders PDF pages with the project's PDF.js into one contact-sheet image.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './cdp.mjs';

const [url, out, scale = '0.45', first = '1', last = '999', cols = '4'] = process.argv.slice(2);
const here = dirname(fileURLToPath(import.meta.url));
const b = await launch({ port: 9335, profile: join(tmpdir(), 'vj-manual-sheet-profile') });
await b.send('Page.navigate', { url: 'http://localhost:5173/' });
await sleep(2000);
const result = await b.evaluate(`
  const pdfjs = await import('/node_modules/pdfjs-dist/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.mjs';
  const data = Uint8Array.from(atob(${JSON.stringify(readFileSync(url).toString('base64'))}), (c) => c.charCodeAt(0)); const doc = await pdfjs.getDocument({ data }).promise;
  const from = ${Number(first)}, to = Math.min(${Number(last)}, doc.numPages), cols = ${Number(cols)}, s = ${Number(scale)};
  const pages = [];
  for (let n = from; n <= to; n++) {
    const page = await doc.getPage(n);
    const vp = page.getViewport({ scale: s });
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    pages.push(c);
  }
  const w = pages[0].width, h = pages[0].height, gap = 16, rows = Math.ceil(pages.length / cols);
  const sheet = document.createElement('canvas');
  sheet.width = cols * (w + gap) + gap; sheet.height = rows * (h + gap + 18) + gap;
  const g = sheet.getContext('2d'); g.fillStyle = '#888'; g.fillRect(0, 0, sheet.width, sheet.height);
  pages.forEach((c, k) => { const x = gap + (k % cols) * (w + gap), y = gap + Math.floor(k / cols) * (h + gap + 18); g.drawImage(c, x, y + 18); g.fillStyle = '#fff'; g.font = '13px Arial'; g.fillText('p. ' + (from + k), x, y + 13); });
  return { pages: doc.numPages, png: sheet.toDataURL('image/png') };
`);
writeFileSync(out, Buffer.from(result.png.split(',')[1], 'base64'));
console.log('pages', result.pages);
await b.close();
