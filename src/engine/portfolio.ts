// Loan book: CSV column matching, validation, geocoding and roll-ups. No default values are invented:
// a row without a readable amount or location is flagged and excluded from totals.
import { parseInr, parseCoord } from '../lib/format';
import { geocode, type Place } from '../data/api';
import type { LossClass } from './assess';

export type Loan = {
  key: string; row: number;
  borrower: string; loanId: string;
  address?: string; district?: string; state?: string; pincode?: string; country?: string;
  sector?: string; cls: LossClass;
  amount: number; tenureMonths: number; startYear: number; maturityYear: number;
  lat?: number; lon?: number;
  geo: { status: 'given' | 'geocoded' | 'pending' | 'failed'; precision?: Place['precision']; label?: string };
  issues: string[];
};

export const FIELDS = [
  { id: 'borrower', label: 'Borrower name', required: true, aliases: ['borrower', 'borrowername', 'name', 'customer', 'customername', 'accountname', 'party'] },
  { id: 'loanId', label: 'Loan / account ID', required: true, aliases: ['loanid', 'loanno', 'loannumber', 'accountno', 'accountnumber', 'id', 'identifier', 'acno', 'facilityid'] },
  { id: 'address', label: 'Address', required: false, aliases: ['address', 'addressline', 'address1', 'siteaddress', 'collateraladdress', 'location'] },
  { id: 'district', label: 'District / area', required: false, aliases: ['district', 'area', 'city', 'town', 'taluka', 'tehsil', 'locality'] },
  { id: 'state', label: 'State', required: false, aliases: ['state', 'province', 'region', 'statename'] },
  { id: 'pincode', label: 'PIN code', required: false, aliases: ['pincode', 'pin', 'postcode', 'zip', 'zipcode', 'postalcode'] },
  { id: 'country', label: 'Country', required: false, aliases: ['country', 'nation'] },
  { id: 'lat', label: 'Latitude', required: false, aliases: ['lat', 'latitude', 'y'] },
  { id: 'lon', label: 'Longitude', required: false, aliases: ['lon', 'lng', 'long', 'longitude', 'x'] },
  { id: 'amount', label: 'Loan amount (₹)', required: true, aliases: ['amount', 'loanamount', 'sanctionedamount', 'sanctionedamt', 'outstanding', 'outstandingamount', 'exposure', 'balance', 'limit', 'principal'] },
  { id: 'tenure', label: 'Tenure (months)', required: true, aliases: ['tenure', 'tenuremonths', 'term', 'termmonths', 'tenor', 'months'] },
  { id: 'start', label: 'Start / sanction date', required: false, aliases: ['startdate', 'sanctiondate', 'disbursementdate', 'start', 'date', 'openingdate'] },
  { id: 'sector', label: 'Sector / asset type', required: false, aliases: ['sector', 'assettype', 'industry', 'segment', 'purpose', 'collateraltype', 'type'] },
] as const;
export type FieldId = (typeof FIELDS)[number]['id'];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function autoMap(headers: string[]): Partial<Record<FieldId, string>> {
  const out: Partial<Record<FieldId, string>> = {};
  for (const f of FIELDS) {
    const h = headers.find((x) => (f.aliases as readonly string[]).includes(norm(x)));
    if (h) out[f.id] = h;
  }
  return out;
}

export function sectorClass(sector = ''): LossClass {
  const s = sector.toLowerCase();
  if (/agri|farm|crop|kisan|dairy|poultry|fish/.test(s)) return 'agriculture';
  if (/home|housing|residen|flat|apartment|individual/.test(s)) return 'residential';
  if (/road|port|power|energy|telecom|infra|rail|airport|utility|water supply/.test(s)) return 'infrastructure';
  if (/manufactur|factory|industr|plant|mill|msme|warehouse|logistic|textile|steel|chemical|cement/.test(s)) return 'industrial';
  return 'commercial';
}

function parseYear(v: unknown): number {
  if (v === null || v === undefined || v === '') return NaN;
  const s = String(v).trim();
  const m = s.match(/(19|20)\d{2}/);
  return m ? +m[0] : NaN;
}

export function rowsToLoans(rows: Record<string, unknown>[], map: Partial<Record<FieldId, string>>, thisYear = new Date().getFullYear()): Loan[] {
  const get = (r: Record<string, unknown>, f: FieldId) => (map[f] ? r[map[f]!] : undefined);
  const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
  return rows.map((r, i) => {
    const issues: string[] = [];
    const amount = parseInr(get(r, 'amount'));
    if (!Number.isFinite(amount) || amount <= 0) issues.push(`amount "${str(get(r, 'amount'))}" not readable`);
    const tenure = Number(str(get(r, 'tenure')).replace(/[^0-9.]/g, ''));
    if (!(tenure > 0)) issues.push(`tenure "${str(get(r, 'tenure'))}" not readable`);
    const start = parseYear(get(r, 'start'));
    const startYear = Number.isFinite(start) ? start : thisYear;
    const lat = parseCoord(get(r, 'lat')), lon = parseCoord(get(r, 'lon'));
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
    const loc = [get(r, 'address'), get(r, 'district'), get(r, 'state'), get(r, 'pincode')].map(str).filter(Boolean);
    if (!hasCoords && !loc.length) issues.push('no address, district, state, PIN or coordinates');
    const sector = str(get(r, 'sector')) || undefined;
    return {
      key: `${i}-${str(get(r, 'loanId')) || i}`, row: i + 2,
      borrower: str(get(r, 'borrower')) || `Row ${i + 2}`, loanId: str(get(r, 'loanId')) || '—',
      address: str(get(r, 'address')) || undefined, district: str(get(r, 'district')) || undefined, state: str(get(r, 'state')) || undefined,
      pincode: str(get(r, 'pincode')) || undefined, country: str(get(r, 'country')) || undefined,
      sector, cls: sectorClass(sector), amount: Number.isFinite(amount) ? amount : NaN,
      tenureMonths: tenure > 0 ? tenure : NaN, startYear, maturityYear: startYear + (tenure > 0 ? Math.ceil(tenure / 12) : 0),
      lat: hasCoords ? lat : undefined, lon: hasCoords ? lon : undefined,
      geo: hasCoords ? { status: 'given', precision: 'address' } : { status: loc.length ? 'pending' : 'failed' },
      issues,
    };
  });
}

/** Geocode one loan: full address first, then PIN, then district + state. Country defaults to India only when blank. */
export async function geocodeLoan(l: Loan, signal?: AbortSignal): Promise<Loan> {
  const country = l.country || 'India';
  const cc = /^india$/i.test(country) ? 'in' : undefined;
  const tries = [
    [l.address, l.district, l.state, l.pincode, country],
    l.pincode ? [l.pincode, country] : null,
    [l.district, l.state, country],
    [l.state, country],
  ].filter(Boolean).map((a) => a!.filter(Boolean).join(', ')).filter((q, i, arr) => q && arr.indexOf(q) === i && q !== country);
  for (const q of tries) {
    try {
      const r = await geocode(q, signal, cc);
      if (r.length) return { ...l, lat: r[0].lat, lon: r[0].lon, geo: { status: 'geocoded', precision: r[0].precision, label: r[0].label } };
    } catch (e) {
      if (signal?.aborted) throw e;
    }
  }
  return { ...l, geo: { status: 'failed' }, issues: [...l.issues, 'address could not be located'] };
}

export const usable = (l: Loan) => Number.isFinite(l.amount) && l.amount > 0 && l.lat !== undefined && l.lon !== undefined;

export const TEMPLATE_CSV = 'borrower_name,loan_id,address,district,state,pincode,country,latitude,longitude,loan_amount,tenure_months,sanction_date,sector\n';
