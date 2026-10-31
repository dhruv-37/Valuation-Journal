import { ChevronDown } from 'lucide-react';

interface SelectProps<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  /** Highlights the control when it is not on its default value. */
  active?: boolean;
}

/** A compact native select: accessible, keyboard friendly and good on phones. */
export function Select<T extends string>({ label, value, onChange, options, active }: SelectProps<T>) {
  return (
    <label
      className={`relative inline-flex h-8 items-center rounded-lg border text-[13px] transition-colors ${
        active ? 'border-gold/50 bg-gold-soft text-ink' : 'border-line bg-surface text-ink-2 hover:border-line-strong'
      }`}
    >
      <span className="pointer-events-none pl-2.5 text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-full max-w-44 cursor-pointer appearance-none truncate bg-transparent pr-7 pl-1.5 font-medium text-ink outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-muted" />
    </label>
  );
}
