import { ArrowUpRight, BookOpen, Check, Plus } from 'lucide-react';
import type { Phase, PhaseStats } from '../../types';
import { percent, phaseNumber } from '../../lib/format';
import { ProgressBar } from '../ui/ProgressBar';

interface PhaseNodeProps {
  phase: Phase;
  index: number;
  stats?: PhaseStats;
  onOpen: () => void;
}

export function phaseStatus(stats?: PhaseStats) {
  if (!stats || stats.tasks === 0 || stats.done === 0) return 'idle' as const;
  return stats.done === stats.tasks ? ('complete' as const) : ('active' as const);
}

/** One station on the pathway. `data-phase-card` is used by the zoom transition. */
export function PhaseNode({ phase, index, stats, onOpen }: PhaseNodeProps) {
  const pct = percent(stats?.done ?? 0, stats?.tasks ?? 0);
  const status = phaseStatus(stats);
  // Everything collected for the phase: cards, snapshots and extracts.
  const cards = (stats?.cards ?? 0) + (stats?.snapshots ?? 0) + (stats?.extracts ?? 0);
  const breakdown = `${stats?.cards ?? 0} cards · ${stats?.snapshots ?? 0} snapshots · ${stats?.extracts ?? 0} extracts`;

  return (
    <button
      type="button"
      data-phase-card={phase.id}
      onClick={onOpen}
      aria-label={`Open phase ${index + 1}: ${phase.title}`}
      className="group relative flex h-full w-full flex-col rounded-2xl border border-line bg-surface p-5 text-left shadow-card transition-[border-color,box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lift sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`font-display text-[34px] leading-none tracking-tight tabular transition-colors ${
            status === 'complete' ? 'text-gold' : 'text-faint group-hover:text-ink-2'
          }`}
        >
          {phaseNumber(index)}
        </span>
        {status === 'complete' ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 text-[11px] font-medium text-gold">
            <Check className="size-3" strokeWidth={2.5} /> Complete
          </span>
        ) : status === 'active' ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted">
            <span className="size-1.5 rounded-full bg-gold" /> In progress
          </span>
        ) : (
          <ArrowUpRight className="size-4 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </div>

      <h3 className="mt-4 font-display text-[19px] leading-snug font-medium tracking-tight text-ink">{phase.title}</h3>
      {phase.description && (
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted">{phase.description}</p>
      )}

      <div className="mt-auto pt-5">
        <ProgressBar value={pct} />
        <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-muted tabular">
          <span>
            <span className="font-medium text-ink-2">
              {stats?.done ?? 0}/{stats?.tasks ?? 0}
            </span>{' '}
            tasks · {pct}%
          </span>
          <span className="inline-flex items-center gap-1" title={breakdown}>
            <BookOpen className="size-3.5" />
            {cards} {cards === 1 ? 'item' : 'items'}
          </span>
        </div>
      </div>
    </button>
  );
}

export function AddPhaseNode({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="group flex h-full min-h-44 w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line-strong bg-canvas p-6 text-muted transition-colors hover:border-gold/70 hover:text-ink"
    >
      <span className="flex size-10 items-center justify-center rounded-full border border-line bg-surface transition-colors group-hover:border-gold/60 group-hover:text-gold">
        <Plus className="size-5" />
      </span>
      <span className="text-sm font-medium">Add a phase</span>
    </button>
  );
}
