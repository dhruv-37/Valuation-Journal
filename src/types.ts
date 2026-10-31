/**
 * Domain model for Valuation Journal.
 *
 * Every record carries its own id and timestamps so new record types
 * (attachments, recall sessions, multiple journals) can be added later
 * as new Dexie tables without reshaping existing data.
 */

export type ID = string;

export interface Timestamps {
  createdAt: number;
  updatedAt: number;
}

/** A journal groups phases. Only one ("default") is used in this milestone. */
export interface Journal extends Timestamps {
  id: ID;
  name: string;
  description: string;
}

export interface Phase extends Timestamps {
  id: ID;
  journalId: ID;
  /** Position in the pathway. Displayed numbers are derived from this order. */
  order: number;
  title: string;
  description: string;
  objectives: string[];
}

export interface ChecklistItem extends Timestamps {
  id: ID;
  phaseId: ID;
  text: string;
  done: boolean;
  order: number;
  completedAt?: number;
}

export const CARD_TYPES = [
  'concept',
  'formula',
  'assumption',
  'important',
  'warning',
  'example',
  'decision',
  'source',
] as const;

export type CardType = (typeof CARD_TYPES)[number];

export interface KnowledgeCard extends Timestamps {
  id: ID;
  phaseId: ID;
  type: CardType;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  /** Lower numbers appear first (after pinned cards). */
  order: number;
  /** Optional reference: report name, page, URL. */
  source?: string;
}

/**
 * A screenshot or image in a phase's Snapshot Library.
 * Metadata and a small thumbnail live here; the full-resolution image is an
 * Attachment (ownerType 'snapshot'), so gallery queries stay light.
 */
export interface Snapshot extends Timestamps {
  id: ID;
  phaseId: ID;
  attachmentId: ID;
  title: string;
  description: string;
  caption: string;
  tags: string[];
  pinned: boolean;
  /** Knowledge cards this snapshot illustrates (any phase). */
  cardIds: ID[];
  fileName: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  thumbnail: Blob;
}

export const EXTRACT_KINDS = ['sentence', 'paragraph', 'observation', 'formula', 'explanation', 'lesson'] as const;

export type ExtractKind = (typeof EXTRACT_KINDS)[number];

/** A saved passage, observation or formula with its source. */
export interface KnowledgeExtract extends Timestamps {
  id: ID;
  phaseId: ID;
  kind: ExtractKind;
  title: string;
  text: string;
  sourceDocument?: string;
  /** Page number or section, e.g. "p. 84" or "Note 12". */
  location?: string;
  url?: string;
  tags: string[];
  pinned: boolean;
}

export const DOCUMENT_KINDS = ['pdf', 'spreadsheet', 'csv', 'word', 'presentation', 'text', 'markdown', 'image'] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** Progress of reading a document's text for search (PDF, TXT, Markdown, CSV). */
export type DocumentTextStatus = 'pending' | 'indexed' | 'none' | 'failed';

/**
 * A research file (report, model, filing) in the Document Library.
 * Metadata lives here; the file itself is an Attachment (ownerType 'document'),
 * so listing the library never loads the files.
 */
export interface ResearchDocument extends Timestamps {
  id: ID;
  journalId: ID;
  /** The phase the document is filed under; null when unfiled (e.g. after its phase was deleted). */
  phaseId: ID | null;
  attachmentId: ID;
  title: string;
  description: string;
  tags: string[];
  kind: DocumentKind;
  fileName: string;
  mimeType: string;
  size: number;
  /** Other phases the document is relevant to (never includes `phaseId`). */
  linkedPhaseIds: ID[];
  /** Connected knowledge items, from any phase. */
  cardIds: ID[];
  extractIds: ID[];
  snapshotIds: ID[];
  textStatus: DocumentTextStatus;
  pageCount?: number;
  /** Small preview (first PDF page or the image), when one could be made. */
  thumbnail?: Blob;
}

/** Searchable text of a document, kept apart so library queries stay light. */
export interface DocumentText {
  documentId: ID;
  text: string;
  /** True when only the first part of a very long document was kept. */
  truncated: boolean;
}

/**
 * Binary files (blobs) stored in IndexedDB. Snapshots use this for full-size
 * images and documents for their files.
 */
export type AttachmentOwnerType = 'phase' | 'card' | 'snapshot' | 'document';
export type AttachmentKind = 'image' | 'pdf' | 'document' | 'other';

export interface Attachment extends Timestamps {
  id: ID;
  ownerType: AttachmentOwnerType;
  ownerId: ID;
  /**
   * Owning phase, used to cascade phase deletes. Document files use '' because
   * documents outlive their phase (they become unfiled instead).
   */
  phaseId: ID;
  kind: AttachmentKind;
  fileName: string;
  mimeType: string;
  size: number;
  blob: Blob;
  caption?: string;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

export interface PhaseStats {
  tasks: number;
  done: number;
  cards: number;
  pinned: number;
  snapshots: number;
  extracts: number;
  /** Documents filed under or linked to the phase. */
  documents: number;
}
