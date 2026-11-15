// Transition risk: UNEP FI sector heatmap + NGFS Phase V carbon prices for the borrower's country,
// plus emitting assets near the site from Climate TRACE (fetched in data/datasets.ts).
import { NGFS_CARBON, NGFS_YEARS } from '../data/ngfs';

// ------------------------------------------------------------------ NGFS scenarios
export type NgfsScenario = 'NZ' | 'B2' | 'LD' | 'DT' | 'FW' | 'NDC' | 'CP';
export const NGFS_SCENARIOS: Array<{ id: NgfsScenario; label: string; family: string }> = [
  { id: 'NZ', label: 'Net Zero 2050', family: 'Orderly' },
  { id: 'B2', label: 'Below 2 °C', family: 'Orderly' },
  { id: 'LD', label: 'Low Demand', family: 'Orderly' },
  { id: 'DT', label: 'Delayed Transition', family: 'Disorderly' },
  { id: 'FW', label: 'Fragmented World', family: 'Too little, too late' },
  { id: 'NDC', label: 'Nationally Determined Contributions', family: 'Hot house world' },
  { id: 'CP', label: 'Current Policies', family: 'Hot house world' },
];
export type IamModel = 'G' | 'M' | 'R';
export const IAM_NAME: Record<IamModel, string> = { G: 'GCAM 6.0', M: 'MESSAGEix-GLOBIOM 2.0', R: 'REMIND-MAgPIE 3.3' };

const TABLE = new Map<string, number[]>();
for (const line of NGFS_CARBON.trim().split('\n')) {
  const [m, s, r, v] = line.split('|');
  TABLE.set(`${m}|${s}|${r}`, v.split(',').map(Number));
}

// ISO3 → model regions (published region definitions of each IAM)
const GCAM_OWN: Record<string, string> = { ARG: 'Argentina', AUS: 'Australia_NZ', NZL: 'Australia_NZ', BRA: 'Brazil', CAN: 'Canada', CHN: 'China', HKG: 'China', MAC: 'China', COL: 'Colombia', IND: 'India', JPN: 'Japan', ZAF: 'South Africa', KOR: 'South Korea', USA: 'USA' };
const EU12 = 'BGR CYP CZE EST HUN LTU LVA MLT POL ROU SVK SVN'.split(' ');
const EU15 = 'AUT BEL DNK FIN FRA DEU GRC IRL ITA LUX NLD PRT ESP SWE GBR'.split(' ');
const R12: Record<string, string> = {};
const add = (reg: string, list: string) => list.split(' ').forEach((c) => { R12[c] = reg; });
add('NAM', 'USA CAN PRI'); add('PAO', 'JPN AUS NZL'); add('CHN', 'CHN HKG MAC'); add('RCPA', 'KHM LAO MNG PRK VNM');
add('SAS', 'IND PAK BGD LKA NPL AFG BTN MDV'); add('PAS', 'IDN MYS PHL THA SGP KOR TWN MMR BRN TLS PNG FJI SLB VUT WSM TON KIR FSM MHL PLW NRU TUV');
add('WEU', 'AUT BEL DNK FIN FRA DEU GRC IRL ITA LUX NLD PRT ESP SWE GBR NOR CHE ISL LIE MCO AND SMR MLT CYP TUR GRL');
add('EEU', 'BGR CZE EST HUN LTU LVA POL ROU SVK SVN HRV ALB BIH MKD MNE SRB XKX');
add('FSU', 'RUS UKR BLR MDA ARM AZE GEO KAZ KGZ TJK TKM UZB');
add('MEA', 'DZA EGY LBY MAR TUN ESH ARE BHR IRN IRQ ISR JOR KWT LBN OMN PSE QAT SAU SYR YEM SDN');
add('LAM', 'ARG BOL BRA CHL COL ECU GUY PRY PER SUR URY VEN MEX BLZ CRI SLV GTM HND NIC PAN CUB DOM HTI JAM TTO BHS BRB GRD LCA VCT ATG DMA KNA ABW CUW GUF');
const REMIND: Record<string, string> = {};
const addR = (reg: string, list: string) => list.split(' ').forEach((c) => { REMIND[c] = reg; });
addR('USA', 'USA PRI'); addR('CAZ', 'CAN AUS NZL'); addR('CHA', 'CHN HKG MAC TWN'); addR('IND', 'IND'); addR('JPN', 'JPN');
addR('EUR', 'AUT BEL DNK FIN FRA DEU GRC IRL ITA LUX NLD PRT ESP SWE GBR BGR CYP CZE EST HUN LTU LVA MLT POL ROU SVK SVN HRV');
addR('NEU', 'NOR CHE ISL LIE TUR ALB BIH MKD MNE SRB XKX MCO AND SMR GRL');
addR('REF', 'RUS UKR BLR MDA ARM AZE GEO KAZ KGZ TJK TKM UZB');
addR('MEA', 'DZA EGY LBY MAR TUN ESH ARE BHR IRN IRQ ISR JOR KWT LBN OMN PSE QAT SAU SYR YEM SDN');
addR('LAM', 'ARG BOL BRA CHL COL ECU GUY PRY PER SUR URY VEN MEX BLZ CRI SLV GTM HND NIC PAN CUB DOM HTI JAM TTO BHS BRB GRD LCA VCT ATG DMA KNA ABW CUW GUF');
addR('OAS', 'PAK BGD LKA NPL AFG BTN MDV IDN MYS PHL THA SGP KOR MMR BRN TLS PNG KHM LAO MNG PRK VNM FJI SLB VUT WSM');
const AFRICA_SSA = 'AGO BEN BWA BFA BDI CMR CPV CAF TCD COM COD COG CIV DJI GNQ ERI SWZ ETH GAB GMB GHA GIN GNB KEN LSO LBR MDG MWI MLI MRT MUS MOZ NAM NER NGA RWA STP SEN SYC SLE SOM ZAF SSD TZA TGO UGA ZMB ZWE'.split(' ');
for (const c of AFRICA_SSA) { REMIND[c] ??= 'SSA'; R12[c] ??= 'AFR'; }

export function regionsFor(iso3: string): Record<IamModel, string | null> {
  const g = GCAM_OWN[iso3] ?? (EU12.includes(iso3) ? 'EU-12' : EU15.includes(iso3) ? 'EU-15' : null);
  return { G: g ?? (iso3 ? 'DEFAULT' : null), M: R12[iso3] ?? null, R: REMIND[iso3] ?? null };
}

function interp(v: number[], year: number): number {
  const ys = NGFS_YEARS as readonly number[];
  if (year <= ys[0]) return v[0];
  if (year >= ys[ys.length - 1]) return v[v.length - 1];
  for (let i = 1; i < ys.length; i++) if (year <= ys[i]) return v[i - 1] + ((v[i] - v[i - 1]) * (year - ys[i - 1])) / (ys[i] - ys[i - 1]);
  return NaN;
}
/** Shadow carbon price (US$2010/t CO₂) for a model region, linearly interpolated between NGFS years; held flat after 2070. */
export function carbonPrice(model: IamModel, s: NgfsScenario, region: string | null, year: number): number {
  if (!region) return NaN;
  const row = TABLE.get(`${model}|${s}|${region}`) ?? (model === 'G' ? TABLE.get(`G|${s}|DEFAULT`) ?? TABLE.get(`G|${s}|World`) : undefined);
  return row ? interp(row, year) : NaN;
}
export function worldPrice(model: IamModel, s: NgfsScenario, year: number) {
  const row = TABLE.get(`${model}|${s}|World`);
  return row ? interp(row, year) : NaN;
}
export const GCAM_REGION_LABEL = (r: string | null) => (r === 'DEFAULT' ? 'GCAM common path (regions not priced separately)' : r ?? '—');

// ₹ conversion: NGFS prices are in 2010 US dollars
export const CPI_2010_TO_2024 = 313.689 / 218.056; // US CPI-U annual averages (BLS)
export type FxSettings = { usdInr: number; asOf: string };
export const DEFAULT_FX: FxSettings = { usdInr: 94.94, asOf: 'RBI reference rate, 23 Oct 2026' };
export const toInrPerTonne = (usd2010: number, fx: FxSettings) => usd2010 * CPI_2010_TO_2024 * fx.usdInr;

// ------------------------------------------------------------------ UNEP FI transition heatmap
// "Beyond the Horizon" (UNEP FI TCFD Banking Programme, 2020), section 4: overall rating per segment under an
// ambitious (well-below 2 °C, 1.5 °C most aligned) transition, combining the views of 39 banks.
export type HeatRating = 'High' | 'Moderately high' | 'Moderate' | 'Moderately low' | 'Low' | 'Positive / no impact';
export const HEAT_SCORE: Record<HeatRating, number> = { High: 85, 'Moderately high': 68, Moderate: 50, 'Moderately low': 32, Low: 15, 'Positive / no impact': 5 };
export type Segment = { sector: string; segment: string; rating: HeatRating; kw: RegExp };
const S = (sector: string, segment: string, rating: HeatRating, kw: RegExp): Segment => ({ sector, segment, rating, kw });
export const HEATMAP: Segment[] = [
  S('Oil & Gas', 'Oil sands', 'Moderately high', /oil ?sand|tar sand|bitumen/),
  S('Oil & Gas', 'Shale oil', 'Moderately high', /shale oil|tight oil/),
  S('Oil & Gas', 'Shale gas', 'Moderately high', /shale gas/),
  S('Oil & Gas', 'Deepwater', 'Moderately high', /deep ?water|offshore drilling/),
  S('Oil & Gas', 'Oil refining', 'Moderately high', /refin/),
  S('Oil & Gas', 'Conventional oil (on/offshore)', 'Moderate', /crude|oil (exploration|production|field)|upstream oil|e&p/),
  S('Oil & Gas', 'Conventional gas (on/offshore)', 'Moderately low', /natural gas (production|field)|gas field|upstream gas/),
  S('Oil & Gas', 'Gas processing (LNG)', 'Moderate', /lng|gas processing/),
  S('Oil & Gas', 'Transportation & storage (oil)', 'Moderate', /oil (pipeline|storage|terminal)|petroleum storage/),
  S('Oil & Gas', 'Transportation & storage (gas)', 'Moderately low', /gas (pipeline|storage|distribution)|cgd|city gas/),
  S('Oil & Gas', 'Point of sale', 'Moderately low', /petrol pump|fuel station|filling station|petrol station|retail outlet.*fuel|fuel retail/),
  S('Oil & Gas', 'Integrated', 'Moderate', /integrated oil|oil (and|&) gas|petroleum/),
  S('Metals & Mining', 'Coal mining', 'High', /coal (min|wash)|colliery|lignite min/),
  S('Power Generation', 'Unregulated high-carbon (coal and oil)', 'High', /coal.*(power|plant|thermal)|thermal power|(power|plant).*coal|diesel power|ipp.*coal/),
  S('Power Generation', 'Unregulated medium-carbon (gas)', 'Moderately high', /gas.*(power|turbine)|(power|plant).*gas|ccgt/),
  S('Power Generation', 'Wind and solar', 'Low', /solar|wind (power|farm|energy)|wind ?mill|rooftop pv|photovolt/),
  S('Power Generation', 'Other renewables (non-nuclear)', 'Low', /hydro ?(power|electric)|small hydro|biomass power|geotherm|renewable/),
  S('Power Generation', 'Nuclear', 'Moderately low', /nuclear/),
  S('Power Generation', 'Grid operation / transmission', 'Moderately low', /transmission|grid|distribution (company|utility)|discom|power distribution/),
  S('Power Generation', 'Batteries / storage', 'Moderately low', /batter|energy storage/),
  S('Metals & Mining', 'Steel / iron manufacture', 'High', /steel|iron (and|&) steel|sponge iron|pig iron|blast furnace|foundry|ferro/),
  S('Metals & Mining', 'Manufacture of other metals', 'Moderately high', /alumin|copper smelt|zinc|non-ferrous|smelter/),
  S('Metals & Mining', 'Iron ores', 'Moderate', /iron ore/),
  S('Metals & Mining', 'Rare / precious metal ores', 'Moderately low', /gold|silver|rare earth|precious metal/),
  S('Metals & Mining', 'Quarrying', 'Moderately low', /quarr|stone crush|sand min|granite|marble/),
  S('Metals & Mining', 'Metal ore mining n.e.c.', 'Moderate', /mining|mineral/),
  S('Industrials', 'Cement or concrete manufacture', 'High', /cement|clinker|concrete|ready ?mix|rmc/),
  S('Industrials', 'Petrochemicals', 'High', /petrochem|fertili[sz]er|urea|ammonia|plastic resin|polymer/),
  S('Industrials', 'Renewables manufacture', 'Low', /solar (module|panel) manuf|wind turbine manuf|renewable.*manuf/),
  S('Industrials', 'Electronics manufacture', 'Moderately low', /electronic|semiconductor|pcb/),
  S('Industrials', 'Clothing manufacture', 'Moderately high', /textile|garment|apparel|cloth|spinning|weaving|denim|knit/),
  S('Industrials', 'Consumer durables manufacturing', 'Moderately high', /consumer durable|appliance|furniture manuf|white goods/),
  S('Industrials', 'Other consumer goods manufacturing', 'Moderate', /manufactur|factory|fmcg|chemical|paper|pulp|glass|ceramic|tile|brick|food process|pharma|rubber|leather|sugar mill/),
  S('Transportation', 'Airlines', 'Moderately high', /airline|aviation|air cargo|aircraft/),
  S('Transportation', 'Tankers', 'Moderately high', /tanker/),
  S('Transportation', 'Sea-based shipping', 'Moderate', /shipping|ship|vessel|port|maritime/),
  S('Transportation', 'Autos (low-carbon)', 'Low', /electric vehicle|\bev\b|e-?rickshaw|e-?bus|e-?scooter/),
  S('Transportation', 'Autos (high-carbon)', 'Moderately high', /auto(mobile)?|car (manuf|dealer)|vehicle|two.?wheeler|tractor|automotive|auto component/),
  S('Transportation', 'Land-based shipping (low-carbon, rail)', 'Low', /rail|metro/),
  S('Transportation', 'Land-based shipping (high-carbon, trucks)', 'Moderately high', /truck|transport|logistic|fleet|haulage|bus operator|cab|taxi/),
  S('Transportation', 'Transit systems', 'Moderately low', /transit/),
  S('Agriculture & Forestry', 'Livestock (beef, intensive grazing)', 'High', /beef|cattle feedlot/),
  S('Agriculture & Forestry', 'Livestock (other)', 'Moderate', /dairy|poultry|livestock|animal husbandry|goat|sheep|piggery/),
  S('Agriculture & Forestry', 'Aquaculture', 'Moderate', /aquacult|shrimp|prawn|fish farm/),
  S('Agriculture & Forestry', 'Fishing', 'Moderately low', /fishing|fisher/),
  S('Agriculture & Forestry', 'Forestry', 'Low', /forestry|plantation|timber/),
  S('Agriculture & Forestry', 'Biofuels', 'Low', /ethanol|biofuel|biodiesel/),
  S('Agriculture & Forestry', 'Crops (high emissions intensity)', 'Moderate', /paddy|rice/),
  S('Agriculture & Forestry', 'Horticulture', 'Moderate', /horticult|fruit|vegetable|floricult|orchard/),
  S('Agriculture & Forestry', 'Crops (low emissions intensity)', 'Low', /crop|agri|farm|kisan|kcc|wheat|pulses|cotton|sugarcane/),
  S('Agriculture & Forestry', 'Other agricultural services', 'Moderate', /agri.*service|cold storage|warehouse.*agri/),
  S('Real Estate', 'Construction (infrastructure)', 'Low', /infra|road|highway|bridge|epc|construction.*infra/),
  S('Real Estate', 'Construction (non-infrastructure)', 'Moderately low', /construction|builder|developer|contractor/),
  S('Real Estate', 'Commercial real estate', 'Moderate', /commercial (real estate|property|building)|office|mall|hotel|hospitality|cre\b|lease rental/),
  S('Real Estate', 'Residential real estate', 'Moderate', /home|housing|residen|flat|apartment|mortgage|lap\b/),
  S('Services & Technology', 'Health care', 'Low', /hospital|health|clinic|diagnostic|nursing/),
  S('Services & Technology', 'Entertainment & leisure', 'Moderate', /entertain|leisure|cinema|resort|amusement|restaurant/),
  S('Services & Technology', 'Financial services', 'Moderately low', /nbfc|bank|financ|insurance|microfinance/),
  S('Services & Technology', 'Technology', 'Moderately low', /software|\bit\b|technology|telecom|data cent/),
  S('Services & Technology', 'Services (other)', 'Low', /service|education|school|college|trading|trader|retail|shop|wholesale|personal loan|gold loan|education loan/),
];
/** Best-matching heatmap segment for free-text sector / purpose; null when nothing matches. */
export function segmentFor(sector?: string): Segment | null {
  if (!sector) return null;
  const s = sector.toLowerCase();
  return HEATMAP.find((h) => h.kw.test(s)) ?? null;
}
export const ratingBand = (score: number) => (score >= 80 ? 'Severe' : score >= 60 ? 'High' : score >= 40 ? 'Moderate' : score >= 20 ? 'Low' : 'Very low');

export type TransitionView = {
  segment: Segment | null; score: number;
  iso3?: string; regions: Record<IamModel, string | null>;
  price: Record<IamModel, number>; priceNow: Record<IamModel, number>; year: number;
};
export function transitionFor(sector: string | undefined, iso3: string | undefined, s: NgfsScenario, year: number): TransitionView {
  const segment = segmentFor(sector);
  const regions = iso3 ? regionsFor(iso3) : { G: null, M: null, R: null };
  const price = { G: carbonPrice('G', s, regions.G, year), M: carbonPrice('M', s, regions.M, year), R: carbonPrice('R', s, regions.R, year) };
  const priceNow = { G: carbonPrice('G', s, regions.G, 2025), M: carbonPrice('M', s, regions.M, 2025), R: carbonPrice('R', s, regions.R, 2025) };
  return { segment, score: segment ? HEAT_SCORE[segment.rating] : NaN, iso3, regions, price, priceNow, year };
}
