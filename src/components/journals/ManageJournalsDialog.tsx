import { useLiveQuery } from 'dexie-react-hooks';
import { Archive, ArrowRight, Copy, Pencil, Plus, Trash } from 'lucide-react';
import type { ID, JournalCounts } from '../../types';
import { db } from '../../db/database';
import { countJournal } from '../../db/bundle';
import { useActiveJournalId, useJournals } from '../../hooks/useActiveJournal';
import { formatDate } from '../../lib/format';
import { formatBytes } from '../../lib/images';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Menu } from '../ui/Menu';
import { useJournalActions } from './JournalsContext';

/** Every journal with what it holds, and the actions to open, rename, copy, export or delete it. */
export function ManageJournalsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const journals = useJournals() ?? [];
  const activeId = useActiveJournalId();
  const actions = useJournalActions();
  // Re-counted whenever any journal's content changes.
  const counts = useLiveQuery(async () => {
    if (!open) return new Map<ID, JournalCounts>();
    const ids = (await db.journals.toCollection().primaryKeys()) as ID[];
    return new Map(await Promise.all(ids.map(async (id) => [id, await countJournal(id)] as const)));
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Journals"
      labelledBy="journals-title"
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" icon={<Archive className="size-4" />} onClick={() => actions.backup()} className="mr-auto">
            Backup &amp; restore
          </Button>
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => actions.create()}>
            New journal
          </Button>
        </>
      }
    >
      <p className="px-6 pt-4 text-sm text-muted">
        Each journal is a separate research project with its own phases, cards, library, documents and revision deck. Nothing is shared between journals.
      </p>
      <ul className="space-y-2 px-4 py-4 sm:px-6">
        {journals.map((j) => {
          const c = counts?.get(j.id);
          const active = j.id === activeId;
          return (
            <li
              key={j.id}
              className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 transition-colors ${active ? 'border-gold/45 bg-gold-soft/30' : 'border-line bg-surface'}`}
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="truncate font-display text-[18px] leading-snug text-ink">{j.name}</span>
                  {active && <span className="text-[10.5px] font-semibold tracking-wider text-gold uppercase">Open now</span>}
                </p>
                {j.description && <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{j.description}</p>}
                <p className="mt-1.5 text-xs text-faint tabular">
                  {c
                    ? `${c.phases} phases · ${c.cards} cards · ${c.snapshots + c.extracts} library items · ${c.documents} documents · ${c.revisions} in Recall${c.fileBytes ? ` · ${formatBytes(c.fileBytes)}` : ''}`
                    : 'Counting…'}
                  <span className="max-sm:block"> · created {formatDate(j.createdAt)}</span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!active && (
                  <Button
                    size="sm"
                    icon={<ArrowRight className="order-last size-3.5" />}
                    onClick={() => {
                      onClose();
                      void actions.switchTo(j.id);
                    }}
                  >
                    Open
                  </Button>
                )}
                <Menu
                  label={`Actions for ${j.name}`}
                  items={[
                    { label: 'Rename…', icon: <Pencil />, onSelect: () => actions.rename(j.id) },
                    { label: 'Duplicate', icon: <Copy />, onSelect: () => void actions.duplicate(j.id) },
                    { label: 'Export backup…', icon: <Archive />, onSelect: () => actions.backup([j.id]) },
                    { label: 'Delete journal…', icon: <Trash />, onSelect: () => void actions.remove(j.id), danger: true, disabled: journals.length <= 1 },
                  ]}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
