import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Pin } from 'lucide-react';
import { EXTRACT_KINDS, type ExtractKind, type ID, type KnowledgeExtract } from '../../types';
import { EXTRACT_KIND_META } from '../../lib/extractKinds';
import { createExtract, updateExtract, type ExtractInput } from '../../db/repository';
import { useAllTags } from '../../hooks/useJournalData';
import { Modal } from '../ui/Modal';
import { Button, Kbd } from '../ui/Button';
import { Field, inputClass } from '../ui/Field';
import { TagInput } from '../ui/TagInput';

export type ExtractEditorState = { mode: 'create'; prefill?: Partial<ExtractInput> } | { mode: 'edit'; extract: KnowledgeExtract } | null;

interface ExtractEditorDialogProps {
  phaseId: ID;
  state: ExtractEditorState;
  onClose: () => void;
  onSaved?: (id: ID) => void;
}

export function ExtractEditorDialog({ phaseId, state, onClose, onSaved }: ExtractEditorDialogProps) {
  return (
    <Modal open={!!state} onClose={onClose} title={state?.mode === 'edit' ? 'Edit extract' : 'Save an extract'} labelledBy="extract-editor-title" width="max-w-2xl">
      {state && <ExtractForm key={state.mode === 'edit' ? state.extract.id : 'new'} phaseId={phaseId} state={state} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

/** Guess a sensible kind for pasted text so saving takes fewer clicks. */
function guessKind(text: string): ExtractKind {
  const t = text.trim();
  if (/[=÷×]/.test(t) && t.length < 240 && !/[.!?]\s+[A-Z]/.test(t)) return 'formula';
  if (t.length > 240 || t.includes('\n')) return 'paragraph';
  return 'sentence';
}

function ExtractForm({
  phaseId,
  state,
  onClose,
  onSaved,
}: {
  phaseId: ID;
  state: NonNullable<ExtractEditorState>;
  onClose: () => void;
  onSaved?: (id: ID) => void;
}) {
  const initial: Partial<ExtractInput> = state.mode === 'edit' ? state.extract : state.prefill ?? {};
  const [kind, setKind] = useState<ExtractKind>(initial.kind ?? (initial.text ? guessKind(initial.text) : 'sentence'));
  const [title, setTitle] = useState(initial.title ?? '');
  const [text, setText] = useState(initial.text ?? '');
  const [sourceDocument, setSourceDocument] = useState(initial.sourceDocument ?? '');
  const [location, setLocation] = useState(initial.location ?? '');
  const [url, setUrl] = useState(initial.url ?? '');
  const [tags, setTags] = useState<string[]>(initial.tags ?? []);
  const [pinned, setPinned] = useState(initial.pinned ?? false);
  const allTags = useAllTags();
  const canSave = text.trim() !== '';

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSave) return;
    const input: ExtractInput = { kind, title, text, sourceDocument, location, url, tags, pinned };
    if (state.mode === 'edit') {
      await updateExtract(state.extract.id, input);
      onSaved?.(state.extract.id);
    } else {
      onSaved?.((await createExtract(phaseId, input)).id);
    }
    onClose();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  const mono = EXTRACT_KIND_META[kind].style === 'mono';
  // A pasted passage is already filled in, so start on the title instead.
  const autofocusText = !initial.text;

  return (
    <form onSubmit={submit} onKeyDown={onKeyDown}>
      <div className="space-y-5 px-6 py-5">
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-ink-2">Type</legend>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {EXTRACT_KINDS.map((k) => {
              const meta = EXTRACT_KIND_META[k];
              const Icon = meta.icon;
              const selected = k === kind;
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setKind(k)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-[13px] transition-colors ${
                    selected ? `border-current ${meta.text} ${meta.soft} font-medium` : 'border-line text-ink-2 hover:border-line-strong hover:bg-surface-2'
                  }`}
                >
                  <Icon className={`size-4 shrink-0 ${meta.text}`} />
                  <span className="truncate">{meta.label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <Field label="Text">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            className={`${inputClass} resize-y leading-relaxed ${mono ? 'font-mono text-[13px]' : 'font-display text-[16px]'}`}
            placeholder="Paste or type the passage, observation or formula."
            {...(autofocusText ? { 'data-autofocus': true } : {})}
          />
        </Field>

        <Field label="Title" hint="Optional">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            placeholder="e.g. Why beta is relevered at target D/E"
            {...(!autofocusText ? { 'data-autofocus': true } : {})}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
          <Field label="Source document">
            <input value={sourceDocument} onChange={(e) => setSourceDocument(e.target.value)} className={inputClass} placeholder="e.g. Annual Report 2025" />
          </Field>
          <Field label="Page or section">
            <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} placeholder="e.g. p. 84" />
          </Field>
        </div>

        <Field label="URL" hint="Optional">
          <input value={url} onChange={(e) => setUrl(e.target.value)} className={inputClass} placeholder="https://…" inputMode="url" />
        </Field>

        <Field label="Tags">
          <TagInput value={tags} onChange={setTags} suggestions={allTags} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2/50 px-6 py-3.5">
        <button
          type="button"
          role="switch"
          aria-checked={pinned}
          onClick={() => setPinned((p) => !p)}
          className={`mr-auto inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
            pinned ? 'bg-gold-soft text-gold' : 'text-muted hover:bg-surface-2 hover:text-ink'
          }`}
        >
          <Pin className={`size-3.5 ${pinned ? 'fill-current' : ''}`} />
          {pinned ? 'Marked important' : 'Mark as important'}
        </button>
        <span className="mr-2 hidden items-center gap-1 text-xs text-faint sm:flex">
          <Kbd>Ctrl</Kbd>
          <Kbd>↵</Kbd> to save
        </span>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" disabled={!canSave}>
          {state.mode === 'edit' ? 'Save extract' : 'Add extract'}
        </Button>
      </div>
    </form>
  );
}
