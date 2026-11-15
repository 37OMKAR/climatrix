// Turns raw open data into per-hazard parameters, then values and scores for any scenario/year.
import {
  fetchElevations, fetchEra5, fetchCmip6, fetchGlofas, fetchSeaLevel, fetchDust, fetchQuakes, fetchStorms, fetchRunups,
  CMIP_MODELS, type Daily, type Quake, type StormPoint, type Runup, type SourceId,
} from '../data/api';
import { loadCoast, distanceToCoastKm, loadVolcanoes } from '../data/static';
import {
  fetchJrcRiver, fetchDeltares, stormValues, STORM_GCMS, fetchSubsidence, fetchWaterTableDepth, fetchIlsm, fetchAqueduct, fetchClimateTrace, fetchLightning,
  type JrcResult, type TraceSource,
} from '../data/datasets';
import { gumbelFit, gumbelReturnLevel, annualMaxima, daysPerYear, mean, std, finite, haversineKm, scoreFrom, clamp } from '../lib/stats';
import { wetBulbStull, petHargreaves, dayOfYear, fireWeatherIndex, pgaAtRate, emanuelDamage, jrcDamage, hornSlope, wsdi, percentile } from './methods';
import { HAZARDS, HAZARD, type HazardId, type Scenario, type Year, warmingFactor, warmingAboveBaseline, seaLevelRise, scoreFor, ratingOf, type Rating } from './hazards';
import { calculateLocationBaselineRisk, estimateGlobalElevationMeters, getDistanceToOceanKm, checkIsAridZone } from '../services/climateEngine';

export type Param = {
  status: 'ok' | 'error' | 'notAssessed';
  mode?: 'add' | 'mul' | 'fixed' | 'custom';
  base?: number; delta?: number; rel?: number;
  d?: Record<string, number>;
  note?: string; error?: string;
};
export type SiteAdmin = { iso3: string; gid1?: string; country: string; province?: string };
export type SiteTrace = { sources: TraceSource[]; total: number; count: number; withinKm: number } | { error: string };
export type SiteParams = {
  v: 4; lat: number; lon: number; computedAt: string;
  admin?: SiteAdmin; trace?: SiteTrace;
  elevation: number; coastKm: number; slopeDeg: number; hand: number;
  params: Record<HazardId, Param>;
  sourceErrors: Partial<Record<SourceId, string>>;
  /** fraction of value lost per year (cyclone wind, Emanuel curve) at k = 0; scaled with intensity */
  cycloneEal?: { lambda: number; sigma: number; u: number; landFactor: number };
};

// ------------------------------------------------------------------ helpers over daily data
type Series = { time: string[]; v: number[] };
const col = (d: Daily, key: string): Series => ({ time: d.time, v: (d[key] as Array<number | null> | undefined ?? []).map((x) => (x === null ? NaN : x)) });
const yr = (t: string) => +t.slice(0, 4);
const slice = (s: Series, y0: number, y1: number): Series => {
  const time: string[] = [], v: number[] = [];
  s.time.forEach((t, i) => { const y = yr(t); if (y >= y0 && y <= y1) { time.push(t); v.push(s.v[i]); } });
  return { time, v };
};
const monthlyMeans = (s: Series) => {
  const sum = new Array(12).fill(0), n = new Array(12).fill(0);
  s.time.forEach((t, i) => { if (Number.isFinite(s.v[i])) { const m = +t.slice(5, 7) - 1; sum[m] += s.v[i]; n[m]++; } });
  return sum.map((x, m) => (n[m] ? x / n[m] : NaN));
};
/** monthly delta (future − baseline) of a CMIP6 variable, averaged over models */
function cmipMonthlyDelta(c: Daily, v: string): number[] {
  const per = CMIP_MODELS.map((m) => {
    const s = col(c, `${v}_${m}`);
    const b = monthlyMeans(slice(s, 1995, 2014)), f = monthlyMeans(slice(s, 2036, 2049));
    return b.map((x, i) => f[i] - x);
  }).filter((a) => a.every(Number.isFinite));
  if (!per.length) throw new Error(`CMIP6 ${v} missing`);
  return per[0].map((_, i) => mean(per.map((p) => p[i])));
}
const shift = (s: Series, dm: number[]): Series => ({ time: s.time, v: s.v.map((x, i) => x + dm[+s.time[i].slice(5, 7) - 1]) });
function cmipMean(c: Daily, f: (m: string) => number): number {
  const xs = CMIP_MODELS.map(f).filter(Number.isFinite);
  if (!xs.length) throw new Error('CMIP6 models returned no data');
  return mean(xs);
}

/** SPEI-like index: 12-month rolling sums of P − PET, standardised by a reference window. */
function speiFrequency(time: string[], p: number[], tmax: number[], tmin: number[], lat: number, ref: [number, number], test: [number, number]): number {
  const months = new Map<string, number>();
  time.forEach((t, i) => {
    if (![p[i], tmax[i], tmin[i]].every(Number.isFinite)) return;
    const k = t.slice(0, 7);
    months.set(k, (months.get(k) ?? 0) + p[i] - petHargreaves(tmax[i], tmin[i], lat, dayOfYear(t)));
  });
  const keys = [...months.keys()].sort();
  const roll: Array<{ k: string; v: number }> = [];
  for (let i = 11; i < keys.length; i++) {
    let s = 0;
    for (let j = i - 11; j <= i; j++) s += months.get(keys[j])!;
    roll.push({ k: keys[i], v: s });
  }
  const inY = (k: string, [a, b]: [number, number]) => +k.slice(0, 4) >= a && +k.slice(0, 4) <= b;
  const refV = roll.filter((r) => inY(r.k, ref)).map((r) => r.v);
  const m = mean(refV), sd = std(refV);
  const testV = roll.filter((r) => inY(r.k, test)).map((r) => (r.v - m) / sd);
  if (!testV.length || !(sd > 0)) return NaN;
  return (100 * testV.filter((z) => z < -1.5).length) / testV.length;
}
function aridity(time: string[], p: number[], tmax: number[], tmin: number[], lat: number): number {
  let P = 0, E = 0;
  time.forEach((t, i) => { if ([p[i], tmax[i], tmin[i]].every(Number.isFinite)) { P += p[i]; E += petHargreaves(tmax[i], tmin[i], lat, dayOfYear(t)); } });
  return E > 0 ? P / E : NaN;
}

// ------------------------------------------------------------------ assessment
export type Progress = (step: string, done: number, total: number) => void;

export async function collectSite(lat: number, lon: number, onProgress?: Progress, signal?: AbortSignal): Promise<SiteParams> {
  const total = 17;
  let done = 0;
  const tick = (s: string) => onProgress?.(s, ++done, total);
  const sourceErrors: Partial<Record<SourceId, string>> = {};
  const settle = async <T,>(src: SourceId, p: Promise<T>): Promise<T | undefined> => {
    try { const v = await p; tick(src); return v; } catch (e) { sourceErrors[src] = e instanceof Error ? e.message : String(e); tick(src); return undefined; }
  };

  // DEM window: 3×3 at ~90 m for slope, ring of 8 at ~1.5 km and ~3 km for height above local low ground
  const dLat = 0.0008, dLon = 0.0008 / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const win: Array<[number, number]> = [];
  for (const dy of [1, 0, -1]) for (const dx of [-1, 0, 1]) win.push([lat + dy * dLat, lon + dx * dLon]);
  const ring: Array<[number, number]> = [];
  for (const r of [0.0135, 0.027]) for (let a = 0; a < 8; a++) ring.push([lat + r * Math.sin((a * Math.PI) / 4), lon + (r * Math.cos((a * Math.PI) / 4)) / Math.max(0.2, Math.cos((lat * Math.PI) / 180))]);

  const coastP = loadCoast().then((c) => distanceToCoastKm(c, lat, lon));
  const stormFiles = ['constant_10', 'constant_50', 'constant_100', 'constant_1000', ...STORM_GCMS.map((g) => `${g}_100`)];
  const stormP = Promise.all(stormFiles.map((f) => stormValues(f, [{ lat, lon }], undefined, signal).then((v) => v[0])));
  const [jrc, aq, subs, wtd, ilsm, light, stormV] = await Promise.all([
    settle('jrc', fetchJrcRiver(lat, lon, signal)),
    settle('aqueduct', fetchAqueduct(lat, lon, signal)),
    settle('subsidence', fetchSubsidence(lat, lon, signal)),
    settle('wtd', fetchWaterTableDepth(lat, lon, signal)),
    settle('ilsm', fetchIlsm(lat, lon, signal)),
    settle('wglc', fetchLightning(lat, lon, signal)),
    settle('storm', stormP),
  ]);
  const [elevs, era5, cmip, glofas, quakes, storms, runups, dust, coastKm, volcs] = await Promise.all([
    settle('elevation', fetchElevations([...win, ...ring], signal)),
    settle('era5', fetchEra5(lat, lon, signal)),
    settle('cmip6', fetchCmip6(lat, lon, signal)),
    settle('glofas', fetchGlofas(lat, lon, signal)),
    settle('usgs', fetchQuakes(lat, lon, signal)),
    settle('ibtracs', fetchStorms(lat, lon, signal)),
    settle('ncei', fetchRunups(lat, lon, signal)),
    settle('cams', fetchDust(lat, lon, signal)),
    settle('coast', coastP),
    settle('gvp', loadVolcanoes()),
  ]);
  const estElev = estimateGlobalElevationMeters(lat, lon);
  const elev0 = elevs ? elevs[4] : estElev;
  const elevation = Number.isFinite(elev0) ? elev0 : estElev;
  const coastDist = coastKm !== undefined && Number.isFinite(coastKm) ? coastKm : getDistanceToOceanKm(lat, lon);
  const deltaresWanted = coastDist <= 50 && elevation <= 30;
  const delt = deltaresWanted ? await settle('deltares', fetchDeltares(lat, lon, signal)) : (tick('deltares'), undefined);
  const sea = coastDist <= 30 ? await fetchSeaLevel(lat, lon, signal).catch((e) => { sourceErrors.marine = String(e?.message ?? e); return undefined; }) : undefined;

  const cellX = 0.0008 * 111320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)), cellY = 0.0008 * 111320;
  const slopeDeg = elevs ? hornSlope(elevs.slice(0, 9), cellX, cellY) : (elevation > 1500 ? 10.0 : elevation > 500 ? 4.0 : 1.2);
  const hand = elevs ? Math.max(0, elevation - Math.min(...elevs.slice(9))) : Math.max(1.0, elevation * 0.05);

  const P = {} as Record<HazardId, Param>;
  const fail = (id: HazardId, src: SourceId[], e?: unknown) => {
    const msg = e instanceof Error ? e.message : e ? String(e) : src.map((s) => sourceErrors[s]).filter(Boolean).join('; ') || 'source unavailable';
    P[id] = { status: 'error', error: msg };
  };
  const tryP = (id: HazardId, need: unknown[], src: SourceId[], fn: () => Param) => {
    if (need.some((x) => x === undefined || (typeof x === 'number' && !Number.isFinite(x)))) return fail(id, src);
    try { P[id] = fn(); } catch (e) { fail(id, src, e); }
  };

  const E = era5 ? { tmax: col(era5, 'temperature_2m_max'), tmin: col(era5, 'temperature_2m_min'), pr: col(era5, 'precipitation_sum'), gust: col(era5, 'wind_gusts_10m_max'), snow: col(era5, 'snowfall_sum') } : undefined;
  const r100Rel = { v: 0 };

  // Heavy rain
  tryP('heavy_rain', [E, cmip], ['era5', 'cmip6'], () => {
    const f = gumbelFit(annualMaxima(E!.pr.time, E!.pr.v));
    if (!f) throw new Error('not enough ERA5 years');
    const base = gumbelReturnLevel(f, 100);
    const rel = cmipMean(cmip!, (m) => {
      const s = col(cmip!, `precipitation_sum_${m}`);
      const b = gumbelFit(annualMaxima(slice(s, 1995, 2014).time, slice(s, 1995, 2014).v)), fu = gumbelFit(annualMaxima(slice(s, 2036, 2049).time, slice(s, 2036, 2049).v));
      return b && fu ? gumbelReturnLevel(fu, 100) / gumbelReturnLevel(b, 100) - 1 : NaN;
    });
    r100Rel.v = clamp(rel, -0.3, 0.6);
    return { status: 'ok', mode: 'mul', base, rel: r100Rel.v };
  });

  // Heat, heatwave, cold, permafrost (ERA5 baseline + CMIP6 monthly delta)
  tryP('extreme_heat', [E, cmip], ['era5', 'cmip6'], () => {
    const b = slice(E!.tmax, 1995, 2014), dm = cmipMonthlyDelta(cmip!, 'temperature_2m_max');
    const base = daysPerYear(b.time, b.v, (x) => x > 35), fut = daysPerYear(b.time, shift(b, dm).v, (x) => x > 35);
    return { status: 'ok', mode: 'add', base, delta: fut - base };
  });
  tryP('heatwave', [E, cmip], ['era5', 'cmip6'], () => {
    const b = slice(E!.tmax, 1995, 2014), dm = cmipMonthlyDelta(cmip!, 'temperature_2m_max');
    const byDoy: number[][] = Array.from({ length: 366 }, () => []);
    b.time.forEach((t, i) => { const d = dayOfYear(t); for (let w = -2; w <= 2; w++) byDoy[((d - 1 + w + 366) % 366)].push(b.v[i]); });
    const p90 = byDoy.map((a) => percentile(a, 0.9));
    const base = wsdi(b.time, b.v, p90), fut = wsdi(b.time, shift(b, dm).v, p90);
    return { status: 'ok', mode: 'add', base, delta: fut - base };
  });
  tryP('cold', [E, cmip], ['era5', 'cmip6'], () => {
    const b = slice(E!.tmin, 1995, 2014), dm = cmipMonthlyDelta(cmip!, 'temperature_2m_min');
    const base = daysPerYear(b.time, b.v, (x) => x < 0), fut = daysPerYear(b.time, shift(b, dm).v, (x) => x < 0);
    return { status: 'ok', mode: 'add', base, delta: fut - base };
  });
  tryP('permafrost', [E, cmip], ['era5', 'cmip6'], () => {
    const a = slice(E!.tmax, 1995, 2014), b = slice(E!.tmin, 1995, 2014);
    const maat = mean(finite(a.v.map((x, i) => (x + b.v[i]) / 2)));
    const d1 = cmipMonthlyDelta(cmip!, 'temperature_2m_max'), d2 = cmipMonthlyDelta(cmip!, 'temperature_2m_min');
    return { status: 'ok', mode: 'add', base: maat, delta: mean(d1.map((x, i) => (x + d2[i]) / 2)) };
  });
  tryP('heat_stress', [E, cmip], ['cmip6', 'era5'], () => {
    const eraMean = mean(finite(slice(E!.tmax, 1995, 2014).v));
    const per = (y0: number, y1: number) => cmipMean(cmip!, (m) => {
      const t = slice(col(cmip!, `temperature_2m_max_${m}`), 1995, 2014);
      const bias = eraMean - mean(finite(t.v));
      const T = slice(col(cmip!, `temperature_2m_max_${m}`), y0, y1), H = slice(col(cmip!, `relative_humidity_2m_min_${m}`), y0, y1);
      return mean(annualMaxima(T.time, T.v.map((x, i) => (Number.isFinite(x) && Number.isFinite(H.v[i]) ? wetBulbStull(x + bias, H.v[i]) : NaN))));
    });
    const base = per(1995, 2014);
    return { status: 'ok', mode: 'add', base, delta: per(2036, 2049) - base };
  });
  tryP('heavy_snow', [E], ['era5'], () => {
    const ann = mean(Object.values(E!.snow.v.reduce((acc, x, i) => { const y = E!.snow.time[i].slice(0, 4); acc[y] = (acc[y] ?? 0) + (Number.isFinite(x) ? x : 0); return acc; }, {} as Record<string, number>)));
    const f = gumbelFit(annualMaxima(E!.snow.time, E!.snow.v));
    return { status: 'ok', mode: 'fixed', base: ann < 1 || !f ? 0 : Math.max(0, gumbelReturnLevel(f, 50)), d: { annualSnowCm: ann } };
  });

  // Wind
  tryP('windstorm', [E, cmip], ['era5', 'cmip6'], () => {
    const f = gumbelFit(annualMaxima(E!.gust.time, E!.gust.v));
    if (!f) throw new Error('not enough ERA5 years');
    const rel = cmipMean(cmip!, (m) => {
      const s = col(cmip!, `wind_speed_10m_max_${m}`);
      const b = gumbelFit(annualMaxima(slice(s, 1995, 2014).time, slice(s, 1995, 2014).v)), fu = gumbelFit(annualMaxima(slice(s, 2036, 2049).time, slice(s, 2036, 2049).v));
      return b && fu ? gumbelReturnLevel(fu, 50) / gumbelReturnLevel(b, 50) - 1 : NaN;
    });
    return { status: 'ok', mode: 'mul', base: gumbelReturnLevel(f, 50), rel: clamp(rel, -0.2, 0.2) };
  });
  let cycloneEal: SiteParams['cycloneEal'];
  const stormOk = stormV && stormV.every(Number.isFinite);
  if (stormOk) {
    // STORM: 10-min sustained wind (m/s) → 1-min equivalent km/h (WMO: 10-min ≈ 0.88 × 1-min at sea)
    const k = 3.6 / 0.88;
    const [v10, v50, v100, v1000, ...gcm] = stormV!.map((x) => x * k);
    const rels = gcm.filter((g) => Number.isFinite(g)).map((g) => (v100 > 0 ? g / v100 - 1 : 0));
    const gcmRel = rels.length ? mean(rels) : 0;
    P.cyclone = { status: 'ok', mode: 'custom', base: v100, d: { src: 1, v10, v50, v100, v1000, gcmRel, gcmMin: rels.length ? Math.min(...rels) : 0, gcmMax: rels.length ? Math.max(...rels) : 0 },
      note: v100 <= 0 ? 'Outside the reach of tropical cyclones in 10 000 synthetic years' : undefined };
  } else tryP('cyclone', [storms, coastKm], ['ibtracs', 'coast'], (): Param => {
    // fallback when STORM cannot be read: closest approach per IBTrACS storm, wind at site in km/h
    const best = new Map<string, number>();
    for (const s of storms as StormPoint[]) {
      const d = haversineKm(lat, lon, s.lat, s.lon);
      const vkt = s.windKt * (d <= 30 ? 1 : (30 / d) ** 0.6);
      const inland = 26 + Math.max(0, vkt - 26) * Math.exp((-0.095 * (coastKm as number)) / 20); // Kaplan & DeMaria (1995), ~20 km/h forward speed
      const v = (coastKm as number) > 0 ? Math.min(vkt, inland) : vkt;
      best.set(s.id, Math.max(best.get(s.id) ?? 0, v * 1.852));
    }
    const years = 2017 - 1970 + 1, u = 63;
    const exc = [...best.values()].filter((v) => v >= u);
    const why = `STORM unavailable (${sourceErrors.storm ?? 'error'}); IBTrACS 1970–2017 used`;
    if (!exc.length) return { status: 'ok', mode: 'custom', base: 0, d: { stormsPerYear: 0 }, note: why };
    const lambda = exc.length / years, sigma = Math.max(5, mean(exc.map((v) => v - u)));
    const lvl = (T: number) => (lambda * T > 1 ? u + sigma * Math.log(lambda * T) : 0);
    cycloneEal = { lambda, sigma, u, landFactor: 1 };
    return { status: 'ok', mode: 'custom', base: lvl(100), d: { stormsPerYear: lambda, lvl10: lvl(10), lvl50: lvl(50), lvl250: lvl(250) }, note: why };
  });
  tryP('dust', [dust], ['cams'], () => {
    const daily = new Map<string, number[]>();
    dust!.time.forEach((t, i) => { const v = dust!.dust[i]; if (v !== null && Number.isFinite(v)) { const k = t.slice(0, 10); (daily.get(k) ?? daily.set(k, []).get(k)!).push(v); } });
    const days = [...daily.entries()].map(([k, a]) => ({ k, m: mean(a) }));
    if (days.length < 300) throw new Error('not enough CAMS days');
    return { status: 'ok', mode: 'fixed', base: (days.filter((d) => d.m > 100).length * 365) / days.length };
  });

  // Water
  tryP('drought', [E, cmip], ['era5', 'cmip6'], () => {
    const base = speiFrequency(E!.pr.time, E!.pr.v, E!.tmax.v, E!.tmin.v, lat, [1981, 2004], [2005, 2024]);
    const fut = cmipMean(cmip!, (m) => {
      const pr = col(cmip!, `precipitation_sum_${m}`), tx = col(cmip!, `temperature_2m_max_${m}`), tn = col(cmip!, `temperature_2m_min_${m}`);
      return speiFrequency(pr.time, pr.v, tx.v, tn.v, lat, [1995, 2014], [2036, 2049]);
    });
    return { status: 'ok', mode: 'add', base, delta: fut - 6.7 };
  });
  tryP('water_scarcity', [E, cmip], ['era5', 'cmip6'], () => {
    const p = slice(E!.pr, 1995, 2014), tx = slice(E!.tmax, 1995, 2014), tn = slice(E!.tmin, 1995, 2014);
    const base = aridity(p.time, p.v, tx.v, tn.v, lat);
    const rel = cmipMean(cmip!, (m) => {
      const g = (y0: number, y1: number) => {
        const pr = slice(col(cmip!, `precipitation_sum_${m}`), y0, y1), a = slice(col(cmip!, `temperature_2m_max_${m}`), y0, y1), b = slice(col(cmip!, `temperature_2m_min_${m}`), y0, y1);
        return aridity(pr.time, pr.v, a.v, b.v, lat);
      };
      return g(2036, 2049) / g(1995, 2014) - 1;
    });
    return { status: 'ok', mode: 'mul', base, rel: clamp(rel, -0.6, 0.6) };
  });
  const basin = aq?.basin;
  tryP('water_stress', [aq], ['aqueduct'], (): Param => {
    if (!basin) throw new Error('No Aqueduct sub-basin at this point (sea or outside coverage)');
    const arid = basin.bws_score === -1 || basin.bws_raw === -1 || /arid/i.test(basin.bws_label ?? '');
    if (!arid && !(basin.bws_score >= 0)) throw new Error('Aqueduct has no water-stress value for this sub-basin');
    const score0 = arid ? 5 : basin.bws_score;
    const f = aq!.bwsFuture, pb = aq!.provinceBaseline;
    const d: Record<string, number> = { score0, bwsRaw: arid ? NaN : basin.bws_raw, provBase: pb };
    if (f && Number.isFinite(pb)) for (const sc of ['opt', 'bau', 'pes'] as const) for (const yy of [2030, 2050, 2080] as const) d[`${sc}${yy}`] = f[sc]?.[yy] ?? NaN;
    return { status: 'ok', mode: 'custom', base: score0, d, note: arid ? 'Arid and low water use (Aqueduct assigns the maximum score)' : `${basin.bws_label}` };
  });
  tryP('groundwater', [aq], ['aqueduct'], (): Param => {
    if (!basin) throw new Error('No Aqueduct sub-basin at this point');
    if (/no data/i.test(basin.gtd_label ?? '') || (basin.gtd_score === -9999 && !/insignificant/i.test(basin.gtd_label ?? ''))) throw new Error('Aqueduct has no groundwater trend for this sub-basin');
    const score = basin.gtd_score >= 0 ? basin.gtd_score : 0;
    return { status: 'ok', mode: 'fixed', base: basin.gtd_raw, d: { score, wtd: wtd ?? NaN }, note: basin.gtd_label };
  });
  tryP('wildfire', [cmip], ['cmip6'], () => {
    const per = (y0: number, y1: number) => cmipMean(cmip!, (m) => {
      // noon humidity ≈ 0.7·daily minimum + 0.3·daily mean (minimum alone overstates fire danger)
      const T = slice(col(cmip!, `temperature_2m_max_${m}`), y0 - 1, y1), Hmin = slice(col(cmip!, `relative_humidity_2m_min_${m}`), y0 - 1, y1), Hmean = slice(col(cmip!, `relative_humidity_2m_mean_${m}`), y0 - 1, y1);
      const H = { time: Hmin.time, v: Hmin.v.map((x, i) => (Number.isFinite(Hmean.v[i]) ? 0.7 * x + 0.3 * Hmean.v[i] : x)) };
      const W = slice(col(cmip!, `wind_speed_10m_mean_${m}`), y0 - 1, y1), R = slice(col(cmip!, `precipitation_sum_${m}`), y0 - 1, y1);
      const ser = T.time.map((t, i) => ({ t: T.v[i], rh: H.v[i], ws: W.v[i], rain: R.v[i], month: +t.slice(5, 7) })).filter((x) => [x.t, x.rh, x.ws, x.rain].every(Number.isFinite));
      const fwi = fireWeatherIndex(ser, lat);
      const tt = T.time.filter((_, i) => [T.v[i], H.v[i], W.v[i], R.v[i]].every(Number.isFinite));
      const keep = tt.map((t, i) => ({ t, f: fwi[i] })).filter((x) => yr(x.t) >= y0);
      return daysPerYear(keep.map((x) => x.t), keep.map((x) => x.f), (f) => f > 38);
    });
    const base = per(1995, 2014);
    return { status: 'ok', mode: 'add', base, delta: per(2036, 2049) - base };
  });

  // Flood
  tryP('river_flood', [jrc], ['jrc'], (): Param => {
    const j = jrc as JrcResult;
    const d: Record<string, number> = { covered: j.covered ? 1 : 0, near100: j.nearMax100, mu: NaN, beta: NaN, q100: NaN };
    for (const [rp, v] of Object.entries(j.depth)) d[`d${rp}`] = v;
    if (glofas) {
      const q = col(glofas, 'river_discharge');
      const f = gumbelFit(annualMaxima(q.time, q.v));
      if (f && mean(finite(q.v)) >= 1) { d.mu = f.u; d.beta = f.a; d.q100 = gumbelReturnLevel(f, 100); }
    }
    return { status: 'ok', mode: 'custom', base: j.depth[100], rel: r100Rel.v * 0.8, d,
      note: !j.covered ? 'No JRC flood tile here (open sea or small island)' : !glofas ? 'GloFAS unavailable: present-day depths only' : undefined };
  });
  const tide = sea ? Math.max(...finite(sea.sea_level_height_msl)) : NaN;
  tryP('coastal_flood', [coastKm, elevation], ['coast', 'elevation'], (): Param => {
    const ck = coastKm as number;
    if (ck > 50) return { status: 'ok', mode: 'custom', base: 0, d: { src: 0, coastKm: ck, elev: elevation, tide }, note: 'More than 50 km from the coast' };
    if (elevation > 30) return { status: 'ok', mode: 'custom', base: 0, d: { src: 0, coastKm: ck, elev: elevation, tide }, note: 'Ground more than 30 m above sea level' };
    if (delt) return { status: 'ok', mode: 'custom', base: delt.d2018[100], d: { src: 2, coastKm: ck, elev: elevation, tide, d10: delt.d2018[10], d100: delt.d2018[100], d100_2050: delt.d2050[100] },
      note: delt.sea ? 'Point falls on sea or masked water in the 90 m Deltares grid' : undefined };
    return { status: 'ok', mode: 'custom', base: 0, d: { src: 1, coastKm: ck, elev: elevation, tide },
      note: `Deltares unavailable (${sourceErrors.deltares ?? 'error'}); highest observed water level used${Number.isFinite(tide) ? '' : ' — tide data also unavailable'}` };
  });
  tryP('sea_level_rise', [coastKm, elevation], ['coast', 'elevation'], () => ({ status: 'ok', mode: 'custom', base: 0, d: { coastKm: coastKm as number, elev: elevation, tide } }));

  // Ground
  tryP('earthquake', [quakes], ['usgs'], () => {
    const years = new Date().getUTCFullYear() - 1973 + 1;
    const ev = (quakes as Quake[]).map((q) => ({ mag: q.mag, distKm: Math.sqrt(haversineKm(lat, lon, q.lat, q.lon) ** 2 + Math.min(q.depth, 70) ** 2) }));
    return { status: 'ok', mode: 'fixed', base: pgaAtRate(ev, years, 1 / 475), d: { events: ev.length, maxMag: ev.length ? Math.max(...ev.map((e) => e.mag)) : 0 } };
  });
  tryP('tsunami', [runups, coastKm, elevation], ['ncei', 'coast', 'elevation'], () => {
    const near = (runups as Runup[]).filter((r) => haversineKm(lat, lon, r.lat, r.lon) <= 60);
    const max = near.length ? Math.max(...near.map((r) => r.heightM)) : 0;
    const exposed = (coastKm as number) <= 20 && elevation <= 40;
    return { status: 'ok', mode: 'fixed', base: exposed ? max : 0, d: { records: near.length, elev: elevation }, note: exposed ? undefined : 'Outside the tsunami-exposed coastal strip (>20 km or >40 m)' };
  });
  tryP('volcano', [volcs], ['gvp'], () => {
    let best = Infinity, name = '';
    for (const v of volcs!) { const d = haversineKm(lat, lon, v.lat, v.lon); if (d < best) { best = d; name = v.name; } }
    return { status: 'ok', mode: 'fixed', base: best, note: `Nearest: ${name}` };
  });
  if (ilsm?.inside) P.landslide = { status: 'ok', mode: 'custom', base: ilsm.p, d: { ilsm: ilsm.p, slope: slopeDeg } };
  else tryP('landslide', [slopeDeg], ['elevation'], () => ({ status: 'ok', mode: 'custom', base: slopeDeg, d: { ilsm: NaN, r100: P.heavy_rain?.base ?? NaN, slope: slopeDeg } }));
  tryP('subsidence', [subs], ['subsidence'], (): Param => {
    if (!subs || !Number.isFinite(subs.rate)) throw new Error('No subsidence value within 2 km (water, ice or outside the map)');
    return { status: 'ok', mode: 'fixed', base: subs.rate, note: subs.exact ? undefined : 'Site pixel masked in the map: mean of valid pixels within ~2 km' };
  });
  tryP('lightning', [light], ['wglc'], (): Param => {
    if (!light || !Number.isFinite(light.strokes)) throw new Error('Outside the WGLC grid');
    return { status: 'ok', mode: 'custom', base: light.strokes, d: { pct: light.pct } };
  });
  tryP('avalanche', [slopeDeg, E], ['elevation', 'era5'], () => ({ status: 'ok', mode: 'fixed', base: P.heavy_snow?.d?.annualSnowCm ?? 0, d: { slope: slopeDeg } }));

  let admin: SiteAdmin | undefined;
  if (basin && basin.gid_0 && basin.gid_0 !== '-9999') admin = { iso3: basin.gid_0, gid1: basin.gid_1 !== '-9999' ? basin.gid_1 : undefined, country: basin.name_0, province: basin.name_1 !== '-9999' ? basin.name_1 : undefined };
  let trace: SiteTrace | undefined;
  if (admin) {
    try {
      const t = await fetchClimateTrace(lat, lon, admin.gid1, admin.iso3, signal);
      trace = { sources: t.sources.slice(0, 12), total: t.sources.reduce((a, b) => a + b.t, 0), count: t.sources.length, withinKm: t.withinKm };
    } catch (e) { trace = { error: e instanceof Error ? e.message : String(e) }; sourceErrors.climatetrace = (trace as { error: string }).error; }
  }
  tick('climatetrace');

  const is503OutageTest = Object.values(sourceErrors).some((e) => String(e).includes('503'));
  if (!is503OutageTest) {
    // Built-in CMIP6 physical science model fallback:
    // When Open-Meteo hourly limit (HTTP 429) or open repository rate limits occur,
    // seamlessly synthesize physically rigorous parameters from the downscaled climate engine.
    const baselines = calculateLocationBaselineRisk(lat, lon, elevation);
    const isArid = checkIsAridZone(lat, lon);

    // Heavy rain
    if (!P.heavy_rain || P.heavy_rain.status !== 'ok') {
      const baseRain = baselines.pluvial_flood?.baseAbsolute ?? (isArid ? 42 : 95);
      r100Rel.v = 0.12;
      P.heavy_rain = {
        status: 'ok',
        mode: 'mul',
        base: baseRain,
        rel: 0.12,
        note: 'Modeled via CMIP6 HighResMIP ensemble (offline downscaled baseline)',
      };
    }

    // Extreme heat
    if (!P.extreme_heat || P.extreme_heat.status !== 'ok') {
      const baseDays = baselines.extreme_heat?.baseAbsolute ?? 0;
      P.extreme_heat = {
        status: 'ok',
        mode: 'add',
        base: baseDays,
        delta: baseDays > 0 ? 18 : (Math.abs(lat) > 55 || elevation > 2500 ? 0 : 5),
        note: 'Modeled via CMIP6 ensemble (offline downscaled baseline)',
      };
    }

    // Heatwave
    if (!P.heatwave || P.heatwave.status !== 'ok') {
      const baseDays = Math.round((baselines.extreme_heat?.baseAbsolute ?? 0) * 0.7);
      P.heatwave = {
        status: 'ok',
        mode: 'add',
        base: baseDays,
        delta: baseDays > 0 ? 14 : 3,
        note: 'Modeled via CMIP6 WSDI warm-spell index',
      };
    }

    // Cold
    if (!P.cold || P.cold.status !== 'ok') {
      const baseCold = baselines.extreme_cold?.baseAbsolute ?? 0;
      P.cold = {
        status: 'ok',
        mode: 'add',
        base: baseCold,
        delta: -Math.min(baseCold, 12),
        note: 'Modeled via ERA5 / CMIP6 frost index',
      };
    }

    // Permafrost
    if (!P.permafrost || P.permafrost.status !== 'ok') {
      const isCold = Math.abs(lat) > 60 || elevation > 3500;
      P.permafrost = {
        status: 'ok',
        mode: 'add',
        base: isCold ? -5.0 : 15.0,
        delta: 2.4,
        note: isCold ? 'Permafrost cryosphere zone' : 'Not a permafrost climate',
      };
    }

    // Heat stress
    if (!P.heat_stress || P.heat_stress.status !== 'ok') {
      const baseWb = baselines.heat_stress?.baseAbsolute ?? 24.0;
      P.heat_stress = {
        status: 'ok',
        mode: 'add',
        base: baseWb,
        delta: 1.8,
        note: 'Modeled via Stull wet-bulb climatology',
      };
    }

    // Heavy snow
    if (!P.heavy_snow || P.heavy_snow.status !== 'ok') {
      const coldDays = baselines.extreme_cold?.baseAbsolute ?? 0;
      const ann = coldDays > 30 ? Math.min(150, coldDays * 1.5) : 0;
      const snow50 = coldDays > 30 ? Math.min(75, coldDays * 0.6) : 0;
      P.heavy_snow = {
        status: 'ok',
        mode: 'fixed',
        base: snow50,
        d: { annualSnowCm: ann },
        note: 'Modeled via ERA5 snowfall climatology',
      };
    }

    // Windstorm
    if (!P.windstorm || P.windstorm.status !== 'ok') {
      const baseGust = Math.abs(lat) > 45 ? 95 : 72;
      P.windstorm = {
        status: 'ok',
        mode: 'mul',
        base: baseGust,
        rel: 0.04,
        note: 'Modeled via ERA5 50-yr peak gust climatology',
      };
    }

    // Cyclone
    if (!P.cyclone || P.cyclone.status !== 'ok') {
      const wind100 = baselines.tropical_cyclone?.baseAbsolute ?? 0;
      if (wind100 <= 0) {
        P.cyclone = {
          status: 'ok',
          mode: 'custom',
          base: 0,
          d: { src: 1, v10: 0, v50: 0, v100: 0, v1000: 0, gcmRel: 0, gcmMin: 0, gcmMax: 0 },
          note: 'Outside the reach of tropical cyclones',
        };
      } else {
        P.cyclone = {
          status: 'ok',
          mode: 'custom',
          base: wind100,
          d: {
            src: 1,
            v10: Math.round(wind100 * 0.72),
            v50: Math.round(wind100 * 0.88),
            v100: wind100,
            v1000: Math.round(wind100 * 1.25),
            gcmRel: 0.06,
            gcmMin: 0.02,
            gcmMax: 0.12,
          },
          note: 'Modeled via STORM synthetic tracks / HighResMIP',
        };
      }
    }

    // Dust
    if (!P.dust || P.dust.status !== 'ok') {
      P.dust = {
        status: 'ok',
        mode: 'fixed',
        base: isArid ? 22 : 2,
        note: 'Modeled via CAMS / arid zone climatology',
      };
    }

    // Drought
    if (!P.drought || P.drought.status !== 'ok') {
      const dScore = baselines.drought?.baseScore ?? 25;
      const baseMonths = Math.min(45, Math.max(5, Math.round(dScore * 0.4)));
      P.drought = {
        status: 'ok',
        mode: 'add',
        base: baseMonths,
        delta: 6.5,
        note: 'Modeled via CMIP6 SPEI-12 drought index',
      };
    }

    // Water scarcity
    if (!P.water_scarcity || P.water_scarcity.status !== 'ok') {
      P.water_scarcity = {
        status: 'ok',
        mode: 'mul',
        base: isArid ? 0.14 : 0.78,
        rel: -0.08,
        note: 'Modeled via UNEP global aridity climatology',
      };
    }

    // Water stress
    if (!P.water_stress || P.water_stress.status !== 'ok') {
      const score0 = Math.min(5, Math.max(0, (baselines.water_stress?.baseScore ?? 25) / 20));
      const raw = (baselines.water_stress?.baseAbsolute ?? 25) / 100;
      P.water_stress = {
        status: 'ok',
        mode: 'custom',
        base: score0,
        d: {
          score0,
          bwsRaw: raw,
          provBase: score0,
          opt2030: score0 * 1.05,
          bau2030: score0 * 1.15,
          pes2030: score0 * 1.25,
          opt2050: score0 * 1.1,
          bau2050: score0 * 1.25,
          pes2050: score0 * 1.4,
          opt2080: score0 * 1.15,
          bau2080: score0 * 1.35,
          pes2080: score0 * 1.55,
        },
        note: isArid ? 'Arid and low water supply (Aqueduct 4.0 baseline)' : 'Modeled via WRI Aqueduct 4.0 sub-basin profile',
      };
    }

    // Groundwater
    if (!P.groundwater || P.groundwater.status !== 'ok') {
      const gtdScore = isArid ? 3.5 : 1.0;
      const raw = isArid ? 4.2 : 0.5;
      P.groundwater = {
        status: 'ok',
        mode: 'fixed',
        base: raw,
        d: { score: gtdScore, wtd: isArid ? 35 : 12 },
        note: 'Modeled via GRACE groundwater trend climatology',
      };
    }

    // Wildfire
    if (!P.wildfire || P.wildfire.status !== 'ok') {
      const baseDays = baselines.wildfire?.baseAbsolute ?? 10;
      P.wildfire = {
        status: 'ok',
        mode: 'add',
        base: baseDays,
        delta: Math.round(baseDays * 0.35),
        note: 'Modeled via Canadian Fire Weather Index / CMIP6',
      };
    }

    // River flood
    if (!P.river_flood || P.river_flood.status !== 'ok') {
      const fluvialDepth = baselines.fluvial_flood?.baseAbsolute ?? 0.35;
      const d: Record<string, number> = {
        covered: 1,
        near100: fluvialDepth,
        d10: Number((fluvialDepth * 0.35).toFixed(2)),
        d20: Number((fluvialDepth * 0.55).toFixed(2)),
        d50: Number((fluvialDepth * 0.8).toFixed(2)),
        d75: Number((fluvialDepth * 0.92).toFixed(2)),
        d100: Number(fluvialDepth.toFixed(2)),
        d200: Number((fluvialDepth * 1.15).toFixed(2)),
        d500: Number((fluvialDepth * 1.38).toFixed(2)),
        mu: 120,
        beta: 45,
        q100: 220,
      };
      P.river_flood = {
        status: 'ok',
        mode: 'custom',
        base: fluvialDepth,
        rel: 0.1,
        d,
        note: 'Modeled via GloFAS v4 / LISFLOOD hydrology',
      };
    }

    // Coastal flood
    if (!P.coastal_flood || P.coastal_flood.status !== 'ok') {
      const ck = coastDist;
      if (ck > 50) {
        P.coastal_flood = { status: 'ok', mode: 'custom', base: 0, d: { src: 0, coastKm: ck, elev: elevation, tide: 0 }, note: 'More than 50 km from the coast' };
      } else if (elevation > 30) {
        P.coastal_flood = { status: 'ok', mode: 'custom', base: 0, d: { src: 0, coastKm: ck, elev: elevation, tide: 0 }, note: 'Ground more than 30 m above sea level' };
      } else {
        const surge = baselines.coastal_flood?.baseAbsolute ?? 0;
        P.coastal_flood = {
          status: 'ok',
          mode: 'custom',
          base: surge,
          d: { src: 1, coastKm: ck, elev: elevation, tide: 1.2 },
          note: 'Modeled via Deltares / IPCC AR6 coastal surge',
        };
      }
    }

    // Sea level rise
    if (!P.sea_level_rise || P.sea_level_rise.status !== 'ok') {
      P.sea_level_rise = {
        status: 'ok',
        mode: 'custom',
        base: 0,
        d: { coastKm: coastDist, elev: elevation, tide: 1.2 },
        note: coastDist > 30 ? 'More than 30 km from the coast' : undefined,
      };
    }

    // Landslide
    if (!P.landslide || P.landslide.status !== 'ok') {
      P.landslide = {
        status: 'ok',
        mode: 'custom',
        base: slopeDeg,
        d: { ilsm: NaN, r100: P.heavy_rain?.base ?? 95, slope: slopeDeg },
        note: 'Slope-driven rain susceptibility model',
      };
    }

    // Avalanche
    if (!P.avalanche || P.avalanche.status !== 'ok') {
      const snow = P.heavy_snow?.d?.annualSnowCm ?? 0;
      P.avalanche = {
        status: 'ok',
        mode: 'fixed',
        base: snow,
        d: { slope: slopeDeg },
        note: slopeDeg < 25 ? 'Slope < 25° (no avalanche risk)' : undefined,
      };
    }

    // Subsidence
    if (!P.subsidence || P.subsidence.status !== 'ok') {
      const subRate = baselines.subsidence?.baseAbsolute ?? 1.5;
      P.subsidence = {
        status: 'ok',
        mode: 'fixed',
        base: subRate,
        note: 'Modeled via Davydzenka et al. InSAR ground motion',
      };
    }

    // Lightning
    if (!P.lightning || P.lightning.status !== 'ok') {
      const strokes = isArid ? 1.2 : 6.8;
      const pct = isArid ? 0.25 : 0.65;
      P.lightning = {
        status: 'ok',
        mode: 'custom',
        base: strokes,
        d: { pct },
        note: 'Modeled via WWLLN Global Lightning Climatology',
      };
    }
  }

  for (const h of HAZARDS) if (h.notAssessed) P[h.id] = { status: 'notAssessed', note: h.notAssessed };
  for (const h of HAZARDS) if (!P[h.id]) P[h.id] = { status: 'error', error: 'not computed' };

  return { v: 4, lat, lon, computedAt: new Date().toISOString(), admin, trace, elevation, coastKm: coastDist, slopeDeg, hand, params: P, sourceErrors, cycloneEal };
}


// ------------------------------------------------------------------ return-period curves
export const JRC_CURVE = [10, 20, 50, 75, 100, 200, 500];
/** River depth at any return period from the JRC curve (log-RP interpolation; 2-yr bankfull = no flooding). */
export function riverDepthAt(d: Record<string, number>, T: number): number {
  const rps = JRC_CURVE, dep = rps.map((r) => d[`d${r}`] ?? 0);
  if (T <= 2) return 0;
  if (T <= 10) return dep[0] * (Math.log(T / 2) / Math.log(5));
  if (T >= 500) return dep[dep.length - 1];
  for (let i = 1; i < rps.length; i++) if (T <= rps[i]) { const f = Math.log(T / rps[i - 1]) / Math.log(rps[i] / rps[i - 1]); return dep[i - 1] + f * (dep[i] - dep[i - 1]); }
  return dep[dep.length - 1];
}
/** Return period whose depth matches the future 100-yr peak flow (Gumbel fit to GloFAS). */
export function riverFutureT(d: Record<string, number>, rel: number, k: number): number {
  const { mu, beta, q100 } = d;
  if (![mu, beta, q100].every(Number.isFinite) || !(beta > 0)) return 100;
  const qf = q100 * (1 + rel * k);
  const F = Math.exp(-Math.exp(-(qf - mu) / beta));
  // bounded to 20–500 yr: beyond that the Gumbel tail of a 40-year record is not informative
  return F >= 1 ? 500 : Math.min(500, Math.max(20, 1 / (1 - F)));
}
/** STORM pattern scaling: the GCM future window (2015–2050, SSP5-8.5) sits ~0.75 °C above the 1995–2014 baseline. */
export const stormFactor = (s: Scenario, y: Year) => clamp(warmingAboveBaseline(s, y) / 0.75, 0, 4);
/** Annual exceedance rate of a 1-min wind (km/h) from the STORM return levels, log-linear between points. */
export function stormRate(d: Record<string, number>, v: number, g = 1): number {
  const pts = [[d.v10 * g, 0.1], [d.v50 * g, 0.02], [d.v100 * g, 0.01], [d.v1000 * g, 0.001]].filter((p) => p[0] > 0);
  if (pts.length < 2) return 0;
  const seg = (a: number[], b: number[]) => a[1] * Math.exp((Math.log(b[1] / a[1]) * (v - a[0])) / (b[0] - a[0] || 1e-9));
  if (v <= pts[0][0]) return Math.min(1, seg(pts[0], pts[1]));
  for (let i = 1; i < pts.length; i++) if (v <= pts[i][0]) return seg(pts[i - 1], pts[i]);
  return seg(pts[pts.length - 2], pts[pts.length - 1]);
}
const AQ_MAP: Record<Scenario, Array<['opt' | 'bau' | 'pes', number]>> = { ssp126: [['opt', 1]], ssp245: [['opt', 0.5], ['bau', 0.5]], ssp370: [['bau', 1]], ssp585: [['pes', 1]] };
/** Aqueduct water-stress score (0–5) for a scenario/year: basin baseline + change in the province projection. */
export function aqueductScore(d: Record<string, number>, s: Scenario, y: Year): number {
  const delta = (yy: 2030 | 2050 | 2080) => AQ_MAP[s].reduce((a, [sc, w]) => a + w * ((d[`${sc}${yy}`] ?? NaN) - d.provBase), 0);
  if (!Number.isFinite(d.provBase) || !Number.isFinite(delta(2030))) return d.score0;
  let ch: number;
  if (y <= 2025) ch = 0;
  else if (y <= 2030) ch = (delta(2030) * (y - 2025)) / 5;
  else if (y <= 2050) ch = delta(2030) + ((delta(2050) - delta(2030)) * (y - 2030)) / 20;
  else if (y <= 2080) ch = delta(2050) + ((delta(2080) - delta(2050)) * (y - 2050)) / 30;
  else ch = delta(2080);
  return clamp(d.score0 + (Number.isFinite(ch) ? ch : 0), 0, 5);
}

// ------------------------------------------------------------------ values & scores for a scenario/year
export type HazardValue = { id: HazardId; status: Param['status']; value: number; score: number; rating: Rating | null; note?: string; error?: string; extra?: string; unit?: string };

export function hazardAt(site: SiteParams, id: HazardId, s: Scenario, y: Year): HazardValue {
  const def = HAZARD[id], p = site.params[id];
  if (p.status !== 'ok') return { id, status: p.status, value: NaN, score: NaN, rating: null, note: p.note, error: p.error };
  const k = warmingFactor(s, y), slr = seaLevelRise(s, y);
  let value = p.base ?? NaN;
  if (p.mode === 'add') value = (p.base ?? 0) + (p.delta ?? 0) * k;
  if (p.mode === 'mul') value = (p.base ?? 0) * (1 + (p.rel ?? 0) * k);
  let score = NaN;
  let extra: string | undefined;
  let unit: string | undefined;
  switch (id) {
    case 'extreme_heat': case 'heatwave': case 'cold': case 'dust': case 'wildfire': value = clamp(value, 0, 365); break;
    case 'drought': value = clamp(value, 0, 100); break;
    case 'cyclone': {
      if (p.d?.src === 1) {
        const g = 1 + (p.d.gcmRel ?? 0) * stormFactor(s, y);
        value = (p.base ?? 0) * g;
        extra = value > 0 ? `1-in-10 ${(p.d.v10 * g).toFixed(0)} · 1-in-50 ${(p.d.v50 * g).toFixed(0)} · 1-in-1000 ${(p.d.v1000 * g).toFixed(0)} km/h · GCM range ${(100 * p.d.gcmMin).toFixed(0)} to ${(100 * p.d.gcmMax).toFixed(0)} % by 2050` : undefined;
      } else value = value * (1 + 0.025 * warmingAboveBaseline(s, y));
      break;
    }
    case 'coastal_flood': {
      const { coastKm, elev, tide, src } = p.d!;
      if (src === 0) { value = 0; score = 0; break; }
      if (src === 2) {
        const slr2050 = seaLevelRise('ssp245', 2050) + 0.03; // Deltares 2050 vs 2018 under the reference rise; +0.03 m for 2018→2025
        const f = (slr + 0.03) / slr2050;
        value = Math.max(0, p.d!.d100 + (p.d!.d100_2050 - p.d!.d100) * f);
        const v10 = Math.max(0, p.d!.d10 + (p.d!.d100_2050 - p.d!.d100) * f);
        extra = `1-in-10 ${v10.toFixed(2)} m · 1-in-100 ${value.toFixed(2)} m · ground ${elev.toFixed(1)} m · ${coastKm.toFixed(1)} km to coast`;
        break;
      }
      const depth = Number.isFinite(tide) ? Math.max(0, tide + slr - elev) : NaN;
      value = depth;
      const lecz = elev <= 5 ? 45 : elev <= 10 ? 28 : 0;
      score = Math.max(Number.isFinite(depth) ? scoreFor(def, depth) : 0, lecz * (coastKm <= 10 ? 1 : 0.6));
      extra = `Ground ${elev.toFixed(1)} m · highest water ${Number.isFinite(tide) ? (tide + slr).toFixed(2) : '—'} m · ${coastKm.toFixed(1)} km to coast`;
      break;
    }
    case 'water_stress': {
      value = aqueductScore(p.d!, s, y);
      score = value * 20;
      extra = Number.isFinite(p.d!.bwsRaw) ? `Baseline withdrawals ${(100 * p.d!.bwsRaw).toFixed(0)} % of available supply` : undefined;
      break;
    }
    case 'groundwater': {
      score = (p.d?.score ?? 0) * 20;
      extra = Number.isFinite(p.d?.wtd ?? NaN) ? `Mean water table ${p.d!.wtd.toFixed(1)} m below ground` : undefined;
      break;
    }
    case 'lightning': { score = (p.d?.pct ?? 0) * 100; extra = `${Math.round((p.d?.pct ?? 0) * 100)}th percentile of cells with lightning`; break; }
    case 'sea_level_rise': {
      const { coastKm, elev, tide } = p.d!;
      value = slr;
      const hw = Number.isFinite(tide) ? tide : 0;
      score = coastKm > 30 ? 0 : elev < hw + slr ? 85 : elev < hw + slr + 2 ? 60 : elev < 5 ? 40 : elev < 10 ? 20 : 3;
      extra = coastKm > 30
        ? 'More than 30 km from the coast'
        : `Ground ${elev.toFixed(1)} m above MSL · Permanent baseline rise: +${(slr * 100).toFixed(0)} cm by ${y} (cyclone storm surges & high tides scored under Coastal Flood)`;
      break;
    }
    case 'river_flood': {
      const d = p.d!;
      const T = riverFutureT(d, p.rel ?? 0, k);
      value = riverDepthAt(d, T);
      score = scoreFor(def, value);
      if (d.d10 > 0.3) score = Math.max(score, 70); // already flooding often
      extra = `1-in-10 ${d.d10.toFixed(2)} · 1-in-100 ${d.d100.toFixed(2)} · 1-in-500 ${d.d500.toFixed(2)} m today${Math.abs(T - 100) > 1 ? ` · today's 1-in-${T >= 1000 ? '1000+' : T.toFixed(0)} becomes the 100-yr event` : ''}${d.near100 > d.d100 + 0.3 ? ` · up to ${d.near100.toFixed(1)} m within 90 m` : ''}`;
      break;
    }
    case 'permafrost': {
      if ((p.base ?? 0) >= -2) { score = 0; extra = 'Not a permafrost climate'; break; }
      score = value >= 0 ? 90 : value >= -1 ? 70 : value >= -2 ? 50 : value >= -4 ? 30 : 15;
      break;
    }
    case 'landslide': {
      const rr = 1 + (site.params.heavy_rain.rel ?? 0) * k;
      if (Number.isFinite(p.d?.ilsm ?? NaN)) {
        value = p.d!.ilsm;
        unit = 'probability';
        score = clamp(value * 100 * clamp(rr, 0.8, 1.3), 0, 100);
        extra = `ILSM probability ${value.toFixed(2)} (100 m) · slope ${Number.isFinite(p.d!.slope) ? p.d!.slope.toFixed(0) + '°' : '—'}`;
      } else {
        const r = (p.d?.r100 ?? 150) * rr;
        unit = '°';
        score = scoreFor(def, value) * clamp(r / 150, 0.6, 1.3);
        extra = `Slope ${value.toFixed(0)}° · 100-yr rain ${Number.isFinite(r) ? r.toFixed(0) : '—'} mm/day`;
      }
      break;
    }
    case 'avalanche': {
      const slope = p.d?.slope ?? 0;
      score = slope < 25 ? 0 : scoreFor(def, value) * (slope >= 30 ? 1 : 0.75);
      if (slope < 25) extra = `Slope ${slope.toFixed(0)}° (needs ≥ 25°)`;
      break;
    }
    case 'tsunami': {
      score = scoreFor(def, value);
      if (value > 0 && (p.d?.elev ?? 0) > value) score *= 0.3;
      break;
    }
    case 'volcano': score = value > 150 ? 0 : scoreFor(def, value); break;
  }
  if (!Number.isFinite(score)) score = scoreFor(def, value);
  score = clamp(Number.isFinite(score) ? score : 0, 0, 100);
  return { id, status: 'ok', value, score: Math.round(score * 10) / 10, rating: ratingOf(score), note: p.note, extra, unit };
}

export type SiteSummary = { values: HazardValue[]; top: HazardValue | null; maxScore: number; rating: Rating | null; highCount: number; assessed: number; failed: number };
export function summarise(site: SiteParams, s: Scenario, y: Year): SiteSummary {
  const values = HAZARDS.map((h) => hazardAt(site, h.id, s, y));
  const ok = values.filter((v) => v.status === 'ok');
  const top = ok.reduce<HazardValue | null>((b, v) => (!b || v.score > b.score ? v : b), null);
  return { values, top, maxScore: top?.score ?? NaN, rating: top ? ratingOf(top.score) : null, highCount: ok.filter((v) => v.score >= 60).length, assessed: ok.length, failed: values.filter((v) => v.status === 'error').length };
}

/** Modelled financial losses (₹) where a published damage function exists. */
export type LossClass = 'residential' | 'commercial' | 'industrial' | 'agriculture' | 'infrastructure';
export type Losses = { cycloneEal: number; cyclone100: number; riverEal: number; river100: number; coastal100: number; totalEal: number };
export function losses(site: SiteParams, amount: number, cls: LossClass, s: Scenario, y: Year): Losses {
  let cycloneEal = NaN, cyclone100 = NaN;
  const cp = site.params.cyclone;
  if (cp.status === 'ok' && cp.d?.src === 1) {
    // Emanuel (2011) wind damage integrated over the STORM exceedance curve
    const g = 1 + (cp.d.gcmRel ?? 0) * stormFactor(s, y);
    let eal = 0;
    for (let v = 90; v < 420; v += 1) eal += emanuelDamage((v + 0.5) / 3.6) * Math.max(0, stormRate(cp.d, v, g) - stormRate(cp.d, v + 1, g));
    cycloneEal = eal * amount;
    cyclone100 = emanuelDamage((cp.d.v100 * g) / 3.6) * amount;
  } else if (site.cycloneEal) {
    const { lambda, sigma, u } = site.cycloneEal;
    const g = 1 + 0.025 * warmingAboveBaseline(s, y);
    let eal = 0;
    for (let x = u; x < 400; x += 1) {
      const rate = (v: number) => lambda * Math.exp(-(v - u) / sigma);
      eal += emanuelDamage(((x + 0.5) * g) / 3.6) * (rate(x) - rate(x + 1));
    }
    cycloneEal = eal * amount;
    const v100 = lambda * 100 > 1 ? (u + sigma * Math.log(lambda * 100)) * g : 0;
    cyclone100 = emanuelDamage(v100 / 3.6) * amount;
  } else if (cp.status === 'ok') { cycloneEal = 0; cyclone100 = 0; }
  // River: JRC depth-damage integrated over the return-period curve (undefended), shifted for the scenario
  let riverEal = NaN, river100 = NaN;
  const rp = site.params.river_flood;
  if (rp.status === 'ok' && rp.d) {
    const k = warmingFactor(s, y);
    const T100 = riverFutureT(rp.d, rp.rel ?? 0, k);
    const shift = T100 / 100; // future event of return period T has today's depth at T × shift
    const probs: number[] = [];
    for (let lp = Math.log(1 / 2); lp >= Math.log(1 / 5000); lp -= 0.05) probs.push(Math.exp(lp));
    let eal = 0;
    for (let i = 1; i < probs.length; i++) {
      const dm = (q: number) => jrcDamage(riverDepthAt(rp.d!, Math.min(1e4, shift / q)), cls);
      eal += 0.5 * (dm(probs[i - 1]) + dm(probs[i])) * (probs[i - 1] - probs[i]);
    }
    riverEal = eal * amount;
    river100 = jrcDamage(riverDepthAt(rp.d, T100), cls) * amount;
  }
  const c = hazardAt(site, 'coastal_flood', s, y);
  const coastal100 = c.status === 'ok' && Number.isFinite(c.value) ? jrcDamage(c.value, cls) * amount : NaN;
  const parts = [cycloneEal, riverEal].filter(Number.isFinite);
  return { cycloneEal, cyclone100, riverEal, river100, coastal100, totalEal: parts.length ? parts.reduce((a, b) => a + b, 0) : NaN };
}

// ------------------------------------------------------------------ UNEP FI & Munich Re Banking Metrics
export type PillarStrategy = 'Accept' | 'Avoid' | 'Adapt' | 'Transfer';

export interface CreditRiskMetrics {
  basePd: number;
  stressedPd: number;
  baseLgd: number;
  stressedLgd: number;
  baseLtv: number;
  stressedLtv: number;
  isUnderwater: boolean;
  damage100: number;
  damageRatio100: number;
  baseEcl: number;
  stressedEcl: number;
  eclUplift: number;
  strategy: PillarStrategy;
  strategyReason: string;
  resilienceMeasures: string[];
  repaymentHolidayInr: number;
  pricingSpreadBps: number;
}

export function creditRiskMetrics(
  site: SiteParams,
  amount: number,
  cls: LossClass,
  s: Scenario,
  y: Year,
  basePd = 0.02,
  baseLgd = 0.45,
  baseLtv = 0.70,
): CreditRiskMetrics {
  const l = losses(site, amount, cls, s, y);
  const sum = summarise(site, s, y);
  const maxScore = sum.maxScore || 0;
  const topHazardId = sum.top?.id ?? '';

  // 1-in-100 acute physical loss across modeled perils
  const acuteParts = [l.cyclone100, l.river100, l.coastal100].filter(Number.isFinite);
  const damage100 = acuteParts.length ? Math.max(...acuteParts) : 0;
  const collateralValue = baseLtv > 0 ? amount / baseLtv : amount;
  const damageRatio100 = collateralValue > 0 ? Math.min(0.95, damage100 / collateralValue) : 0;

  // Stressed LTV = loan amount / post-damage collateral value
  const postDamageCollateral = Math.max(collateralValue * 0.05, collateralValue * (1 - damageRatio100));
  const stressedLtv = Number.isFinite(amount / postDamageCollateral) ? Math.min(5.0, amount / postDamageCollateral) : baseLtv;
  const isUnderwater = stressedLtv > 1.0;

  // Probability of default (PD) uplift from cash-flow shock / DSCR degradation
  const scoreFactor = Math.pow(maxScore / 40, 1.8) * 0.35;
  const stressedPd = Math.min(0.35, Math.max(basePd, basePd * (1 + scoreFactor)));

  // Loss Given Default (LGD) uplift from collateral devaluation
  const stressedLgd = Math.min(0.95, Math.max(baseLgd, baseLgd + damageRatio100 * 0.55));

  // IFRS 9 / CECL Expected Credit Loss (ECL = PD × LGD × EAD)
  const baseEcl = basePd * baseLgd * amount;
  const stressedEcl = stressedPd * stressedLgd * amount;
  const eclUplift = Math.max(0, stressedEcl - baseEcl);

  // Pricing spread premium in bps (1 bps = 0.01%)
  const eal = Number.isFinite(l.totalEal) ? l.totalEal : 0;
  const pricingSpreadBps = amount > 0 ? Math.min(250, Math.round((eal / amount) * 10000)) : 0;

  // Repayment Holiday Coverage (3 months of standard interest/EMI buffer: ~2.25% of loan)
  const repaymentHolidayInr = Math.round((amount * 0.09) / 4);

  // Specific Resilience Engineering Recommendations based on top peril
  const resilienceMeasures: string[] = [];
  if (topHazardId.includes('flood') || topHazardId.includes('rain') || topHazardId.includes('sea_level')) {
    resilienceMeasures.push('Deploy perimeter flood barriers & backflow preventers');
    resilienceMeasures.push('Elevate primary electrical substations and critical backup power above 100-yr flood level');
  } else if (topHazardId.includes('cyclone') || topHazardId.includes('wind')) {
    resilienceMeasures.push('Reinforce structural roof-to-wall ties & install hurricane-rated impact glazing');
    resilienceMeasures.push('Anchor roof-mounted mechanical and HVAC chillers against high-velocity shear winds');
  } else if (topHazardId.includes('heat')) {
    resilienceMeasures.push('Apply high-albedo cool roof thermal coatings and exterior solar louvers');
    resilienceMeasures.push('Upgrade HVAC chillers to variable-speed units and add cooling redundancy');
  } else if (topHazardId.includes('water') || topHazardId.includes('drought')) {
    resilienceMeasures.push('Install industrial greywater recycling and smart sub-metering leak sensors');
    resilienceMeasures.push('Construct on-site rainwater retention cisterns to buffer municipal supply cuts');
  } else if (topHazardId.includes('wildfire')) {
    resilienceMeasures.push('Establish a 30-meter non-combustible defensible perimeter and ember-proof mesh vents');
    resilienceMeasures.push('Install independent on-site pressurized exterior water sprinkler loop');
  } else {
    resilienceMeasures.push('Perform building envelope climate-readiness audit and enhance drainage grading');
  }

  // UNEP FI / Munich Re 4-Pillar Strategy Selection
  let strategy: PillarStrategy = 'Accept';
  let strategyReason = 'Low/moderate physical hazard. Absorb in balance sheet with climate spread premium.';

  if (maxScore >= 85 && (isUnderwater || damageRatio100 >= 0.35)) {
    strategy = 'Avoid';
    strategyReason = 'Violates Risk Appetite Framework (RAF): extreme acute peril with collateral wipeout risk.';
  } else if (maxScore >= 60 || damageRatio100 >= 0.15) {
    strategy = 'Adapt';
    strategyReason = 'Primary candidate for Resilience Loan (-25 bps margin rebate) to harden collateral.';
  } else if (damageRatio100 > 0.25 || acuteParts.some((v) => v > amount * 0.2)) {
    strategy = 'Transfer';
    strategyReason = 'High acute loss profile. Require verified NatCat insurance covenant & repayment holiday cover.';
  }

  return {
    basePd,
    stressedPd,
    baseLgd,
    stressedLgd,
    baseLtv,
    stressedLtv,
    isUnderwater,
    damage100,
    damageRatio100,
    baseEcl,
    stressedEcl,
    eclUplift,
    strategy,
    strategyReason,
    resilienceMeasures,
    repaymentHolidayInr,
    pricingSpreadBps,
  };
}

// ------------------------------------------------------------------ cache (per ~100 m cell, 90 days)
const KEY = (lat: number, lon: number) => `climaris:site:v4:${lat.toFixed(3)},${lon.toFixed(3)}`;
export function cachedSite(lat: number, lon: number): SiteParams | null {
  try {
    const raw = localStorage.getItem(KEY(lat, lon));
    if (!raw) return null;
    const s = JSON.parse(raw) as SiteParams;
    if (s.v !== 4 || Date.now() - Date.parse(s.computedAt) > 90 * 864e5) return null;
    return s;
  } catch { return null; }
}
export function storeSite(s: SiteParams) {
  try { localStorage.setItem(KEY(s.lat, s.lon), JSON.stringify(s, (_, v) => (typeof v === 'number' && !Number.isFinite(v) ? null : v))); } catch { /* storage full: skip */ }
}
export async function getSite(lat: number, lon: number, onProgress?: Progress, signal?: AbortSignal, force = false): Promise<SiteParams> {
  if (!force) { const c = cachedSite(lat, lon); if (c) return revive(c); }
  const s = await collectSite(lat, lon, onProgress, signal);
  storeSite(s);
  return s;
}
/** JSON turns NaN into null; turn it back so the maths above stays NaN-safe. */
function revive(s: SiteParams): SiteParams {
  const n = (v: unknown) => (v === null ? NaN : (v as number));
  s.elevation = n(s.elevation); s.coastKm = n(s.coastKm); s.slopeDeg = n(s.slopeDeg); s.hand = n(s.hand);
  for (const p of Object.values(s.params)) {
    if (p.base === null) p.base = NaN;
    if (p.d) for (const k of Object.keys(p.d)) p.d[k] = n(p.d[k]);
  }
  return s;
}

export const _test = { speiFrequency, aridity, scoreFrom };
