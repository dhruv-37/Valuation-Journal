import { useEffect, useState } from 'react';
import type { RecallItem } from '../../hooks/useJournalData';
import { updateRevisionPrompt } from '../../db/repository';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, inputClass } from '../ui/Field';
import { recallAnswer } from './recallItems';

/** Edit the question shown on the front of a revision card. Blank uses the card's own title. */
export function PromptDialog({ item, onClose }: { item: RecallItem | null; onClose: () => void }) {
  const [prompt, setPrompt] = useState('');
  useEffect(() => {
    if (item) setPrompt(item.revision.prompt);
  }, [item]);

  const fallback = item ? (item.card?.title ?? item.extract?.title) || 'the first line of the card' : '';
  const save = async () => {
    if (!item) return;
    await updateRevisionPrompt(item.revision.id, prompt);
    onClose();
  };

  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title="Revision question"
      labelledBy="prompt-title"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            Save question
          </Button>
        </>
      }
    >
      <form
        className="space-y-4 px-6 py-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Question on the front" hint="Optional">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder={`e.g. Why does a higher terminal growth rate need a lower WACC check? Leave blank to show “${fallback}”.`}
            className={`${inputClass} resize-y`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void save();
            }}
          />
        </Field>
        {item && (
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-ink-2">Answer (from the {item.card ? 'card' : 'extract'})</p>
            <p className="max-h-40 overflow-y-auto rounded-xl border border-line bg-surface-2/60 px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap text-ink-2">
              {recallAnswer(item) || 'No content yet.'}
            </p>
            <p className="mt-1.5 text-xs text-faint">Edit the answer in the journal; Recall always shows the latest version.</p>
          </div>
        )}
      </form>
    </Modal>
  );
}
