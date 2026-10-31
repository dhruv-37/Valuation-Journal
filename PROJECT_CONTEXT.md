# Project Context: Valuation Journal

_Last updated: 2026-10-31, after the backup reminder (a small follow-up to Milestone 6). All six milestones are complete._

## 0. Resuming work (read this first)

- **Current state:** Milestones 1–6 and the backup reminder (§9 candidate 1) are complete and verified. No work is in progress and no change is half-finished.
- **Plan agreed with the user (2026-10-31):** Milestones 4 (Recall), 5 (journals and backups) and 6 (refinement) were done in order, each documented and committed.
- **Next:** nothing is scheduled. Candidates and outstanding manual checks are in §9; the user chooses.
- **Before starting a milestone:** read CLAUDE.md, this file and DEVELOPMENT_LOG.md; run `npm run build` to confirm a clean baseline.
- **Checkpoints:** git was initialised on 2026-10-31 (branch `main`). Since 2026-10-31 the remote `origin` is the **public** GitHub repository https://github.com/dhruv-37/Valuation-Journal; push only when the user asks. The first commit is the checkpoint after Milestone 3; everything before it is recorded only in DEVELOPMENT_LOG.md. End each milestone with a checkpoint commit after the docs are updated.
- **Test browser:** the in-app browser's database holds test data (see the end of DEVELOPMENT_LOG.md), not a fresh seed. The user's real data in their own browser has never been touched. A cache named `vj-test-stash` in the test browser holds a test backup ZIP. The dev server's port decides the origin and so the database: the backup reminder was tested on port 5174 (a separate small seeded database), not 5173.
- **Journals:** every query must be scoped to the active journal (see §4, "Journals"). This is the rule most likely to be broken by new code.

## 1. What it is

A personal, local-first workspace for learning and documenting the DCF valuation process.
- The overview shows the workflow as a connected pathway of phases.
- Opening a phase zooms into its workspace, which holds:
  - Objectives and a checklist
  - A knowledge journal (typed cards)
  - A library of image snapshots and text extracts
  - A Documents tab: the phase's research file (PDF, Office, CSV, text, Markdown, images)
- A central Document Library page lists every document, organised by phase.
- Recall turns cards and extracts into flashcards with spaced repetition.
- Several journals (research projects) can exist side by side, each fully separate; whole journals can be created from a template, duplicated, exported to a ZIP backup and restored.
- All data, images and documents included, lives in the browser's IndexedDB. There is no server, no account, no sync and no cloud viewer.

## 2. Status

| Milestone | Scope | Status |
| --- | --- | --- |
| 1: Core workspace | Pathway overview, zoom transition, editable phases, checklist, knowledge cards, seed, search, themes | Done; manually verified in the browser |
| 2: Visual Knowledge Library | Snapshot library, image viewer, important extracts, filters, schema v2 | Done; manually verified, including the v1 → v2 migration |
| 3: Document Management | Document attachments, PDF.js viewer, Document Library page, document ↔ knowledge connections, text search inside files, schema v3 | Done; manually verified, including the v2 → v3 migration (see §6) |
| 4: Recall & Revision | Revision cards linked to cards/extracts, Leitner-style scheduling, Recall dashboard (`#/recall`), session overlay, filters, schema v4 | Done; verified in the browser, including the v3 → v4 migration |
| 5: Journals, templates, backups | Journal switcher, create (DCF template / copy / empty), rename, duplicate, delete; query scoping per journal; ZIP backup and restore with validation; no schema change | Done; verified in the browser, including a restore onto a freshly created database |
| 6: Refinement and finalisation | Layout fixes at 1024 px and on phones, header and nav breakpoints, reduced-motion phase transition, Recall shortcut in the phase header, lazy-loaded pages, lazy thumbnails, plural labels, production build checked in a browser | Done; verified in the browser (dev and production build) |
| Follow-up: backup reminder | Export records a per-journal date in `meta`; the overview shows a quiet notice when the open journal was never exported (and holds files) or its last export is over 30 days old; no schema change | Done; verified in the browser (dev server) |

The production build (`npm run build`) is clean with no size warning (re-run 2026-10-31 after the backup reminder).
- Initial JS: the entry ≈ 419 kB (≈ 125 kB gzip) plus a shared vendor chunk ≈ 271 kB (≈ 90 kB gzip; Rolldown names it `types-*.js` after its first module) and a few small shared chunks. The main CSS is ≈ 71 kB.
- Loaded on first use: `DocumentLibraryPage` ≈ 10 kB, `RecallPage` ≈ 22 kB, `RecallSession` ≈ 12 kB, `BackupDialog` (with `lib/backup.ts` and `lib/zip.ts`) ≈ 25 kB, and PDF.js as before.
- PDF.js loads on demand in separate chunks: library ≈ 430 kB, `pdf_viewer` ≈ 169 kB, the app's `PdfViewer` component ≈ 11 kB, worker ≈ 1.26 MB, viewer CSS ≈ 230 kB.
- `dist/pdfjs/` holds the cmaps, standard fonts, wasm decoders (`openjpeg`, `jbig2`, `qcms`) and ICC profiles. It also holds `quickjs-eval.wasm` (≈ 469 kB), which the plugin copies with the rest of the `wasm` folder; the app never loads it because scripting is disabled.

There is no automated test suite.

## 3. Stack

| Concern | Choice |
| --- | --- |
| UI | React 19.3 (StrictMode), TypeScript 7.0 (strict, `noUnused*`) |
| Build | Vite 8.3 (Rolldown), `@vitejs/plugin-react` 6, plus the local plugin `scripts/vite-pdfjs-assets.mjs` |
| Styling | Tailwind 4.3 via `@tailwindcss/vite`; tokens in `src/index.css` (`@theme inline` + CSS variables, `.dark` class variant) |
| Motion | `motion` 14 (`motion/react`), wrapped in `MotionConfig reducedMotion="user"` |
| Icons | `lucide-react` 1.66 |
| Storage | `dexie` 4.4 + `dexie-react-hooks` (`useLiveQuery`) |
| PDF | `pdfjs-dist` 6.4.299 (exact version; added in Milestone 3, loaded only when a PDF is opened or indexed) |
| Fonts | `@fontsource-variable/inter`, `newsreader` (display), `jetbrains-mono` (formulas) |

Only one value is stored in localStorage: the theme preference (`vj-theme`), read by an inline script in `index.html` to avoid a flash.

## 4. Architecture

```
main.tsx       StrictMode > MotionConfig > ToastProvider > ConfirmProvider > App
App.tsx        active journal, phases + stats, hash route, global shortcuts (Ctrl/Cmd+K, /),
               JournalsProvider > DocumentsProvider > motion.div keyed by journal >
               [Overview | DocumentLibraryPage | RecallPage], AnimatePresence > PhaseLayer,
               phase dialogs, RecallSession, SearchPalette
```

- **Data flow:**
  - Components → `db/repository.ts` (all writes, using transactions for multi-table changes) → Dexie.
  - Reads use `useLiveQuery` hooks in `hooks/useJournalData.ts`, so the UI re-renders on any change.
- **Routing:** `#/` (overview), `#/documents` (Document Library), `#/recall` (Recall) and `#/phase/<id>`. This lives in `hooks/useHashRoute.ts`: `useSyncExternalStore`, a custom `vj:route` event, and `router.openPhase / switchPhase / toOverview(fallback) / toDocuments / toPathway`. `history.scrollRestoration = 'manual'`.
  - The page under an open phase is the last full page visited (`basePage` in `App`), so a phase opened from the Document Library closes back to it, and its back button reads "Documents".
  - `MainNav` (Pathway / Documents / Recall, with a due-count badge) sits in the page headers; the phase header has a Document Library icon.
- **Journals:** `lib/activeJournal.ts`, `hooks/useActiveJournal.ts`, `db/bundle.ts`, `components/journals/`.
  - **Active journal:** a module store (like the router) holding the id, persisted in `meta.activeJournalId` and loaded once at startup (falls back to `'default'`, then the oldest journal). `getActiveJournalId()` is read synchronously by repository writes; `useActiveJournalId()` / `useActiveJournal()` / `useJournals()` are the hooks. `App` renders nothing until it has loaded.
  - **Ownership and scoping:** phases carry `journalId`; checklists, cards, snapshots, extracts and phase-owned attachments belong to a journal through their phase; documents, revisions and review logs carry `journalId`; document files are found through their document. **Every read is scoped**: `journalPhaseIds(journalId)` + `where('phaseId').anyOf(...)` for phase-owned tables, `where('journalId')` for the rest (hooks in `useJournalData.ts`, `SearchPalette`, `CardPicker`, `DocumentEditorDialog`, `DocumentLinkDialog`, `AddToRecallDialog`). New phases and unfiled documents go into the active journal; filed documents into their phase's journal; revision cards into their source's journal.
  - **Per-journal meta:** `lastPhaseId:<journalId>` (the old shared `lastPhaseId` key is still read for the `'default'` journal) and `lastBackupAt:<journalId>` (epoch ms of the last export that included the journal; `lastBackupKey()` in `db/bundle.ts`). `lastBackupAt` is not part of a bundle, so copies and restored journals start without one; deleting a journal removes it, replacing a journal from a backup keeps it.
  - **Whole-journal operations** live in `db/bundle.ts` and are called only through `repository.ts`: `collectJournal` (one read transaction into a `JournalBundle`), `remapBundle` (new id for every record, every reference rewritten; references to missing records dropped; records that can't exist without them, e.g. a snapshot without its image, left out and counted), `writeBundle`, `deleteJournalRecords`, `countJournal`. `JOURNAL_TABLES` is the table list for their transactions.
  - **Repository:** `createJournal(input, {kind: 'dcf' | 'empty' | 'copy'})` (DCF uses `buildStarterJournal` from `seed.ts` with fresh ids; copy = collect → remap → write), `updateJournal`, `deleteJournal` (refuses the last journal), `importJournalBundle(bundle, {mode: 'new', name} | {mode: 'replace', journalId})` (replace deletes and writes in one transaction, keeping the journal id), `uniqueJournalName` ("Name (2)").
  - **UI:** `AppHeader` (shared by the three pages) holds `JournalSwitcher` (brand mark + journal name; popover joins `overlayStack`, arrow keys move between journals). `JournalsProvider` owns `JournalFormDialog` (new with template choice / rename), `ManageJournalsDialog` and the lazily loaded `BackupDialog`, and exposes `useJournalActions()` (`switchTo`, `create`, `rename`, `duplicate`, `remove`, `manage`, `backup`). Switching fades the page in (`motion.div` keyed by journal id). The phase breadcrumb shows the journal name.
- **Backups:** `lib/zip.ts` and `lib/backup.ts`.
  - **ZIP** (no dependency): files are *stored*, JSON is *deflated* with `CompressionStream('deflate-raw')`. The archive is a Blob assembled from parts, so files are never copied into JS memory; CRC-32 is computed by streaming. Reading uses only the central directory, returns entries as slices of the File, inflates with `DecompressionStream`, and checks size and CRC-32. No ZIP64 (4 GB / 65,535 entries), no encryption; both are refused with a message.
  - **Format v1:** `manifest.json` (`format: 'valuation-journal-backup'`, `version`, `schemaVersion` = Dexie `verno`, `createdAt`, journals with counts); `journals/<n>/journal.json` (the bundle; Blob fields replaced by `{"$file": path, "type"}`); `journals/<n>/files/<attachmentId>`; `journals/<n>/thumbs/s-<id>` and `d-<id>`.
  - **Backup reminder:** after a successful export, `ExportPanel` calls `recordBackupExport(ids)` (repository), which writes `lastBackupAt:<id>` for every exported journal (a failure there is ignored: the file is already saved). Restoring never writes it. `overview/BackupReminder.tsx` reads it through `useLastBackupAt()` and shows "Last backup N days ago · Back up now" when the last export is over 30 days old, or "No backup of this journal yet · Back up now" when there is none and the journal has documents or snapshots. The button calls `useJournalActions().backup()` (all journals ticked). `useNow` refreshes the age hourly and on focus.
  - **Restore:** `readBackup` validates (ZIP structure, manifest, format, version ≤ 1, each `journal.json` parses and passes CRC, every referenced file present) and type-checks every record (`sanitize`), counting malformed ones. A journal with a problem is marked and can't be selected; others still can. `loadBackupJournal` then reads every file with CRC verification *before* the database transaction (IndexedDB transactions can't wait on file reads), and `importJournalBundle` writes it with fresh ids. Replace needs a danger confirmation naming the journal; a storage pre-check compares the files' size with the free quota.
- **Recall:** `components/recall/`.
  - `RecallPage` (dashboard, filters, list) and `RecallSession` (full-window overlay at z 46 that joins `overlayStack`; rendered by `App`, so a session sits above any page and "Open in the journal" can navigate).
  - A revision card stores only the link (`sourceType`, `sourceId`), an optional question and the schedule. `useRecallItems()` joins each with its card or extract on every read, so edits show at once.
  - `lib/recall.ts` holds the schedule: `INTERVAL_DAYS = [1, 3, 7, 14, 30, 60, 120]`. Remembered climbs one step (the first Remembered after new or a lapse uses step 0, i.e. 1 day); Needs revision resets to step 0 and is due again in 10 minutes. New cards are always due. `MASTERED_LEVEL = 3` (14+ days) counts as "well known".
  - Each review writes a `reviewLog` entry holding the schedule before the review. Rating a card again in the same session undoes the earlier entry first (`undoReview`), so a card is never counted twice.
  - `KnowledgeCardView` and `ExtractView` show `RecallToggle` (hover toolbar) and `RecallBadge` ("In Recall · next in 3 days").
- **Zoom transition:** `workspace/PhaseLayer.tsx`. With the OS "reduce motion" setting on (`useReducedMotion()`), a 0.15 s cross-fade replaces it: `MotionConfig reducedMotion="user"` only disables transforms, and this transition animates `clip-path`.
  - The layer expands from the clicked phase card's rect using `clip-path`, and shrinks back to it on close (a fade when no card is on screen, e.g. from the Document Library).
  - It finds the card by `data-phase-card`.
  - `AnimatePresence custom={phaseId}` keeps the exit pointed at the right card.
- **Workspace:** `workspace/PhaseWorkspace.tsx`.
  - Tabs: `journal`, `library` and `documents`.
  - Owns the phase-level paste listener and the drop overlay. On the Documents tab every file becomes a document; elsewhere images become snapshots (Milestone 2 behaviour) and other supported files become documents. Pasted text still opens a new extract.
  - Also owns the hidden image input, the image viewer and the snapshot/extract editors, exposed through `library/LibraryContext.tsx`.
  - Search results and document connections open a phase with a `FocusTarget {phaseId, itemId, kind, nonce}` (`kind` includes `'document'`), which switches tab, scrolls and flashes the item.
- **Documents:** `components/documents/`.
  - `DocumentsProvider` (wraps the whole app) owns the document viewer, editor dialog, link dialog and hidden file input, and exposes `open / upload / pick / edit / remove / download / linkTo` through `DocumentsContext` (`useDocumentActions()`).
  - `addDocument` validates (format by extension, then MIME; ≤ 200 MB; free quota from `navigator.storage.estimate()`), then writes the attachment and document in one transaction.
  - `lib/documentProcessing.ts` then runs one document at a time in the background: PDF text and first-page thumbnail via PDF.js, text of TXT/MD/CSV, image thumbnails. Results go through `saveDocumentDigest`. Documents left `textStatus: 'pending'` (tab closed mid-way) are resumed on the next launch.
  - `DocumentViewer` is a full-window overlay (z 46, above the image viewer at 45, below dialogs at 50) that joins `overlayStack`. Previews: `PdfViewer` (lazy), `ImagePreview`, `TextPreview` (+ `MarkdownView`), `CsvPreview`, `NoPreview` (Office).
  - Previews are keyed by attachment id, not by Blob object, so live-query refreshes never reload a document.
- **PDF.js:** `lib/pdf.ts` loads `pdfjs-dist` on first use, sets the worker URL (`?url` import) and `globalThis.pdfjsLib` (which `pdf_viewer.mjs` requires), and passes local `cMapUrl`, `standardFontDataUrl`, `wasmUrl` and `iccUrl`. `enableScripting: false`.
  - `scripts/vite-pdfjs-assets.mjs` serves `node_modules/pdfjs-dist/{cmaps,standard_fonts,wasm,iccs}` at `/pdfjs/` in dev and emits them into `dist/pdfjs/` at build time.
  - `PdfViewer` uses the component `PDFViewer` + `PDFLinkService` + `PDFFindController` + `EventBus`. It re-applies "Fit width/page/auto" on container resize itself (the embeddable viewer doesn't).
  - `pdf_viewer.css` sets `:root { color-scheme: light dark }`. `index.css` overrides this with `:root:not(.dark)` / `:root.dark` so the app theme always wins.
- **Overlays:** `ui/Modal.tsx` keeps a shared dialog stack.
  - `overlayStack.push/remove/isTop` lets the image viewer and document viewer join the stack. Only the topmost overlay handles keys.
  - `isDialogOpen()` stops global shortcuts while any overlay is open.
  - Each opening of a Modal gets a fresh key (a session counter), so a dialog reopened mid-exit-animation never revives the old form state.
- **Images:**
  - `lib/images.ts` validates the type (PNG/JPEG/WebP via MIME or extension) and size (≤ 25 MB), reads dimensions, and makes a ≤ 720 px WebP thumbnail (JPEG fallback).
  - `addSnapshot` prepares the image *outside* the transaction, then writes the attachment and snapshot in one transaction.
  - `hooks/useBlobUrl.ts` is a refcounted cache of object URLs, keyed `thumb:<snapshotId>`, `img:<attachmentId>`, `dthumb:<documentId>` and `doc:<attachmentId>`. Each URL is revoked 1.5 s after its last user is gone. `downloadBlob()` uses the same cache for downloads. `liveBlobUrlCount()` exists for debugging.

## 5. Database schema (IndexedDB `valuation-journal`)

Defined in `src/db/database.ts`; types in `src/types.ts`. Dexie version *n* is stored as IndexedDB version *n × 10* (currently 40).

| Table | Indexes | Added in |
| --- | --- | --- |
| `journals` | `id` | v1 |
| `phases` | `id, journalId, order` | v1 |
| `checklist` | `id, phaseId, order` | v1 |
| `cards` | `id, phaseId, type, order, *tags, updatedAt` | v1 |
| `attachments` | `id, phaseId, [ownerType+ownerId]` | v1 |
| `meta` | `key` | v1 |
| `snapshots` | `id, phaseId, attachmentId, createdAt, *tags, *cardIds` | v2 |
| `extracts` | `id, phaseId, kind, createdAt, *tags` | v2 |
| `documents` | `id, journalId, phaseId, kind, createdAt, textStatus, *tags, *linkedPhaseIds, *cardIds, *extractIds, *snapshotIds` | v3 |
| `documentTexts` | `documentId` | v3 |
| `revisions` | `id, journalId, &[sourceType+sourceId], dueAt, status` (the compound index is unique: one revision card per source) | v4 |
| `reviewLog` | `id, revisionId, journalId, reviewedAt` | v4 |

v2, v3 and v4 only add tables, so none needs an `.upgrade()`. All records except `meta` and `documentTexts` carry `createdAt` and `updatedAt` (epoch ms).

- **Journal:** `id, name, description`. The first journal has id `'default'` (`DEFAULT_JOURNAL_ID`, named "DCF Valuation" by the seed); others get uuids. Names are kept unique ("Name (2)").
- **No schema change in Milestone 5:** `phases.journalId`, `documents.journalId`, `revisions.journalId` and `reviewLog.journalId` were already indexed, and everything else belongs to a phase, so journals needed no new table or index.
- **Phase:** `id, journalId, order, title, description, objectives: string[]`. Displayed numbers come from `order`.
- **ChecklistItem:** `id, phaseId, text, done, order, completedAt?`.
- **KnowledgeCard:** `id, phaseId, type, title, content, tags, pinned, order, source?`. `type` is one of `concept | formula | assumption | important | warning | example | decision | source`.
- **Snapshot:** `id, phaseId, attachmentId, title, description, caption, tags, pinned, cardIds, fileName, mimeType, size, width, height, thumbnail: Blob`.
  - `cardIds` can reference cards in any phase.
  - The full image is the attachment.
- **KnowledgeExtract:** `id, phaseId, kind, title, text, sourceDocument?, location?, url?, tags, pinned`. `kind` is one of `sentence | paragraph | observation | formula | explanation | lesson`.
- **ResearchDocument** (`documents`):
  - Fields: `id, journalId, phaseId: ID | null, attachmentId, title, description, tags, kind, fileName, mimeType, size, linkedPhaseIds, cardIds, extractIds, snapshotIds, textStatus, pageCount?, thumbnail?: Blob`.
  - `kind` is one of `pdf | spreadsheet | csv | word | presentation | text | markdown | image`.
  - `phaseId` is the phase it is filed in; `null` means unfiled (null is not indexed, so unfiled documents are found by filtering).
  - `linkedPhaseIds` never contains `phaseId`. Card/extract/snapshot links live on the document (multi-entry indexes), so "documents of item X" is one indexed query.
  - `textStatus`: `pending` (background work queued), `indexed`, `none` (no text, or not a text format), `failed`.
- **DocumentText:** `documentId, text, truncated`. Up to 750,000 characters per document, kept apart so library queries never load it.
- **Attachment:**
  - Fields: `id, ownerType ('phase'|'card'|'snapshot'|'document'), ownerId, phaseId, kind ('image'|'pdf'|'document'|'other'), fileName, mimeType, size, blob, caption?`.
  - Written today: `ownerType 'snapshot'` (kind `image`) and `ownerType 'document'` (kind `pdf`, `image` or `document`).
  - Document attachments use `phaseId: ''`, so the phase-delete cascade (`attachments.where('phaseId')`) never removes document files.
- **RevisionCard** (`revisions`): `id, journalId, sourceType ('card'|'extract'), sourceId, prompt, status ('new'|'remembered'|'needs-revision'), level, reviewCount, lapses, lastReviewedAt?, dueAt`. `journalId` is taken from the source's phase when the card is added.
- **ReviewLogEntry** (`reviewLog`): `id, revisionId, journalId, reviewedAt, result, before` (the schedule fields before the review, for exact undo).
- **MetaEntry:** `key, value`. Keys: `activeJournalId`, `lastPhaseId:<journalId>`, and the legacy `lastPhaseId` (read only for `'default'`).

**Seeding:** `db/seed.ts` runs only in Dexie's `populate` event, i.e. once, when the database is first created. A fresh install has 13 phases, 78 checklist tasks, 37 knowledge cards and 2 extracts (on Free Cash Flow and Terminal Value). There are no seeded snapshots or documents.

The 13 seeded phases are:
1. Valuation Objective & Setup
2. Business and Industry Understanding
3. Historical Financial Analysis
4. Normalisation and Adjustments
5. Operating Forecast and Assumptions
6. Forecast Financial Statements
7. Cost of Capital (WACC)
8. Free Cash Flow Construction
9. Terminal Value
10. Enterprise Value to Equity Value Bridge
11. Sensitivity and Scenario Analysis
12. Relative Valuation and Cross-Checks
13. Final Valuation Conclusion

**Delete semantics (`db/repository.ts`):**
- **Phase:** deletes its checklist, cards, snapshots, extracts, the revision cards (and logs) of those cards and extracts, and phase-owned attachments in one transaction; unlinks its cards from snapshots in other phases; unlinks its cards, snapshots, extracts and the phase itself from documents; sets `phaseId = null` on documents filed in it (they become **Unfiled**, files kept); then renumbers the remaining phases.
- **Card:** deletes card-owned attachments and its revision card and log, unlinks the card from snapshots and documents. The snapshots and documents themselves are kept.
- **Snapshot:** also deletes its attachment and unlinks it from documents.
- **Extract:** deletes its revision card and log, unlinks it from documents (in one transaction).
- **Remove from Recall:** deletes the revision card and its log only.
- **Document:** deletes its attachment and its `documentTexts` row.
- **Journal:** deletes its phases and everything they own, its documents with their files and texts, its revision cards and logs, and its meta keys, in one transaction over `JOURNAL_TABLES`. The last journal can't be deleted; deleting the open journal switches to another first.

## 6. Implemented features (verified manually)

**Milestone 1**
- Overview with a serpentine pathway of phase cards and an SVG connector. Each card shows progress and an item count; there are summary counts and a "continue where you left off" link.
- Zoom into and out of a phase; previous/next phase links; browser back and forward; refreshing keeps the current route.
- Phases: add, rename, edit description and objectives, reorder (drag or arrows), delete with confirmation (`phases/ManagePhasesDialog.tsx`, `phases/PhaseFormDialog.tsx`).
- Checklist: add, edit inline, tick off, delete.
- Knowledge cards: 8 types, tags, pin, optional source. Formula cards render in monospace.
- Global search (Ctrl/Cmd+K or `/`) across phases, tasks, cards, snapshots, extracts and documents, with highlighted matches. Selecting a result jumps to the item.
- Light and dark themes; reduced motion respected; works at mobile width (375 px).

**Milestone 2**
- **Snapshot library per phase:**
  - Add images by upload, clipboard paste (Ctrl/Cmd+V anywhere in a phase, or the Paste button) or drag-and-drop onto the page.
  - Edit title, description, caption and tags; pin; delete.
  - Link snapshots to knowledge cards through a card picker. Cards show their linked thumbnails and have an "attach image" button.
- **Image viewer** (`library/ImageViewer.tsx`):
  - Fit, actual size, zoom (buttons, keys, wheel at cursor, double-click); drag to pan.
  - Previous/next and a filmstrip; an info panel with metadata, linked cards and (since M3) connected documents; full screen.
- **Important extracts:**
  - 6 kinds; source document, page/section and URL (only `http(s)` links are made clickable); tags; marked important.
  - Pasting text in a phase opens a pre-filled extract and guesses its kind.
- **Library filters** (`library/LibraryFilters.tsx`, `libraryFilter.ts`): by content type, tag, important only, and date range.
- **Overview and header stats** include snapshot and extract counts.

**Milestone 3**
- **Document attachments:** PDF, Excel (`.xlsx .xls .xlsm .xlsb`), CSV/TSV, Word (`.docx .doc .rtf`), PowerPoint (`.pptx .ppt`), TXT, Markdown and images (PNG, JPG, WebP, GIF). Added by upload button, drag-and-drop (phase page or Document Library) and clipboard paste of files. Unsupported files are refused with a message.
- **Per document:** file name, type, size, upload date, editable title, description, tags, filed-in phase, and connections to other phases, knowledge cards, extracts and snapshots (`DocumentEditorDialog`, `LinkPicker`, existing `CardPicker`).
- **PDF viewer** (`documents/previews/PdfViewer.tsx`): page navigation (buttons, page box, N/P), zoom (buttons, preset select, +/−, Ctrl+wheel at cursor), fit width / fit page, full screen (whole viewer), selectable text layer, find in document with highlight-all, match count and next/previous (Ctrl/Cmd+F, Enter, Shift+Enter), password prompt for protected PDFs, an error state with download for damaged files. Opening never downloads the file or leaves the app.
- **Other previews:** images (fit / zoom steps), TXT, Markdown (formatted or source; rendered as React elements, only `http(s)` links clickable), CSV/TSV (delimiter detection, quoted fields, sticky header, first 2,000 rows). Text previews read at most 5 MB.
- **Office files:** an honest panel saying no in-app preview is possible without a cloud viewer, with a download button. No fake previews.
- **Document Library page** (`#/documents`): grouped by phase in pathway order plus "Unfiled", or a flat list; search over title, file name, description, tags and the text inside files (with an excerpt); filters by phase (filed or linked), type and tag; sort by date, title or size; storage panel (documents' total size, site usage vs. quota, persistent-storage request); drop to upload (filed into the filtered phase, else unfiled).
- **Phase Documents tab:** "Filed in this phase" and "Linked from other phases", a filter box and type filter, Upload and Link existing. The tab count and the phase header include documents.
- **Connections from the item side:** paperclip on cards and extracts, and a "Connected documents" section in the image viewer, open a dialog to choose documents or upload a new one. Cards, extracts and snapshots show document chips that open the viewer. The viewer's details panel lists all connections and jumps to each item (switching phase and tab, flashing the item).
- **Downloads** of the original file from rows, the viewer header and the Office panel (via `downloadBlob`, original file name).
- **Storage:** files are blobs in IndexedDB `attachments` (never base64, never localStorage); 200 MB per-file limit; a pre-check against the browser quota; quota errors reported; "Saving…" notice for files over 25 MB.

**Verification done at the end of Milestone 3** (in the in-app browser):
- **Migration:** a genuine v2 database (IndexedDB version 20, built with only the v1+v2 schema and the seed, plus an edited card, a ticked task, an added extract and a snapshot with its image) upgraded to v3 (version 30) with every record intact, the two new tables present, and no re-seed.
- **Upload:** all 8 kinds via simulated drop (phase page and library page) and the real file-input change handler; Markdown with an empty MIME type detected by extension; `.exe` refused; a 201 MB file refused; a 30 MB file saved with the "Saving…" notice, indexed to 750,000 characters (truncated) and previewed with the 5 MB notice. Mixed drops on the Journal tab sent the PNG to snapshots and the PDF to documents; on the Documents tab the PNG became a document. Pasted image → snapshot, pasted PDF → document, pasted text → extract editor.
- **PDF viewer** (generated 5-page PDF using non-embedded Helvetica): renders; fit width; zoom in/out and "Fit page"; page box jump to page 5; find "unlevered beta" → "2 of 3" with highlight and page change; real mouse-drag text selection; info panel; refit after window resize (490 → 1280 px) and after closing the info panel; Ctrl+F/Escape behaviour. A damaged PDF shows the error state; PDF.js fonts, cmaps and wasm are served locally, and path traversal under `/pdfjs/` falls through to the app.
- **Previews:** CSV (quoted comma field), Markdown (heading, emphasis, list, table, quote, code; `javascript:` link not clickable; parenthesised URLs), TXT, image (600 × 360) and the Office panel.
- **Downloads:** captured link URLs returned byte-identical content with the original file names for PDF, DOCX, PPTX and PNG; download URLs were released afterwards.
- **Search:** library search found text that exists only inside the PDF and inside a TXT, and by `#tag`; global search returned a document "Found in file" and opened the PDF on the matching page with the query already found.
- **Connections:** editor (description, tags, related phase, card, extract, snapshot) saved and shown in the details panel; jump from the panel to the card (phase switch, tab switch, flash); card paperclip dialog added a document; chips on card, extract and snapshot viewer; document viewer opened above the image viewer, Escape closed only the top one; "Link existing" on phase 12.
- **Deletion:** card and extract deletes unlink; phase delete (UI, with the "kept as unfiled" message) left its document unfiled with its file; document delete (UI) removed record, file and text and kept the connected snapshot.
- **Persistence:** after reloads all documents, files and texts remained; a document left `pending` was indexed automatically on the next launch.
- **Layout and themes:** no horizontal overflow at 375 px on the library page, phase Documents tab and PDF viewer; light theme keeps `color-scheme: light` after the PDF stylesheet loads.
- **Earlier milestones re-checked:** overview zoom open/close, checklist add/tick/delete, search jump to a card in another phase, extract paste, snapshot paste, image viewer, navigation Documents ↔ phase ↔ back.
- **Build:** clean.

**Not verified:**
- Full screen: the in-app pane rejects it ("Permissions check failed"); the viewer shows its "blocked" toast. Needs a check in a normal browser.
- A real file-chooser dialog and a real saved download (both simulated through the same code paths).
- Password-protected, scanned (image-only, JPX/JBIG2) or very large real-world PDFs. The password prompt and the wasm decoders are wired up but untested.
- Real Office files (stand-in bytes with Office extensions were used; they are only stored and downloaded).
- The production build in a browser (`npm run preview`), including the emitted `dist/pdfjs/` assets.
- Touch gestures on a real device.

**Milestone 4**
- **Recall page** (`#/recall`; "Recall" in the main navigation with a due badge): totals (revision cards, remembered with a "well known" count, needs revision, due now), progress by phase (remembered and needs-revision bars, due counts; clicking a phase filters by it), and a "How scheduling works" note.
- **Adding:** a brain icon on every card and extract toggles it in Recall (asks before removing one that has reviews). The "Add cards" dialog picks many at once with search, phase, type and pinned filters and "Select N shown". Duplicates are impossible (unique index plus a check).
- **Filters:** status (All, Due, Needs revision, Remembered, New), phase, type (each card type and extract kind), pinned, text search. Session size 10 / 20 / 50 / all. "Revise N due", "Pinned only · N" and "Revise N shown".
- **Rows:** question, status, phase, pinned, next due, review count; revise just this card, edit the question (`PromptDialog`), open in the journal, remove.
- **Session:** question first, answer hidden until "Show the answer" (Space/Enter); Needs revision / Remembered buttons show the resulting interval; previous/next; progress bar and running counts; a summary with "Revise the N again". Keys: Space/Enter, 1/J, 2/K, ←/→, Esc. Answers are set like the source (formulas in mono, quotes in the serif) with the source reference and tags.

**Verification done at the end of Milestone 4** (in-app browser):
- **Migration:** the existing v3 test database (IndexedDB version 30, with the Milestone 3 test documents) opened as version 40 with every store and count intact (13 phases, 78 tasks, 37 cards, 3 extracts, 3 snapshots, 10 documents, 13 attachments, 5 document texts) and the two new empty tables. No re-seed.
- **Adding:** the dialog's pinned filter (4 items) and phase filter (7 items in phase 07) with "Select N shown" added 9 revision cards (the 2 overlapping items once).
- **Session:** Space revealed; `2` and `1` rated and advanced; `←` went back to the rated card, which opened on its answer; re-rating it replaced the earlier review (2 log entries, not 3; the card's `lapses` back to 0). Intervals: Remembered on a new card → 1 day; Needs revision → 10 minutes.
- **Dashboard:** totals and due counts matched the database after the session; the nav badge showed the due count.
- **In the phase:** cards and the extract showed "In Recall · due now / tomorrow" and the active toggle. Deleting an in-Recall card through the UI removed its revision card (no orphan).
- **Navigation:** "Open in the journal" opened phase 09 and flashed the card; the phase's back button read "Recall" and returned to `#/recall`.
- **Layout:** no horizontal overflow at 375 px on the Recall page and in a session. No console errors. Persistence across reloads.
- **Build:** clean.

**Not verified in Milestone 4:** screenshots of the session animations (the pane was hidden, which pauses animation frames; state was checked through the DOM and the database instead).

**Milestone 5**
- **Journal switcher** in every page header: brand mark, "Valuation Journal" and the journal name; the list shows each journal with its phase count and description, plus New journal, Manage journals, Backup & restore. Keyboard: arrows, Esc.
- **New journal:** name, description, start from the DCF template (13 phases, checklists, starter cards and extracts), an existing journal (independent copy, files included) or an empty workspace. Opens the new journal.
- **Manage journals:** each journal's counts (phases, cards, library items, documents, Recall, file size) and creation date; Open, Rename, Duplicate (with a confirmation that lists what will be copied), Export backup, Delete (danger confirmation listing everything that will be deleted and suggesting a backup).
- **Backup & restore:** Export tab (choose journals, size estimate, progress, saved file name); Restore tab (choose a .zip, validation, per-journal choice of Import as a new journal / Replace the matching journal / Skip, notes about name clashes, malformed records and missing files, storage check, progress, a result toast; opens the first restored journal).
- **Isolation:** overview stats, Resume, the Document Library, Recall (and its nav badge), search (including text inside files), tag suggestions, card/document/extract/snapshot pickers all show only the open journal.

**Verification done at the end of Milestone 5** (in-app browser, plus Node and Python for the ZIP format):
- **Existing data:** the Milestone 4 test database opened unchanged as the "DCF Valuation" journal (no schema change, no upgrade).
- **Create:** "Trent Limited Valuation" from the DCF template (13 phases, 0/78 tasks, 39 items, no Resume); its Documents and Recall pages were empty and search found neither the other journal's extract nor text inside its PDFs. "Cost of Capital Reference" from Empty; a phase added through the UI and a dropped TXT landed in that journal (unfiled, indexed) and global search found the text there but not from Trent.
- **Duplicate:** the 13-phase journal with 10 documents, 3 snapshots, 8 revision cards and 2 review logs copied with identical counts and bytes. An integrity script over all tables found 0 problems: every reference resolves inside its own journal, no id is shared between journals, no orphan files.
- **Rename** (to "Fastenal Valuation"), **delete** (of the open journal: switched first, every record and file removed, totals back to the previous state, 0 orphans), **reload** (the open journal persisted), **per-journal Resume** and the journal name in the phase breadcrumb.
- **Export:** 3 journals → a 130 KB ZIP, downloaded with the expected name. Independently, the same `zip.ts` run under Node produced an archive that Python's `zipfile.testzip()` passed (deflated JSON with UTF-8 text, a 3 MB stored binary, a 1-byte entry); it also read a Python-made archive (deflate, stored, Unicode names), and caught a flipped byte (checksum) and a truncated file.
- **Restore:** Import as new ("DCF Valuation (2)", identical counts; all 10 document files SHA-256-identical to the originals; thumbnails present); Replace (confirmation shown; a marker card added beforehand was gone and the counts matched the backup); a damaged file inside an otherwise valid archive failed its checksum at restore time with a clear message and nothing written; random bytes, a truncated file, a ZIP without manifest, a newer format (9), invalid JSON and missing files each gave a specific message.
- **Fresh install and full restore:** after exporting 4 journals and deleting the test database, a fresh load seeded correctly through the refactored seed (version 40; 13 phases, 78 tasks, 37 cards, 2 extracts). Restoring the 4 journals onto it gave identical counts, 0 integrity problems, a PDF that renders all 5 pages, and the Recall schedule intact (8 cards, 2 remembered, 6 due).
- **Layout:** no horizontal overflow at 375 px on the three pages; the switcher popover fits (16–326 px). A first version let the journal name run under the nav icons on phones; fixed (see the log).
- **Console:** a clean load walking every page, the journal dialogs, a switch and a phase produced no errors.
- **Build:** clean.

**Milestone 6**
- **Layout:** the overview and Recall heroes stack below 1280 px (at 1024 px the stats panel squeezed the text column and the Resume button ran under it); stats panels keep their natural width when stacked; the Resume label truncates. Header: nav labels and the document count show from 1024 px; the journal name never flex-shrinks from 640 px up and has a max width per breakpoint (a sub-pixel rounding made Chrome add an ellipsis to names that fit); the "Valuation Journal" label never wraps.
- **Navigation:** a Recall icon next to the Document Library icon in the phase header (hidden on phones).
- **Motion:** reduced-motion cross-fade for the phase layer (above).
- **Image viewer:** Pin and Edit now really hide on phones (`max-sm:hidden`; the Milestone 2 known issue).
- **Performance:** the Document Library, Recall page and revision session are `lazy` chunks (the overview stays in the entry); thumbnails use `loading="lazy"` and `decoding="async"`.
- **Copy:** `plural()` in `lib/format.ts` for counts in the journal switcher, Manage journals and Backup dialogs; the creation date on its own line.
- **Tooling:** `.claude/launch.json` has a second configuration, `valuation-journal-preview` (`npm run preview` on port 4173), to test the production build.

**Verification done at the end of Milestone 6:**
- **Visual review** (screenshots, both themes): overview, Recall page, a revision session, Manage journals, a phase workspace (Library tab), the journal switcher; the issues above were found this way and fixed.
- **Layout:** measured at 1024 px: no overlap in the hero; the journal name fits ("DCF Valuation (2)" untruncated). At 375 px the earlier checks still hold (switcher shrinks, popover fits).
- **Lazy chunks:** loading `#/recall` directly, starting a session and rating a card, then Documents and the overview: all rendered, no errors.
- **Production build in a browser** (first time; outstanding since Milestone 3): `npm run preview` served `dist/` on its own origin (so a fresh database): the seed was correct; a dropped PDF was stored, indexed, and rendered in the viewer with a canvas and a text layer using the worker emitted in `dist/assets`; a backup export and restore round trip worked with the lazily loaded backup chunk. No console errors.
- **Integrity:** the script over every table of the 5 test journals found 0 problems.
- **Build:** clean, no size warning.

**Backup reminder (follow-up to Milestone 6)**
- A quiet pill under the overview description (gold archive icon, muted text, gold "Back up now" link, `surface`/`line`/`shadow-card`), only for the open journal. It opens Backup & restore with every journal ticked.

**Verification done for the backup reminder** (in-app browser on the dev server, port 5174, so a fresh seeded database on its own origin):
- Fresh seed (no files, no backup): no notice. After adding a TXT document through the repository: "No backup of this journal yet · Back up now" appeared live.
- "Back up now" opened Backup & restore; Export backup saved the ZIP, wrote `lastBackupAt:default`, and the notice disappeared.
- Editing `meta` to 42 days ago showed "Last backup 42 days ago"; 29 days ago hid it; 42 days again showed it.
- Restore (through the dialog's Restore tab, Import as new): no `lastBackupAt` written; the date of the original journal was unchanged and the restored "DCF Valuation (2)" showed "No backup of this journal yet". Replace (through `importJournalBundle`) kept the replaced journal's date. Switching journals switched the notice. Deleting a journal removed its key.
- Light and dark themes (screenshots); at 375 px the pill spans 16–303 px with no horizontal scroll. No console errors after a clean reload. Build clean, no size warning.

**Not verified for the backup reminder:** a real saved download (the export was driven in the in-app browser); the hourly refresh of the age while the page stays open.

**Not verified in Milestone 6:** the reduced-motion transition (the in-app browser cannot emulate `prefers-reduced-motion`; the code path is a plain variant swap); touch devices; Firefox and Safari (only Chromium was used throughout).

**Not verified in Milestone 5:** a backup near the 4 GB limit or with 200 MB files (the code paths are the same streaming ones tested with 3 MB); a real saved download and real file chooser (both driven programmatically through the same handlers); restoring in a different browser.

## 7. Key files

| Path | Role |
| --- | --- |
| `src/main.tsx`, `src/App.tsx` | Providers; routes, global shortcuts, phase layer and dialogs |
| `src/index.css` | Design tokens (light and dark), PDF.js `color-scheme` override |
| `vite.config.ts` | React, Tailwind and PDF.js asset plugins |
| `src/types.ts` | Domain model and constant lists (`CARD_TYPES`, `EXTRACT_KINDS`, `DOCUMENT_KINDS`) |
| `src/db/database.ts` | Dexie schema and versions |
| `src/db/seed.ts` | Starter DCF content: `buildStarterJournal` (fresh ids each call), written by `populate` on first launch and by the DCF template |
| `src/db/repository.ts` | Every write operation, including `addDocument`, `updateDocument`, `deleteDocument`, `setItemDocuments`, `saveDocumentDigest` |
| `src/hooks/useJournalData.ts` | `useRecallItems`, `useSourceRevision`, `useDueRevisionCount`, `usePhases`, `usePhaseStats`, `usePhaseDetail`, `useLastVisitedPhaseId`, `useAllTags`, `useDocuments`, `useDocument`, `usePhaseDocuments`, `useItemDocuments`, `useAttachmentBlob`, `useDocumentTextMatches` |
| `src/hooks/useBlobUrl.ts` | Object-URL lifecycle and `downloadBlob` |
| `src/hooks/useHashRoute.ts`, `useTheme.ts` | Routing; theme store |
| `src/lib/recall.ts` | Spaced-repetition schedule: `nextSchedule`, `isDue`, `relativeDue`, `intervalLabel` |
| `src/lib/activeJournal.ts`, `src/hooks/useActiveJournal.ts` | Active journal store; `useActiveJournalId`, `useActiveJournal`, `useJournals` |
| `src/db/bundle.ts` | Whole-journal collect / remap / write / delete / count |
| `src/lib/zip.ts`, `src/lib/backup.ts` | ZIP writer and reader; backup format, export, validation, restore loading |
| `src/components/AppHeader.tsx` | Page header: journal switcher, main nav, search, theme |
| `src/components/journals/` | `JournalsContext`, `JournalsProvider`, `JournalSwitcher`, `JournalFormDialog`, `ManageJournalsDialog`, `BackupDialog` |
| `src/hooks/useNow.ts` | Minute clock for due counts |
| `src/components/recall/` | `RecallPage`, `RecallSession`, `Flashcard`, `RevisionRow`, `RecallStatusPill`, `AddToRecallDialog`, `PromptDialog`, `RecallToggle`, `RecallBadge`, `recallItems.ts` (prompt/answer/reference helpers, filters, ordering) |
| `src/lib/` | `images.ts`, `documents.ts` (formats and limits: `MAX_DOCUMENT_BYTES` 200 MB, `LARGE_DOCUMENT_BYTES` 25 MB, `MAX_INDEXED_CHARS` 750,000, `MAX_TEXT_PREVIEW_BYTES` 5 MB), `documentProcessing.ts`, `pdf.ts`, `csv.ts`, `markdown.ts`, `search.ts`, `format.ts`, `cardTypes.ts`, `extractKinds.ts`, `id.ts` |
| `src/components/MainNav.tsx` | Pathway / Documents / Recall switch |
| `src/components/BrandMark.tsx`, `ThemeToggle.tsx` | Logo (phase header); light/dark switch |
| `src/components/overview/` | `Overview`, `PhasePathway`, `PhaseNode`, `BackupReminder` |
| `src/components/workspace/` | `PhaseLayer`, `PhaseWorkspace`, `PhaseHeader`, `ObjectivesPanel`, `ChecklistPanel`, `JournalPanel`, `KnowledgeCardView`, `CardEditorDialog`, `Panel` |
| `src/components/library/` | `LibraryContext`, `LibraryPanel`, `LibraryFilters`, `libraryFilter`, `SnapshotTile`, `SnapshotThumb`, `SnapshotEditorDialog`, `CardPicker`, `ImageViewer`, `ExtractView`, `ExtractEditorDialog`, `DropOverlay` |
| `src/components/documents/` | `DocumentsContext`, `DocumentsProvider`, `DocumentLibraryPage`, `PhaseDocumentsPanel`, `DocumentRow`, `DocumentThumb`, `DocumentChips`, `DocumentViewer`, `DocumentInfoPanel`, `DocumentEditorDialog`, `DocumentLinkDialog`, `LinkPicker`, `StoragePanel`, `previews/` (`PdfViewer`, `ImagePreview`, `TextPreview`, `MarkdownView`, `CsvPreview`, `NoPreview`) |
| `src/components/phases/` | `PhaseFormDialog`, `ManagePhasesDialog` |
| `src/components/search/` | `SearchPalette` |
| `src/components/ui/` | `Button`/`IconButton`/`Kbd`, `Modal`, `ConfirmProvider`, `Toast`, `EditableText`, `Menu`, `ProgressBar`, `TagInput`, `Field`, `AddLineInput`, `Select` |
| `scripts/vite-pdfjs-assets.mjs` (+ `.d.mts`) | Vite plugin: PDF.js runtime assets at `/pdfjs/` |
| `.claude/launch.json` | `valuation-journal` (dev server, port 5173) and `valuation-journal-preview` (production build, port 4173) |

### Files touched in Milestone 3

Git was set up only after Milestone 3, so this list is taken from the session record.
- **New:**
  - `scripts/vite-pdfjs-assets.mjs`, `scripts/vite-pdfjs-assets.d.mts`
  - `src/lib/documents.ts`, `documentProcessing.ts`, `pdf.ts`, `csv.ts`, `markdown.ts`
  - `src/components/MainNav.tsx`
  - Everything in `src/components/documents/`
- **Modified:**
  - `package.json` (+ `pdfjs-dist`), `vite.config.ts`, `src/index.css`
  - `src/types.ts`, `src/db/database.ts` (v3), `src/db/repository.ts`
  - `src/hooks/useJournalData.ts`, `useBlobUrl.ts`, `useHashRoute.ts`
  - `src/lib/search.ts`, `src/lib/images.ts` (`formatBytes` handles GB)
  - `src/App.tsx`
  - `workspace/PhaseLayer.tsx`, `PhaseWorkspace.tsx`, `PhaseHeader.tsx`, `KnowledgeCardView.tsx`
  - `library/DropOverlay.tsx` (generic title/subtitle/disabled), `ExtractView.tsx`, `ImageViewer.tsx`
  - `overview/Overview.tsx`, `phases/ManagePhasesDialog.tsx`, `search/SearchPalette.tsx`
  - `README.md`

## 8. Known limitations and open issues

- **Recall:** a card with no title shows the first line of its content as the question, which then repeats in the answer; set a question with the pencil icon. Only cards and extracts can be revision cards (not snapshots or documents). The interval shown on an already-rated card you go back to reflects its new schedule.
- **Backups are manual.** Data lives in one browser profile; clearing site data deletes it, files included. The user must export ZIP backups and keep them elsewhere. The overview reminds them (never exported with files, or over 30 days), but the app can't tell whether the downloaded file was kept: an export counts as a backup as soon as the ZIP is handed to the browser. The reminder can't be dismissed or snoozed.
- **Backup limits:** no ZIP64, so one archive must stay under 4 GB and 65,535 files (export journals separately if needed). The whole backup's JSON and each restored journal are processed in memory (files are not, except deflated ones from other tools). Restoring the same backup twice as "new" makes two journals ("Name (2)"): by design, since ids are always regenerated.
- **Restored documents still `pending`** (exported mid-indexing) are indexed on the next launch, not immediately.
- **Phone header:** the journal name is truncated to a few characters at 375 px; the full name is in the switcher list.
- **No in-app preview for Excel, Word and PowerPoint**, by design (no reliable local renderer without new dependencies or a cloud viewer). Their text is not indexed for search either. A text-only `.docx`/`.xlsx` extractor using the browser's `DecompressionStream` would be possible later.
- **Scanned PDFs** without a text layer can be viewed but not searched (no OCR).
- **Search inside files** scans every stored text on each (deferred) query. That is fine for dozens of documents; with hundreds of long filings it may feel slow and would need an index.
- **No PDF annotations or highlights saved** (the viewer has no editing tools enabled), no page thumbnails sidebar and no outline/bookmarks panel.
- **Document titles** derived from file names replace `-` and `_` with spaces ("bottom-up" becomes "bottom up"), as for snapshots; titles are editable.
- **Viewer full screen is unverified**: the in-app test pane refuses it. The app shows a toast when the request fails.
- **No pinch-to-zoom** in the image viewer on touch screens (not tested on a real touch device). PDF.js has its own pinch support, also untested.
- Images can't be dropped onto a specific card; dropping anywhere adds a phase snapshot. A card's "attach image" button links an upload to that card.
- Tasks and cards can't be reordered in the UI (the `order` fields exist). There is no rich text or Markdown in card content.
- There are no automated tests; verification is manual in the browser.
- Git history starts at the Milestone 3 checkpoint; earlier history exists only in DEVELOPMENT_LOG.md. The code is on GitHub (public: `dhruv-37/Valuation-Journal`); user data is never in the repository.
- Bundle: the entry plus vendor chunk is ≈ 694 kB before gzip. New pages should be `lazy` like the Document Library and Recall pages.
- Only Chromium has been used for testing (the in-app browser); Firefox and Safari are untested. `CompressionStream`/`DecompressionStream` (backups) need Firefox 113+ / Safari 16.4+.
- `dist/pdfjs/wasm/` ships `quickjs-eval.wasm` (≈ 469 kB) that is never used. The asset plugin could skip it; harmless for a local app.

## 9. Next steps (nothing scheduled)

All agreed milestones (1–6) and the backup reminder are complete. Candidates, roughly in order of value:
1. **Save a PDF text selection as an extract** (with the page number) from the viewer.
2. **Text indexing for `.docx` / `.xlsx`** using the browser's `DecompressionStream` (no new dependency).
3. Move or copy single cards, extracts or documents between journals.
4. PDF outline and page thumbnails; persistent highlights.
5. Smaller items: a snooze for the backup reminder, pinch-zoom in the image viewer, drop an image onto a card, reorder tasks and cards, Markdown in cards.

**Outstanding manual checks** (cannot be done in the in-app browser): viewer full screen; a real file chooser and a real saved download; real Office files; password-protected and scanned PDFs and a large real filing; a backup of hundreds of MB; restoring in a different browser; the reduced-motion transition; touch devices; Firefox and Safari.
