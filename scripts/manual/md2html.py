"""Converts docs/USER_GUIDE.md (a plain Markdown subset) into a print-ready HTML page.

Usage: python -I md2html.py <USER_GUIDE.md> <project root> <out.html>
Supports: headings, paragraphs, bullet and numbered lists (one nesting level),
tables, images on their own line (rendered as figures), --- rules, **bold**,
`code`, [links](url).
"""
import html
import re
import sys
from pathlib import Path

src, root, out = (Path(a).resolve() for a in sys.argv[1:4])
lines = src.read_text(encoding='utf-8').splitlines()
fonts = (root / 'node_modules' / '@fontsource-variable').as_uri()
images = (src.parent).as_uri()


def inline(text: str) -> str:
    text = html.escape(text, quote=False)
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
    text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', text)
    return text


body: list[str] = []
toc: list[tuple[str, str]] = []
i = 0
para: list[str] = []


def flush():
    global para
    if para:
        body.append(f'<p>{inline(" ".join(para))}</p>')
        para = []


while i < len(lines):
    line = lines[i]
    stripped = line.strip()
    if not stripped:
        flush(); i += 1; continue
    if stripped == '---':
        flush(); i += 1; continue
    m = re.match(r'^(#{1,4}) (.*)$', stripped)
    if m:
        flush()
        level, text = len(m.group(1)), m.group(2)
        if level == 1:
            i += 1; continue  # the cover page carries the title
        slug = re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
        if level == 2:
            toc.append((slug, text))
        body.append(f'<h{level} id="{slug}">{inline(text)}</h{level}>')
        i += 1; continue
    if stripped == '**Contents**':
        # Skip the Markdown contents list; the PDF has its own.
        i += 1
        while i < len(lines) and (not lines[i].strip() or re.match(r'^\d+\. ', lines[i].strip())):
            i += 1
        continue
    if re.match(r'^!\[([^\]]*)\]\(([^)]+)\)$', stripped):
        flush()
        # Images on consecutive lines share one figure, side by side.
        group = []
        while i < len(lines) and (m := re.match(r'^!\[([^\]]*)\]\(([^)]+)\)$', lines[i].strip())):
            group.append((m.group(1), m.group(2)))
            i += 1
        cells = ''.join(f'<div class="cell{" phone" if "mobile" in path else ""}"><img src="{images}/{path}" alt="{html.escape(alt)}"><figcaption>{inline(alt)}</figcaption></div>' for alt, path in group)
        body.append(f'<figure class="{"row" if len(group) > 1 else ""}">{cells}</figure>')
        continue
    if stripped.startswith('|'):
        flush()
        rows = []
        while i < len(lines) and lines[i].strip().startswith('|'):
            cells = [c.strip() for c in lines[i].strip().strip('|').split('|')]
            if not all(re.fullmatch(r':?-+:?', c) for c in cells):
                rows.append(cells)
            i += 1
        head, *rest = rows
        t = '<table><thead><tr>' + ''.join(f'<th>{inline(c)}</th>' for c in head) + '</tr></thead><tbody>'
        t += ''.join('<tr>' + ''.join(f'<td>{inline(c)}</td>' for c in r) + '</tr>' for r in rest)
        body.append(t + '</tbody></table>')
        continue
    m = re.match(r'^(\s*)([-*]|\d+\.) (.*)$', line)
    if m:
        flush()
        ordered = m.group(2)[0].isdigit()
        tag = 'ol' if ordered else 'ul'
        items: list[str] = []
        while i < len(lines):
            mm = re.match(r'^(\s*)([-*]|\d+\.) (.*)$', lines[i])
            if not mm:
                break
            if len(mm.group(1)) >= 2 and items:
                sub_tag = 'ol' if mm.group(2)[0].isdigit() else 'ul'
                subs = []
                while i < len(lines):
                    ms = re.match(r'^(\s{2,})([-*]|\d+\.) (.*)$', lines[i])
                    if not ms:
                        break
                    subs.append(f'<li>{inline(ms.group(3))}</li>')
                    i += 1
                items[-1] = items[-1].replace('</li>', f'<{sub_tag}>{"".join(subs)}</{sub_tag}></li>')
                continue
            items.append(f'<li>{inline(mm.group(3))}</li>')
            i += 1
        body.append(f'<{tag}>{"".join(items)}</{tag}>')
        continue
    para.append(stripped)
    i += 1
flush()

first_h2 = next(k for k, b in enumerate(body) if b.startswith('<h2'))
intro, body = body[:first_h2], body[first_h2:]
toc_html = ''.join(f'<li><a href="#{slug}">{inline(re.sub(r"^\d+\. ", "", text))}</a></li>' for slug, text in toc)

page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Valuation Journal: User Guide</title>
<style>
@font-face {{ font-family: 'Newsreader'; src: url('{fonts}/newsreader/files/newsreader-latin-wght-normal.woff2') format('woff2'); font-weight: 200 800; }}
@font-face {{ font-family: 'Inter'; src: url('{fonts}/inter/files/inter-latin-wght-normal.woff2') format('woff2'); font-weight: 100 900; }}
@font-face {{ font-family: 'JetBrains Mono'; src: url('{fonts}/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2') format('woff2'); font-weight: 100 800; }}
@page {{ size: A4; margin: 20mm 18mm 20mm 18mm; }}
@page :first {{ margin: 0; }}
:root {{ --canvas: #f6f4ef; --surface: #fffefb; --surface-2: #f1eee7; --line: #e4dfd4; --ink: #1f1e1b; --ink-2: #4a4741; --muted: #7a756c; --gold: #a8822f; --gold-soft: #f3ead6; }}
* {{ box-sizing: border-box; }}
html {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
body {{ margin: 0; font-family: 'Inter', system-ui, sans-serif; font-size: 10pt; line-height: 1.6; color: var(--ink-2); background: #fff; }}
.cover {{ height: 297mm; background: var(--canvas); padding: 34mm 22mm 24mm; display: flex; flex-direction: column; page-break-after: always; }}
.mark {{ width: 15mm; height: 15mm; border-radius: 3.5mm; background: var(--ink); display: flex; align-items: center; justify-content: center; }}
.eyebrow {{ margin-top: 22mm; font-size: 8.5pt; font-weight: 600; letter-spacing: .22em; text-transform: uppercase; color: var(--gold); }}
.cover h1 {{ font-family: 'Newsreader', Georgia, serif; font-weight: 500; font-size: 46pt; line-height: 1.02; letter-spacing: -0.015em; color: var(--ink); margin: 5mm 0 0; }}
.cover .lede {{ font-size: 12.5pt; max-width: 140mm; color: var(--muted); margin-top: 7mm; line-height: 1.55; }}
.cover img {{ margin-top: auto; width: 100%; border-radius: 3mm; border: 1px solid var(--line); box-shadow: 0 12px 40px -18px rgba(31,30,27,.35); }}
.cover .meta {{ margin-top: 8mm; font-size: 8.5pt; color: var(--muted); display: flex; justify-content: space-between; }}
.toc {{ page-break-after: always; }}
.toc h2 {{ margin-top: 0; break-before: auto; }}
.intro p {{ font-size: 11pt; line-height: 1.65; }}
.toc-title {{ margin-top: 9mm; font-size: 8pt; letter-spacing: .18em; text-transform: uppercase; color: var(--gold); }}
.toc ol {{ list-style: none; padding: 0; margin: 2mm 0 0; counter-reset: s; columns: 2; column-gap: 10mm; }}
.toc li {{ counter-increment: s; padding: 2.2mm 0; border-bottom: 1px solid var(--line); font-family: 'Newsreader', Georgia, serif; font-size: 12.5pt; color: var(--ink); break-inside: avoid; }}
.toc li::before {{ content: counter(s, decimal-leading-zero); color: var(--gold); font-family: 'Inter'; font-size: 9pt; margin-right: 5mm; }}
.toc a {{ color: inherit; text-decoration: none; }}
h2 {{ font-family: 'Newsreader', Georgia, serif; font-weight: 500; font-size: 24pt; line-height: 1.1; letter-spacing: -0.01em; color: var(--ink); margin: 0 0 4mm; padding-top: 2mm; break-before: page; break-after: avoid; }}
h2::after {{ content: ''; display: block; width: 14mm; height: 2px; background: var(--gold); margin-top: 4mm; }}
h3 {{ font-family: 'Inter'; font-size: 11.5pt; font-weight: 650; color: var(--ink); margin: 7mm 0 2mm; break-after: avoid; }}
p {{ margin: 0 0 3mm; orphans: 3; widows: 3; }}
strong {{ color: var(--ink); font-weight: 600; }}
a {{ color: var(--gold); text-decoration: none; }}
code {{ font-family: 'JetBrains Mono', monospace; font-size: 8.6pt; background: var(--surface-2); border: 1px solid var(--line); border-radius: 1.2mm; padding: 0 1.2mm; color: var(--ink); white-space: nowrap; }}
ul, ol {{ margin: 0 0 3.5mm; padding-left: 6mm; }}
li {{ margin: 1mm 0; }}
li::marker {{ color: var(--gold); }}
table {{ width: 100%; border-collapse: collapse; margin: 2mm 0 5mm; font-size: 9pt; break-inside: avoid; }}
th {{ text-align: left; font-size: 7.5pt; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); font-weight: 600; border-bottom: 1.5px solid var(--ink); padding: 2mm 3mm 2mm 0; }}
td {{ border-bottom: 1px solid var(--line); padding: 2.2mm 3mm 2.2mm 0; vertical-align: top; }}
td:first-child {{ width: 32%; }}
figure {{ margin: 4mm 0 6mm; break-inside: avoid; }}
figure img {{ width: 82%; margin: 0 auto; border-radius: 2mm; border: 1px solid var(--line); display: block; }}
figure.row {{ display: flex; gap: 6mm; align-items: flex-start; }}
figure.row .cell {{ flex: 1; }}
figure.row .cell.phone {{ flex: 0 0 25%; }}
figure.row img {{ width: 100%; }}
figcaption {{ font-size: 8.3pt; color: var(--muted); margin-top: 2mm; text-align: center; font-style: italic; }}
</style></head>
<body>
<section class="cover">
  <div class="mark"><svg viewBox="0 0 32 32" width="34" height="34"><path d="M8 9l8 14 8-14" fill="none" stroke="#a8822f" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
  <p class="eyebrow">Valuation Journal · User guide</p>
  <h1>Your personal DCF<br>research workspace</h1>
  <p class="lede">How to build a valuation phase by phase, keep your evidence and research files in one place, revise the ideas that matter, run several independent projects and keep them safely backed up.</p>
  <img src="{images}/images/01-overview.jpg" alt="">
  <div class="meta"><span>github.com/dhruv-37/Valuation-Journal</span><span>Edition 1 · October 2026</span></div>
</section>
<section class="toc"><h2>About this guide</h2><div class="intro">{''.join(intro)}</div><h3 class="toc-title">Contents</h3><ol>{toc_html}</ol></section>
<main>
{chr(10).join(body)}
</main>
</body></html>"""
out.write_text(page, encoding='utf-8')
print('written', out, len(body), 'blocks,', len(toc), 'sections')
