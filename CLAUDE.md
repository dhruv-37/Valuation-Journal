# CLAUDE.md

Valuation Journal is a personal, local-first DCF knowledge workspace. It's built with React 19, TypeScript, Vite 8, Tailwind 4, Motion, Lucide and Dexie (IndexedDB). There is no backend.

**Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) first.** It describes the current architecture, schema and status. [DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md) holds the history and the reasons behind decisions.

## Commands

```bash
npm run dev        # http://localhost:5173 (launch config "valuation-journal")
npm run typecheck  # tsc only
npm run build      # tsc + vite build; must pass before a milestone is called done
```

There is no automated test suite. Verify behaviour in the browser.

## Hard rules

- **Never lose user data.**
  - Schema changes go in a new `this.version(n)` block in `src/db/database.ts`. Never edit an earlier version.
  - If an existing record must change, add an `.upgrade()`.
  - Test the upgrade against a database that holds data from the previous version.
- **The seed runs only in Dexie's `populate` event.** Never re-seed, reset or overwrite existing records.
- **All writes go through `src/db/repository.ts`.**
  - Multi-table changes, such as cascading deletes, run in one `db.transaction`.
  - Components read through `useLiveQuery` hooks in `src/hooks/useJournalData.ts`.
- **Binary data lives in IndexedDB.**
  - Store blobs in IndexedDB (`attachments`, or snapshot `thumbnail`), never in localStorage.
  - Object URLs come from `useBlobUrl` (refcounted, revoked when unused). Never call `URL.createObjectURL` ad hoc.
- **No cloud services and no new dependencies** unless clearly necessary. Prefer the existing stack.
- Don't rebuild or replace working features. Extend them.

## Conventions

- **Styling**
  - Use the Tailwind tokens from `src/index.css`: `canvas`, `surface`, `surface-2`, `line`, `ink`, `ink-2`, `muted`, `faint`, `gold*`, `type-*`, `font-display`, `font-mono`, `shadow-card/lift/float`.
  - Never hard-code colours.
  - Every surface must work in both light and dark (`.dark` class) themes.
  - Every layout must work at 375 px width with no horizontal scroll.
- **Overlays**
  - Use `ui/Modal` for dialogs.
  - Any other overlay that handles keys must join `overlayStack` from `ui/Modal.tsx`, so only the topmost overlay reacts.
  - Global shortcuts check `isDialogOpen()` and `isTypingTarget()`.
- **Feedback**
  - Use `useToast()` for messages and `useConfirm()` for destructive confirmations. Never use `alert` or `confirm`.
- **Icons**
  - Use `lucide-react`. Check the name exists before using it: `Trash` exists, `Trash2` and `BookMarked` do not.
- **Animation**
  - Use `motion/react`.
  - Don't put `layout` or `layoutId` on lists inside the workspace. The zoom transition transforms the parent, which breaks the measurements.
- **Code style**
  - Match the surrounding code: short doc comments explaining *why*, named exports, one component per file, and types in `src/types.ts`.
- **Routing**
  - Hash routes (`#/`, `#/phase/<id>`) via `router` in `src/hooks/useHashRoute.ts`.

## Testing notes

- Use the in-app browser (`preview_start` with "valuation-journal").
  - When the pane is hidden, `requestAnimationFrame` pauses. Exit animations freeze and screenshots go stale, so don't mistake this for an app bug.
- To test migrations or a fresh seed, delete the `valuation-journal` IndexedDB database in the test browser only.
  - Never do this to the user's real data without asking.
- Check the console for errors after each flow.

## Documentation upkeep

After every major milestone:
- Update PROJECT_CONTEXT.md (state, schema, files, issues, next steps).
- Append to DEVELOPMENT_LOG.md (what changed, key decisions, bugs fixed, verification).
- Update README.md if user-facing behaviour changed.
- Make a git checkpoint commit (branch `main`) once the build passes and the docs are updated.

Record only what was actually verified.
