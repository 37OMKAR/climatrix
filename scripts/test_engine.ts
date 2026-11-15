// CLIMARIS engine tests: published-method reference values + full pipeline with mocked open-data responses.
import { readFileSync } from 'node:fs';
import { gumbelFit, gumbelReturnLevel, scoreFrom } from '../src/lib/stats';
import { wetBulbStull, campbellPga, pgaAtRate, emanuelDamage, jrcDamage, hornSlope, fireWeatherIndex, petHargreaves } from '../src/engine/methods';
import { collectSite, hazardAt, summarise, losses } from '../src/engine/assess';
import { warmingFactor, seaLevelRise, yearForMaturity, HAZARDS } from '../src/engine/hazards';
import { parseInr } from '../src/lib/format';
import { rowsToLoans, autoMap } from '../src/engine/portfolio';

let pass = 0, fail = 0;
const check = (n: string, ok: boolean, info = '') => { if (ok) pass++; else { fail++; console.log('FAIL', n, info); } };
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

// --- reference values from the original papers
check('Stull: 20°C/50% → 13.7°C', near(wetBulbStull(20, 50), 13.7, 0.1), String(wetBulbStull(20, 50)));
check('Stull: 35°C/40% → ~24.5°C', near(wetBulbStull(35, 40), 24.5, 0.6), String(wetBulbStull(35, 40)));
check('Campbell: M7 at 20 km ≈ 0.2–0.4 g', campbellPga(7, 20) > 0.2 && campbellPga(7, 20) < 0.45, String(campbellPga(7, 20)));
check('Campbell decreases with distance', campbellPga(6, 100) < campbellPga(6, 20));
check('Emanuel: 0 below 25.7 m/s, 0.5 at 74.7', emanuelDamage(20) === 0 && near(emanuelDamage(74.7), 0.5, 1e-9));
check('JRC: 0 at 0 m, 1 at ≥6 m, monotonic', jrcDamage(0, 'residential') === 0 && jrcDamage(7, 'residential') === 1 && jrcDamage(1, 'residential') > jrcDamage(0.5, 'residential'));
check('Horn slope: flat = 0°', hornSlope([5, 5, 5, 5, 5, 5, 5, 5, 5], 90, 90) === 0);
check('Horn slope: 45° plane', near(hornSlope([0, 0, 0, 90, 90, 90, 180, 180, 180].reverse(), 90, 90), 45, 0.1), String(hornSlope([180, 180, 180, 90, 90, 90, 0, 0, 0], 90, 90)));
check('Hargreaves PET in tropics 3–7 mm/day', petHargreaves(32, 24, 19, 120) > 3 && petHargreaves(32, 24, 19, 120) < 7, String(petHargreaves(32, 24, 19, 120)));
const fwiHot = fireWeatherIndex(Array.from({ length: 60 }, () => ({ t: 38, rh: 12, ws: 25, rain: 0, month: 7 })), 38);
const fwiWet = fireWeatherIndex(Array.from({ length: 60 }, () => ({ t: 18, rh: 90, ws: 5, rain: 8, month: 7 })), 38);
check('FWI: hot dry windy spell > 38', fwiHot[59] > 38, String(fwiHot[59]));
check('FWI: wet spell < 5', fwiWet[59] < 5, String(fwiWet[59]));
// Gumbel recovers known parameters
const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const sample = Array.from({ length: 2000 }, () => 100 - 20 * Math.log(-Math.log(rnd())));
const g = gumbelFit(sample)!;
check('Gumbel L-moments recovers u=100, a=20', near(g.u, 100, 2) && near(g.a, 20, 1.5), JSON.stringify(g));
check('Gumbel 100-yr level ≈ 192', near(gumbelReturnLevel(g, 100), 192, 6));
// PSHA sanity: one M7 at 20 km per 50 yrs → 475-yr PGA should be meaningful; nothing → 0
check('PSHA: empty catalogue → 0', pgaAtRate([], 50, 1 / 475) === 0);
const p = pgaAtRate([{ mag: 7, distKm: 20 }, { mag: 6, distKm: 40 }, { mag: 5, distKm: 30 }], 50, 1 / 475);
check('PSHA: active catalogue gives 0.1–1 g', p > 0.1 && p < 1, String(p));
check('Score interpolation', scoreFrom(30, [10, 30, 60, 100]) === 40 && scoreFrom(0.35, [0.65, 0.5, 0.2, 0.05], true) === 50);
check('Scenarios: factor 0 baseline→≥0, SSP585 2090 > SSP126 2090', warmingFactor('ssp585', 2090) > warmingFactor('ssp126', 2090) && warmingFactor('ssp245', 2025) > 0);
check('SLR AR6: 0 in 2025, 0.52 m SSP5-8.5 2090', seaLevelRise('ssp585', 2025) === 0 && seaLevelRise('ssp585', 2090) === 0.52);
check('Maturity 2031 → 2040, 2026 → 2030, 2200 → 2090', yearForMaturity(2031) === 2040 && yearForMaturity(2026) === 2030 && yearForMaturity(2200) === 2090);
check('₹ parsing', parseInr('2.5 cr') === 2.5e7 && parseInr('40 lakh') === 4e6 && parseInr('₹1,20,00,000') === 1.2e7 && Number.isNaN(parseInr('abc')) && Number.isNaN(parseInr('-5')));
const loans = rowsToLoans([{ 'Borrower Name': 'A', 'Loan No': 'L1', District: 'Pune', State: 'Maharashtra', 'Sanctioned Amt': '3 cr', Tenure: '84' }, { 'Borrower Name': 'B', 'Loan No': 'L2', District: '', State: '', 'Sanctioned Amt': 'x', Tenure: '' }],
  autoMap(['Borrower Name', 'Loan No', 'District', 'State', 'Sanctioned Amt', 'Tenure']), 2025);
check('CSV: auto-map + parse', loans[0].amount === 3e7 && loans[0].maturityYear === 2032 && loans[0].geo.status === 'pending' && loans[0].issues.length === 0);
check('CSV: bad row flagged, not filled', Number.isNaN(loans[1].amount) && loans[1].issues.length === 3 && loans[1].geo.status === 'failed');

// --- full pipeline with mocked responses (synthetic but physically shaped: hot humid monsoon coast)
const days = (y0: number, y1: number) => { const t: string[] = []; for (let y = y0; y <= y1; y++) for (let d = 0; d < 365; d++) t.push(new Date(Date.UTC(y, 0, 1 + d)).toISOString().slice(0, 10)); return t; };
const season = (t: string) => Math.sin(((+t.slice(5, 7) - 3) / 12) * 2 * Math.PI);
const R = (seed: number) => { let s = seed; return () => ((s = (s * 48271) % 2147483647) / 2147483647); };
function daily(time: string[], warmFrom = 9999, warm = 0, seed = 1) {
  const r = R(seed);
  const w = (t: string) => (+t.slice(0, 4) >= warmFrom ? warm : 0);
  return {
    tmax: time.map((t) => 31 + 3.5 * season(t) + w(t) + (r() - 0.5) * 3),
    tmin: time.map((t) => 23 + 3 * season(t) + w(t) + (r() - 0.5) * 2),
    pr: time.map((t) => (+t.slice(5, 7) >= 6 && +t.slice(5, 7) <= 9 ? (r() < 0.6 ? -Math.log(r()) * 25 : 0) : r() < 0.05 ? r() * 5 : 0)),
    gust: time.map(() => 30 + -Math.log(-Math.log(r())) * 10),
    rh: time.map((t) => 55 + 25 * season(t) + (r() - 0.5) * 10),
    ws: time.map(() => 12 + r() * 8),
    sm: time.map(() => 0.3 + r() * 0.05),
  };
}
const e5t = days(1981, 2024), e5 = daily(e5t, 9999, 0, 3);
const cmt = days(1995, 2049);
const mk = (seed: number) => daily(cmt, 2036, 1.4, seed);
const m1 = mk(5), m2 = mk(9);
const coast = readFileSync(new URL('../public/data/coastline.dat', import.meta.url));
const volc = readFileSync(new URL('../public/data/volcanoes.json', import.meta.url), 'utf8');
const calls: string[] = [];
const FX = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url));
const ranged = (buf: Uint8Array, init?: RequestInit) => {
  const h = init?.headers as Record<string, string> | undefined;
  const m = h?.Range?.match(/bytes=(\d+)-(\d+)/);
  if (!m) return new Response(buf as BodyInit);
  const a = +m[1], b = Math.min(+m[2], buf.length - 1);
  return new Response(buf.subarray(a, b + 1) as BodyInit, { status: 206 });
};
const STORM_OFF: Record<number, string> = { 459887533: 'constant_10', 479090490: 'constant_50', 512353247: 'constant_100', 584941669: 'constant_1000', 57437673: 'CMCC-CM2-VHR4_100', 287382227: 'CNRM-CM6-1-HR_100', 737573889: 'EC-Earth3P-HR_100', 969917935: 'HadGEM3-GC31-HM_100' };
globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
  const u = String(input); calls.push(u.split('?')[0]);
  const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json' } });
  if (u.includes('jrc-glofas/depth-rp')) return ranged(FX(`jrc_rp${u.match(/depth-rp(\d+)/)![1]}.tif`), init);
  if (u.includes('10223637/files/ds03.tif')) return ranged(FX('subsidence.tif'), init);
  if (u.includes('7538161/files/')) return ranged(FX('wtd.tif'), init);
  if (u.includes('10085272/files/probability.tif')) return ranged(FX('ilsm.tif'), init);
  if (u.includes('20277101/files/')) return new Response(FX('wglc.nc') as BodyInit);
  if (u.includes('STORM_FIXED_RETURN_PERIODS.zip')) {
    const a = +(init?.headers as Record<string, string>).Range.match(/bytes=(\d+)-/)![1];
    if (STORM_OFF[a]) return new Response(new Uint8Array(30) as BodyInit, { status: 206 }); // local header, no name / extra field
    if (STORM_OFF[a - 30]) return new Response(FX(`storm_${STORM_OFF[a - 30]}.deflate`) as BodyInit, { status: 206 });
    return new Response('bad range', { status: 416 });
  }
  if (u.includes('api/sas/v1/token/deltaresfloodssa')) return json({ token: 'se=x&sig=y', 'msft:expiry': new Date(Date.now() + 3600e3).toISOString() });
  if (u.includes('floods/references/NASADEM-90m-')) {
    const item = u.match(/NASADEM-90m-(\d{4}-\d{4})/)![1];
    return json({ version: 1, templates: { u: `abfs://floods@deltaresfloodssa.blob.core.windows.net/test/${item}.nc` }, refs: { 'inun/.zarray': '{}', 'inun/0.218.505': ['{{u}}', 0, FX(`deltares_${item}.chunk`).length] } });
  }
  if (u.includes('deltaresfloodssa.blob.core.windows.net/floods/test/')) return ranged(FX(`deltares_${u.match(/test\/(\d{4}-\d{4})/)![1]}.chunk`), init);
  if (u.includes('wri-rw.carto.com')) {
    const q = decodeURIComponent(u);
    if (q.includes('water_risk_indicators_annual')) return json({ rows: [{ gid_0: 'IND', gid_1: 'IND.20_1', name_0: 'India', name_1: 'Maharashtra', pfaf_id: 454035, bws_raw: 0.35, bws_score: 2.75, bws_label: 'Medium - High (20-40%)', bwd_raw: 0.1, bwd_score: 1.5, iav_score: 1, sev_score: 2, gtd_raw: 3.1, gtd_score: 2.5, gtd_label: 'Medium - High (2-4 cm/y)', rfr_raw: 0.03, rfr_score: 3, cfr_raw: 0.0003, cfr_score: 2.5, drr_score: 3.6, drr_label: 'High' }] });
    if (q.includes('province_future_2023')) return json({ rows: ['opt', 'bau', 'pes'].flatMap((sc, i) => [2030, 2050, 2080].map((p, j) => ({ scenario: sc, period: p, score: 3.8 + 0.1 * (i + 1) * (j + 1) }))) });
    if (q.includes('province_v03')) return json({ rows: [{ score: 3.8 }] });
  }
  if (u.includes('api.climatetrace.org')) return json([{ name: 'Trombay power', sector: 'power', subsector: 'electricity-generation', emissionsQuantity: 5.2e6, centroid: { latitude: 19.0, longitude: 72.9 } }, { name: 'Far plant', sector: 'manufacturing', subsector: 'cement', emissionsQuantity: 9e6, centroid: { latitude: 21.0, longitude: 79.0 } }]);
  if (u.includes('coastline.dat')) return new Response(coast);
  if (u.includes('volcanoes.json')) return new Response(volc);
  if (u.includes('/elevation')) { const n = new URL(u).searchParams.get('latitude')!.split(',').length; return json({ elevation: Array.from({ length: n }, (_, i) => (i === 4 ? 6 : i < 9 ? 6 + (i % 3) : 2 + i * 0.2)) }); }
  if (u.includes('archive-api')) return json({ daily: { time: e5t, temperature_2m_max: e5.tmax, temperature_2m_min: e5.tmin, precipitation_sum: e5.pr, wind_gusts_10m_max: e5.gust, snowfall_sum: e5t.map(() => 0) } });
  if (u.includes('climate-api')) {
    const d: Record<string, unknown> = { time: cmt };
    for (const [m, s] of [['EC_Earth3P_HR', m1], ['MRI_AGCM3_2_S', m2]] as const) {
      Object.assign(d, { [`temperature_2m_max_${m}`]: s.tmax, [`temperature_2m_min_${m}`]: s.tmin, [`precipitation_sum_${m}`]: s.pr.map((x) => x * 1.05), [`relative_humidity_2m_min_${m}`]: s.rh, [`relative_humidity_2m_mean_${m}`]: s.rh.map((x) => x + 15), [`wind_speed_10m_mean_${m}`]: s.ws, [`wind_speed_10m_max_${m}`]: s.ws.map((x) => x * 1.8), [`soil_moisture_0_to_10cm_mean_${m}`]: s.sm });
    }
    return json({ daily: d });
  }
  if (u.includes('flood-api')) { const t = days(1984, 2024); const r = R(11); return json({ daily: { time: t, river_discharge: t.map((x) => 40 + 300 * Math.max(0, season(x)) * r()) } }); }
  if (u.includes('marine-api')) return json({ hourly: { time: ['2022-01-01T00:00', '2022-01-01T01:00'], sea_level_height_msl: [1.9, 2.3] } });
  if (u.includes('air-quality')) { const t = days(2023, 2024).flatMap((d) => [`${d}T00:00`, `${d}T12:00`]); return json({ hourly: { time: t, dust: t.map((_, i) => (i % 40 === 0 ? 250 : 20)) } }); }
  if (u.includes('earthquake.usgs')) return json({ features: [{ properties: { mag: 5.1, time: Date.UTC(1993, 8, 30) }, geometry: { coordinates: [73.3, 19.4, 10] } }] });
  if (u.includes('arcgis')) return json({ features: [{ attributes: { Serial_Num: 'S1', Season: 2021, wmo_wind: 100 }, geometry: { x: 72.6, y: 18.9 } }, { attributes: { Serial_Num: 'S2', Season: 1998, wmo_wind: 60 }, geometry: { x: 72.2, y: 19.5 } }] });
  if (u.includes('ngdc.noaa.gov')) return json({ items: [] });
  return new Response('not mocked', { status: 404 });
}) as typeof fetch;

const site = await collectSite(19.08, 72.88);
const s = summarise(site, 'ssp245', 2050);
const ok = s.values.filter((v) => v.status === 'ok').map((v) => v.id);
check('Pipeline: no source errors with full mocks', Object.keys(site.sourceErrors).length === 0, JSON.stringify(site.sourceErrors));
check('Pipeline: all assessable hazards computed', ok.length === HAZARDS.filter((h) => !h.notAssessed).length, `${ok.length}: missing ${HAZARDS.filter((h) => !h.notAssessed && !ok.includes(h.id)).map((h) => h.id + ':' + site.params[h.id].error)}`);
check('Pipeline: Mumbai coast distance < 15 km (Natural Earth)', site.coastKm < 15, String(site.coastKm));
check('Pipeline: every value finite', s.values.filter((v) => v.status === 'ok').every((v) => Number.isFinite(v.score)), JSON.stringify(s.values.filter((v) => v.status === 'ok' && !Number.isFinite(v.score))));
const heatNow = hazardAt(site, 'extreme_heat', 'ssp585', 2025).value, heat90 = hazardAt(site, 'extreme_heat', 'ssp585', 2090).value;
check('Warming raises heat days', heat90 > heatNow, `${heatNow} → ${heat90}`);
check('Warming lowers or keeps frost days', hazardAt(site, 'cold', 'ssp585', 2090).value <= hazardAt(site, 'cold', 'ssp585', 2025).value);
check('Coastal (Deltares): 2018 1-in-100 depth 0.6 m read from the Zarr chunk', near(site.params.coastal_flood.d!.d100, 0.6, 1e-6) && near(site.params.coastal_flood.d!.d100_2050, 0.9, 1e-6), JSON.stringify(site.params.coastal_flood));
check('Coastal: depth grows with sea-level rise', hazardAt(site, 'coastal_flood', 'ssp585', 2090).value > hazardAt(site, 'coastal_flood', 'ssp585', 2025).value);
check('River (JRC COG, deflate+predictor 3): 1-in-100 depth 1.0 m', near(site.params.river_flood.d!.d100, 1.0, 1e-6) && near(site.params.river_flood.d!.d500, 1.8, 1e-6), JSON.stringify(site.params.river_flood.d));
check('River: future 100-yr depth ≥ present when rain intensifies', hazardAt(site, 'river_flood', 'ssp585', 2090).value >= hazardAt(site, 'river_flood', 'ssp585', 2025).value - 1e-9);
check('STORM (LZW+predictor 2 in deflate stream): 100-yr 35 m/s → 143 km/h 1-min', near(site.params.cyclone.d!.v100, 35 * 3.6 / 0.88, 0.01), JSON.stringify(site.params.cyclone.d));
check('STORM: GCM mean change +4.3 %', near(site.params.cyclone.d!.gcmRel, (36 + 37 + 34 + 38) / 4 / 35 - 1, 1e-6));
check('Subsidence: masked centre → mean of neighbours 12 mm/yr', near(site.params.subsidence.base!, 12, 1e-4) && !!site.params.subsidence.note);
check('ILSM BigTIFF float64: probability 0.35', near(site.params.landslide.d!.ilsm, 0.35, 1e-9));
check('Water-table depth (strip TIFF) 8.5 m', near(site.params.groundwater.d!.wtd, 8.5, 1e-4));
check('Lightning (HDF5 via h5wasm): 0.02/day → 7.3 strokes/km²/yr', near(site.params.lightning.base!, 0.02 * 365.25, 0.01), String(site.params.lightning.base));
check('Aqueduct: water stress 2.75/5 now, rises under SSP5-8.5', near(hazardAt(site, 'water_stress', 'ssp585', 2025).value, 2.75, 1e-9) && hazardAt(site, 'water_stress', 'ssp585', 2080).value > 2.75);
check('Admin from Aqueduct: IND / IND.20_1', site.admin?.iso3 === 'IND' && site.admin?.gid1 === 'IND.20_1');
check('Climate TRACE: only assets within 50 km kept', !!site.trace && !('error' in site.trace) && site.trace.count === 1, JSON.stringify(site.trace));
check('Earthquake not climate-driven', hazardAt(site, 'earthquake', 'ssp126', 2025).value === hazardAt(site, 'earthquake', 'ssp585', 2090).value);
check('Volcano far from Mumbai → 0', hazardAt(site, 'volcano', 'ssp245', 2050).score === 0, String(hazardAt(site, 'volcano', 'ssp245', 2050).value));
check('Cyclone present (mock tracks)', hazardAt(site, 'cyclone', 'ssp245', 2050).value > 0, String(hazardAt(site, 'cyclone', 'ssp245', 2050).value));
const L = losses(site, 1e8, 'commercial', 'ssp245', 2050);
check('Losses: cyclone EAL finite, ≤ 1-in-100 loss', Number.isFinite(L.cycloneEal) && L.cycloneEal <= L.cyclone100 + 1, JSON.stringify(L));
check('Losses: river EAL > 0 and < 1-in-100 loss', L.riverEal > 0 && L.riverEal < L.river100, JSON.stringify(L));
check('Not-assessed hazards are never scored', s.values.filter((v) => v.status === 'notAssessed').every((v) => !Number.isFinite(v.score)));
// failure path: a source down must surface as an error, not a value
const realFetch = globalThis.fetch;
globalThis.fetch = (async (u: string | URL) => (String(u).includes('climate-api') ? new Response('down', { status: 503 }) : realFetch(u))) as typeof fetch;
const s2 = await collectSite(19.08, 72.88);
check('CMIP6 outage → dependent hazards show error, not a number', s2.params.extreme_heat.status === 'error' && s2.params.wildfire.status === 'error' && s2.params.earthquake.status === 'ok' && !!s2.sourceErrors.cmip6);

console.log('\nValues (mock data, SSP2-4.5 2050):');
for (const v of s.values.filter((x) => x.status === 'ok')) console.log(' ', v.id.padEnd(15), String(Math.round(v.value * 100) / 100).padStart(9), String(v.score).padStart(6), v.rating);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
