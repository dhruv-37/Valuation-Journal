import { Files, Route } from 'lucide-react';
import type { PageRoute } from '../hooks/useHashRoute';
import { router } from '../hooks/useHashRoute';

/** Switches between the two top-level pages: the pathway overview and the Document Library. */
export function MainNav({ current, documentCount }: { current: PageRoute; documentCount?: number }) {
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
    </nav>
  );
}

function NavLink({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      title={label}
      className={`flex h-8 items-center gap-1.5 rounded-[10px] px-2.5 text-[13px] font-medium transition-colors ${
        active ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink'
      }`}
    >
      <span className={active ? 'text-gold' : ''}>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
      {count !== undefined && count > 0 && <span className="hidden text-xs font-normal text-faint tabular md:inline">{count}</span>}
    </button>
  );
}
