// Hazard catalogue, scenarios and scoring. Values come only from engine/assess.ts (open data).
import { scoreFrom } from '../lib/stats';
import type { SourceId } from '../data/api';

export type Family = 'flood' | 'heat' | 'wind' | 'water' | 'fire' | 'ground';
export const FAMILIES: Array<{ id: Family; name: string; short: string; color: string }> = [
  { id: 'flood', name: 'Flood & sea', short: 'Flood', color: '#2563eb' },
  { id: 'heat', name: 'Heat & cold', short: 'Heat', color: '#db2777' },
  { id: 'wind', name: 'Wind & storms', short: 'Wind', color: '#7c3aed' },
  { id: 'water', name: 'Water & drought', short: 'Water', color: '#0d9488' },
  { id: 'fire', name: 'Fire & dust', short: 'Fire', color: '#b45309' },
  { id: 'ground', name: 'Ground & geology', short: 'Ground', color: '#57534e' },
];

export type HazardId =
  | 'river_flood' | 'coastal_flood' | 'heavy_rain' | 'sea_level_rise'
  | 'extreme_heat' | 'heatwave' | 'heat_stress' | 'cold' | 'permafrost' | 'heavy_snow'
  | 'cyclone' | 'windstorm' | 'dust'
  | 'drought' | 'water_stress' | 'water_scarcity' | 'groundwater'
  | 'wildfire'
  | 'earthquake' | 'tsunami' | 'volcano' | 'landslide' | 'avalanche' | 'subsidence' | 'lightning'
  // listed honestly but not assessed (no open, licence-compatible global per-point source)
  | 'hail' | 'tornado' | 'saline' | 'erosion' | 'glof';

export type HazardDef = {
  id: HazardId; name: string; family: Family; unit: string; indicator: string;
  sources: SourceId[]; method: string; acute: boolean;
  /** thresholds at scores 20/40/60/80 (ascending), or reversed when smaller = worse */
  t?: [number, number, number, number]; reverse?: boolean; scoreNote?: string;
  notAssessed?: string;
};

export const HAZARDS: HazardDef[] = [
  { id: 'river_flood', name: 'River flood', family: 'flood', unit: 'm', indicator: '100-yr flood depth at site (90 m)', sources: ['jrc', 'glofas'], acute: true,
    method: 'Flood depth read pixel-by-pixel from the JRC / Copernicus CEMS-GloFAS global river flood hazard maps v2.1.2 (LISFLOOD-FP, 90 m, return periods 10–500 yr). Future: the CMIP6 change in 100-yr rainfall shifts the GloFAS 100-yr peak flow; its present-day return period (Gumbel fit to GloFAS 1984–2024, bounded to 20–500 yr) is then read off the JRC depth curve.',
    t: [0.05, 0.3, 1, 2], scoreNote: 'Depth classes used for JRC damage curves: >0.3 m ground-floor damage, >1 m severe, >2 m structural' },
  { id: 'coastal_flood', name: 'Coastal flood', family: 'flood', unit: 'm', indicator: '100-yr coastal flood depth (90 m)', sources: ['deltares', 'coast', 'elevation', 'marine', 'ar6'], acute: true,
    method: 'Deltares Global Flood Maps (storm surge + tide + sea level, with attenuation over land, NASADEM 90 m): 1-in-10 and 1-in-100-yr depths at 2018 sea level and 1-in-100 at 2050. Other years and scenarios scale the 2018→2050 change by the IPCC AR6 sea-level rise relative to SSP2-4.5 in 2050. Read only for sites within 50 km of the coast and below 30 m. If the Deltares store cannot be reached, highest observed water level (tide + surge, 2022–24) plus AR6 rise minus ground height is used and labelled.',
    t: [0.05, 0.3, 1, 2] },
  { id: 'heavy_rain', name: 'Heavy rain / flash flood', family: 'flood', unit: 'mm/day', indicator: '100-yr 1-day rainfall', sources: ['era5', 'cmip6'], acute: true,
    method: 'Gumbel fit to ERA5 annual-maximum daily rain 1981–2024. Future: CMIP6 ratio of 100-yr levels (2036–49 vs 1995–2014), scaled by scenario warming.',
    t: [115, 204, 300, 400], scoreNote: 'IMD classes: very heavy ≥115.6, extremely heavy ≥204.5 mm/day' },
  { id: 'sea_level_rise', name: 'Sea level rise', family: 'flood', unit: 'm', indicator: 'Global mean rise vs 2025', sources: ['ar6', 'elevation', 'coast', 'marine'], acute: false,
    method: 'IPCC AR6 median global sea-level rise for the scenario and year, compared with ground elevation and local highest water level within 30 km of the coast.' },
  { id: 'extreme_heat', name: 'Extreme heat days', family: 'heat', unit: 'days/yr', indicator: 'Days above 35 °C', sources: ['era5', 'cmip6'], acute: false,
    method: 'ERA5 daily maximum temperature 1995–2014; future by monthly delta change from CMIP6 (2036–49 minus 1995–2014), scaled by scenario warming.', t: [10, 30, 60, 100] },
  { id: 'heatwave', name: 'Heatwaves', family: 'heat', unit: 'days/yr', indicator: 'Warm-spell days (ETCCDI WSDI)', sources: ['era5', 'cmip6'], acute: true,
    method: 'ETCCDI warm spell duration index on ERA5 (runs ≥6 days above the local 90th percentile of 1995–2014); future by CMIP6 delta change.', t: [10, 30, 60, 100] },
  { id: 'heat_stress', name: 'Humid heat stress', family: 'heat', unit: '°C', indicator: 'Annual max wet-bulb temperature', sources: ['cmip6', 'era5'], acute: true,
    method: 'Stull (2011) wet-bulb from CMIP6 daily max temperature (bias-corrected to ERA5) and minimum relative humidity; mean of annual maxima.',
    t: [26, 28, 30, 32], scoreNote: 'Tw 31–35 °C is the limit for sustained human activity' },
  { id: 'cold', name: 'Cold & frost', family: 'heat', unit: 'days/yr', indicator: 'Frost days (Tmin < 0 °C)', sources: ['era5', 'cmip6'], acute: false,
    method: 'ERA5 daily minimum temperature 1995–2014; future by CMIP6 monthly delta change.', t: [10, 30, 60, 120] },
  { id: 'permafrost', name: 'Permafrost thaw', family: 'heat', unit: '°C', indicator: 'Mean annual air temperature', sources: ['era5', 'cmip6'], acute: false,
    method: 'Permafrost climate where ERA5 mean annual air temperature < −2 °C; thaw risk rises as the projected temperature approaches 0 °C.' },
  { id: 'heavy_snow', name: 'Heavy snowfall', family: 'heat', unit: 'cm/day', indicator: '50-yr 1-day snowfall', sources: ['era5'], acute: true,
    method: 'Gumbel fit to ERA5 annual-maximum daily snowfall 1981–2024 (present day; no future change applied).', t: [10, 25, 50, 80] },
  { id: 'cyclone', name: 'Tropical cyclone', family: 'wind', unit: 'km/h', indicator: '100-yr sustained wind (1-min equivalent)', sources: ['storm', 'ibtracs'], acute: true,
    method: 'STORM synthetic-track wind return periods (Bloemendaal et al., 10 km, 10 000 years of synthetic cyclones incl. decay over land). 10-min winds converted to 1-min with the WMO factor 0.88. Future: mean change of the 1-in-100-yr wind across the four STORM HighResMIP GCMs (2015–2050, SSP5-8.5), scaled by scenario warming. If STORM cannot be read, IBTrACS tracks (1970–2017) are used and labelled.',
    t: [62, 89, 118, 166], scoreNote: 'IMD: cyclonic storm 62, severe 89, very severe 118, extremely severe 166 km/h' },
  { id: 'windstorm', name: 'Windstorm', family: 'wind', unit: 'km/h', indicator: '50-yr peak gust', sources: ['era5', 'cmip6'], acute: true,
    method: 'Gumbel fit to ERA5 annual-maximum 10 m gusts 1981–2024. Future: CMIP6 ratio of 50-yr daily max wind.', t: [70, 90, 118, 150] },
  { id: 'dust', name: 'Sand & dust storms', family: 'fire', unit: 'days/yr', indicator: 'Days with dust > 100 µg/m³', sources: ['cams'], acute: true,
    method: 'Copernicus CAMS global surface dust, daily means 2023–2024 (present day).', t: [3, 10, 25, 50] },
  { id: 'drought', name: 'Drought', family: 'water', unit: '% of months', indicator: 'Months in severe drought (SPEI-12 < −1.5)', sources: ['era5', 'cmip6'], acute: false,
    method: 'Standardised precipitation-evapotranspiration index (12-month water balance, Hargreaves PET). Present: ERA5 2005–24 against 1981–2004. Future: CMIP6 2036–49 against 1995–2014.',
    t: [7, 12, 20, 30] },
  { id: 'water_stress', name: 'Water stress', family: 'water', unit: '/5', indicator: 'Aqueduct water-stress score (0–5)', sources: ['aqueduct'], acute: false,
    method: 'WRI Aqueduct 4.0 baseline water stress for the sub-basin (HydroBASINS level 6 × admin area). Future: Aqueduct 4.0 province projections for 2030 / 2050 / 2080 (optimistic SSP1-2.6, business-as-usual SSP3-7.0, pessimistic SSP5-8.5; SSP2-4.5 = mean of optimistic and BAU), applied as a change in Aqueduct score.',
    scoreNote: 'Aqueduct score 0–5 × 20: <10 % low, 10–20 % low-medium, 20–40 % medium-high, 40–80 % high, >80 % extremely high' },
  { id: 'water_scarcity', name: 'Aridity', family: 'water', unit: 'index', indicator: 'UNEP aridity index (P / PET)', sources: ['era5', 'cmip6'], acute: false,
    method: 'Annual precipitation over Hargreaves potential evapotranspiration, ERA5 1995–2014; future by CMIP6 ratio.', t: [0.65, 0.5, 0.2, 0.05], reverse: true,
    scoreNote: 'UNEP: <0.65 dry sub-humid, <0.5 semi-arid, <0.2 arid, <0.05 hyper-arid' },
  { id: 'groundwater', name: 'Groundwater decline', family: 'water', unit: 'cm/yr', indicator: 'Groundwater table decline trend', sources: ['aqueduct', 'wtd'], acute: false,
    method: 'WRI Aqueduct 4.0 groundwater table decline (GRACE-informed well trends, 1990–2014) for the sub-basin, with the modelled mean water-table depth shown for context. Present day only.',
    scoreNote: 'Aqueduct score 0–5 × 20: <0 none, 0–2, 2–4, 4–8, >8 cm/yr' },
  { id: 'wildfire', name: 'Wildfire weather', family: 'fire', unit: 'days/yr', indicator: 'Days with Fire Weather Index > 38', sources: ['cmip6'], acute: true,
    method: 'Canadian Fire Weather Index (Van Wagner 1987) from CMIP6 daily weather; EFFIS "very high" class (> 38). Fuel availability is not modelled.', t: [2, 10, 30, 60] },
  { id: 'earthquake', name: 'Earthquake', family: 'ground', unit: 'g', indicator: 'PGA, 10% in 50 yr (475-yr)', sources: ['usgs'], acute: true,
    method: 'Historic-parametric PSHA: every USGS M4.5+ event within 300 km since 1973, Campbell (1997) ground motion with σ = 0.55. A 50-year catalogue can understate rare large events.',
    t: [0.04, 0.08, 0.24, 0.4], scoreNote: 'GSHAP: low <0.08 g, moderate <0.24, high <0.40, very high ≥0.40' },
  { id: 'tsunami', name: 'Tsunami', family: 'ground', unit: 'm', indicator: 'Highest recorded run-up within 60 km', sources: ['ncei', 'coast', 'elevation'], acute: true,
    method: 'NOAA NCEI historical run-ups within 60 km, for sites within 20 km of the coast and below 40 m; reduced when the site sits above the largest run-up.', t: [0.5, 1, 3, 10] },
  { id: 'volcano', name: 'Volcano', family: 'ground', unit: 'km', indicator: 'Distance to nearest Holocene volcano', sources: ['gvp'], acute: true,
    method: 'Distance bands used by the Smithsonian GVP for population exposure (10 / 30 / 100 km).', t: [100, 50, 30, 10], reverse: true },
  { id: 'landslide', name: 'Landslide', family: 'ground', unit: '', indicator: 'Susceptibility (India: ILSM probability; elsewhere slope × rain)', sources: ['ilsm', 'elevation', 'era5'], acute: true,
    method: 'India: India Landslide Susceptibility Map (IIT Bombay, 100 m ensemble-ML probability, 2023). Elsewhere: Horn slope from a 3×3 Copernicus DEM window (~90 m), weighted by the 100-yr daily rainfall (rain-triggered susceptibility, as in NASA LHASA). Future: scaled with the CMIP6 change in 100-yr rainfall.',
    t: [5, 12, 20, 30], scoreNote: 'ILSM probability: 0.2 / 0.4 / 0.6 / 0.8 → 20 / 40 / 60 / 80' },
  { id: 'avalanche', name: 'Avalanche', family: 'ground', unit: 'cm/yr', indicator: 'Annual snowfall on slopes ≥ 25°', sources: ['era5', 'elevation'], acute: true,
    method: 'Requires slope ≥ 25° (DEM) and mean annual snowfall (ERA5); scaled by snowfall.', t: [50, 150, 300, 600] },
  { id: 'subsidence', name: 'Land subsidence', family: 'ground', unit: 'mm/yr', indicator: 'Subsidence rate', sources: ['subsidence'], acute: false,
    method: 'Global ~1 km map of subsidence rates trained on InSAR / GNSS observations (Davydzenka, Tahmasebi & Shokri, GRL 2024). Where the site pixel is masked, the mean of valid pixels within ~2 km is used and labelled. Present day only.',
    t: [2, 5, 10, 25] },
  { id: 'lightning', name: 'Lightning', family: 'wind', unit: 'strokes/km²/yr', indicator: 'Annual WWLLN stroke density', sources: ['wglc'], acute: true,
    method: 'WWLLN Global Lightning Climatology (Kaplan & Lau), 0.5° monthly climatology summed to a year. Scored by the percentile of the cell among all cells with recorded lightning (WWLLN detects a fraction of all flashes, so absolute values are low). Present day only.',
    scoreNote: 'Score = percentile among cells with lightning' },
  { id: 'hail', name: 'Hail', family: 'wind', unit: '', indicator: '', sources: [], acute: true, method: '', notAssessed: 'No open global hail hazard map with a commercial-use licence.' },
  { id: 'tornado', name: 'Tornado', family: 'wind', unit: '', indicator: '', sources: [], acute: true, method: '', notAssessed: 'No open global tornado climatology outside the US and Europe.' },
  { id: 'saline', name: 'Saline intrusion', family: 'water', unit: '', indicator: '', sources: [], acute: false, method: '', notAssessed: 'No open global dataset.' },
  { id: 'erosion', name: 'Coastal erosion', family: 'flood', unit: '', indicator: '', sources: [], acute: false, method: '', notAssessed: 'JRC / Deltares shoreline-change data are not served for point reads.' },
  { id: 'glof', name: 'Glacial lake outburst', family: 'flood', unit: '', indicator: '', sources: [], acute: true, method: '', notAssessed: 'Glacial lake inventories (Hi-MAG, ICIMOD) give lake outlines, not downstream flood extents.' },
];
export const HAZARD = Object.fromEntries(HAZARDS.map((h) => [h.id, h])) as Record<HazardId, HazardDef>;
export const ASSESSED = HAZARDS.filter((h) => !h.notAssessed);

// ---- scenarios -----------------------------------------------------------------------------------
export type Scenario = 'ssp126' | 'ssp245' | 'ssp370' | 'ssp585';
export const SCENARIOS: Array<{ id: Scenario; label: string; warming: string }> = [
  { id: 'ssp126', label: 'SSP1-2.6', warming: '+1.8 °C' },
  { id: 'ssp245', label: 'SSP2-4.5', warming: '+2.7 °C' },
  { id: 'ssp370', label: 'SSP3-7.0', warming: '+3.6 °C' },
  { id: 'ssp585', label: 'SSP5-8.5', warming: '+4.4 °C' },
];
export const YEARS = [2025, 2030, 2040, 2050, 2060, 2070, 2080, 2090] as const;
export type Year = (typeof YEARS)[number];
const YI: Record<number, number> = { 2025: 0, 2030: 1, 2040: 2, 2050: 3, 2060: 4, 2070: 5, 2080: 6, 2090: 7 };
// IPCC AR6 median warming above 1850–1900 (°C)
const WARM: Record<Scenario, number[]> = {
  ssp126: [1.3, 1.45, 1.6, 1.7, 1.8, 1.8, 1.8, 1.8],
  ssp245: [1.3, 1.45, 1.7, 2.0, 2.2, 2.4, 2.6, 2.7],
  ssp370: [1.3, 1.45, 1.75, 2.1, 2.5, 2.9, 3.3, 3.6],
  ssp585: [1.3, 1.5, 1.85, 2.4, 2.8, 3.3, 3.8, 4.3],
};
// IPCC AR6 Table 9.9 median global sea-level rise (m) rebased to 2025
const SLR: Record<Scenario, number[]> = {
  ssp126: [0, 0.02, 0.06, 0.11, 0.15, 0.2, 0.25, 0.3],
  ssp245: [0, 0.02, 0.07, 0.12, 0.18, 0.24, 0.31, 0.38],
  ssp370: [0, 0.02, 0.07, 0.13, 0.2, 0.28, 0.36, 0.45],
  ssp585: [0, 0.02, 0.08, 0.15, 0.22, 0.31, 0.41, 0.52],
};
/** Pattern-scaling factor: warming above the 1995–2014 baseline (+0.85 °C) relative to the CMIP6 2036–49 HighResMIP window (+1.35 °C). */
export const warmingFactor = (s: Scenario, y: Year) => Math.min(3, Math.max(0, (WARM[s][YI[y]] - 0.85) / 1.35));
export const warmingAboveBaseline = (s: Scenario, y: Year) => WARM[s][YI[y]] - 0.85;
export const seaLevelRise = (s: Scenario, y: Year) => SLR[s][YI[y]];
/** Loan maturity → analysis year: the first listed year at or after maturity (capped at 2090). */
export const yearForMaturity = (maturity: number): Year => (YEARS.find((y) => y >= maturity) ?? 2090);

// ---- ratings ------------------------------------------------------------------------------------
export type Rating = 'Very low' | 'Low' | 'Moderate' | 'High' | 'Severe';
export const RATINGS: Rating[] = ['Very low', 'Low', 'Moderate', 'High', 'Severe'];
export const ratingOf = (s: number): Rating => (s >= 80 ? 'Severe' : s >= 60 ? 'High' : s >= 40 ? 'Moderate' : s >= 20 ? 'Low' : 'Very low');
export const RATING_COLOR: Record<Rating, string> = { 'Very low': '#16a34a', Low: '#65a30d', Moderate: '#ca8a04', High: '#ea580c', Severe: '#dc2626' };

export function scoreFor(def: HazardDef, v: number): number {
  if (!def.t || !Number.isFinite(v)) return NaN;
  return Math.round(scoreFrom(v, def.t, def.reverse) * 10) / 10;
}
