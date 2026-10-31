import { BookOpen, Pencil, Pin, Play, Trash } from 'lucide-react';
import type { Phase } from '../../types';
import type { RecallItem } from '../../hooks/useJournalData';
import { removeFromRecall } from '../../db/repository';
import { isDue, relativeDue } from '../../lib/recall';
import { phaseNumber } from '../../lib/format';
import { IconButton } from '../ui/Button';
import { useConfirm } from '../ui/ConfirmProvider';
import { RecallStatusPill } from './RecallStatusPill';
import { recallPrompt, recallTypeMeta } from './recallItems';

interface RevisionRowProps {
  item: RecallItem;
  phases: Phase[];
  at: number;
  onRevise: () => void;
  onEdit: () => void;
  onOpenSource: () => void;
}

export function RevisionRow({ item, phases, at, onRevise, onEdit, onOpenSource }: RevisionRowProps) {
  const confirm = useConfirm();
  const meta = recallTypeMeta(item);
  const Icon = meta.icon;
  const r = item.revision;
  const phaseIndex = phases.findIndex((p) => p.id === item.phaseId);
  const due = isDue(r, at);

  const remove = async () => {
    const ok =
      r.reviewCount === 0 ||
      (await confirm({
        title: 'Remove from Recall?',
        message: (
          <>
            <strong className="font-medium text-ink">{recallPrompt(item)}</strong> and its {r.reviewCount} recorded{' '}
            {r.reviewCount === 1 ? 'review' : 'reviews'} will be removed from Recall. The {item.card ? 'knowledge card' : 'extract'} itself stays in the
            journal.
          </>
        ),
        confirmLabel: 'Remove',
        danger: true,
      }));
    if (ok) await removeFromRecall([r.id]);
  };

  return (
    <li className="group relative flex items-start gap-3 rounded-2xl border border-line bg-surface py-3.5 pr-2 pl-4 shadow-card transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-lift sm:gap-4 sm:pl-5">
      <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${meta.soft} ${meta.text}`} title={meta.label}>
        <Icon className="size-4" />
      </span>
      <button type="button" onClick={onRevise} className="min-w-0 flex-1 text-left" title="Revise this card">
        <span className="line-clamp-2 text-[14.5px] leading-snug font-medium text-ink">{recallPrompt(item)}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-muted">
          <RecallStatusPill status={r.status} />
          {phaseIndex >= 0 && (
            <span className="min-w-0 truncate">
              <span className="text-gold tabular">{phaseNumber(phaseIndex)}</span> {phases[phaseIndex].title}
            </span>
          )}
          {item.pinned && <Pin className="size-3 fill-current text-gold" aria-label="Pinned" />}
          <span className={`tabular ${due ? 'font-medium text-gold' : ''}`}>{due ? 'Due now' : `Next ${relativeDue(r.dueAt, at)}`}</span>
          {r.reviewCount > 0 && (
            <span className="text-faint tabular">
              {r.reviewCount} {r.reviewCount === 1 ? 'review' : 'reviews'}
            </span>
          )}
        </span>
      </button>
      <div className="reveal-on-hover flex shrink-0 items-center max-sm:flex-col">
        <IconButton size="sm" label="Revise this card" onClick={onRevise}>
          <Play className="size-3.5" />
        </IconButton>
        <IconButton size="sm" label="Edit question" onClick={onEdit}>
          <Pencil className="size-3.5" />
        </IconButton>
        <IconButton size="sm" label="Open in the journal" onClick={onOpenSource} className="max-sm:hidden">
          <BookOpen className="size-3.5" />
        </IconButton>
        <IconButton size="sm" label="Remove from Recall" onClick={remove} className="hover:!text-type-warning">
          <Trash className="size-3.5" />
        </IconButton>
      </div>
    </li>
  );
}
