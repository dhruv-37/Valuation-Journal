import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, Info, Maximize2, Minimize2, Paperclip, Pencil, Pin, PinOff, Scan, X, ZoomIn, ZoomOut } from 'lucide-react';
import { db } from '../../db/database';
import { setSnapshotPinned } from '../../db/repository';
import type { Phase, Snapshot } from '../../types';
import { useBlobUrl } from '../../hooks/useBlobUrl';
import { CARD_TYPE_META } from '../../lib/cardTypes';
import { formatDate, phaseNumber } from '../../lib/format';
import { formatBytes } from '../../lib/images';
import { overlayStack } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { SnapshotThumb } from './SnapshotThumb';
import { useItemDocuments } from '../../hooks/useJournalData';
import { useDocumentActions } from '../documents/DocumentsContext';
import { DocumentChips } from '../documents/DocumentChips';

interface ImageViewerProps {
  snapshots: Snapshot[];
  index: number;
  phases: Phase[];
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onEdit: (snapshot: Snapshot) => void;
}

const MIN_SCALE = 0.05;
const MAX_SCALE = 8;
const STEP = 1.25;
const PAD = 32;

interface View {
  scale: number;
  x: number;
  y: number;
  /** While fitted, scale follows the stage size (e.g. on resize or info-panel toggle). */
  fitted: boolean;
}

const FITTED: View = { scale: 1, x: 0, y: 0, fitted: true };

/** Distraction-free viewer. Rendered in a portal so it always covers the whole window. */
export function ImageViewer(props: ImageViewerProps) {
  return createPortal(
    <AnimatePresence>{props.snapshots[props.index] && <ViewerBody key="viewer" {...props} />}</AnimatePresence>,
    document.body,
  );
}

function ViewerBody({ snapshots, index, phases, onIndexChange, onClose, onEdit }: ImageViewerProps) {
  const snapshot = snapshots[index];
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>(FITTED);
  const [smooth, setSmooth] = useState(true);
  const [infoOpen, setInfoOpen] = useState(() => window.innerWidth >= 1024);
  const [fullscreen, setFullscreen] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const attachment = useLiveQuery(() => db.attachments.get(snapshot.attachmentId), [snapshot.attachmentId]);
  const fullUrl = useBlobUrl(attachment ? `img:${attachment.id}` : null, attachment?.blob);

  const fitScale =
    stage.w && stage.h ? Math.min(1, (stage.w - PAD * 2) / snapshot.width, (stage.h - PAD * 2) / snapshot.height) : 1;
  const scale = view.fitted ? fitScale : view.scale;
  const x = view.fitted ? 0 : view.x;
  const y = view.fitted ? 0 : view.y;
  const canPan = snapshot.width * scale > stage.w + 1 || snapshot.height * scale > stage.h + 1;

  // Measure the stage (changes with window size, full screen and the info panel).
  useLayoutEffect(() => {
    const el = stageRef.current!;
    const measure = () => setStage({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // New image: back to fit.
  useEffect(() => {
    setSmooth(false);
    setView(FITTED);
  }, [snapshot.id]);

  const clampPan = useCallback(
    (v: View): View => {
      const maxX = Math.max(0, (snapshot.width * v.scale - stage.w) / 2 + PAD);
      const maxY = Math.max(0, (snapshot.height * v.scale - stage.h) / 2 + PAD);
      const fitsX = snapshot.width * v.scale <= stage.w;
      const fitsY = snapshot.height * v.scale <= stage.h;
      return {
        ...v,
        x: fitsX ? 0 : Math.min(maxX, Math.max(-maxX, v.x)),
        y: fitsY ? 0 : Math.min(maxY, Math.max(-maxY, v.y)),
      };
    },
    [snapshot.width, snapshot.height, stage.w, stage.h],
  );

  /** Zoom keeping the point under `anchor` (relative to the stage centre) still. */
  const zoomTo = useCallback(
    (next: number, anchor = { x: 0, y: 0 }, animate = true) => {
      const target = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
      setSmooth(animate);
      setView(
        clampPan({
          scale: target,
          x: anchor.x - (anchor.x - x) * (target / scale),
          y: anchor.y - (anchor.y - y) * (target / scale),
          fitted: false,
        }),
      );
    },
    [clampPan, scale, x, y],
  );

  const fit = useCallback(() => {
    setSmooth(true);
    setView(FITTED);
  }, []);

  const toast = useToast();
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

  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next >= 0 && next < snapshots.length) onIndexChange(next);
    },
    [index, snapshots.length, onIndexChange],
  );

  // Keyboard: only while the viewer is the topmost overlay (an editor may open above it).
  const keyState = useRef({ go, zoomTo, fit, toggleFullscreen, onClose, scale });
  keyState.current = { go, zoomTo, fit, toggleFullscreen, onClose, scale };
  useEffect(() => {
    const token = overlayStack.push();
    const onKey = (e: KeyboardEvent) => {
      if (!overlayStack.isTop(token) || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = keyState.current;
      const handled = (() => {
        switch (e.key) {
          case 'Escape': k.onClose(); return true;
          case 'ArrowLeft': k.go(-1); return true;
          case 'ArrowRight': k.go(1); return true;
          case '+': case '=': k.zoomTo(k.scale * STEP); return true;
          case '-': case '_': k.zoomTo(k.scale / STEP); return true;
          case '0': k.fit(); return true;
          case '1': k.zoomTo(1); return true;
          case 'f': case 'F': k.toggleFullscreen(); return true;
          case 'i': case 'I': setInfoOpen((o) => !o); return true;
          default: return false;
        }
      })();
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      overlayStack.remove(token);
      window.removeEventListener('keydown', onKey, true);
    };
  }, []);

  // Wheel zoom around the cursor (non-passive so the page doesn't scroll).
  useEffect(() => {
    const el = stageRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const anchor = { x: e.clientX - rect.left - rect.width / 2, y: e.clientY - rect.top - rect.height / 2 };
      keyState.current.zoomTo(keyState.current.scale * Math.exp(-e.deltaY * 0.0015), anchor, false);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0 || !canPan) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, vx: x, vy: y };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    setSmooth(false);
    const d = drag.current;
    setView(clampPan({ scale, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y, fitted: false }));
  };
  const endDrag = () => (drag.current = null);

  const onDoubleClick = (e: React.MouseEvent) => {
    const rect = stageRef.current!.getBoundingClientRect();
    const anchor = { x: e.clientX - rect.left - rect.width / 2, y: e.clientY - rect.top - rect.height / 2 };
    if (scale <= fitScale * 1.01) zoomTo(Math.max(1, fitScale * 2.5), anchor);
    else fit();
  };

  const phaseIndex = phases.findIndex((p) => p.id === snapshot.phaseId);
  const loaded = loadedId === snapshot.id && !!fullUrl;

  return (
    <motion.div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Image viewer: ${snapshot.title}`}
      className="fixed inset-0 z-[45] flex flex-col bg-[#0e0d0b] text-[#ece8e1]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/10 px-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10.5px] font-medium tracking-[0.14em] text-white/45 uppercase tabular">
            {index + 1} of {snapshots.length}
            {phaseIndex >= 0 && ` · Phase ${phaseNumber(phaseIndex)}`}
          </p>
          <h2 className="truncate font-display text-[17px] leading-tight">{snapshot.title || 'Untitled snapshot'}</h2>
        </div>
        <div className="flex items-center gap-0.5">
          <ToolButton label="Zoom out (−)" onClick={() => zoomTo(scale / STEP)} disabled={scale <= MIN_SCALE}>
            <ZoomOut className="size-[18px]" />
          </ToolButton>
          <button
            type="button"
            onClick={() => (view.fitted ? zoomTo(1) : fit())}
            title={view.fitted ? 'Actual size (1)' : 'Fit to screen (0)'}
            className="hidden h-9 w-14 rounded-lg text-xs text-white/70 tabular hover:bg-white/10 hover:text-white sm:block"
          >
            {Math.round(scale * 100)}%
          </button>
          <ToolButton label="Zoom in (+)" onClick={() => zoomTo(scale * STEP)} disabled={scale >= MAX_SCALE}>
            <ZoomIn className="size-[18px]" />
          </ToolButton>
          <ToolButton label="Fit to screen (0)" onClick={fit} active={view.fitted}>
            <Scan className="size-[18px]" />
          </ToolButton>
          <ToolButton label={fullscreen ? 'Exit full screen (F)' : 'Full screen (F)'} onClick={toggleFullscreen}>
            {fullscreen ? <Minimize2 className="size-[18px]" /> : <Maximize2 className="size-[18px]" />}
          </ToolButton>
          <span className="mx-1 hidden h-5 w-px bg-white/15 sm:block" />
          <ToolButton label={snapshot.pinned ? 'Unpin' : 'Pin as important'} onClick={() => setSnapshotPinned(snapshot.id, !snapshot.pinned)} active={snapshot.pinned} className="hidden sm:inline-flex">
            {snapshot.pinned ? <PinOff className="size-[18px]" /> : <Pin className="size-[18px]" />}
          </ToolButton>
          <ToolButton label="Edit details" onClick={() => onEdit(snapshot)} className="hidden sm:inline-flex">
            <Pencil className="size-[17px]" />
          </ToolButton>
          <ToolButton label="Details (I)" onClick={() => setInfoOpen((o) => !o)} active={infoOpen}>
            <Info className="size-[18px]" />
          </ToolButton>
          <ToolButton label="Close (Esc)" onClick={onClose}>
            <X className="size-5" />
          </ToolButton>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <div
          ref={stageRef}
          className={`relative min-w-0 flex-1 touch-none overflow-hidden select-none ${canPan ? (drag.current ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={onDoubleClick}
        >
          <AnimatePresence initial={false}>
            <motion.div
              key={snapshot.id}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <div
                className="absolute top-1/2 left-1/2"
                style={{
                  width: snapshot.width,
                  height: snapshot.height,
                  transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`,
                  transition: smooth ? 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
                  willChange: 'transform',
                }}
              >
                {/* The thumbnail holds the space until the full-resolution image has decoded. */}
                {!loaded && <SnapshotThumb snapshot={snapshot} className="absolute inset-0 h-full w-full" />}
                {fullUrl && (
                  <img
                    src={fullUrl}
                    alt={snapshot.title}
                    draggable={false}
                    onLoad={() => setLoadedId(snapshot.id)}
                    className={`absolute inset-0 h-full w-full transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                  />
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {index > 0 && <NavButton side="left" label="Previous image (←)" onClick={() => go(-1)} />}
          {index < snapshots.length - 1 && <NavButton side="right" label="Next image (→)" onClick={() => go(1)} />}
        </div>

        <AnimatePresence initial={false}>
          {infoOpen && (
            <motion.aside
              key="info"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-x-0 bottom-0 max-h-[55%] overflow-y-auto border-t border-white/10 bg-[#151412]/95 backdrop-blur lg:static lg:max-h-none lg:w-[340px] lg:shrink-0 lg:border-t-0 lg:border-l"
            >
              <InfoPanel snapshot={snapshot} phases={phases} />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {snapshots.length > 1 && (
        <nav aria-label="Images" className="flex h-[72px] shrink-0 items-center gap-2 overflow-x-auto border-t border-white/10 px-3 sm:px-5">
          {snapshots.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onIndexChange(i)}
              aria-label={`Show ${s.title || `image ${i + 1}`}`}
              aria-current={i === index}
              className={`h-12 w-16 shrink-0 overflow-hidden rounded-md border bg-white/5 transition ${
                i === index ? 'border-[#d0aa55] opacity-100' : 'border-white/10 opacity-50 hover:opacity-90'
              }`}
            >
              <SnapshotThumb snapshot={s} className="h-full w-full" fit="cover" />
            </button>
          ))}
        </nav>
      )}
    </motion.div>
  );
}

function InfoPanel({ snapshot, phases }: { snapshot: Snapshot; phases: Phase[] }) {
  const cards = useLiveQuery(() => db.cards.bulkGet(snapshot.cardIds), [snapshot.cardIds.join()]) ?? [];
  const documents = useItemDocuments('snapshot', snapshot.id);
  const documentActions = useDocumentActions();
  const phaseIndex = phases.findIndex((p) => p.id === snapshot.phaseId);
  const phase = phases[phaseIndex];

  return (
    <div className="space-y-5 px-5 py-5 text-sm">
      <div>
        <h3 className="font-display text-xl leading-snug">{snapshot.title || 'Untitled snapshot'}</h3>
        {snapshot.caption && <p className="mt-1.5 text-[13px] text-white/60 italic">{snapshot.caption}</p>}
        {snapshot.description && <p className="mt-3 leading-relaxed whitespace-pre-wrap text-white/80">{snapshot.description}</p>}
      </div>

      <dl className="space-y-2 border-t border-white/10 pt-4 text-[13px]">
        {phase && <Meta label="Phase" value={`${phaseNumber(phaseIndex)} · ${phase.title}`} />}
        <Meta label="Added" value={formatDate(snapshot.createdAt)} />
        <Meta label="Dimensions" value={`${snapshot.width} × ${snapshot.height}`} />
        <Meta label="File" value={`${snapshot.mimeType.split('/')[1].toUpperCase().replace('JPEG', 'JPG')} · ${formatBytes(snapshot.size)}`} />
      </dl>

      {snapshot.tags.length > 0 && (
        <div className="border-t border-white/10 pt-4">
          <p className="mb-2 text-[10.5px] font-semibold tracking-wider text-white/40 uppercase">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {snapshot.tags.map((t) => (
              <span key={t} className="rounded-md bg-white/8 px-2 py-0.5 text-xs text-white/75">
                #{t}
              </span>
            ))}
          </div>
        </div>
      )}

      {cards.some(Boolean) && (
        <div className="border-t border-white/10 pt-4">
          <p className="mb-2 text-[10.5px] font-semibold tracking-wider text-white/40 uppercase">Linked knowledge cards</p>
          <ul className="space-y-1.5">
            {cards.map((c) => {
              if (!c) return null;
              const meta = CARD_TYPE_META[c.type];
              const Icon = meta.icon;
              return (
                <li key={c.id} className="flex items-center gap-2 text-[13px] text-white/80">
                  <Icon className="size-3.5 shrink-0 text-[#d0aa55]" />
                  <span className="truncate">{c.title || 'Untitled card'}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="border-t border-white/10 pt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[10.5px] font-semibold tracking-wider text-white/40 uppercase">Connected documents</p>
          <button
            type="button"
            onClick={() => documentActions.linkTo({ kind: 'snapshot', id: snapshot.id, label: snapshot.title, phaseId: snapshot.phaseId })}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-white/60 hover:bg-white/10 hover:text-white"
          >
            <Paperclip className="size-3" /> {documents.length ? 'Edit' : 'Connect'}
          </button>
        </div>
        {documents.length > 0 ? <DocumentChips documents={documents} tone="dark" /> : <p className="text-[13px] text-white/45">None yet.</p>}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-white/45">{label}</dt>
      <dd className="truncate text-right text-white/85 tabular">{value}</dd>
    </div>
  );
}

function ToolButton({
  label,
  onClick,
  children,
  disabled,
  active,
  className = '',
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex size-9 items-center justify-center rounded-lg transition-colors disabled:opacity-30 ${
        active ? 'bg-white/10 text-[#d0aa55]' : 'text-white/70 hover:bg-white/10 hover:text-white'
      } ${className}`}
    >
      {children}
    </button>
  );
}

function NavButton({ side, label, onClick }: { side: 'left' | 'right'; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className={`absolute top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/80 backdrop-blur transition hover:bg-black/60 hover:text-white ${
        side === 'left' ? 'left-3 sm:left-5' : 'right-3 sm:right-5'
      }`}
    >
      {side === 'left' ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
    </button>
  );
}
