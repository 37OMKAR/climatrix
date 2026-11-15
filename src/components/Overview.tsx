import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpRight, Download, Search, Trash2, Upload, PlusCircle, X, Lightbulb, Radio, Loader2 } from 'lucide-react';
import {
  AssetRiskAssessment,
  Decade,
  HazardType,
  PortfolioSummary,
  ReturnPeriod,
  RiskRating,
  SpatialResolution,
  SSPScenario,
} from '../types/climate';
import {
  ALL_HAZARDS,
  HAZARD_CATALOG,
  HAZARD_FAMILIES,
  HAZARD_TAXONOMY,
  SSP_SCENARIOS,
  formatCurrencyUsd,
  RATING_HEX,
  RATING_ORDER,
} from '../services/climateEngine';
import { MapExplorer } from './MapExplorer';
import { AssetPanel } from './AssetPanel';
import { Card, Kpi, InfoTip, RatingBadge, ScoreBar, Button, Select, EmptyState, cx } from './ui';

interface OverviewProps {
  summary: PortfolioSummary;
  assessments: AssetRiskAssessment[];
  currentScenario: SSPScenario;
  currentDecade: Decade;
  currentReturnPeriod: ReturnPeriod;
  currentResolution: SpatialResolution;
  selectedAssetId: string | null;
  onSelectAsset: (id: string) => void;
  onOpenAsset: (id: string) => void;
  onRemoveAsset: (id: string) => void;
  onExportCsv: () => void;
  onOpenUpload: () => void;
  onOpenAddAsset: () => void;
  onAddAssetAtCoords: (lat: number, lon: number) => void;
  onResolutionChange?: (r: SpatialResolution) => void;
  portfolioName: string;
  entityFilter?: string | null;
  onClearEntityFilter?: () => void;
  liveJob?: { done: number; total: number } | null;
  onCalibrate?: (ids?: string[]) => void;
  onCancelCalibrate?: () => void;
  onClearLive?: (ids?: string[]) => void;
  onOpenMethods?: () => void;
}

type SortKey = 'name' | 'value' | 'score' | 'aal' | 'event';
const PAGE = 15;
const pct = (x: number, d = 2) => `${(x * 100).toFixed(d)}%`;
const rpLabel = (rp: ReturnPeriod) => (rp === 'aal' ? 'average year' : `1-in-${rp.replace('yr', '')}-year event`);

interface ThProps {
  k?: SortKey;
  align?: 'left' | 'right';
  children: React.ReactNode;
  sort: { key: SortKey; asc: boolean };
  setSort: React.Dispatch<React.SetStateAction<{ key: SortKey; asc: boolean }>>;
}
const Th: React.FC<ThProps> = ({ k, align = 'left', children, sort, setSort }) => {
  const active = k && sort.key === k;
  return (
    <th className={cx('px-4 py-2.5 font-medium text-slate-400 whitespace-nowrap', align === 'right' && 'text-right')} aria-sort={active ? (sort.asc ? 'ascending' : 'descending') : undefined}>
      {k ? (
        <button
          onClick={() => setSort((s) => (s.key === k ? { key: k, asc: !s.asc } : { key: k, asc: k === 'name' }))}
          className={cx('inline-flex items-center gap-1 hover:text-white', active && 'text-white')}
        >
          {children}
          {active ? sort.asc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" /> : <ArrowDown className="w-3 h-3 opacity-30" />}
        </button>
      ) : (
        children
      )}
    </th>
  );
};

export const Overview: React.FC<OverviewProps> = (p) => {
  const { summary, assessments } = p;
  const scenario = SSP_SCENARIOS[p.currentScenario];
  const isAal = p.currentReturnPeriod === 'aal';

  const focused = useMemo(
    () => assessments.find((a) => a.asset.id === p.selectedAssetId) ?? [...assessments].sort((a, b) => b.aalUsd - a.aalUsd)[0] ?? null,
    [assessments, p.selectedAssetId],
  );

  // ---- Portfolio trajectory & insights -------------------------------------------------
  const trajectory = useMemo(() => {
    const decades: Decade[] = [2025, 2030, 2040, 2050, 2060, 2070, 2080, 2090];
    return decades.map((d) => ({
      decade: d,
      loss: assessments.reduce((t, a) => t + (a.decadeTrajectory.find((x) => x.decade === d)?.expectedLossUsd ?? 0), 0),
    }));
  }, [assessments]);
  const maxTraj = Math.max(1, ...trajectory.map((t) => t.loss));

  const hazardTotal = summary.hazardBreakdown.reduce((t, h) => t + h.totalExpectedLossUsd, 0) || 1;
  const familyRows = useMemo(
    () =>
      HAZARD_FAMILIES.map((f) => {
        const items = summary.hazardBreakdown.filter((h) => HAZARD_TAXONOMY[h.hazard].family === f.id && h.totalExpectedLossUsd > 0);
        return { ...f, loss: items.reduce((t, h) => t + h.totalExpectedLossUsd, 0), items: items.slice(0, 3) };
      }).sort((a, b) => b.loss - a.loss),
    [summary],
  );
  const liveCount = assessments.filter((a) => a.usesLiveData).length;

  const insights = useMemo(() => {
    const out: string[] = [];
    if (!assessments.length) return out;
    const top = summary.hazardBreakdown[0];
    if (top && top.totalExpectedLossUsd > 0) {
      out.push(`${HAZARD_CATALOG[top.hazard].name} is the single largest loss driver (${Math.round((top.totalExpectedLossUsd / hazardTotal) * 100)}% of modelled loss); ${top.assetsExposedHighOrSevere} of ${assessments.length} sites score High or worse for this hazard.`);
    }
    const hot = assessments.filter((a) => a.compositeScore >= 75).length;
    const high = assessments.filter((a) => a.compositeScore >= 56).length;
    out.push(hot > 0 ? `${hot} of ${assessments.length} site${assessments.length === 1 ? ' is' : 's are'} rated Severe or Catastrophic.` : `${high} of ${assessments.length} site${assessments.length === 1 ? ' is' : 's are'} rated High or worse; none are Severe.`);
    const now = trajectory[0].loss;
    const end = trajectory[trajectory.length - 1].loss;
    if (now > 0) {
      const change = (end - now) / now;
      out.push(`Under ${scenario.code}, losses ${change >= 0 ? 'rise' : 'fall'} ${Math.abs(Math.round(change * 100))}% between today and the 2090s.`);
    }
    // Seismic zone test that does not depend on the Event size control
    const quake = assessments.filter((a) => (a.asset.liveData?.quakesM5Within150km !== undefined ? a.asset.liveData.quakesM5Within150km >= 20 : (a.hazardResults.earthquake?.returnPeriodValues.aal ?? 0) >= 0.2)).length;
    if (quake > 0) out.push(`${quake} site${quake === 1 ? ' is in a high seismic zone' : 's are in high seismic zones'} — earthquake risk doesn't change with climate, but belongs in the same resilience plan.`);
    const top3 = [...assessments].sort((a, b) => b.aalUsd - a.aalUsd).slice(0, 3);
    const share = summary.totalAalUsd > 0 ? top3.reduce((t, a) => t + a.aalUsd, 0) / summary.totalAalUsd : 0;
    if (assessments.length > 5) out.push(`The 3 sites with the largest average annual loss account for ${Math.round(share * 100)}% of the portfolio total.`);
    return out;
  }, [assessments, summary, trajectory, scenario.code, hazardTotal]);

  const [showAllInsights, setShowAllInsights] = useState(false);
  const mainThreatCounts = useMemo(() => {
    const m: Partial<Record<HazardType, number>> = {};
    assessments.forEach((a) => { m[a.primaryHazard] = (m[a.primaryHazard] ?? 0) + 1; });
    return m;
  }, [assessments]);
  const mainThreats = new Set(Object.keys(mainThreatCounts) as HazardType[]);

  // ---- Register table ------------------------------------------------------------------
  const [q, setQ] = useState('');
  const [rating, setRating] = useState<RiskRating | 'all'>('all');
  const [hazard, setHazard] = useState<HazardType | 'all'>('all');
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'aal', asc: false });
  const [page, setPage] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" focuses the table search
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = assessments.filter((a) => {
      if (needle) {
        const hay = `${a.asset.name} ${a.asset.city} ${a.asset.country} ${a.asset.parentEntity} ${a.asset.category} ${a.asset.assetType}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (rating !== 'all' && a.compositeRating !== rating) return false;
      if (hazard !== 'all' && a.primaryHazard !== hazard) return false;
      return true;
    });
    const val = (a: AssetRiskAssessment): number | string =>
      sort.key === 'name' ? a.asset.name : sort.key === 'value' ? a.asset.replacementValueUsd : sort.key === 'score' ? a.compositeScore : sort.key === 'aal' ? a.aalUsd : a.periodExceedanceLossUsd;
    return list.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      const c = typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number);
      return sort.asc ? c : -c;
    });
  }, [assessments, q, rating, hazard, sort]);

  useEffect(() => setPage(0), [q, rating, hazard, sort, assessments.length]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const pageRows = rows.slice(page * PAGE, page * PAGE + PAGE);

  if (!assessments.length) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-10">
        <Card>
          <EmptyState
            title={p.entityFilter ? `No tracked sites for ${p.entityFilter}` : 'This portfolio is empty'}
            body="Import a CSV of your sites, add one by hand, or pick a sample portfolio from the menu at the top."
            action={
              <div className="flex gap-2">
                <Button variant="primary" icon={<Upload className="w-4 h-4" />} onClick={p.onOpenUpload}>Import CSV</Button>
                <Button icon={<PlusCircle className="w-4 h-4" />} onClick={p.onOpenAddAsset}>Add site</Button>
                {p.entityFilter && p.onClearEntityFilter && <Button variant="ghost" onClick={p.onClearEntityFilter}>Clear filter</Button>}
              </div>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-6 space-y-5">
      {/* Headline + data source */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">{p.portfolioName.replace(/\s*\(\$[\d.]+[BMKT]\)\s*$/, '')}</h1>
          <p className="text-sm text-slate-400 mt-1">
            {summary.totalAssets} sites · {scenario.name} · {p.currentDecade === 2025 ? 'today' : `${p.currentDecade}s`} · {rpLabel(p.currentReturnPeriod)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {p.entityFilter && (
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-400/10 text-cyan-200 ring-1 ring-cyan-400/30 pl-3 pr-1 py-1 text-xs">
              Filtered to {p.entityFilter}
              <button onClick={p.onClearEntityFilter} className="p-0.5 rounded-full hover:bg-cyan-400/20" aria-label="Clear company filter">
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}
          <span
            className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ring-1', liveCount ? 'text-emerald-200 ring-emerald-400/30 bg-emerald-500/10' : 'text-slate-300 ring-white/10 bg-white/[0.04]')}
            title={liveCount ? 'Sites calibrated with DEM elevation, CMIP6 projections, USGS earthquakes and GloFAS river flow' : 'Scores come from geographic screening estimates. Calibrate to use real data for each site.'}
          >
            <Radio className="w-3.5 h-3.5" />
            {liveCount === 0 ? 'Estimated data' : liveCount === assessments.length ? 'Live data · all sites' : `Live data · ${liveCount}/${assessments.length} sites`}
          </span>
          {p.liveJob ? (
            <span className="inline-flex items-center gap-2 text-xs text-slate-300">
              <span className="w-24 h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><span className="block h-full bg-cyan-400 transition-all" style={{ width: `${(p.liveJob.done / p.liveJob.total) * 100}%` }} /></span>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />{p.liveJob.done}/{p.liveJob.total}
              <Button size="sm" variant="ghost" onClick={p.onCancelCalibrate}>Cancel</Button>
            </span>
          ) : (
            <>
              {liveCount > 0 && p.onClearLive && <Button size="sm" variant="ghost" onClick={() => p.onClearLive!()}>Revert</Button>}
              {p.onCalibrate && (
                <Button size="sm" variant={liveCount ? 'secondary' : 'primary'} icon={<Radio className="w-4 h-4" />} onClick={() => p.onCalibrate!()} title="Fetch real elevation, CMIP6 projections, earthquake history and river flow for every site">
                  {liveCount ? 'Refresh' : 'Calibrate with live data'}
                </Button>
              )}
            </>
          )}

        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="Portfolio value" value={formatCurrencyUsd(summary.totalReplacementValueUsd)} sub={`${summary.totalAssets} site${summary.totalAssets === 1 ? '' : 's'} · replacement value`} />
        <Kpi
          label="Average annual loss"
          tag="any event size"
          value={formatCurrencyUsd(summary.totalAalUsd)}
          sub={`${pct(summary.totalReplacementValueUsd ? summary.totalAalUsd / summary.totalReplacementValueUsd : 0)} of value per year`}
          hint="The long-run average yearly damage from all hazards, counting small frequent events and rare big ones. Use it for budgeting and adaptation business cases. It does not change with the Event size control."
        />
        {isAal ? (
          <Kpi
            label="Business interruption"
            tag="average year"
            value={formatCurrencyUsd(assessments.reduce((t, a) => t + a.businessInterruptionLossUsd, 0))}
            sub={`~${Math.round(assessments.reduce((t, a) => t + a.downtimeDays, 0) / assessments.length)} days downtime per site per event`}
            hint="Estimated lost operations while sites recover. Pick a 1-in-N event size above to see event losses instead."
          />
        ) : (
          <Kpi
            label="If every site is hit at once"
            tag={`1-in-${p.currentReturnPeriod.replace('yr', '')}`}
            value={formatCurrencyUsd(summary.totalPeriodExceedanceLossUsd)}
            sub="Sum of site losses — an upper bound"
            hint={`Each site suffers its own 1-in-${p.currentReturnPeriod.replace('yr', '')}-year event and the losses are added up. Sites rarely all have a bad year together, so this is an upper bound and can exceed the portfolio 1-in-200 figure.`}
          />
        )}
        <Kpi
          label="Portfolio bad year"
          tag="1-in-200"
          value={formatCurrencyUsd(summary.var995Usd)}
          sub={summary.totalAssets < 5 ? 'Value at Risk 99.5% · too few sites to diversify' : `Value at Risk 99.5% · ${summary.copulaCorrelationStatus.toLowerCase()}`}
          hint={`The whole-portfolio loss expected to be exceeded only once in 200 years (VaR 99.5%, the Solvency II standard). It allows for diversification: sites far apart rarely suffer together, so it is usually below the sum of site losses. 1-in-20 (VaR 95%): ${formatCurrencyUsd(summary.var95Usd)}.`}
        />
        <div className="rounded-2xl border border-white/[0.06] bg-slate-900/70 px-4 py-3.5 sm:col-span-2 lg:col-span-1">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            Risk score
            <InfoTip text="0–100 index combining all hazards, weighted by how vulnerable each site type is, averaged across sites. Bands: Very Low <18, Low <36, Moderate <56, High <75, Severe <90, Catastrophic 90+. It rises with rarer event sizes." />
            <span className="ml-auto shrink-0 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-slate-400">{isAal ? 'average year' : `1-in-${p.currentReturnPeriod.replace('yr', '')}`}</span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-white tabular-nums">{summary.portfolioRiskScore}</span>
            <span className="text-xs text-slate-500">/ 100</span>
            <span className="ml-auto"><RatingBadge rating={summary.portfolioRating} /></span>
          </div>
          <ScoreBar score={summary.portfolioRiskScore} rating={summary.portfolioRating} className="mt-2.5" />
        </div>
      </div>

      {p.currentDecade === 2025 && (
        <div className="text-xs text-slate-400 -mt-2">Today, all scenarios share the same baseline. Pick a future year to see them diverge.</div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.04] px-5 py-3.5 flex gap-3">
          <Lightbulb className="w-4 h-4 text-cyan-300 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-cyan-200/80 mb-1">Key findings</div>
            <ul className="space-y-1 text-sm text-slate-200">
              {(showAllInsights ? insights : insights.slice(0, 3)).map((s) => <li key={s}>{s}</li>)}
            </ul>
            {insights.length > 3 && (
              <button onClick={() => setShowAllInsights((v) => !v)} className="mt-1.5 text-xs text-cyan-300 hover:text-cyan-200">
                {showAllInsights ? 'Show fewer' : `Show ${insights.length - 3} more`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Map + focus panel */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-7 h-[540px] rounded-2xl overflow-hidden border border-white/[0.06]">
          <MapExplorer
            compact
            assessments={assessments}
            selectedAssetId={p.selectedAssetId}
            highlightAssetId={focused?.asset.id ?? null}
            onSelectAsset={p.onSelectAsset}
            onOpenAsset={p.onOpenAsset}
            currentScenario={p.currentScenario}
            currentDecade={p.currentDecade}
            currentReturnPeriod={p.currentReturnPeriod}
            currentResolution={p.currentResolution}
            onAddAssetAtCoords={p.onAddAssetAtCoords}
            onResolutionChange={p.onResolutionChange}
          />
        </div>
        <div className="xl:col-span-5 h-[540px]">
          <AssetPanel
            assessment={focused}
            currentDecade={p.currentDecade}
            currentScenario={p.currentScenario}
            onOpenDetails={p.onOpenAsset}
            onFetchLive={p.onCalibrate ? (id) => p.onCalibrate!([id]) : undefined}
            liveBusy={!!p.liveJob}
          />
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card title="What drives the loss" subtitle={`Share of ${isAal ? 'average annual' : 'event'} loss by hazard family`}>
          <ul className="space-y-3">
            {familyRows.filter((f) => f.loss > 0).map((f) => {
              const share = f.loss / hazardTotal;
              return (
                <li key={f.id} title={f.description}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-100 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: f.color }} />{f.name}</span>
                    <span className="text-slate-400 tabular-nums">
                      {formatCurrencyUsd(f.loss)} <span className="text-slate-200 inline-block w-10 text-right">{Math.round(share * 100)}%</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(1, share * 100)}%`, backgroundColor: f.color }} />
                  </div>
                  <div className="text-xs text-slate-400 mt-1 truncate">
                    {f.items.map((h) => `${HAZARD_CATALOG[h.hazard].shortName} ${Math.round((h.totalExpectedLossUsd / hazardTotal) * 100)}%`).join(' · ')}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="Risk mix" subtitle="How many sites fall in each rating">
          <div className="flex h-3 rounded-full overflow-hidden gap-[2px] bg-transparent">
            {RATING_ORDER.map((r) => {
              const n = summary.distributionByRating[r] ?? 0;
              return n > 0 ? <div key={r} title={`${r}: ${n}`} style={{ flexGrow: n, backgroundColor: RATING_HEX[r] }} /> : null;
            })}
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
            {RATING_ORDER.filter((r) => (summary.distributionByRating[r] ?? 0) > 0).map((r) => {
              const n = summary.distributionByRating[r] ?? 0;
              return (
                <li key={r}>
                  <button
                    onClick={() => setRating((cur) => (cur === r ? 'all' : r))}
                    className={cx('w-full flex items-center justify-between text-xs rounded-lg px-2 py-1.5 transition-colors', rating === r ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]')}
                    title="Filter the table below"
                  >
                    <span className="flex items-center gap-2 text-slate-200">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: RATING_HEX[r] }} />
                      {r}
                    </span>
                    <span className="tabular-nums text-slate-300">{n}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-slate-400 mt-3">Click a rating to filter the sites table.</p>
        </Card>

        <Card title="Outlook" subtitle={`Portfolio ${isAal ? 'average annual' : 'event'} loss by decade · ${scenario.code}`}>
          <div className="h-40 flex items-end gap-2 pt-5">
            {trajectory.map((t, i) => {
              const cur = t.decade === p.currentDecade;
              const labelled = cur || i === 0 || i === trajectory.length - 1;
              return (
                <div key={t.decade} className="flex-1 min-w-0 h-full flex flex-col items-center justify-end gap-1 group" title={`${t.decade}: ${formatCurrencyUsd(t.loss)}`}>
                  <div className={cx('relative w-full rounded-t-md transition-colors', cur ? 'bg-cyan-400' : 'bg-slate-600/60 group-hover:bg-slate-500')} style={{ height: `${Math.max(3, (t.loss / maxTraj) * 85)}%` }}>
                    <span className={cx('absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] tabular-nums pointer-events-none', cur ? 'text-cyan-200' : labelled ? 'text-slate-300' : 'text-slate-300 opacity-0 group-hover:opacity-100')}>{formatCurrencyUsd(t.loss)}</span>
                  </div>
                  <span className={cx('text-xs tabular-nums', cur ? 'text-cyan-300' : 'text-slate-400')}>{t.decade === 2025 ? 'Now' : `’${String(t.decade).slice(2)}`}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Register */}
      <Card
        title="Sites"
        subtitle={`${rows.length} of ${assessments.length} shown · sorted by ${({ name: 'name', value: 'value', score: 'risk score', aal: 'average annual loss', event: 'event loss' } as const)[sort.key]} · click a row to focus it above`}
        actions={
          <>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search  ( / )"
                aria-label="Search sites"
                className="w-56 rounded-xl bg-slate-950/70 ring-1 ring-inset ring-white/[0.08] pl-8 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-cyan-400/60"
              />
            </div>
            <Select value={rating} onChange={(e) => setRating(e.target.value as RiskRating | 'all')} aria-label="Filter by rating">
              <option value="all">All ratings</option>
              {RATING_ORDER.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
            <Select value={hazard} onChange={(e) => setHazard(e.target.value as HazardType | 'all')} aria-label="Filter by main threat">
              <option value="all">All main threats</option>
              {HAZARD_FAMILIES.map((f) => {
                const present = ALL_HAZARDS.filter((h) => HAZARD_TAXONOMY[h].family === f.id && mainThreats.has(h));
                return present.length ? (
                  <optgroup key={f.id} label={f.name}>
                    {present.map((h) => <option key={h} value={h}>{HAZARD_CATALOG[h].name} ({mainThreatCounts[h]})</option>)}
                  </optgroup>
                ) : null;
              })}
            </Select>
            <Button size="sm" icon={<Download className="w-4 h-4" />} onClick={p.onExportCsv}>CSV</Button>
          </>
        }
        bodyClassName="px-0 pb-0"
      >
        <div className="relative overflow-x-auto border-t border-white/[0.06]">
          <table className="w-full text-sm">
            <thead className="text-xs bg-white/[0.02]">
              <tr className="text-left">
                <Th sort={sort} setSort={setSort} k="name">Site</Th>
                <Th sort={sort} setSort={setSort}>Location</Th>
                <Th sort={sort} setSort={setSort} k="value" align="right">Value</Th>
                <Th sort={sort} setSort={setSort} k="score">Risk</Th>
                <Th sort={sort} setSort={setSort}>Main threat</Th>
                <Th sort={sort} setSort={setSort} k="aal" align="right">Avg annual loss</Th>
                {!isAal && <Th sort={sort} setSort={setSort} k="event" align="right">{p.currentReturnPeriod.replace('yr', '')}-yr event</Th>}
                <Th sort={sort} setSort={setSort} align="right"><span className="sr-only">Actions</span></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {pageRows.map((a) => {
                const sel = a.asset.id === focused?.asset.id;
                return (
                  <tr
                    key={a.asset.id}
                    onClick={() => p.onSelectAsset(a.asset.id)}
                    onDoubleClick={() => p.onOpenAsset(a.asset.id)}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') p.onOpenAsset(a.asset.id); else if (e.key === ' ') { e.preventDefault(); p.onSelectAsset(a.asset.id); } }}
                    aria-selected={sel}
                    className={cx('cursor-pointer transition-colors focus:outline-none focus-visible:bg-white/[0.05]', sel ? 'bg-cyan-400/[0.06]' : 'hover:bg-white/[0.03]')}
                  >
                    <td className={cx('px-4 py-3 max-w-[320px]', sel && 'shadow-[inset_3px_0_0_#22d3ee]')}>
                      <div className="text-white truncate flex items-center gap-1.5">{a.usesLiveData && <span title="Uses live data"><Radio className="w-3 h-3 text-emerald-300 shrink-0" /></span>}{a.asset.name}</div>
                      <div className="text-xs text-slate-500 truncate">{a.asset.parentEntity} · {a.asset.assetType}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300 whitespace-nowrap">{a.asset.city}, {a.asset.country}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-200">{formatCurrencyUsd(a.asset.replacementValueUsd)}</td>
                    <td className="px-4 py-3 min-w-[150px]">
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums text-white w-8">{a.compositeScore}</span>
                        <RatingBadge rating={a.compositeRating} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300 whitespace-nowrap">{HAZARD_CATALOG[a.primaryHazard].name}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-white">{formatCurrencyUsd(a.aalUsd)}</td>
                    {!isAal && <td className="px-4 py-3 text-right tabular-nums text-slate-200">{formatCurrencyUsd(a.periodExceedanceLossUsd)}</td>}
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => { e.stopPropagation(); p.onOpenAsset(a.asset.id); }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06]"
                        title="Open full analysis"
                        aria-label={`Open full analysis for ${a.asset.name}`}
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); p.onRemoveAsset(a.asset.id); }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-300 hover:bg-red-500/10"
                        title="Remove from portfolio"
                        aria-label={`Remove ${a.asset.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {pageRows.length === 0 && (
                <tr><td colSpan={8}><EmptyState title="No sites match these filters" action={<Button size="sm" onClick={() => { setQ(''); setRating('all'); setHazard('all'); }}>Clear filters</Button>} /></td></tr>
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.06] text-xs text-slate-400">
            <span className="tabular-nums">{page * PAGE + 1}–{Math.min(rows.length, (page + 1) * PAGE)} of {rows.length}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((x) => x - 1)}>Previous</Button>
              <Button size="sm" variant="ghost" disabled={page >= pages - 1} onClick={() => setPage((x) => x + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
