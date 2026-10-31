import { useId, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { normaliseTags } from '../../db/repository';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
}

/** Type a tag and press Enter or comma. Backspace on an empty field removes the last tag. */
export function TagInput({ value, onChange, suggestions = [] }: TagInputProps) {
  const [draft, setDraft] = useState('');
  const listId = useId();

  const add = (raw: string) => {
    const next = normaliseTags([...value, ...raw.split(',')]);
    if (next.length !== value.length) onChange(next);
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && draft.trim()) {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 py-1.5 focus-within:border-gold/70">
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-surface-2 py-0.5 pr-1 pl-2 text-xs text-ink-2">
          #{tag}
          <button
            type="button"
            aria-label={`Remove tag ${tag}`}
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="rounded p-0.5 text-muted hover:bg-line hover:text-ink"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        list={listId}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => draft.trim() && add(draft)}
        placeholder={value.length ? 'Add tag' : 'e.g. wacc, terminal-value'}
        aria-label="Add tag"
        className="min-w-28 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-faint"
      />
      <datalist id={listId}>
        {suggestions.filter((s) => !value.includes(s)).map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}
