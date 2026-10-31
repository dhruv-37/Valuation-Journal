import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Download, Info, LoaderCircle, Maximize2, Minimize2, Pencil, Trash, X } from 'lucide-react';
import type { ID, Phase, ResearchDocument } from '../../types';
import type { SearchSelection } from '../search/SearchPalette';
import { useAttachmentBlob, useDocument } from '../../hooks/useJournalData';
import { useBlobUrl } from '../../hooks/useBlobUrl';
import { DOCUMENT_KIND_META, formatBadge } from '../../lib/documents';
import { isTypingTarget, phaseNumber, plural } from '../../lib/format';
import { formatBytes } from '../../lib/images';
import { overlayStack } from '../ui/Modal';
import { IconButton } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { useDocumentActions } from './DocumentsContext';
import { DocumentInfoPanel } from './DocumentInfoPanel';
import { ImagePreview } from './previews/ImagePreview';
import { TextPreview } from './previews/TextPreview';
import { CsvPreview } from './previews/CsvPreview';
import { NoPreview } from './previews/NoPreview';

// PDF.js is only downloaded when a PDF is first opened.
const PdfViewer = lazy(() => import('./previews/PdfViewer').then((m) => ({ default: m.PdfViewer })));

export interface DocumentViewerState {
  id: ID;
  query?: string;
  /** Changes on every open, so reopening the same document starts fresh. */
  nonce: number;
}

interface DocumentViewerProps {
  state: DocumentViewerState | null;
  phases: Phase[];
  onClose: () => void;
  onNavigate: (selection: SearchSelection) => void;
}

/** Full-window document viewer with an info panel. Rendered in a portal above everything but dialogs. */
export function DocumentViewer(props: DocumentViewerProps) {
  return createPortal(<AnimatePresence>{props.state && <ViewerBody key={props.state.nonce} {...props} state={props.state} />}</AnimatePresence>, document.body);
}

function ViewerBody({ state, phases, onClose, onNavigate }: DocumentViewerProps & { state: DocumentViewerState }) {
  const live = useDocument(state.id);
  // Keep showing the last loaded record while closing after a delete.
  const stable = useRef<ResearchDocument | null>(null);
  if (live) stable.current = live;
  const doc = stable.current;
  const blob = useAttachmentBlob(doc?.attachmentId);
  const actions = useDocumentActions();
  const toast = useToast();
  const rootRef = useRef<HTMLDivElement>(null);
  const [infoOpen, setInfoOpen] = useState(() => window.innerWidth >= 1024);
  const [fullscreen, setFullscreen] = useState(false);
  const tokenRef = useRef<symbol | null>(null);
  const isActive = useCallback(() => !!tokenRef.current && overlayStack.isTop(tokenRef.current), []);

  // Deleted elsewhere (or a stale link): close.
  useEffect(() => {
    if (live === null) onClose();
  }, [live, onClose]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else if (!rootRef.current?.requestFullscreen) toast({ message: 'Full screen is not supported in this browser.', tone: 'error' });
    else rootRef.current.requestFullscreen().catch(() => toast({ message: 'The browser blocked full screen here.', tone: 'error' }));
  }, [toast]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  // Keyboard, only while this viewer is the topmost overlay (an editor may open above it).
  const keyState = useRef({ onClose, toggleFullscreen });
  keyState.current = { onClose, toggleFullscreen };
  useEffect(() => {
    const token = overlayStack.push();
    tokenRef.current = token;
    const onKey = (e: KeyboardEvent) => {
      if (!overlayStack.isTop(token) || e.ctrlKey || e.metaKey || e.altKey) return;
      const typing = isTypingTarget(e.target);
      let handled = true;
      if (e.key === 'Escape') {
        // First Escape leaves a text field (e.g. the PDF search box); the next one closes.
        if (typing) (e.target as HTMLElement).blur();
        else keyState.current.onClose();
      } else if (typing) handled = false;
      else if (e.key === 'f' || e.key === 'F') keyState.current.toggleFullscreen();
      else if (e.key === 'i' || e.key === 'I') setInfoOpen((o) => !o);
      else handled = false;
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      overlayStack.remove(token);
      tokenRef.current = null;
      window.removeEventListener('keydown', onKey, true);
    };
  }, []);

  const navigate = (selection: SearchSelection) => {
    onClose();
    onNavigate(selection);
  };

  const meta = doc ? DOCUMENT_KIND_META[doc.kind] : null;
  const Icon = meta?.icon;
  const phaseIndex = doc?.phaseId ? phases.findIndex((p) => p.id === doc.phaseId) : -1;
  const download = () => doc && actions.download(doc);

  return (
    <motion.div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={doc ? `Document: ${doc.title || doc.fileName}` : 'Document viewer'}
      className="fixed inset-0 z-[46] flex flex-col bg-canvas text-ink"
      initial={{ opacity: 0, scale: 0.995 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-canvas px-2 sm:gap-3 sm:px-5">
        {meta && Icon && (
          <span className={`hidden size-9 shrink-0 items-center justify-center rounded-lg sm:flex ${meta.soft} ${meta.text}`}>
            <Icon className="size-[18px]" />
          </span>
        )}
        <div className="min-w-0 flex-1 pl-1 sm:pl-0">
          <p className="truncate text-[10.5px] font-medium tracking-[0.14em] text-muted uppercase tabular">
            {doc && `${formatBadge(doc.fileName, doc.kind)} · ${formatBytes(doc.size)}`}
            {doc?.pageCount ? ` · ${plural(doc.pageCount, 'page')}` : ''}
            {phaseIndex >= 0 ? ` · Phase ${phaseNumber(phaseIndex)}` : doc && !doc.phaseId ? ' · Unfiled' : ''}
          </p>
          <h2 className="truncate font-display text-[17px] leading-tight">{doc ? doc.title || doc.fileName : 'Loading…'}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton label="Download original file" onClick={download} disabled={!doc}>
            <Download className="size-[18px]" />
          </IconButton>
          <IconButton label="Edit details and connections" onClick={() => doc && actions.edit(doc.id)} disabled={!doc} className="max-sm:hidden">
            <Pencil className="size-[17px]" />
          </IconButton>
          <IconButton label="Delete document" onClick={() => doc && actions.remove(doc)} disabled={!doc} className="hover:!text-type-warning max-sm:hidden">
            <Trash className="size-[17px]" />
          </IconButton>
          <IconButton label={fullscreen ? 'Exit full screen (F)' : 'Full screen (F)'} onClick={toggleFullscreen}>
            {fullscreen ? <Minimize2 className="size-[18px]" /> : <Maximize2 className="size-[18px]" />}
          </IconButton>
          <IconButton label="Details (I)" active={infoOpen} onClick={() => setInfoOpen((o) => !o)}>
            <Info className="size-[18px]" />
          </IconButton>
          <span className="mx-0.5 h-5 w-px bg-line" />
          <IconButton label="Close (Esc)" onClick={onClose}>
            <X className="size-5" />
          </IconButton>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          {!doc || blob === undefined ? (
            <Loading label="Opening document…" />
          ) : blob === null ? (
            <p className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">The stored file for this document is missing.</p>
          ) : (
            <Preview document={doc} blob={blob} query={state.query} isActive={isActive} onDownload={download} />
          )}
        </div>

        <AnimatePresence initial={false}>
          {infoOpen && doc && (
            <motion.aside
              key="info"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-x-0 bottom-0 z-10 max-h-[60%] overflow-y-auto border-t border-line bg-surface shadow-float lg:static lg:max-h-none lg:w-[340px] lg:shrink-0 lg:border-t-0 lg:border-l lg:shadow-none"
            >
              <DocumentInfoPanel document={doc} phases={phases} onNavigate={navigate} onEdit={() => actions.edit(doc.id)} />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

interface PreviewProps {
  document: ResearchDocument;
  blob: Blob;
  query?: string;
  isActive: () => boolean;
  onDownload: () => void;
}

function Preview({ document: doc, blob, query, isActive, onDownload }: PreviewProps) {
  const mode = DOCUMENT_KIND_META[doc.kind].preview;
  const fileKey = `doc:${doc.attachmentId}`;
  const url = useBlobUrl(mode === 'image' ? fileKey : null, blob);
  switch (mode) {
    case 'pdf':
      return (
        <Suspense fallback={<Loading label="Loading PDF viewer…" />}>
          <PdfViewer blob={blob} fileKey={fileKey} initialQuery={query} isActive={isActive} onDownload={onDownload} />
        </Suspense>
      );
    case 'image':
      return url ? <ImagePreview url={url} alt={doc.title} /> : <Loading label="Opening image…" />;
    case 'text':
    case 'markdown':
      return <TextPreview blob={blob} fileKey={fileKey} markdown={mode === 'markdown'} />;
    case 'csv':
      return <CsvPreview blob={blob} fileKey={fileKey} />;
    case 'none':
      return <NoPreview document={doc} onDownload={onDownload} />;
  }
}

function Loading({ label }: { label: string }) {
  return (
    <p className="flex h-full items-center justify-center gap-2 text-sm text-muted">
      <LoaderCircle className="size-4 animate-spin" /> {label}
    </p>
  );
}
