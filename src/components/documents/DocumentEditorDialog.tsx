import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown, Images } from 'lucide-react';
import { db } from '../../db/database';
import type { ID, Phase, ResearchDocument } from '../../types';
import { updateDocument } from '../../db/repository';
import { useAllTags, useDocument } from '../../hooks/useJournalData';
import { EXTRACT_KIND_META } from '../../lib/extractKinds';
import { formatLabel } from '../../lib/documents';
import { formatDate, phaseNumber } from '../../lib/format';
import { formatBytes } from '../../lib/images';
import { Modal } from '../ui/Modal';
import { Button, Kbd } from '../ui/Button';
import { Field, inputClass } from '../ui/Field';
import { TagInput } from '../ui/TagInput';
import { CardPicker } from '../library/CardPicker';
import { DocumentThumb } from './DocumentThumb';
import { LinkPicker, type PickerItem } from './LinkPicker';

interface DocumentEditorDialogProps {
  documentId: ID | null;
  phases: Phase[];
  onClose: () => void;
}

export function DocumentEditorDialog({ documentId, phases, onClose }: DocumentEditorDialogProps) {
  const doc = useDocument(documentId);
  return (
    <Modal open={!!documentId} onClose={onClose} title="Document details" labelledBy="document-editor-title" width="max-w-3xl">
      {doc && <DocumentForm key={doc.id} document={doc} phases={phases} onClose={onClose} />}
    </Modal>
  );
}

function DocumentForm({ document: doc, phases, onClose }: { document: ResearchDocument; phases: Phase[]; onClose: () => void }) {
  const [title, setTitle] = useState(doc.title);
  const [description, setDescription] = useState(doc.description);
  const [tags, setTags] = useState(doc.tags);
  const [phaseId, setPhaseId] = useState<ID | null>(doc.phaseId);
  const [linkedPhaseIds, setLinkedPhaseIds] = useState(doc.linkedPhaseIds);
  const [cardIds, setCardIds] = useState(doc.cardIds);
  const [extractIds, setExtractIds] = useState(doc.extractIds);
  const [snapshotIds, setSnapshotIds] = useState(doc.snapshotIds);
  const allTags = useAllTags();

  const library = useLiveQuery(async () => {
    const [extracts, snapshots] = await Promise.all([db.extracts.toArray(), db.snapshots.toArray()]);
    return { extracts, snapshots };
  }, []);

  const phaseGroups = useMemo(() => phases.map((p, i) => ({ id: p.id, label: `${phaseNumber(i)} · ${p.title}` })), [phases]);
  const phaseItems = useMemo<PickerItem[]>(
    () => phases.filter((p) => p.id !== phaseId).map((p) => ({ id: p.id, label: `${phaseNumber(phases.indexOf(p))} · ${p.title}`, groupId: 'all' })),
    [phases, phaseId],
  );
  const extractItems = useMemo<PickerItem[]>(
    () =>
      (library?.extracts ?? []).map((e) => {
        const Icon = EXTRACT_KIND_META[e.kind].icon;
        return {
          id: e.id,
          label: e.title || e.text.slice(0, 90),
          groupId: e.phaseId,
          icon: <Icon className={`size-3.5 ${EXTRACT_KIND_META[e.kind].text}`} />,
          keywords: `${e.text} ${e.tags.join(' ')} ${e.sourceDocument ?? ''}`,
        };
      }),
    [library],
  );
  const snapshotItems = useMemo<PickerItem[]>(
    () =>
      (library?.snapshots ?? []).map((s) => ({
        id: s.id,
        label: s.title || 'Untitled snapshot',
        groupId: s.phaseId,
        icon: <Images className="size-3.5 text-muted" />,
        keywords: `${s.caption} ${s.tags.join(' ')}`,
      })),
    [library],
  );

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    await updateDocument(doc.id, { title, description, tags, phaseId, linkedPhaseIds, cardIds, extractIds, snapshotIds });
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
      <div className="grid gap-6 px-6 py-5 md:grid-cols-[200px_minmax(0,1fr)]">
        <div>
          <DocumentThumb document={doc} className="aspect-[3/4] w-full max-w-[200px] rounded-xl border border-line" />
          <dl className="mt-3 space-y-1 text-xs text-muted">
            <Row label="File">
              <span className="block truncate" title={doc.fileName}>
                {doc.fileName}
              </span>
            </Row>
            <Row label="Type">
              {formatLabel(doc.fileName, doc.kind)}
            </Row>
            <Row label="Size">{formatBytes(doc.size)}</Row>
            {doc.pageCount ? <Row label="Pages">{doc.pageCount}</Row> : null}
            <Row label="Uploaded">{formatDate(doc.createdAt)}</Row>
          </dl>
        </div>

        <div className="min-w-0 space-y-4">
          <Field label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder={doc.fileName} data-autofocus />
          </Field>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={`${inputClass} resize-y leading-relaxed`}
              placeholder="What this document covers and why it matters for the valuation."
            />
          </Field>
          <Field label="Tags">
            <TagInput value={tags} onChange={setTags} suggestions={allTags} />
          </Field>
          <Field label="Filed in" hint="The phase this document belongs to">
            <span className="relative block">
              <select
                value={phaseId ?? ''}
                onChange={(e) => {
                  const next = e.target.value || null;
                  setPhaseId(next);
                  setLinkedPhaseIds((ids) => ids.filter((id) => id !== next));
                }}
                className={`${inputClass} cursor-pointer appearance-none pr-9`}
              >
                <option value="">Unfiled</option>
                {phases.map((p, i) => (
                  <option key={p.id} value={p.id}>
                    {phaseNumber(i)} · {p.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" />
            </span>
          </Field>

          <fieldset className="space-y-4 border-t border-line pt-4">
            <legend className="sr-only">Connections</legend>
            <p className="text-[13px] leading-relaxed text-muted">
              Connect the document to the phases and knowledge it supports. It then appears on each connected card, extract and phase.
            </p>
            <Picker label="Also relevant to" hint="Other phases">
              <LinkPicker items={phaseItems} groups={[{ id: 'all', label: 'Phases' }]} value={linkedPhaseIds} onChange={setLinkedPhaseIds} placeholder="Find phases…" emptyText="No other phases." />
            </Picker>
            <Picker label="Knowledge cards">
              <CardPicker value={cardIds} onChange={setCardIds} currentPhaseId={phaseId ?? ''} />
            </Picker>
            <Picker label="Important extracts">
              <LinkPicker
                items={extractItems}
                groups={phaseGroups}
                value={extractIds}
                onChange={setExtractIds}
                focusGroupId={phaseId}
                placeholder="Find extracts in any phase…"
                emptyText="No extracts in this phase. Search to link extracts from other phases."
              />
            </Picker>
            <Picker label="Snapshots">
              <LinkPicker
                items={snapshotItems}
                groups={phaseGroups}
                value={snapshotIds}
                onChange={setSnapshotIds}
                focusGroupId={phaseId}
                placeholder="Find snapshots in any phase…"
                emptyText="No snapshots in this phase. Search to link snapshots from other phases."
              />
            </Picker>
          </fieldset>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2/50 px-6 py-3.5">
        <span className="mr-2 hidden items-center gap-1 text-xs text-faint sm:flex">
          <Kbd>Ctrl</Kbd>
          <Kbd>↵</Kbd> to save
        </span>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" type="submit">
          Save document
        </Button>
      </div>
    </form>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="shrink-0">{label}</dt>
      <dd className="min-w-0 text-right text-ink-2 tabular">{children}</dd>
    </div>
  );
}

function Picker({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-1.5 flex items-baseline justify-between text-[13px] font-medium text-ink-2">
        {label}
        {hint && <span className="text-xs font-normal text-faint">{hint}</span>}
      </span>
      {children}
    </div>
  );
}
