/** Image intake: validation, dimensions and thumbnail generation. */

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const ACCEPT_ATTRIBUTE = '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp';
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

const THUMB_MAX = 720;

const EXTENSION_TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

/** Some sources (drag from other apps) give an empty MIME type; fall back to the extension. */
export function imageType(file: File | Blob): string | null {
  if ((ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) return file.type;
  const name = 'name' in file ? file.name : '';
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_TYPES[ext] ?? null;
}

export interface PreparedImage {
  blob: Blob;
  thumbnail: Blob;
  mimeType: string;
  width: number;
  height: number;
}

export class ImageError extends Error {}

export async function prepareImage(file: File | Blob): Promise<PreparedImage> {
  const mimeType = imageType(file);
  if (!mimeType) throw new ImageError('Only PNG, JPG and WebP images are supported.');
  if (file.size > MAX_IMAGE_BYTES) throw new ImageError('Images must be 25 MB or smaller.');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageError('This image could not be read. It may be damaged.');
  }

  const { width, height } = bitmap;
  const scale = Math.min(1, THUMB_MAX / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // WebP keeps transparency and is small; JPEG is the fallback where WebP encoding is unavailable.
  let thumbnail = await toBlob(canvas, 'image/webp', 0.85);
  if (!thumbnail || thumbnail.type !== 'image/webp') thumbnail = await toBlob(canvas, 'image/jpeg', 0.85);
  if (!thumbnail) throw new ImageError('Could not create a preview for this image.');

  // Re-wrap so the stored blob always carries a correct MIME type.
  const blob = file.type === mimeType ? file : new Blob([file], { type: mimeType });
  return { blob, thumbnail, mimeType, width, height };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/** A readable default title: "Revenue bridge" from "revenue-bridge.png", or a timestamp for pasted images. */
export function defaultImageTitle(file: File | Blob, pasted: boolean): string {
  const name = 'name' in file ? file.name : '';
  if (!pasted && name && !/^image\.(png|jpe?g|webp)$/i.test(name)) {
    const base = name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
    if (base) return base.charAt(0).toUpperCase() + base.slice(1);
  }
  const now = new Date();
  return `Screenshot · ${now.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}

export const formatBytes = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : bytes < 1024 ** 3
      ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      : `${(bytes / 1024 ** 3).toFixed(1)} GB`;
