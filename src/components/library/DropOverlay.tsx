import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { FilePlus } from 'lucide-react';
import { isDialogOpen } from '../ui/Modal';

const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');

interface DropOverlayProps {
  title: string;
  /** Where the files go and which formats are accepted. */
  subtitle: string;
  onDrop: (files: File[]) => void;
  /** Stops listening, e.g. while a phase workspace covers the Document Library. */
  disabled?: boolean;
}

/** Drop files anywhere on the page: a phase workspace (snapshots and documents) or the Document Library. */
export function DropOverlay({ title, subtitle, onDrop, disabled }: DropOverlayProps) {
  const [active, setActive] = useState(false);
  const depth = useRef(0);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  useEffect(() => {
    if (disabled) return;
    const enter = (e: DragEvent) => {
      if (!hasFiles(e) || isDialogOpen()) return;
      depth.current++;
      setActive(true);
    };
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); // required to allow dropping
      if (e.dataTransfer) e.dataTransfer.dropEffect = isDialogOpen() ? 'none' : 'copy';
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setActive(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); // stop the browser opening the file
      depth.current = 0;
      setActive(false);
      if (isDialogOpen()) return;
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) onDropRef.current(files);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
      depth.current = 0;
      setActive(false);
    };
  }, [disabled]);

  return createPortal(
    <AnimatePresence>
      {active && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[44] flex items-center justify-center bg-canvas/80 p-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="flex h-full max-h-[420px] w-full max-w-2xl flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gold/70 bg-surface/90 text-center shadow-float">
            <span className="flex size-14 items-center justify-center rounded-full bg-gold-soft text-gold">
              <FilePlus className="size-6" />
            </span>
            <p className="mt-5 px-4 font-display text-2xl text-ink">{title}</p>
            <p className="mt-1.5 max-w-md px-6 text-sm text-muted">{subtitle}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
