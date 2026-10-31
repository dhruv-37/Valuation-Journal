import Dexie, { type EntityTable } from 'dexie';
import type {
  Attachment,
  ChecklistItem,
  DocumentText,
  Journal,
  KnowledgeCard,
  KnowledgeExtract,
  MetaEntry,
  Phase,
  ResearchDocument,
  Snapshot,
} from '../types';
import { seedDatabase } from './seed';

/**
 * IndexedDB database (via Dexie).
 *
 * To evolve the schema, add a new `this.version(n)` block below the existing
 * ones — never edit an earlier version — so saved data migrates in place.
 */
export class ValuationJournalDB extends Dexie {
  journals!: EntityTable<Journal, 'id'>;
  phases!: EntityTable<Phase, 'id'>;
  checklist!: EntityTable<ChecklistItem, 'id'>;
  cards!: EntityTable<KnowledgeCard, 'id'>;
  attachments!: EntityTable<Attachment, 'id'>;
  meta!: EntityTable<MetaEntry, 'key'>;
  snapshots!: EntityTable<Snapshot, 'id'>;
  extracts!: EntityTable<KnowledgeExtract, 'id'>;
  documents!: EntityTable<ResearchDocument, 'id'>;
  documentTexts!: EntityTable<DocumentText, 'documentId'>;

  constructor() {
    super('valuation-journal');

    // Milestone 1.
    this.version(1).stores({
      journals: 'id',
      phases: 'id, journalId, order',
      checklist: 'id, phaseId, order',
      cards: 'id, phaseId, type, order, *tags, updatedAt',
      attachments: 'id, phaseId, [ownerType+ownerId]',
      meta: 'key',
    });

    // Milestone 2: Visual Knowledge Library. Adds two tables; existing tables
    // and records are untouched, so no upgrade function is needed.
    this.version(2).stores({
      snapshots: 'id, phaseId, attachmentId, createdAt, *tags, *cardIds',
      extracts: 'id, phaseId, kind, createdAt, *tags',
    });

    // Milestone 3: Document Management. Adds two tables (document metadata and
    // searchable text); files go in the existing `attachments` table. Existing
    // records are untouched, so no upgrade function is needed.
    this.version(3).stores({
      documents: 'id, journalId, phaseId, kind, createdAt, textStatus, *tags, *linkedPhaseIds, *cardIds, *extractIds, *snapshotIds',
      documentTexts: 'documentId',
    });

    // 'populate' runs exactly once: when the database is first created.
    // Later launches never re-seed, so saved edits are never overwritten.
    this.on('populate', (tx) => seedDatabase(tx));
  }
}

export const db = new ValuationJournalDB();
