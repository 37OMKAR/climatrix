// Read single pixels from remote GeoTIFFs / Cloud-Optimised GeoTIFFs with HTTP Range requests, in the browser.
// Supports classic TIFF and BigTIFF, striped or tiled layouts, no compression / Deflate / LZW, and
// TIFF predictors 2 (horizontal) and 3 (floating point). Only the bytes for the requested pixels are fetched.

export type TiffInfo = {
  url: string; le: boolean; big: boolean;
  width: number; height: number; bps: number; format: number; compression: number; predictor: number;
  rowsPerStrip: number; tileW: number; tileH: number;
  sx: number; sy: number; x0: number; y0: number; pixelIsPoint: boolean; nodata: number;
  offsetsTag?: TagRef; countsTag?: TagRef;
};
type TagRef = { type: number; count: number; offset: number; inline?: number[] };

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 16: 8, 17: 8, 18: 8 };

export async function rangeBytes(url: string, start: number, end: number, signal?: AbortSignal): Promise<Uint8Array> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { Range: `bytes=${start}-${end}` }, signal });
      if (r.status !== 206 && r.status !== 200) throw new Error(`HTTP ${r.status}`);
      const b = new Uint8Array(await r.arrayBuffer());
      if (r.status === 200) {
        if (b.length < end + 1) throw new Error('Server ignored the byte range');
        return b.subarray(start, end + 1);
      }
      return b;
    } catch (e) {
      last = e;
      if (signal?.aborted) break;
      await new Promise((res) => setTimeout(res, 600 * (attempt + 1)));
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

export async function inflate(data: Uint8Array, format: 'deflate' | 'deflate-raw' = 'deflate'): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** TIFF LZW (MSB-first codes, early change). */
export function lzwDecode(input: Uint8Array, outLen: number): Uint8Array {
  const out = new Uint8Array(outLen);
  let op = 0, bitPos = 0;
  const totalBits = input.length * 8;
  const prefix = new Int32Array(4096), suffix = new Uint8Array(4096), length = new Uint16Array(4096), first = new Uint8Array(4096);
  for (let i = 0; i < 256; i++) { prefix[i] = -1; suffix[i] = i; length[i] = 1; first[i] = i; }
  let size = 258, width = 9, prev = -1;
  const readCode = () => {
    if (bitPos + width > totalBits) return 257;
    let v = 0;
    for (let i = 0; i < width; i++) { v = (v << 1) | ((input[bitPos >> 3] >> (7 - (bitPos & 7))) & 1); bitPos++; }
    return v;
  };
  const emit = (code: number) => {
    const len = length[code];
    let c = code;
    for (let i = len - 1; i >= 0; i--) { if (op + i < outLen) out[op + i] = suffix[c]; c = prefix[c]; }
    op += len;
  };
  while (op < outLen) {
    const code = readCode();
    if (code === 257) break;
    if (code === 256) { size = 258; width = 9; prev = -1; continue; }
    if (prev === -1) { emit(code); prev = code; continue; }
    let firstChar: number;
    if (code < size) { emit(code); firstChar = first[code]; }
    else if (code === size) { firstChar = first[prev]; emit(prev); if (op < outLen) out[op] = firstChar; op++; }
    else break;
    if (size < 4096) { prefix[size] = prev; suffix[size] = firstChar; length[size] = length[prev] + 1; first[size] = first[prev]; size++; }
    prev = code;
    if (size + 1 >= 1 << width && width < 12) width++;
  }
  return out;
}

/** Undo TIFF predictors in place for one block (tile or strip) of `w` samples per row. */
export function unpredict(buf: Uint8Array, w: number, rows: number, bps: number, predictor: number, le: boolean): Uint8Array {
  const B = bps / 8, rowB = w * B;
  if (predictor === 2) {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    for (let y = 0; y < rows; y++) {
      const o = y * rowB;
      for (let x = 1; x < w; x++) {
        const p = o + x * B, q = p - B;
        if (B === 1) buf[p] = (buf[p] + buf[q]) & 255;
        else if (B === 2) dv.setUint16(p, (dv.getUint16(p, le) + dv.getUint16(q, le)) & 0xffff, le);
        else if (B === 4) dv.setUint32(p, (dv.getUint32(p, le) + dv.getUint32(q, le)) >>> 0, le);
      }
    }
    return buf;
  }
  if (predictor === 3) {
    const out = new Uint8Array(buf.length);
    for (let y = 0; y < rows; y++) {
      const o = y * rowB;
      for (let i = 1; i < rowB; i++) buf[o + i] = (buf[o + i] + buf[o + i - 1]) & 255;
      for (let j = 0; j < w; j++) for (let k = 0; k < B; k++) out[o + j * B + (le ? k : B - 1 - k)] = buf[o + (B - 1 - k) * w + j];
    }
    return out;
  }
  return buf;
}

function readValue(dv: DataView, o: number, type: number, le: boolean): number {
  switch (type) {
    case 1: case 2: case 6: case 7: return dv.getUint8(o);
    case 3: return dv.getUint16(o, le);
    case 8: return dv.getInt16(o, le);
    case 4: return dv.getUint32(o, le);
    case 9: return dv.getInt32(o, le);
    case 11: return dv.getFloat32(o, le);
    case 12: return dv.getFloat64(o, le);
    case 16: return Number(dv.getBigUint64(o, le));
    case 17: return Number(dv.getBigInt64(o, le));
    default: return dv.getUint32(o, le);
  }
}

const infoCache = new Map<string, Promise<TiffInfo>>();
export function tiffInfo(url: string, signal?: AbortSignal): Promise<TiffInfo> {
  let p = infoCache.get(url);
  if (!p) {
    p = parseTiff(url, signal);
    infoCache.set(url, p);
    p.catch(() => infoCache.delete(url));
  }
  return p;
}

async function parseTiff(url: string, signal?: AbortSignal): Promise<TiffInfo> {
  const head = await rangeBytes(url, 0, 15, signal);
  const hv = new DataView(head.buffer, head.byteOffset, head.byteLength);
  const bo = hv.getUint16(0, false);
  if (bo !== 0x4949 && bo !== 0x4d4d) throw new Error('Not a TIFF file');
  const le = bo === 0x4949;
  const big = hv.getUint16(2, le) === 43;
  const ifd = big ? Number(hv.getBigUint64(8, le)) : hv.getUint32(4, le);
  const blk = await rangeBytes(url, ifd, ifd + 65535, signal);
  const dv = new DataView(blk.buffer, blk.byteOffset, blk.byteLength);
  const n = big ? Number(dv.getBigUint64(0, le)) : dv.getUint16(0, le);
  const es = big ? 20 : 12, head0 = big ? 8 : 2;
  const tags = new Map<number, TagRef>();
  for (let i = 0; i < n; i++) {
    const e = head0 + i * es;
    const tag = dv.getUint16(e, le), type = dv.getUint16(e + 2, le);
    const count = big ? Number(dv.getBigUint64(e + 4, le)) : dv.getUint32(e + 4, le);
    const vo = e + (big ? 12 : 8);
    const bytes = count * (TYPE_SIZE[type] ?? 4);
    if (bytes <= (big ? 8 : 4)) {
      const vals: number[] = [];
      for (let k = 0; k < count; k++) vals.push(readValue(dv, vo + k * (TYPE_SIZE[type] ?? 4), type, le));
      tags.set(tag, { type, count, offset: -1, inline: vals });
    } else tags.set(tag, { type, count, offset: big ? Number(dv.getBigUint64(vo, le)) : dv.getUint32(vo, le) });
  }
  // small arrays that sit inside or just after the IFD block are read from it; others are fetched
  const values = async (tag: number, max = 64): Promise<number[] | null> => {
    const t = tags.get(tag);
    if (!t) return null;
    if (t.inline) return t.inline;
    const sz = TYPE_SIZE[t.type] ?? 4, m = Math.min(t.count, max);
    let src: DataView, base: number;
    if (t.offset >= ifd && t.offset + m * sz <= ifd + blk.length) { src = dv; base = t.offset - ifd; }
    else { const b = await rangeBytes(url, t.offset, t.offset + m * sz - 1, signal); src = new DataView(b.buffer, b.byteOffset, b.byteLength); base = 0; }
    if (t.type === 2) { let s = ''; for (let k = 0; k < m; k++) s += String.fromCharCode(src.getUint8(base + k)); return [parseFloat(s)]; }
    const out: number[] = [];
    for (let k = 0; k < m; k++) out.push(readValue(src, base + k * sz, t.type, le));
    return out;
  };
  const one = async (tag: number, dflt: number) => (await values(tag, 1))?.[0] ?? dflt;
  const scale = await values(33550, 3), tie = await values(33922, 6);
  if (!scale || !tie) throw new Error('GeoTIFF has no georeferencing tags');
  let pixelIsPoint = false;
  const gk = await values(34735, 256);
  if (gk) for (let i = 4; i + 3 < gk.length; i += 4) if (gk[i] === 1025) pixelIsPoint = gk[i + 3] === 2;
  const nodataRaw = await values(42113, 32);
  const tiled = tags.has(322);
  return {
    url, le, big,
    width: await one(256, 0), height: await one(257, 0), bps: await one(258, 8), format: await one(339, 1),
    compression: await one(259, 1), predictor: await one(317, 1), rowsPerStrip: await one(278, 0),
    tileW: tiled ? await one(322, 0) : 0, tileH: tiled ? await one(323, 0) : 0,
    sx: scale[0], sy: scale[1], x0: tie[3] - (pixelIsPoint ? scale[0] / 2 : 0), y0: tie[4] + (pixelIsPoint ? scale[1] / 2 : 0), pixelIsPoint,
    nodata: nodataRaw && Number.isFinite(nodataRaw[0]) ? nodataRaw[0] : NaN,
    offsetsTag: tags.get(tiled ? 324 : 273), countsTag: tags.get(tiled ? 325 : 279),
  };
}

async function arrayEntry(info: TiffInfo, t: TagRef | undefined, idx: number, signal?: AbortSignal): Promise<number> {
  if (!t) throw new Error('TIFF is missing strip/tile offsets');
  if (t.inline) return t.inline[idx];
  const sz = TYPE_SIZE[t.type] ?? 4;
  const b = await rangeBytes(info.url, t.offset + idx * sz, t.offset + idx * sz + sz - 1, signal);
  return readValue(new DataView(b.buffer, b.byteOffset, b.byteLength), 0, t.type, info.le);
}

export function pixelOf(info: TiffInfo, lon: number, lat: number): { r: number; c: number } | null {
  const c = Math.floor((lon - info.x0) / info.sx), r = Math.floor((info.y0 - lat) / info.sy);
  if (c < 0 || r < 0 || c >= info.width || r >= info.height) return null;
  return { r, c };
}

function sample(dv: DataView, o: number, info: TiffInfo): number {
  const B = info.bps / 8;
  if (info.format === 3) return B === 8 ? dv.getFloat64(o, info.le) : dv.getFloat32(o, info.le);
  if (info.format === 2) return B === 1 ? dv.getInt8(o) : B === 2 ? dv.getInt16(o, info.le) : dv.getInt32(o, info.le);
  return B === 1 ? dv.getUint8(o) : B === 2 ? dv.getUint16(o, info.le) : dv.getUint32(o, info.le);
}

// decoded tiles, keyed by url#index (small LRU)
const tileCache = new Map<string, Promise<DataView | null>>();
function cacheTile(key: string, p: Promise<DataView | null>) {
  tileCache.set(key, p);
  p.catch(() => tileCache.delete(key));
  if (tileCache.size > 48) tileCache.delete(tileCache.keys().next().value as string);
  return p;
}

async function decodeBlock(info: TiffInfo, raw: Uint8Array, w: number, rows: number): Promise<Uint8Array> {
  const len = w * rows * (info.bps / 8);
  let d: Uint8Array;
  if (info.compression === 1) d = raw.slice();
  else if (info.compression === 8 || info.compression === 32946) d = await inflate(raw, 'deflate');
  else if (info.compression === 5) d = lzwDecode(raw, len);
  else throw new Error(`Unsupported TIFF compression ${info.compression}`);
  return unpredict(d, w, rows, info.bps, info.predictor, info.le);
}

/** Value at a pixel; NaN when the pixel is nodata. Throws on network errors. */
export async function readPixelRC(info: TiffInfo, r: number, c: number, signal?: AbortSignal): Promise<number> {
  const B = info.bps / 8;
  let v: number;
  if (info.tileW) {
    const tpr = Math.ceil(info.width / info.tileW);
    const ti = Math.floor(r / info.tileH) * tpr + Math.floor(c / info.tileW);
    const key = `${info.url}#${ti}`;
    const dv = await (tileCache.get(key) ?? cacheTile(key, (async () => {
      const off = await arrayEntry(info, info.offsetsTag, ti, signal), cnt = await arrayEntry(info, info.countsTag, ti, signal);
      if (!cnt) return null; // sparse COG tile: nothing stored
      const raw = await rangeBytes(info.url, off, off + cnt - 1, signal);
      const d = await decodeBlock(info, raw, info.tileW, info.tileH);
      return new DataView(d.buffer, d.byteOffset, d.byteLength);
    })()));
    if (!dv) return NaN;
    v = sample(dv, ((r % info.tileH) * info.tileW + (c % info.tileW)) * B, info);
  } else {
    const rps = info.rowsPerStrip || info.height;
    const si = Math.floor(r / rps);
    if (info.compression === 1) {
      const off = await arrayEntry(info, info.offsetsTag, si, signal);
      const o = off + ((r % rps) * info.width + c) * B;
      const b = await rangeBytes(info.url, o, o + B - 1, signal);
      v = sample(new DataView(b.buffer, b.byteOffset, b.byteLength), 0, info);
    } else {
      const key = `${info.url}#s${si}`;
      const dv = await (tileCache.get(key) ?? cacheTile(key, (async () => {
        const off = await arrayEntry(info, info.offsetsTag, si, signal), cnt = await arrayEntry(info, info.countsTag, si, signal);
        const rows = Math.min(rps, info.height - si * rps);
        const d = await decodeBlock(info, await rangeBytes(info.url, off, off + cnt - 1, signal), info.width, rows);
        return new DataView(d.buffer, d.byteOffset, d.byteLength);
      })()));
      if (!dv) return NaN;
      v = sample(dv, ((r % rps) * info.width + c) * B, info);
    }
  }
  if (!Number.isFinite(v) || v === info.nodata || v <= -9998 || v < -3e38) return NaN;
  return v;
}

export async function readPixel(url: string, lon: number, lat: number, signal?: AbortSignal): Promise<{ value: number; inside: boolean }> {
  const info = await tiffInfo(url, signal);
  const p = pixelOf(info, lon, lat);
  if (!p) return { value: NaN, inside: false };
  return { value: await readPixelRC(info, p.r, p.c, signal), inside: true };
}

/** Values in a (2k+1)² window around the pixel (row-major), NaN for nodata or outside. */
export async function readWindow(url: string, lon: number, lat: number, k: number, signal?: AbortSignal): Promise<number[]> {
  const info = await tiffInfo(url, signal);
  const p = pixelOf(info, lon, lat);
  if (!p) return [];
  const out: number[] = [];
  for (let dr = -k; dr <= k; dr++) for (let dc = -k; dc <= k; dc++) {
    const r = p.r + dr, c = p.c + dc;
    out.push(r < 0 || c < 0 || r >= info.height || c >= info.width ? NaN : await readPixelRC(info, r, c, signal));
  }
  return out;
}

export const _testRaster = { tileCache, infoCache };
