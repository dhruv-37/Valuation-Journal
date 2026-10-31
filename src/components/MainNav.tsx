import { Brain, Files, Route } from 'lucide-react';
import type { PageRoute } from '../hooks/useHashRoute';
import { router } from '../hooks/useHashRoute';
import { useDueRevisionCount } from '../hooks/useJournalData';

/** Switches between the top-level pages: the pathway overview, the Document Library and Recall. */
export function MainNav({ current, documentCount }: { current: PageRoute; documentCount?: number }) {
  const due = useDueRevisionCount() ?? 0;
  return (
    <nav aria-label="Main" className="flex items-center rounded-xl border border-line bg-surface p-0.5 shadow-card">
      <NavLink active={current === 'overview'} onClick={router.toPathway} icon={<Route className="size-4" />} label="Pathway" />
      <NavLink
        active={current === 'documents'}
        onClick={router.toDocuments}
        icon={<Files className="size-4" />}
        label="Documents"
        count={documentCount}
      />
      <NavLink
        active={current === 'recall'}
        onClick={router.toRecall}
        icon={<Brain className="size-4" />}
        label="Recall"
        badge={due > 0 ? due : undefined}
        badgeTitle={`${due} ${due === 1 ? 'card' : 'cards'} due for revision`}
      />
    </nav>
  );
}

interface NavLinkProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
  /** A count that asks for attention (cards due), shown at every width. */
  badge?: number;
  badgeTitle?: string;
}

function NavLink({ active, onClick, icon, label, count, badge, badgeTitle }: NavLinkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      title={badge ? `${label} · ${badgeTitle}` : label}
      className={`relative flex h-8 items-center gap-1.5 rounded-[10px] px-2.5 text-[13px] font-medium transition-colors ${
        active ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink'
      }`}
    >
      <span className={active ? 'text-gold' : ''}>{icon}</span>
      <span className="hidden lg:inline">{label}</span>
      {count !== undefined && count > 0 && <span className="hidden text-xs font-normal text-faint tabular lg:inline">{count}</span>}
      {badge !== undefined && (
        <span
          aria-label={badgeTitle}
          className="flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] leading-none font-semibold text-on-gold tabular max-sm:absolute max-sm:-top-1 max-sm:-right-1"
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}
