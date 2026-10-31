// Captures the user-guide screenshots with headless Chrome over the DevTools protocol.
// Usage: node scripts/manual/shoot.mjs docs/images [shot names…]  (dev server running on :5173)
// Uses a fresh browser profile in the temp folder, so it never touches your own journals.
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './cdp.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2];
mkdirSync(out, { recursive: true });
const b = await launch({ profile: join(tmpdir(), 'vj-manual-shoot-profile') });
const { send, evaluate, screenshot } = b;

const desktop = () => send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 2, mobile: false });
await desktop();
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'no-preference' }] });
await send('Page.enable');
await send('Page.navigate', { url: 'http://localhost:5173/#/' });
await sleep(2500);
await evaluate(`localStorage.setItem('vj-theme', 'light'); document.documentElement.classList.remove('dark');`);
console.log('setup:', await evaluate(readFileSync(join(here, 'setup-demo.js'), 'utf8')));

const key = (k, extra = '') => `window.dispatchEvent(new KeyboardEvent('keydown', { key: '${k}', bubbles: true ${extra} }));`;
const click = (selectorJs) => `const el = ${selectorJs}; if (!el) throw new Error('not found: ' + ${JSON.stringify(selectorJs)}); el.click();`;
const byText = (sel, re) => `[...document.querySelectorAll('${sel}')].find((e) => ${re}.test(e.innerText.trim()))`;
const reset = async (hash = '#/') => {
  await evaluate(`location.hash = '${hash}'; location.reload();`).catch(() => {});
  await sleep(2200);
};

const shots = [
  ['01-overview', async () => { await reset('#/'); }],
  ['02-journal-switcher', async () => { await evaluate(click(`document.querySelector('button[title="Switch journal"]')`)); await sleep(500); }],
  ['03-new-journal', async () => { await evaluate(click(byText('[role=menuitem]', '/New journal/'))); await sleep(800); }],
  ['04-phase-workspace', async () => { await reset('#/'); await evaluate(click(`document.querySelector('button[aria-label^="Open phase 7"]')`)); await sleep(1600); }],
  ['05-library', async () => {
    await evaluate(click(byText('[role=region] button, [role=region] [role=tab]', '/^Library/')));
    await sleep(800);
    await evaluate(`const r = document.querySelector('[role=region]'); const h = ${byText('[role=region] h2, [role=region] h3, [role=region] p', '/snapshot library/i')}; r.scrollTo(0, h.getBoundingClientRect().top + r.scrollTop - 180);`);
    await sleep(600);
  }],
  ['06-image-viewer', async () => {
    await evaluate(click(`[...document.querySelectorAll('[role=region] button')].find((b) => b.querySelector('img'))`));
    await sleep(1400);
  }],
  ['07-phase-documents', async () => {
    await reset('#/'); await evaluate(click(`document.querySelector('button[aria-label^="Open phase 7"]')`)); await sleep(1600);
    await evaluate(click(byText('[role=region] button, [role=region] [role=tab]', '/^Documents/')));
    await sleep(500);
    await evaluate(`const r = document.querySelector('[role=region]'); const t = ${byText('[role=region] button, [role=region] [role=tab]', '/^Documents/')}; r.scrollTo(0, t.getBoundingClientRect().top + r.scrollTop - 120);`);
    await sleep(600);
  }],
  ['08-document-library', async () => { await reset('#/documents'); }],
  ['09-pdf-viewer', async () => {
    await evaluate(click(`[...document.querySelectorAll('main article')].find((a) => /PDF/.test(a.innerText))?.querySelector('button')`));
    await sleep(3500);
  }],
  ['10-search', async () => {
    await reset('#/');
    await evaluate(key('k', ', ctrlKey: true')); await sleep(500);
    await evaluate(`const i = document.getElementById('search-input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'beta'); i.dispatchEvent(new Event('input', { bubbles: true }));`);
    await sleep(1200);
  }],
  ['11-recall', async () => { await reset('#/recall'); }],
  ['12-recall-session', async () => {
    await evaluate(click(byText('button', '/^Revise [0-9]+ due/')));
    await sleep(900);
    await evaluate(key(' ')); await sleep(800);
  }],
  ['13-add-to-recall', async () => { await reset('#/recall'); await evaluate(click(byText('button', '/^Add cards$/'))); await sleep(900); }],
  ['14-manage-journals', async () => {
    await reset('#/');
    await evaluate(click(`document.querySelector('button[title="Switch journal"]')`)); await sleep(400);
    await evaluate(click(byText('[role=menuitem]', '/Manage journals/'))); await sleep(1200);
  }],
  ['15-backup', async () => {
    await reset('#/');
    await evaluate(click(`document.querySelector('button[title="Switch journal"]')`)); await sleep(400);
    await evaluate(click(byText('[role=menuitem]', '/Backup/'))); await sleep(1500);
  }],
  ['16-restore', async () => {
    await evaluate(click(byText('[role=tab]', '/^Restore/'))); await sleep(600);
  }],
  ['17-dark-overview', async () => {
    await evaluate(`localStorage.setItem('vj-theme', 'dark');`);
    await reset('#/');
  }],
  ['18-mobile', async () => {
    await evaluate(`localStorage.setItem('vj-theme', 'light');`);
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await reset('#/');
  }],
];

const only = process.argv.slice(3);
for (const [name, action] of shots.filter(([n]) => only.length === 0 || only.includes(n))) {
  try {
    await action();
    await screenshot(join(out, `${name}.jpg`));
    console.log('shot', name);
  } catch (e) {
    console.log('FAILED', name, e.message);
  }
}
await desktop();
await b.close();
