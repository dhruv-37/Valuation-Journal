// Runs inside the app page (dev server). Builds clean demo content through the app's own repository.
const R = await import('/src/db/repository.ts');
const { db } = await import('/src/db/database.ts');
const { getActiveJournalId, setActiveJournal } = await import('/src/lib/activeJournal.ts');
const { queueDocumentProcessing } = await import('/src/lib/documentProcessing.ts');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (let i = 0; i < 50 && !document.querySelector('header'); i++) await sleep(100);
const jid = getActiveJournalId();
if ((await db.journals.count()) > 1) return 'already set up';
await R.updateJournal(jid, { name: 'DCF Valuation Playbook', description: 'The full DCF process, with research files' });
const phases = await db.phases.where('journalId').equals(jid).sortBy('order');

// Checklist progress along the pathway.
const plan = [6, 6, 6, 4, 3, 1, 4, 1];
for (let i = 0; i < plan.length; i++) {
  const tasks = await db.checklist.where('phaseId').equals(phases[i].id).sortBy('order');
  for (const t of tasks.slice(0, plan[i])) await R.setTaskDone(t.id, true);
}

// Snapshots: simple charts drawn on a canvas.
async function chart(title, labels, values, { color = '#a8822f', suffix = '' } = {}) {
  const c = document.createElement('canvas');
  c.width = 1200; c.height = 720;
  const g = c.getContext('2d');
  g.fillStyle = '#fffefb'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#1f1e1b'; g.font = '600 38px Georgia'; g.fillText(title, 60, 80);
  const max = Math.max(...values) * 1.15, left = 90, base = 620, w = 1040, bw = w / values.length;
  g.strokeStyle = '#e4dfd4'; g.lineWidth = 2;
  for (let k = 0; k <= 4; k++) { const y = base - (k / 4) * 470; g.beginPath(); g.moveTo(left, y); g.lineTo(left + w, y); g.stroke(); }
  values.forEach((v, k) => {
    const h = (v / max) * 470, x = left + k * bw + bw * 0.2;
    g.fillStyle = k === values.length - 1 ? '#1f1e1b' : color; g.fillRect(x, base - h, bw * 0.6, h);
    g.fillStyle = '#4a4741'; g.font = '26px Arial'; g.textAlign = 'center';
    g.fillText(labels[k], x + bw * 0.3, base + 40); g.fillText(v + suffix, x + bw * 0.3, base - h - 14);
    g.textAlign = 'left';
  });
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  return new File([blob], title.toLowerCase().replace(/\W+/g, '-') + '.png', { type: 'image/png' });
}
const wacc = phases[6].id, fcf = phases[7].id, tv = phases[8].id, hist = phases[2].id;
const cards = await db.cards.where('phaseId').equals(wacc).toArray();
const waccCard = cards.find((c) => /weighted average/i.test(c.title));
const s1 = await R.addSnapshot(wacc, await chart('Peer levered betas', ['Trent', 'DMart', 'V-Mart', 'Shoppers', 'Median'], [1.12, 0.94, 1.31, 1.05, 1.09]), { title: 'Peer levered betas', cardIds: waccCard ? [waccCard.id] : [] });
await R.addSnapshot(wacc, await chart('WACC build-up (%)', ['Rf', 'ERP x β', 'Ke', 'Kd (post-tax)', 'WACC'], [7.0, 6.3, 13.3, 6.1, 12.2], { color: '#4f6d8a' }), { title: 'WACC build-up' });
await R.addSnapshot(hist, await chart('Revenue growth (%)', ['FY21', 'FY22', 'FY23', 'FY24', 'FY25'], [-8, 66, 48, 50, 39], { color: '#5e7a5a' }), { title: 'Five-year revenue growth' });
await R.addSnapshot(tv, await chart('Terminal value share of EV (%)', ['g 4%', 'g 5%', 'g 6%', 'g 7%'], [58, 63, 69, 76]), { title: 'Terminal value as share of EV' });
await R.updateSnapshot(s1.id, { title: 'Peer levered betas', description: 'Bloomberg 2-year weekly betas against the Nifty 50.', caption: 'Peer median levered beta ≈ 1.09', tags: ['beta', 'peers'], pinned: true, cardIds: waccCard ? [waccCard.id] : [] });

// Documents: a generated PDF, a CSV, Markdown notes and an Excel model.
function pdf(lines) {
  const content = 'BT /F1 22 Tf 72 720 Td 30 TL ' + lines.map((l, i) => (i === 0 ? '' : 'T* ') + `(${l}) Tj`).join(' ') + ' ET';
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>', `<< /Length ${content.length} >>\nstream\n${content}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let out = '%PDF-1.4\n'; const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length;
  return out + `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
}
const docs = [
  [new File([pdf(['Cost of capital: research notes', '', 'Risk-free rate: 10-year G-Sec yield, 7.0%.', 'Equity risk premium: implied ERP for India, 6.0%.', 'Unlevered beta from peers, relevered at target D/E.', 'Cost of debt: yield on comparable AA bonds.', 'Target weights: market values, not book values.'])], 'Cost of capital notes.pdf', { type: 'application/pdf' }), wacc],
  [new File(['Company,Levered beta,D/E,Tax rate\nTrent,1.12,0.05,25%\nDMart,0.94,0.02,25%\nV-Mart,1.31,0.18,25%\nShoppers Stop,1.05,0.40,25%\n'], 'peer-betas.csv', { type: 'text/csv' }), wacc],
  [new File(['# Valuation memo\n\n## Thesis\nStore expansion and Zudio economics drive growth.\n\n## Key risks\n- Same-store growth slowing\n- Rent inflation\n'], 'Valuation memo.md', { type: 'text/markdown' }), phases[12].id],
  [new File([new Uint8Array([80, 75, 3, 4, 20, 0, 0, 0])], 'DCF model v4.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), phases[7].id],
];
for (const [file, phaseId] of docs) {
  const d = await R.addDocument(file, { phaseId });
  if (d.textStatus === 'pending') queueDocumentProcessing(d.id);
}

// Extracts.
await R.createExtract(wacc, { kind: 'sentence', title: 'Use market-value weights', text: 'The weights used in the cost of capital should be market values, since the cost of capital measures the cost of raising funds today.', sourceDocument: 'Damodaran, Investment Valuation', location: 'Ch. 8', tags: ['wacc', 'weights'], pinned: true });
await R.createExtract(tv, { kind: 'lesson', title: 'Growth cannot outrun the economy', text: 'A stable growth rate above the nominal growth rate of the economy implies the firm eventually becomes larger than the economy.', sourceDocument: 'Investment Valuation', location: 'Ch. 12', tags: ['terminal-value'], pinned: false });

// Recall: pinned cards plus a few more, some already reviewed.
const allCards = await db.cards.where('phaseId').anyOf(phases.map((p) => p.id)).toArray();
const chosen = allCards.filter((c) => c.pinned || c.type === 'formula' || c.type === 'warning').slice(0, 14);
await R.addToRecall('card', chosen.map((c) => c.id));
const extractIds = (await db.extracts.where('phaseId').anyOf(phases.map((p) => p.id)).toArray()).map((e) => e.id);
await R.addToRecall('extract', extractIds);
const revs = await db.revisions.where('journalId').equals(jid).toArray();
for (const r of revs.slice(0, 5)) await R.reviewRevision(r.id, 'remembered');
await R.reviewRevision(revs[5].id, 'needs-revision');

await R.setLastVisitedPhase(wacc);
await R.createJournal({ name: 'Trent Limited Valuation', description: 'FY26 DCF for Trent Ltd' }, { kind: 'dcf' });
await R.createJournal({ name: 'Cost of Capital Reference', description: 'WACC inputs and their sources' }, { kind: 'empty' });
await setActiveJournal(jid);
await sleep(3000); // background indexing and thumbnails
return 'ok';
