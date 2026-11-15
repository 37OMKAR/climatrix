import React, { useMemo, useState } from 'react';
import { Search, ArrowRight } from 'lucide-react';
import { CORPORATE_ENTITIES_SAMPLE } from '../services/corporateEntities';
import { Asset, CorporateEntity } from '../types/climate';
import { HAZARD_CATALOG, HAZARD_FAMILIES, HAZARD_TAXONOMY, formatCurrencyUsd, getRatingFromScore } from '../services/climateEngine';
import { assetsForEntity } from '../services/entityMatch';
import { Card, Kpi, RatingBadge, Select, Button, EmptyState, cx } from './ui';

interface CorporateEntityExplorerProps {
  onLoadEntityPortfolio?: (entityName: string) => void;
  knownAssets?: Asset[];
}

export const CorporateEntityExplorer: React.FC<CorporateEntityExplorerProps> = ({ onLoadEntityPortfolio, knownAssets = [] }) => {
  const [q, setQ] = useState('');
  const [sector, setSector] = useState('all');
  const [sel, setSel] = useState<CorporateEntity>(CORPORATE_ENTITIES_SAMPLE[0]);

  const sectors = useMemo(() => Array.from(new Set(CORPORATE_ENTITIES_SAMPLE.map((e) => e.sector.split(' / ')[0]))).sort(), []);
  const matches = useMemo(() => new Map(CORPORATE_ENTITIES_SAMPLE.map((e) => [e.id, assetsForEntity(e.name, knownAssets)])), [knownAssets]);

  const rows = CORPORATE_ENTITIES_SAMPLE.filter((e) => {
    const hay = `${e.name} ${e.ticker ?? ''} ${e.sector} ${e.headquarters}`.toLowerCase();
    return hay.includes(q.toLowerCase()) && (sector === 'all' || e.sector.startsWith(sector));
  }).sort((a, b) => b.aggregatePhysicalRiskScore - a.aggregatePhysicalRiskScore);

  const selMatches = matches.get(sel.id) ?? [];
  const selRating = getRatingFromScore(sel.aggregatePhysicalRiskScore);

  return (
    <div className="px-4 sm:px-6 py-6 space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">Companies</h1>
        <p className="text-sm text-slate-400 mt-1">
          Company-level physical risk for issuers and counterparties. Where a company’s sites are in the loaded data you can open them on the dashboard. Sample of {CORPORATE_ENTITIES_SAMPLE.length} companies.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(ev) => setQ(ev.target.value)}
            placeholder="Search company, ticker or sector"
            aria-label="Search companies"
            className="w-64 rounded-xl bg-slate-950/70 ring-1 ring-inset ring-white/[0.08] pl-8 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-cyan-400/60"
          />
        </div>
        <Select value={sector} onChange={(ev) => setSector(ev.target.value)} aria-label="Sector">
          <option value="all">All sectors</option>
          {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <Card className="xl:col-span-7" bodyClassName="p-0">
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-400 bg-white/[0.02]">
                <tr className="text-left">
                  <th className="px-4 py-2.5 font-medium">Company</th>
                  <th className="px-4 py-2.5 font-medium">Physical risk</th>
                  <th className="px-4 py-2.5 font-medium text-right">Market cap</th>
                  <th className="px-4 py-2.5 font-medium text-right">Climate rating</th>
                  <th className="px-4 py-2.5 font-medium text-right" title="Sites of this company in the loaded data">In data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {rows.map((e) => {
                  const active = e.id === sel.id;
                  const n = matches.get(e.id)?.length ?? 0;
                  return (
                    <tr key={e.id} onClick={() => setSel(e)} className={cx('cursor-pointer', active ? 'bg-cyan-400/[0.06]' : 'hover:bg-white/[0.03]')}>
                      <td className={cx('px-4 py-2.5', active && 'shadow-[inset_3px_0_0_#22d3ee]')}>
                        <div className="text-white">{e.name}</div>
                        <div className="text-xs text-slate-500">{e.ticker ? `${e.ticker} · ` : ''}{e.sector}</div>
                      </td>
                      <td className="px-4 py-2.5"><RatingBadge rating={getRatingFromScore(e.aggregatePhysicalRiskScore)} score={e.aggregatePhysicalRiskScore} /></td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-200">{formatCurrencyUsd(e.marketCapUsdBillions * 1e9)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-200">{e.climateRating}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{n ? <span className="text-white">{n}</span> : <span className="text-slate-600">—</span>}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && <tr><td colSpan={5}><EmptyState title="No companies match" /></td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="xl:col-span-5" title={sel.name} subtitle={`${sel.sector} · HQ ${sel.headquarters} · parent ${sel.ultimateParent}`}>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Aggregate physical risk</span>
              <RatingBadge rating={selRating} score={sel.aggregatePhysicalRiskScore} size="md" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Kpi label="Market cap" value={formatCurrencyUsd(sel.marketCapUsdBillions * 1e9)} />
              <Kpi label="Asset replacement value" value={formatCurrencyUsd(sel.portfolioReplacementValueUsd)} sub={`${sel.trackedAssetCount.toLocaleString()} tracked locations`} />
              <Kpi label="Climate rating" value={sel.climateRating} sub="AAA (best) to CCC" />
              <Kpi label="TCFD alignment" value={`${sel.tcfdAlignmentScore}%`} sub="disclosure completeness" />
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-2">Top hazards</div>
              <div className="flex flex-wrap gap-1.5">
                {sel.topHazardRisks.map((h) => (
                  <span key={h} className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2 py-1 text-xs text-slate-200">
                    <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: HAZARD_FAMILIES.find((f) => f.id === HAZARD_TAXONOMY[h].family)!.color }} />
                    {HAZARD_CATALOG[h].shortName}
                  </span>
                ))}
              </div>
            </div>
            {onLoadEntityPortfolio && (
              <div className="rounded-xl bg-white/[0.03] px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-sm text-slate-300">
                  {selMatches.length ? `${selMatches.length} site${selMatches.length === 1 ? '' : 's'} in the loaded data` : 'No sites for this company in the loaded data'}
                </span>
                <Button size="sm" variant="primary" disabled={!selMatches.length} icon={<ArrowRight className="w-4 h-4" />} onClick={() => onLoadEntityPortfolio(sel.name)}>
                  Show on dashboard
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
