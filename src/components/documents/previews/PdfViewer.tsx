import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, LoaderCircle, Lock, MoveHorizontal, Search, X, ZoomIn, ZoomOut } from 'lucide-react';
import 'pdfjs-dist/web/pdf_viewer.css';
import type { EventBus, PDFViewer as CoreViewer } from 'pdfjs-dist/web/pdf_viewer.mjs';
import { loadPdfjs, loadPdfViewer, pdfSource } from '../../../lib/pdf';
import { isTypingTarget } from '../../../lib/format';
import { Button, IconButton } from '../../ui/Button';
import { inputClass } from '../../ui/Field';

interface PdfViewerProps {
  blob: Blob;
  /** Identifies the file; the viewer reloads only when this changes (not on every new Blob object). */
  fileKey: string;
  /** Search text to run once the pages are ready (from global search). */
  initialQuery?: string;
  /** Whether the viewer owns the keyboard (it is the topmost overlay). */
  isActive: () => boolean;
  onDownload: () => void;
}

type Status = { kind: 'loading' } | { kind: 'ready' } | { kind: 'password'; wrong: boolean } | { kind: 'error'; message: string };
type FindStatus = 'idle' | 'pending' | 'found' | 'none';

const SCALE_OPTIONS = [
  { value: 'auto', label: 'Automatic' },
  { value: 'page-width', label: 'Fit width' },
  { value: 'page-fit', label: 'Fit page' },
  ...[0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4].map((s) => ({ value: String(s), label: `${s * 100}%` })),
];

/**
 * Embedded PDF.js viewer: continuous pages rendered on demand, a selectable
 * text layer, find-in-document with highlights, zoom, fit width and page
 * navigation. Runs entirely in the browser from the stored file.
 */
export function PdfViewer({ blob, fileKey, initialQuery, isActive, onDownload }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const core = useRef<{ viewer: CoreViewer; bus: EventBus } | null>(null);
  const passwordCallback = useRef<((password: string) => void) | null>(null);
  const blobRef = useRef(blob);
  blobRef.current = blob;

  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [scale, setScale] = useState(1);
  const [preset, setPreset] = useState<string | null>('page-width');
  const [query, setQuery] = useState(initialQuery ?? '');
  const [findStatus, setFindStatus] = useState<FindStatus>('idle');
  const [matches, setMatches] = useState({ current: 0, total: 0 });
  const [password, setPassword] = useState('');

  const runFind = (type: '' | 'again', findPrevious = false, text = query) => {
    const bus = core.current?.bus;
    if (!bus) return;
    if (!text.trim()) {
      bus.dispatch('findbarclose', { source: null });
      setFindStatus('idle');
      setMatches({ current: 0, total: 0 });
      return;
    }
    bus.dispatch('find', { source: null, type, query: text, caseSensitive: false, entireWord: false, highlightAll: true, findPrevious, matchDiacritics: false });
  };
  const runFindRef = useRef(runFind);
  runFindRef.current = runFind;

  // Load the document. Keyed by fileKey so live-query refreshes (new Blob objects) don't reload it.
  useEffect(() => {
    let cancelled = false;
    const abort = new AbortController();
    let destroyTask: (() => void) | null = null;
    setStatus({ kind: 'loading' });

    (async () => {
      const lib = await loadPdfjs();
      const mod = await loadPdfViewer();
      if (cancelled || !containerRef.current || !pagesRef.current) return;

      const bus = new mod.EventBus();
      const linkService = new mod.PDFLinkService({ eventBus: bus, externalLinkTarget: mod.LinkTarget.BLANK, externalLinkRel: 'noopener noreferrer nofollow' });
      const findController = new mod.PDFFindController({ eventBus: bus, linkService });
      const viewer = new mod.PDFViewer({
        container: containerRef.current,
        viewer: pagesRef.current,
        eventBus: bus,
        linkService,
        findController,
        annotationMode: lib.AnnotationMode.ENABLE,
        // Supported by the viewer (removes its scroll and resize listeners) but missing from its type definitions.
        abortSignal: abort.signal,
      } as ConstructorParameters<typeof mod.PDFViewer>[0]);
      linkService.setViewer(viewer);

      bus.on('pagesinit', () => {
        viewer.currentScaleValue = 'page-width';
        if (initialQuery?.trim()) runFindRef.current('', false, initialQuery);
      });
      bus.on('pagechanging', ({ pageNumber }: { pageNumber: number }) => {
        setPage(pageNumber);
        setPageInput(String(pageNumber));
      });
      bus.on('scalechanging', ({ scale: s, presetValue }: { scale: number; presetValue?: string }) => {
        setScale(s);
        setPreset(presetValue ?? null);
      });
      const onMatches = ({ matchesCount }: { matchesCount: { current: number; total: number } }) => setMatches(matchesCount);
      bus.on('updatefindmatchescount', onMatches);
      bus.on('updatefindcontrolstate', (e: { state: number; matchesCount: { current: number; total: number } }) => {
        setFindStatus(e.state === mod.FindState.PENDING ? 'pending' : e.state === mod.FindState.NOT_FOUND ? 'none' : 'found');
        onMatches(e);
      });

      const task = lib.getDocument(pdfSource(new Uint8Array(await blobRef.current.arrayBuffer())));
      destroyTask = () => void task.destroy();
      if (cancelled) return destroyTask();
      task.onPassword = (update: (password: string) => void, reason: number) => {
        passwordCallback.current = update;
        setStatus({ kind: 'password', wrong: reason === lib.PasswordResponses.INCORRECT_PASSWORD });
      };
      const doc = await task.promise;
      if (cancelled) return;
      viewer.setDocument(doc);
      linkService.setDocument(doc);
      core.current = { viewer, bus };
      setPageCount(doc.numPages);
      setStatus({ kind: 'ready' });
      containerRef.current?.focus({ preventScroll: true });
    })().catch((error: unknown) => {
      if (cancelled) return;
      const name = error instanceof Error ? error.name : '';
      setStatus({
        kind: 'error',
        message: name === 'InvalidPDFException' ? 'This file is not a valid PDF, or it is damaged.' : 'This PDF could not be displayed.',
      });
    });

    return () => {
      cancelled = true;
      core.current?.viewer.setDocument(null);
      core.current = null;
      abort.abort();
      destroyTask?.();
    };
    // initialQuery is only applied on first load; the blob is read through a ref.
  }, [fileKey]);

  // Keep "Fit width" / "Fit page" fitted when the window or the info panel changes size
  // (the embeddable viewer, unlike the full PDF.js app, doesn't do this itself).
  useEffect(() => {
    const el = containerRef.current!;
    let width = el.clientWidth;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const viewer = core.current?.viewer;
        const value = viewer?.currentScaleValue;
        if (viewer && (value === 'page-width' || value === 'page-fit' || value === 'auto')) viewer.currentScaleValue = value;
      });
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  // Ctrl/Cmd + wheel zooms around the cursor instead of zooming the whole page.
  useEffect(() => {
    const el = containerRef.current!;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !core.current) return;
      e.preventDefault();
      core.current.viewer.updateScale({ steps: e.deltaY < 0 ? 1 : -1, origin: [e.clientX, e.clientY], drawingDelay: 300 });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Keyboard: Ctrl/Cmd+F jumps to the search box; + and − zoom; N / P change page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isActive() || !core.current) return;
      const viewer = core.current.viewer;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      const handled = (() => {
        switch (e.key) {
          case '+': case '=': viewer.increaseScale(); return true;
          case '-': case '_': viewer.decreaseScale(); return true;
          case 'n': case 'N': viewer.nextPage(); return true;
          case 'p': case 'P': viewer.previousPage(); return true;
          default: return false;
        }
      })();
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isActive]);

  const goToPage = (e: FormEvent) => {
    e.preventDefault();
    const n = Math.min(pageCount, Math.max(1, Number.parseInt(pageInput, 10) || page));
    if (core.current) core.current.viewer.currentPageNumber = n;
    setPageInput(String(n));
  };

  const setScaleValue = (value: string) => {
    if (core.current) core.current.viewer.currentScaleValue = value;
  };

  const onSearchKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runFind(findStatus === 'idle' ? '' : 'again', e.shiftKey);
    }
  };

  const ready = status.kind === 'ready';
  const scaleOption = preset ?? (SCALE_OPTIONS.some((o) => o.value === String(scale)) ? String(scale) : 'custom');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5 border-b border-line bg-surface px-2 py-1.5 sm:px-4" role="toolbar" aria-label="PDF controls">
        <div className="flex items-center gap-0.5">
          <IconButton size="sm" label="Previous page (P)" disabled={!ready || page <= 1} onClick={() => core.current?.viewer.previousPage()}>
            <ChevronLeft className="size-4" />
          </IconButton>
          <form onSubmit={goToPage} className="flex items-center gap-1.5 text-[13px] text-muted tabular">
            <input
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
              onBlur={goToPage}
              disabled={!ready}
              inputMode="numeric"
              aria-label="Page number"
              className="h-7 w-11 rounded-md border border-line bg-surface text-center text-ink outline-none focus:border-gold/70"
            />
            <span className="whitespace-nowrap">/ {pageCount || '–'}</span>
          </form>
          <IconButton size="sm" label="Next page (N)" disabled={!ready || page >= pageCount} onClick={() => core.current?.viewer.nextPage()}>
            <ChevronRight className="size-4" />
          </IconButton>
        </div>

        <span className="mx-1 hidden h-5 w-px bg-line sm:block" />

        <div className="flex items-center gap-0.5">
          <IconButton size="sm" label="Zoom out (−)" disabled={!ready} onClick={() => core.current?.viewer.decreaseScale()}>
            <ZoomOut className="size-4" />
          </IconButton>
          <label className="relative">
            <span className="sr-only">Zoom</span>
            <select
              value={scaleOption}
              onChange={(e) => setScaleValue(e.target.value)}
              disabled={!ready}
              className="h-7 w-[92px] cursor-pointer appearance-none rounded-md border border-line bg-surface pr-6 pl-2 text-[13px] text-ink outline-none tabular focus:border-gold/70"
            >
              {scaleOption === 'custom' && <option value="custom">{Math.round(scale * 100)}%</option>}
              {SCALE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-1.5 size-3.5 -translate-y-1/2 text-muted" />
          </label>
          <IconButton size="sm" label="Zoom in (+)" disabled={!ready} onClick={() => core.current?.viewer.increaseScale()}>
            <ZoomIn className="size-4" />
          </IconButton>
          <IconButton size="sm" label="Fit width" active={preset === 'page-width'} disabled={!ready} onClick={() => setScaleValue('page-width')}>
            <MoveHorizontal className="size-4" />
          </IconButton>
        </div>

        <div className="flex min-w-0 basis-full items-center gap-1 sm:ml-auto sm:basis-auto">
          <div className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md border border-line bg-surface px-2 focus-within:border-gold/70 sm:w-64 sm:flex-none">
            <Search className="size-3.5 shrink-0 text-faint" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                runFind('', false, e.target.value);
              }}
              onKeyDown={onSearchKey}
              disabled={!ready}
              placeholder="Find in document"
              aria-label="Find in document (Ctrl+F)"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
            />
            <span className="shrink-0 text-[11.5px] text-muted tabular" aria-live="polite">
              {findStatus === 'pending' ? 'Searching…' : findStatus === 'none' ? 'No matches' : matches.total > 0 ? `${matches.current} of ${matches.total}` : ''}
            </span>
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery('');
                  runFind('', false, '');
                }}
                className="rounded p-0.5 text-muted hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <IconButton size="sm" label="Previous match (Shift+Enter)" disabled={!ready || !query || matches.total === 0} onClick={() => runFind('again', true)}>
            <ChevronUp className="size-4" />
          </IconButton>
          <IconButton size="sm" label="Next match (Enter)" disabled={!ready || !query || matches.total === 0} onClick={() => runFind('again', false)}>
            <ChevronDown className="size-4" />
          </IconButton>
        </div>
      </div>

      <div className="vj-pdf relative min-h-0 flex-1 bg-surface-2">
        <div ref={containerRef} tabIndex={0} className="absolute inset-0 overflow-auto outline-none" aria-label="PDF pages">
          <div ref={pagesRef} className="pdfViewer" />
        </div>

        {status.kind === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted">
            <LoaderCircle className="size-4 animate-spin" /> Opening PDF…
          </div>
        )}
        {status.kind === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-sm rounded-2xl border border-line bg-surface p-6 text-center shadow-card">
              <p className="font-display text-lg text-ink">{status.message}</p>
              <p className="mt-1.5 text-sm text-muted">The original file is still stored. Download it to open it in another PDF reader.</p>
              <Button className="mt-4" size="sm" icon={<Download className="size-3.5" />} onClick={onDownload}>
                Download file
              </Button>
            </div>
          </div>
        )}
        {status.kind === 'password' && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <form
              className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-card"
              onSubmit={(e) => {
                e.preventDefault();
                setStatus({ kind: 'loading' });
                passwordCallback.current?.(password);
                setPassword('');
              }}
            >
              <p className="flex items-center gap-2 font-display text-lg text-ink">
                <Lock className="size-4 text-gold" /> Password-protected PDF
              </p>
              <p className="mt-1 text-sm text-muted">{status.wrong ? 'That password is not correct. Try again.' : 'Enter the password to open it. It is not stored.'}</p>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} mt-4`}
                aria-label="PDF password"
                autoFocus
              />
              <Button type="submit" variant="primary" size="sm" className="mt-3 w-full" disabled={!password}>
                Open PDF
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
