// Extended hazard set: 15 perils added to the original 12 so the screen covers the
// EU Taxonomy Appendix A list, Munich Re NATHAN-style natural-hazard scores, ThinkHazard!
// geophysical hazards and WRI Aqueduct groundwater indicators.
//
// Baselines here are transparent screening heuristics (bounding regions + distance decay),
// in the same spirit as the rest of the engine. Where live data is fetched for a site
// (see liveData.ts) it overrides these for the matching hazards.
import { HazardFamily, HazardMeta, HazardTaxonomyEntry, HazardType } from '../types/climate';

/** Keyword match on word starts, so "airport"/"export" don't match "port" and "hydrogen" doesn't match "hydro". */
export function typeHasKeyword(lower: string, k: string): boolean {
  const esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!new RegExp(`(^|[^a-z])${esc}`).test(lower)) return false;
  if (k === 'hydro' && /hydro(gen|ponic)/.test(lower) && !/hydro(power|electric)|hydro (dam|plant|station)/.test(lower)) return false;
  if (k === 'farm' && /(tank|wind|solar|server|battery) farm/.test(lower)) return false;
  return true;
}


export type ExtendedHazard =
  | 'sea_level_rise' | 'coastal_erosion' | 'saline_intrusion' | 'groundwater_decline'
  | 'extratropical_storm' | 'hail' | 'tornado' | 'lightning' | 'sand_dust_storm'
  | 'permafrost_thaw' | 'avalanche' | 'glacial_lake_outburst'
  | 'earthquake' | 'tsunami' | 'volcano';

const meta = (
  id: ExtendedHazard, name: string, shortName: string, category: HazardMeta['category'], unit: string,
  description: string, basis: string, colorHex: string,
): HazardMeta => ({ id, name, shortName, category, unit, description, cmip6ModelBasis: basis, iconName: 'AlertTriangle', colorHex });

export const EXTENDED_HAZARD_META: Record<ExtendedHazard, HazardMeta> = {
  sea_level_rise: meta('sea_level_rise', 'Sea Level Rise (Chronic Inundation)', 'Sea Level Rise', 'Flood', 'm SLR at site',
    'Permanent or tidal inundation of low-lying land as mean sea level rises, independent of storm events.',
    'IPCC AR6 sea-level projections (FACTS) + site elevation margin', '#0369a1'),
  coastal_erosion: meta('coastal_erosion', 'Coastal Erosion', 'Coastal Erosion', 'Geophysical & Fire', 'm shoreline retreat / yr',
    'Long-term shoreline retreat from wave action and sea level rise undermining foundations and access.',
    'Global shoreline change (Luijendijk et al.) scaled by AR6 SLR', '#a16207'),
  saline_intrusion: meta('saline_intrusion', 'Saline Intrusion', 'Saline Intrusion', 'Water & Drought', 'km salt-wedge reach',
    'Seawater penetrating coastal aquifers and estuaries, contaminating process and cooling water supplies.',
    'Coastal aquifer vulnerability + AR6 SLR + water-stress pumping pressure', '#0e7490'),
  groundwater_decline: meta('groundwater_decline', 'Groundwater Table Decline', 'Groundwater Decline', 'Water & Drought', 'cm / yr',
    'Falling water tables from over-abstraction, raising pumping costs and causing well failure and land subsidence.',
    'WRI Aqueduct 4.0 groundwater table decline indicator', '#92400e'),
  extratropical_storm: meta('extratropical_storm', 'Extratropical Windstorm', 'Windstorm', 'Wind & Storm', 'km/h peak gust',
    'Mid-latitude winter storms (e.g. European windstorms, nor\'easters) causing roof, façade and grid damage.',
    'CMIP6 storm-track wind extremes; ERA5 gust climatology', '#6d28d9'),
  hail: meta('hail', 'Hail', 'Hail', 'Wind & Storm', 'mm max hailstone',
    'Severe convective hail damaging roofs, solar modules, vehicles and crops.',
    'Convective environment proxies (CAPE, shear) and regional hail-day climatology', '#8b5cf6'),
  tornado: meta('tornado', 'Tornado', 'Tornado', 'Wind & Storm', 'tornado index (0-10)',
    'Localised extreme rotating winds with near-total destruction along the track.',
    'Regional tornado climatology (NOAA SPC, ESSL ESWD)', '#5b21b6'),
  lightning: meta('lightning', 'Lightning', 'Lightning', 'Wind & Storm', 'flashes / km² / yr',
    'Lightning strikes causing fires, surges and outages for exposed electrical and telecom equipment.',
    'Satellite lightning climatology (LIS/OTD) with ~12%/°C warming sensitivity', '#a78bfa'),
  sand_dust_storm: meta('sand_dust_storm', 'Sand & Dust Storm', 'Dust Storm', 'Wind & Storm', 'dust days / yr',
    'Wind-blown sand and dust abrading equipment, clogging filters and soiling solar panels.',
    'Dust-source regions (MERRA-2 aerosol optical depth climatology)', '#ca8a04'),
  permafrost_thaw: meta('permafrost_thaw', 'Permafrost Thaw', 'Permafrost Thaw', 'Thermal', 'cm active-layer deepening',
    'Thawing frozen ground causing foundation settlement, pipeline strain and road failure.',
    'CMIP6 ground temperature; ESA CCI permafrost extent', '#38bdf8'),
  avalanche: meta('avalanche', 'Avalanche', 'Avalanche', 'Geophysical & Fire', 'avalanche index (0-10)',
    'Snow avalanches threatening mountain infrastructure, transport corridors and hydropower.',
    'Terrain + snow climatology screening', '#cbd5e1'),
  glacial_lake_outburst: meta('glacial_lake_outburst', 'Glacial Lake Outburst Flood', 'Glacial Lake Outburst', 'Flood', 'outburst index (0-10)',
    'Sudden release of glacial lakes producing destructive downstream floods in high mountain valleys.',
    'Glacial lake inventory (Shugar et al. 2020) proximity screening', '#7dd3fc'),
  earthquake: meta('earthquake', 'Earthquake', 'Earthquake', 'Geophysical', 'g PGA (475-yr)',
    'Ground shaking from seismic faults. Not climate driven, but often the largest single-event loss for a site.',
    'GEM / GAR seismic belts; USGS ComCat event history when fetched live', '#b91c1c'),
  tsunami: meta('tsunami', 'Tsunami', 'Tsunami', 'Geophysical', 'm run-up',
    'Sea waves from subduction earthquakes or landslides inundating low coastal land.',
    'Global Tsunami Model (GTM) subduction-zone proximity screening', '#1d4ed8'),
  volcano: meta('volcano', 'Volcanic Hazard', 'Volcano', 'Geophysical', 'cm ashfall (1-in-100)',
    'Ashfall, lahars and pyroclastic flows near active volcanoes; ash also disrupts aviation and power.',
    'Smithsonian GVP Holocene volcano list, distance decay', '#9a3412'),
};

// Six families used for grouping in the UI and for the multi-hazard composite.
// Colours deliberately avoid the green→yellow→orange→red rating ramp so a family is never read as a rating.
export const HAZARD_FAMILIES: Array<{ id: HazardFamily; name: string; short: string; color: string; description: string }> = [
  { id: 'flood', name: 'Flood & sea level', short: 'Flood', color: '#3b82f6', description: 'Coastal, river and surface flooding, sea level rise and glacial outbursts' },
  { id: 'wind', name: 'Wind & storms', short: 'Wind', color: '#8b5cf6', description: 'Cyclones, windstorms, tornado, hail, lightning and dust' },
  { id: 'thermal', name: 'Heat & cold', short: 'Heat/Cold', color: '#ec4899', description: 'Extreme heat, humid heat stress, freeze and permafrost thaw' },
  { id: 'water', name: 'Water scarcity', short: 'Water', color: '#14b8a6', description: 'Drought, water stress, groundwater decline and saline intrusion' },
  { id: 'fire', name: 'Wildfire', short: 'Fire', color: '#a16207', description: 'Fire weather and burn probability' },
  { id: 'ground', name: 'Ground & geology', short: 'Ground', color: '#a8a29e', description: 'Subsidence, landslide, erosion, avalanche, earthquake, tsunami, volcano' },
];

export const HAZARD_TAXONOMY: Record<HazardType, HazardTaxonomyEntry> = {
  coastal_flood: { family: 'flood', onset: 'acute', climateDriven: true, euTaxonomy: 'Flood (coastal)' },
  fluvial_flood: { family: 'flood', onset: 'acute', climateDriven: true, euTaxonomy: 'Flood (fluvial)' },
  pluvial_flood: { family: 'flood', onset: 'acute', climateDriven: true, euTaxonomy: 'Heavy precipitation / Flood (pluvial)' },
  sea_level_rise: { family: 'flood', onset: 'chronic', climateDriven: true, euTaxonomy: 'Sea level rise' },
  glacial_lake_outburst: { family: 'flood', onset: 'acute', climateDriven: true, euTaxonomy: 'Glacial lake outburst' },
  tropical_cyclone: { family: 'wind', onset: 'acute', climateDriven: true, euTaxonomy: 'Cyclone, hurricane, typhoon' },
  extratropical_storm: { family: 'wind', onset: 'acute', climateDriven: true, euTaxonomy: 'Storm (incl. blizzards)' },
  tornado: { family: 'wind', onset: 'acute', climateDriven: true, euTaxonomy: 'Tornado' },
  hail: { family: 'wind', onset: 'acute', climateDriven: true, euTaxonomy: 'Changing precipitation types (hail)' },
  lightning: { family: 'wind', onset: 'acute', climateDriven: true, euTaxonomy: 'Storm (convective)' },
  sand_dust_storm: { family: 'wind', onset: 'acute', climateDriven: true, euTaxonomy: 'Storm (dust and sandstorms)' },
  extreme_heat: { family: 'thermal', onset: 'acute', climateDriven: true, euTaxonomy: 'Heat wave' },
  heat_stress: { family: 'thermal', onset: 'chronic', climateDriven: true, euTaxonomy: 'Heat stress' },
  extreme_cold: { family: 'thermal', onset: 'acute', climateDriven: true, euTaxonomy: 'Cold wave / frost' },
  permafrost_thaw: { family: 'thermal', onset: 'chronic', climateDriven: true, euTaxonomy: 'Permafrost thawing' },
  drought: { family: 'water', onset: 'acute', climateDriven: true, euTaxonomy: 'Drought' },
  water_stress: { family: 'water', onset: 'chronic', climateDriven: true, euTaxonomy: 'Water stress' },
  groundwater_decline: { family: 'water', onset: 'chronic', climateDriven: true, euTaxonomy: 'Water stress (groundwater)' },
  saline_intrusion: { family: 'water', onset: 'chronic', climateDriven: true, euTaxonomy: 'Saline intrusion' },
  wildfire: { family: 'fire', onset: 'acute', climateDriven: true, euTaxonomy: 'Wildfire' },
  subsidence: { family: 'ground', onset: 'acute', climateDriven: true, euTaxonomy: 'Subsidence' },
  landslide: { family: 'ground', onset: 'acute', climateDriven: true, euTaxonomy: 'Landslide' },
  coastal_erosion: { family: 'ground', onset: 'chronic', climateDriven: true, euTaxonomy: 'Coastal erosion' },
  avalanche: { family: 'ground', onset: 'acute', climateDriven: true, euTaxonomy: 'Avalanche' },
  earthquake: { family: 'ground', onset: 'acute', climateDriven: false, euTaxonomy: '— (geophysical, outside Appendix A)' },
  tsunami: { family: 'ground', onset: 'acute', climateDriven: false, euTaxonomy: '— (geophysical, outside Appendix A)' },
  volcano: { family: 'ground', onset: 'acute', climateDriven: false, euTaxonomy: '— (geophysical, outside Appendix A)' },
};

// ---------------------------------------------------------------- geometry helpers
const R = 6371;
function dist(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
const inBox = (lat: number, lon: number, [s, n, w, e]: [number, number, number, number]) => lat >= s && lat <= n && lon >= w && lon <= e;
const sat = (x: number, k: number) => 100 * (1 - Math.exp(-Math.max(0, x) / k));

// Seismic belts: [lat, lon, intensity 0-1, subduction?]
const SEISMIC: Array<[number, number, number, boolean]> = [
  [35.7, 139.7, 1, true], [38.3, 142.4, 1, true], [43, 145, 1, true], [34.7, 135.5, 0.9, true], [53, 160, 1, true], [52, -175, 0.9, true],
  [61, -150, 1, true], [45, -124.5, 0.8, true], [37.8, -122.4, 0.9, false], [34, -118.2, 0.9, false], [17, -100, 1, true], [19.4, -99.1, 0.85, true],
  [13, -89, 0.9, true], [1, -79, 0.9, true], [-12, -77, 1, true], [-33, -71.6, 1, true], [-38, -73, 1, true], [-41.3, 174.8, 0.9, true],
  [-20, -175, 0.9, true], [-6, 147, 0.9, true], [-1, 100, 1, true], [-7.5, 110, 0.9, true], [14.6, 121, 1, true], [23.7, 121, 1, true],
  [26, 128, 0.8, true], [40.8, 29, 1, false], [39, 40, 0.9, false], [38, 22, 0.8, true], [42, 13.5, 0.8, false], [37.5, 15, 0.7, true],
  [35.7, 51.4, 0.9, false], [30, 57, 0.8, false], [34.5, 70, 0.8, false], [28, 84, 1, false], [27.7, 85.3, 1, false], [34, 74.8, 0.8, false],
  [26, 92, 0.8, false], [21, 96, 0.7, false], [31, 103.5, 0.9, false], [30, 90, 0.6, false], [42, 44, 0.6, false], [36.5, 3, 0.6, false],
  [31, -8, 0.5, false], [36.5, -10, 0.5, true], [-3, 36, 0.5, false], [9, 40, 0.5, false], [18.5, -72.3, 0.8, true], [64, -21, 0.5, false],
  [36.5, -89.6, 0.5, false], [40.7, -111.9, 0.5, false], [23.5, 70, 0.6, false], [28.6, 77.2, 0.45, false], [37.5, 128.5, 0.25, false],
];

const VOLCANOES: Array<[number, number]> = [
  [40.82, 14.43], [37.75, 14.99], [35.36, 138.73], [31.58, 130.66], [-7.54, 110.45], [13.26, 123.69], [14.0, 120.99], [15.13, 120.35],
  [19.02, -98.62], [14.47, -90.88], [-0.68, -78.44], [46.85, -121.76], [46.2, -122.18], [19.41, -155.29], [63.98, -19.7], [63.63, -19.05],
  [-39.28, 175.57], [-39.42, -71.93], [-1.52, 29.25], [-8.34, 115.51], [-6.1, 105.42], [56.06, 160.64], [56.65, 161.36], [40.83, 14.14],
  [16.72, -62.18], [14.82, -61.17], [-16.35, -70.9], [3.17, 98.39], [-39.3, 174.06], [32.88, 131.1], [35.89, 137.48], [64.64, -17.53],
  [28.27, -16.64], [28.57, -17.84], [36.4, 25.4], [35.95, 52.11], [41.99, 128.08], [-8.25, 118.0], [-38.12, 176.5], [13.85, -89.63],
];

export interface ExtendedContext {
  lat: number;
  lon: number;
  elevation: number;
  distanceToOceanKm: number;
  isArid: boolean;
  waterStressAbs: number;
  isTropicalZone: boolean;
}

type Baseline = { baseScore: number; baseAbsolute: number };

export function computeExtendedBaselines(c: ExtendedContext): Record<ExtendedHazard, Baseline> {
  const { lat, lon, elevation: elev, distanceToOceanKm: dOcean, isArid } = c;
  const absLat = Math.abs(lat);

  // --- Sea level rise (chronic): only very low-lying coastal land
  let slr: Baseline = { baseScore: 0, baseAbsolute: 0 };
  if (dOcean <= 40 && elev <= 5) {
    const s = elev <= 0 ? 70 : elev <= 1 ? 60 : elev <= 2 ? 45 : elev <= 3 ? 30 : 15;
    slr = { baseScore: s * (1 - dOcean / 80), baseAbsolute: 0.05 };
  }

  // --- Coastal erosion
  let erosion: Baseline = { baseScore: 0, baseAbsolute: 0 };
  if (dOcean <= 20 && elev < 15) {
    const retreat = elev < 3 ? 1.5 : 0.5;
    erosion = { baseScore: sat(retreat, 1.2) * (1 - dOcean / 40), baseAbsolute: retreat };
  }

  // --- Saline intrusion
  let saline: Baseline = { baseScore: 0, baseAbsolute: 0 };
  if (dOcean <= 25 && elev < 10) {
    const s = isArid || c.waterStressAbs > 50 ? 60 : elev < 3 ? 55 : 35;
    saline = { baseScore: s, baseAbsolute: 2 + 8 * (s / 100) };
  }

  // --- Groundwater decline (Aqueduct-style overdraft regions)
  const gwBoxes: Array<[[number, number, number, number], number]> = [
    [[26, 32, 72, 80], 40], [[34, 40, 113, 119], 35], [[35, 40.5, -122.5, -118.5], 30], [[32, 43, -104, -98], 30],
    [[20, 33, 36, 56], 50], [[28, 38, 48, 62], 45], [[19, 20, -99.5, -98.8], 30], [[22, 27, 82, 91], 15],
  ];
  let gwCm = isArid ? 12 : c.waterStressAbs > 50 ? 6 : 1;
  for (const [b, v] of gwBoxes) if (inBox(lat, lon, b)) gwCm = Math.max(gwCm, v);
  const groundwater: Baseline = { baseScore: sat(gwCm, 25), baseAbsolute: gwCm };

  // --- Extratropical windstorm (peak gust km/h)
  let gust = absLat >= 35 && absLat <= 70 ? 95 : absLat >= 25 ? 80 : 60;
  const stormBelts: Array<[number, number, number, number]> = [[45, 62, -11, 25], [40, 60, -130, -115], [38, 50, -80, -60], [33, 45, 125, 146], [-55, -35, -80, 180]];
  if (stormBelts.some((b) => inBox(lat, lon, b))) gust = 120 + 50 * Math.max(0, 1 - dOcean / 500);
  const windstorm: Baseline = { baseScore: Math.max(0, Math.min(95, (gust - 80) * 0.9)), baseAbsolute: Math.round(gust) };

  // --- Hail (hail days/yr)
  const hailBoxes: Array<[[number, number, number, number], number]> = [
    [[37, 41, -106, -102], 8], [[30, 45, -105, -92], 6], [[-38, -26, -66, -58], 7], [[-30, -24, 25, 32], 6], [[44, 46.5, 7, 14], 4],
    [[49, 54, -115, -100], 4], [[44, 52, 5, 25], 3], [[22, 34, 72, 92], 3], [[30, 42, 100, 120], 3], [[-36, -26, 145, 154], 3],
  ];
  let hailDays = absLat >= 25 && absLat <= 55 && dOcean > 50 ? 1.5 : 0.5;
  for (const [b, v] of hailBoxes) if (inBox(lat, lon, b)) hailDays = Math.max(hailDays, v);
  if (absLat > 60) hailDays = 0.1;
  const hail: Baseline = { baseScore: sat(hailDays, 4.5), baseAbsolute: Math.round(15 + 6 * hailDays) };

  // --- Tornado (index 0-10)
  const tornadoBoxes: Array<[[number, number, number, number], number]> = [
    [[30, 45, -103, -88], 8], [[30, 37, -92, -84], 6], [[21, 26.5, 88, 92.5], 4], [[-38, -28, -64, -57], 3], [[43, 53, -100, -75], 2],
    [[-30, -24, 26, 31], 1.5], [[45, 55, 0, 25], 1], [[-38, -26, 138, 153], 1], [[28, 36, 112, 122], 1],
  ];
  let tIdx = absLat >= 25 && absLat <= 55 ? 0.3 : 0.05;
  for (const [b, v] of tornadoBoxes) if (inBox(lat, lon, b)) tIdx = Math.max(tIdx, v);
  const tornado: Baseline = { baseScore: sat(tIdx, 4), baseAbsolute: tIdx };

  // --- Lightning (flashes/km²/yr)
  const lightningBoxes: Array<[[number, number, number, number], number]> = [
    [[8, 11, -73, -70], 100], [[-5, 5, 15, 30], 70], [[-10, 20, 95, 125], 40], [[25, 33, 72, 90], 30], [[-25, -5, -60, -40], 30],
    [[25, 31, -87.6, -80], 25], [[29, 36, -95, -78], 15],
  ];
  let fd = isArid ? 2 : c.isTropicalZone ? (dOcean > 50 ? 30 : 15) : absLat < 50 ? 5 : 0.5;
  for (const [b, v] of lightningBoxes) if (inBox(lat, lon, b)) fd = Math.max(fd, v);
  const lightning: Baseline = { baseScore: sat(fd, 25), baseAbsolute: fd };

  // --- Sand & dust storms (days/yr)
  const dustBoxes: Array<[[number, number, number, number], number]> = [
    [[15, 32, 36, 58], 30], [[12, 32, -17, 35], 25], [[36, 46, 75, 112], 25], [[24, 36, 56, 75], 20], [[-32, -20, 120, 145], 8],
    [[36, 42, 112, 118], 6], [[31, 37, -117, -105], 5],
  ];
  let dust = isArid ? 10 : 0.5;
  for (const [b, v] of dustBoxes) if (inBox(lat, lon, b)) dust = Math.max(dust, v);
  const sandDust: Baseline = { baseScore: sat(dust, 15), baseAbsolute: dust };

  // --- Permafrost thaw
  let pf = 0;
  // Continuous/discontinuous permafrost: Arctic, plus cold continental interiors (Siberia, N. Canada, Alaska).
  // Maritime Scandinavia, Iceland and the Baltic (warmed by the North Atlantic) are excluded below 66°N.
  const northAtlanticMild = lon >= -25 && lon <= 40 && absLat < 70;
  if (absLat >= 66 && !northAtlanticMild) pf = 80;
  else if (absLat >= 66) pf = 30;
  else if (absLat >= 58 && !northAtlanticMild && dOcean > 150) pf = 50;
  else if (absLat >= 50 && dOcean > 600 && !northAtlanticMild) pf = 25;
  if (elev > 4000 && absLat >= 25 && absLat <= 40) pf = Math.max(pf, 65);
  const permafrost: Baseline = { baseScore: pf, baseAbsolute: pf > 0 ? Math.round(pf / 4) : 0 };

  // --- Avalanche
  let av = 0;
  if (elev > 2500 && absLat > 20) av = 60;
  else if (elev > 1500 && absLat > 35) av = 45;
  const avalanche: Baseline = { baseScore: av, baseAbsolute: av / 10 };

  // --- Glacial lake outburst flood
  const glofZones: Array<[[number, number, number, number], number, number]> = [
    [[27, 36, 72, 97], 2000, 55], [[-18, -8, -78, -70], 2500, 45], [[38, 44, 68, 82], 1500, 35], [[55, 62, -140, -125], 500, 25], [[45.5, 47.8, 6, 14.5], 1500, 25],
  ];
  let glof = 0;
  for (const [b, minElev, v] of glofZones) if (inBox(lat, lon, b) && elev >= minElev) glof = Math.max(glof, v);
  const glacial: Baseline = { baseScore: glof, baseAbsolute: glof / 10 };

  // --- Earthquake (distance decay from seismic belts)
  let eqScore = 0;
  let pga = 0.02;
  let subductionDist = Infinity;
  let subductionW = 0;
  for (const [la, lo, w, sub] of SEISMIC) {
    const d = dist(lat, lon, la, lo);
    eqScore = Math.max(eqScore, 95 * w * Math.exp(-d / 220));
    pga = Math.max(pga, 0.7 * w * Math.exp(-d / 220));
    if (sub && d < subductionDist) {
      subductionDist = d;
      subductionW = w;
    }
  }
  const earthquake: Baseline = { baseScore: Math.max(2, eqScore), baseAbsolute: Number(pga.toFixed(3)) };

  // --- Tsunami (low coastal land within reach of a subduction zone)
  let tsunami: Baseline = { baseScore: 0, baseAbsolute: 0 };
  if (dOcean <= 25 && elev <= 20 && subductionDist < 1500) {
    const f = subductionW * Math.exp(-subductionDist / 700) * (1 - elev / 20) * (1 - dOcean / 25);
    if (f > 0.01) tsunami = { baseScore: 85 * f + 5, baseAbsolute: Number((12 * f).toFixed(2)) };
  }

  // --- Volcano
  let vd = Infinity;
  for (const [la, lo] of VOLCANOES) vd = Math.min(vd, dist(lat, lon, la, lo));
  const vScore = 90 * Math.exp(-vd / 45);
  const volcano: Baseline = vScore >= 2 ? { baseScore: vScore, baseAbsolute: Number((50 * Math.exp(-vd / 40)).toFixed(2)) } : { baseScore: 0, baseAbsolute: 0 };

  return {
    sea_level_rise: slr,
    coastal_erosion: erosion,
    saline_intrusion: saline,
    groundwater_decline: groundwater,
    extratropical_storm: windstorm,
    hail,
    tornado,
    lightning,
    sand_dust_storm: sandDust,
    permafrost_thaw: permafrost,
    avalanche,
    glacial_lake_outburst: glacial,
    earthquake,
    tsunami,
    volcano,
  };
}

/**
 * How each extended hazard responds to warming. dm = scenario decade factor (1.0 today),
 * slr = sea level rise in metres. Returns undefined for hazards handled by the core engine.
 */
export function extendedClimateFactor(hId: HazardType, dm: number, slr: number): number | undefined {
  switch (hId) {
    case 'sea_level_rise': return 1 + slr / 0.35;
    case 'coastal_erosion': return 1 + slr * 2;
    case 'saline_intrusion': return 1 + slr * 1.5;
    case 'groundwater_decline': return 1 + (dm - 1) * 0.5;
    case 'extratropical_storm': return 1 + (dm - 1) * 0.15;
    case 'hail': return 1 + (dm - 1) * 0.4;
    case 'tornado': return 1 + (dm - 1) * 0.25;
    case 'lightning': return 1 + (dm - 1) * 0.5;
    case 'sand_dust_storm': return 1 + (dm - 1) * 0.3;
    case 'permafrost_thaw': return Math.pow(dm, 0.8);
    case 'avalanche': return 1;
    case 'glacial_lake_outburst': return Math.pow(dm, 0.7);
    case 'earthquake':
    case 'volcano': return 1;
    case 'tsunami': return 1 + slr * 0.3;
    default: return undefined;
  }
}

export const EXTENDED_DEFAULT_WEIGHTS: Record<ExtendedHazard, number> = {
  sea_level_rise: 1.0, coastal_erosion: 0.8, saline_intrusion: 0.6, groundwater_decline: 0.6,
  extratropical_storm: 0.9, hail: 0.9, tornado: 1.0, lightning: 0.5, sand_dust_storm: 0.5,
  permafrost_thaw: 0.8, avalanche: 0.8, glacial_lake_outburst: 0.9,
  earthquake: 1.2, tsunami: 1.2, volcano: 1.0,
};

/** Asset-type specific vulnerability for the extended hazards. */
export function applyExtendedWeightTweaks(lower: string, w: Record<HazardType, number>) {
  const has = (...k: string[]) => k.some((x) => typeHasKeyword(lower, x));
  if (has('semiconductor', 'cleanroom', 'foundry', 'nanotech', 'wafer')) Object.assign(w, { earthquake: 2.4, lightning: 1.4, sand_dust_storm: 1.6, saline_intrusion: 1.4 });
  if (has('data center', 'telecom', 'switch', 'fiber')) Object.assign(w, { lightning: 1.5, earthquake: 1.6, sand_dust_storm: 1.3 });
  if (has('port', 'dock', 'shipping', 'marine', 'ferry', 'terminal')) Object.assign(w, { tsunami: 2.5, sea_level_rise: 2.2, coastal_erosion: 1.8, saline_intrusion: 1.3 });
  if (has('solar', 'pv')) Object.assign(w, { hail: 2.5, sand_dust_storm: 1.8, tornado: 1.5 });
  if (has('wind')) Object.assign(w, { lightning: 2.2, tornado: 1.8, extratropical_storm: 1.9, earthquake: 0.8 });
  if (has('tower', 'office', 'residential', 'skyscraper')) Object.assign(w, { earthquake: 1.8, extratropical_storm: 1.4 });
  if (has('warehouse', 'logistics', 'fulfillment')) Object.assign(w, { hail: 1.4, tornado: 2.0, extratropical_storm: 1.4 });
  if (has('hospital', 'medical', 'health')) Object.assign(w, { earthquake: 2.0, tsunami: 1.8 });
  if (has('nuclear', 'reactor')) Object.assign(w, { earthquake: 2.5, tsunami: 2.5, sea_level_rise: 1.6 });
  if (has('pipeline', 'oil', 'gas', 'refinery', 'petrochemical')) Object.assign(w, { permafrost_thaw: 2.0, earthquake: 1.6, lightning: 1.3 });
  if (has('hydro', 'dam')) Object.assign(w, { glacial_lake_outburst: 2.2, earthquake: 1.8, avalanche: 1.4 });
  if (has('rail', 'road', 'highway', 'airport', 'bridge')) Object.assign(w, { permafrost_thaw: 1.8, avalanche: 1.5, coastal_erosion: 1.2 });
  if (has('transmission', 'substation', 'grid', 'hvdc')) Object.assign(w, { lightning: 1.8, extratropical_storm: 1.5, earthquake: 1.4 });
  if (has('water', 'desalination', 'wastewater', 'filtration')) Object.assign(w, { saline_intrusion: 2.2, groundwater_decline: 1.8 });
  if (has('farm', 'crop', 'agri', 'vineyard', 'plantation', 'forest')) Object.assign(w, { hail: 2.2, groundwater_decline: 1.8, saline_intrusion: 1.6, sand_dust_storm: 1.2 });
}

export function extendedAdaptation(h: HazardType): string[] | undefined {
  switch (h) {
    case 'sea_level_rise': return ['Raise critical floor levels and equipment above projected 2100 high-tide line', 'Secure managed-retreat or relocation option for lowest-lying assets', 'Join or co-fund local dike / seawall upgrade programmes'];
    case 'coastal_erosion': return ['Commission a shoreline monitoring survey and set a retreat trigger distance', 'Nature-based buffers: dune restoration, mangroves, beach nourishment', 'Deepen and pile foundations near the eroding frontage'];
    case 'saline_intrusion': return ['Add salinity monitoring on intake water and switch-over to alternative supply', 'Install pre-treatment or reverse osmosis for process water', 'Reduce reliance on shallow coastal aquifers'];
    case 'groundwater_decline': return ['Diversify supply away from local groundwater (recycled, municipal, desalinated)', 'Deepen wells only with a basin-level sustainability assessment', 'Install water-efficient cooling and closed-loop processes'];
    case 'extratropical_storm': return ['Upgrade roof fixings and cladding to current wind-load codes', 'Trim or remove trees near structures and overhead lines', 'Pre-storm shutdown and securing protocol for cranes and rooftop plant'];
    case 'hail': return ['Specify hail-rated (IEC 61215 / FM 4473) roofing and solar modules', 'Automated stow-to-vertical for trackers on hail alerts', 'Install hail netting over vehicles and sensitive outdoor equipment'];
    case 'tornado': return ['Build an ICC 500 storm shelter / safe room for staff', 'Reinforce roof-to-wall connections and large openings', 'Distribute critical spares across sites to limit single-strike outages'];
    case 'lightning': return ['Install IEC 62305 lightning protection and equipotential bonding', 'Add surge protective devices on power, data and control lines', 'Lightning-warning-triggered work stoppage for outdoor crews'];
    case 'sand_dust_storm': return ['Multi-stage air intake filtration with differential-pressure alarms', 'Robotic or scheduled solar panel cleaning', 'Seal electrical enclosures to IP65 or better'];
    case 'permafrost_thaw': return ['Thermosyphons or ventilated foundations to keep ground frozen', 'Adjustable or screw-pile foundations that tolerate settlement', 'Ground-temperature monitoring along pipelines and roads'];
    case 'avalanche': return ['Snow fences, deflection dams and snow sheds over access routes', 'Avalanche forecasting subscription and closure protocols', 'Site new structures outside mapped runout zones'];
    case 'glacial_lake_outburst': return ['Join regional GLOF early-warning systems with downstream sirens', 'Raise or relocate critical plant above outburst flood levels', 'Engineered spillways / lake lowering in partnership with authorities'];
    case 'earthquake': return ['Seismic assessment and retrofit to current code (ASCE 41 / Eurocode 8)', 'Base isolation or anchoring for vibration-sensitive equipment', 'Earthquake business-continuity plan with alternate production site'];
    case 'tsunami': return ['Vertical evacuation refuge above expected run-up height', 'Locate critical equipment on upper floors / landward side', 'Tsunami warning integration and drills'];
    case 'volcano': return ['Ash-resistant air filtration and roof load assessment for ashfall', 'Volcano observatory alert subscription and shutdown plan', 'Stock spare filters and plan for transport / aviation disruption'];
    default: return undefined;
  }
}
