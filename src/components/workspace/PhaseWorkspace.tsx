import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { ID, KnowledgeExtract, Phase, Snapshot } from '../../types';
import { usePhaseDetail, usePhaseDocuments } from '../../hooks/useJournalData';
import { addSnapshot, setLastVisitedPhase } from '../../db/repository';
import { isTypingTarget, phaseNumber } from '../../lib/format';
import { ACCEPT_ATTRIBUTE, ACCEPTED_IMAGE_TYPES, ImageError, defaultImageTitle, imageType } from '../../lib/images';
import { isDialogOpen } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { LibraryContext, type LibraryActions } from '../library/LibraryContext';
import { LibraryPanel } from '../library/LibraryPanel';
import { ImageViewer } from '../library/ImageViewer';
import { SnapshotEditorDialog } from '../library/SnapshotEditorDialog';
import { ExtractEditorDialog, type ExtractEditorState } from '../library/ExtractEditorDialog';
import { DropOverlay } from '../library/DropOverlay';
import { useDocumentActions } from '../documents/DocumentsContext';
import { PhaseDocumentsPanel } from '../documents/PhaseDocumentsPanel';
import { SUPPORTED_FORMATS_LABEL } from '../../lib/documents';
import { PhaseHeader } from './PhaseHeader';
import { ObjectivesPanel } from './ObjectivesPanel';
import { ChecklistPanel } from './ChecklistPanel';
import { JournalPanel } from './JournalPanel';

export type FocusKind = 'phase' | 'task' | 'card' | 'snapshot' | 'extract' | 'document';
export type WorkspaceTab = 'journal' | 'library' | 'documents';

/** An item to scroll to and highlight after navigating from search. */
export interface FocusTarget {
  phaseId: ID;
  itemId: ID;
  kind: FocusKind;
  nonce: number;
}

interface PhaseWorkspaceProps {
  phaseId: ID;
  index: number;
  phases: Phase[];
  prev?: Phase;
  next?: Phase;
  focus: FocusTarget | null;
  tab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  scrollContainer: RefObject<HTMLDivElement | null>;
  onNavigate: (id: ID) => void;
  onClose: () => void;
  onEditPhase: (phase: Phase) => void;
}

export function PhaseWorkspace({
  phaseId,
  index,
  phases,
  prev,
  next,
  focus,
  tab,
  onTabChange,
  scrollContainer,
  onNavigate,
  onClose,
  onEditPhase,
}: PhaseWorkspaceProps) {
  const live = usePhaseDetail(phaseId);
  // Keep showing the last loaded data while the phase is being deleted / animating out.
  const stable = useRef(live);
  if (live) stable.current = live;
  const detail = stable.current;
  const phaseDocuments = usePhaseDocuments(phaseId);
  const documents = useDocumentActions();
  const toast = useToast();

  const [viewer, setViewer] = useState<{ ids: ID[]; index: number } | null>(null);
  const [editingSnapshot, setEditingSnapshot] = useState<Snapshot | null>(null);
  const [extractEditor, setExtractEditor] = useState<ExtractEditorState>(null);
  const [localFocus, setLocalFocus] = useState<{ itemId: ID; nonce: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickForCard = useRef<ID | undefined>(undefined);

  useEffect(() => {
    setLastVisitedPhase(phaseId);
  }, [phaseId]);

  /** Scroll an item into view and briefly highlight it. */
  const flash = useCallback(
    (itemId: ID, delay: number) =>
      window.setTimeout(() => {
        const el = scrollContainer.current?.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(itemId)}"]`);
        if (!el) return;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.classList.remove('vj-flash');
        void el.offsetWidth; // restart the animation if already applied
        el.classList.add('vj-flash');
        window.setTimeout(() => el.classList.remove('vj-flash'), 2300);
      }, delay),
    [scrollContainer],
  );

  // Item chosen in search: show the right tab, then scroll to it.
  const handled = useRef<number | null>(null);
  const focusItemId = focus?.phaseId === phaseId ? focus.itemId : null;
  useEffect(() => {
    if (!focus || focus.phaseId !== phaseId || !detail || handled.current === focus.nonce) return;
    handled.current = focus.nonce;
    if (focus.kind === 'card') onTabChange('journal');
    if (focus.kind === 'snapshot' || focus.kind === 'extract') onTabChange('library');
    if (focus.kind === 'document') onTabChange('documents');
    const timer = flash(focus.itemId, 420);
    return () => window.clearTimeout(timer);
  }, [focus, phaseId, detail, flash, onTabChange]);

  // Newly captured items: highlight once they have rendered.
  useEffect(() => {
    if (!localFocus) return;
    const timer = flash(localFocus.itemId, 250);
    return () => window.clearTimeout(timer);
  }, [localFocus, flash]);

  const snapshotsById = useMemo(() => {
    const map = new Map<ID, Snapshot>();
    for (const s of [...(detail?.snapshots ?? []), ...(detail?.linkedSnapshots ?? [])]) map.set(s.id, s);
    return map;
  }, [detail]);

  const addImages = useCallback<LibraryActions['addImages']>(
    async (files, options = {}) => {
      const accepted = files.filter((f) => imageType(f));
      const problems: string[] = [];
      if (accepted.length < files.length) problems.push('Only PNG, JPG and WebP images are supported.');
      const saved: Snapshot[] = [];
      for (const file of accepted) {
        try {
          saved.push(await addSnapshot(phaseId, file, { title: defaultImageTitle(file, !!options.pasted), cardIds: options.cardId ? [options.cardId] : [] }));
        } catch (error) {
          if (error instanceof ImageError) problems.push(error.message);
          else if (error instanceof Error && /quota/i.test(error.name + error.message)) problems.push('Browser storage is full. Delete some snapshots and try again.');
          else problems.push('The image could not be saved.');
        }
      }
      if (saved.length > 0) {
        if (options.cardId) {
          setLocalFocus({ itemId: options.cardId, nonce: Date.now() });
        } else {
          onTabChange('library');
          setLocalFocus({ itemId: saved[0].id, nonce: Date.now() });
        }
        toast({
          message: options.cardId
            ? 'Image attached to the card'
            : saved.length === 1
              ? 'Snapshot saved to the library'
              : `${saved.length} snapshots saved to the library`,
          action: saved.length === 1 ? { label: 'Add details', onClick: () => setEditingSnapshot(saved[0]) } : undefined,
        });
      }
      if (problems.length > 0) toast({ message: Array.from(new Set(problems)).join(' '), tone: 'error' });
      return saved.length;
    },
    [phaseId, onTabChange, toast],
  );

  /**
   * Files dropped or pasted on the page. On the Documents tab everything becomes
   * a document; elsewhere images become snapshots (as before) and other
   * supported files become documents filed in this phase.
   */
  const addFiles = useCallback(
    async (files: File[], pasted = false) => {
      const asDocuments = tab === 'documents' ? files : files.filter((f) => !imageType(f));
      const asSnapshots = tab === 'documents' ? [] : files.filter((f) => imageType(f));
      if (asSnapshots.length) await addImages(asSnapshots, { pasted });
      if (asDocuments.length) {
        const saved = await documents.upload(asDocuments, { phaseId });
        if (saved.length) {
          onTabChange('documents');
          setLocalFocus({ itemId: saved[0].id, nonce: Date.now() });
        }
      }
    },
    [tab, addImages, documents, phaseId, onTabChange],
  );

  const actions = useMemo<LibraryActions>(
    () => ({
      openViewer: (list, snapshotId) => {
        const ids = list.map((s) => s.id);
        setViewer({ ids, index: Math.max(0, ids.indexOf(snapshotId)) });
      },
      editSnapshot: setEditingSnapshot,
      addImages,
      pickImages: (options) => {
        pickForCard.current = options?.cardId;
        fileInputRef.current?.click();
      },
      pasteFromClipboard: async () => {
        if (!navigator.clipboard?.read) {
          toast({ message: 'Press Ctrl+V (⌘V on Mac) to paste a screenshot.' });
          return;
        }
        try {
          const items = await navigator.clipboard.read();
          const images: File[] = [];
          for (const item of items) {
            const type = item.types.find((t) => (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(t));
            if (type) images.push(new File([await item.getType(type)], `image.${type.split('/')[1]}`, { type }));
          }
          if (images.length) await addImages(images, { pasted: true });
          else toast({ message: 'There is no image on the clipboard. Copy a screenshot first.', tone: 'error' });
        } catch {
          toast({ message: 'Clipboard access was blocked. Press Ctrl+V instead.', tone: 'error' });
        }
      },
      newExtract: (prefill) => setExtractEditor({ mode: 'create', prefill }),
      editExtract: (extract: KnowledgeExtract) => setExtractEditor({ mode: 'edit', extract }),
    }),
    [addImages, toast],
  );

  // Paste anywhere in the phase: images become snapshots; text opens a new extract.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (isDialogOpen() || !e.clipboardData) return;
      const files = Array.from(e.clipboardData.files);
      if (files.length > 0) {
        e.preventDefault();
        addFiles(files, true);
        return;
      }
      if (isTypingTarget(e.target)) return;
      const text = e.clipboardData.getData('text/plain').trim();
      if (text) {
        e.preventDefault();
        setExtractEditor({ mode: 'create', prefill: { text } });
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [addFiles]);

  if (!detail) {
    return <div className="mx-auto h-[60vh] max-w-[1240px]" aria-busy="true" />;
  }

  const { phase, tasks, cards, snapshots, extracts, linkedSnapshots } = detail;
  const filedDocuments = phaseDocuments?.filed ?? [];
  const linkedDocuments = phaseDocuments?.linked ?? [];
  const documentCount = filedDocuments.length + linkedDocuments.length;
  const viewerList = viewer ? viewer.ids.map((id) => snapshotsById.get(id)).filter((s): s is Snapshot => !!s) : [];
  const viewerIndex = viewer ? Math.min(viewer.index, viewerList.length - 1) : -1;

  return (
    <LibraryContext.Provider value={actions}>
      <div className="mx-auto max-w-[1240px] px-4 pb-24 sm:px-8">
        <PhaseHeader
          phase={phase}
          index={index}
          total={phases.length}
          tasks={tasks}
          cards={cards}
          snapshotCount={snapshots.length}
          extractCount={extracts.length}
          documentCount={documentCount}
          filedDocumentCount={filedDocuments.length}
          onEdit={() => onEditPhase(phase)}
          onDeleted={onClose}
        />

        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-10">
          <aside className="space-y-6">
            <ObjectivesPanel phase={phase} />
            <ChecklistPanel phaseId={phase.id} tasks={tasks} />
          </aside>

          <div className="min-w-0">
            <div role="tablist" aria-label="Phase knowledge" className="flex items-end gap-5 border-b border-line sm:gap-7">
              <TabButton active={tab === 'journal'} count={cards.length} onClick={() => onTabChange('journal')}>
                <span className="sm:hidden">Journal</span>
                <span className="hidden sm:inline">Knowledge journal</span>
              </TabButton>
              <TabButton active={tab === 'library'} count={snapshots.length + extracts.length} onClick={() => onTabChange('library')}>
                Library
              </TabButton>
              <TabButton active={tab === 'documents'} count={documentCount} onClick={() => onTabChange('documents')}>
                Documents
              </TabButton>
            </div>
            <div role="tabpanel" className="pt-5">
              {tab === 'journal' ? (
                <JournalPanel phaseId={phase.id} cards={cards} linkedSnapshots={linkedSnapshots} focusCardId={focus?.kind === 'card' ? focusItemId : null} />
              ) : tab === 'library' ? (
                <LibraryPanel
                  snapshots={snapshots}
                  extracts={extracts}
                  focusItemId={focus?.kind === 'snapshot' || focus?.kind === 'extract' ? focusItemId : localFocus?.itemId ?? null}
                />
              ) : (
                <PhaseDocumentsPanel
                  phase={phase}
                  phases={phases}
                  filed={filedDocuments}
                  linked={linkedDocuments}
                  focusItemId={focus?.kind === 'document' ? focusItemId : localFocus?.itemId ?? null}
                />
              )}
            </div>
          </div>
        </div>

        <nav aria-label="Adjacent phases" className="mt-16 grid grid-cols-1 gap-4 border-t border-line pt-8 sm:grid-cols-2">
          {prev ? (
            <AdjacentLink direction="prev" label={prev.title} number={phaseNumber(index - 1)} onClick={() => onNavigate(prev.id)} />
          ) : (
            <span />
          )}
          {next && <AdjacentLink direction="next" label={next.title} number={phaseNumber(index + 1)} onClick={() => onNavigate(next.id)} />}
        </nav>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length) addImages(files, { cardId: pickForCard.current });
        }}
      />
      <DropOverlay
        title={tab === 'documents' ? 'Drop to add documents' : 'Drop to add to this phase'}
        subtitle={
          tab === 'documents'
            ? `Filed under “${phase.title}” · ${SUPPORTED_FORMATS_LABEL}`
            : `Images become snapshots in the Library; PDFs, spreadsheets and other files go to Documents · “${phase.title}”`
        }
        onDrop={(files) => addFiles(files)}
      />
      <ImageViewer
        snapshots={viewerList}
        index={viewerIndex}
        phases={phases}
        onIndexChange={(i) => setViewer((v) => (v ? { ...v, index: i } : v))}
        onClose={() => setViewer(null)}
        onEdit={setEditingSnapshot}
      />
      <SnapshotEditorDialog snapshot={editingSnapshot} onClose={() => setEditingSnapshot(null)} />
      <ExtractEditorDialog
        phaseId={phase.id}
        state={extractEditor}
        onClose={() => setExtractEditor(null)}
        onSaved={(id) => {
          onTabChange('library');
          setLocalFocus({ itemId: id, nonce: Date.now() });
        }}
      />
    </LibraryContext.Provider>
  );
}

function TabButton({ active, count, onClick, children }: { active: boolean; count: number; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`-mb-px flex shrink-0 items-baseline gap-1.5 border-b-2 pb-3 font-display text-[20px] leading-none font-medium tracking-tight whitespace-nowrap transition-colors sm:gap-2 sm:text-[26px] ${
        active ? 'border-gold text-ink' : 'border-transparent text-faint hover:text-ink-2'
      }`}
    >
      {children}
      <span className="font-sans text-sm font-normal text-muted tabular">{count}</span>
    </button>
  );
}

function AdjacentLink({ direction, label, number, onClick }: { direction: 'prev' | 'next'; label: string; number: string; onClick: () => void }) {
  const isNext = direction === 'next';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-w-0 items-center gap-4 rounded-2xl border border-line bg-surface p-5 text-left shadow-card transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-lift ${
        isNext ? 'sm:col-start-2 sm:flex-row-reverse sm:text-right' : ''
      }`}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line text-muted transition-colors group-hover:border-gold/60 group-hover:text-gold">
        {isNext ? <ArrowRight className="size-4" /> : <ArrowLeft className="size-4" />}
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-medium tracking-wide text-muted uppercase">{isNext ? 'Next phase' : 'Previous phase'}</span>
        <span className="mt-0.5 block truncate font-display text-lg text-ink">
          <span className="mr-2 text-faint tabular">{number}</span>
          {label}
        </span>
      </span>
    </button>
  );
}
