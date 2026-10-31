import { lazy, Suspense, useCallback, useMemo, useState, type ReactNode } from 'react';
import type { ID } from '../../types';
import { db } from '../../db/database';
import { countJournal } from '../../db/bundle';
import { createJournal, deleteJournal } from '../../db/repository';
import { getActiveJournalId, setActiveJournal } from '../../lib/activeJournal';
import { formatBytes } from '../../lib/images';
import { isQuotaError } from '../../lib/documents';
import { useToast } from '../ui/Toast';
import { useConfirm } from '../ui/ConfirmProvider';
import { JournalsContext, type JournalActions } from './JournalsContext';
import { JournalFormDialog, type JournalFormState } from './JournalFormDialog';
import { ManageJournalsDialog } from './ManageJournalsDialog';

// The backup code (ZIP writer and reader) only loads once Backup & restore is first opened.
const BackupDialog = lazy(() => import('./BackupDialog').then((m) => ({ default: m.BackupDialog })));

/** Owns the journal dialogs (new, rename, manage, backup) and exposes journal actions. */
export function JournalsProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState<JournalFormState>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [backupOpened, setBackupOpened] = useState(false);
  const [backup, setBackup] = useState<{ ids?: ID[]; nonce: number } | null>(null);
  const backupUsed = backup !== null || backupOpened;
  if (backup && !backupOpened) setBackupOpened(true);

  const switchTo = useCallback(async (id: ID) => {
    if (id === getActiveJournalId()) return;
    await setActiveJournal(id);
    window.scrollTo({ top: 0 });
  }, []);

  const duplicate = useCallback<JournalActions['duplicate']>(
    async (id) => {
      const source = await db.journals.get(id);
      if (!source) return;
      const counts = await countJournal(id);
      const ok = await confirm({
        title: 'Duplicate journal?',
        message: (
          <>
            A separate copy of <strong className="font-medium text-ink">{source.name}</strong> will be made: {counts.phases} phases, {counts.cards} cards,{' '}
            {counts.snapshots} snapshots, {counts.documents} documents
            {counts.fileBytes > 0 ? ` (${formatBytes(counts.fileBytes)} of files, copied in full)` : ''} and {counts.revisions} revision cards. Changes to one
            never affect the other.
          </>
        ),
        confirmLabel: 'Duplicate',
      });
      if (!ok) return;
      toast({ message: `Copying “${source.name}”…` });
      try {
        const copy = await createJournal({ name: `${source.name} (copy)`, description: source.description }, { kind: 'copy', journalId: id });
        toast({ message: `Created “${copy.name}”`, action: { label: 'Open', onClick: () => void switchTo(copy.id) } });
      } catch (error) {
        toast({ message: isQuotaError(error) ? 'Browser storage is full, so the copy was not made.' : 'The journal could not be copied.', tone: 'error' });
      }
    },
    [confirm, toast, switchTo],
  );

  const remove = useCallback<JournalActions['remove']>(
    async (id) => {
      const journal = await db.journals.get(id);
      if (!journal) return;
      if ((await db.journals.count()) <= 1) {
        toast({ message: 'This is the only journal, so it cannot be deleted.', tone: 'error' });
        return;
      }
      const counts = await countJournal(id);
      const ok = await confirm({
        title: 'Delete journal?',
        message: (
          <>
            <strong className="font-medium text-ink">{journal.name}</strong> and everything in it will be permanently deleted: {counts.phases} phases,{' '}
            {counts.tasks} tasks, {counts.cards} cards, {counts.snapshots} snapshots, {counts.extracts} extracts, {counts.documents} documents
            {counts.fileBytes > 0 ? ` (${formatBytes(counts.fileBytes)} of files)` : ''} and {counts.revisions} revision cards. Other journals are not affected.
            <span className="mt-3 block text-muted">If you might need it later, cancel and export a backup first (Backup &amp; restore).</span>
          </>
        ),
        confirmLabel: 'Delete journal',
        danger: true,
      });
      if (!ok) return;
      try {
        // Move off the journal before it disappears.
        if (getActiveJournalId() === id) {
          const next = (await db.journals.toArray()).filter((j) => j.id !== id).sort((a, b) => a.createdAt - b.createdAt)[0];
          if (next) await switchTo(next.id);
        }
        await deleteJournal(id);
        toast({ message: `Deleted “${journal.name}”` });
      } catch {
        toast({ message: 'The journal could not be deleted.', tone: 'error' });
      }
    },
    [confirm, toast, switchTo],
  );

  const actions = useMemo<JournalActions>(
    () => ({
      switchTo,
      create: (copyOf) => setForm({ mode: 'create', copyOf }),
      rename: (id) => setForm({ mode: 'edit', journalId: id }),
      duplicate,
      remove,
      manage: () => setManageOpen(true),
      backup: (ids) => setBackup({ ids, nonce: Date.now() }),
    }),
    [switchTo, duplicate, remove],
  );

  return (
    <JournalsContext.Provider value={actions}>
      {children}
      <ManageJournalsDialog open={manageOpen} onClose={() => setManageOpen(false)} />
      <JournalFormDialog state={form} onClose={() => setForm(null)} onCreated={(id) => void switchTo(id)} />
      {/* Stays mounted after the first opening so its close animation can play. */}
      {backupUsed && (
        <Suspense fallback={null}>
          <BackupDialog state={backup} onClose={() => setBackup(null)} onImported={(id) => void switchTo(id)} />
        </Suspense>
      )}
    </JournalsContext.Provider>
  );
}
