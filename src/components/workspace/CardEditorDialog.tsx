import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Pin } from 'lucide-react';
import { CARD_TYPES, type CardType, type ID, type KnowledgeCard } from '../../types';
import { CARD_TYPE_META } from '../../lib/cardTypes';
import { createCard, updateCard } from '../../db/repository';
import { useAllTags } from '../../hooks/useJournalData';
import { Modal } from '../ui/Modal';
import { Button, Kbd } from '../ui/Button';
import { Field, inputClass } from '../ui/Field';
import { TagInput } from '../ui/TagInput';

export type CardEditorState = { mode: 'create'; type?: CardType } | { mode: 'edit'; card: KnowledgeCard } | null;

interface CardEditorDialogProps {
  phaseId: ID;
  state: CardEditorState;
  onClose: () => void;
}

export function CardEditorDialog({ phaseId, state, onClose }: CardEditorDialogProps) {
  return (
    <Modal
      open={!!state}
      onClose={onClose}
      title={state?.mode === 'edit' ? 'Edit knowledge card' : 'New knowledge card'}
      labelledBy="card-editor-title"
      width="max-w-2xl"
    >
      {state && <CardForm key={state.mode === 'edit' ? state.card.id : 'new'} phaseId={phaseId} state={state} onClose={onClose} />}
    </Modal>
  );
}

function CardForm({ phaseId, state, onClose }: { phaseId: ID; state: NonNullable<CardEditorState>; onClose: () => void }) {
  const initial = state.mode === 'edit' ? state.card : null;
  const [type, setType] = useState<CardType>(initial?.type ?? (state.mode === 'create' ? state.type : undefined) ?? 'concept');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [source, setSource] = useState(initial?.source ?? '');
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  const allTags = useAllTags();
  const canSave = title.trim() !== '' || content.trim() !== '';

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSave) return;
    const input = { type, title, content, tags, source, pinned };
    if (initial) await updateCard(initial.id, input);
    else await createCard(phaseId, input);
    onClose();
  };

  // Ctrl/Cmd + Enter saves from anywhere in the form.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form onSubmit={submit} onKeyDown={onKeyDown}>
      <div className="space-y-5 px-6 py-5">
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-ink-2">Type</legend>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {CARD_TYPES.map((t) => {
              const meta = CARD_TYPE_META[t];
              const Icon = meta.icon;
              const selected = t === type;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setType(t)}
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

        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="e.g. Gordon growth terminal value" data-autofocus />
        </Field>

        <Field label="Content" hint={type === 'formula' ? 'Monospaced · one line per step' : undefined}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={type === 'formula' ? 4 : 6}
            className={`${inputClass} resize-y leading-relaxed ${type === 'formula' || type === 'example' ? 'font-mono text-[13px]' : ''}`}
            placeholder={type === 'formula' ? 'TV = FCFF(n+1) ÷ (WACC − g)' : 'Write the key idea in your own words.'}
          />
        </Field>

        <Field label="Tags">
          <TagInput value={tags} onChange={setTags} suggestions={allTags} />
        </Field>

        <Field label="Source / reference" hint="Optional">
          <input value={source} onChange={(e) => setSource(e.target.value)} className={inputClass} placeholder="e.g. Annual report 2025, p. 84" />
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
          {pinned ? 'Pinned' : 'Pin to top'}
        </button>
        <span className="mr-2 hidden items-center gap-1 text-xs text-faint sm:flex">
          <Kbd>Ctrl</Kbd>
          <Kbd>↵</Kbd> to save
        </span>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" disabled={!canSave}>
          {initial ? 'Save card' : 'Add card'}
        </Button>
      </div>
    </form>
  );
}
