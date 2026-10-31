import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { CircleCheck, TriangleAlert, X } from 'lucide-react';

interface ToastOptions {
  message: string;
  tone?: 'default' | 'error';
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends ToastOptions {
  id: number;
}

type ToastFn = (options: ToastOptions) => void;

const ToastContext = createContext<ToastFn>(() => {});

/** Brief confirmations ("Snapshot saved") with an optional follow-up action. */
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback<ToastFn>(
    (options) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-2), { ...options, id }]);
      window.setTimeout(() => dismiss(id), options.action ? 6000 : 3500);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
          <AnimatePresence>
            {toasts.map((t) => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="pointer-events-auto flex max-w-md items-center gap-3 rounded-xl border border-line bg-ink py-2.5 pr-2 pl-3.5 text-sm text-canvas shadow-float"
                role={t.tone === 'error' ? 'alert' : 'status'}
              >
                {t.tone === 'error' ? (
                  <TriangleAlert className="size-4 shrink-0 text-type-warning" />
                ) : (
                  <CircleCheck className="size-4 shrink-0 text-gold" />
                )}
                <span className="min-w-0 flex-1">{t.message}</span>
                {t.action && (
                  <button
                    type="button"
                    onClick={() => {
                      t.action!.onClick();
                      dismiss(t.id);
                    }}
                    className="rounded-lg px-2.5 py-1 text-[13px] font-medium text-gold hover:bg-white/10"
                  >
                    {t.action.label}
                  </button>
                )}
                <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="rounded-md p-1 opacity-60 hover:bg-white/10 hover:opacity-100">
                  <X className="size-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
