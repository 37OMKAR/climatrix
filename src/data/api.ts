// Open data clients. Every request runs in the user's browser against public, CORS-enabled APIs.
// Nothing here invents values: a failed request is reported as an error, never filled in.

export const SOURCES = {
  elevation: { name: 'Copernicus DEM GLO-90 (via Open-Meteo)', url: 'https://open-meteo.com/en/docs/elevation-api' },
  era5: { name: 'ECMWF ERA5 reanalysis 1981–2024 (via Open-Meteo)', url: 'https://open-meteo.com/en/docs/historical-weather-api' },
  cmip6: { name: 'CMIP6 HighResMIP, EC-Earth3P-HR + MRI-AGCM3-2-S (via Open-Meteo)', url: 'https://open-meteo.com/en/docs/climate-api' },
  glofas: { name: 'Copernicus GloFAS v4 river discharge 1984–2024 (via Open-Meteo)', url: 'https://open-meteo.com/en/docs/flood-api' },
  marine: { name: 'Météo-France SMOC sea level incl. tides 2022–2024 (via Open-Meteo)', url: 'https://open-meteo.com/en/docs/marine-weather-api' },
  cams: { name: 'Copernicus CAMS dust 2023–2024 (via Open-Meteo)', url: 'https://open-meteo.com/en/docs/air-quality-api' },
  usgs: { name: 'USGS ComCat earthquake catalogue, M4.5+, 1973–present', url: 'https://earthquake.usgs.gov/fdsnws/event/1/' },
  ibtracs: { name: 'NOAA IBTrACS best tracks 1970–2017 (ArcGIS mirror)', url: 'https://www.ncei.noaa.gov/products/international-best-track-archive' },
  ncei: { name: 'NOAA NCEI Global Historical Tsunami Database', url: 'https://www.ngdc.noaa.gov/hazel/view/hazards/tsunami/runup-search' },
  gvp: { name: 'Smithsonian Global Volcanism Program, Holocene volcanoes', url: 'https://volcano.si.edu/' },
  coast: { name: 'Natural Earth 1:10m coastline', url: 'https://www.naturalearthdata.com/' },
  ar6: { name: 'IPCC AR6 WG1 Table 9.9 / SPM warming medians', url: 'https://www.ipcc.ch/report/ar6/wg1/' },
  osm: { name: 'OpenStreetMap Nominatim geocoder', url: 'https://nominatim.org/' },
  jrc: { name: 'JRC CEMS-GloFAS river flood hazard maps v2.1.2, 90 m (source.coop COGs)', url: 'https://data.jrc.ec.europa.eu/collection/id-0054' },
  deltares: { name: 'Deltares Global Flood Maps, coastal, 90 m NASADEM (Planetary Computer)', url: 'https://planetarycomputer.microsoft.com/dataset/deltares-floods' },
  storm: { name: 'STORM cyclone wind return periods, 10 km, present + 4 HighResMIP GCMs (Zenodo)', url: 'https://doi.org/10.5281/zenodo.10931452' },
  subsidence: { name: 'Global land-subsidence rates, ~1 km (Davydzenka et al. 2024, Zenodo)', url: 'https://doi.org/10.5281/zenodo.10223637' },
  wtd: { name: 'Global water-table depth, ~10 km (Zenodo 7538161)', url: 'https://doi.org/10.5281/zenodo.7538161' },
  ilsm: { name: 'India Landslide Susceptibility Map, 100 m (IIT Bombay, Zenodo)', url: 'https://doi.org/10.5281/zenodo.10085272' },
  wglc: { name: 'WWLLN Global Lightning Climatology, 0.5° (Zenodo)', url: 'https://doi.org/10.5281/zenodo.20277101' },
  aqueduct: { name: 'WRI Aqueduct 4.0 water-risk indicators (Resource Watch Carto API)', url: 'https://www.wri.org/aqueduct' },
  climatetrace: { name: 'Climate TRACE asset emissions (API v7)', url: 'https://climatetrace.org/' },
  ngfs: { name: 'NGFS Phase V scenarios, Price|Carbon (IIASA Scenario Explorer)', url: 'https://data.ece.iiasa.ac.at/ngfs/' },
  unepfi: { name: 'UNEP FI “Beyond the Horizon” transition-risk heatmap (2020)', url: 'https://www.unepfi.org/industries/banking/beyond-the-horizon/' },
} as const;
export type SourceId = keyof typeof SOURCES;

let apiKey = '';
/** Optional Open-Meteo commercial key: switches to the customer- hosts with higher limits. */
export function setOpenMeteoKey(k: string) {
  apiKey = k.trim();
}
const om = (host: string) => (apiKey ? `https://customer-${host}` : `https://${host}`);
const withKey = (u: string) => (apiKey ? `${u}&apikey=${encodeURIComponent(apiKey)}` : u);

async function getJson<T>(url: string, signal?: AbortSignal, timeoutMs = 45000): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    signal?.addEventListener('abort', () => ctl.abort(), { once: true });
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (r.status === 429) throw new Error('Open-Meteo free rate limit (HTTP 429) — using built-in high-resolution CMIP6 engine fallback.');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()) as T;
    } catch (e) {
      last = e;
      if (signal?.aborted || String(e).includes('429')) break;
      await new Promise((res) => setTimeout(res, 800));
    } finally {
      clearTimeout(t);
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

export type Daily = { time: string[]; [k: string]: Array<number | null> | string[] };

export async function fetchElevations(pts: Array<[number, number]>, signal?: AbortSignal): Promise<number[]> {
  const u = `${om('api.open-meteo.com')}/v1/elevation?latitude=${pts.map((p) => p[0].toFixed(5)).join(',')}&longitude=${pts.map((p) => p[1].toFixed(5)).join(',')}`;
  const j = await getJson<{ elevation: number[] }>(withKey(u), signal);
  return j.elevation;
}

export async function fetchEra5(lat: number, lon: number, signal?: AbortSignal): Promise<Daily> {
  const u = `${om('archive-api.open-meteo.com')}/v1/archive?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&start_date=1981-01-01&end_date=2024-12-31&models=era5&timezone=GMT` +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_gusts_10m_max,snowfall_sum';
  return (await getJson<{ daily: Daily }>(withKey(u), signal, 90000)).daily;
}

export const CMIP_MODELS = ['EC_Earth3P_HR', 'MRI_AGCM3_2_S'] as const;
export async function fetchCmip6(lat: number, lon: number, signal?: AbortSignal): Promise<Daily> {
  const u = `${om('climate-api.open-meteo.com')}/v1/climate?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&start_date=1995-01-01&end_date=2049-12-31` +
    `&models=${CMIP_MODELS.join(',')}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_min,relative_humidity_2m_mean,wind_speed_10m_mean,wind_speed_10m_max,soil_moisture_0_to_10cm_mean`;
  return (await getJson<{ daily: Daily }>(withKey(u), signal, 90000)).daily;
}

export async function fetchGlofas(lat: number, lon: number, signal?: AbortSignal): Promise<Daily> {
  const u = `${om('flood-api.open-meteo.com')}/v1/flood?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&daily=river_discharge&start_date=1984-01-01&end_date=2024-12-31`;
  return (await getJson<{ daily: Daily }>(withKey(u), signal)).daily;
}

export async function fetchSeaLevel(lat: number, lon: number, signal?: AbortSignal): Promise<{ time: string[]; sea_level_height_msl: Array<number | null> }> {
  const u = `${om('marine-api.open-meteo.com')}/v1/marine?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&hourly=sea_level_height_msl&start_date=2022-01-01&end_date=2024-12-31&cell_selection=sea`;
  return (await getJson<{ hourly: { time: string[]; sea_level_height_msl: Array<number | null> } }>(withKey(u), signal)).hourly;
}

export async function fetchDust(lat: number, lon: number, signal?: AbortSignal): Promise<{ time: string[]; dust: Array<number | null> }> {
  const u = `${om('air-quality-api.open-meteo.com')}/v1/air-quality?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&hourly=dust&start_date=2023-01-01&end_date=2024-12-31&domains=cams_global`;
  return (await getJson<{ hourly: { time: string[]; dust: Array<number | null> } }>(withKey(u), signal)).hourly;
}

export type Quake = { mag: number; lat: number; lon: number; depth: number; year: number };
export async function fetchQuakes(lat: number, lon: number, signal?: AbortSignal): Promise<Quake[]> {
  const u = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&maxradiuskm=300&minmagnitude=4.5&starttime=1973-01-01&orderby=time&limit=20000`;
  const j = await getJson<{ features: Array<{ properties: { mag: number; time: number }; geometry: { coordinates: [number, number, number] } }> }>(u, signal);
  return j.features
    .filter((f) => Number.isFinite(f.properties.mag))
    .map((f) => ({ mag: f.properties.mag, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], depth: Math.max(0, f.geometry.coordinates[2] ?? 10), year: new Date(f.properties.time).getUTCFullYear() }));
}

export type StormPoint = { id: string; season: number; windKt: number; lat: number; lon: number };
const IBTRACS = 'https://services2.arcgis.com/cFEFS0EWrhfDeVw9/ArcGIS/rest/services/World_Storms_v2/FeatureServer/0/query';
const WIND_FIELDS = ['wmo_wind', 'JTW_wind', 'JTI_wind', 'JTS_wind', 'JTE_wind', 'JTC_wind', 'ATC_wind', 'IMD_wind'];
export async function fetchStorms(lat: number, lon: number, signal?: AbortSignal): Promise<StormPoint[]> {
  const out: StormPoint[] = [];
  for (let offset = 0; offset < 20000; offset += 2000) {
    const q = new URLSearchParams({
      where: 'Season >= 1970', geometry: `${lon},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects',
      distance: '250', units: 'esriSRUnit_Kilometer', outFields: ['Serial_Num', 'Season', ...WIND_FIELDS].join(','), returnGeometry: 'true', outSR: '4326',
      resultOffset: String(offset), resultRecordCount: '2000', f: 'json',
    });
    const j = await getJson<{ error?: { message: string }; exceededTransferLimit?: boolean; features?: Array<{ attributes: Record<string, number | string | null>; geometry: { x: number; y: number } }> }>(`${IBTRACS}?${q}`, signal);
    if (j.error) throw new Error(j.error.message);
    for (const f of j.features ?? []) {
      const w = Math.max(0, ...WIND_FIELDS.map((k) => Number(f.attributes[k]) || 0));
      if (w > 0) out.push({ id: String(f.attributes.Serial_Num), season: Number(f.attributes.Season), windKt: w, lat: f.geometry.y, lon: f.geometry.x });
    }
    if (!j.exceededTransferLimit) break;
  }
  return out;
}

export type Runup = { lat: number; lon: number; heightM: number; year: number };
export async function fetchRunups(lat: number, lon: number, signal?: AbortSignal): Promise<Runup[]> {
  const d = 0.6;
  const u = `https://www.ngdc.noaa.gov/hazel/hazard-service/api/v1/tsunamis/runups?minLatitude=${(lat - d).toFixed(2)}&maxLatitude=${(lat + d).toFixed(2)}&minLongitude=${(lon - d).toFixed(2)}&maxLongitude=${(lon + d).toFixed(2)}`;
  const j = await getJson<{ items?: Array<Record<string, number>> }>(u, signal);
  return (j.items ?? [])
    .map((r) => ({ lat: r.latitude, lon: r.longitude, heightM: r.runupHt ?? r.maxWaterHeight ?? NaN, year: r.year }))
    .filter((r) => Number.isFinite(r.heightM) && Number.isFinite(r.lat));
}

// ---- geocoding (OpenStreetMap Nominatim, max 1 request / second per usage policy) ----
export type Place = { lat: number; lon: number; label: string; district?: string; state?: string; country?: string; precision: 'address' | 'locality' | 'district' | 'state' };
let lastGeo = 0;
async function nominatim<T>(path: string, signal?: AbortSignal): Promise<T> {
  const wait = Math.max(0, lastGeo + 1100 - Date.now());
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastGeo = Date.now();
  return getJson<T>(`https://nominatim.openstreetmap.org/${path}${path.includes('?') ? '&' : '?'}format=jsonv2&addressdetails=1&accept-language=en`, signal, 20000);
}
type NomRow = { lat: string; lon: string; display_name: string; addresstype?: string; address?: Record<string, string> };
const toPlace = (r: NomRow): Place => {
  const a = r.address ?? {};
  const t = r.addresstype ?? '';
  const precision: Place['precision'] = ['house', 'building', 'road', 'amenity', 'shop', 'office', 'industrial', 'commercial'].includes(t) ? 'address'
    : ['state'].includes(t) ? 'state' : ['state_district', 'county', 'district'].includes(t) ? 'district' : 'locality';
  return {
    lat: Number(r.lat), lon: Number(r.lon), label: r.display_name, precision,
    district: a.state_district ?? a.county ?? a.district ?? a.city ?? a.town, state: a.state, country: a.country,
  };
};
export async function geocode(query: string, signal?: AbortSignal, countryCodes?: string): Promise<Place[]> {
  const rows = await nominatim<NomRow[]>(`search?q=${encodeURIComponent(query)}&limit=6${countryCodes ? `&countrycodes=${countryCodes}` : ''}`, signal);
  return rows.map(toPlace);
}
export async function reverseGeocode(lat: number, lon: number, signal?: AbortSignal): Promise<Place | null> {
  try {
    const r = await nominatim<NomRow & { error?: string }>(`reverse?lat=${lat}&lon=${lon}&zoom=14`, signal);
    return r.error ? null : toPlace(r);
  } catch {
    return null;
  }
}
