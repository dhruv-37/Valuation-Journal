import { db } from '../db/database';
import { saveDocumentDigest, type DocumentDigest } from '../db/repository';
import type { ID, ResearchDocument } from '../types';
import { DOCUMENT_KIND_META, MAX_INDEXED_CHARS } from './documents';

/**
 * Background work after a document is saved: reading its text for search and
 * making a thumbnail. Runs one document at a time so a large PDF never competes
 * with another for memory. Documents left 'pending' (the tab was closed mid-way)
 * are picked up again by `resumePendingDocuments` on the next launch.
 */

const queued = new Set<ID>();
let chain: Promise<void> = Promise.resolve();

export function queueDocumentProcessing(id: ID) {
  if (queued.has(id)) return;
  queued.add(id);
  chain = chain.then(() => processDocument(id)).finally(() => queued.delete(id));
}

export async function resumePendingDocuments() {
  const pending = (await db.documents.where('textStatus').equals('pending').primaryKeys()) as ID[];
  pending.forEach(queueDocumentProcessing);
}

async function processDocument(id: ID) {
  const document = await db.documents.get(id);
  if (!document || document.textStatus !== 'pending') return;
  const attachment = await db.attachments.get(document.attachmentId);
  if (!attachment) {
    await saveDocumentDigest(id, { status: 'failed' });
    return;
  }
  let digest: DocumentDigest;
  try {
    digest = await buildDigest(document, attachment.blob);
  } catch {
    digest = { status: 'failed' };
  }
  await saveDocumentDigest(id, digest);
}

async function buildDigest(doc: ResearchDocument, blob: Blob): Promise<DocumentDigest> {
  const preview = DOCUMENT_KIND_META[doc.kind].preview;
  if (preview === 'pdf') {
    const { digestPdf } = await import('./pdf');
    const result = await digestPdf(blob, MAX_INDEXED_CHARS);
    return { status: result.text.trim() ? 'indexed' : 'none', ...result };
  }
  if (preview === 'image') {
    return { status: 'none', thumbnail: await imageThumbnail(blob) };
  }
  if (preview === 'text' || preview === 'markdown' || preview === 'csv') {
    // Read a little more than the cap: multi-byte characters take several bytes.
    const text = (await blob.slice(0, MAX_INDEXED_CHARS * 2).text()).slice(0, MAX_INDEXED_CHARS);
    return { status: text.trim() ? 'indexed' : 'none', text, truncated: blob.size > MAX_INDEXED_CHARS * 2 || text.length >= MAX_INDEXED_CHARS };
  }
  return { status: 'none' };
}

const THUMB_MAX = 360;

async function imageThumbnail(blob: Blob): Promise<Blob | null> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, THUMB_MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
}
