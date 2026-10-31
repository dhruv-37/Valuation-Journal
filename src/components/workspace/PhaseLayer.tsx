import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import { ArrowLeft, Brain, ChevronLeft, ChevronRight, Files, Search } from 'lucide-react';
import type { ID, Phase } from '../../types';
import { phaseNumber, isTypingTarget } from '../../lib/format';
import { isDialogOpen } from '../ui/Modal';
import { router } from '../../hooks/useHashRoute';
import { useActiveJournal } from '../../hooks/useActiveJournal';
import { IconButton, Kbd } from '../ui/Button';
import { ThemeToggle } from '../ThemeToggle';
import { BrandMark } from '../BrandMark';
import { PhaseWorkspace, type FocusTarget, type WorkspaceTab } from './PhaseWorkspace';

const FULL = 'inset(0px 0px 0px 0px round 0px)';
const EASE = [0.32, 0.72, 0, 1] as const;

/** Viewport rectangle of a phase card on the overview, if it is on screen. */
function cardClip(phaseId: ID): string | null {
  const el = document.querySelector<HTMLElement>(`[data-phase-card="${CSS.escape(phaseId)}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (r.bottom < 0 || r.top > vh || r.width === 0) return null;
  return `inset(${r.top}px ${vw - r.right}px ${vh - r.bottom}px ${r.left}px round 16px)`;
}

/**
 * The layer clips itself to the clicked card and expands to fill the screen,
 * so the card appears to open into its workspace (and shrinks back on exit).
 * Uses clip-path rather than scaling so text never distorts mid-animation.
 */
const layerVariants: Variants = {
  closed: (phaseId: ID) => {
    const clip = cardClip(phaseId);
    return clip
      ? { clipPath: clip, opacity: 1, transition: { duration: 0.42, ease: EASE } }
      : { clipPath: FULL, opacity: 0, scale: 0.985, transition: { duration: 0.24 } };
  },
  open: { clipPath: FULL, opacity: 1, scale: 1, transition: { duration: 0.5, ease: EASE } },
};

/**
 * With "reduce motion" on, a short cross-fade instead of the zoom. MotionConfig
 * only switches off transforms; the clip-path expansion would still run.
 */
const reducedLayerVariants: Variants = {
  closed: { clipPath: FULL, opacity: 0, transition: { duration: 0.15 } },
  open: { clipPath: FULL, opacity: 1, transition: { duration: 0.15 } },
};

const contentVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
  leave: (dir: number) => ({ opacity: 0, x: dir * -28, transition: { duration: 0.16 } }),
};

interface PhaseLayerProps {
  phaseId: ID;
  phases: Phase[];
  focus: FocusTarget | null;
  /** Names the page the back button returns to ("Pathway" or "Documents"). */
  backLabel: string;
  onClose: () => void;
  onNavigate: (id: ID) => void;
  onEditPhase: (phase: Phase) => void;
  onSearch: () => void;
}

export function PhaseLayer({ phaseId, phases, focus, backLabel, onClose, onNavigate, onEditPhase, onSearch }: PhaseLayerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const journal = useActiveJournal();
  const index = phases.findIndex((p) => p.id === phaseId);
  const phase = phases[index];
  const prev = phases[index - 1];
  const next = phases[index + 1];

  // The selected tab carries over when moving between adjacent phases.
  const [tab, setTab] = useState<WorkspaceTab>('journal');

  // Direction of travel for the slide between adjacent phases.
  const [direction, setDirection] = useState(1);
  const lastIndex = useRef(index);
  if (lastIndex.current !== index) {
    setDirection(index > lastIndex.current ? 1 : -1);
    lastIndex.current = index;
  }

  // Lock page scroll underneath and keep the matching overview card in view,
  // so closing shrinks back into the right card.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    document.querySelector(`[data-phase-card="${CSS.escape(phaseId)}"]`)?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, [phaseId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isDialogOpen() || isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && prev) onNavigate(prev.id);
      else if (e.key === 'ArrowRight' && next) onNavigate(next.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNavigate, prev, next]);

  return (
    <motion.div
      ref={scrollRef}
      className="fixed inset-0 z-40 overflow-x-hidden overflow-y-auto overscroll-contain bg-canvas"
      custom={phaseId}
      variants={reduceMotion ? reducedLayerVariants : layerVariants}
      initial="closed"
      animate="open"
      exit="closed"
      role="region"
      aria-label={phase ? `Phase ${index + 1}: ${phase.title}` : 'Phase workspace'}
    >
      <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-3 px-4 sm:px-8">
          <button
            type="button"
            onClick={onClose}
            className="-ml-2 flex h-9 items-center gap-2 rounded-lg px-2 text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">{backLabel}</span>
          </button>
          <span className="h-5 w-px bg-line" />
          <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            <button type="button" onClick={onClose} className="hidden shrink-0 rounded-md hover:text-ink md:block" title="Back to overview">
              <BrandMark compact />
            </button>
            <button type="button" onClick={onClose} className="hidden max-w-56 shrink-0 truncate text-muted hover:text-ink md:inline">
              {journal?.name ?? 'Valuation Journal'}
            </button>
            <ChevronRight className="hidden size-3.5 shrink-0 text-faint md:block" />
            <span className="truncate text-ink">
              <span className="mr-1.5 text-muted tabular">{phaseNumber(index)}</span>
              {phase?.title}
            </span>
          </nav>
          <div className="flex shrink-0 items-center gap-1">
            <IconButton label={prev ? `Previous: ${prev.title} (←)` : 'No previous phase'} disabled={!prev} onClick={() => prev && onNavigate(prev.id)}>
              <ChevronLeft className="size-[18px]" />
            </IconButton>
            <span className="hidden w-14 text-center text-xs text-muted tabular sm:block">
              {index + 1} / {phases.length}
            </span>
            <IconButton label={next ? `Next: ${next.title} (→)` : 'No next phase'} disabled={!next} onClick={() => next && onNavigate(next.id)}>
              <ChevronRight className="size-[18px]" />
            </IconButton>
            <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
            <IconButton label="Document Library" onClick={router.toDocuments}>
              <Files className="size-[18px]" />
            </IconButton>
            <IconButton label="Recall" onClick={router.toRecall} className="max-sm:hidden">
              <Brain className="size-[18px]" />
            </IconButton>
            <button
              type="button"
              onClick={onSearch}
              aria-label="Search journal"
              className="flex size-9 items-center justify-center gap-2 rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink lg:w-auto lg:px-2.5"
            >
              <Search className="size-[18px]" />
              <span className="hidden items-center gap-0.5 lg:flex">
                <Kbd>Ctrl</Kbd>
                <Kbd>K</Kbd>
              </span>
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait" custom={direction} initial={false} onExitComplete={() => scrollRef.current?.scrollTo({ top: 0 })}>
        <motion.div key={phaseId} custom={direction} variants={contentVariants} initial="enter" animate="center" exit="leave">
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <PhaseWorkspace
              phaseId={phaseId}
              index={index}
              phases={phases}
              tab={tab}
              onTabChange={setTab}
              prev={prev}
              next={next}
              focus={focus}
              scrollContainer={scrollRef}
              onNavigate={onNavigate}
              onClose={onClose}
              onEditPhase={onEditPhase}
            />
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
