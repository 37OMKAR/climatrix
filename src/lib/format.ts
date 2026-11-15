// Indian number formatting: ₹ with lakh / crore.

export function inr(v: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const neg = v < 0;
  const a = Math.abs(v);
  let s: string;
  if (opts.compact !== false && a >= 1e7) s = `₹${(a / 1e7).toLocaleString('en-IN', { maximumFractionDigits: a >= 1e9 ? 0 : 2 })} Cr`;
  else if (opts.compact !== false && a >= 1e5) s = `₹${(a / 1e5).toLocaleString('en-IN', { maximumFractionDigits: 2 })} L`;
  else s = `₹${Math.round(a).toLocaleString('en-IN')}`;
  return neg ? `−${s}` : s;
}

export const num = (v: number | null | undefined, d = 1) =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toLocaleString('en-IN', { maximumFractionDigits: d });

/** Parse an Indian / international amount: "2.5 cr", "40 lakh", "₹1,20,00,000", "1.2e7", "3.5m". NaN when unreadable. */
export function parseInr(raw: unknown): number {
  if (typeof raw === 'number') return raw >= 0 && Number.isFinite(raw) ? raw : NaN;
  if (raw === null || raw === undefined) return NaN;
  let s = String(raw).trim().toLowerCase();
  if (!s || s.startsWith('-') || /^\(.*\)$/.test(s)) return NaN;
  s = s.replace(/inr|rs\.?|₹|rupees?/g, '').replace(/\s+/g, '');
  const m = s.match(/^([\d.,]+(?:e\d+)?)([a-z]*)$/);
  if (!m) return NaN;
  const mult: Record<string, number> = { '': 1, k: 1e3, thousand: 1e3, l: 1e5, lac: 1e5, lacs: 1e5, lakh: 1e5, lakhs: 1e5, cr: 1e7, crore: 1e7, crores: 1e7, m: 1e6, mn: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9 };
  if (!(m[2] in mult)) return NaN;
  const n = parseFloat(m[1].replace(/,/g, ''));
  const out = n * mult[m[2]];
  return Number.isFinite(out) ? out : NaN;
}

export function parseCoord(v: unknown): number {
  if (v === null || v === undefined || v === '') return NaN;
  if (typeof v === 'number') return v;
  const m = String(v).trim().toUpperCase().match(/^(-?[\d.]+)\s*°?\s*([NSEW])?$/);
  if (!m) return NaN;
  const n = Number(m[1]);
  return m[2] === 'S' || m[2] === 'W' ? -Math.abs(n) : n;
}
