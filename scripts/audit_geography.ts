// Geographic sanity + physical-unit audit (Round 4).  Run: npx tsx scripts/audit_geography.ts
import {
  queryLocationClimateData, assessAssetRisk, computePortfolioSummary, getDistanceToOceanKm, estimateGlobalElevationMeters,
  getDecadeSeaLevelRiseMeters, getDecadeFactor, getAssetVulnerabilityWeights, ALL_HAZARDS,
} from '../src/services/climateEngine';
import type { Asset, HazardType } from '../src/types/climate';

type Kind = 'desert' | 'desertCoast' | 'mountain' | 'polar' | 'equator' | 'interior' | 'delta' | 'cycloneCoast' | 'calmCoast' | 'island';
// [name, lat, lon, kind, realElev (approx), coastal? (true = on the sea)]
const P: Array<[string, number, number, Kind, number, boolean]> = [
  ['Tamanrasset', 22.79, 5.52, 'desert', 1320, false], ['Kufra', 24.2, 23.29, 'desert', 380, false], ["Rub' al Khali", 20.5, 50.5, 'desert', 300, false],
  ['Jaisalmer (Thar)', 26.91, 70.92, 'desert', 230, false], ['Calama (Atacama)', -22.46, -68.93, 'desert', 2260, false], ['Alice Springs', -23.7, 133.88, 'desert', 545, false],
  ['Gobi (Dalanzadgad)', 43.57, 104.42, 'desert', 1470, false], ['Death Valley', 36.46, -116.87, 'desert', -80, false], ['Kalahari (Ghanzi)', -21.7, 21.65, 'desert', 1130, false],
  ['Riyadh', 24.71, 46.68, 'desert', 610, false], ['Phoenix', 33.45, -112.07, 'desert', 330, false],
  ['Dubai', 25.2, 55.27, 'desertCoast', 5, true], ['Lima', -12.05, -77.04, 'desertCoast', 150, true], ['Nouakchott', 18.08, -15.98, 'desertCoast', 7, true], ['Swakopmund', -22.68, 14.53, 'desertCoast', 10, true],
  ['La Paz', -16.5, -68.15, 'mountain', 3640, false], ['Lhasa', 29.65, 91.1, 'mountain', 3650, false], ['Quito', -0.18, -78.47, 'mountain', 2850, false], ['Denver', 39.74, -104.99, 'mountain', 1610, false],
  ['Addis Ababa', 9.03, 38.74, 'mountain', 2355, false], ['Kathmandu', 27.72, 85.32, 'mountain', 1400, false], ['Zermatt', 46.02, 7.75, 'mountain', 1600, false], ['Leh', 34.15, 77.58, 'mountain', 3500, false],
  ['Mexico City', 19.43, -99.13, 'mountain', 2240, false], ['Bogotá', 4.71, -74.07, 'mountain', 2640, false],
  ['Longyearbyen', 78.22, 15.65, 'polar', 20, true], ['Yakutsk', 62.03, 129.73, 'polar', 100, false], ['Fairbanks', 64.84, -147.72, 'polar', 135, false], ['Nuuk', 64.18, -51.72, 'polar', 10, true],
  ['Murmansk', 68.97, 33.07, 'polar', 50, true], ['Iqaluit', 63.75, -68.52, 'polar', 30, true],
  ['Manaus', -3.12, -60.02, 'equator', 90, false], ['Kinshasa', -4.32, 15.31, 'equator', 280, false], ['Singapore', 1.35, 103.82, 'equator', 15, true], ['Jakarta', -6.2, 106.85, 'equator', 8, true],
  ['Ulaanbaatar', 47.92, 106.92, 'interior', 1350, false], ['Almaty', 43.24, 76.89, 'interior', 800, false], ['Kansas City', 39.1, -94.58, 'interior', 270, false], ['Chengdu', 30.66, 104.07, 'interior', 500, false],
  ['Brasília', -15.79, -47.88, 'interior', 1170, false], ['Nairobi', -1.29, 36.82, 'interior', 1700, false], ['Delhi', 28.61, 77.21, 'interior', 215, false], ['Bengaluru', 12.97, 77.59, 'interior', 920, false],
  ['Jaipur', 26.91, 75.79, 'interior', 430, false], ['Johannesburg', -26.2, 28.05, 'interior', 1750, false], ['Tehran', 35.69, 51.39, 'interior', 1190, false], ['Kabul', 34.53, 69.17, 'interior', 1790, false],
  ['Zürich', 47.37, 8.54, 'interior', 410, false], ['Basel', 47.56, 7.59, 'interior', 260, false], ['Berlin', 52.52, 13.4, 'interior', 35, false], ['Moscow', 55.75, 37.62, 'interior', 150, false],
  ['Rotterdam', 51.92, 4.48, 'delta', 0, true], ['Dhaka', 23.81, 90.41, 'delta', 6, false], ['Ho Chi Minh City', 10.82, 106.63, 'delta', 5, true], ['New Orleans', 29.95, -90.07, 'delta', 1, true],
  ['Shanghai', 31.23, 121.47, 'delta', 4, true], ['Kolkata', 22.57, 88.36, 'delta', 9, false], ['Bangkok', 13.76, 100.5, 'delta', 2, true],
  ['Miami', 25.77, -80.19, 'cycloneCoast', 2, true], ['Manila', 14.6, 120.98, 'cycloneCoast', 5, true], ['Mumbai', 19.08, 72.88, 'cycloneCoast', 10, true], ['Darwin', -12.46, 130.84, 'cycloneCoast', 30, true],
  ['Chennai', 13.08, 80.27, 'cycloneCoast', 7, true], ['Mazatlán', 23.24, -106.41, 'cycloneCoast', 10, true],
  ['London', 51.51, -0.13, 'calmCoast', 11, false], ['Cape Town', -33.92, 18.42, 'calmCoast', 10, true], ['Lisbon', 38.72, -9.14, 'calmCoast', 20, true], ['Perth', -31.95, 115.86, 'calmCoast', 15, true],
  ['Honolulu', 21.31, -157.86, 'island', 5, true], ['Malé', 4.18, 73.51, 'island', 1, true], ['Reykjavik', 64.15, -21.94, 'island', 15, true], ['Guam (Hagåtña)', 13.48, 144.75, 'island', 5, true],
];

let fails = 0, passes = 0;
const check = (name: string, ok: boolean, detail = '') => { if (ok) passes++; else { fails++; console.log(`FAIL  ${name}  ${detail}`); } };
const H = (d: ReturnType<typeof queryLocationClimateData>, h: HazardType) => d.hazardResults[h]?.score ?? 0;
const CYCLONE_FREE = (lat: number, lon: number) => (lat > 35 && lon > -30 && lon < 60) || (lat < -25 && lon > -70 && lon < 30) || Math.abs(lat) > 45;

const rows: string[] = [];
for (const [name, lat, lon, kind, realElev, onCoast] of P) {
  const a = queryLocationClimateData(lat, lon, 'ssp245', 2050, 'aal', '10km');
  const z = queryLocationClimateData(lat, lon, 'ssp585', 2090, '100yr', '10km');
  const e = a.elevationMeters, dist = getDistanceToOceanKm(lat, lon);
  const top = [...ALL_HAZARDS].sort((x, y) => H(z, y) - H(z, x)).slice(0, 3).map((h) => `${h}:${Math.round(H(z, h))}`).join(' ');
  rows.push(`| ${name} | ${e} (${realElev}) | ${dist} | ${top} |`);
  const tag = `${name} [elev ${e}, ${dist} km]`;
  const inland = !onCoast && dist > 60;
  for (const d of [a, z]) {
    if (inland || e > 30) check(`no coastal flood: ${tag}`, H(d, 'coastal_flood') === 0, `got ${H(d, 'coastal_flood')}`);
    if (inland || e > 10) check(`no sea-level rise: ${tag}`, H(d, 'sea_level_rise') === 0, `got ${H(d, 'sea_level_rise')}`);
    if (inland || e > 25) check(`no tsunami: ${tag}`, H(d, 'tsunami') === 0, `got ${H(d, 'tsunami')}`);
    if (inland) check(`no erosion/saline: ${tag}`, H(d, 'coastal_erosion') === 0 && H(d, 'saline_intrusion') === 0);
    if (Math.abs(lat) > 58 || e > 3000) check(`no extreme heat: ${tag}`, H(d, 'extreme_heat') < 10, `got ${H(d, 'extreme_heat')}`);
    if (Math.abs(lat) < 15 && e < 2500) check(`no permafrost/avalanche/frost: ${tag}`, H(d, 'permafrost_thaw') === 0 && H(d, 'avalanche') === 0 && H(d, 'extreme_cold') < 25);
    if (CYCLONE_FREE(lat, lon)) check(`no tropical cyclone: ${tag}`, H(d, 'tropical_cyclone') === 0, `got ${H(d, 'tropical_cyclone')}`);
    // physical units always bounded
    const hr = d.hazardResults;
    check(`units bounded: ${tag}`, hr.heat_stress.absoluteValue <= 36 && hr.water_stress.absoluteValue <= 100 && hr.extreme_heat.absoluteValue <= 365
      && hr.extreme_cold.absoluteValue <= 365 && hr.landslide.absoluteValue <= 10 && hr.tropical_cyclone.absoluteValue <= 315
      && hr.extratropical_storm.absoluteValue <= 300 && hr.hail.absoluteValue <= 150 && hr.coastal_flood.absoluteValue <= 12,
      `wbgt ${hr.heat_stress.absoluteValue} ws ${hr.water_stress.absoluteValue} gust ${hr.extratropical_storm.absoluteValue}`);
  }
  if (kind === 'desert') {
    check(`desert dry: ${tag}`, H(z, 'drought') >= 50 && H(z, 'water_stress') >= 50, `drought ${H(z, 'drought')} ws ${H(z, 'water_stress')}`);
    check(`desert low river flood: ${tag}`, H(z, 'fluvial_flood') < 30, `fluvial ${H(z, 'fluvial_flood')}`);
  }
  if (kind === 'mountain' && realElev > 2500) check(`mountain elevation estimate ≥1500 m: ${tag}`, e >= 1500);
  if (kind === 'island' || kind === 'desertCoast' || kind === 'cycloneCoast') check(`coast detected (<40 km): ${tag}`, dist <= 40, `dist ${dist}`);
  if (['Honolulu', 'Manila', 'Miami', 'Mumbai', 'Darwin', 'Mazatlán', 'Guam (Hagåtña)', 'Chennai'].includes(name)) check(`cyclone present: ${tag}`, H(z, 'tropical_cyclone') > 0);
  if (['Rotterdam', 'New Orleans', 'Miami', 'Malé', 'Bangkok', 'Shanghai', 'Ho Chi Minh City'].includes(name)) check(`coastal flood present: ${tag}`, H(z, 'coastal_flood') > 0);
}

// Elevation estimate errors that used to create false results
check('Basel is not 1850 m (Swiss plateau)', estimateGlobalElevationMeters(47.56, 7.59) < 600);
check('Nairobi highland estimate', estimateGlobalElevationMeters(-1.29, 36.82) > 1200);
check('Chengdu is not a desert', !queryLocationClimateData(30.66, 104.07, 'ssp245', 2050, 'aal', '10km').koppenClimateClass.startsWith('B'));

// --- Engine physics ---------------------------------------------------------------------------------
const site = (lat: number, lon: number, elev: number, type = 'Commercial Office Tower', v: unknown = 1e8): Asset => ({
  id: `s-${lat}-${lon}-${elev}-${type}`, name: 't', entityName: 'x', parentEntity: 'x', assetType: type, category: 'Commercial Real Estate',
  latitude: lat, longitude: lon, city: '', country: '', replacementValueUsd: v as number, yearBuilt: 2020, elevationMeters: elev, criticalityTier: 2,
});
const hh = (a: Asset, h: HazardType, s: 'ssp245' | 'ssp585' = 'ssp585', d: 2025 | 2050 | 2090 = 2090) => assessAssetRisk(a, s, d, '100yr').hazardResults[h];
check('SLR: AR6-consistent (SSP5-8.5 2090 between 0.4 and 0.65 m)', getDecadeSeaLevelRiseMeters('ssp585', 2090) >= 0.4 && getDecadeSeaLevelRiseMeters('ssp585', 2090) <= 0.65);
check('SLR: small scenario spread at 2050 (<0.08 m)', getDecadeSeaLevelRiseMeters('ssp585', 2050) - getDecadeSeaLevelRiseMeters('ssp119', 2050) < 0.08);
check('Scenario factor: SSP2-4.5/3-7.0/5-8.5 close at 2050', getDecadeFactor('ssp585', 2050) - getDecadeFactor('ssp245', 2050) < 0.12);
const ham = hh(site(53.54, 9.98, 4.4), 'coastal_flood');
check(`Coastal: sea-level rise can create exposure (Hamburg 4.4 m, 2090 depth ${ham.absoluteValue} m)`, ham.absoluteValue > 0 && ham.score > 0);
check('Coastal: depth grows with SLR, no warming multiplier (Miami ≤ 6 m)', hh(site(25.77, -80.19, 2), 'coastal_flood').absoluteValue <= 6);
const px = site(33.45, -112.07, 330);
check(`WBGT physical (Phoenix 2090 1-in-100 ${hh(px, 'heat_stress').absoluteValue} °C ≤ 36)`, hh(px, 'heat_stress').absoluteValue <= 36);
check('Rain scales ~7%/°C (≤ +45% by 2090)', hh(site(48.86, 2.35, 35), 'pluvial_flood').absoluteValue <= 1.45 * hh(site(48.86, 2.35, 35), 'pluvial_flood', 'ssp585', 2025).absoluteValue);
check('Subsidence not driven by warming', hh(site(-6.2, 106.85, 3), 'subsidence').absoluteValue === hh(site(-6.2, 106.85, 3), 'subsidence', 'ssp585', 2025).absoluteValue);
const paris = assessAssetRisk(site(48.86, 2.35, 35), 'ssp585', 2090, '100yr').compositeScore;
check(`Paris stays below Severe under SSP5-8.5 2090 (${paris})`, paris < 75);
check('Water stress in Arctic Norway stays low', hh(site(70, 25, 20), 'water_stress').absoluteValue < 45);
const live: Asset = { ...site(29.37, 47.97, 10), liveData: { fetchedAt: 'x', heatDays35Now: 150, heatDays35Mid: 180, frostDaysNow: 0 } };
check('Live heat days capped at 365', assessAssetRisk(live, 'ssp585', 2090, '500yr').hazardResults.extreme_heat.absoluteValue <= 365);
const noisy: Asset = { ...site(48.86, 2.35, 35), liveData: { fetchedAt: 'x', heatDays35Now: 10, heatDays35Mid: 8 } };
check('Live heat days never fall with warming', assessAssetRisk(noisy, 'ssp585', 2090, 'aal').hazardResults.extreme_heat.absoluteValue >= 10);
// Portfolio robustness
const ps = computePortfolioSummary([assessAssetRisk(site(1, 1, 5, 'Office', '100'), 'ssp245', 2050, 'aal'), assessAssetRisk(site(2, 2, 5, 'Office', -5e8), 'ssp245', 2050, 'aal')]);
check(`Portfolio total value is numeric and non-negative (${ps.totalReplacementValueUsd})`, typeof ps.totalReplacementValueUsd === 'number' && ps.totalReplacementValueUsd >= 0);
let threw = false; try { assessAssetRisk(site(NaN, 1, 5)); } catch { threw = true; }
check('NaN coordinates are rejected', threw);
// Vulnerability keywords
check('"International Airport" is not a port', getAssetVulnerabilityWeights('International Airport').tsunami !== 2.5);
check('"Green Hydrogen Plant" is not a dam', getAssetVulnerabilityWeights('Green Hydrogen Plant').glacial_lake_outburst !== 2.2);
// Grid cell contains the clicked point
for (const res of ['25km', '10km', '1km', '90m'] as const) {
  const d = queryLocationClimateData(-33.87, 151.21, 'ssp245', 2050, 'aal', res);
  const [[la0, lo0], [la1, lo1]] = d.gridCellBounds;
  check(`grid cell ${res} contains the point`, -33.87 >= la0 && -33.87 <= la1 && 151.21 >= lo0 && 151.21 <= lo1);
}

console.log('\n| Location | Elev est (real) | Dist to sea km | Top 3 hazards SSP5-8.5 2090 1-in-100 |\n|---|---|---|---|');
if (process.argv.includes('--table')) rows.forEach((r) => console.log(r));
console.log(`\n${P.length} locations · ${passes} checks passed · ${fails} failed`);
console.log(fails === 0 ? 'GEOGRAPHY AUDIT: ALL PASSED' : 'GEOGRAPHY AUDIT: FAILURES');
process.exit(fails ? 1 : 0);
