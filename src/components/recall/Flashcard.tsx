import { AnimatePresence, motion } from 'motion/react';
import { BookOpen, Eye, FileText, Pin } from 'lucide-react';
import type { Phase } from '../../types';
import type { RecallItem } from '../../hooks/useJournalData';
import { phaseNumber } from '../../lib/format';
import { Kbd } from '../ui/Button';
import { recallAnswer, recallAnswerStyle, recallPrompt, recallReference, recallTags, recallTypeMeta } from './recallItems';

interface FlashcardProps {
  item: RecallItem;
  phase: Phase | undefined;
  phaseIndex: number;
  revealed: boolean;
  onReveal: () => void;
  onOpenSource: () => void;
}

/** One revision card: the question first, the explanation once revealed. */
export function Flashcard({ item, phase, phaseIndex, revealed, onReveal, onOpenSource }: FlashcardProps) {
  const meta = recallTypeMeta(item);
  const Icon = meta.icon;
  const reference = recallReference(item);
  const answer = recallAnswer(item);
  const style = recallAnswerStyle(item);
  const tags = recallTags(item);

  return (
    <article className="relative overflow-hidden rounded-3xl border border-line bg-surface shadow-lift" aria-live="polite">
      <span className={`absolute inset-x-0 top-0 h-[3px] ${meta.bar}`} aria-hidden="true" />
      <div className="px-6 pt-7 pb-6 sm:px-10 sm:pt-9 sm:pb-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11.5px]">
          <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${meta.text} ${meta.soft}`}>
            <Icon className="size-3.5" strokeWidth={2.2} />
            {meta.label}
          </span>
          {phase && (
            <span className="min-w-0 truncate text-muted">
              <span className="text-gold tabular">{phaseNumber(phaseIndex)}</span> · {phase.title}
            </span>
          )}
          {item.pinned && (
            <span className="inline-flex items-center gap-1 font-medium text-gold">
              <Pin className="size-3 fill-current" /> {item.card ? 'Pinned' : 'Important'}
            </span>
          )}
        </div>

        <h2 className="mt-6 font-display text-[26px] leading-[1.2] font-medium tracking-tight text-balance text-ink sm:text-[32px]">{recallPrompt(item)}</h2>

        <AnimatePresence initial={false} mode="wait">
          {revealed ? (
            <motion.div
              key="answer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="mt-7 border-t border-line pt-6"
            >
              <Answer text={answer} style={style} />
              {(reference || tags.length > 0) && (
                <footer className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
                  {reference && (
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <FileText className="size-3.5 shrink-0 text-faint" />
                      <span className="truncate italic">{reference}</span>
                    </span>
                  )}
                  {tags.length > 0 && <span className="text-faint">{tags.map((t) => `#${t}`).join('  ')}</span>}
                </footer>
              )}
              <button
                type="button"
                onClick={onOpenSource}
                className="mt-5 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-muted transition-colors hover:text-gold"
              >
                <BookOpen className="size-3.5" />
                Open in the journal
              </button>
            </motion.div>
          ) : (
            <motion.div key="hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} className="mt-8">
              <button
                type="button"
                onClick={onReveal}
                data-autofocus
                className="group flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-line-strong px-6 py-9 text-center transition-colors hover:border-gold/60 hover:bg-gold-soft/40"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-gold-soft text-gold transition-transform group-hover:scale-105">
                  <Eye className="size-[18px]" />
                </span>
                <span className="text-sm font-medium text-ink">Show the answer</span>
                <span className="hidden items-center gap-1 text-[11px] text-faint sm:flex">
                  Recall it first, then press <Kbd>Space</Kbd>
                </span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </article>
  );
}

function Answer({ text, style }: { text: string; style: 'mono' | 'quote' | 'prose' }) {
  if (!text) return <p className="text-sm text-muted italic">No explanation written yet. Open the card in the journal to add one.</p>;
  if (style === 'mono') {
    return (
      <pre className="overflow-x-auto rounded-xl border border-type-formula/20 bg-type-formula/[0.06] px-4 py-3.5 font-mono text-[13.5px] leading-[1.75] whitespace-pre-wrap text-ink">
        {text}
      </pre>
    );
  }
  if (style === 'quote') {
    return <blockquote className="border-l-2 border-type-source/45 pl-5 font-display text-[19px] leading-[1.6] whitespace-pre-wrap text-ink">{text}</blockquote>;
  }
  return <p className="text-[16px] leading-[1.7] whitespace-pre-wrap text-ink-2">{text}</p>;
}
