import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { IconButton } from './Button';

/** Open dialogs, topmost last. Only the top one handles keys; global shortcuts stand down while any is open. */
const dialogStack: symbol[] = [];
export const isDialogOpen = () => dialogStack.length > 0;

/** Lets other overlays (the image viewer) take part in the same key-handling stack. */
export const overlayStack = {
  push(): symbol {
    const token = Symbol('overlay');
    dialogStack.push(token);
    return token;
  },
  remove(token: symbol) {
    const i = dialogStack.indexOf(token);
    if (i >= 0) dialogStack.splice(i, 1);
  },
  isTop: (token: symbol) => dialogStack[dialogStack.length - 1] === token,
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
  /** 'top' places the panel high on screen (search palette). */
  placement?: 'center' | 'top';
  hideHeader?: boolean;
  labelledBy?: string;
}

export function Modal({ open, onClose, title, children, footer, width = 'max-w-lg', placement = 'center', hideHeader, labelledBy }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Each opening gets a fresh key. Otherwise reopening while the previous panel is
  // still animating out would revive that panel, including any half-typed form state.
  const session = useRef(0);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current) session.current++;
  wasOpen.current = open;

  useEffect(() => {
    if (!open) return;
    const token = Symbol('dialog');
    dialogStack.push(token);
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus the first field (or the panel) once mounted.
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      const target = panel?.querySelector<HTMLElement>('[data-autofocus]') ??
        panel?.querySelector<HTMLElement>('input, textarea, select') ?? panel;
      target?.focus();
    });

    const onKey = (e: KeyboardEvent) => {
      if (dialogStack[dialogStack.length - 1] !== token) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === 'Tab') trapFocus(e, panelRef.current);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      dialogStack.splice(dialogStack.indexOf(token), 1);
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          key={session.current}
          className={`fixed inset-0 z-50 flex justify-center px-4 ${placement === 'top' ? 'items-start pt-[12vh]' : 'items-center py-6'}`}
        >
          <motion.div
            className="absolute inset-0 bg-[#14130f]/35 backdrop-blur-[2px] dark:bg-black/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            ref={(el) => {
              // The newest panel owns the ref; an older one unmounting later must not clear it.
              if (el) panelRef.current = el;
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            tabIndex={-1}
            className={`relative flex max-h-full w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-float outline-none ${width}`}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 520, damping: 38, mass: 0.8 }}
          >
            {!hideHeader && (
              <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
                <h2 id={labelledBy} className="font-display text-xl font-medium tracking-tight">
                  {title}
                </h2>
                <IconButton label="Close" onClick={onClose} size="sm">
                  <X className="size-4" />
                </IconButton>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
            {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2/50 px-6 py-3.5">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function trapFocus(e: KeyboardEvent, panel: HTMLElement | null) {
  if (!panel) return;
  const focusable = panel.querySelectorAll<HTMLElement>(
    'button:not(:disabled), input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])',
  );
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}
