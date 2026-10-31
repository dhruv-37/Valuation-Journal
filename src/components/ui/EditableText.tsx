import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

interface EditableTextProps {
  value: string;
  onSave: (value: string) => void;
  /** Multi-line uses a textarea; Enter saves, Shift+Enter adds a line. */
  multiline?: boolean;
  placeholder?: string;
  /** Applied to both display and edit states so the text doesn't jump. */
  className?: string;
  /** Empty values are rejected (the old value is kept). */
  required?: boolean;
  label: string;
  /** Lets a parent start editing (e.g. from a pencil button). */
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
}

/** Click-to-edit text. Saves on Enter or blur; Escape cancels. */
export function EditableText({
  value,
  onSave,
  multiline,
  placeholder = 'Click to add…',
  className = '',
  required,
  label,
  editing: controlledEditing,
  onEditingChange,
}: EditableTextProps) {
  const [localEditing, setLocalEditing] = useState(false);
  const editing = controlledEditing ?? localEditing;
  const setEditing = (next: boolean) => {
    setLocalEditing(next);
    onEditingChange?.(next);
  };
  const [draft, setDraft] = useState(value);
  const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      requestAnimationFrame(() => {
        const el = fieldRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
        autosize(el);
      });
    }
    // Only when entering edit mode, not on every keystroke.
  }, [editing]);

  const commit = () => {
    const next = draft.trim();
    if (next !== value.trim() && !(required && !next)) onSave(next);
    setEditing(false);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setEditing(false);
    } else if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      commit();
    }
  };

  if (editing) {
    const shared = {
      ref: fieldRef,
      value: draft,
      'aria-label': label,
      placeholder,
      onBlur: commit,
      onKeyDown,
      className: `w-full rounded-md bg-surface outline-none ring-1 ring-gold/60 ring-offset-4 ring-offset-surface ${className}`,
    };
    return multiline ? (
      <textarea
        {...shared}
        rows={1}
        onChange={(e) => {
          setDraft(e.target.value);
          autosize(e.target);
        }}
        className={`${shared.className} block resize-none`}
      />
    ) : (
      <input {...shared} onChange={(e) => setDraft(e.target.value)} />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title={`Edit ${label.toLowerCase()}`}
      className={`block w-full cursor-text rounded-md text-left transition-colors hover:bg-surface-2/70 ${value ? '' : 'text-faint italic'} ${className}`}
    >
      {value || placeholder}
    </button>
  );
}

function autosize(el: HTMLTextAreaElement | HTMLInputElement) {
  if (el instanceof HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }
}
