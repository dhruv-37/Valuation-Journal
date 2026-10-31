import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Upload } from 'lucide-react';
import { db } from '../../db/database';
import type { ID, Phase, ResearchDocument } from '../../types';
import { setItemDocuments } from '../../db/repository';
import { DOCUMENT_KIND_META } from '../../lib/documents';
import { phaseNumber } from '../../lib/format';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { LinkPicker, type PickerItem } from './LinkPicker';
import type { LinkTarget } from './DocumentsContext';

interface DocumentLinkDialogProps {
  target: LinkTarget | null;
  phases: Phase[];
  onClose: () => void;
  /** Opens the file picker; new uploads are linked to the target. */
  onUpload: (target: LinkTarget) => void;
}

const FIELD = { card: 'cardIds', extract: 'extractIds', snapshot: 'snapshotIds', phase: 'linkedPhaseIds' } as const;
const NOUN = { card: 'card', extract: 'extract', snapshot: 'snapshot', phase: 'phase' } as const;

/** Choose which library documents are connected to a card, extract, snapshot or phase. */
export function DocumentLinkDialog({ target, phases, onClose, onUpload }: DocumentLinkDialogProps) {
  const data = useLiveQuery(async () => {
    if (!target) return null;
    const [documents, linked] = await Promise.all([db.documents.toArray(), db.documents.where(FIELD[target.kind]).equals(target.id).primaryKeys()]);
    return { documents, linked: linked as ID[] };
  }, [target?.kind, target?.id]);

  return (
    <Modal open={!!target} onClose={onClose} title="Connected documents" labelledBy="document-link-title" width="max-w-xl">
      {target && data && <LinkForm key={`${target.kind}:${target.id}`} target={target} phases={phases} documents={data.documents} initial={data.linked} onClose={onClose} onUpload={onUpload} />}
    </Modal>
  );
}

interface LinkFormProps {
  target: LinkTarget;
  phases: Phase[];
  documents: ResearchDocument[];
  initial: ID[];
  onClose: () => void;
  onUpload: (target: LinkTarget) => void;
}

function LinkForm({ target, phases, documents, initial, onClose, onUpload }: LinkFormProps) {
  const [value, setValue] = useState(initial);
  const toast = useToast();

  const groups = useMemo(() => [...phases.map((p, i) => ({ id: p.id, label: `${phaseNumber(i)} · ${p.title}` })), { id: '', label: 'Unfiled' }], [phases]);
  const items = useMemo<PickerItem[]>(
    () =>
      documents
        // A document filed under this phase is already part of it.
        .filter((d) => !(target.kind === 'phase' && d.phaseId === target.id))
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((d) => {
          const meta = DOCUMENT_KIND_META[d.kind];
          const Icon = meta.icon;
          return {
            id: d.id,
            label: d.title || d.fileName,
            groupId: d.phaseId ?? '',
            icon: <Icon className={`size-3.5 ${meta.text}`} />,
            keywords: `${d.fileName} ${d.tags.join(' ')} ${d.description}`,
          };
        }),
    [documents, target],
  );

  const save = async () => {
    await setItemDocuments(target.kind, target.id, value);
    onClose();
    const added = value.filter((id) => !initial.includes(id)).length;
    const removed = initial.filter((id) => !value.includes(id)).length;
    if (added || removed) toast({ message: `Connections updated · ${added} added, ${removed} removed` });
  };

  return (
    <>
      <div className="space-y-3 px-6 py-5">
        <p className="text-sm text-muted">
          Documents connected to the {NOUN[target.kind]} <strong className="font-medium text-ink">{target.label || 'Untitled'}</strong>.
        </p>
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-muted">
            The Document Library is empty. Upload a file to connect it here.
          </p>
        ) : (
          <LinkPicker
            items={items}
            groups={groups}
            value={value}
            onChange={setValue}
            focusGroupId={undefined}
            placeholder="Find documents by title, file name or tag…"
            emptyText="No documents yet."
            maxHeight="max-h-72"
          />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2/50 px-6 py-3.5">
        <Button
          variant="ghost"
          className="mr-auto"
          icon={<Upload className="size-4" />}
          onClick={() => {
            onClose();
            onUpload(target);
          }}
        >
          Upload new
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={save}>
          Save connections
        </Button>
      </div>
    </>
  );
}
