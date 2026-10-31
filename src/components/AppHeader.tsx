import { Search } from 'lucide-react';
import type { PageRoute } from '../hooks/useHashRoute';
import { Kbd } from './ui/Button';
import { ThemeToggle } from './ThemeToggle';
import { MainNav } from './MainNav';
import { JournalSwitcher } from './journals/JournalSwitcher';

interface AppHeaderProps {
  current: PageRoute;
  documentCount?: number;
  onSearch: () => void;
}

/** Sticky header shared by the full pages: journal switcher, main navigation, search and theme. */
export function AppHeader({ current, documentCount, onSearch }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-3 px-4 sm:px-8">
        <JournalSwitcher />
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <MainNav current={current} documentCount={documentCount} />
          <button
            type="button"
            onClick={onSearch}
            aria-label="Search journal"
            className="flex size-9 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-muted shadow-card transition-colors hover:border-line-strong hover:text-ink xl:w-56 xl:justify-start xl:px-3"
          >
            <Search className="size-4 shrink-0" />
            <span className="hidden flex-1 text-left text-sm xl:inline">Search journal…</span>
            <span className="hidden items-center gap-0.5 xl:flex">
              <Kbd>Ctrl</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
