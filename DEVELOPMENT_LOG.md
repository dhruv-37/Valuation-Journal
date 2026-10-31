# Development Log

Newest entries go at the bottom. Each milestone entry records:
- what was built
- the decisions and why they were made
- the bugs found and how they were fixed
- how the work was verified

Git was initialised after Milestone 3. Before that, this log is the only change history.

---

## 2026-10-31: Milestone 1, Core workspace

**Built:**
- A project scaffold: Vite + React + TS + Tailwind 4 + Motion + Lucide + Dexie.
- A 13-phase DCF pathway overview with zoom into each phase's workspace.
- Editable phases: add, rename, describe, edit objectives, reorder, delete.
- A checklist with starter tasks.
- Knowledge cards (8 types, tags, pin, source).
- Global search, light and dark themes, a mobile layout.

**Decisions**
- **Local-first with Dexie and IndexedDB, no backend.** The app is for one person, and IndexedDB stores blobs, which later milestones would need.
- **Seed in Dexie's `populate` event.** It runs exactly once, when the database is created, so user edits are never overwritten on later launches.
- **A repository layer for all writes, with `useLiveQuery` for reads.** The UI stays reactive without a state library, and cascades sit in one place inside transactions.
- **Hash routing instead of a router library.** There are only two routes; the back button and refresh still work.
- **Zoom transition:**
  - A `clip-path` expands from the clicked card's rect, instead of a shared-layout animation.
  - It's robust to scrolling and doesn't need both views mounted.
- **Room for growth:**
  - A `journals` table and `journalId` field exist from v1, so multiple journals won't need a reshape.
  - The `attachments` table is generic (`ownerType`, `ownerId`, `kind`).
- **Design:** warm, minimal palette with gold accents. Newsreader for display text, Inter for UI, JetBrains Mono for formulas. Colours are CSS-variable tokens, so dark mode is a variable swap.

**Bugs fixed**
- **Adding a phase did nothing.**
  - Cause: `onCreated?.(await createPhase(values))` skips evaluating its argument when `onCreated` is undefined.
  - Fix: call `await createPhase(values)` on its own line.
- **The pathway crashed after adding a phase.**
  - Cause: `nodeRefs.current.map` skips holes in a sparse ref array.
  - Fix: use `Array.from`, and draw connector segments only when the measured boxes match the phase count.
- **The closing zoom animation was misaligned.**
  - Cause: the browser restored scroll position on back.
  - Fix: `history.scrollRestoration = 'manual'`.
- **Cards overlapped and the filter pill was misplaced during slide-in.**
  - Cause: `layout` and `layoutId` measured while the parent was transforming.
  - Fix: removed them from the journal and checklist lists.
- **A dialog reopened during its exit animation revived the old form state.**
  - Fix: the Modal's per-opening session key, plus a ref callback so the old panel can't clear the new ref.
- **Horizontal overflow at mobile width with long phase names.**
  - Fix: the prev/next links use `grid-cols-1` and `min-w-0`; the layer uses `overflow-x-hidden`.

**Verified:** in the in-app browser:
- Every phase, task and card flow; search; themes; 375 px layout; reload persistence.
- The production build.

---

## 2026-10-31: Milestone 2, Visual Knowledge Library

**Built:**
- A per-phase Library tab:
  - A Snapshot library with upload, paste and drag-drop; metadata, pin, delete; links to knowledge cards.
  - An image viewer with zoom, pan, fit, full screen, a filmstrip and an info panel.
  - Important extracts (6 kinds, with source, page and URL).
  - Filters by type, tag, importance and date.
- Search, overview and header stats extended to cover snapshots and extracts.

**Decisions**
- **Schema v2 adds two tables (`snapshots`, `extracts`)** and leaves the v1 tables untouched, so no upgrade function is needed and existing data migrates in place.
- **Full-size images go in `attachments` (ownerType `'snapshot'`).** The snapshot record keeps only metadata and a ≤ 720 px WebP thumbnail (JPEG fallback), so gallery queries never load full images.
- **Image decoding and thumbnailing run outside the Dexie transaction.** IndexedDB transactions auto-commit across non-IDB awaits. The attachment and snapshot are then written in one transaction.
- **A refcounted object-URL cache (`useBlobUrl`)** shares URLs between gallery, viewer and card thumbnails, and revokes each 1.5 s after its last user is gone. The delay avoids flicker when switching views.
- **A shared overlay stack.** The viewer joined the Modal dialog stack so Esc and arrow keys go only to the topmost overlay, for example the snapshot editor opened from the viewer.
- **Paste routing at phase level:**
  - An image on the clipboard becomes a snapshot immediately.
  - Text pasted outside a text field opens a pre-filled extract with a guessed kind.
  - This keeps capture to as few clicks as possible.
- **Card links are stored on the snapshot (`cardIds` multi-entry index)**, so a card's linked images come from one indexed query. Deleting a card unlinks it but keeps the snapshot.
- **Extract URLs are normalised.** Only `http(s)` URLs are rendered as links.

**Bugs fixed:**
- **Viewer full screen failed silently.**
  - It now shows a toast when the request is rejected.
- **A Python inline edit script failed to match Unicode text in `seed.ts`.**
  - Not a bug in the app.
  - Switched to the Edit tool for Unicode content.

**Verified:**
- **Migration:** a real v1 database, with user edits, upgraded to v2 with all data intact and no re-seed.
- **Library flows:** all snapshot and extract flows, the filters, search jump-to-item, and card linking.
- **Memory:** live object URLs return to 0 after leaving a phase.
- **Fresh install:** seeds 13 phases, 78 tasks, 37 cards and 2 extracts. The test browser was left in this fresh-seed state.
- **Build:** clean, with JS ≈ 614 kB.

**Not verified:**
- Full screen: the in-app pane denies the permission.
- Touch gestures on a real device.

**Testing caveat:** when the in-app browser pane is hidden, `requestAnimationFrame` pauses. Exit animations freeze and screenshots go stale. This is an environment quirk, not an app bug.

---

## 2026-10-31: Project documentation

- Added `CLAUDE.md` (permanent instructions and conventions), `PROJECT_CONTEXT.md` (current state) and this log.
- No application code or data changed.
- Milestone 3 has not been chosen; candidates are listed in PROJECT_CONTEXT.md §9.

---

## 2026-10-31: Milestone 3, Document Management

**Built:**
- Document attachments per phase: PDF, Excel, CSV/TSV, Word, PowerPoint, TXT, Markdown and images, by upload, drag-and-drop and file paste. Each has a title, description, tags, a filed-in phase, and connections to other phases, cards, extracts and snapshots.
- An embedded PDF.js viewer: pages, zoom, fit width/page, full screen, selectable text, find with highlights, password prompt, error state.
- Previews for images, TXT, Markdown and CSV; an honest download panel for Office files.
- A central Document Library page (`#/documents`, in the main navigation), grouped by phase, with search inside file text, filters, sorting and a storage panel.
- A Documents tab in each phase; document chips and "connect documents" dialogs on cards, extracts and snapshots; documents in global search.
- Schema v3 (`documents`, `documentTexts`).

**Decisions**
- **PDF.js (`pdfjs-dist` 6.4.299) is the one new dependency**, as requested; nothing else covers rendering, text layers and find. It is pinned to an exact version because its runtime assets are copied to match. It loads on demand, so the main bundle grew only from ≈ 614 kB to ≈ 693 kB.
- **The component viewer (`PDFViewer` + `PDFFindController`) instead of hand-rendering canvases.** It renders pages lazily (important for long filings) and brings the text layer and find-with-highlights. It needs `globalThis.pdfjsLib` set before `pdf_viewer.mjs` is imported, which `lib/pdf.ts` does.
- **PDF.js runtime assets are served locally** by a ~30-line Vite plugin (`scripts/vite-pdfjs-assets.mjs`), not copied into `public/`, so they always match the installed version and nothing is fetched from a CDN. It is plain JS with a `.d.mts` so `tsc` needs no `@types/node`.
- **Documents get their own table; files reuse `attachments`** (`ownerType 'document'`), mirroring snapshots, so library queries never load files.
- **Document attachments use `phaseId: ''`** so the existing phase-delete cascade can't touch them. **Deleting a phase unfiles its documents instead of deleting them**: research files are the costliest thing to lose, and the Document Library is their real home. The confirm dialogs say so.
- **Connections are stored on the document** (`linkedPhaseIds`, `cardIds`, `extractIds`, `snapshotIds`, all multi-entry indexes), like `snapshot.cardIds`. Each item's documents come from one indexed query, and `setItemDocuments` edits links from the item's side in one transaction.
- **Searchable text lives in `documentTexts`**, not on the document, and is built in a background queue after saving (one document at a time; `pending` work resumes on next launch). Capped at 750,000 characters per file. Saving is never blocked by parsing.
- **No previews for Office files.** Rendering `.docx/.xlsx/.pptx` faithfully needs large libraries or a cloud viewer; a half-right preview would mislead. The panel says this and offers the download.
- **Markdown is parsed into data and rendered as React elements** (never `innerHTML`), with only `http(s)` links clickable. CSV gets a small RFC 4180 parser with delimiter sniffing.
- **Downloads go through the `useBlobUrl` cache** (`downloadBlob`), keeping the "no ad hoc `createObjectURL`" rule.
- **Drop and paste routing:** on the Documents tab every file is a document; elsewhere images stay snapshots, as before, and other files become documents. Existing capture habits keep working.
- **Storage limits:** 200 MB per file, a pre-check against `navigator.storage.estimate()`, quota errors reported per file, and a "Saving…" notice above 25 MB. The library offers `navigator.storage.persist()` and states plainly that files live only in this browser.
- **Routing:** the page beneath a phase is the last full page visited, so phases opened from the Document Library return there.

**Bugs found and fixed:**
- **`pdf_viewer.css` set `:root { color-scheme: light dark }`**, which would have flipped scrollbars and form controls to the OS theme once a PDF was opened.
  - Fix: `:root:not(.dark)` / `:root.dark` rules in `index.css` (higher specificity).
- **"Fit width" didn't refit when the window or panel changed size.** The embeddable `PDFViewer` only tracks container height; the full PDF.js app re-applies presets itself.
  - Fix: a width `ResizeObserver` in `PdfViewer` re-assigns the current preset.
- **Viewer Edit/Delete buttons showed on phones.** `hidden sm:inline-flex` lost to `IconButton`'s `inline-flex`.
  - Fix: `max-sm:hidden`. The image viewer from Milestone 2 has the same pattern and still shows its Pin/Edit buttons on phones; that was left unchanged and is noted in PROJECT_CONTEXT.md.
- **Markdown links stopped at the first `)`**, leaving a stray bracket and breaking URLs like `…/Cost_(economics)`.
  - Fix: allow one level of balanced parentheses.
- **The info panel showed "PDF · PDF".**
  - Fix: `formatLabel` drops the badge when it repeats the kind.
- **Closing a phase opened from a link went to the overview even when the Document Library was underneath.**
  - Fix: `router.toOverview(fallback)` with the base page.
- **`abortSignal` is supported by `PDFViewer` but missing from its types.**
  - Fix: a commented type assertion.

**Verified** (in the in-app browser; details in PROJECT_CONTEXT.md §6):
- **Migration:** a genuine v2 database with user data (edited card, ticked task, extra extract, snapshot with image), built from a non-app page with only the v1+v2 schema, upgraded to v3 intact with no re-seed.
- **Upload:** all formats; rejection of unsupported and > 200 MB files; a 30 MB file (notice, truncated index, 5 MB preview cap).
- **PDF:** viewing, page navigation, zoom, fit, find (count, highlight, page jump), mouse text selection, refit on resize, damaged-PDF error state, local asset serving.
- **Previews and downloads:** every preview type; downloads byte-identical with original names.
- **Search:** library search inside file text; global search opening the PDF at the match.
- **Connections:** both directions; jump-to-item; overlay stacking.
- **Deletion:** card, extract, phase (unfiles) and document cascades.
- **Persistence and resume:** persistence across reloads; resume of pending indexing.
- **Layout:** 375 px layout; light theme.
- **Regression:** Milestone 1/2 flows (zoom, checklist, search jump, paste to extract and snapshot, image viewer).
- **Build:** clean.

**Not verified:**
- Full screen (the pane rejects it; the toast appears).
- A real file chooser and a real saved download (the same handlers were driven programmatically).
- Real Office files, password-protected PDFs, scanned PDFs needing the wasm decoders, and large real filings.
- The production build in a browser.
- Touch devices.

**Test browser state:** the in-app browser's database now holds the migrated v2 test data plus the test documents (about 10, mostly in phase 07 WACC, one unfiled), not a fresh seed. The user's own data in other browsers was not touched.

---

## 2026-10-31: Documentation review after Milestone 3

No application code, schema or data changed. The in-app browser's test database was not touched.

**Checked against the code:**
- Schema: `src/db/database.ts` has versions 1–3 exactly as PROJECT_CONTEXT.md §5 describes. v3 adds `documents` and `documentTexts` with no `.upgrade()`; the seed still runs only in `populate`.
- Files: every file in `src/components/documents/` (13 + 6 previews), `src/lib/` and `scripts/` is listed. `BrandMark`, `ThemeToggle`, `main.tsx`, `App.tsx`, `index.css` and `vite.config.ts` were missing from the key-files table and were added.
- Repository writes (`addDocument`, `updateDocument`, `deleteDocument`, `saveDocumentDigest`, `setItemDocuments`) and document hooks match the docs.
- Limits in `lib/documents.ts` (200 MB, 25 MB notice, 750,000 indexed characters, 5 MB text preview), the 2,000-row CSV cap and the 1.5 s object-URL release delay match.
- Overlay layers (image viewer z 45, document viewer z 46, dialogs z 50), `basePage` routing and the resume of `pending` indexing match.
- Dependencies: `pdfjs-dist` 6.4.299 (pinned) is the only addition since Milestone 2.

**Build:** `npm run build` re-run and clean. Sizes match the recorded figures (main JS 692.66 kB, PDF.js 430.16 kB, `pdf_viewer` 169.39 kB, worker 1,264.34 kB, viewer CSS 230.01 kB).

**Docs changed:**
- PROJECT_CONTEXT.md: a "Resuming work" section (§0); fuller build figures in §2; missing files in §7; a new limitation in §8 (`quickjs-eval.wasm` is copied into `dist/pdfjs/wasm/` but never loaded, since `enableScripting: false`); the outstanding Milestone 3 browser checks listed as a next step in §9.

**State for the next session:** Milestone 3 is complete. Milestone 4 is not chosen; see PROJECT_CONTEXT.md §9. No git repository, so no checkpoint commit was made.

---

## 2026-10-31: Git initialised

- `git init -b main` with the existing `.gitignore` (`node_modules`, `dist`, logs). No remote.
- The first commit is the Milestone 3 checkpoint: all source, config, `.claude/launch.json` and docs (96 files).
- CLAUDE.md now asks for a checkpoint commit at the end of each milestone.
- No application code or data changed.

---

## 2026-10-31: Milestone 4, Recall & Revision

The user asked for Milestones 4–6 in one brief (Recall; multiple journals, templates and ZIP backups; refinement), to be done in order with docs and a checkpoint commit after each. This entry covers Milestone 4 only.

**Built:**
- Revision cards made from knowledge cards and extracts (brain toggle on each item, or the bulk "Add cards" dialog).
- A Recall dashboard (`#/recall`, in the main navigation with a due badge): totals, remembered, needs revision, due now, progress by phase, filters (status, phase, type, pinned, text), session size, revise due / pinned / shown.
- A distraction-free session overlay: question first, reveal, Needs revision / Remembered with the next interval shown, previous/next, a summary with "revise the missed ones again", keyboard first.
- Schema v4: `revisions` and `reviewLog`.

**Decisions**
- **Link, don't copy.** A revision card stores `sourceType + sourceId`, an optional question and the schedule. The prompt and answer are derived from the live card or extract, so edits flow through and no content is duplicated. A unique compound index `&[sourceType+sourceId]` makes a second revision card for the same source impossible; `addToRecall` also skips existing ones.
- **A Leitner ladder instead of SM-2.** The user asked for something simple and understandable: Remembered climbs 1 → 3 → 7 → 14 → 30 → 60 → 120 days; Needs revision resets to the bottom and returns in 10 minutes. The page explains this in one sentence. New cards are always due.
- **Each review is logged with the schedule it replaced.** That gives the revision history the backup must carry, and exact undo: re-rating a card in the same session undoes the earlier rating first, so going back and changing your mind never double-counts.
- **`journalId` on revision records** (taken from the source's phase), so Milestone 5 can scope Recall per journal without a migration.
- **Cascades:** deleting a card, extract or phase removes the matching revision cards and logs in the same transaction.
- **The session lives in `App`**, as the document viewer lives in `DocumentsProvider`, so it sits above any page and "Open in the journal" can navigate (the phase's back button then reads "Recall").

**Bugs found and fixed:**
- **"Due now 0" right after adding cards.** The page's clock was a moment older than the new cards' `dueAt`. Fix: new cards count as due regardless of time (`isDue`).
- **Interval labels read "next in tomorrow" and "next in 24 h".** Fix: `intervalLabel` formats days directly; `relativeDue` switches to days when the hours round to 24.
- **A long inline shell heredoc failed to parse** when updating these docs (tooling, not the app). The edit script was moved to a file.

**Verified** (in-app browser; details in PROJECT_CONTEXT.md §6): v3 → v4 migration on the existing test database with all counts intact; bulk add with filters; a keyboard-driven session including re-rating; dashboard counts and the nav badge; badges and toggles in a phase; the delete cascade; "Open in the journal" and the back label; 375 px layout; no console errors; build clean (main JS ≈ 735 kB).

**Not verified:** visual screenshots of the session animations (the pane was hidden, which pauses animation frames).

**Test browser state:** the in-app database is now at version 40, with 8 revision cards and 2 review-log entries added to the Milestone 3 test data. The card "Illustrative WACC" in phase 07 was deleted during the cascade test.

---

## 2026-10-31: Milestone 5, Multiple journals, templates and backups

**Built:**
- Multiple independent journals: a switcher in every page header; create (DCF template, copy of an existing journal, empty), rename, duplicate, delete, switch; the open journal is remembered.
- Every query scoped to the open journal: overview stats and Resume, Document Library, Recall and its badge, search (including text inside files), tag suggestions and all pickers.
- ZIP backup of any set of journals (records, original files, thumbnails, links, Recall history and schedules) and restore with validation, a per-journal choice (new / replace / skip), confirmation before replacing, a storage check and progress.
- A shared `AppHeader`; the journal name in the overview eyebrow and phase breadcrumb; an empty-journal message on the overview.

**Decisions**
- **No schema change.** `phases`, `documents`, `revisions` and `reviewLog` already carried an indexed `journalId`, and every other record belongs to a phase. Scoping reads through the journal's phase ids gives full isolation without migrating any user data. The alternative (adding `journalId` to every table with an upgrade) would have touched every record for no functional gain.
- **The active journal is a module store, not a route or context.** Repository writes need it synchronously (new phases, unfiled documents), as the router is used. It is persisted in `meta.activeJournalId`. `App` waits for it before rendering.
- **One bundle format for copy, export and import.** `db/bundle.ts` reads a whole journal in one transaction (`collectJournal`), and `remapBundle` gives every record a new id and rewrites every reference. Duplicating is collect → remap → write; restoring is parse → remap → write. Because ids are always regenerated, a copy or restore can never collide with or share a record with an existing journal, and restoring twice simply makes two journals. References to missing records are dropped and dependent records left out and counted, so a damaged backup can't create broken references.
- **Replace keeps the journal id** and deletes and writes in one transaction, after a danger confirmation that names the journal.
- **A small ZIP module instead of JSZip.** The user suggested JSZip; CLAUDE.md asks to avoid new dependencies unless clearly necessary, and JSZip holds whole archives in memory, which matters with 200 MB PDFs. `lib/zip.ts` (≈ 230 lines) builds the archive as a Blob from parts (files are stored, never copied into JS memory; JSON is deflated with the built-in `CompressionStream`), streams CRC-32, and reads by slicing the File with size and CRC checks, inflating with `DecompressionStream`. It was cross-checked against Python's `zipfile` in both directions. Trade-off: no ZIP64 (4 GB limit), refused with a clear message.
- **Validate everything before writing anything.** Restore reads the manifest and every `journal.json` (with CRC), type-checks each record, and confirms every referenced file exists, before showing choices. Files are then read and checksummed before the database transaction (IndexedDB transactions auto-commit across non-IDB awaits), so a bad file aborts that journal with nothing written.
- **The backup code is lazy-loaded**, keeping the main bundle at ≈ 758 kB (it reached 782 kB before).
- **Seed refactor:** `buildStarterJournal(journalId)` returns the starter records with fresh ids; `populate` and the DCF template both use it. The `populate` path is otherwise unchanged.
- **CLAUDE.md** now records the journal-scoping rule and where whole-journal operations live.

**Bugs found and fixed:**
- **The journal name ran under the navigation icons on phones.** A `<button>` with `display: flex` sized itself to its content instead of its shrinking container. Fix: `max-w-full` on the switcher button so the name truncates.
- **A failure message ended with "..".** The reason already ended with a full stop; it is trimmed now. (The first attempt at the fix, made with `sed`, lost the regex escape and would have removed any last character; caught on review and corrected.)
- **Empty journals said "0 phases from objective to conclusion".** Now: "This journal has no phases yet…".

**Verified** (details in PROJECT_CONTEXT.md §6): the existing database opened unchanged as the first journal; create from each template; isolation of every page and of search; duplicate with identical counts and bytes; an integrity script (every reference within its own journal, no shared ids, no orphans) at 0 problems after each operation; rename, delete of the open journal, reload persistence, per-journal Resume; export; ZIP format cross-checked with Node + Python; restore as new (files SHA-256-identical) and replace (marker gone); damaged, truncated, foreign, newer-format, invalid-JSON and missing-file archives refused with specific messages and nothing written; a fresh install followed by a full restore of 4 journals (PDF renders, Recall schedule intact); 375 px layout; a clean console; build clean.

**Not verified:** very large backups (hundreds of MB, near 4 GB), a real saved download and file chooser, restoring in a different browser.

**Test browser state:** the test database was deleted and recreated during the fresh-install test, then 4 journals were restored into it: "DCF Valuation" (fresh seed), "DCF Valuation (2)" (the old test data: 10 documents, 3 snapshots, 8 revision cards), "Trent Limited Valuation" (DCF template, one phase visited), "Fastenal Valuation" (copy of the old test data) and "Cost of Capital Reference" (1 phase, 1 TXT). The open journal is "Trent Limited Valuation". The `vj-test-stash` cache holds the 4-journal test backup.
