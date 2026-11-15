// Published scientific methods used by CLIMARIS. Each function cites its source.
import { normCdf, mean } from '../lib/stats';

/** Stull (2011) wet-bulb temperature from air temperature (°C) and relative humidity (%). J. Appl. Meteor. Climatol. 50, 2267. */
export function wetBulbStull(T: number, RH: number): number {
  const rh = Math.max(5, Math.min(99, RH));
  return T * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) + Math.atan(T + rh) - Math.atan(rh - 1.676331)
    + 0.00391838 * rh ** 1.5 * Math.atan(0.023101 * rh) - 4.686035;
}

/** FAO-56 extraterrestrial radiation Ra (MJ m⁻² day⁻¹), eq. 21. */
export function extraterrestrialRadiation(latDeg: number, doy: number): number {
  const phi = (latDeg * Math.PI) / 180;
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365);
  const delta = 0.409 * Math.sin((2 * Math.PI * doy) / 365 - 1.39);
  const ws = Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(delta))));
  return ((24 * 60) / Math.PI) * 0.082 * dr * (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws));
}

/** Hargreaves & Samani (1985) reference evapotranspiration, mm/day (FAO-56 eq. 52). */
export function petHargreaves(tmax: number, tmin: number, latDeg: number, doy: number): number {
  const ra = extraterrestrialRadiation(latDeg, doy) * 0.408; // MJ → mm
  return Math.max(0, 0.0023 * ra * ((tmax + tmin) / 2 + 17.8) * Math.sqrt(Math.max(0, tmax - tmin)));
}

export const dayOfYear = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000);
};

/** Canadian Forest Fire Weather Index (Van Wagner 1987), daily. Inputs: noon T (°C), RH (%), wind (km/h), 24h rain (mm). */
export function fireWeatherIndex(series: Array<{ t: number; rh: number; ws: number; rain: number; month: number }>, latDeg: number): number[] {
  const LeN = [6.5, 7.5, 9.0, 12.8, 13.9, 13.9, 12.4, 10.9, 9.4, 8.0, 7.0, 6.0];
  const LfN = [-1.6, -1.6, -1.6, 0.9, 3.8, 5.8, 6.4, 5.0, 2.4, 0.4, -1.6, -1.6];
  const south = latDeg < -20, tropic = Math.abs(latDeg) <= 20;
  let ffmc = 85, dmc = 6, dc = 15;
  const out: number[] = [];
  for (const d of series) {
    const T = d.t, H = Math.max(0, Math.min(100, d.rh)), W = Math.max(0, d.ws), ro = Math.max(0, d.rain);
    const mi = (d.month - 1 + (south ? 6 : 0)) % 12;
    // FFMC
    let mo = (147.2 * (101 - ffmc)) / (59.5 + ffmc);
    if (ro > 0.5) {
      const rf = ro - 0.5;
      let mr = mo + 42.5 * rf * Math.exp(-100 / (251 - mo)) * (1 - Math.exp(-6.93 / rf));
      if (mo > 150) mr += 0.0015 * (mo - 150) ** 2 * Math.sqrt(rf);
      mo = Math.min(250, mr);
    }
    const ed = 0.942 * H ** 0.679 + 11 * Math.exp((H - 100) / 10) + 0.18 * (21.1 - T) * (1 - Math.exp(-0.115 * H));
    let m: number;
    if (mo > ed) {
      const ko = 0.424 * (1 - (H / 100) ** 1.7) + 0.0694 * Math.sqrt(W) * (1 - (H / 100) ** 8);
      const kd = ko * 0.581 * Math.exp(0.0365 * T);
      m = ed + (mo - ed) * 10 ** -kd;
    } else {
      const ew = 0.618 * H ** 0.753 + 10 * Math.exp((H - 100) / 10) + 0.18 * (21.1 - T) * (1 - Math.exp(-0.115 * H));
      if (mo < ew) {
        const k1 = 0.424 * (1 - ((100 - H) / 100) ** 1.7) + 0.0694 * Math.sqrt(W) * (1 - ((100 - H) / 100) ** 8);
        const kw = k1 * 0.581 * Math.exp(0.0365 * T);
        m = ew - (ew - mo) * 10 ** -kw;
      } else m = mo;
    }
    ffmc = Math.max(0, Math.min(101, (59.5 * (250 - m)) / (147.2 + m)));
    // DMC
    const Tk = Math.max(-1.1, T);
    const Le = tropic ? 9 : LeN[mi];
    const rk = 1.894 * (Tk + 1.1) * (100 - H) * Le * 1e-6;
    let pr = dmc;
    if (ro > 1.5) {
      const re = 0.92 * ro - 1.27;
      const mo2 = 20 + Math.exp(5.6348 - dmc / 43.43);
      const b = dmc <= 33 ? 100 / (0.5 + 0.3 * dmc) : dmc <= 65 ? 14 - 1.3 * Math.log(dmc) : 6.2 * Math.log(dmc) - 17.2;
      const mr = mo2 + (1000 * re) / (48.77 + b * re);
      pr = Math.max(0, 244.72 - 43.43 * Math.log(mr - 20));
    }
    dmc = Math.max(0, pr + 100 * rk);
    // DC
    const Lf = tropic ? 1.4 : LfN[mi];
    const Tc = Math.max(-2.8, T);
    const v = Math.max(0, 0.36 * (Tc + 2.8) + Lf);
    let dr = dc;
    if (ro > 2.8) {
      const rd = 0.83 * ro - 1.27;
      const Qo = 800 * Math.exp(-dc / 400);
      const Qr = Qo + 3.937 * rd;
      dr = Math.max(0, 400 * Math.log(800 / Qr));
    }
    dc = Math.max(0, dr + 0.5 * v);
    // ISI, BUI, FWI
    const fm = (147.2 * (101 - ffmc)) / (59.5 + ffmc);
    const sf = 19.115 * Math.exp(-0.1386 * fm) * (1 + fm ** 5.31 / 4.93e7);
    const isi = sf * Math.exp(0.05039 * W);
    const bui = dmc <= 0.4 * dc ? (0.8 * dmc * dc) / (dmc + 0.4 * dc + 1e-9) : dmc - (1 - (0.8 * dc) / (dmc + 0.4 * dc + 1e-9)) * (0.92 + (0.0114 * dmc) ** 1.7);
    const fD = bui <= 80 ? 0.626 * Math.max(0, bui) ** 0.809 + 2 : 1000 / (25 + 108.64 * Math.exp(-0.023 * bui));
    const B = 0.1 * isi * fD;
    out.push(B > 1 ? Math.exp(2.72 * (0.434 * Math.log(B)) ** 0.647) : B);
  }
  return out;
}

/** Campbell (1997) median horizontal PGA (g) for firm soil/soft rock, strike-slip; σ(lnA) ≈ 0.55. Seism. Res. Lett. 68(1). */
export function campbellPga(M: number, R: number): number {
  const r = Math.max(3, R);
  return Math.exp(-3.512 + 0.904 * M - 1.328 * Math.log(Math.sqrt(r * r + (0.149 * Math.exp(0.647 * M)) ** 2)));
}

/** Historic-parametric PSHA: PGA (g) with the given annual exceedance rate, from a catalogue of events. */
export function pgaAtRate(events: Array<{ mag: number; distKm: number }>, years: number, rate: number, sigma = 0.55): number {
  if (!events.length || years <= 0) return 0;
  const mus = events.map((e) => Math.log(campbellPga(e.mag, e.distKm)));
  const exceed = (a: number) => mus.reduce((t, mu) => t + (1 - normCdf((Math.log(a) - mu) / sigma)), 0) / years;
  let lo = Math.log(1e-4), hi = Math.log(3);
  if (exceed(Math.exp(lo)) < rate) return 0;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (exceed(Math.exp(mid)) > rate) lo = mid; else hi = mid;
  }
  return Math.exp((lo + hi) / 2);
}

/** Emanuel (2011) wind damage function: fraction of value lost at 1-min wind V (m/s). Wea. Climate Soc. 3, 261. */
export function emanuelDamage(vMs: number, vThresh = 25.7, vHalf = 74.7): number {
  const vn = Math.max(0, vMs - vThresh) / (vHalf - vThresh);
  return vn ** 3 / (1 + vn ** 3);
}

/** JRC global flood depth–damage functions, Asia (Huizinga, de Moel & Szewczyk 2017, JRC105688). Depth in m → damage fraction. */
const JRC_DEPTHS = [0, 0.5, 1, 1.5, 2, 3, 4, 5, 6];
export const JRC_ASIA: Record<'residential' | 'commercial' | 'industrial' | 'agriculture' | 'infrastructure', number[]> = {
  residential: [0, 0.33, 0.49, 0.62, 0.72, 0.87, 0.93, 0.98, 1],
  commercial: [0, 0.38, 0.54, 0.66, 0.76, 0.88, 0.94, 0.98, 1],
  industrial: [0, 0.28, 0.48, 0.63, 0.72, 0.86, 0.91, 0.96, 1],
  agriculture: [0, 0.14, 0.37, 0.52, 0.56, 0.66, 0.83, 0.99, 1],
  infrastructure: [0, 0.21, 0.37, 0.52, 0.64, 0.86, 0.96, 1, 1],
};
export function jrcDamage(depthM: number, cls: keyof typeof JRC_ASIA): number {
  if (!(depthM > 0)) return 0;
  const c = JRC_ASIA[cls];
  for (let i = 1; i < JRC_DEPTHS.length; i++) {
    if (depthM <= JRC_DEPTHS[i]) {
      const f = (depthM - JRC_DEPTHS[i - 1]) / (JRC_DEPTHS[i] - JRC_DEPTHS[i - 1]);
      return c[i - 1] + f * (c[i] - c[i - 1]);
    }
  }
  return 1;
}

/** Horn (1981) slope in degrees from a 3×3 elevation window (row-major NW..SE), cell sizes in metres. */
export function hornSlope(z: number[], dx: number, dy: number): number {
  const [a, b, c, d, , f, g, h, i] = z;
  const dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * dx);
  const dzdy = ((g + 2 * h + i) - (a + 2 * b + c)) / (8 * dy);
  return (Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * 180) / Math.PI;
}

/** ETCCDI warm spell duration index: days per year in runs of ≥6 days with Tmax above the calendar-day 90th percentile. */
export function wsdi(time: string[], tmax: number[], p90ByDoy: number[]): number {
  const byYear = new Map<string, number>();
  let run = 0;
  let runYear = '';
  const flush = () => {
    if (run >= 6) byYear.set(runYear, (byYear.get(runYear) ?? 0) + run);
    run = 0;
  };
  for (let i = 0; i < time.length; i++) {
    const y = time[i].slice(0, 4);
    if (!byYear.has(y)) byYear.set(y, byYear.get(y) ?? 0);
    const hot = Number.isFinite(tmax[i]) && tmax[i] > p90ByDoy[Math.min(365, dayOfYear(time[i])) - 1];
    if (hot) {
      if (run === 0) runYear = y;
      run++;
    } else flush();
  }
  flush();
  return mean([...byYear.values()]);
}

export function percentile(a: number[], p: number): number {
  const x = a.filter(Number.isFinite).sort((m, n) => m - n);
  if (!x.length) return NaN;
  const k = (x.length - 1) * p;
  const f = Math.floor(k);
  return x[f] + (x[Math.min(x.length - 1, f + 1)] - x[f]) * (k - f);
}
