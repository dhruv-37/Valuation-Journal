import { useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { activeJournalSnapshot, subscribeActiveJournal } from '../lib/activeJournal';
import type { ID } from '../types';

/** The active journal id, or null until it has been read from the database. */
export function useActiveJournalId(): ID | null {
  return useSyncExternalStore(subscribeActiveJournal, activeJournalSnapshot);
}

/** The active journal record (name, description). `undefined` while loading. */
export function useActiveJournal() {
  const id = useActiveJournalId();
  return useLiveQuery(async () => (id ? ((await db.journals.get(id)) ?? null) : undefined), [id]);
}

/** All journals, oldest first. */
export function useJournals() {
  return useLiveQuery(async () => (await db.journals.toArray()).sort((a, b) => a.createdAt - b.createdAt), []);
}
