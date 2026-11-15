import React, { useMemo, useState } from 'react';
import { Search, Download, Loader2, Trash2 } from 'lucide-react';
import { MapView, type Theme, type Layer } from '../ui/MapView';
import { Card, Tabs, Button, RatingChip, Bar, cx } from '../ui/kit';
import { HazardTable } from '../ui/HazardTable';
import { summarise, losses, type SiteParams } from '../engine/assess';
import { FAMILIES, HAZARDS, HAZARD, RATINGS, RATING_COLOR, SCENARIOS, yearForMaturity, type Scenario, type Year } from '../engine/hazards';
import { usable, type Loan } from '../engine/portfolio';
import { inr } from '../lib/format';
import { transitionFor, toInrPerTonne, type NgfsScenario, type FxSettings, type TransitionView } from '../engine/transition';
import { TransitionCard } from '../ui/TransitionCard';
import { ratingOf as bandOf } from '../engine/hazards';

export const siteKey = (lat: number, lon: number) => `${lat.toFixed(3)},${lon.toFixed(3)}`;

type Row = Loan & { horizon: Year; sum: ReturnType<typeof summarise> | null; eal: number; site: SiteParams | null; tr: TransitionView };

export const PortfolioPage: React.FC<{
  theme: Theme; loans: Loan[]; sites: Record<string, SiteParams>; scenario: Scenario; year: Year;
  horizon: 'maturity' | 'fixed'; setHorizon: (h: 'maturity' | 'fixed') => void;
  run: { phase: 'idle' | 'geocoding' | 'assessing'; done: number; total: number; error?: string };
  onUpload: () => void; onClear: () => void; onRetry: () => void; ngfs: NgfsScenario; setNgfs: (s: NgfsScenario) => void; fx: FxSettings;
}> = ({ theme, loans, sites, scenario, year, horizon, setHorizon, run, onUpload, onClear, onRetry, ngfs, setNgfs, fx }) => {
  const [tab, setTab] = useState<'all' | 'high' | 'long' | 'issues'>('all');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [colour, setColour] = useState<'rating' | 'hazard'>('rating');
  const [layer, setLayer] = useState<Layer>('street');

  const rows: Row[] = useMemo(() => loans.map((l) => {
    const h = horizon === 'maturity' ? yearForMaturity(l.maturityYear) : year;
    const site = usable(l) ? sites[siteKey(l.lat!, l.lon!)] ?? null : null;
    const sum = site ? summarise(site, scenario, h) : null;
    const eal = site ? losses(site, l.amount, l.cls, scenario, h).totalEal : NaN;
    const tr = transitionFor(l.sector, site?.admin?.iso3, ngfs, horizon === 'maturity' ? l.maturityYear : year);
    return { ...l, horizon: h, sum, eal, site, tr };
  }), [loans, sites, scenario, year, horizon, ngfs]);

  const assessed = rows.filter((r) => r.sum);
  const exposure = rows.filter((r) => Number.isFinite(r.amount)).reduce((t, r) => t + r.amount, 0);
  const highExp = assessed.filter((r) => r.sum!.maxScore >= 60).reduce((t, r) => t + r.amount, 0);
  const eal = assessed.reduce((t, r) => t + (Number.isFinite(r.eal) ? r.eal : 0), 0);
  const byBand = RATINGS.map((b) => ({ b, amt: assessed.filter((r) => r.sum!.rating === b).reduce((t, r) => t + r.amount, 0) }));
  const byTr = RATINGS.map((b) => ({ b, amt: rows.filter((r) => Number.isFinite(r.tr.score) && bandOf(r.tr.score) === b).reduce((t, r) => t + r.amount, 0) }));
  const unrated = rows.filter((r) => !Number.isFinite(r.tr.score)).reduce((t, r) => t + r.amount, 0);
  const byFam = FAMILIES.map((f) => ({ f, amt: assessed.filter((r) => r.sum!.values.some((v) => v.status === 'ok' && v.score >= 60 && HAZARD[v.id].family === f.id)).reduce((t, r) => t + r.amount, 0) }));

  const thisYear = new Date().getFullYear();
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
    const head = ['loan_id', 'borrower', 'district', 'state', 'lat', 'lon', 'geocode_precision', 'amount_inr', 'tenure_months', 'maturity_year', 'horizon_year', 'scenario', 'overall_rating', 'max_score', 'main_hazard', 'high_hazards', 'eal_flood_cyclone_inr', 'sector', 'unepfi_segment', 'unepfi_rating', 'ngfs_scenario', 'carbon_price_usd2010_gcam', 'carbon_price_inr_per_t_gcam', ...HAZARDS.filter((h) => !h.notAssessed).map((h) => `${h.id}_score`)];
    const lines = rows.map((r) => [r.loanId, r.borrower, r.district ?? '', r.state ?? '', r.lat ?? '', r.lon ?? '', r.geo.precision ?? r.geo.status, r.amount, r.tenureMonths, r.maturityYear, r.horizon, scenario,
      r.sum?.rating ?? '', r.sum?.maxScore ?? '', r.sum?.top ? HAZARD[r.sum.top.id].name : '', r.sum?.highCount ?? '', Number.isFinite(r.eal) ? Math.round(r.eal) : '',
      r.sector ?? '', r.tr.segment ? `${r.tr.segment.sector} · ${r.tr.segment.segment}` : '', r.tr.segment?.rating ?? '', ngfs,
      Number.isFinite(r.tr.price.G) ? Math.round(r.tr.price.G) : '', Number.isFinite(r.tr.price.G) ? Math.round(toInrPerTonne(r.tr.price.G, fx)) : '',
      ...HAZARDS.filter((h) => !h.notAssessed).map((h) => { const v = r.sum?.values.find((x) => x.id === h.id); return v && v.status === 'ok' ? v.score : ''; })]);
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
                <option value="street">Street (Carto)</option>
                <option value="osm">OpenStreetMap (Free)</option>
                <option value="satellite">Satellite (Esri)</option>
                <option value="dark">Dark Matter (Carto)</option>
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
          <div className="px-4 py-3.5 flex flex-wrap items-center gap-3">
            <h2 className="text-[17px] font-bold flex-1">Loans <span className="text-muted font-medium text-sm">· {filtered.length} of {rows.length}</span></h2>
            <Tabs dark label="Filter loans" value={tab} onChange={setTab} options={[{ value: 'all', label: 'All' }, { value: 'high', label: 'High+' }, { value: 'long', label: 'Maturing after 2035' }, { value: 'issues', label: 'Issues' }]} />
            <Button onClick={exportCsv} icon={<Download className="w-4 h-4" />}>CSV</Button>
          </div>
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
        </section>
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
