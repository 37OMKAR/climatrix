// CSV -> Asset[] import: tolerant header matching, money parsing, and per-row validation.
import { Asset, AssetCategory } from '../types/climate';
import { ASSET_TAXONOMY_GROUPS, estimateGlobalElevationMeters, reverseGeocodeLocation } from './climateEngine';

const CATEGORIES = Object.keys(ASSET_TAXONOMY_GROUPS) as AssetCategory[];

// Normalise a header: "Replacement Value (USD)" -> "replacementvalueusd"
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const ALIASES: Record<string, string[]> = {
  name: ['name', 'assetname', 'facility', 'facilityname', 'site', 'sitename'],
  entity: ['entity', 'entityname', 'company', 'owner', 'operator'],
  parent: ['parent', 'parententity', 'ultimateparent', 'group'],
  assetType: ['assettype', 'type', 'facilitytype'],
  category: ['category', 'assetcategory', 'sector'],
  lat: ['lat', 'latitude', 'y'],
  lon: ['lon', 'lng', 'long', 'longitude', 'x'],
  value: ['value', 'replacementvalue', 'replacementvalueusd', 'valueusd', 'tiv', 'tivusd', 'insuredvalue', 'bookvalue', 'assetvalue'],
  year: ['yearbuilt', 'year', 'built'],
  city: ['city', 'town'],
  country: ['country', 'nation'],
  elevation: ['elevation', 'elevationm', 'elev', 'altitude'],
};

/** Parse money: "1,200,000", "$1.2M", "€2.5bn", "USD 3000000", "2.5 million", "1.200.000,50", "1e9".
 *  Returns NaN for blanks, negatives and accounting-style "(1,000)". */
export function parseMoney(v: unknown): number {
  if (typeof v === 'number') return v >= 0 && Number.isFinite(v) ? v : NaN;
  if (v === null || v === undefined) return NaN;
  let s = String(v).trim().toLowerCase();
  if (!s || /^\(.*\)$/.test(s) || s.startsWith('-')) return NaN;
  s = s.replace(/usd|eur|gbp|inr|us\$|[$€£₹¥]/g, '').replace(/\s+/g, '');
  const words: Record<string, number> = { thousand: 1e3, k: 1e3, million: 1e6, mn: 1e6, mm: 1e6, m: 1e6, billion: 1e9, bn: 1e9, b: 1e9, trillion: 1e12, t: 1e12, cr: 1e7, crore: 1e7, lakh: 1e5 };
  const m = s.match(/^([\d.,]+(?:e\d+)?)([a-z]*)$/);
  if (!m) return NaN;
  let num = m[1];
  const lastComma = num.lastIndexOf(','), lastDot = num.lastIndexOf('.');
  if (lastComma > lastDot && num.length - lastComma - 1 !== 3) num = num.replace(/\./g, '').replace(',', '.'); // European "1.200.000,50" / "1,5"
  else num = num.replace(/,/g, '');
  const mult = m[2] ? words[m[2]] : 1;
  if (mult === undefined) return NaN;
  const out = parseFloat(num) * mult;
  return Number.isFinite(out) ? out : NaN;
}

/** Coordinates: accept "12.3", "12,3", "0.12 W", "33.9S". */
export function parseCoord(v: unknown): number {
  if (v === null || v === undefined) return NaN;
  if (typeof v === 'number') return v;
  const s = String(v).trim().toUpperCase();
  const m = s.match(/^(-?[\d.,]+)\s*°?\s*([NSEW])?$/);
  if (!m) return NaN;
  const n = Number(m[1].replace(',', '.'));
  return m[2] === 'S' || m[2] === 'W' ? -Math.abs(n) : n;
}

const toNum = (v: unknown) => (v === null || v === undefined || String(v).trim() === '' ? NaN : Number(String(v).replace(',', '.').replace(/\s*(m|metres|meters|ft)$/i, '')));

export function rowsToAssets(data: Record<string, unknown>[]): { assets: Asset[]; errors: string[]; warnings: string[]; assumed: Record<string, string[]> } {
  const assumed: Record<string, string[]> = {};
  const errors: string[] = [];
  const warnings: string[] = [];
  const assets: Asset[] = [];
  if (!data.length) return { assets, errors: ['The file has no data rows.'], warnings, assumed };

  // Map normalised header -> original header, once
  const headers = Object.keys(data[0] ?? {});
  const col: Partial<Record<keyof typeof ALIASES, string>> = {};
  (Object.keys(ALIASES) as Array<keyof typeof ALIASES>).forEach((k) => {
    const h = headers.find((x) => ALIASES[k].includes(norm(x)));
    if (h) col[k] = h;
  });
  if (!col.lat || !col.lon) {
    return { assets, errors: ['Could not find latitude/longitude columns. Expected headers like "Latitude" and "Longitude".'], warnings, assumed };
  }
  if (!col.value) warnings.push('No value column found — each site defaults to $50M.');

  const stamp = Date.now().toString(36);
  data.forEach((row, i) => {
    const get = (k: keyof typeof ALIASES) => (col[k] ? row[col[k]!] : undefined);
    const rowNum = i + 2;
    const name = String(get('name') ?? '').trim() || `Site ${i + 1}`;
    const lat = parseCoord(get('lat'));
    const lon = parseCoord(get('lon'));
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      errors.push(`Row ${rowNum} (${name}): latitude "${get('lat') ?? ''}" must be between -90 and 90.`);
      return;
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      errors.push(`Row ${rowNum} (${name}): longitude "${get('lon') ?? ''}" must be between -180 and 180.`);
      return;
    }
    const rawValue = parseMoney(get('value'));
    const value = Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 50_000_000;
    const rawValueText = String(get('value') ?? '').trim();
    if (col.value && rawValueText && !(Number.isFinite(rawValue) && rawValue > 0)) warnings.push(`Row ${rowNum}: value "${rawValueText}" could not be read, using $50M.`);
    const rawCat = String(get('category') ?? '').trim();
    const category = (CATEGORIES.find((c) => norm(c) === norm(rawCat)) ?? 'Industrial & Logistics') as AssetCategory;
    if (rawCat && !CATEGORIES.some((c) => norm(c) === norm(rawCat))) warnings.push(`Row ${rowNum}: unknown category "${rawCat}", using Industrial & Logistics.`);
    const geo = reverseGeocodeLocation(lat, lon);
    const elev = toNum(get('elevation'));
    const year = parseInt(String(get('year') ?? ''), 10);
    const entity = String(get('entity') ?? '').trim() || 'Imported portfolio';

    const id = `upl-${stamp}-${i}`;
    const flags: string[] = [];
    if (!(Number.isFinite(rawValue) && rawValue > 0)) flags.push('value $50M assumed');
    if (!String(get('assetType') ?? '').trim()) flags.push('type assumed');
    if (flags.length) assumed[id] = flags;
    assets.push({
      id,
      name,
      entityName: entity,
      parentEntity: String(get('parent') ?? '').trim() || entity,
      assetType: String(get('assetType') ?? '').trim() || ASSET_TAXONOMY_GROUPS[category]?.[0] || 'Commercial Real Estate',
      category,
      latitude: lat,
      longitude: lon,
      city: String(get('city') ?? '').trim() || geo.city,
      country: String(get('country') ?? '').trim() || geo.country,
      replacementValueUsd: value,
      yearBuilt: Number.isFinite(year) ? year : 2018,
      elevationMeters: Number.isFinite(elev) ? elev : estimateGlobalElevationMeters(lat, lon),
      criticalityTier: 2,
    });
  });
  return { assets, errors, warnings, assumed };
}

