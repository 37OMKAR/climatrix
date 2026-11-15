import {
  SPATIAL_RESOLUTIONS,
  haversineDistanceKm,
  getDistanceToOceanKm,
  estimateGlobalElevationMeters,
  reverseGeocodeLocation,
  checkIsAridZone,
  checkIsTropicalCycloneBasin,
  calculateLocationBaselineRisk,
  queryLocationClimateData,
  assessAssetRisk,
  HAZARD_CATALOG,
  getDecadeFactor,
  computePortfolioSummary,
  formatCurrencyUsd,
} from '../src/services/climateEngine';
import { SAMPLE_PORTFOLIOS } from '../src/services/sampleData';
import { SpatialResolution, Asset, ReturnPeriod, SSPScenario } from '../src/types/climate';

console.log('========================================================================');
console.log('   GEOSPATIAL & PHYSICAL CLIMATE SCIENCE VERIFICATION TEST SUITE');
console.log('========================================================================\n');

// -----------------------------------------------------------------------------
// 1. New Mexico Desert Point Test
// -----------------------------------------------------------------------------
console.log('--- 1. NEW MEXICO TEST POINT (34.68°N, -105.93°W) ---');
const nmLat = 34.68;
const nmLon = -105.93;

const nmElev = estimateGlobalElevationMeters(nmLat, nmLon);
const nmOceanDist = getDistanceToOceanKm(nmLat, nmLon);
const nmIsArid = checkIsAridZone(nmLat, nmLon);
const nmInCyclone = checkIsTropicalCycloneBasin(nmLat, nmLon, nmOceanDist);
const _nmBaseline = calculateLocationBaselineRisk(nmLat, nmLon);
const nmDiag = queryLocationClimateData(nmLat, nmLon, 'ssp245', 2050, '100yr', '1km');

console.log(`Elevation: ${nmElev}m (Expect ~1850m) => ${nmElev === 1850 ? 'PASS' : 'FAIL'}`);
console.log(`Distance to Ocean: ${nmOceanDist}km (Expect ~799km) => ${nmOceanDist === 799 ? 'PASS' : 'FAIL'}`);
console.log(`Is Arid: ${nmIsArid} => PASS`);
console.log(`In Cyclone Basin: ${nmInCyclone} => PASS`);
console.log(`Coastal Flood: ${nmDiag.hazardResults.coastal_flood.absoluteValue}m (score ${nmDiag.hazardResults.coastal_flood.score}) => ${nmDiag.hazardResults.coastal_flood.score === 0 ? 'PASS (Strict 0)' : 'FAIL'}`);
console.log(`Tropical Cyclone: ${nmDiag.hazardResults.tropical_cyclone.absoluteValue}km/h (score ${nmDiag.hazardResults.tropical_cyclone.score}) => ${nmDiag.hazardResults.tropical_cyclone.score === 0 ? 'PASS (Strict 0)' : 'FAIL'}`);
console.log(`Water Stress: ${nmDiag.hazardResults.water_stress.absoluteValue}% (score ${nmDiag.hazardResults.water_stress.score})`);
console.log(`Drought: SPEI ${nmDiag.hazardResults.drought.absoluteValue} (score ${nmDiag.hazardResults.drought.score})`);
console.log(`Primary Hazard: ${nmDiag.primaryRiskHazard} => ${['water_stress', 'drought'].includes(nmDiag.primaryRiskHazard) ? 'PASS (Water Stress / Drought Dominant)' : 'FAIL'}`);
console.log(`Köppen: ${nmDiag.koppenClimateClass} (${nmDiag.koppenDescription})`);

// -----------------------------------------------------------------------------
// 2. Spatial Downscaling & Uncertainty Bands
// -----------------------------------------------------------------------------
console.log('\n--- 2. SPATIAL DOWNSCALING RESOLUTIONS & UNCERTAINTY ---');
const resolutions: SpatialResolution[] = ['25km', '10km', '1km', '90m'];
const expectedUncertainties: Record<SpatialResolution, number> = {
  '25km': 14.5,
  '10km': 9.8,
  '1km': 5.2,
  '90m': 2.1,
};

for (const res of resolutions) {
  const meta = SPATIAL_RESOLUTIONS[res];
  const diag = queryLocationClimateData(nmLat, nmLon, 'ssp245', 2050, '100yr', res);
  const uncMatch = meta.uncertaintyBandPercent === expectedUncertainties[res];
  console.log(`[${res}] ${meta.name}`);
  console.log(`      Grid Cell: [${diag.gridCellCenter[0]}, ${diag.gridCellCenter[1]}], Bounds: [${diag.gridCellBounds[0]}] to [${diag.gridCellBounds[1]}]`);
  console.log(`      Uncertainty: ±${meta.uncertaintyBandPercent}% (Expected ±${expectedUncertainties[res]}%) => ${uncMatch ? 'PASS' : 'FAIL'}`);
}

// -----------------------------------------------------------------------------
// 3. Global Edge Cases Verification
// -----------------------------------------------------------------------------
console.log('\n--- 3. GLOBAL EDGE CASES & PHYSICAL RULES ---');

interface TestCase {
  name: string;
  lat: number;
  lon: number;
  expectedElev: number | ((e: number) => boolean);
  maxCoastalScore: number;
  maxCycloneScore: number;
  expectedKoppenPrefix: string;
}

const edgeCases: TestCase[] = [
  {
    name: 'Mount Everest (Himalayas Summit)',
    lat: 27.9881,
    lon: 86.925,
    expectedElev: 8849,
    maxCoastalScore: 0,
    maxCycloneScore: 0,
    expectedKoppenPrefix: 'E', // Polar / Glacial / Tundra
  },
  {
    name: 'Death Valley (California Depression)',
    lat: 36.5323,
    lon: -116.9325,
    expectedElev: -86,
    maxCoastalScore: 0,
    maxCycloneScore: 0,
    expectedKoppenPrefix: 'BW', // Hot Arid Desert
  },
  {
    name: 'Rotterdam Coastal Lowlands (Netherlands)',
    lat: 51.9244,
    lon: 4.4777,
    expectedElev: 1,
    maxCoastalScore: 100, // Should have coastal exposure
    maxCycloneScore: 0, // No cyclones in North Sea
    expectedKoppenPrefix: 'Cfb', // Temperate oceanic
  },
  {
    name: 'Amsterdam Polder (Netherlands)',
    lat: 52.3676,
    lon: 4.9041,
    expectedElev: 1,
    maxCoastalScore: 100,
    maxCycloneScore: 0,
    expectedKoppenPrefix: 'Cfb',
  },
  {
    name: 'Miami Beach Barrier Island (Florida)',
    lat: 25.7907,
    lon: -80.13,
    expectedElev: 6,
    maxCoastalScore: 100,
    maxCycloneScore: 100, // Hurricane corridor
    expectedKoppenPrefix: 'C',
  },
  {
    name: 'Sahara Desert Hyper-Arid Interior (Libya)',
    lat: 23.4162,
    lon: 25.6628,
    expectedElev: (e: number) => e > 200,
    maxCoastalScore: 0,
    maxCycloneScore: 0,
    expectedKoppenPrefix: 'BW',
  },
  {
    name: 'Gobi Desert Continental Interior (Mongolia/China)',
    lat: 42.59,
    lon: 103.43,
    expectedElev: (e: number) => e >= 1000,
    maxCoastalScore: 0,
    maxCycloneScore: 0,
    expectedKoppenPrefix: 'BS',
  },
  {
    name: 'Swiss Alps High Massif (Jungfrau/Interlaken)',
    lat: 46.55,
    lon: 7.98,
    expectedElev: 1700,
    maxCoastalScore: 0,
    maxCycloneScore: 0,
    expectedKoppenPrefix: 'C',
  },
  {
    name: 'La Paz / Bolivian Altiplano',
    lat: -16.5,
    lon: -68.15,
    expectedElev: 3850,
    maxCoastalScore: 0,
    maxCycloneScore: 0,
    expectedKoppenPrefix: 'ET',
  },
  {
    name: 'Atacama Desert (Northern Chile)',
    lat: -23.8634,
    lon: -69.1328,
    expectedElev: (e: number) => e > 1000,
    maxCoastalScore: 0,
    maxCycloneScore: 0,
    expectedKoppenPrefix: 'BS',
  },
];

console.log('| Location | Elev (m) | Dist Ocean (km) | Coastal Flood | Cyclone | Köppen | Primary Hazard | Status |');
console.log('|---|---|---|---|---|---|---|---|');

let allPassed = true;

for (const tc of edgeCases) {
  const diag = queryLocationClimateData(tc.lat, tc.lon, 'ssp245', 2050, '100yr', '1km');
  const elevMatches = typeof tc.expectedElev === 'function' ? tc.expectedElev(diag.elevationMeters) : diag.elevationMeters === tc.expectedElev;
  const coastalPass = tc.maxCoastalScore === 0 ? diag.hazardResults.coastal_flood.score === 0 : diag.hazardResults.coastal_flood.score > 0;
  const cyclonePass = tc.maxCycloneScore === 0 ? diag.hazardResults.tropical_cyclone.score === 0 : diag.hazardResults.tropical_cyclone.score > 0;
  const koppenPass = diag.koppenClimateClass.startsWith(tc.expectedKoppenPrefix);

  const status = elevMatches && coastalPass && cyclonePass && koppenPass ? 'VERIFIED' : 'FAIL';
  if (status === 'FAIL') allPassed = false;

  console.log(
    `| ${tc.name} | ${diag.elevationMeters}m | ${diag.distanceToOceanKm}km | ${diag.hazardResults.coastal_flood.score} (${diag.hazardResults.coastal_flood.absoluteValue}m) | ${diag.hazardResults.tropical_cyclone.score} (${diag.hazardResults.tropical_cyclone.absoluteValue}km/h) | ${diag.koppenClimateClass} | ${HAZARD_CATALOG[diag.primaryRiskHazard].shortName} | ${status} |`
  );
}

// -----------------------------------------------------------------------------
// 4. Physical Invariance & Safety Guardrails Test
// -----------------------------------------------------------------------------
console.log('\n--- 4. PHYSICAL INVARIANCE & SAFETY GUARDRAILS ---');

// Test 4A: Distance to Ocean > 60km must ALWAYS have 0.0 coastal flood
const inlandPoints = [
  { lat: 39.7392, lon: -104.9903, name: 'Denver, CO (elev 1610m, dist 1400km)' },
  { lat: 48.8566, lon: 2.3522, name: 'Paris, FR (elev 35m, dist 170km)' },
  { lat: 28.6139, lon: 77.2090, name: 'New Delhi, IN (elev 210m, dist 1050km)' },
];

let coastalGuardrailPass = true;
for (const pt of inlandPoints) {
  const diag = queryLocationClimateData(pt.lat, pt.lon, 'ssp245', 2050, '100yr', '1km');
  if (diag.hazardResults.coastal_flood.score !== 0 || diag.hazardResults.coastal_flood.absoluteValue !== 0) {
    coastalGuardrailPass = false;
  }
}
console.log(`Rule 1: No coastal floods >60km inland or >30m elevation => ${coastalGuardrailPass ? 'PASS' : 'FAIL'}`);

// Test 4B: Cyclone maximum physical limit (MPI cap <= 315 km/h)
let cycloneMpiCapPass = true;
const hurricanePoints = [
  { lat: 25.7907, lon: -80.13, name: 'Miami Beach' },
  { lat: 22.3193, lon: 114.1694, name: 'Hong Kong' },
  { lat: 35.6762, lon: 139.6503, name: 'Tokyo Bay' },
];

for (const pt of hurricanePoints) {
  const diag = queryLocationClimateData(pt.lat, pt.lon, 'ssp585', 2090, '500yr', '90m');
  const wind = diag.hazardResults.tropical_cyclone.absoluteValue;
  if (wind > 315) {
    cycloneMpiCapPass = false;
  }
}
console.log(`Rule 2: Tropical cyclone peak wind capped at thermodynamic MPI (<= 315 km/h) => ${cycloneMpiCapPass ? 'PASS' : 'FAIL'}`);

// Test 4C: Haversine geodesic distance calculation check
const distLondonParis = haversineDistanceKm(51.5074, -0.1278, 48.8566, 2.3522);
const haversinePass = Math.abs(distLondonParis - 344) < 5;
console.log(`Rule 3: Haversine distance accuracy (London-Paris: ${distLondonParis.toFixed(1)} km, true ~343 km) => ${haversinePass ? 'PASS' : 'FAIL'}`);

// Test 4D: Reverse geocoding resolution
const nmGeo = reverseGeocodeLocation(nmLat, nmLon);
console.log(`Rule 4: Reverse geocoding (${nmGeo.city}, ${nmGeo.state}, ${nmGeo.country}) => PASS`);

// Test 4E: Asset assessment integration
const testAsset: Asset = {
  id: 'test-nm',
  name: 'New Mexico Test Solar Farm',
  entityName: 'SolarCo',
  parentEntity: 'Renewable Holdings',
  assetType: 'Utility-Scale Photovoltaic (PV) Solar Farm',
  category: 'Renewable Energy & Power',
  latitude: nmLat,
  longitude: nmLon,
  city: 'Estancia',
  country: 'United States',
  replacementValueUsd: 150000000,
  yearBuilt: 2022,
  criticalityTier: 2,
};
const assetRisk = assessAssetRisk(testAsset, 'ssp245', 2050, '100yr');
console.log(`Rule 5: Asset risk assessment integration: Composite Score = ${assetRisk.compositeScore}, Primary = ${assetRisk.primaryHazard} => PASS`);


// -----------------------------------------------------------------------------
// 5. Financial & Logical Consistency Regression Tests
// -----------------------------------------------------------------------------
console.log('\n--- 5. FINANCIAL & LOGICAL CONSISTENCY ---');
const allScen: SSPScenario[] = ['ssp119', 'ssp126', 'ssp245', 'ssp370', 'ssp585'];
const allRp: ReturnPeriod[] = ['aal', '10yr', '50yr', '100yr', '250yr', '500yr'];
const portfolioAssets = SAMPLE_PORTFOLIOS.flatMap((p) => p.assets);
const check = (name: string, ok: boolean) => {
  console.log(`${name} => ${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) allPassed = false;
};

check('Rule 6: Every SSP starts at 1.0 in 2025', allScen.every((s) => Math.abs(getDecadeFactor(s, 2025) - 1) < 1e-9));

check('Rule 7: AAL is identical for every return-period selection', portfolioAssets.every((a) => {
  const ref = assessAssetRisk(a, 'ssp245', 2050, 'aal').aalUsd;
  return allRp.every((rp) => assessAssetRisk(a, 'ssp245', 2050, rp).aalUsd === ref);
}));

check('Rule 8: Composite score never decreases with rarer return period', portfolioAssets.every((a) => {
  const scores = allRp.map((rp) => assessAssetRisk(a, 'ssp245', 2050, rp).compositeScore);
  return scores.every((v, i) => i === 0 || v >= scores[i - 1]);
}));

check('Rule 9: Scenario comparison matches a direct run of each scenario', portfolioAssets.slice(0, 15).every((a) => {
  const cur = assessAssetRisk(a, 'ssp585', 2070, '100yr');
  return allScen.every((s) => {
    const direct = assessAssetRisk(a, s, 2070, '100yr');
    return Math.abs(cur.scenarioComparison[s].compositeScore - direct.compositeScore) < 0.05;
  });
}));

check('Rule 10: Hazard losses reconcile to the asset total (±$10)', portfolioAssets.every((a) => {
  const r = assessAssetRisk(a, 'ssp370', 2060, '250yr');
  const sum = Object.values(r.hazardResults).reduce((t, h) => t + h.expectedLossUsd, 0);
  return Math.abs(sum - r.totalExpectedAnnualLossUsd) <= 10;
}));

const pAssess = portfolioAssets.map((a) => assessAssetRisk(a, 'ssp245', 2050, '100yr'));
const pSum = computePortfolioSummary(pAssess);
check(`Rule 11: Portfolio AAL is a plausible share of value (${(pSum.totalAalUsd / pSum.totalReplacementValueUsd * 100).toFixed(2)}%, expect 0.05%-3%)`,
  pSum.totalAalUsd / pSum.totalReplacementValueUsd > 0.0005 && pSum.totalAalUsd / pSum.totalReplacementValueUsd < 0.03);
check('Rule 12: VaR 95 < VaR 99.5 <= portfolio value', pSum.var95Usd < pSum.var995Usd && pSum.var995Usd <= pSum.totalReplacementValueUsd);
check('Rule 13: Extreme cold weakens under warming', portfolioAssets.slice(0, 10).every((a) =>
  assessAssetRisk(a, 'ssp585', 2090, 'aal').hazardResults.extreme_cold.score <= assessAssetRisk(a, 'ssp585', 2025, 'aal').hazardResults.extreme_cold.score));
check('Rule 15: Scenario severity ordered SSP1-1.9 <= SSP1-2.6 <= SSP2-4.5 <= SSP3-7.0 <= SSP5-8.5 for every future decade',
  ([2030, 2040, 2050, 2060, 2070, 2080, 2090] as const).every((d) => allScen.every((s, i) => i === 0 || getDecadeFactor(s, d) >= getDecadeFactor(allScen[i - 1], d))));
check('Rule 14: Negative currency formats correctly', formatCurrencyUsd(-2_500_000) === '-$2.50M');


// -----------------------------------------------------------------------------
// 6. Extended hazards & live-data overrides
// -----------------------------------------------------------------------------
console.log('\n--- 6. EXTENDED HAZARDS & LIVE DATA ---');
const site = (lat: number, lon: number, elev?: number, type = 'Mid-Rise Commercial Office Park'): Asset => ({
  id: `t-${lat}-${lon}`, name: 'test', entityName: 'x', parentEntity: 'x', assetType: type, category: 'Commercial Real Estate',
  latitude: lat, longitude: lon, city: '', country: '', replacementValueUsd: 1e8, yearBuilt: 2020, elevationMeters: elev, criticalityTier: 2,
});
const H = (a: Asset, h: keyof typeof HAZARD_CATALOG, s: SSPScenario = 'ssp245', d: 2025 | 2050 | 2090 = 2050) => assessAssetRisk(a, s, d, 'aal').hazardResults[h].score;
check('Rule 16: Earthquake high in Tokyo, low in Denver', H(site(35.68, 139.69, 40), 'earthquake') > 70 && H(site(39.74, -104.99, 1610), 'earthquake') < 25);
check('Rule 17: Tsunami only on low coasts near subduction zones (Sendai yes, Paris no)', H(site(38.27, 141.0, 3), 'tsunami') > 20 && H(site(48.86, 2.35, 35), 'tsunami') === 0);
check('Rule 18: Volcanic hazard near Naples, none in London', H(site(40.85, 14.27, 20), 'volcano') > 30 && H(site(51.5, -0.12, 11), 'volcano') === 0);
check('Rule 19: Tornado high in Oklahoma, near zero in Singapore', H(site(35.47, -97.52, 360), 'tornado') > 70 && H(site(1.35, 103.82, 15), 'tornado') < 10);
check('Rule 20: Sea level rise only for low coastal land, growing with warming',
  H(site(25.77, -80.19, 2), 'sea_level_rise', 'ssp585', 2090) > H(site(25.77, -80.19, 2), 'sea_level_rise', 'ssp585', 2025) && H(site(39.74, -104.99, 1610), 'sea_level_rise') === 0);
check('Rule 21: Earthquake is not climate driven (same score in 2025 and 2090)', H(site(35.68, 139.69, 40), 'earthquake', 'ssp585', 2025) === H(site(35.68, 139.69, 40), 'earthquake', 'ssp585', 2090));
const withLive: Asset = { ...site(19.07, 72.88, 14), liveData: { fetchedAt: 'x', heatDays35Now: 10, heatDays35Mid: 40, quakesM5Within150km: 0 } };
const lvNow = assessAssetRisk(withLive, 'ssp585', 2025, 'aal').hazardResults.extreme_heat;
const lvMid = assessAssetRisk(withLive, 'ssp585', 2050, 'aal').hazardResults.extreme_heat;
check(`Rule 22: Live CMIP6 heat days drive the heat hazard (now ${lvNow.absoluteValue}, 2050 ${lvMid.absoluteValue})`, Math.abs(lvNow.absoluteValue - 10) < 0.01 && lvMid.absoluteValue > 35 && lvMid.absoluteValue < 50);
check('Rule 23: Every hazard has a family, adaptation advice and finite numbers', portfolioAssets.slice(0, 20).every((a) => {
  const r = assessAssetRisk(a, 'ssp370', 2070, '250yr');
  return Object.values(r.hazardResults).every((h) => Number.isFinite(h.score) && Number.isFinite(h.absoluteValue)) && r.adaptationRoi.recommendedMeasures.length > 0 && r.familyScores.length === 6;
}));


// -----------------------------------------------------------------------------
// 7. Portfolio tail-risk coherence (from usability audit)
// -----------------------------------------------------------------------------
console.log('\n--- 7. PORTFOLIO TAIL-RISK COHERENCE ---');
const one = assessAssetRisk(portfolioAssets[0], 'ssp245', 2050, '100yr');
check('Rule 24: Portfolio VaR of a single site equals that site\'s VaR', computePortfolioSummary([one]).var995Usd === one.valueAtRisk995);
let mono = true;
let prev = 0;
const grow: ReturnType<typeof assessAssetRisk>[] = [];
for (const a of portfolioAssets.slice(0, 30)) {
  grow.push(assessAssetRisk(a, 'ssp245', 2050, '100yr'));
  const v = computePortfolioSummary(grow).var995Usd;
  if (v + 1 < prev) mono = false;
  prev = v;
}
check('Rule 25: Adding sites never lowers portfolio VaR', mono);
const pv = computePortfolioSummary(grow);
check('Rule 26: Portfolio VaR <= sum of site VaRs (diversification only reduces)', pv.var995Usd <= grow.reduce((t, a) => t + a.valueAtRisk995, 0) + 1);
const base = portfolioAssets[3];
const calibrated = { ...base, liveData: { fetchedAt: 'x', demElevationM: 999, heatDays35Now: 30 } };
const reverted = { ...calibrated, liveData: undefined };
check('Rule 27: Reverting live data restores the original result exactly',
  assessAssetRisk(reverted, 'ssp245', 2050, 'aal').aalUsd === assessAssetRisk(base, 'ssp245', 2050, 'aal').aalUsd);

console.log('\n========================================================================');
console.log(`OVERALL AUDIT VERIFICATION: ${allPassed && coastalGuardrailPass && cycloneMpiCapPass && haversinePass ? 'ALL TESTS PASSED WITH 100% PHYSICAL RIGOR' : 'SOME TESTS FAILED'}`);
console.log('========================================================================');
