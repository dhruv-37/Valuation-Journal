import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Pin } from 'lucide-react';
import type { Snapshot } from '../../types';
import { updateSnapshot } from '../../db/repository';
import { useAllTags } from '../../hooks/useJournalData';
import { formatBytes } from '../../lib/images';
import { formatDate } from '../../lib/format';
import { Modal } from '../ui/Modal';
import { Button, Kbd } from '../ui/Button';
import { Field, inputClass } from '../ui/Field';
import { TagInput } from '../ui/TagInput';
import { SnapshotThumb } from './SnapshotThumb';
import { CardPicker } from './CardPicker';

interface SnapshotEditorDialogProps {
  snapshot: Snapshot | null;
  onClose: () => void;
}

export function SnapshotEditorDialog({ snapshot, onClose }: SnapshotEditorDialogProps) {
  return (
    <Modal open={!!snapshot} onClose={onClose} title="Snapshot details" labelledBy="snapshot-editor-title" width="max-w-3xl">
      {snapshot && <SnapshotForm key={snapshot.id} snapshot={snapshot} onClose={onClose} />}
    </Modal>
  );
}

function SnapshotForm({ snapshot, onClose }: { snapshot: Snapshot; onClose: () => void }) {
  const [title, setTitle] = useState(snapshot.title);
  const [description, setDescription] = useState(snapshot.description);
  const [caption, setCaption] = useState(snapshot.caption);
  const [tags, setTags] = useState(snapshot.tags);
  const [pinned, setPinned] = useState(snapshot.pinned);
  const [cardIds, setCardIds] = useState(snapshot.cardIds);
  const allTags = useAllTags();

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    await updateSnapshot(snapshot.id, { title, description, caption, tags, pinned, cardIds });
    onClose();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form onSubmit={submit} onKeyDown={onKeyDown}>
      <div className="grid gap-6 px-6 py-5 md:grid-cols-[220px_minmax(0,1fr)]">
        <div>
          <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-line bg-surface-2 md:aspect-square">
            <SnapshotThumb snapshot={snapshot} className="h-full w-full p-2" />
          </div>
          <dl className="mt-3 space-y-1 text-xs text-muted">
            <div className="flex justify-between gap-2">
              <dt>Dimensions</dt>
              <dd className="text-ink-2 tabular">
                {snapshot.width} × {snapshot.height}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Size</dt>
              <dd className="text-ink-2 tabular">{formatBytes(snapshot.size)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Added</dt>
              <dd className="text-ink-2">{formatDate(snapshot.createdAt)}</dd>
            </div>
          </dl>
        </div>

        <div className="space-y-4">
          <Field label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="e.g. Peer beta regression" data-autofocus />
          </Field>
          <Field label="Caption" hint="One line shown under the image">
            <input value={caption} onChange={(e) => setCaption(e.target.value)} className={inputClass} placeholder="e.g. Source: company filings, FY2025" />
          </Field>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={`${inputClass} resize-y leading-relaxed`}
              placeholder="What this shows and why it matters."
            />
          </Field>
          <Field label="Tags">
            <TagInput value={tags} onChange={setTags} suggestions={allTags} />
          </Field>
          <div>
            <span className="mb-1.5 flex items-baseline justify-between text-[13px] font-medium text-ink-2">
              Linked knowledge cards
              <span className="text-xs font-normal text-faint">Shown on each linked card</span>
            </span>
            <CardPicker value={cardIds} onChange={setCardIds} currentPhaseId={snapshot.phaseId} />
          </div>
        </div>
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
          {pinned ? 'Pinned as important' : 'Mark as important'}
        </button>
        <span className="mr-2 hidden items-center gap-1 text-xs text-faint sm:flex">
          <Kbd>Ctrl</Kbd>
          <Kbd>↵</Kbd> to save
        </span>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" type="submit">
          Save details
        </Button>
      </div>
    </form>
  );
}
