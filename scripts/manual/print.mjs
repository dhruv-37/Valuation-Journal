// Prints the HTML guide to PDF with headless Chrome.
// Usage: node scripts/manual/print.mjs <guide.html> docs/Valuation-Journal-User-Guide.pdf
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch, sleep } from './cdp.mjs';

const [input, output] = process.argv.slice(2);
const here = dirname(fileURLToPath(import.meta.url));
const b = await launch({ port: 9334, profile: join(tmpdir(), 'vj-manual-print-profile') });
await b.send('Page.enable');
await b.send('Page.navigate', { url: pathToFileURL(input).href });
await sleep(1500);
await b.evaluate('await document.fonts.ready; await Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })));');
const footer = `<div style="width:100%;font-family:Inter,Arial,sans-serif;font-size:7.5pt;color:#a39d92;padding:0 18mm;display:flex;justify-content:space-between"><span>Valuation Journal · User guide</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;
const { data } = await b.send('Page.printToPDF', {
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: footer,
  generateDocumentOutline: true,
  generateTaggedPDF: true,
});
writeFileSync(output, Buffer.from(data, 'base64'));
console.log('pdf bytes', Buffer.from(data, 'base64').length);
await b.close();
