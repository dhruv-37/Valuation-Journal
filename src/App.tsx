import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import type { ID, Phase } from './types';
import { useDocuments, useLastVisitedPhaseId, usePhases, usePhaseStats } from './hooks/useJournalData';
import { router, useRoutePage, useRoutePhaseId, type PageRoute } from './hooks/useHashRoute';
import { isTypingTarget } from './lib/format';
import { Overview } from './components/overview/Overview';
import { PhaseLayer } from './components/workspace/PhaseLayer';
import type { FocusTarget } from './components/workspace/PhaseWorkspace';
import { SearchPalette, type SearchSelection } from './components/search/SearchPalette';
import { ManagePhasesDialog } from './components/phases/ManagePhasesDialog';
import { PhaseFormDialog, type PhaseFormState } from './components/phases/PhaseFormDialog';
import { DocumentsProvider } from './components/documents/DocumentsProvider';
import { DocumentLibraryPage } from './components/documents/DocumentLibraryPage';
import { isDialogOpen } from './components/ui/Modal';
import { RecallPage } from './components/recall/RecallPage';
import { RecallSession, type RecallSessionState } from './components/recall/RecallSession';
import type { RecallItem } from './hooks/useJournalData';

export default function App() {
  const phases = usePhases();
  const stats = usePhaseStats();
  const documents = useDocuments();
  const lastVisitedId = useLastVisitedPhaseId();
  const routePhaseId = useRoutePhaseId();
  const routePage = useRoutePage();

  const [searchOpen, setSearchOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [phaseForm, setPhaseForm] = useState<PhaseFormState>(null);
  const [focus, setFocus] = useState<FocusTarget | null>(null);
  const [session, setSession] = useState<RecallSessionState | null>(null);

  const activeId = phases && routePhaseId && phases.some((p) => p.id === routePhaseId) ? routePhaseId : null;
  // The exit animation needs to know which card to shrink back into.
  const lastActiveId = useRef<ID | null>(null);
  if (activeId) lastActiveId.current = activeId;
  // The page under a phase workspace is the one it was opened from.
  const basePage = useRef<PageRoute>('overview');
  if (routePage) basePage.current = routePage;
  const page = basePage.current;

  // A link to a phase that no longer exists falls back to the overview.
  useEffect(() => {
    if (phases && routePhaseId && !activeId) router.toOverview();
  }, [phases, routePhaseId, activeId]);

  // Switching between the overview and the Document Library starts at the top.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [page]);

  const openPhase = useCallback(
    (id: ID) => {
      if (activeId) router.switchPhase(id);
      else router.openPhase(id);
    },
    [activeId],
  );
  // Close back to whichever page is underneath, even when the phase was opened from a link.
  const closePhase = useCallback(() => router.toOverview(basePage.current), []);

  /** Opens a phase and, optionally, scrolls to an item in it (search results, document connections). */
  const navigate = useCallback(
    ({ phaseId, itemId, kind }: SearchSelection) => {
      setSearchOpen(false);
      if (itemId) setFocus({ phaseId, itemId, kind, nonce: Date.now() });
      if (phaseId !== activeId) openPhase(phaseId);
    },
    [activeId, openPhase],
  );

  /** From a revision card to its source card or extract in the journal. */
  const openRecallSource = useCallback(
    (item: RecallItem) => {
      setSession(null);
      navigate({ phaseId: item.phaseId, itemId: item.revision.sourceId, kind: item.card ? 'card' : 'extract' });
    },
    [navigate],
  );

  // Global shortcuts: Ctrl/Cmd+K or "/" opens search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((open) => !open);
      } else if (e.key === '/' && !isTypingTarget(e.target) && !isDialogOpen()) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!phases) {
    return <div className="min-h-dvh bg-canvas" aria-busy="true" />;
  }

  return (
    <DocumentsProvider phases={phases} onNavigate={navigate}>
      <div inert={!!activeId} aria-hidden={!!activeId}>
        {page === 'documents' ? (
          <DocumentLibraryPage phases={phases} onOpenPhase={openPhase} onSearch={() => setSearchOpen(true)} covered={!!activeId} />
        ) : page === 'recall' ? (
          <RecallPage
            phases={phases}
            documentCount={documents?.length ?? 0}
            onSearch={() => setSearchOpen(true)}
            onStart={setSession}
            onOpenSource={openRecallSource}
          />
        ) : (
          <Overview
            phases={phases}
            stats={stats}
            documentCount={documents?.length ?? 0}
            lastVisitedId={lastVisitedId}
            onOpenPhase={openPhase}
            onAddPhase={() => setPhaseForm({ mode: 'create' })}
            onManage={() => setManageOpen(true)}
            onSearch={() => setSearchOpen(true)}
          />
        )}
      </div>

      <AnimatePresence custom={lastActiveId.current}>
        {activeId && (
          <PhaseLayer
            key="phase-layer"
            phaseId={activeId}
            phases={phases}
            focus={focus}
            backLabel={page === 'documents' ? 'Documents' : page === 'recall' ? 'Recall' : 'Pathway'}
            onClose={closePhase}
            onNavigate={openPhase}
            onEditPhase={(phase: Phase) => setPhaseForm({ mode: 'edit', phase })}
            onSearch={() => setSearchOpen(true)}
          />
        )}
      </AnimatePresence>

      <ManagePhasesDialog
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        phases={phases}
        stats={stats}
        onAdd={() => setPhaseForm({ mode: 'create' })}
        onEdit={(phase) => setPhaseForm({ mode: 'edit', phase })}
      />
      <PhaseFormDialog state={phaseForm} onClose={() => setPhaseForm(null)} />
      <RecallSession state={session} phases={phases} onClose={() => setSession(null)} onRestart={setSession} onOpenSource={openRecallSource} />
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} phases={phases} onSelect={navigate} />
    </DocumentsProvider>
  );
}
