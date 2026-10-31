# Valuation Journal

A personal, local-first workspace for the DCF valuation process. The overview shows the workflow as a connected pathway of phases. Opening a phase takes you to its workspace, which holds:

- **Objectives** and a **work checklist**
- A **Knowledge journal**: concepts, formulas, assumptions, warnings and more
- A **Library**:
  - a **Snapshot library** of screenshots and images
  - **Important extracts**: key sentences, paragraphs, observations, formulas, explanations and lessons, each with its source
- **Documents**: the phase's research file (reports, models, filings), with an in-app PDF viewer

A central **Document Library** (the **Documents** button in the top bar) lists every document in the journal, organised by phase, with search that also looks inside PDFs, text, Markdown and CSV files.

Everything is stored in your browser's IndexedDB, including images and documents. There is no server, no account and no cloud viewer.

## Run it

```bash
npm install      # first time only
npm run dev      # start at http://localhost:5173
```

Other commands:

```bash
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build locally
```

## Capturing material (inside a phase)

| How | What happens |
| --- | --- |
| `Ctrl/Cmd + V` with a screenshot on the clipboard | Saved straight to the phase's Snapshot library |
| `Ctrl/Cmd + V` with copied text (not inside a text field) | Opens a new extract with the text filled in |
| `Ctrl/Cmd + V` with a copied file (e.g. a PDF from your file manager) | Saved as a document in the phase |
| Drag files anywhere onto the page | Images become snapshots; other supported files become documents. On the **Documents** tab every file, images included, becomes a document |
| **Upload image** / **Paste** / **New extract** in the Library tab | The same, with buttons |
| **Upload documents** / **Link existing** in the Documents tab | Add files to the phase, or connect documents filed elsewhere |
| Image icon on a knowledge card | Uploads an image that is linked to that card |
| Paperclip icon on a card or extract (or **Connected documents** in the image viewer) | Choose which documents it is connected to, or upload a new one |

Supported images for snapshots: PNG, JPG/JPEG and WebP, up to 25 MB each.

## Documents

| Format | In the app |
| --- | --- |
| PDF | Full viewer: pages, zoom, fit width / page, find with highlights, selectable text, full screen |
| Images (PNG, JPG, WebP, GIF) | Preview with fit and zoom |
| TXT, Markdown | Text preview; Markdown can be shown formatted or as source |
| CSV / TSV | Table preview (first 2,000 rows) |
| Excel, Word, PowerPoint (`.xlsx .xls .xlsm .docx .doc .rtf .pptx .ppt`) | Stored unchanged with details and download. **No in-app preview**: these can't be rendered reliably without a cloud viewer |

- Each document has a title, description, tags, the phase it is filed in, and connections to other phases, knowledge cards, extracts and snapshots. The details panel lists the connections and jumps to each one.
- Files up to 200 MB each. The Document Library shows how much browser storage is in use and can ask the browser to protect it from automatic clearing.
- Text inside PDFs, TXT, Markdown and CSV files is read in the background for search (up to about 750,000 characters per file). Scanned PDFs without a text layer can be viewed but not searched.
- Global search results for a PDF open it with the search already run inside the document.

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `Ctrl/Cmd + K` or `/` | Search the whole journal |
| `Esc` | Close dialog or viewer, or return from a phase to the pathway |
| `←` / `→` | Previous / next phase, or previous / next image in the viewer |
| `Enter` | Save inline edits (`Shift + Enter` for a new line) |
| `Ctrl/Cmd + Enter` | Save a card, snapshot, extract or document form |

**Image viewer:** `+` / `−` zoom, `0` fit to screen, `1` actual size, `F` full screen, `I` details panel. Use the mouse wheel to zoom at the cursor, drag to pan, and double-click to zoom in or back to fit.

**Document viewer:** `Ctrl/Cmd + F` find in the PDF, `Enter` / `Shift + Enter` next / previous match, `+` / `−` zoom, `Ctrl/Cmd + wheel` zoom at the cursor, `N` / `P` next / previous page, `F` full screen, `I` details panel, `Esc` leaves the search box and then closes the viewer.

## Project structure

```
src/
  types.ts                 Domain model (Phase, KnowledgeCard, Snapshot, KnowledgeExtract, ResearchDocument, Attachment…)
  db/
    database.ts            Dexie (IndexedDB) schema and versioned migrations
    seed.ts                Starter DCF journal: runs once, when the database is first created
    repository.ts          All writes: create / update / delete / reorder, including image and document storage
  hooks/
    useJournalData.ts      Live queries; components re-render when data changes
    useBlobUrl.ts          Shared, reference-counted object URLs for stored files (revoked when unused), downloads
    useHashRoute.ts        #/, #/phase/<id> and #/documents routing (back button + refresh work)
    useTheme.ts            Light / dark preference
  lib/
    images.ts              Image validation, dimensions and thumbnail generation
    documents.ts           Supported document formats, previews, size limits, storage estimate
    documentProcessing.ts  Background text indexing and thumbnails for new documents
    pdf.ts                 On-demand PDF.js loading, PDF text and first-page thumbnail
    csv.ts, markdown.ts    Small parsers for the CSV and Markdown previews
    search.ts              Global search across phases, tasks, cards, snapshots, extracts and documents
    cardTypes.ts, extractKinds.ts, format.ts
  components/
    overview/              Pathway, phase cards, summary
    workspace/             Zoom transition layer, phase header, objectives, checklist, journal, tabs
    library/               Snapshot gallery, image viewer, extracts, filters, editors, drop overlay
    documents/             Document Library page, phase Documents tab, viewer and previews, editor, link dialog
    phases/                Add / edit / reorder / delete phase dialogs
    search/                Global search palette
    ui/                    Buttons, modal, confirm dialog, toasts, inline editing, tag input, select…
scripts/
  vite-pdfjs-assets.mjs    Serves / copies PDF.js fonts, character maps and decoders under /pdfjs/
```

## Data notes

- The starter journal is written only when the database is created for the first time. Your edits are never overwritten on later launches.
- **Schema versions:** v1 (Milestone 1) holds phases, checklist, cards, attachments and meta. v2 (Milestone 2) adds `snapshots` and `extracts`. v3 (Milestone 3) adds `documents` and `documentTexts`. Each upgrade keeps all existing content. To evolve the schema, add a new `this.version(n)` block in `db/database.ts`; never edit an earlier version.
- Snapshot and document records hold metadata and a small thumbnail. Full files are stored separately in `attachments`, so lists stay fast.
- Deleting a snapshot deletes its stored image. Deleting a document deletes its file and search text. Deleting a card, extract or snapshot removes its connections but keeps the connected documents.
- Deleting a phase removes its tasks, cards, snapshots and extracts. Documents filed in it are kept in the Document Library as **Unfiled**.
- Data lives in the browser profile you use. A different browser (or a private window) starts with a fresh starter journal, and clearing site data deletes the journal, documents included. There is no backup or export yet, so keep your original files.
