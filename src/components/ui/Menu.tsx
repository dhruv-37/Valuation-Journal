import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Ellipsis } from 'lucide-react';
import { IconButton } from './Button';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
}

/** Small dropdown of actions anchored to a "more" button. */
export function Menu({ items, label = 'More actions' }: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <IconButton label={label} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" active={open}>
        <Ellipsis className="size-[18px]" />
      </IconButton>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            className="absolute right-0 top-full z-30 mt-1.5 min-w-52 origin-top-right rounded-xl border border-line bg-surface p-1.5 shadow-float"
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -2 }}
            transition={{ duration: 0.14 }}
          >
            {items.map((item) => (
              <button
                key={item.label}
                role="menuitem"
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors disabled:opacity-35 ${
                  item.danger ? 'text-type-warning hover:bg-type-warning/10' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
                }`}
              >
                <span className="flex size-4 items-center justify-center [&>svg]:size-4">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
