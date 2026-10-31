import { ArrowDown, ArrowUp, BookOpen, Files, Images, ListChecks, Pencil, Quote, Trash } from 'lucide-react';
import type { ChecklistItem, KnowledgeCard, Phase } from '../../types';
import { deletePhase, movePhase, updatePhase } from '../../db/repository';
import { percent, phaseNumber } from '../../lib/format';
import { EditableText } from '../ui/EditableText';
import { Menu } from '../ui/Menu';
import { ProgressBar } from '../ui/ProgressBar';
import { useConfirm } from '../ui/ConfirmProvider';

interface PhaseHeaderProps {
  phase: Phase;
  index: number;
  total: number;
  tasks: ChecklistItem[];
  cards: KnowledgeCard[];
  snapshotCount: number;
  extractCount: number;
  /** Documents filed under or linked to the phase. */
  documentCount: number;
  /** Documents filed under the phase (kept as unfiled if the phase is deleted). */
  filedDocumentCount: number;
  onEdit: () => void;
  onDeleted: () => void;
}

export function PhaseHeader({ phase, index, total, tasks, cards, snapshotCount, extractCount, documentCount, filedDocumentCount, onEdit, onDeleted }: PhaseHeaderProps) {
  const confirm = useConfirm();
  const done = tasks.filter((t) => t.done).length;
  const pct = percent(done, tasks.length);

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete phase?',
      message: (
        <>
          <strong className="font-medium text-ink">{phase.title}</strong> and its {tasks.length} checklist tasks, {cards.length} knowledge cards,{' '}
          {snapshotCount} snapshots and {extractCount} extracts will be permanently deleted.
          {filedDocumentCount > 0 &&
            ` The ${filedDocumentCount} document${filedDocumentCount === 1 ? '' : 's'} filed here will be kept in the Document Library as unfiled.`}
        </>
      ),
      confirmLabel: 'Delete phase',
      danger: true,
    });
    if (!ok) return;
    onDeleted();
    await deletePhase(phase.id);
  };

  return (
    <section className="pt-10 sm:pt-14">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.2em] text-gold uppercase">
            Phase {phaseNumber(index)}
            <span className="h-px w-8 bg-gold/40" />
            <span className="font-medium tracking-[0.12em] text-muted">of {total}</span>
          </p>
          <EditableText
            label="Phase title"
            value={phase.title}
            required
            onSave={(title) => updatePhase(phase.id, { title })}
            className="-mx-2 mt-3 px-2 py-1 font-display text-[34px] leading-[1.1] font-medium tracking-tight text-ink sm:text-[46px]"
          />
          <EditableText
            label="Phase description"
            multiline
            value={phase.description}
            placeholder="Add a short description…"
            onSave={(description) => updatePhase(phase.id, { description })}
            className="-mx-2 mt-2 max-w-3xl px-2 py-1 text-base leading-relaxed text-muted sm:text-[17px]"
          />
        </div>
        <Menu
          label="Phase actions"
          items={[
            { label: 'Edit details', icon: <Pencil />, onSelect: onEdit },
            { label: 'Move earlier', icon: <ArrowUp />, onSelect: () => movePhase(phase.id, -1), disabled: index === 0 },
            { label: 'Move later', icon: <ArrowDown />, onSelect: () => movePhase(phase.id, 1), disabled: index === total - 1 },
            { label: 'Delete phase', icon: <Trash />, onSelect: remove, danger: true },
          ]}
        />
      </div>

      <div className="mt-8 grid gap-6 rounded-2xl border border-line bg-surface px-5 py-4 shadow-card sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6">
        <div>
          <div className="flex items-baseline justify-between text-xs text-muted">
            <span className="font-medium tracking-wide uppercase">Phase progress</span>
            <span className="tabular">
              <span className="font-medium text-ink">{pct}%</span>
            </span>
          </div>
          <ProgressBar value={pct} className="mt-2.5" />
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-2 sm:border-l sm:border-line sm:pl-6">
          <Stat icon={<ListChecks className="size-4" />} value={`${done}/${tasks.length}`} label="tasks" />
          <Stat icon={<BookOpen className="size-4" />} value={`${cards.length}`} label={cards.length === 1 ? 'card' : 'cards'} />
          <Stat icon={<Images className="size-4" />} value={`${snapshotCount}`} label={snapshotCount === 1 ? 'snapshot' : 'snapshots'} />
          <Stat icon={<Quote className="size-4" />} value={`${extractCount}`} label={extractCount === 1 ? 'extract' : 'extracts'} />
          <Stat icon={<Files className="size-4" />} value={`${documentCount}`} label={documentCount === 1 ? 'document' : 'documents'} />
        </div>
      </div>
    </section>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-faint">{icon}</span>
      <span className="font-medium text-ink tabular">{value}</span>
      <span className="text-muted">{label}</span>
    </span>
  );
}
