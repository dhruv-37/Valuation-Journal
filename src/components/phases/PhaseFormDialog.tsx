import { useState, type FormEvent } from 'react';
import type { Phase } from '../../types';
import { createPhase, updatePhase } from '../../db/repository';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, inputClass } from '../ui/Field';

export type PhaseFormState = { mode: 'create' } | { mode: 'edit'; phase: Phase } | null;

interface PhaseFormDialogProps {
  state: PhaseFormState;
  onClose: () => void;
}

export function PhaseFormDialog({ state, onClose }: PhaseFormDialogProps) {
  return (
    <Modal open={!!state} onClose={onClose} title={state?.mode === 'edit' ? 'Edit phase' : 'New phase'} labelledBy="phase-form-title">
      {state && <PhaseForm key={state.mode === 'edit' ? state.phase.id : 'new'} state={state} onClose={onClose} />}
    </Modal>
  );
}

function PhaseForm({ state, onClose }: { state: NonNullable<PhaseFormState>; onClose: () => void }) {
  const initial = state.mode === 'edit' ? state.phase : null;
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [objectives, setObjectives] = useState((initial?.objectives ?? []).join('\n'));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const values = {
      title: title.trim(),
      description: description.trim(),
      objectives: objectives.split('\n').map((o) => o.trim()).filter(Boolean),
    };
    if (state.mode === 'edit') await updatePhase(state.phase.id, values);
    else await createPhase(values);
    onClose();
  };

  return (
    <form onSubmit={submit}>
      <div className="space-y-5 px-6 py-5">
        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="e.g. Synergy Analysis" required data-autofocus />
        </Field>
        <Field label="Description">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} min-h-20 resize-y`} placeholder="What this phase is about, in one sentence." />
        </Field>
        <Field label="Objectives" hint="One per line">
          <textarea value={objectives} onChange={(e) => setObjectives(e.target.value)} className={`${inputClass} min-h-24 resize-y`} placeholder={'Quantify cost synergies\nAssess integration costs'} />
        </Field>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2/50 px-6 py-3.5">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" disabled={!title.trim()}>
          {state.mode === 'edit' ? 'Save changes' : 'Add phase'}
        </Button>
      </div>
    </form>
  );
}
