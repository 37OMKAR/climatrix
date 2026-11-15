// Bundled open datasets (loaded once from /public/data):
//  - coastline.dat: Natural Earth 1:10m coastline (public domain), points binned by 1° cell
//  - volcanoes.json: Smithsonian Global Volcanism Program Holocene list (via plotly/datasets mirror)
const BASE = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
import { haversineKm } from '../lib/stats';

type Coast = { offs: Uint32Array; pts: Int32Array };
let coastP: Promise<Coast> | null = null;

export function loadCoast(): Promise<Coast> {
  coastP ??= fetch(`${BASE}data/coastline.dat`)
    .then((r) => {
      if (!r.ok) throw new Error(`coastline data ${r.status}`);
      return r.arrayBuffer();
    })
    .then((buf) => {
      const n = new DataView(buf).getUint32(0, true);
      const cells = 180 * 360 + 1;
      const offs = new Uint32Array(buf, 4, cells);
      const pts = new Int32Array(buf, 4 + cells * 4, n * 2);
      return { offs, pts };
    });
  return coastP;
}

/** Great-circle distance (km) from a point to the nearest Natural Earth 10m coastline vertex (~1 km spacing). */
export function distanceToCoastKm(c: Coast, lat: number, lon: number, maxKm = 2000): number {
  let best = Infinity;
  const li = Math.floor(lat), lo = Math.floor(lon);
  for (let ring = 0; ring <= 25; ring++) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const y = li + dy;
        if (y < -90 || y > 89) continue;
        const x = (((lo + dx + 180) % 360) + 360) % 360;
        const k = (y + 90) * 360 + x;
        for (let i = c.offs[k]; i < c.offs[k + 1]; i++) {
          const d = haversineKm(lat, lon, c.pts[2 * i + 1] / 1e4, c.pts[2 * i] / 1e4);
          if (d < best) best = d;
        }
      }
    }
    // a 1° ring is ≥ ~(ring) * 111 * cos(lat) km away; stop once nothing closer can exist
    const ringKm = ring * 111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180));
    if (best < ringKm || ringKm > maxKm) break;
  }
  return best;
}

export type Volcano = { name: string; country: string; lat: number; lon: number; type: string; lastKnown: string };
let volcP: Promise<Volcano[]> | null = null;
export function loadVolcanoes(): Promise<Volcano[]> {
  volcP ??= fetch(`${BASE}data/volcanoes.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`volcano data ${r.status}`);
      return r.json();
    })
    .then((rows: Array<[string, string, number, number, string, string]>) =>
      rows.map(([name, country, lat, lon, type, lastKnown]) => ({ name, country, lat, lon, type, lastKnown })));
  return volcP;
}
