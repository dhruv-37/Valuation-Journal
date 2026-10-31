import { createContext, useContext } from 'react';
import type { ID, KnowledgeExtract, Snapshot } from '../../types';
import type { ExtractInput } from '../../db/repository';

/**
 * Library actions available anywhere inside a phase workspace (gallery,
 * knowledge cards, viewer), so capture and viewing need no prop drilling.
 */
export interface LibraryActions {
  openViewer: (list: Snapshot[], snapshotId: ID) => void;
  editSnapshot: (snapshot: Snapshot) => void;
  /** Saves images immediately; returns the number saved. */
  addImages: (files: (File | Blob)[], options?: { cardId?: ID; pasted?: boolean }) => Promise<number>;
  /** Opens the file picker. */
  pickImages: (options?: { cardId?: ID }) => void;
  /** Reads an image from the clipboard (asks for permission in some browsers). */
  pasteFromClipboard: () => Promise<void>;
  newExtract: (prefill?: Partial<ExtractInput>) => void;
  editExtract: (extract: KnowledgeExtract) => void;
}

export const LibraryContext = createContext<LibraryActions | null>(null);

export function useLibrary() {
  const actions = useContext(LibraryContext);
  if (!actions) throw new Error('useLibrary must be used inside a phase workspace');
  return actions;
}
