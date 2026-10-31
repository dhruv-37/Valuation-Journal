import { useState, type FormEvent, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Copy, LayoutTemplate, SquareDashed } from 'lucide-react';
import { db } from '../../db/database';
import type { ID } from '../../types';
import { createJournal, updateJournal, type JournalTemplate } from '../../db/repository';
import { useJournals } from '../../hooks/useActiveJournal';
import { isQuotaError } from '../../lib/documents';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, inputClass } from '../ui/Field';
import { useToast } from '../ui/Toast';

export type JournalFormState = { mode: 'create'; copyOf?: ID } | { mode: 'edit'; journalId: ID } | null;

interface JournalFormDialogProps {
  state: JournalFormState;
  onClose: () => void;
  /** Called with the new journal's id (the provider switches to it). */
  onCreated: (id: ID) => void;
}

export function JournalFormDialog({ state, onClose, onCreated }: JournalFormDialogProps) {
  return (
    <Modal open={!!state} onClose={onClose} title={state?.mode === 'edit' ? 'Rename journal' : 'New journal'} labelledBy="journal-form-title" width="max-w-xl">
      {state && <JournalForm key={state.mode === 'edit' ? state.journalId : `new-${state.copyOf ?? ''}`} state={state} onClose={onClose} onCreated={onCreated} />}
    </Modal>
  );
}

type TemplateKind = JournalTemplate['kind'];

function JournalForm({ state, onClose, onCreated }: { state: NonNullable<JournalFormState>; onClose: () => void; onCreated: (id: ID) => void }) {
  const toast = useToast();
  const journals = useJournals() ?? [];
  const editing = useLiveQuery(async () => (state.mode === 'edit' ? db.journals.get(state.journalId) : undefined), []);
  const [name, setName] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [kind, setKind] = useState<TemplateKind>(state.mode === 'create' && state.copyOf ? 'copy' : 'dcf');
  const [copyOf, setCopyOf] = useState<ID>(state.mode === 'create' ? (state.copyOf ?? '') : '');
  const [saving, setSaving] = useState(false);

  // Edit mode starts from the stored values once they load.
  const nameValue = name ?? editing?.name ?? '';
  const descriptionValue = description ?? editing?.description ?? '';
  const source = journals.find((j) => j.id === (copyOf || journals[0]?.id));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!nameValue.trim() || saving) return;
    setSaving(true);
    try {
      if (state.mode === 'edit') {
        await updateJournal(state.journalId, { name: nameValue, description: descriptionValue });
        onClose();
        return;
      }
      const template: JournalTemplate = kind === 'copy' ? { kind, journalId: source!.id } : { kind };
      const journal = await createJournal({ name: nameValue, description: descriptionValue }, template);
      onClose();
      onCreated(journal.id);
      toast({ message: `Created “${journal.name}”` });
    } catch (error) {
      toast({ message: isQuotaError(error) ? 'Browser storage is full, so the journal was not created.' : 'The journal could not be saved.', tone: 'error' });
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <div className="space-y-5 px-6 py-5">
        <Field label="Name">
          <input
            value={nameValue}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="e.g. Trent Limited Valuation"
            required
            data-autofocus
          />
        </Field>
        <Field label="Description" hint="Optional">
          <input value={descriptionValue} onChange={(e) => setDescription(e.target.value)} className={inputClass} placeholder="e.g. FY25 DCF, base case and scenarios" />
        </Field>

        {state.mode === 'create' && (
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-ink-2">Start from</legend>
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
              <TemplateOption
                checked={kind === 'dcf'}
                onSelect={() => setKind('dcf')}
                icon={<LayoutTemplate className="size-4" />}
                title="DCF template"
                text="13 phases with checklists and starter cards"
              />
              <TemplateOption
                checked={kind === 'copy'}
                onSelect={() => {
                  setKind('copy');
                  if (!copyOf && journals[0]) setCopyOf(journals[0].id);
                }}
                icon={<Copy className="size-4" />}
                title="Existing journal"
                text="An independent copy, files included"
              />
              <TemplateOption checked={kind === 'empty'} onSelect={() => setKind('empty')} icon={<SquareDashed className="size-4" />} title="Empty" text="No phases; build your own" />
            </div>
            {kind === 'copy' && (
              <label className="mt-3 block">
                <span className="mb-1.5 block text-xs text-muted">Journal to copy</span>
                <select value={source?.id ?? ''} onChange={(e) => setCopyOf(e.target.value)} className={inputClass}>
                  {journals.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </fieldset>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2/50 px-6 py-3.5">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" disabled={!nameValue.trim() || saving || (kind === 'copy' && !source)}>
          {state.mode === 'edit' ? 'Save' : saving ? 'Creating…' : 'Create journal'}
        </Button>
      </div>
    </form>
  );
}

function TemplateOption({ checked, onSelect, icon, title, text }: { checked: boolean; onSelect: () => void; icon: ReactNode; title: string; text: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={`flex flex-col items-start gap-1.5 rounded-xl border px-3.5 py-3 text-left transition-colors ${
        checked ? 'border-gold/60 bg-gold-soft/60' : 'border-line bg-surface hover:border-line-strong'
      }`}
    >
      <span className={checked ? 'text-gold' : 'text-muted'}>{icon}</span>
      <span className="text-[13px] font-medium text-ink">{title}</span>
      <span className="text-xs leading-snug text-muted">{text}</span>
    </button>
  );
}
