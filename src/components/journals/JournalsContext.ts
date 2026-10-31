import { createContext, useContext } from 'react';
import type { ID } from '../../types';

/** Journal actions available from any header (switcher) or dialog. Provided by JournalsProvider. */
export interface JournalActions {
  /** Makes another journal the one on screen. */
  switchTo: (id: ID) => Promise<void>;
  /** Opens the new-journal dialog, optionally preset to copy a journal. */
  create: (copyOf?: ID) => void;
  rename: (id: ID) => void;
  /** Asks for confirmation, then makes an independent copy. */
  duplicate: (id: ID) => Promise<void>;
  /** Asks for confirmation, then deletes the journal and everything in it. */
  remove: (id: ID) => Promise<void>;
  manage: () => void;
  /** Opens Backup & restore, optionally with these journals ticked for export. */
  backup: (journalIds?: ID[]) => void;
}

export const JournalsContext = createContext<JournalActions | null>(null);

export function useJournalActions() {
  const actions = useContext(JournalsContext);
  if (!actions) throw new Error('useJournalActions must be used inside JournalsProvider');
  return actions;
}
