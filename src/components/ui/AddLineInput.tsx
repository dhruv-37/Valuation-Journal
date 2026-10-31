import { useState, type FormEvent } from 'react';
import { CornerDownLeft, Plus } from 'lucide-react';

/** "Add an item" input: Enter adds and keeps focus for rapid entry. */
export function AddLineInput({ placeholder, onAdd }: { placeholder: string; onAdd: (text: string) => void }) {
  const [text, setText] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    onAdd(value);
    setText('');
  };

  return (
    <form onSubmit={submit} className="group mt-2 flex items-center gap-3 rounded-lg px-2 py-1.5 focus-within:bg-surface-2/60">
      <Plus className="size-4 shrink-0 text-faint group-focus-within:text-gold" />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent py-0.5 text-sm text-ink outline-none placeholder:text-faint"
      />
      {text.trim() && (
        <button type="submit" aria-label="Add" className="rounded-md p-1 text-muted hover:bg-line hover:text-ink">
          <CornerDownLeft className="size-3.5" />
        </button>
      )}
    </form>
  );
}
