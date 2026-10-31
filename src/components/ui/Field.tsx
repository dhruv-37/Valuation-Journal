import type { ReactNode } from 'react';

export const inputClass =
  'w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-gold/70';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-[13px] font-medium text-ink-2">
        {label}
        {hint && <span className="text-xs font-normal text-faint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
