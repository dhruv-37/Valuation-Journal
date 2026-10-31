import { Archive } from 'lucide-react';
import { useLastBackupAt } from '../../hooks/useJournalData';
import { useNow } from '../../hooks/useNow';
import { useJournalActions } from '../journals/JournalsContext';

const DAY = 86_400_000;
/** A backup older than this is worth a reminder. */
const STALE_AFTER = 30 * DAY;

interface BackupReminderProps {
  /** Whether the journal holds documents or snapshots, i.e. files worth backing up. */
  hasFiles: boolean;
}

/**
 * A quiet line on the overview when the active journal has never been exported
 * (and holds files) or its last export is over 30 days old. Backups are manual
 * and all data lives in one browser profile, so nothing else would prompt one.
 */
export function BackupReminder({ hasFiles }: BackupReminderProps) {
  const lastBackupAt = useLastBackupAt();
  const now = useNow(60 * 60_000);
  const actions = useJournalActions();

  if (lastBackupAt === undefined) return null;
  const show = lastBackupAt === null ? hasFiles : now - lastBackupAt > STALE_AFTER;
  if (!show) return null;
  const days = lastBackupAt === null ? 0 : Math.floor((now - lastBackupAt) / DAY);

  return (
    <p className="mt-5 inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-surface py-1.5 pr-4 pl-3 text-xs text-muted shadow-card">
      <Archive className="size-3.5 shrink-0 text-gold" aria-hidden />
      <span className="min-w-0 truncate">{lastBackupAt === null ? 'No backup of this journal yet' : `Last backup ${days} days ago`}</span>
      <span aria-hidden className="text-faint">
        ·
      </span>
      <button
        type="button"
        onClick={() => actions.backup()}
        className="shrink-0 font-medium whitespace-nowrap text-gold underline-offset-2 transition-colors hover:text-gold-strong hover:underline"
      >
        Back up now
      </button>
    </p>
  );
}
