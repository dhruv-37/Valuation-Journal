import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion } from 'motion/react';
import { Archive, Check, ChevronsUpDown, Plus, Settings2 } from 'lucide-react';
import { db } from '../../db/database';
import type { ID } from '../../types';
import { useActiveJournal, useJournals } from '../../hooks/useActiveJournal';
import { overlayStack } from '../ui/Modal';
import { useJournalActions } from './JournalsContext';

/**
 * The brand mark and current journal name in the page header; opens a list of
 * journals to switch between, plus new / manage / backup actions.
 */
export function JournalSwitcher() {
  const journal = useActiveJournal();
  const journals = useJournals() ?? [];
  const actions = useJournalActions();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const phaseCounts = useLiveQuery(async () => {
    const counts = new Map<ID, number>();
    for (const id of (await db.phases.orderBy('journalId').keys()) as ID[]) counts.set(id, (counts.get(id) ?? 0) + 1);
    return counts;
  }, []);

  useEffect(() => {
    if (!open) return;
    const token = overlayStack.push();
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (!overlayStack.isTop(token)) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        rootRef.current?.querySelector<HTMLElement>('button')?.focus();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = [...(rootRef.current?.querySelectorAll<HTMLElement>('[role=menuitem], [role=menuitemradio]') ?? [])];
        const at = items.indexOf(document.activeElement as HTMLElement);
        items[(at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey, true);
    // Focus the current journal so arrow keys start from it.
    const raf = requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>('[aria-checked=true]')?.focus());
    return () => {
      overlayStack.remove(token);
      cancelAnimationFrame(raf);
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Switch journal"
        className="group -ml-1.5 flex max-w-full min-w-0 items-center gap-2.5 rounded-xl py-1 pr-1.5 pl-1.5 text-left transition-colors hover:bg-surface-2 sm:gap-3 sm:pr-2"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink text-gold shadow-card">
          <svg viewBox="0 0 32 32" className="size-5" aria-hidden="true">
            <path d="M8 9l8 14 8-14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="min-w-0 leading-tight">
          <span className="hidden text-[10.5px] font-medium tracking-[0.14em] text-muted uppercase sm:block">Valuation Journal</span>
          <span className="block max-w-[8.5rem] truncate font-display text-[17px] font-medium tracking-tight text-ink sm:max-w-[16rem] sm:text-[18px]">
            {journal?.name ?? '…'}
          </span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-faint transition-colors group-hover:text-muted" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Journals"
            className="absolute top-full left-0 z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] origin-top-left overflow-hidden rounded-2xl border border-line bg-surface shadow-float"
            initial={{ opacity: 0, scale: 0.97, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -2 }}
            transition={{ duration: 0.15 }}
          >
            <p className="px-4 pt-3.5 pb-1.5 text-[10.5px] font-semibold tracking-[0.16em] text-faint uppercase">Journals</p>
            <div className="max-h-[50vh] overflow-y-auto px-1.5 pb-1.5">
              {journals.map((j) => {
                const active = j.id === journal?.id;
                const phases = phaseCounts?.get(j.id) ?? 0;
                return (
                  <button
                    key={j.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => run(() => void actions.switchTo(j.id))}
                    className={`flex w-full items-start gap-3 rounded-xl px-2.5 py-2 text-left outline-none transition-colors focus-visible:bg-surface-2 ${
                      active ? 'bg-gold-soft/60' : 'hover:bg-surface-2'
                    }`}
                  >
                    <span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center ${active ? 'text-gold' : 'text-transparent'}`}>
                      <Check className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink">{j.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {phases} {phases === 1 ? 'phase' : 'phases'}
                        {j.description ? ` · ${j.description}` : ''}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-line p-1.5">
              <MenuAction icon={<Plus />} label="New journal…" onClick={() => run(() => actions.create())} />
              <MenuAction icon={<Settings2 />} label="Manage journals…" onClick={() => run(actions.manage)} />
              <MenuAction icon={<Archive />} label="Backup & restore…" onClick={() => run(() => actions.backup())} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink-2 outline-none transition-colors hover:bg-surface-2 hover:text-ink focus-visible:bg-surface-2"
    >
      <span className="flex size-4 items-center justify-center text-muted [&>svg]:size-4">{icon}</span>
      {label}
    </button>
  );
}
