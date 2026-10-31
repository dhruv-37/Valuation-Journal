# User-guide generator

Regenerates the screenshots in `docs/images/` and `docs/Valuation-Journal-User-Guide.pdf` from `docs/USER_GUIDE.md`. Needs Node 24+, Python 3 and Google Chrome; no packages are installed. Each script starts its own headless Chrome with a throwaway profile in the temp folder, so your own journals are never touched.

With the dev server running (`npm run dev`), from the project root:

```bash
node scripts/manual/shoot.mjs docs/images
python -I scripts/manual/md2html.py docs/USER_GUIDE.md . guide.html
node scripts/manual/print.mjs guide.html docs/Valuation-Journal-User-Guide.pdf
```

- `shoot.mjs` builds demo content with `setup-demo.js` (through the app's own repository functions) on first run, then captures every screen at 1280 × 800, 2×. Pass shot names (e.g. `11-recall 12-recall-session`) to retake only those. Delete the `vj-manual-shoot-profile` temp folder to start from fresh demo data.
- `md2html.py` converts the guide (a plain Markdown subset) into print-ready HTML using the app's fonts and colours. Images on consecutive lines become one side-by-side figure.
- `print.mjs` prints that HTML to an A4 PDF with page numbers and bookmarks.
- `sheet.mjs <pdf> <out.png>` renders the PDF's pages into one contact-sheet image, for checking the layout.
- `guide.html` is an intermediate file; don't commit it.
