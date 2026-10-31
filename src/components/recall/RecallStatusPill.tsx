import type { RevisionStatus } from '../../types';

const STATUS: Record<RevisionStatus, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-surface-2 text-muted' },
  remembered: { label: 'Remembered', className: 'bg-gold-soft text-gold' },
  'needs-revision': { label: 'Needs revision', className: 'bg-type-warning/10 text-type-warning' },
};

export function RecallStatusPill({ status }: { status: RevisionStatus }) {
  const s = STATUS[status];
  return <span className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-px text-[10.5px] font-semibold tracking-wide uppercase ${s.className}`}>{s.label}</span>;
}
