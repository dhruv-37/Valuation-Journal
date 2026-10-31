import { db } from '../db/database';
import { DEFAULT_JOURNAL_ID } from './id';
import type { ID } from '../types';

/**
 * The journal the app is showing. Kept in a small module store (like the
 * router) so repository writes can read it synchronously, and persisted in the
 * `meta` table so the same journal opens after a reload.
 */

const META_KEY = 'activeJournalId';
let activeId: ID | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeActiveJournal(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The active journal id, or null until it has been read from the database. */
export const activeJournalSnapshot = () => activeId;

/** The active journal id. Writes only happen after it has loaded, so the default is a safety net. */
export function getActiveJournalId(): ID {
  return activeId ?? DEFAULT_JOURNAL_ID;
}

/** Picks the saved journal, or the oldest one if the saved one no longer exists. */
async function load() {
  const saved = (await db.meta.get(META_KEY))?.value as ID | undefined;
  const journals = await db.journals.toArray();
  const exists = (id: ID | undefined) => !!id && journals.some((j) => j.id === id);
  const oldest = [...journals].sort((a, b) => a.createdAt - b.createdAt)[0];
  activeId = exists(saved) ? saved! : exists(DEFAULT_JOURNAL_ID) ? DEFAULT_JOURNAL_ID : (oldest?.id ?? DEFAULT_JOURNAL_ID);
  emit();
}

const ready = load();

/** Switches the whole app to another journal and remembers the choice. */
export async function setActiveJournal(id: ID) {
  await ready;
  if (!(await db.journals.get(id))) return;
  await db.meta.put({ key: META_KEY, value: id });
  activeId = id;
  emit();
}
