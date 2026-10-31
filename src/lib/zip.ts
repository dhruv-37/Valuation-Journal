/**
 * A small ZIP writer and reader for backups, with no dependencies.
 *
 * Why not a library: backups hold PDFs and images of up to 200 MB each. This
 * writer assembles the archive as a Blob of parts, so stored files are never
 * copied into JavaScript memory, and the reader returns entries as slices of
 * the original File. JSON is deflated with the browser's CompressionStream;
 * files (already compressed formats) are stored as they are.
 *
 * Limits: no ZIP64, so the archive must stay under 4 GB and 65,535 entries;
 * no encryption. Archives re-zipped by other tools still read as long as they
 * use "stored" or "deflate" entries.
 */

export class ZipError extends Error {}

const MAX_32 = 0xffffffff;

/* ---------------------------------- CRC-32 ---------------------------------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crcUpdate(crc: number, bytes: Uint8Array) {
  let c = crc;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return c;
}

/** CRC-32 of a Blob, read in chunks so large files never sit in memory at once. */
export async function crc32OfBlob(blob: Blob): Promise<number> {
  let crc = 0xffffffff;
  const reader = blob.stream().getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    crc = crcUpdate(crc, value);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const crc32OfBytes = (bytes: Uint8Array) => (crcUpdate(0xffffffff, bytes) ^ 0xffffffff) >>> 0;

/* ---------------------------------- Writer ---------------------------------- */

export interface ZipInput {
  /** Path inside the archive, with forward slashes. */
  name: string;
  data: Blob | string;
}

const canDeflate = () => typeof CompressionStream !== 'undefined';

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function dosDateTime(date: Date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

/**
 * Builds a ZIP archive. Strings are UTF-8 encoded and deflated; Blobs are
 * stored. `onProgress` reports each entry as it is checksummed.
 */
export async function createZip(entries: ZipInput[], onProgress?: (done: number, total: number) => void): Promise<Blob> {
  if (entries.length > 0xffff) throw new ZipError('Too many files for one backup. Export fewer journals at a time.');
  const encoder = new TextEncoder();
  const { time, day } = dosDateTime(new Date());
  const parts: BlobPart[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const name = encoder.encode(entry.name);
    let body: Blob | Uint8Array;
    let crc: number;
    let size: number;
    let method = 0;
    if (typeof entry.data === 'string') {
      const raw = encoder.encode(entry.data);
      crc = crc32OfBytes(raw);
      size = raw.length;
      if (canDeflate() && raw.length > 256) {
        body = await deflate(raw);
        method = 8;
      } else body = raw;
    } else {
      crc = await crc32OfBlob(entry.data);
      size = entry.data.size;
      body = entry.data;
    }
    const compressed = body instanceof Blob ? body.size : body.length;
    if (size > MAX_32 || compressed > MAX_32 || offset > MAX_32) {
      throw new ZipError('The backup would be larger than 4 GB. Export fewer journals at a time.');
    }

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, method, true);
    local.setUint16(10, time, true);
    local.setUint16(12, day, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, compressed, true);
    local.setUint32(22, size, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    parts.push(local.buffer, name as BlobPart, body as BlobPart);

    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true); // version made by
    dir.setUint16(6, 20, true);
    dir.setUint16(8, 0x0800, true);
    dir.setUint16(10, method, true);
    dir.setUint16(12, time, true);
    dir.setUint16(14, day, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, compressed, true);
    dir.setUint32(24, size, true);
    dir.setUint16(28, name.length, true);
    dir.setUint32(42, offset, true);
    const record = new Uint8Array(46 + name.length);
    record.set(new Uint8Array(dir.buffer), 0);
    record.set(name, 46);
    central.push(record);

    offset += 30 + name.length + compressed;
    onProgress?.(i + 1, entries.length);
  }

  const centralSize = central.reduce((n, r) => n + r.length, 0);
  if (offset + centralSize > MAX_32) throw new ZipError('The backup would be larger than 4 GB. Export fewer journals at a time.');
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...(central as BlobPart[]), end.buffer], { type: 'application/zip' });
}

/* ---------------------------------- Reader ---------------------------------- */

export interface ZipEntry {
  name: string;
  method: number;
  crc: number;
  compressedSize: number;
  size: number;
  localOffset: number;
}

const bytesOf = async (blob: Blob) => new DataView(await blob.arrayBuffer());

/** Reads the archive's table of contents (only the end of the file is read). */
export async function readZipDirectory(file: Blob): Promise<Map<string, ZipEntry>> {
  if (file.size < 22) throw new ZipError('This file is not a ZIP archive.');
  const tailStart = Math.max(0, file.size - 22 - 0xffff);
  const tail = await bytesOf(file.slice(tailStart));
  let endAt = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === 0x06054b50) {
      endAt = i;
      break;
    }
  }
  if (endAt < 0) throw new ZipError('This file is not a ZIP archive, or it is incomplete.');
  const count = tail.getUint16(endAt + 10, true);
  const dirSize = tail.getUint32(endAt + 12, true);
  const dirOffset = tail.getUint32(endAt + 16, true);
  if (dirOffset === MAX_32 || count === 0xffff) throw new ZipError('This archive uses ZIP64, which is not supported.');
  if (dirOffset + dirSize > file.size) throw new ZipError('The archive is damaged (its table of contents is cut off).');

  const dir = await bytesOf(file.slice(dirOffset, dirOffset + dirSize));
  const decoder = new TextDecoder();
  const entries = new Map<string, ZipEntry>();
  let p = 0;
  for (let i = 0; i < count; i++) {
    if (p + 46 > dir.byteLength || dir.getUint32(p, true) !== 0x02014b50) throw new ZipError('The archive is damaged (bad table of contents).');
    const flags = dir.getUint16(p + 8, true);
    const nameLength = dir.getUint16(p + 28, true);
    const extraLength = dir.getUint16(p + 30, true);
    const commentLength = dir.getUint16(p + 32, true);
    const name = decoder.decode(new Uint8Array(dir.buffer, dir.byteOffset + p + 46, nameLength));
    if (flags & 1) throw new ZipError('Encrypted archives are not supported.');
    entries.set(name, {
      name,
      method: dir.getUint16(p + 10, true),
      crc: dir.getUint32(p + 16, true),
      compressedSize: dir.getUint32(p + 20, true),
      size: dir.getUint32(p + 24, true),
      localOffset: dir.getUint32(p + 42, true),
    });
    p += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/**
 * Returns an entry's content. Stored entries are slices of the archive (no
 * copy); deflated ones are decompressed. With `verify`, the size and CRC-32 are
 * checked so a damaged archive is caught before anything is imported.
 */
export async function readZipEntry(file: Blob, entry: ZipEntry, options: { type?: string; verify?: boolean } = {}): Promise<Blob> {
  const header = await bytesOf(file.slice(entry.localOffset, entry.localOffset + 30));
  if (header.byteLength < 30 || header.getUint32(0, true) !== 0x04034b50) throw new ZipError(`The archive is damaged (${entry.name}).`);
  const start = entry.localOffset + 30 + header.getUint16(26, true) + header.getUint16(28, true);
  if (start + entry.compressedSize > file.size) throw new ZipError(`The archive is cut off (${entry.name}).`);
  const raw = file.slice(start, start + entry.compressedSize);

  let blob: Blob;
  if (entry.method === 0) blob = new Blob([raw], { type: options.type ?? '' });
  else if (entry.method === 8) {
    if (typeof DecompressionStream === 'undefined') throw new ZipError('This browser cannot read compressed archives.');
    try {
      const stream = raw.stream().pipeThrough(new DecompressionStream('deflate-raw'));
      blob = new Blob([await new Response(stream).arrayBuffer()], { type: options.type ?? '' });
    } catch {
      throw new ZipError(`The archive is damaged (${entry.name} cannot be decompressed).`);
    }
  } else throw new ZipError(`${entry.name} uses an unsupported compression method.`);

  if (options.verify) {
    if (blob.size !== entry.size || (await crc32OfBlob(blob)) !== entry.crc) throw new ZipError(`The archive is damaged (${entry.name} failed its checksum).`);
  }
  return blob;
}

export async function readZipText(file: Blob, entry: ZipEntry): Promise<string> {
  return (await readZipEntry(file, entry, { verify: true })).text();
}
