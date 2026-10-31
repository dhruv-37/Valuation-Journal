# Project Context: Valuation Journal

_Last updated: 2026-10-31, after Milestone 3 (Document Management). Re-checked against the code and a fresh build the same day (see DEVELOPMENT_LOG.md, "Documentation review")._

## 0. Resuming work (read this first)

- **Current state:** Milestones 1–3 are complete and verified. No work is in progress and no change is half-finished.
- **Next:** Milestone 4 has not been chosen. The user picks it from the candidates in §9; backup and restore is the recommendation.
- **Before starting a milestone:** read CLAUDE.md, this file and DEVELOPMENT_LOG.md; run `npm run build` to confirm a clean baseline.
- **Checkpoints:** git was initialised on 2026-10-31 (branch `main`, no remote). The first commit is the checkpoint after Milestone 3; everything before it is recorded only in DEVELOPMENT_LOG.md. End each milestone with a checkpoint commit after the docs are updated.
- **Test browser:** the in-app browser's database holds test data (see the end of DEVELOPMENT_LOG.md), not a fresh seed. The user's real data in their own browser has never been touched.

## 1. What it is

A personal, local-first workspace for learning and documenting the DCF valuation process.
- The overview shows the workflow as a connected pathway of phases.
- Opening a phase zooms into its workspace, which holds:
  - Objectives and a checklist
  - A knowledge journal (typed cards)
  - A library of image snapshots and text extracts
  - A Documents tab: the phase's research file (PDF, Office, CSV, text, Markdown, images)
- A central Document Library page lists every document, organised by phase.
- All data, images and documents included, lives in the browser's IndexedDB. There is no server, no account, no sync and no cloud viewer.

## 2. Status

| Milestone | Scope | Status |
| --- | --- | --- |
| 1: Core workspace | Pathway overview, zoom transition, editable phases, checklist, knowledge cards, seed, search, themes | Done; manually verified in the browser |
| 2: Visual Knowledge Library | Snapshot library, image viewer, important extracts, filters, schema v2 | Done; manually verified, including the v1 → v2 migration |
| 3: Document Management | Document attachments, PDF.js viewer, Document Library page, document ↔ knowledge connections, text search inside files, schema v3 | Done; manually verified, including the v2 → v3 migration (see §6) |
| 4 | Not chosen yet | See §9 |

The production build (`npm run build`) is clean (re-run 2026-10-31 after Milestone 3).
- The main JS bundle is ≈ 693 kB (≈ 213 kB gzip; warning limit 800 kB). The main CSS is ≈ 65 kB.
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
App.tsx        phases + stats, hash route, global shortcuts (Ctrl/Cmd+K, /),
               DocumentsProvider > [Overview | DocumentLibraryPage], AnimatePresence > PhaseLayer,
               phase dialogs, SearchPalette
```

- **Data flow:**
  - Components → `db/repository.ts` (all writes, using transactions for multi-table changes) → Dexie.
  - Reads use `useLiveQuery` hooks in `hooks/useJournalData.ts`, so the UI re-renders on any change.
- **Routing:** `#/` (overview), `#/documents` (Document Library) and `#/phase/<id>`. This lives in `hooks/useHashRoute.ts`: `useSyncExternalStore`, a custom `vj:route` event, and `router.openPhase / switchPhase / toOverview(fallback) / toDocuments / toPathway`. `history.scrollRestoration = 'manual'`.
  - The page under an open phase is the last full page visited (`basePage` in `App`), so a phase opened from the Document Library closes back to it, and its back button reads "Documents".
  - `MainNav` (Pathway / Documents) sits in the overview and library headers; the phase header has a Document Library icon.
- **Zoom transition:** `workspace/PhaseLayer.tsx`.
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

Defined in `src/db/database.ts`; types in `src/types.ts`. Dexie version *n* is stored as IndexedDB version *n × 10* (currently 30).

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

v2 and v3 only add tables, so neither needs an `.upgrade()`. All records except `meta` and `documentTexts` carry `createdAt` and `updatedAt` (epoch ms).

- **Journal:** `id, name, description`. Only `'default'` (`DEFAULT_JOURNAL_ID`, named "DCF Valuation") exists; there is no UI for multiple journals.
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
- **MetaEntry:** `key, value`. The only key in use is `lastPhaseId`.

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
- **Phase:** deletes its checklist, cards, snapshots, extracts and phase-owned attachments in one transaction; unlinks its cards from snapshots in other phases; unlinks its cards, snapshots, extracts and the phase itself from documents; sets `phaseId = null` on documents filed in it (they become **Unfiled**, files kept); then renumbers the remaining phases.
- **Card:** deletes card-owned attachments, unlinks the card from snapshots and documents. The snapshots and documents themselves are kept.
- **Snapshot:** also deletes its attachment and unlinks it from documents.
- **Extract:** unlinks it from documents (in one transaction).
- **Document:** deletes its attachment and its `documentTexts` row.

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

## 7. Key files

| Path | Role |
| --- | --- |
| `src/main.tsx`, `src/App.tsx` | Providers; routes, global shortcuts, phase layer and dialogs |
| `src/index.css` | Design tokens (light and dark), PDF.js `color-scheme` override |
| `vite.config.ts` | React, Tailwind and PDF.js asset plugins |
| `src/types.ts` | Domain model and constant lists (`CARD_TYPES`, `EXTRACT_KINDS`, `DOCUMENT_KINDS`) |
| `src/db/database.ts` | Dexie schema and versions |
| `src/db/seed.ts` | Starter DCF content (first launch only) |
| `src/db/repository.ts` | Every write operation, including `addDocument`, `updateDocument`, `deleteDocument`, `setItemDocuments`, `saveDocumentDigest` |
| `src/hooks/useJournalData.ts` | `usePhases`, `usePhaseStats`, `usePhaseDetail`, `useLastVisitedPhaseId`, `useAllTags`, `useDocuments`, `useDocument`, `usePhaseDocuments`, `useItemDocuments`, `useAttachmentBlob`, `useDocumentTextMatches` |
| `src/hooks/useBlobUrl.ts` | Object-URL lifecycle and `downloadBlob` |
| `src/hooks/useHashRoute.ts`, `useTheme.ts` | Routing; theme store |
| `src/lib/` | `images.ts`, `documents.ts` (formats and limits: `MAX_DOCUMENT_BYTES` 200 MB, `LARGE_DOCUMENT_BYTES` 25 MB, `MAX_INDEXED_CHARS` 750,000, `MAX_TEXT_PREVIEW_BYTES` 5 MB), `documentProcessing.ts`, `pdf.ts`, `csv.ts`, `markdown.ts`, `search.ts`, `format.ts`, `cardTypes.ts`, `extractKinds.ts`, `id.ts` |
| `src/components/MainNav.tsx` | Pathway / Documents switch |
| `src/components/BrandMark.tsx`, `ThemeToggle.tsx` | Header logo; light/dark switch |
| `src/components/overview/` | `Overview`, `PhasePathway`, `PhaseNode` |
| `src/components/workspace/` | `PhaseLayer`, `PhaseWorkspace`, `PhaseHeader`, `ObjectivesPanel`, `ChecklistPanel`, `JournalPanel`, `KnowledgeCardView`, `CardEditorDialog`, `Panel` |
| `src/components/library/` | `LibraryContext`, `LibraryPanel`, `LibraryFilters`, `libraryFilter`, `SnapshotTile`, `SnapshotThumb`, `SnapshotEditorDialog`, `CardPicker`, `ImageViewer`, `ExtractView`, `ExtractEditorDialog`, `DropOverlay` |
| `src/components/documents/` | `DocumentsContext`, `DocumentsProvider`, `DocumentLibraryPage`, `PhaseDocumentsPanel`, `DocumentRow`, `DocumentThumb`, `DocumentChips`, `DocumentViewer`, `DocumentInfoPanel`, `DocumentEditorDialog`, `DocumentLinkDialog`, `LinkPicker`, `StoragePanel`, `previews/` (`PdfViewer`, `ImagePreview`, `TextPreview`, `MarkdownView`, `CsvPreview`, `NoPreview`) |
| `src/components/phases/` | `PhaseFormDialog`, `ManagePhasesDialog` |
| `src/components/search/` | `SearchPalette` |
| `src/components/ui/` | `Button`/`IconButton`/`Kbd`, `Modal`, `ConfirmProvider`, `Toast`, `EditableText`, `Menu`, `ProgressBar`, `TagInput`, `Field`, `AddLineInput`, `Select` |
| `scripts/vite-pdfjs-assets.mjs` (+ `.d.mts`) | Vite plugin: PDF.js runtime assets at `/pdfjs/` |
| `.claude/launch.json` | Dev-server config `valuation-journal` (port 5173) |

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

- **No backup, export or import.** Data exists only in one browser profile, and documents make this riskier: clearing site data deletes the files too. This is the biggest risk.
- **No in-app preview for Excel, Word and PowerPoint**, by design (no reliable local renderer without new dependencies or a cloud viewer). Their text is not indexed for search either. A text-only `.docx`/`.xlsx` extractor using the browser's `DecompressionStream` would be possible later.
- **Scanned PDFs** without a text layer can be viewed but not searched (no OCR).
- **Search inside files** scans every stored text on each (deferred) query. That is fine for dozens of documents; with hundreds of long filings it may feel slow and would need an index.
- **No PDF annotations or highlights saved** (the viewer has no editing tools enabled), no page thumbnails sidebar and no outline/bookmarks panel.
- **Document titles** derived from file names replace `-` and `_` with spaces ("bottom-up" becomes "bottom up"), as for snapshots; titles are editable.
- **Viewer full screen is unverified**: the in-app test pane refuses it. The app shows a toast when the request fails.
- **No pinch-to-zoom** in the image viewer on touch screens (not tested on a real touch device). PDF.js has its own pinch support, also untested.
- Images can't be dropped onto a specific card; dropping anywhere adds a phase snapshot. A card's "attach image" button links an upload to that card.
- Tasks and cards can't be reordered in the UI (the `order` fields exist). There is no rich text or Markdown in card content.
- There is only one journal (`'default'`). The `journals` table and `documents.journalId` exist for future use.
- The image viewer's `hidden sm:inline-flex` pin/edit buttons stay visible on phones (the `IconButton`-style base class wins). The document viewer uses `max-sm:hidden` instead. Pre-existing and harmless.
- There are no automated tests; verification is manual in the browser.
- Git history starts at the Milestone 3 checkpoint; earlier history exists only in DEVELOPMENT_LOG.md. There is no remote, so the repository is not backed up off this machine.
- The main bundle is ≈ 693 kB. Split it if it nears 800 kB.
- `dist/pdfjs/wasm/` ships `quickjs-eval.wasm` (≈ 469 kB) that is never used. The asset plugin could skip it; harmless for a local app.

## 9. Next steps (candidates; Milestone 4 not chosen yet)

1. **Backup and restore** (strongly recommended next, now that files are stored): export the whole database, blobs included, to a single file, and import it with validation and a preview. The import must merge or replace only with explicit confirmation.
2. **Recall mode:** review cards, formulas and extracts with spaced repetition. This needs a new table in schema v4.
3. **Multiple journals:** per-company or per-deal journals using the existing `journalId` (documents already carry it).
4. **Document follow-ups:** "save selection as extract" from the PDF viewer (with page number), text indexing for `.docx`/`.xlsx`, PDF outline and thumbnails, persistent highlights.
5. **Smaller items:**
   - Pinch-zoom in the image viewer.
   - Drop an image onto a card.
   - Reorder tasks and cards.
   - Markdown in cards.
6. **Outstanding checks from Milestone 3** (in a normal browser, outside the in-app pane): viewer full screen, a real file chooser and saved download, real Office files, password-protected and scanned PDFs, a large real filing, and `npm run preview` with the emitted `dist/pdfjs/` assets.
