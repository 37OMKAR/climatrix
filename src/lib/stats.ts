// Extreme-value and basic statistics used by the hazard models. Pure functions, no I/O.

export const mean = (a: number[]) => (a.length ? a.reduce((t, v) => t + v, 0) / a.length : NaN);
export const std = (a: number[]) => {
  if (a.length < 2) return NaN;
  const m = mean(a);
  return Math.sqrt(a.reduce((t, v) => t + (v - m) ** 2, 0) / (a.length - 1));
};
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const finite = (a: Array<number | null | undefined>) => a.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

/** Gumbel (EV-I) fit by L-moments (Hosking 1990). Returns location u and scale a. */
export function gumbelFit(maxima: number[]): { u: number; a: number } | null {
  const x = [...maxima].filter(Number.isFinite).sort((p, q) => p - q);
  const n = x.length;
  if (n < 8) return null;
  const b0 = mean(x);
  let b1 = 0;
  for (let i = 0; i < n; i++) b1 += (i / (n - 1)) * x[i];
  b1 /= n;
  const l2 = 2 * b1 - b0;
  if (!(l2 > 0)) return { u: b0, a: 1e-6 };
  const a = l2 / Math.LN2;
  const u = b0 - 0.5772156649 * a;
  return { u, a };
}
/** Value exceeded on average once every T years. */
export const gumbelReturnLevel = (f: { u: number; a: number }, T: number) => f.u - f.a * Math.log(-Math.log(1 - 1 / T));

/** Annual maxima from a daily series keyed by ISO date strings. Years with < minDays valid days are dropped. */
export function annualMaxima(time: string[], values: Array<number | null>, minDays = 300): number[] {
  const by = new Map<string, { m: number; n: number }>();
  values.forEach((v, i) => {
    if (v === null || v === undefined || !Number.isFinite(v)) return;
    const y = time[i]?.slice(0, 4);
    if (!y) return;
    const c = by.get(y) ?? { m: -Infinity, n: 0 };
    by.set(y, { m: Math.max(c.m, v), n: c.n + 1 });
  });
  return [...by.values()].filter((c) => c.n >= minDays).map((c) => c.m);
}

/** Mean per-year count of days where pred(value) is true, scaled to 365 days for years with gaps. */
export function daysPerYear(time: string[], values: Array<number | null>, pred: (v: number) => boolean, minDays = 300): number {
  const by = new Map<string, { k: number; n: number }>();
  values.forEach((v, i) => {
    if (v === null || v === undefined || !Number.isFinite(v)) return;
    const y = time[i]?.slice(0, 4);
    if (!y) return;
    const c = by.get(y) ?? { k: 0, n: 0 };
    by.set(y, { k: c.k + (pred(v) ? 1 : 0), n: c.n + 1 });
  });
  const ys = [...by.values()].filter((c) => c.n >= minDays);
  return ys.length ? mean(ys.map((c) => (c.k * 365) / c.n)) : NaN;
}

/** Standard normal CDF (Abramowitz & Stegun 7.1.26). */
export function normCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/** Linear interpolation of a 0–100 score from ascending thresholds at scores 20/40/60/80. */
export function scoreFrom(v: number, t: [number, number, number, number], reverse = false): number {
  if (!Number.isFinite(v)) return NaN;
  const pts: Array<[number, number]> = [[t[0], 20], [t[1], 40], [t[2], 60], [t[3], 80]];
  if (reverse) {
    // smaller value = worse (e.g. distance to volcano, aridity index)
    if (v >= t[0]) return clamp(20 * (1 - (v - t[0]) / Math.max(t[0], 1e-9)), 0, 20);
    for (let i = 0; i < 3; i++) {
      const [a, sa] = pts[i], [b, sb] = pts[i + 1];
      if (v <= a && v >= b) return sa + ((a - v) / (a - b)) * (sb - sa);
    }
    return clamp(80 + 20 * (t[3] - v) / Math.max(t[3], 1e-9), 80, 100);
  }
  if (v <= t[0]) return clamp(20 * (v / Math.max(t[0], 1e-9)), 0, 20);
  for (let i = 0; i < 3; i++) {
    const [a, sa] = pts[i], [b, sb] = pts[i + 1];
    if (v >= a && v <= b) return sa + ((v - a) / (b - a)) * (sb - sa);
  }
  return clamp(80 + 20 * (v - t[3]) / Math.max(t[3] - t[2], 1e-9), 80, 100);
}

export const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
};
