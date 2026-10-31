import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ID, Phase, ResearchDocument } from '../../types';
import type { SearchSelection } from '../search/SearchPalette';
import { db } from '../../db/database';
import { addDocument, deleteDocument, type DocumentTarget } from '../../db/repository';
import { downloadBlob } from '../../hooks/useBlobUrl';
import { DOCUMENT_ACCEPT, DocumentError, LARGE_DOCUMENT_BYTES, isQuotaError } from '../../lib/documents';
import { queueDocumentProcessing, resumePendingDocuments } from '../../lib/documentProcessing';
import { formatBytes } from '../../lib/images';
import { useToast } from '../ui/Toast';
import { useConfirm } from '../ui/ConfirmProvider';
import { DocumentsContext, type DocumentActions, type LinkTarget } from './DocumentsContext';
import { DocumentViewer, type DocumentViewerState } from './DocumentViewer';
import { DocumentEditorDialog } from './DocumentEditorDialog';
import { DocumentLinkDialog } from './DocumentLinkDialog';

interface DocumentsProviderProps {
  phases: Phase[];
  /** Opens a phase, optionally scrolling to an item in it (from the viewer's connections). */
  onNavigate: (selection: SearchSelection) => void;
  children: ReactNode;
}

/** Owns the document viewer, editor, link dialog and file picker, and exposes them as actions. */
export function DocumentsProvider({ phases, onNavigate, children }: DocumentsProviderProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const [viewer, setViewer] = useState<DocumentViewerState | null>(null);
  const [editingId, setEditingId] = useState<ID | null>(null);
  const [linkTarget, setLinkTarget] = useState<LinkTarget | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickTarget = useRef<DocumentTarget>({ phaseId: null });

  // Finish indexing anything interrupted last time (e.g. the tab closed mid-way).
  useEffect(() => {
    resumePendingDocuments();
  }, []);

  const open = useCallback<DocumentActions['open']>((id, options) => setViewer({ id, query: options?.query, nonce: Date.now() }), []);

  const upload = useCallback<DocumentActions['upload']>(
    async (files, target) => {
      const saved: ResearchDocument[] = [];
      const problems: string[] = [];
      const largest = files.reduce((max, f) => Math.max(max, f.size), 0);
      if (largest > LARGE_DOCUMENT_BYTES) {
        toast({ message: `Saving ${files.length === 1 ? `“${files[0].name}” (${formatBytes(largest)})` : `${files.length} files`}… large files take a few seconds.` });
      }
      for (const file of files) {
        try {
          const doc = await addDocument(file, target);
          saved.push(doc);
          if (doc.textStatus === 'pending') queueDocumentProcessing(doc.id);
        } catch (error) {
          if (error instanceof DocumentError) problems.push(error.message);
          else if (isQuotaError(error)) problems.push(`Browser storage is full, so “${file.name}” was not saved. Delete some large documents and try again.`);
          else problems.push(`“${file.name}” could not be saved.`);
        }
      }
      if (saved.length > 0) {
        toast({
          message: saved.length === 1 ? `“${saved[0].title}” added to the Document Library` : `${saved.length} documents added to the Document Library`,
          action: saved.length === 1 ? { label: 'Open', onClick: () => open(saved[0].id) } : undefined,
        });
      }
      if (problems.length > 0) toast({ message: problems.join(' '), tone: 'error' });
      return saved;
    },
    [toast, open],
  );

  const pick = useCallback<DocumentActions['pick']>((target) => {
    pickTarget.current = target;
    inputRef.current?.click();
  }, []);

  const remove = useCallback<DocumentActions['remove']>(
    async (doc) => {
      const links = doc.cardIds.length + doc.extractIds.length + doc.snapshotIds.length + doc.linkedPhaseIds.length;
      const ok = await confirm({
        title: 'Delete document?',
        message: (
          <>
            <strong className="font-medium text-ink">{doc.title || doc.fileName}</strong> and its stored file ({formatBytes(doc.size)}) will be permanently
            deleted from this browser.
            {links > 0 && ` Its ${links} connection${links === 1 ? '' : 's'} will be removed; the connected cards, extracts and snapshots are kept.`}
          </>
        ),
        confirmLabel: 'Delete document',
        danger: true,
      });
      if (!ok) return false;
      setViewer((v) => (v?.id === doc.id ? null : v));
      await deleteDocument(doc.id);
      toast({ message: 'Document deleted' });
      return true;
    },
    [confirm, toast],
  );

  const download = useCallback<DocumentActions['download']>(
    async (doc) => {
      const attachment = await db.attachments.get(doc.attachmentId);
      if (!attachment) {
        toast({ message: 'The stored file for this document is missing.', tone: 'error' });
        return;
      }
      downloadBlob(`doc:${attachment.id}`, attachment.blob, doc.fileName);
    },
    [toast],
  );

  const uploadForLink = useCallback(
    (target: LinkTarget) =>
      pick({
        phaseId: target.kind === 'phase' ? target.id : target.phaseId,
        cardId: target.kind === 'card' ? target.id : undefined,
        extractId: target.kind === 'extract' ? target.id : undefined,
        snapshotId: target.kind === 'snapshot' ? target.id : undefined,
      }),
    [pick],
  );

  const actions = useMemo<DocumentActions>(
    () => ({ open, upload, pick, edit: setEditingId, remove, download, linkTo: setLinkTarget }),
    [open, upload, pick, remove, download],
  );

  return (
    <DocumentsContext.Provider value={actions}>
      {children}
      <input
        ref={inputRef}
        type="file"
        accept={DOCUMENT_ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length) upload(files, pickTarget.current);
        }}
      />
      <DocumentViewer state={viewer} phases={phases} onClose={() => setViewer(null)} onNavigate={onNavigate} />
      <DocumentEditorDialog documentId={editingId} phases={phases} onClose={() => setEditingId(null)} />
      <DocumentLinkDialog target={linkTarget} phases={phases} onClose={() => setLinkTarget(null)} onUpload={uploadForLink} />
    </DocumentsContext.Provider>
  );
}
