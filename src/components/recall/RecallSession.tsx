import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, RotateCcw, X } from 'lucide-react';
import type { ID, Phase, ReviewResult } from '../../types';
import { useRecallItems, type RecallItem } from '../../hooks/useJournalData';
import { reviewRevision, undoReview } from '../../db/repository';
import { intervalLabel } from '../../lib/recall';
import { isTypingTarget } from '../../lib/format';
import { overlayStack } from '../ui/Modal';
import { Button, IconButton, Kbd } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { useToast } from '../ui/Toast';
import { Flashcard } from './Flashcard';

export interface RecallSessionState {
  /** Revision ids in the order they will be shown. Fixed for the session. */
  ids: ID[];
  /** Describes the deck in the header, e.g. "Due cards". */
  label: string;
  nonce: number;
}

interface RecallSessionProps {
  state: RecallSessionState | null;
  phases: Phase[];
  onClose: () => void;
  onRestart: (state: RecallSessionState) => void;
  onOpenSource: (item: RecallItem) => void;
}

/** Distraction-free revision: one card at a time, full window, keyboard first. */
export function RecallSession(props: RecallSessionProps) {
  return createPortal(<AnimatePresence>{props.state && <SessionBody key={props.state.nonce} {...props} state={props.state} />}</AnimatePresence>, document.body);
}

interface Rated {
  result: ReviewResult;
  logId: ID;
}

function SessionBody({ state, phases, onClose, onRestart, onOpenSource }: RecallSessionProps & { state: RecallSessionState }) {
  const items = useRecallItems();
  const toast = useToast();
  const byId = useMemo(() => new Map((items ?? []).map((i) => [i.revision.id, i])), [items]);
  // Cards removed from Recall mid-session drop out of the deck.
  const deck = useMemo(() => (items ? state.ids.filter((id) => byId.has(id)) : state.ids), [items, state.ids, byId]);

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [direction, setDirection] = useState(1);
  const [rated, setRated] = useState<Map<ID, Rated>>(() => new Map());
  const busy = useRef(false);

  const finished = index >= deck.length;
  const currentId = deck[Math.min(index, deck.length - 1)];
  const current = currentId ? byId.get(currentId) : undefined;
  const currentRating = currentId ? rated.get(currentId) : undefined;
  const phaseIndex = current ? phases.findIndex((p) => p.id === current.phaseId) : -1;

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next > deck.length) return;
      setDirection(next > index ? 1 : -1);
      setIndex(next);
      // A card already rated in this session opens on its answer.
      setRevealed(next < deck.length && rated.has(deck[next]));
    },
    [deck, index, rated],
  );

  const rate = useCallback(
    async (result: ReviewResult) => {
      if (!current || !revealed || busy.current) return;
      busy.current = true;
      try {
        // Rating again replaces this session's earlier rating instead of counting twice.
        const previous = rated.get(current.revision.id);
        if (previous) await undoReview(previous.logId);
        const logId = await reviewRevision(current.revision.id, result);
        if (logId) setRated((map) => new Map(map).set(current.revision.id, { result, logId }));
        goTo(index + 1);
      } catch {
        toast({ message: 'The review could not be saved.', tone: 'error' });
      } finally {
        busy.current = false;
      }
    },
    [current, revealed, rated, goTo, index, toast],
  );

  const keys = useRef({ rate, goTo, index, revealed, finished, onClose });
  keys.current = { rate, goTo, index, revealed, finished, onClose };
  useEffect(() => {
    const token = overlayStack.push();
    const onKey = (e: KeyboardEvent) => {
      if (!overlayStack.isTop(token) || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      const k = keys.current;
      let handled = true;
      if (e.key === 'Escape') k.onClose();
      else if ((e.key === ' ' || e.key === 'Enter') && !k.finished && !k.revealed) setRevealed(true);
      else if ((e.key === '1' || e.key === 'j') && k.revealed && !k.finished) void k.rate('needs-revision');
      else if ((e.key === '2' || e.key === 'k') && k.revealed && !k.finished) void k.rate('remembered');
      else if (e.key === 'ArrowLeft') k.goTo(k.index - 1);
      else if (e.key === 'ArrowRight') k.goTo(k.index + 1);
      else handled = false;
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    // The page underneath keeps its scroll position.
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      overlayStack.remove(token);
      window.removeEventListener('keydown', onKey, true);
      root.style.overflow = overflow;
    };
  }, []);

  const results = [...rated.values()];
  const remembered = results.filter((r) => r.result === 'remembered').length;
  const needsRevision = deck.filter((id) => rated.get(id)?.result === 'needs-revision');
  const progress = deck.length ? Math.round((rated.size / deck.length) * 100) : 0;

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Recall session"
      className="fixed inset-0 z-[46] flex flex-col bg-canvas text-ink"
      initial={{ opacity: 0, scale: 0.995 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      <header className="shrink-0 border-b border-line/70">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10.5px] font-semibold tracking-[0.18em] text-gold uppercase">Recall · {state.label}</p>
            <p className="text-[13px] text-muted tabular">
              {finished ? 'Session complete' : `Card ${index + 1} of ${deck.length}`}
              {rated.size > 0 && (
                <span className="text-faint">
                  {' '}
                  · {remembered} remembered · {needsRevision.length} to revise
                </span>
              )}
            </p>
          </div>
          <IconButton label="End session (Esc)" onClick={onClose}>
            <X className="size-[18px]" />
          </IconButton>
        </div>
        <ProgressBar value={progress} className="!h-0.5 !rounded-none" />
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center px-4 py-8 sm:px-6 sm:py-12">
          {items && deck.length === 0 ? (
            <EmptyDeck onClose={onClose} />
          ) : finished ? (
            <Summary
              total={deck.length}
              remembered={remembered}
              needsRevision={needsRevision.length}
              onReviseAgain={() => onRestart({ ids: needsRevision, label: 'Needs revision', nonce: Date.now() })}
              onBack={() => goTo(deck.length - 1)}
              onClose={onClose}
            />
          ) : current ? (
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={current.revision.id}
                custom={direction}
                initial={{ opacity: 0, x: direction * 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -24, transition: { duration: 0.12 } }}
                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              >
                <Flashcard
                  item={current}
                  phase={phases[phaseIndex]}
                  phaseIndex={phaseIndex}
                  revealed={revealed}
                  onReveal={() => setRevealed(true)}
                  onOpenSource={() => onOpenSource(current)}
                />
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>
      </main>

      {!finished && current && (
        <footer className="shrink-0 border-t border-line/70 bg-canvas">
          <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6 sm:py-4">
            <IconButton label="Previous card (←)" disabled={index === 0} onClick={() => goTo(index - 1)}>
              <ArrowLeft className="size-[18px]" />
            </IconButton>
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:gap-3">
              <RateButton
                label="Needs revision"
                hint={intervalLabel(current.revision, 'needs-revision')}
                shortcut="1"
                icon={<RotateCcw className="size-4" />}
                tone="revise"
                disabled={!revealed}
                selected={currentRating?.result === 'needs-revision'}
                onClick={() => rate('needs-revision')}
              />
              <RateButton
                label="Remembered"
                hint={intervalLabel(current.revision, 'remembered')}
                shortcut="2"
                icon={<Check className="size-4" />}
                tone="remember"
                disabled={!revealed}
                selected={currentRating?.result === 'remembered'}
                onClick={() => rate('remembered')}
              />
            </div>
            <IconButton label="Next card (→)" onClick={() => goTo(index + 1)}>
              <ArrowRight className="size-[18px]" />
            </IconButton>
          </div>
          <p className="hidden items-center justify-center gap-4 pb-3 text-[11px] text-faint sm:flex">
            <span className="flex items-center gap-1">
              <Kbd>Space</Kbd> reveal
            </span>
            <span className="flex items-center gap-1">
              <Kbd>1</Kbd> needs revision
            </span>
            <span className="flex items-center gap-1">
              <Kbd>2</Kbd> remembered
            </span>
            <span className="flex items-center gap-1">
              <Kbd>←</Kbd>
              <Kbd>→</Kbd> move
            </span>
          </p>
        </footer>
      )}
    </motion.div>
  );
}

interface RateButtonProps {
  label: string;
  hint: string;
  shortcut: string;
  icon: React.ReactNode;
  tone: 'revise' | 'remember';
  disabled: boolean;
  selected: boolean;
  onClick: () => void;
}

function RateButton({ label, hint, shortcut, icon, tone, disabled, selected, onClick }: RateButtonProps) {
  const toneClass =
    tone === 'remember'
      ? selected
        ? 'border-gold bg-gold text-on-gold'
        : 'border-gold/50 bg-gold-soft text-ink hover:border-gold'
      : selected
        ? 'border-type-warning bg-type-warning text-white'
        : 'border-line bg-surface text-ink hover:border-type-warning/60';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-keyshortcuts={shortcut}
      className={`flex h-14 min-w-0 flex-col items-center justify-center rounded-xl border px-2 shadow-card transition-[background-color,border-color,opacity] disabled:opacity-35 ${toneClass}`}
    >
      <span className="flex items-center gap-1.5 text-[13.5px] font-semibold">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span className={`text-[11px] tabular ${selected ? 'opacity-80' : 'text-muted'}`}>next in {hint}</span>
    </button>
  );
}

function Summary({
  total,
  remembered,
  needsRevision,
  onReviseAgain,
  onBack,
  onClose,
}: {
  total: number;
  remembered: number;
  needsRevision: number;
  onReviseAgain: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const skipped = total - remembered - needsRevision;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-gold-soft text-gold">
        <Check className="size-5" />
      </span>
      <h2 className="mt-5 font-display text-[34px] leading-tight font-medium tracking-tight">Session complete</h2>
      <p className="mx-auto mt-2 max-w-md text-[15px] text-muted">
        {remembered} remembered · {needsRevision} marked for revision{skipped > 0 ? ` · ${skipped} skipped` : ''}. Each card's next review is scheduled.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={onBack}>
          Back to last card
        </Button>
        {needsRevision > 0 && (
          <Button icon={<RotateCcw className="size-4" />} onClick={onReviseAgain}>
            Revise the {needsRevision} again
          </Button>
        )}
        <Button variant="primary" onClick={onClose} data-autofocus>
          Done
        </Button>
      </div>
    </motion.div>
  );
}

function EmptyDeck({ onClose }: { onClose: () => void }) {
  return (
    <div className="text-center">
      <p className="font-display text-2xl">Nothing to revise</p>
      <p className="mt-2 text-sm text-muted">These cards are no longer in Recall.</p>
      <Button className="mt-6" onClick={onClose}>
        Close
      </Button>
    </div>
  );
}
