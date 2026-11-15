// High-resolution open hazard datasets read live from their publishers' storage, pixel by pixel.
// Nothing is approximated: if a dataset cannot be reached the hazard is reported as an error.
import { readPixel, readWindow, rangeBytes, inflate, lzwDecode, unpredict } from './raster';
import { idbGet, idbSet } from './idb';

export const DATASETS = {
  jrc: { name: 'JRC / Copernicus CEMS-GloFAS global river flood hazard maps v2.1.2, 90 m, RP10–500', url: 'https://data.jrc.ec.europa.eu/collection/id-0054', licence: 'Free reuse with attribution (EU)' },
  deltares: { name: 'Deltares Global Flood Maps (coastal), 90 m NASADEM, 2018 and 2050 sea level', url: 'https://planetarycomputer.microsoft.com/dataset/deltares-floods', licence: 'CDLA-Permissive-1.0' },
  storm: { name: 'STORM tropical-cyclone wind return periods, 10 km, present + 4 HighResMIP GCMs (Bloemendaal et al.)', url: 'https://doi.org/10.5281/zenodo.10931452', licence: 'Public domain (CC PDDC)' },
  subsidence: { name: 'Global land-subsidence rate map, ~1 km (Davydzenka, Tahmasebi & Shokri 2024)', url: 'https://doi.org/10.5281/zenodo.10223637', licence: 'CC BY 4.0' },
  wtd: { name: 'Global mean water-table depth, ~10 km (Bierkens et al.)', url: 'https://doi.org/10.5281/zenodo.7538161', licence: 'CC BY 4.0' },
  ilsm: { name: 'India Landslide Susceptibility Map (ILSM), 100 m probability (IIT Bombay, 2023)', url: 'https://doi.org/10.5281/zenodo.10085272', licence: 'CC BY 4.0' },
  wglc: { name: 'WWLLN Global Lightning Climatology (WGLC), 0.5°, monthly climatology', url: 'https://doi.org/10.5281/zenodo.20277101', licence: 'CC BY 4.0' },
  aqueduct: { name: 'WRI Aqueduct 4.0 water-risk indicators (basin baseline, province 2030/50/80 futures)', url: 'https://www.wri.org/aqueduct', licence: 'CC BY 4.0' },
  climatetrace: { name: 'Climate TRACE asset-level emissions (v7 API)', url: 'https://climatetrace.org/', licence: 'CC BY 4.0' },
} as const;
export type DatasetId = keyof typeof DATASETS;

// ------------------------------------------------------------------ JRC river flood (COG tiles on source.coop)
const JRC_BASE = 'https://data.source.coop/nlebovits/jrc-glofas';
const JRC_TILES = ('ID100_N80_W20 ID101_N70_W20 ID102_N60_W20 ID103_N30_W20 ID104_N20_W20 ID105_N10_W20 ID106_N60_W10 ID107_N50_W10 ID108_N40_W10 ID109_N30_W10 ID10_N60_W150 ID110_N20_W10 ID111_N10_W10 ID112_N70_W0 ID113_N60_W0 ID114_N50_W0 ID115_N40_W0 ID116_N30_W0 ID117_N20_W0 ID118_N10_W0 ID119_N0_W0 ID11_N80_W140 ID120_N70_E10 ID121_N60_E10 ID122_N50_E10 ID123_N40_E10 ID124_N30_E10 ID125_N20_E10 ID126_N10_E10 ID127_N0_E10 ID128_S10_E10 ID129_S20_E10 ID12_N70_W140 ID130_S30_E10 ID131_N80_E20 ID132_N70_E20 ID133_N60_E20 ID134_N50_E20 ID135_N40_E20 ID136_N30_E20 ID137_N20_E20 ID138_N10_E20 ID139_N0_E20 ID13_N60_W140 ID140_S10_E20 ID141_S20_E20 ID142_S30_E20 ID143_N80_E30 ID144_N70_E30 ID145_N60_E30 ID146_N50_E30 ID147_N40_E30 ID148_N30_E30 ID149_N20_E30 ID14_N80_W130 ID150_N10_E30 ID151_N0_E30 ID152_S10_E30 ID153_S20_E30 ID154_S30_E30 ID155_N70_E40 ID156_N60_E40 ID157_N50_E40 ID158_N40_E40 ID159_N30_E40 ID15_N70_W130 ID160_N20_E40 ID161_N10_E40 ID162_N0_E40 ID163_S10_E40 ID164_S20_E40 ID165_N70_E50 ID166_N60_E50 ID167_N50_E50 ID168_N40_E50 ID169_N30_E50 ID16_N60_W130 ID170_N20_E50 ID171_N10_E50 ID172_S10_E50 ID173_N80_E60 ID174_N70_E60 ID175_N60_E60 ID176_N50_E60 ID177_N40_E60 ID178_N30_E60 ID179_N80_E70 ID17_N50_W130 ID180_N70_E70 ID181_N60_E70 ID182_N50_E70 ID183_N40_E70 ID184_N30_E70 ID185_N20_E70 ID186_N10_E70 ID187_N80_E80 ID188_N70_E80 ID189_N60_E80 ID18_N40_W130 ID190_N50_E80 ID191_N40_E80 ID192_N30_E80 ID193_N20_E80 ID194_N10_E80 ID195_N80_E90 ID196_N70_E90 ID197_N60_E90 ID198_N50_E90 ID199_N40_E90 ID19_N80_W120 ID1_N70_W180 ID200_N30_E90 ID201_N20_E90 ID202_N10_E90 ID203_N0_E90 ID204_N80_E100 ID205_N70_E100 ID206_N60_E100 ID207_N50_E100 ID208_N40_E100 ID209_N30_E100 ID20_N70_W120 ID210_N20_E100 ID211_N10_E100 ID212_N0_E100 ID213_N80_E110 ID214_N70_E110 ID215_N60_E110 ID216_N50_E110 ID217_N40_E110 ID218_N30_E110 ID219_N20_E110 ID21_N60_W120 ID220_N10_E110 ID221_N0_E110 ID222_S10_E110 ID223_S20_E110 ID224_S30_E110 ID225_N80_E120 ID226_N70_E120 ID227_N60_E120 ID228_N50_E120 ID229_N40_E120 ID22_N50_W120 ID230_N30_E120 ID231_N20_E120 ID232_N10_E120 ID233_N0_E120 ID234_S10_E120 ID235_S20_E120 ID236_S30_E120 ID237_N80_E130 ID238_N70_E130 ID239_N60_E130 ID23_N40_W120 ID240_N50_E130 ID241_N40_E130 ID242_N0_E130 ID243_S10_E130 ID244_S20_E130 ID245_S30_E130 ID246_N80_E140 ID247_N70_E140 ID248_N60_E140 ID249_N50_E140 ID24_N30_W120 ID250_N40_E140 ID251_N0_E140 ID252_S10_E140 ID253_S20_E140 ID254_S30_E140 ID255_S40_E140 ID256_N80_E150 ID257_N70_E150 ID258_N60_E150 ID259_N0_E150 ID25_N80_W110 ID260_S10_E150 ID261_S20_E150 ID262_S30_E150 ID263_N80_E160 ID264_N70_E160 ID265_N60_E160 ID266_S40_E160 ID267_N80_E170 ID268_N70_E170 ID269_N60_E170 ID26_N70_W110 ID270_S30_E170 ID271_S40_E170 ID27_N60_W110 ID28_N50_W110 ID29_N40_W110 ID2_N80_W170 ID30_N30_W110 ID31_N20_W110 ID32_N90_W100 ID33_N80_W100 ID34_N70_W100 ID35_N60_W100 ID36_N50_W100 ID37_N40_W100 ID38_N30_W100 ID39_N20_W100 ID3_N70_W170 ID40_N90_W90 ID41_N80_W90 ID42_N70_W90 ID43_N60_W90 ID44_N50_W90 ID45_N40_W90 ID46_N30_W90 ID47_N20_W90 ID48_N10_W90 ID49_N0_W90 ID4_N60_W170 ID50_N90_W80 ID51_N80_W80 ID52_N70_W80 ID53_N60_W80 ID54_N50_W80 ID55_N40_W80 ID56_N30_W80 ID57_N20_W80 ID58_N10_W80 ID59_N0_W80 ID5_N80_W160 ID60_S10_W80 ID61_S20_W80 ID62_S30_W80 ID63_S40_W80 ID64_S50_W80 ID65_N90_W70 ID66_N80_W70 ID67_N70_W70 ID68_N60_W70 ID69_N50_W70 ID6_N70_W160 ID70_N20_W70 ID71_N10_W70 ID72_N0_W70 ID73_S10_W70 ID74_S20_W70 ID75_S30_W70 ID76_S40_W70 ID77_S50_W70 ID78_N80_W60 ID79_N70_W60 ID7_N60_W160 ID80_N60_W60 ID81_N50_W60 ID82_N10_W60 ID83_N0_W60 ID84_S10_W60 ID85_S20_W60 ID86_S30_W60 ID87_N80_W50 ID88_N70_W50 ID89_N60_W50 ID8_N80_W150 ID90_N10_W50 ID91_N0_W50 ID92_S10_W50 ID93_S20_W50 ID94_N80_W40 ID95_N70_W40 ID96_N0_W40 ID97_S10_W40 ID98_N80_W30 ID99_N70_W30 ID9_N70_W150').split(' ');
export const JRC_RPS = [10, 20, 50, 75, 100, 200, 500] as const;

/** Tile id for a point: tiles are 10° squares named by their top-left corner (N30_E80 covers 20–30 N, 80–90 E). */
export function jrcTileFor(lat: number, lon: number): string | null {
  const top = Math.floor(lat / 10) * 10 + 10, left = Math.floor(lon / 10) * 10;
  const suffix = `_${top >= 0 ? 'N' : 'S'}${Math.abs(top)}_${left < 0 ? 'W' : left === 0 ? 'W' : 'E'}${Math.abs(left)}`;
  return JRC_TILES.find((t) => t.endsWith(suffix)) ?? null;
}
export const jrcUrl = (tile: string, rp: number) => `${JRC_BASE}/depth-rp${rp}/${tile}/${tile}_RP${rp}_depth.tif`;

export type JrcResult = { covered: boolean; tile: string | null; depth: Record<number, number>; nearMax100: number };
export async function fetchJrcRiver(lat: number, lon: number, signal?: AbortSignal): Promise<JrcResult> {
  const tile = jrcTileFor(lat, lon);
  const depth: Record<number, number> = {};
  if (!tile) { for (const rp of JRC_RPS) depth[rp] = 0; return { covered: false, tile, depth, nearMax100: 0 }; }
  // outside the mapped flood extent the maps hold nodata: that is "no flooding", i.e. 0 m
  const vals = await Promise.all(JRC_RPS.map((rp) => readPixel(jrcUrl(tile, rp), lon, lat, signal)));
  JRC_RPS.forEach((rp, i) => { const v = vals[i].value; depth[rp] = Number.isFinite(v) ? Math.max(0, v) : 0; });
  for (let i = 1; i < JRC_RPS.length; i++) depth[JRC_RPS[i]] = Math.max(depth[JRC_RPS[i]], depth[JRC_RPS[i - 1]]);
  const win = await readWindow(jrcUrl(tile, 100), lon, lat, 1, signal);
  const nearMax100 = Math.max(0, ...win.filter(Number.isFinite));
  return { covered: true, tile, depth, nearMax100 };
}

// ------------------------------------------------------------------ Deltares coastal flood (Kerchunk/Zarr chunks on Azure)
const DELTARES_REF = 'https://deltaresfloodssa.blob.core.windows.net/floods/references/';
const NX = 720, NY = 360, CH = 600, RES = 1200; // 600×600 chunks of a 1/1200° global grid, latitude ascending from −90
let sas: { token: string; until: number } | null = null;
async function sasToken(signal?: AbortSignal) {
  if (sas && Date.now() < sas.until) return sas.token;
  const r = await fetch('https://planetarycomputer.microsoft.com/api/sas/v1/token/deltaresfloodssa/floods', { signal });
  if (!r.ok) throw new Error(`Planetary Computer token HTTP ${r.status}`);
  const j = (await r.json()) as { token: string; 'msft:expiry': string };
  sas = { token: j.token, until: Date.parse(j['msft:expiry']) - 5 * 60e3 };
  return sas.token;
}
export type DeltaresItem = '2018-0010' | '2018-0100' | '2018-0250' | '2050-0010' | '2050-0100' | '2050-0250';
type ChunkIndex = { url: string; off: Float64Array; len: Uint32Array };
const indexMem = new Map<string, Promise<ChunkIndex>>();
function deltaresIndex(item: DeltaresItem, signal?: AbortSignal): Promise<ChunkIndex> {
  let p = indexMem.get(item);
  if (p) return p;
  p = (async () => {
    const key = `deltares:v1:${item}`;
    const cached = await idbGet<ChunkIndex>(key);
    if (cached?.off?.length === NX * NY) return cached;
    const tok = await sasToken(signal);
    const r = await fetch(`${DELTARES_REF}NASADEM-90m-${item}.json?${tok}`, { signal });
    if (!r.ok) throw new Error(`Deltares index HTTP ${r.status}`);
    const j = (await r.json()) as { refs: Record<string, unknown>; templates: { u: string } };
    const off = new Float64Array(NX * NY), len = new Uint32Array(NX * NY);
    for (const [k, v] of Object.entries(j.refs)) {
      if (!k.startsWith('inun/0.') || !Array.isArray(v)) continue;
      const [, i, jj] = k.slice(5).split('.').map(Number);
      off[i * NX + jj] = v[1] as number; len[i * NX + jj] = v[2] as number;
    }
    const url = j.templates.u.replace(/^abfs:\/\/floods@deltaresfloodssa\.blob\.core\.windows\.net\//, 'https://deltaresfloodssa.blob.core.windows.net/floods/');
    const idx = { url, off, len };
    await idbSet(key, idx);
    return idx;
  })();
  indexMem.set(item, p);
  p.catch(() => indexMem.delete(item));
  return p;
}
const chunkMem = new Map<string, Promise<Float32Array | null>>();
/** Inundation depth (m) at a point for one Deltares map; NaN over the sea / masked cells. */
export async function deltaresDepth(item: DeltaresItem, lat: number, lon: number, signal?: AbortSignal): Promise<number> {
  const idx = await deltaresIndex(item, signal);
  const r = Math.min(NY * CH - 1, Math.max(0, Math.round((lat + 90) * RES))), c = Math.min(NX * CH - 1, Math.max(0, Math.round((lon + 180) * RES)));
  const ci = Math.floor(r / CH), cj = Math.floor(c / CH), k = ci * NX + cj;
  if (!idx.len[k]) return NaN; // chunk not stored: fill value everywhere
  const key = `${item}:${k}`;
  let p = chunkMem.get(key);
  if (!p) {
    p = (async () => {
      const tok = await sasToken(signal);
      const raw = await rangeBytes(`${idx.url}?${tok}`, idx.off[k], idx.off[k] + idx.len[k] - 1, signal);
      const dec = await inflate(raw, 'deflate');
      const n = dec.length / 4, un = new Uint8Array(dec.length);
      for (let b = 0; b < 4; b++) for (let i = 0; i < n; i++) un[i * 4 + b] = dec[b * n + i]; // numcodecs shuffle, element size 4
      return new Float32Array(un.buffer);
    })();
    chunkMem.set(key, p);
    p.catch(() => chunkMem.delete(key));
    if (chunkMem.size > 24) chunkMem.delete(chunkMem.keys().next().value as string);
  }
  const f = await p;
  if (!f) return NaN;
  const v = f[(r % CH) * CH + (c % CH)];
  return v <= -9998 || !Number.isFinite(v) ? NaN : v;
}
export type DeltaresResult = { d2018: Record<number, number>; d2050: Record<number, number>; sea: boolean };
export async function fetchDeltares(lat: number, lon: number, signal?: AbortSignal): Promise<DeltaresResult> {
  const items: DeltaresItem[] = ['2018-0010', '2018-0100', '2050-0100'];
  const v: number[] = [];
  for (const it of items) v.push(await deltaresDepth(it, lat, lon, signal)); // sequential: each index is ~26 MB on first use
  const sea = v.every((x) => Number.isNaN(x));
  const z = (x: number) => (Number.isFinite(x) ? Math.max(0, x) : 0);
  return { d2018: { 10: z(v[0]), 100: Math.max(z(v[0]), z(v[1])) }, d2050: { 100: z(v[2]) }, sea };
}

// ------------------------------------------------------------------ STORM cyclone wind maps (GeoTIFFs inside a Zenodo zip)
const STORM_ZIP = 'https://zenodo.org/api/records/10931452/files/STORM_FIXED_RETURN_PERIODS.zip/content';
// [deflated size, local-header offset] for the entries used, from the zip's central directory
const STORM_ENTRIES: Record<string, [number, number]> = {
  constant_10: [3290822, 459887533], constant_50: [6265502, 479090490], constant_100: [7057855, 512353247], constant_1000: [8569290, 584941669],
  'CMCC-CM2-VHR4_100': [7514605, 57437673], 'CNRM-CM6-1-HR_100': [7553640, 287382227], 'EC-Earth3P-HR_100': [7640417, 737573889], 'HadGEM3-GC31-HM_100': [7649052, 969917935],
};
export const STORM_GCMS = ['CMCC-CM2-VHR4', 'CNRM-CM6-1-HR', 'EC-Earth3P-HR', 'HadGEM3-GC31-HM'] as const;
type StormHeader = { W: number; H: number; tw: number; th: number; x0: number; y0: number; sx: number; sy: number; pred: number; to: number[]; tb: number[] };
const stormLock = new Map<string, Promise<void>>();
const stormHeaders = new Map<string, StormHeader>();
const tileKey = (file: string, ti: number) => `storm:v1:${file}:${ti}`;

async function stormHeader(file: string): Promise<StormHeader | undefined> {
  return stormHeaders.get(file) ?? (await idbGet<StormHeader>(`storm:v1:${file}:hdr`));
}
/** Stream one deflated GeoTIFF out of the zip and cache every tile up to the furthest one needed. */
async function streamStorm(file: string, need: Set<number>, onBytes?: (mb: number) => void, signal?: AbortSignal) {
  const [cs, off] = STORM_ENTRIES[file];
  const lh = await rangeBytes(STORM_ZIP, off, off + 29, signal);
  const lv = new DataView(lh.buffer, lh.byteOffset, 30);
  const ds = off + 30 + lv.getUint16(26, true) + lv.getUint16(28, true);
  const resp = await fetch(STORM_ZIP, { headers: { Range: `bytes=${ds}-${ds + cs - 1}` }, signal });
  if (!resp.ok || !resp.body) throw new Error(`STORM HTTP ${resp.status}`);
  const rd = resp.body.pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  let buf = new Uint8Array(1 << 22), total = 0;
  const pull = async (n: number) => {
    while (total < n) {
      const { value, done } = await rd.read();
      if (done) break;
      if (total + value.length > buf.length) { const b = new Uint8Array(Math.max(buf.length * 2, total + value.length)); b.set(buf.subarray(0, total)); buf = b; }
      buf.set(value, total); total += value.length; onBytes?.(total / 1e6);
    }
  };
  try {
    await pull(8192);
    const dv = new DataView(buf.buffer.slice(0, Math.min(total, 65536)));
    const ifd = dv.getUint32(4, true), n = dv.getUint16(ifd, true);
    const T: Record<number, [number, number, number]> = {};
    for (let i = 0; i < n; i++) { const p = ifd + 2 + i * 12; T[dv.getUint16(p, true)] = [dv.getUint16(p + 2, true), dv.getUint32(p + 4, true), dv.getUint32(p + 8, true)]; }
    if (T[259]?.[2] !== 5 || T[339]?.[2] !== 3) throw new Error('Unexpected STORM GeoTIFF layout');
    const cnt = T[324][1], to: number[] = [], tb: number[] = [];
    for (let i = 0; i < cnt; i++) { to.push(dv.getUint32(T[324][2] + 4 * i, true)); tb.push(dv.getUint32(T[325][2] + 4 * i, true)); }
    const f64 = (o: number, i: number) => dv.getFloat64(o + 8 * i, true);
    const h: StormHeader = { W: T[256][2], H: T[257][2], tw: T[322][2], th: T[323][2], sx: f64(T[33550][2], 0), sy: f64(T[33550][2], 1), x0: f64(T[33922][2], 3), y0: f64(T[33922][2], 4), pred: T[317]?.[2] ?? 1, to, tb };
    stormHeaders.set(file, h);
    await idbSet(`storm:v1:${file}:hdr`, h);
    if (!need.size) return;
    const last = Math.max(...[...need].map((ti) => to[ti] + tb[ti]));
    const order = to.map((o, i) => [o, i]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    for (const ti of order) {
      if (to[ti] + tb[ti] > last) break;
      await pull(to[ti] + tb[ti]);
      const raw = lzwDecode(buf.subarray(to[ti], to[ti] + tb[ti]), h.tw * h.th * 4);
      const f = new Float32Array(unpredict(raw, h.tw, h.th, 32, h.pred, true).buffer);
      const q = new Uint16Array(f.length);
      for (let i = 0; i < f.length; i++) q[i] = Number.isFinite(f[i]) && f[i] > 0 ? Math.min(65535, Math.round(f[i] * 100)) : 0;
      await idbSet(tileKey(file, ti), q);
      memTiles.set(tileKey(file, ti), q);
    }
  } finally {
    rd.cancel().catch(() => undefined);
  }
}
const memTiles = new Map<string, Uint16Array>();
/** 10-min sustained wind (m/s) at each point for one STORM map; points outside the 60°S–60°N grid give 0. */
export async function stormValues(file: string, pts: Array<{ lat: number; lon: number }>, onBytes?: (mb: number) => void, signal?: AbortSignal): Promise<number[]> {
  for (let pass = 0; pass < 3; pass++) {
    await stormLock.get(file);
    let h = await stormHeader(file);
    const tiles = (hh: StormHeader) => pts.map((p) => {
      const c = Math.floor((p.lon - hh.x0) / hh.sx), r = Math.floor((hh.y0 - p.lat) / hh.sy);
      if (c < 0 || r < 0 || c >= hh.W || r >= hh.H) return { ti: -1, i: 0 };
      return { ti: Math.floor(r / hh.th) * Math.ceil(hh.W / hh.tw) + Math.floor(c / hh.tw), i: (r % hh.th) * hh.tw + (c % hh.tw) };
    });
    let missing = new Set<number>();
    if (h) {
      const tt = tiles(h);
      const out: number[] = [];
      for (const t of tt) {
        if (t.ti < 0) { out.push(0); continue; }
        const k = tileKey(file, t.ti);
        const q = memTiles.get(k) ?? (await idbGet<Uint16Array>(k));
        if (!q) { missing.add(t.ti); out.push(NaN); continue; }
        memTiles.set(k, q);
        out.push(q[t.i] / 100);
      }
      if (!missing.size) return out;
    }
    const job = streamStorm(file, missing, onBytes, signal);
    stormLock.set(file, job.catch(() => undefined));
    await job;
    h = await stormHeader(file);
    if (!h) throw new Error('STORM header unreadable');
    missing = new Set();
  }
  throw new Error('STORM tiles could not be cached');
}

// ------------------------------------------------------------------ Zenodo rasters (uncompressed GeoTIFF strips)
const ZEN = (rec: number, file: string) => `https://zenodo.org/api/records/${rec}/files/${file}/content`;
export const SUBSIDENCE_URL = ZEN(10223637, 'ds03.tif');
export const WTD_URL = ZEN(7538161, 'MeanWaterTabelDepth_meter-from-land-surface.tif');
export const ILSM_URL = ZEN(10085272, 'probability.tif');

/** Subsidence rate (mm/yr). Urban cores are sometimes masked in the map, so the nearest valid pixels within ~2 km are used. */
export async function fetchSubsidence(lat: number, lon: number, signal?: AbortSignal): Promise<{ rate: number; exact: boolean }> {
  const w = await readWindow(SUBSIDENCE_URL, lon, lat, 2, signal);
  if (!w.length) return { rate: NaN, exact: false };
  const centre = w[12];
  if (Number.isFinite(centre)) return { rate: centre, exact: true };
  const ok = w.filter(Number.isFinite);
  return { rate: ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : NaN, exact: false };
}
export async function fetchWaterTableDepth(lat: number, lon: number, signal?: AbortSignal): Promise<number> {
  return (await readPixel(WTD_URL, lon, lat, signal)).value;
}
export const ILSM_BBOX = { w: 68.63, e: 97.26, s: 7.88, n: 37.0 };
export async function fetchIlsm(lat: number, lon: number, signal?: AbortSignal): Promise<{ inside: boolean; p: number }> {
  if (lon < ILSM_BBOX.w || lon > ILSM_BBOX.e || lat < ILSM_BBOX.s || lat > ILSM_BBOX.n) return { inside: false, p: NaN };
  const r = await readPixel(ILSM_URL, lon, lat, signal);
  return { inside: r.inside && Number.isFinite(r.value), p: r.value };
}

// ------------------------------------------------------------------ WRI Aqueduct 4.0 (Carto SQL API)
const CARTO = 'https://wri-rw.carto.com/api/v2/sql?q=';
async function carto<T>(sql: string, signal?: AbortSignal): Promise<T[]> {
  const r = await fetch(CARTO + encodeURIComponent(sql), { signal });
  if (!r.ok) throw new Error(`Aqueduct HTTP ${r.status}`);
  return ((await r.json()) as { rows: T[] }).rows;
}
export type AqueductBasin = {
  gid_0: string; gid_1: string; name_0: string; name_1: string; pfaf_id: number;
  bws_raw: number; bws_score: number; bws_label: string; bwd_raw: number; bwd_score: number; iav_score: number; sev_score: number;
  gtd_raw: number; gtd_score: number; gtd_label: string; rfr_raw: number; rfr_score: number; cfr_raw: number; cfr_score: number; drr_score: number; drr_label: string;
};
export type AqueductResult = { basin: AqueductBasin | null; bwsFuture: Record<'opt' | 'bau' | 'pes', Record<2030 | 2050 | 2080, number>> | null; provinceBaseline: number };
export async function fetchAqueduct(lat: number, lon: number, signal?: AbortSignal): Promise<AqueductResult> {
  const cols = 'w.gid_0,w.gid_1,w.name_0,w.name_1,w.pfaf_id,w.bws_raw,w.bws_score,w.bws_label,w.bwd_raw,w.bwd_score,w.iav_score,w.sev_score,w.gtd_raw,w.gtd_score,w.gtd_label,w.rfr_raw,w.rfr_score,w.cfr_raw,w.cfr_score,w.drr_score,w.drr_label';
  const rows = await carto<AqueductBasin>(`select ${cols} from y2018m12d06_rh_master_shape_v01 s join water_risk_indicators_annual w on w.string_id=s.string_id where ST_Intersects(s.the_geom, ST_SetSRID(ST_Point(${lon.toFixed(5)},${lat.toFixed(5)}),4326)) limit 1`, signal);
  const basin = rows[0] ?? null;
  if (!basin || !basin.gid_1 || basin.gid_1 === '-9999') return { basin, bwsFuture: null, provinceBaseline: NaN };
  const g = basin.gid_1.replace(/'/g, "''");
  const [fut, base] = await Promise.all([
    carto<{ scenario: 'opt' | 'bau' | 'pes'; period: 2030 | 2050 | 2080; score: number }>(`select scenario, period, score from aqueduct_results_province_future_2023 where gid_1='${g}' and indicator_name='bws' and weight='Tot'`, signal),
    carto<{ score: number }>(`select score from aqueduct_results_v01_province_v03 where gid_1='${g}' and indicator_name='bws' and weight='Tot' limit 1`, signal),
  ]);
  let bwsFuture: AqueductResult['bwsFuture'] = null;
  if (fut.length) {
    bwsFuture = { opt: {} as Record<2030 | 2050 | 2080, number>, bau: {} as Record<2030 | 2050 | 2080, number>, pes: {} as Record<2030 | 2050 | 2080, number> };
    for (const f of fut) if (bwsFuture[f.scenario]) bwsFuture[f.scenario][f.period] = f.score;
  }
  return { basin, bwsFuture, provinceBaseline: base[0]?.score ?? NaN };
}

// ------------------------------------------------------------------ Climate TRACE (emitting assets near the site)
export type TraceSource = { name: string; sector: string; subsector: string; t: number; km: number };
export async function fetchClimateTrace(lat: number, lon: number, gid1: string | undefined, iso3: string | undefined, signal?: AbortSignal): Promise<{ sources: TraceSource[]; withinKm: number; scope: string }> {
  const q = gid1 ? `gadmId=${encodeURIComponent(gid1)}` : iso3 ? `countries=${encodeURIComponent(iso3)}` : '';
  if (!q) throw new Error('Location has no admin area for Climate TRACE');
  const r = await fetch(`https://api.climatetrace.org/v7/sources?${q}&limit=1000`, { signal });
  if (!r.ok) throw new Error(`Climate TRACE HTTP ${r.status}`);
  const j = (await r.json()) as Array<{ name: string; sector: string; subsector: string; emissionsQuantity: number; centroid?: { latitude: number; longitude: number } }>;
  const R = 6371, rad = Math.PI / 180;
  const km = (a: number, b: number) => { const dLat = (a - lat) * rad, dLon = (b - lon) * rad; const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat * rad) * Math.cos(a * rad) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
  const withinKm = 50;
  const sources = j.filter((s) => s.centroid && Number.isFinite(s.emissionsQuantity))
    .map((s) => ({ name: s.name, sector: s.sector, subsector: s.subsector, t: s.emissionsQuantity, km: km(s.centroid!.latitude, s.centroid!.longitude) }))
    .filter((s) => s.km <= withinKm).sort((a, b) => b.t - a.t);
  return { sources, withinKm, scope: gid1 ? 'state / province' : 'country' };
}

// ------------------------------------------------------------------ WGLC lightning climatology (HDF5, read with h5wasm once, then cached)
type LightGrid = { lat0: number; lon0: number; dLat: number; dLon: number; ny: number; nx: number; v: Float32Array; landPct: Float32Array };
let lightP: Promise<LightGrid> | null = null;
async function lightningGrid(signal?: AbortSignal): Promise<LightGrid> {
  if (lightP) return lightP;
  lightP = (async () => {
    const cached = await idbGet<LightGrid>('wglc:v1');
    if (cached?.v?.length) return cached;
    const r = await fetch(ZEN(20277101, 'wglc_climatology_30m_monthly.nc'), { signal });
    if (!r.ok) throw new Error(`WGLC HTTP ${r.status}`);
    const bytes = new Uint8Array(await r.arrayBuffer());
    const g = await decodeWglc(bytes);
    await idbSet('wglc:v1', g);
    return g;
  })();
  lightP.catch(() => { lightP = null; });
  return lightP;
}
/** Annual stroke density from the monthly climatology: sum over months of (strokes km⁻² day⁻¹ × days). */
export async function decodeWglc(bytes: Uint8Array): Promise<LightGrid> {
  const h5 = await import('h5wasm');
  const { FS } = await h5.ready;
  const name = `wglc_${Date.now()}.nc`;
  FS.writeFile(name, bytes);
  const f = new h5.File(name, 'r');
  try {
    const keys = f.keys();
    const find = (re: RegExp) => keys.find((k) => re.test(k));
    const latK = find(/^lat/i), lonK = find(/^lon/i);
    if (!latK || !lonK) throw new Error('WGLC file has no lat/lon');
    const lat = Array.from((f.get(latK) as { value: ArrayLike<number> }).value);
    const lon = Array.from((f.get(lonK) as { value: ArrayLike<number> }).value);
    const varK = keys.find((k) => { const d = f.get(k) as { shape?: number[] }; return d?.shape?.length === 3; });
    if (!varK) throw new Error('WGLC file has no 3-D variable');
    const ds = f.get(varK) as { shape: number[]; value: ArrayLike<number>; attrs: Record<string, { value: unknown }> };
    const [nt, ny, nx] = ds.shape;
    const raw = ds.value;
    const units = String(ds.attrs?.units?.value ?? '');
    const num = (a: string, d: number) => { const x = ds.attrs?.[a]?.value; const n = Array.isArray(x) || ArrayBuffer.isView(x) ? Number((x as ArrayLike<number>)[0]) : Number(x); return Number.isFinite(n) ? n : d; };
    const fill = num('_FillValue', NaN), scale = num('scale_factor', 1), offset = num('add_offset', 0);
    const days = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const perDay = /day/i.test(units);
    const v = new Float32Array(ny * nx);
    for (let t = 0; t < nt; t++) for (let i = 0; i < ny * nx; i++) {
      const r0 = raw[t * ny * nx + i];
      if (!Number.isFinite(r0) || r0 === fill) continue;
      const x = r0 * scale + offset;
      if (x < 0) continue;
      v[i] += perDay ? x * days[t % 12] : x;
    }
    // percentile of each cell among cells with any recorded strokes (the global distribution is extremely skewed)
    const pos = Array.from(v).filter((x) => x > 0).sort((a, b) => a - b);
    const landPct = new Float32Array(ny * nx);
    for (let i = 0; i < v.length; i++) {
      if (!(v[i] > 0)) continue;
      let lo = 0, hi = pos.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (pos[m] <= v[i]) lo = m + 1; else hi = m; }
      landPct[i] = lo / pos.length;
    }
    return { lat0: lat[0], lon0: lon[0], dLat: lat[1] - lat[0], dLon: lon[1] - lon[0], ny, nx, v, landPct };
  } finally {
    f.close();
    try { FS.unlink(name); } catch { /* ignore */ }
  }
}
export async function fetchLightning(lat: number, lon: number, signal?: AbortSignal): Promise<{ strokes: number; pct: number }> {
  const g = await lightningGrid(signal);
  const i = Math.round((lat - g.lat0) / g.dLat), j = Math.round((lon - g.lon0) / g.dLon);
  if (i < 0 || j < 0 || i >= g.ny || j >= g.nx) return { strokes: NaN, pct: NaN };
  const k = i * g.nx + j;
  return { strokes: g.v[k], pct: g.landPct[k] };
}
