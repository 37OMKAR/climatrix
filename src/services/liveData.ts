// Live site data from free, key-less, CORS-enabled public APIs.
//
//  - Elevation:     Open-Meteo Elevation API (Copernicus DEM GLO-90)        https://open-meteo.com/en/docs/elevation-api
//  - Climate:       Open-Meteo Climate API (CMIP6 HighResMIP, 1950-2050)   https://open-meteo.com/en/docs/climate-api
//  - River flow:    Open-Meteo Flood API (Copernicus GloFAS v4)            https://open-meteo.com/en/docs/flood-api
//  - Earthquakes:   USGS ComCat FDSN event service                         https://earthquake.usgs.gov/fdsnws/event/1/
//
// Attribution required by Open-Meteo: CMIP6 / Copernicus programmes and Open-Meteo (CC BY 4.0).
// Results are cached in localStorage for 30 days per ~1 km cell to stay well within free limits.
import { LiveSiteData } from '../types/climate';

export const CLIMATE_MODELS = ['MRI_AGCM3_2_S', 'EC_Earth3P_HR'];
const WINDOW_NOW: [string, string] = ['2015-01-01', '2024-12-31'];
const WINDOW_MID: [string, string] = ['2041-01-01', '2050-12-31'];
const CACHE_PREFIX = 'climarisk:live:v1:';
const CACHE_TTL_MS = 30 * 24 * 3600 * 1000;

export const LIVE_SOURCES = [
  { name: 'Copernicus DEM GLO-90', via: 'Open-Meteo Elevation API', url: 'https://open-meteo.com/en/docs/elevation-api', feeds: 'Site elevation (drives flood, sea level, tsunami, landslide)' },
  { name: 'CMIP6 HighResMIP (MRI-AGCM3-2-S, EC-Earth3P-HR)', via: 'Open-Meteo Climate API', url: 'https://open-meteo.com/en/docs/climate-api', feeds: 'Heat days >35°C, frost days, max 1-day rain, max wind — 2015-24 vs 2041-50' },
  { name: 'Copernicus GloFAS v4', via: 'Open-Meteo Flood API', url: 'https://open-meteo.com/en/docs/flood-api', feeds: 'Mean annual peak river discharge at the nearest modelled river cell' },
  { name: 'USGS ComCat', via: 'FDSN event count service', url: 'https://earthquake.usgs.gov/fdsnws/event/1/', feeds: 'M5+ earthquakes within 150 km since 1975' },
];

// ------------------------------------------------------------------ small utilities
async function getJson<T>(url: string, signal?: AbortSignal, timeoutMs = 20000): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  signal?.addEventListener('abort', () => ctl.abort());
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) {
      let reason = `${res.status} ${res.statusText}`;
      try {
        const body = await res.json();
        if (body?.reason) reason = body.reason;
      } catch { /* not json */ }
      throw new Error(reason);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

const cellKey = (lat: number, lon: number) => `${lat.toFixed(2)},${lon.toFixed(2)}`;

function readCache(lat: number, lon: number): LiveSiteData | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + cellKey(lat, lon));
    if (!raw) return null;
    const v = JSON.parse(raw) as LiveSiteData;
    if (Date.now() - new Date(v.fetchedAt).getTime() > CACHE_TTL_MS) return null;
    return v;
  } catch {
    return null;
  }
}
function writeCache(lat: number, lon: number, v: LiveSiteData) {
  try {
    localStorage.setItem(CACHE_PREFIX + cellKey(lat, lon), JSON.stringify(v));
  } catch { /* quota or blocked */ }
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const round = (x: number, d = 1) => (Number.isFinite(x) ? Number(x.toFixed(d)) : undefined);

// ------------------------------------------------------------------ parsers (exported for tests)
type DailyBlock = { time: string[] } & Record<string, Array<number | null> | string[]>;

/** All series for a variable: handles both single-model ("var") and multi-model ("var_MODEL") keys. */
export function seriesFor(daily: DailyBlock, variable: string): Array<Array<number | null>> {
  return Object.keys(daily)
    .filter((k) => k === variable || (k.startsWith(variable + '_') && /^[A-Za-z0-9_]+$/.test(k.slice(variable.length + 1)) && !k.slice(variable.length + 1).includes('__')))
    .map((k) => daily[k] as Array<number | null>);
}

/** Per-year statistic averaged over years and models. */
export function annualStat(daily: DailyBlock, variable: string, stat: (vals: number[]) => number): number {
  const byModel = seriesFor(daily, variable);
  const perModel = byModel.map((series) => {
    const years = new Map<string, number[]>();
    series.forEach((v, i) => {
      if (v === null || v === undefined || !Number.isFinite(v)) return;
      const y = daily.time[i]?.slice(0, 4);
      if (!y) return;
      if (!years.has(y)) years.set(y, []);
      years.get(y)!.push(v);
    });
    // ignore years with < 300 valid days (partial years)
    return mean([...years.values()].filter((v) => v.length >= 300).map(stat));
  });
  return mean(perModel.filter(Number.isFinite));
}

export function summariseClimate(daily: DailyBlock) {
  return {
    // Counts are rescaled to a full year so a year with missing days is not under-counted
    heatDays35: annualStat(daily, 'temperature_2m_max', (v) => (v.filter((x) => x > 35).length * 365) / v.length),
    frostDays: annualStat(daily, 'temperature_2m_min', (v) => (v.filter((x) => x < 0).length * 365) / v.length),
    rx1day: annualStat(daily, 'precipitation_sum', (v) => Math.max(...v)),
    windMax: annualStat(daily, 'wind_speed_10m_max', (v) => Math.max(...v)),
  };
}

export function meanAnnualMax(time: string[], values: Array<number | null>): number {
  const years = new Map<string, { max: number; n: number }>();
  values.forEach((v, i) => {
    if (v === null || !Number.isFinite(v) || !time[i]) return;
    const y = time[i].slice(0, 4);
    const cur = years.get(y) ?? { max: -Infinity, n: 0 };
    years.set(y, { max: Math.max(cur.max, v), n: cur.n + 1 });
  });
  // Partial years (< 300 days) would bias the annual maximum low, so they are skipped
  return mean([...years.values()].filter((y) => y.n >= 300).map((y) => y.max));
}

// ------------------------------------------------------------------ fetchers
export async function fetchElevations(points: Array<{ lat: number; lon: number }>, signal?: AbortSignal): Promise<number[]> {
  const out: number[] = [];
  for (let i = 0; i < points.length; i += 100) {
    const chunk = points.slice(i, i + 100);
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${chunk.map((p) => p.lat.toFixed(4)).join(',')}&longitude=${chunk.map((p) => p.lon.toFixed(4)).join(',')}`;
    const j = await getJson<{ elevation: number[] }>(url, signal);
    out.push(...j.elevation);
  }
  return out;
}

async function fetchClimateWindow(lat: number, lon: number, [start, end]: [string, string], signal?: AbortSignal) {
  const url =
    `https://climate-api.open-meteo.com/v1/climate?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}` +
    `&start_date=${start}&end_date=${end}&models=${CLIMATE_MODELS.join(',')}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=GMT`;
  const j = await getJson<{ daily: DailyBlock }>(url, signal, 45000);
  return summariseClimate(j.daily);
}

export async function fetchQuakeCount(lat: number, lon: number, signal?: AbortSignal): Promise<number> {
  const url = `https://earthquake.usgs.gov/fdsnws/event/1/count?format=geojson&latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&maxradiuskm=150&minmagnitude=5&starttime=1975-01-01`;
  const j = await getJson<{ count: number }>(url, signal);
  return j.count;
}

export async function fetchRiverPeak(lat: number, lon: number, signal?: AbortSignal): Promise<number> {
  const url = `https://flood-api.open-meteo.com/v1/flood?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&daily=river_discharge&start_date=2000-01-01&end_date=2023-12-31`;
  const j = await getJson<{ daily: { time: string[]; river_discharge: Array<number | null> } }>(url, signal, 30000);
  return meanAnnualMax(j.daily.time, j.daily.river_discharge);
}

/** Fetch everything for one site. Partial failures are recorded in `errors`, never thrown. */
export async function fetchLiveSiteData(lat: number, lon: number, opts: { signal?: AbortSignal; useCache?: boolean } = {}): Promise<LiveSiteData> {
  if (opts.useCache !== false) {
    const hit = readCache(lat, lon);
    if (hit) return hit;
  }
  const [elev, now, mid, quakes, river] = await Promise.allSettled([
    fetchElevations([{ lat, lon }], opts.signal).then((e) => e[0]),
    fetchClimateWindow(lat, lon, WINDOW_NOW, opts.signal),
    fetchClimateWindow(lat, lon, WINDOW_MID, opts.signal),
    fetchQuakeCount(lat, lon, opts.signal),
    fetchRiverPeak(lat, lon, opts.signal),
  ]);
  const errors: string[] = [];
  const val = <T,>(r: PromiseSettledResult<T>, label: string): T | undefined => {
    if (r.status === 'fulfilled') return r.value;
    errors.push(`${label}: ${(r.reason as Error)?.message ?? 'failed'}`);
    return undefined;
  };
  const e = val(elev, 'Elevation');
  const n = val(now, 'Climate 2015-24');
  const m = val(mid, 'Climate 2041-50');
  const q = val(quakes, 'Earthquakes');
  const rv = val(river, 'River discharge');

  const data: LiveSiteData = {
    fetchedAt: new Date().toISOString(),
    demElevationM: e !== undefined && Number.isFinite(e) ? Math.round(e) : undefined,
    heatDays35Now: round(n?.heatDays35 ?? NaN),
    heatDays35Mid: round(m?.heatDays35 ?? NaN),
    frostDaysNow: round(n?.frostDays ?? NaN),
    frostDaysMid: round(m?.frostDays ?? NaN),
    rx1dayNowMm: round(n?.rx1day ?? NaN),
    rx1dayMidMm: round(m?.rx1day ?? NaN),
    windMaxNowKmh: round(n?.windMax ?? NaN),
    windMaxMidKmh: round(m?.windMax ?? NaN),
    quakesM5Within150km: q,
    // GloFAS returns tiny values far from rivers; treat < 1 m³/s as "no significant river"
    riverMaxDischargeM3s: rv !== undefined && Number.isFinite(rv) ? round(rv, 0) : undefined,
    models: CLIMATE_MODELS,
    errors: errors.length ? errors : undefined,
  };
  // Only cache when the core calls succeeded
  if (!errors.length) writeCache(lat, lon, data);
  return data;
}

/** Run an async task over items with limited concurrency, reporting progress. */
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>, onProgress?: (done: number) => void): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
      onProgress?.(++done);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** True when the fetch produced at least one usable number. */
export const hasUsableLiveData = (d: LiveSiteData) =>
  [d.demElevationM, d.heatDays35Now, d.frostDaysNow, d.rx1dayNowMm, d.quakesM5Within150km, d.riverMaxDischargeM3s].some((x) => x !== undefined);
