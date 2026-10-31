import { motion } from 'motion/react';

export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className={`h-1 w-full overflow-hidden rounded-full bg-line ${className}`}
    >
      <motion.div
        className="h-full rounded-full bg-gold"
        initial={false}
        animate={{ width: `${value}%` }}
        transition={{ type: 'spring', stiffness: 160, damping: 26 }}
      />
    </div>
  );
}
