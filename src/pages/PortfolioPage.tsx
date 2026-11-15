import React, { useMemo, useState } from 'react';
import { Search, Download, Loader2, Trash2, ShieldAlert, Layers, CheckCircle2, AlertTriangle, ArrowUpRight, FileText } from 'lucide-react';
import { MapView, type Theme, type Layer } from '../ui/MapView';
import { Card, Tabs, Button, RatingChip, Bar, cx } from '../ui/kit';
import { HazardTable } from '../ui/HazardTable';
import { summarise, losses, creditRiskMetrics, type SiteParams, type CreditRiskMetrics, type PillarStrategy } from '../engine/assess';
import { FAMILIES, HAZARDS, HAZARD, RATINGS, RATING_COLOR, SCENARIOS, yearForMaturity, type Scenario, type Year } from '../engine/hazards';
import { usable, type Loan } from '../engine/portfolio';
import { inr } from '../lib/format';
import { transitionFor, toInrPerTonne, type NgfsScenario, type FxSettings, type TransitionView } from '../engine/transition';
import { TransitionCard } from '../ui/TransitionCard';
import { ratingOf as bandOf } from '../engine/hazards';

export const siteKey = (lat: number, lon: number) => `${lat.toFixed(3)},${lon.toFixed(3)}`;

type Row = Loan & {
  horizon: Year;
  sum: ReturnType<typeof summarise> | null;
  eal: number;
  site: SiteParams | null;
  tr: TransitionView;
  credit: CreditRiskMetrics | null;
};

export const PortfolioPage: React.FC<{
  theme: Theme; loans: Loan[]; sites: Record<string, SiteParams>; scenario: Scenario; year: Year;
  horizon: 'maturity' | 'fixed'; setHorizon: (h: 'maturity' | 'fixed') => void;
  run: { phase: 'idle' | 'geocoding' | 'assessing'; done: number; total: number; error?: string };
  onUpload: () => void; onClear: () => void; onRetry: () => void; ngfs: NgfsScenario; setNgfs: (s: NgfsScenario) => void; fx: FxSettings;
}> = ({ theme, loans, sites, scenario, year, horizon, setHorizon, run, onUpload, onClear, onRetry, ngfs, setNgfs, fx }) => {
  const [tab, setTab] = useState<'all' | 'high' | 'long' | 'issues'>('all');
  const [view, setView] = useState<'loans' | 'accumulation' | 'four_pillars' | 'credit_risk' | 'bcbs_crfr2'>('loans');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [colour, setColour] = useState<'rating' | 'hazard'>('rating');
  const [layer, setLayer] = useState<Layer>('google_roads');

  const rows: Row[] = useMemo(() => loans.map((l) => {
    const h = horizon === 'maturity' ? yearForMaturity(l.maturityYear) : year;
    const site = usable(l) ? sites[siteKey(l.lat!, l.lon!)] ?? null : null;
    const sum = site ? summarise(site, scenario, h) : null;
    const eal = site ? losses(site, l.amount, l.cls, scenario, h).totalEal : NaN;
    const tr = transitionFor(l.sector, site?.admin?.iso3, ngfs, horizon === 'maturity' ? l.maturityYear : year);
    const credit = site ? creditRiskMetrics(site, l.amount, l.cls, scenario, h) : null;
    return { ...l, horizon: h, sum, eal, site, tr, credit };
  }), [loans, sites, scenario, year, horizon, ngfs]);

  const assessed = rows.filter((r) => r.sum);
  const exposure = rows.filter((r) => Number.isFinite(r.amount)).reduce((t, r) => t + r.amount, 0);
  const highExp = assessed.filter((r) => r.sum!.maxScore >= 60).reduce((t, r) => t + r.amount, 0);
  const eal = assessed.reduce((t, r) => t + (Number.isFinite(r.eal) ? r.eal : 0), 0);
  const byBand = RATINGS.map((b) => ({ b, amt: assessed.filter((r) => r.sum!.rating === b).reduce((t, r) => t + r.amount, 0) }));
  const byTr = RATINGS.map((b) => ({ b, amt: rows.filter((r) => Number.isFinite(r.tr.score) && bandOf(r.tr.score) === b).reduce((t, r) => t + r.amount, 0) }));
  const unrated = rows.filter((r) => !Number.isFinite(r.tr.score)).reduce((t, r) => t + r.amount, 0);
  const byFam = FAMILIES.map((f) => ({ f, amt: assessed.filter((r) => r.sum!.values.some((v) => v.status === 'ok' && v.score >= 60 && HAZARD[v.id].family === f.id)).reduce((t, r) => t + r.amount, 0) }));

  // Munich Re Accumulation Monitoring (Geospatial Clustering by District/State)
  const clusters = useMemo(() => {
    const map = new Map<string, {
      district: string;
      state: string;
      count: number;
      exposure: number;
      highCount: number;
      highExposure: number;
      topHazard: string;
      damage100Total: number;
      underwaterCount: number;
      spreadBpsAvg: number;
    }>();

    for (const r of rows) {
      const d = r.district || 'Unassigned';
      const s = r.state || '';
      const key = `${d}__${s}`;
      const curr = map.get(key) || {
        district: d,
        state: s,
        count: 0,
        exposure: 0,
        highCount: 0,
        highExposure: 0,
        topHazard: '—',
        damage100Total: 0,
        underwaterCount: 0,
        spreadBpsAvg: 0,
      };
      curr.count += 1;
      curr.exposure += r.amount || 0;
      if (r.sum && r.sum.maxScore >= 60) {
        curr.highCount += 1;
        curr.highExposure += r.amount || 0;
      }
      if (r.sum?.top) {
        curr.topHazard = HAZARD[r.sum.top.id].name;
      }
      if (r.credit) {
        curr.damage100Total += r.credit.damage100 || 0;
        if (r.credit.isUnderwater) curr.underwaterCount += 1;
        curr.spreadBpsAvg += r.credit.pricingSpreadBps;
      }
      map.set(key, curr);
    }

    return Array.from(map.values())
      .map((c) => ({ ...c, spreadBpsAvg: c.count ? Math.round(c.spreadBpsAvg / c.count) : 0 }))
      .sort((a, b) => b.highExposure - a.highExposure || b.exposure - a.exposure);
  }, [rows]);

  // Risk Appetite Framework (RAF) & Basel/UNEP FI KRI Metrics
  const totalBaseEcl = rows.reduce((t, r) => t + (r.credit?.baseEcl || 0), 0);
  const totalStressedEcl = rows.reduce((t, r) => t + (r.credit?.stressedEcl || 0), 0);
  const totalEclUplift = Math.max(0, totalStressedEcl - totalBaseEcl);
  const underwaterLoans = rows.filter((r) => r.credit?.isUnderwater);
  const underwaterExposure = underwaterLoans.reduce((t, r) => t + r.amount, 0);
  const adaptLoans = rows.filter((r) => r.credit?.strategy === 'Adapt');
  const adaptPipeline = adaptLoans.reduce((t, r) => t + r.amount, 0);
  const avoidLoans = rows.filter((r) => r.credit?.strategy === 'Avoid');
  const avoidExposure = avoidLoans.reduce((t, r) => t + r.amount, 0);
  const transferLoans = rows.filter((r) => r.credit?.strategy === 'Transfer');
  const transferRepaymentCover = rows.reduce((t, r) => t + (r.credit?.repaymentHolidayInr || 0), 0);

  const thisYear = new Date().getFullYear();

  // Basel Committee (BCBS) Pillar 3 Template CRFR2 Physical Risk Table (June 2025 / 2026 Standards)
  const crfr2Rows = useMemo(() => {
    return FAMILIES.map((fam) => {
      const matching = rows.filter((r) =>
        r.sum?.values.some((v) => v.status === 'ok' && HAZARD[v.id].family === fam.id)
      );
      const highMatching = rows.filter((r) =>
        r.sum?.values.some((v) => v.status === 'ok' && v.score >= 60 && HAZARD[v.id].family === fam.id)
      );
      const totalAmt = matching.reduce((t, r) => t + r.amount, 0);
      const highAmt = highMatching.reduce((t, r) => t + r.amount, 0);

      // Maturity breakdown for high risk loans
      const under5 = highMatching.filter((r) => r.maturityYear <= thisYear + 5).reduce((t, r) => t + r.amount, 0);
      const fiveToTen = highMatching.filter((r) => r.maturityYear > thisYear + 5 && r.maturityYear <= thisYear + 10).reduce((t, r) => t + r.amount, 0);
      const overTen = highMatching.filter((r) => r.maturityYear > thisYear + 10).reduce((t, r) => t + r.amount, 0);

      // Uninsured / Protection gap (loans where damage100 > 0.2 of amount or underwater)
      const uninsuredGap = highMatching.filter((r) => (r.credit?.damageRatio100 || 0) > 0.25 || r.credit?.isUnderwater).reduce((t, r) => t + r.amount, 0);

      return {
        family: fam,
        totalAmt,
        highAmt,
        pctOfTotal: exposure > 0 ? (highAmt / exposure) * 100 : 0,
        under5,
        fiveToTen,
        overTen,
        uninsuredGap,
      };
    });
  }, [rows, exposure, thisYear]);
  const filtered = rows.filter((r) => {
    if (tab === 'high' && !(r.sum && r.sum.maxScore >= 60)) return false;
    if (tab === 'long' && !(r.maturityYear > 2035)) return false;
    if (tab === 'issues' && !(r.issues.length || r.geo.status === 'failed')) return false;
    const s = q.trim().toLowerCase();
    return !s || [r.borrower, r.loanId, r.district, r.state].some((x) => x?.toLowerCase().includes(s));
  }).sort((a, b) => (b.sum?.maxScore ?? -1) - (a.sum?.maxScore ?? -1) || b.amount - a.amount);

  const pins = rows.filter((r) => usable(r)).map((r) => ({
    id: r.key, lat: r.lat!, lon: r.lon!, label: `${r.borrower} · ${inr(r.amount)}`,
    sub: r.sum ? `${r.sum.top ? HAZARD[r.sum.top.id].name : ''} · ${r.sum.rating}` : 'Not assessed yet',
    color: !r.sum ? '#9ca3af' : colour === 'rating' ? RATING_COLOR[r.sum.rating!] : FAMILIES.find((f) => f.id === HAZARD[r.sum!.top!.id].family)!.color,
  }));
  const selRow = rows.find((r) => r.key === sel) ?? null;

  const exportCsv = () => {
    const head = [
      'loan_id', 'borrower', 'district', 'state', 'lat', 'lon', 'geocode_precision', 'amount_inr', 'tenure_months', 'maturity_year', 'horizon_year', 'scenario',
      'overall_rating', 'max_score', 'main_hazard', 'high_hazards', 'eal_flood_cyclone_inr',
      'unepfi_strategy', 'underwriting_action', 'base_ltv_pct', 'stressed_ltv_pct', 'is_underwater', 'base_lgd_pct', 'stressed_lgd_pct', 'base_pd_pct', 'stressed_pd_pct', 'base_ecl_inr', 'climate_ecl_inr', 'ecl_uplift_inr', 'resilience_loan_discount_bps', 'repayment_holiday_cover_inr', 'pricing_spread_bps',
      'sector', 'unepfi_segment', 'unepfi_rating', 'ngfs_scenario', 'carbon_price_usd2010_gcam', 'carbon_price_inr_per_t_gcam',
      ...HAZARDS.filter((h) => !h.notAssessed).map((h) => `${h.id}_score`),
    ];
    const lines = rows.map((r) => [
      r.loanId, r.borrower, r.district ?? '', r.state ?? '', r.lat ?? '', r.lon ?? '', r.geo.precision ?? r.geo.status, r.amount, r.tenureMonths, r.maturityYear, r.horizon, scenario,
      r.sum?.rating ?? '', r.sum?.maxScore ?? '', r.sum?.top ? HAZARD[r.sum.top.id].name : '', r.sum?.highCount ?? '', Number.isFinite(r.eal) ? Math.round(r.eal) : '',
      r.credit?.strategy ?? 'Accept', r.credit?.strategyReason ?? '', r.credit ? Math.round(r.credit.baseLtv * 100) : 70, r.credit ? Math.round(r.credit.stressedLtv * 100) : 70, r.credit?.isUnderwater ? 'YES' : 'NO',
      r.credit ? Math.round(r.credit.baseLgd * 100) : 45, r.credit ? Math.round(r.credit.stressedLgd * 100) : 45, r.credit ? (r.credit.basePd * 100).toFixed(1) : '2.0', r.credit ? (r.credit.stressedPd * 100).toFixed(1) : '2.0',
      r.credit ? Math.round(r.credit.baseEcl) : 0, r.credit ? Math.round(r.credit.stressedEcl) : 0, r.credit ? Math.round(r.credit.eclUplift) : 0,
      r.credit?.strategy === 'Adapt' ? 25 : 0, r.credit?.repaymentHolidayInr ?? 0, r.credit?.pricingSpreadBps ?? 0,
      r.sector ?? '', r.tr.segment ? `${r.tr.segment.sector} · ${r.tr.segment.segment}` : '', r.tr.segment?.rating ?? '', ngfs,
      Number.isFinite(r.tr.price.G) ? Math.round(r.tr.price.G) : '', Number.isFinite(r.tr.price.G) ? Math.round(toInrPerTonne(r.tr.price.G, fx)) : '',
      ...HAZARDS.filter((h) => !h.notAssessed).map((h) => { const v = r.sum?.values.find((x) => x.id === h.id); return v && v.status === 'ok' ? v.score : ''; }),
    ]);
    const csv = [head, ...lines].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `climaris_portfolio_${scenario}.csv`;
    a.click();
  };

  if (!loans.length) {
    return (
      <div className="max-w-[640px] mx-auto mt-16 text-center flex flex-col items-center gap-3">
        <h1 className="text-2xl font-bold">No loans yet</h1>
        <p className="text-sm text-muted">Upload a CSV with borrower, loan ID, district, state (or address / PIN / coordinates), amount in rupees and tenure. Or add single sites from the Location page.</p>
        <Button kind="primary" onClick={onUpload}>Upload loan file</Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-3 items-start">
      <div className="flex flex-col gap-3 min-w-0">
        <MapView theme={theme} layer={layer} pins={pins} selectedId={sel} onSelect={setSel} fitKey={String(pins.length)}
          overlay={<>
            <div className="flex items-center gap-2 min-h-[42px] px-3 rounded-[10px] bg-panel border border-line w-[min(320px,100%)]">
              <Search className="w-4 h-4 text-muted" aria-hidden="true" />
              <label htmlFor="pq" className="sr-only">Search loans</label>
              <input id="pq" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Borrower, loan ID, district, state" className="flex-1 min-w-0 bg-transparent outline-none text-sm text-ink placeholder:text-muted" />
            </div>
            <label className="flex items-center gap-2 min-h-[42px] px-3 rounded-[10px] bg-panel border border-line text-[13px] text-muted">Colour by
              <select value={colour} onChange={(e) => setColour(e.target.value as 'rating' | 'hazard')} className="bg-transparent text-ink font-medium outline-none"><option value="rating">Risk rating</option><option value="hazard">Main hazard group</option></select>
            </label>
            <label className="flex items-center gap-2 min-h-[42px] px-3 rounded-[10px] bg-panel border border-line text-[13px] text-muted">Layer
              <select value={layer} onChange={(e) => setLayer(e.target.value as Layer)} className="bg-transparent text-ink font-medium outline-none">
                <option value="google_roads">Google Maps (Streets)</option>
                <option value="google_hybrid">Google Earth (Hybrid Satellite)</option>
                <option value="google_sat">Google Earth (Satellite Only)</option>
                <option value="google_terrain">Google Maps (Terrain)</option>
                <option value="osm">OpenStreetMap (Free)</option>
                <option value="satellite">Satellite (Esri World Imagery)</option>
                <option value="dark">Dark Canvas (Esri World Dark)</option>
                <option value="topo">Topographic (OpenTopoMap)</option>
                {((import.meta as { env?: Record<string, string> }).env?.VITE_MAPBOX_TOKEN) && (
                  <>
                    <option value="mapbox">Mapbox Streets</option>
                    <option value="mapbox_sat">Mapbox Satellite</option>
                  </>
                )}
              </select>
            </label>
          </>} />

        {run.phase !== 'idle' && (
          <div className="rounded-2xl bg-panel border border-line p-4 flex flex-col gap-2 text-[13px]">
            <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-accent" /><span className="flex-1">{run.phase === 'geocoding' ? 'Locating addresses (OpenStreetMap, 1 per second)' : 'Fetching open hazard data per site'}</span><span className="tabular text-muted">{run.done}/{run.total}</span></div>
            <Bar value={run.total ? (run.done / run.total) * 100 : 0} color="var(--accent)" height={4} />
          </div>
        )}
        {run.error && <p className="p-3 rounded-xl bg-[#dc26261a] text-[#dc2626] text-[13px] flex flex-wrap items-center gap-3">{run.error}<Button onClick={onRetry}>Retry</Button></p>}

        <section className="rounded-2xl bg-panel border border-line overflow-hidden">
          <div className="px-4 py-3.5 flex flex-wrap items-center gap-3 border-b border-line">
            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-bold">Portfolio View</h2>
              <span className="text-muted font-medium text-sm">· {filtered.length} of {rows.length}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1 bg-chip p-1 rounded-xl text-xs font-semibold">
              <button onClick={() => setView('loans')} className={cx('px-2.5 py-1.5 rounded-lg transition-colors', view === 'loans' ? 'bg-panel text-ink shadow-sm' : 'text-muted hover:text-ink')}>Loans</button>
              <button onClick={() => setView('accumulation')} className={cx('px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5', view === 'accumulation' ? 'bg-panel text-ink shadow-sm' : 'text-muted hover:text-ink')}>
                <Layers className="w-3.5 h-3.5" />Accumulation (Munich Re)
              </button>
              <button onClick={() => setView('four_pillars')} className={cx('px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5', view === 'four_pillars' ? 'bg-panel text-ink shadow-sm' : 'text-muted hover:text-ink')}>
                <ShieldAlert className="w-3.5 h-3.5" />4-Pillars Strategy (UNEP FI)
              </button>
              <button onClick={() => setView('credit_risk')} className={cx('px-2.5 py-1.5 rounded-lg transition-colors', view === 'credit_risk' ? 'bg-panel text-ink shadow-sm' : 'text-muted hover:text-ink')}>
                Credit & IFRS 9 ECL
              </button>
              <button onClick={() => setView('bcbs_crfr2')} className={cx('px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5', view === 'bcbs_crfr2' ? 'bg-panel text-ink shadow-sm' : 'text-muted hover:text-ink')}>
                <FileText className="w-3.5 h-3.5" />BCBS Pillar 3 (CRFR2)
              </button>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Tabs dark label="Filter loans" value={tab} onChange={setTab} options={[{ value: 'all', label: 'All' }, { value: 'high', label: 'High+' }, { value: 'long', label: 'Maturing after 2035' }, { value: 'issues', label: 'Issues' }]} />
              <Button onClick={exportCsv} icon={<Download className="w-4 h-4" />}>CSV</Button>
            </div>
          </div>

          {/* VIEW 1: Standard Loans Table */}
          {view === 'loans' && (
            <div className="overflow-x-auto max-h-[560px]">
              <table className="w-full text-[13px] min-w-[1000px]">
                <thead className="sticky top-0 bg-chip"><tr className="text-left text-xs text-muted">
                  <th className="py-2.5 pl-4 pr-2 font-medium">Loan ID</th><th className="py-2.5 px-2 font-medium">Borrower</th><th className="py-2.5 px-2 font-medium">District · State</th>
                  <th className="py-2.5 px-2 font-medium text-right">Amount</th><th className="py-2.5 px-2 font-medium">Matures</th><th className="py-2.5 px-2 font-medium">Main hazard</th><th className="py-2.5 px-2 font-medium">Physical</th><th className="py-2.5 px-2 font-medium">Transition</th><th className="py-2.5 pl-2 pr-4 font-medium">Located by</th>
                </tr></thead>
                <tbody>
                  {filtered.slice(0, 500).map((r) => (
                    <tr key={r.key} onClick={() => setSel(r.key)} className={cx('border-t border-line cursor-pointer hover:bg-chip/60', sel === r.key && 'bg-chip')}>
                      <td className="py-3 pl-4 pr-2 font-semibold text-accent">{r.loanId}</td>
                      <td className="py-3 px-2"><span className="font-medium">{r.borrower}</span>{r.sector && <span className="block text-xs text-muted">{r.sector}</span>}</td>
                      <td className="py-3 px-2 text-muted">{[r.district, r.state].filter(Boolean).join(' · ') || '—'}</td>
                      <td className="py-3 px-2 text-right tabular font-medium">{inr(r.amount)}</td>
                      <td className="py-3 px-2 tabular">{Number.isFinite(r.tenureMonths) ? r.maturityYear : '—'}{r.maturityYear > thisYear + 10 && <span className="block text-xs text-muted">{horizon === 'maturity' ? `assessed ${r.horizon}` : ''}</span>}</td>
                      <td className="py-3 px-2">{r.sum?.top ? HAZARD[r.sum.top.id].name : <span className="text-muted">—</span>}</td>
                      <td className="py-3 px-2">{r.sum ? <RatingChip rating={r.sum.rating} score={r.sum.maxScore} small /> : <span className="text-xs text-muted">{r.geo.status === 'failed' ? 'Not located' : usable(r) ? 'Pending' : '—'}</span>}</td>
                      <td className="py-3 px-2">{r.tr.segment ? <span title={`${r.tr.segment.sector} · ${r.tr.segment.segment} (UNEP FI: ${r.tr.segment.rating})${Number.isFinite(r.tr.price.G) ? ` · carbon $${Math.round(r.tr.price.G)}/t at maturity` : ''}`}><RatingChip rating={bandOf(r.tr.score)} score={r.tr.score} small /></span> : <span className="text-xs text-muted">{r.sector ? 'No match' : 'No sector'}</span>}</td>
                      <td className="py-3 pl-2 pr-4 text-xs text-muted">{r.geo.status === 'given' ? 'Coordinates' : r.geo.status === 'geocoded' ? `OSM · ${r.geo.precision}` : r.geo.status === 'failed' ? <span className="text-[#dc2626]">Failed</span> : 'Pending'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* VIEW 2: Munich Re Accumulation Monitoring */}
          {view === 'accumulation' && (
            <div className="overflow-x-auto max-h-[560px]">
              <table className="w-full text-[13px] min-w-[1000px]">
                <thead className="sticky top-0 bg-chip"><tr className="text-left text-xs text-muted">
                  <th className="py-2.5 pl-4 pr-2 font-medium">District · Cluster</th>
                  <th className="py-2.5 px-2 font-medium text-right">Facilities</th>
                  <th className="py-2.5 px-2 font-medium text-right">Total Exposure</th>
                  <th className="py-2.5 px-2 font-medium text-right">High-Risk Exposure</th>
                  <th className="py-2.5 px-2 font-medium">Dominant Peril</th>
                  <th className="py-2.5 px-2 font-medium text-right">100-Yr Acute Loss (PML)</th>
                  <th className="py-2.5 px-2 font-medium text-right">Underwater Loans</th>
                  <th className="py-2.5 px-2 font-medium text-right">Climate Spread Avg</th>
                  <th className="py-2.5 pl-2 pr-4 font-medium">Accumulation Status</th>
                </tr></thead>
                <tbody>
                  {clusters.map((c) => {
                    const ratio = c.exposure > 0 ? c.highExposure / c.exposure : 0;
                    const alert = ratio > 0.4 || c.highExposure >= 250000000;
                    const watchlist = ratio > 0.2;
                    return (
                      <tr key={`${c.district}__${c.state}`} className="border-t border-line hover:bg-chip/60">
                        <td className="py-3 pl-4 pr-2 font-semibold text-ink">{c.district}{c.state && <span className="block text-xs font-normal text-muted">{c.state}</span>}</td>
                        <td className="py-3 px-2 text-right tabular">{c.count}</td>
                        <td className="py-3 px-2 text-right tabular font-medium">{inr(c.exposure)}</td>
                        <td className="py-3 px-2 text-right tabular font-medium">
                          <span className={c.highExposure > 0 ? 'text-[#dc2626]' : 'text-muted'}>{inr(c.highExposure)}</span>
                          <span className="block text-xs text-muted">({c.exposure ? `${Math.round((c.highExposure / c.exposure) * 100)}%` : '0%'})</span>
                        </td>
                        <td className="py-3 px-2 font-medium">{c.topHazard}</td>
                        <td className="py-3 px-2 text-right tabular text-muted font-medium">{c.damage100Total > 0 ? inr(c.damage100Total) : '—'}</td>
                        <td className="py-3 px-2 text-right tabular">
                          {c.underwaterCount > 0 ? <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#dc26261a] text-[#dc2626]">{c.underwaterCount}</span> : <span className="text-muted">0</span>}
                        </td>
                        <td className="py-3 px-2 text-right tabular font-medium text-accent">+{c.spreadBpsAvg} bps</td>
                        <td className="py-3 pl-2 pr-4">
                          {alert ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#dc26261a] text-[#dc2626]">
                              <AlertTriangle className="w-3.5 h-3.5" /> Concentration Alert
                            </span>
                          ) : watchlist ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#f59e0b1a] text-[#f59e0b]">
                              Watchlist
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#10b9811a] text-[#10b981]">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Normal
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* VIEW 3: UNEP FI 4-Pillars Strategy Engine */}
          {view === 'four_pillars' && (
            <div className="overflow-x-auto max-h-[560px]">
              <table className="w-full text-[13px] min-w-[1000px]">
                <thead className="sticky top-0 bg-chip"><tr className="text-left text-xs text-muted">
                  <th className="py-2.5 pl-4 pr-2 font-medium">Loan ID</th>
                  <th className="py-2.5 px-2 font-medium">Borrower & Sector</th>
                  <th className="py-2.5 px-2 font-medium">4-Pillars Strategy</th>
                  <th className="py-2.5 px-2 font-medium">Underwriting & Risk Action</th>
                  <th className="py-2.5 px-2 font-medium text-right">Resilience Incentive</th>
                  <th className="py-2.5 px-2 font-medium text-right">Repayment Holiday Cover</th>
                  <th className="py-2.5 pl-2 pr-4 font-medium text-right">Risk Spread</th>
                </tr></thead>
                <tbody>
                  {filtered.slice(0, 500).map((r) => {
                    const st = r.credit?.strategy ?? 'Accept';
                    const pillColor = st === 'Avoid' ? 'bg-[#dc2626] text-white' : st === 'Adapt' ? 'bg-[#10b981] text-white' : st === 'Transfer' ? 'bg-[#0284c7] text-white' : 'bg-chip text-ink';
                    return (
                      <tr key={r.key} onClick={() => setSel(r.key)} className={cx('border-t border-line cursor-pointer hover:bg-chip/60', sel === r.key && 'bg-chip')}>
                        <td className="py-3 pl-4 pr-2 font-semibold text-accent">{r.loanId}</td>
                        <td className="py-3 px-2"><span className="font-medium">{r.borrower}</span><span className="block text-xs text-muted">{r.sector || 'General'}</span></td>
                        <td className="py-3 px-2">
                          <span className={cx('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider', pillColor)}>
                            {st}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <p className="text-xs font-medium text-ink">{r.credit?.strategyReason}</p>
                          {r.credit?.resilienceMeasures?.[0] && (
                            <p className="text-[11px] text-muted truncate max-w-[340px] mt-0.5">💡 {r.credit.resilienceMeasures[0]}</p>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right tabular">
                          {st === 'Adapt' ? <span className="font-bold text-[#10b981]">-25 bps</span> : <span className="text-muted">—</span>}
                        </td>
                        <td className="py-3 px-2 text-right tabular font-medium text-ink">
                          {r.credit ? inr(r.credit.repaymentHolidayInr) : '—'}
                          <span className="block text-[11px] text-muted">3-mo buffer</span>
                        </td>
                        <td className="py-3 pl-2 pr-4 text-right tabular font-semibold text-accent">
                          {r.credit && r.credit.pricingSpreadBps > 0 ? `+${r.credit.pricingSpreadBps} bps` : 'Base rate'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* VIEW 4: Prudential Credit & IFRS 9 ECL Shock */}
          {view === 'credit_risk' && (
            <div className="overflow-x-auto max-h-[560px]">
              <table className="w-full text-[13px] min-w-[1000px]">
                <thead className="sticky top-0 bg-chip"><tr className="text-left text-xs text-muted">
                  <th className="py-2.5 pl-4 pr-2 font-medium">Loan ID</th>
                  <th className="py-2.5 px-2 font-medium">Borrower</th>
                  <th className="py-2.5 px-2 font-medium text-right">Exposure (EAD)</th>
                  <th className="py-2.5 px-2 font-medium text-right">LTV Drift (Base → Stress)</th>
                  <th className="py-2.5 px-2 font-medium text-right">LGD (Base → Stress)</th>
                  <th className="py-2.5 px-2 font-medium text-right">PD (Base → Stress)</th>
                  <th className="py-2.5 px-2 font-medium text-right">Base ECL</th>
                  <th className="py-2.5 pl-2 pr-4 font-medium text-right">Climate ECL Uplift</th>
                </tr></thead>
                <tbody>
                  {filtered.slice(0, 500).map((r) => {
                    const c = r.credit;
                    return (
                      <tr key={r.key} onClick={() => setSel(r.key)} className={cx('border-t border-line cursor-pointer hover:bg-chip/60', sel === r.key && 'bg-chip')}>
                        <td className="py-3 pl-4 pr-2 font-semibold text-accent">{r.loanId}</td>
                        <td className="py-3 px-2"><span className="font-medium">{r.borrower}</span><span className="block text-xs text-muted">{[r.district, r.state].filter(Boolean).join(' · ')}</span></td>
                        <td className="py-3 px-2 text-right tabular font-medium">{inr(r.amount)}</td>
                        <td className="py-3 px-2 text-right tabular">
                          <span className="text-muted">70%</span> → <span className={cx('font-bold', c?.isUnderwater ? 'text-[#dc2626]' : 'text-ink')}>{c ? `${Math.round(c.stressedLtv * 100)}%` : '—'}</span>
                          {c?.isUnderwater && <span className="block text-[10px] font-bold text-[#dc2626] uppercase">Underwater</span>}
                        </td>
                        <td className="py-3 px-2 text-right tabular">
                          <span className="text-muted">45%</span> → <span className="font-medium text-ink">{c ? `${Math.round(c.stressedLgd * 100)}%` : '—'}</span>
                        </td>
                        <td className="py-3 px-2 text-right tabular">
                          <span className="text-muted">2.0%</span> → <span className="font-medium text-ink">{c ? `${(c.stressedPd * 100).toFixed(1)}%` : '—'}</span>
                        </td>
                        <td className="py-3 px-2 text-right tabular text-muted">{c ? inr(c.baseEcl) : '—'}</td>
                        <td className="py-3 pl-2 pr-4 text-right tabular font-semibold text-[#dc2626]">
                          {c && c.eclUplift > 0 ? `+${inr(c.eclUplift)}` : '₹0'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* VIEW 5: Basel Committee (BCBS) Pillar 3 Template CRFR2 Physical Risk (2025/2026 Standards) */}
          {view === 'bcbs_crfr2' && (
            <div className="overflow-x-auto max-h-[560px]">
              <div className="p-3 bg-chip/50 border-b border-line text-xs flex flex-wrap items-center justify-between gap-2">
                <span><b>Basel Committee (BCBS) Pillar 3 · Template CRFR2:</b> Banking book gross carrying amount in geographical areas prone to acute and chronic physical climate risk.</span>
                <span className="font-semibold text-accent">Total Carrying Amount: {inr(exposure)}</span>
              </div>
              <table className="w-full text-[13px] min-w-[1000px]">
                <thead className="sticky top-0 bg-chip"><tr className="text-left text-xs text-muted">
                  <th className="py-2.5 pl-4 pr-2 font-medium">Physical Hazard Category</th>
                  <th className="py-2.5 px-2 font-medium text-right">Gross Carrying Amount</th>
                  <th className="py-2.5 px-2 font-medium text-right">High/Severe Intensity</th>
                  <th className="py-2.5 px-2 font-medium text-right">% of Total Book</th>
                  <th className="py-2.5 px-2 font-medium text-right">Maturity &le; 5 yrs</th>
                  <th className="py-2.5 px-2 font-medium text-right">Maturity 5–10 yrs</th>
                  <th className="py-2.5 px-2 font-medium text-right">Maturity &gt; 10 yrs</th>
                  <th className="py-2.5 pl-2 pr-4 font-medium text-right">Uninsured Protection Gap</th>
                </tr></thead>
                <tbody>
                  {crfr2Rows.map((row) => (
                    <tr key={row.family.id} className="border-t border-line hover:bg-chip/60">
                      <td className="py-3 pl-4 pr-2 font-semibold text-ink flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: row.family.color }} />
                        {row.family.name}
                      </td>
                      <td className="py-3 px-2 text-right tabular font-medium">{inr(row.totalAmt)}</td>
                      <td className="py-3 px-2 text-right tabular font-semibold text-[#dc2626]">{inr(row.highAmt)}</td>
                      <td className="py-3 px-2 text-right tabular font-medium">{row.pctOfTotal.toFixed(1)}%</td>
                      <td className="py-3 px-2 text-right tabular text-muted">{inr(row.under5)}</td>
                      <td className="py-3 px-2 text-right tabular text-muted">{inr(row.fiveToTen)}</td>
                      <td className="py-3 px-2 text-right tabular text-muted">{inr(row.overTen)}</td>
                      <td className="py-3 pl-2 pr-4 text-right tabular font-semibold text-[#dc2626]">
                        {row.uninsuredGap > 0 ? inr(row.uninsuredGap) : '₹0'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        {selRow?.credit && (
          <section className="rounded-2xl p-4 bg-panel border border-line flex flex-col gap-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-bold">UNEP FI & Munich Re Strategy · {selRow.borrower}</h3>
              </div>
              <span className={cx('px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider',
                selRow.credit.strategy === 'Avoid' ? 'bg-[#dc2626] text-white' :
                selRow.credit.strategy === 'Adapt' ? 'bg-[#10b981] text-white' :
                selRow.credit.strategy === 'Transfer' ? 'bg-[#0284c7] text-white' : 'bg-chip text-ink')}>
                Strategy: {selRow.credit.strategy}
              </span>
            </div>
            <p className="text-xs text-ink leading-relaxed">{selRow.credit.strategyReason}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="rounded-xl bg-chip/60 p-2.5">
                <span className="text-muted block text-[11px]">Stressed LTV</span>
                <span className={cx('text-base font-bold tabular', selRow.credit.isUnderwater ? 'text-[#dc2626]' : 'text-ink')}>
                  {Math.round(selRow.credit.stressedLtv * 100)}% {selRow.credit.isUnderwater ? '(Underwater)' : ''}
                </span>
              </div>
              <div className="rounded-xl bg-chip/60 p-2.5">
                <span className="text-muted block text-[11px]">IFRS 9 ECL Uplift</span>
                <span className="text-base font-bold tabular text-[#dc2626]">+{inr(selRow.credit.eclUplift)}</span>
              </div>
              <div className="rounded-xl bg-chip/60 p-2.5">
                <span className="text-muted block text-[11px]">Resilience Rebate</span>
                <span className="text-base font-bold tabular text-[#10b981]">{selRow.credit.strategy === 'Adapt' ? '-25 bps' : 'Standard'}</span>
              </div>
              <div className="rounded-xl bg-chip/60 p-2.5">
                <span className="text-muted block text-[11px]">Repayment Buffer</span>
                <span className="text-base font-bold tabular text-ink">{inr(selRow.credit.repaymentHolidayInr)}</span>
              </div>
            </div>
            {selRow.credit.resilienceMeasures.length > 0 && (
              <div className="rounded-xl bg-chip/40 p-3 border border-line/40 flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent" /> Recommended Engineering Adaptation Measures:
                </span>
                <ul className="text-xs text-muted list-disc list-inside space-y-1">
                  {selRow.credit.resilienceMeasures.map((m, idx) => (
                    <li key={idx}><span className="text-ink">{m}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
        {selRow?.site && <HazardTable site={selRow.site} scenario={scenario} year={selRow.horizon} />}
        {selRow && <TransitionCard site={selRow.site} sector={selRow.sector ?? ''} ngfs={ngfs} onNgfs={setNgfs} year={horizon === 'maturity' ? selRow.maturityYear : year} fx={fx} />}
      </div>

      <aside className="flex flex-col gap-3">
        <section className="rounded-2xl p-4 bg-accent text-on-accent">
          <h2 className="text-[16px] font-bold">Total exposure</h2>
          <p className="text-[32px] font-bold tabular mt-1">{inr(exposure)}</p>
          <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
            <div><p className="text-lg font-bold tabular">{assessed.length}/{rows.length}</p><p className="text-xs opacity-85">Loans assessed</p></div>
            <div><p className="text-lg font-bold tabular">{inr(highExp)}</p><p className="text-xs opacity-85">In High or Severe risk</p></div>
            <div className="col-span-2"><p className="text-lg font-bold tabular">{inr(eal)}</p><p className="text-xs opacity-85">Expected annual loss, river flood + cyclone wind</p></div>
          </div>
        </section>
        <Card title="Risk Appetite Framework (RAF)" sub="Basel & UNEP FI Key Risk Indicators">
          <div className="flex flex-col gap-2.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-line/60">
              <span className="text-muted">KRI 1: High-Risk Capital</span>
              <span className={cx('font-bold tabular', highExp / (exposure || 1) > 0.20 ? 'text-[#dc2626]' : 'text-[#10b981]')}>
                {exposure ? `${((highExp / exposure) * 100).toFixed(1)}%` : '0%'} <span className="text-[10px] text-muted font-normal">(Limit: 20%)</span>
              </span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-line/60">
              <span className="text-muted">KRI 2: Climate ECL Uplift</span>
              <span className="font-bold tabular text-[#dc2626]">+{inr(totalEclUplift)}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-line/60">
              <span className="text-muted">KRI 3: Resilience Loan Pipeline (Adapt)</span>
              <span className="font-bold tabular text-[#10b981]">{inr(adaptPipeline)} ({adaptLoans.length} loans)</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-line/60">
              <span className="text-muted">KRI 4: Underwater Collateral</span>
              <span className={cx('font-bold tabular', underwaterLoans.length > 0 ? 'text-[#dc2626]' : 'text-ink')}>
                {underwaterLoans.length} loan{underwaterLoans.length === 1 ? '' : 's'} · {inr(underwaterExposure)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">KRI 5: Total Repayment Buffer</span>
              <span className="font-bold tabular text-ink">{inr(transferRepaymentCover)}</span>
            </div>
          </div>
        </Card>
        <Card title="Horizon" sub={`${SCENARIOS.find((s) => s.id === scenario)!.label}`}>
          <Tabs label="Horizon" value={horizon} onChange={setHorizon} options={[{ value: 'maturity', label: 'Each loan at maturity' }, { value: 'fixed', label: `All at ${year === 2025 ? 'now' : year}` }]} />
          <p className="text-xs text-muted mt-2">“At maturity” scores each loan at the first year on or after its maturity, so a 2-year loan isn’t judged on 2090 climate.</p>
        </Card>
        <Card title="Exposure by rating" sub="Loan amount in each band (worst hazard)">
          <div className="grid grid-cols-5 gap-1.5 items-end">
            {byBand.map(({ b, amt }) => (
              <div key={b} className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold truncate">{b}</span>
                <div className="h-20 rounded-md bg-chip flex items-end overflow-hidden"><div className="w-full rounded-md" style={{ height: `${exposure ? Math.max(amt ? 4 : 0, (amt / exposure) * 100) : 0}%`, background: RATING_COLOR[b] }} /></div>
                <span className="text-[11px] text-muted tabular">{exposure ? `${Math.round((amt / exposure) * 100)}%` : '—'}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Exposure by transition rating" sub={`UNEP FI sector heatmap · ${inr(unrated)} without a matched sector`}>
          <div className="grid grid-cols-5 gap-1.5 items-end">
            {byTr.map(({ b, amt }) => (
              <div key={b} className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold truncate">{b}</span>
                <div className="h-16 rounded-md bg-chip flex items-end overflow-hidden"><div className="w-full rounded-md" style={{ height: `${exposure ? Math.max(amt ? 4 : 0, (amt / exposure) * 100) : 0}%`, background: RATING_COLOR[b] }} /></div>
                <span className="text-[11px] text-muted tabular">{exposure ? `${Math.round((amt / exposure) * 100)}%` : '—'}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="High-risk exposure by group" sub="Loans with any hazard in the group at High or worse">
          <div className="flex flex-col gap-2.5">
            {byFam.map(({ f, amt }) => (
              <div key={f.id} className="grid grid-cols-[96px_minmax(0,1fr)_76px] items-center gap-2 text-[13px]">
                <span>{f.name}</span><Bar value={exposure ? (amt / exposure) * 100 : 0} color={f.color} /><span className="text-right tabular text-muted">{inr(amt)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Button onClick={onClear} icon={<Trash2 className="w-4 h-4" />}>Clear portfolio</Button>
      </aside>
    </div>
  );
};
