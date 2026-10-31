import { createContext, useContext } from 'react';
import type { ID, ResearchDocument } from '../../types';
import type { DocumentLinkKind, DocumentTarget } from '../../db/repository';

/** An item whose connected documents are being chosen. */
export interface LinkTarget {
  kind: DocumentLinkKind;
  id: ID;
  /** Shown in the dialog title, e.g. the card's title. */
  label: string;
  /** Phase new uploads are filed under. */
  phaseId: ID | null;
}

/**
 * Document actions available anywhere in the app (overview, Document Library,
 * phase workspaces, viewers), so documents can be opened and linked without
 * prop drilling. Provided by DocumentsProvider.
 */
export interface DocumentActions {
  /** Opens the viewer; `query` pre-fills the search inside a PDF. */
  open: (id: ID, options?: { query?: string }) => void;
  /** Saves files immediately and returns the saved documents. */
  upload: (files: File[], target: DocumentTarget) => Promise<ResearchDocument[]>;
  /** Opens the file picker, then uploads to `target`. */
  pick: (target: DocumentTarget) => void;
  edit: (id: ID) => void;
  /** Asks for confirmation; resolves true if the document was deleted. */
  remove: (document: ResearchDocument) => Promise<boolean>;
  download: (document: ResearchDocument) => Promise<void>;
  /** Opens the dialog to choose documents connected to an item or phase. */
  linkTo: (target: LinkTarget) => void;
}

export const DocumentsContext = createContext<DocumentActions | null>(null);

export function useDocumentActions() {
  const actions = useContext(DocumentsContext);
  if (!actions) throw new Error('useDocumentActions must be used inside DocumentsProvider');
  return actions;
}
