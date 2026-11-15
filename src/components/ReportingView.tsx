import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileText, Printer } from 'lucide-react';
import { AssetRiskAssessment, Decade, PortfolioSummary, RegulatoryFramework, SSPScenario } from '../types/climate';
import { ALL_HAZARDS, HAZARD_CATALOG, HAZARD_FAMILIES, HAZARD_TAXONOMY, REGULATORY_FRAMEWORKS, SSP_SCENARIOS, formatCurrencyUsd } from '../services/climateEngine';
import { computeDisclosures } from '../services/disclosures';
import { Card, Kpi, RatingBadge, Segmented, Button, EmptyState, cx } from './ui';

interface Props {
  summary: PortfolioSummary;
  assessments: AssetRiskAssessment[];
  currentScenario: SSPScenario;
  currentDecade: Decade;
  onOpenReport: () => void;
}

const FRAMEWORKS: { id: RegulatoryFramework; label: string }[] = [
  { id: 'tcfd', label: 'TCFD' },
  { id: 'csrd_esrs', label: 'CSRD / ESRS E1' },
  { id: 'issb_ifrs2', label: 'ISSB / IFRS S2' },
  { id: 'sec_climate', label: 'SEC' },
  { id: 'eu_taxonomy', label: 'EU Taxonomy' },
  { id: 'ngfs', label: 'NGFS' },
];

const pct = (x: number) => `${(x * 100).toFixed(2)}%`;

export const ReportingView: React.FC<Props> = ({ summary, assessments, currentScenario, currentDecade, onOpenReport }) => {
  const [fw, setFw] = useState<RegulatoryFramework>('tcfd');
  const d = useMemo(() => computeDisclosures(assessments, summary, currentScenario), [assessments, summary, currentScenario]);
  const meta = REGULATORY_FRAMEWORKS[fw];
  const scen = SSP_SCENARIOS[currentScenario];
  const maxScenLoss = Math.max(1, ...d.scenarioRows.map((r) => r.lossUsd));

  if (!assessments.length) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-10">
        <Card><EmptyState title="Nothing to report yet" body="Add or import sites first — the disclosures are computed from your portfolio." /></Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-6 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">Disclosure reporting</h1>
          <p className="text-sm text-slate-400 mt-1">
            Figures computed live from {summary.totalAssets} sites under {scen.name}, {currentDecade === 2025 ? 'today' : `${currentDecade}s`}.
          </p>
        </div>
        <div className="flex gap-2 no-print">
          <Button icon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>Print</Button>
          <Button variant="primary" icon={<FileText className="w-4 h-4" />} onClick={onOpenReport}>Open full dossier</Button>
        </div>
      </div>

      <div className="relative overflow-x-auto no-print">
        <Segmented value={fw} onChange={setFw} options={FRAMEWORKS.map((f) => ({ value: f.id, label: f.label }))} ariaLabel="Framework" />
      </div>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <div className="text-xs text-cyan-300">{meta.authority}</div>
            <div className="text-base font-semibold text-white mt-0.5">{meta.name}</div>
            <p className="text-sm text-slate-400 mt-1">{meta.focus}</p>
          </div>
          <span className={cx('text-xs px-2.5 py-1 rounded-full ring-1', meta.mandateStatus === 'Mandatory' ? 'text-rose-200 ring-rose-400/40 bg-rose-500/10' : 'text-amber-200 ring-amber-400/30 bg-amber-500/10')}>
            {meta.mandateStatus}
          </span>
          <span className="w-full text-xs text-slate-500">Whether this applies to you depends on jurisdiction and entity size.</span>
        </div>
      </Card>

      {fw === 'tcfd' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Average annual loss" value={formatCurrencyUsd(d.totalAal)} sub={`${pct(d.aalPctOfValue)} of portfolio value`} />
            <Kpi label="Sites rated High or worse" value={`${d.highOrAboveCount}`} sub={`of ${summary.totalAssets} · ${d.severeOrAboveCount} Severe+`} />
            <Kpi label="Adaptation capex (High+ sites)" value={formatCurrencyUsd(d.adaptationCapexHighRisk)} sub={`avoids ${formatCurrencyUsd(d.annualLossAvoided)} loss / yr portfolio-wide`} />
            <Kpi label="15-yr net benefit" value={formatCurrencyUsd(d.netBenefit15yPositive)} sub={`${d.positiveNpvAssetCount} sites with positive payback`} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              { t: 'Governance', b: '[Describe board and management oversight of physical climate risk and how these results feed capital decisions.]' },
              { t: 'Strategy', b: `Portfolio stress-tested across all five SSP pathways. Under ${scen.code} in the ${currentDecade === 2025 ? 'present day' : `${currentDecade}s`}, the ${summary.lossMetricType === 'AAL' ? 'average annual loss' : `1-in-${(assessments[0]?.returnPeriod ?? '100yr').replace('yr', '')}-year event loss (sum of sites)`} is ${formatCurrencyUsd(d.scenarioRows.find((r) => r.isActive)?.lossUsd ?? 0)}.` },
              { t: 'Risk management', b: `${ALL_HAZARDS.length} acute, chronic and geophysical hazards assessed per site with non-linear damage functions. ${HAZARD_CATALOG[summary.topExposedHazard].name} is the largest loss driver.` },
              { t: 'Metrics & targets', b: `Average annual loss currently ${pct(d.aalPctOfValue)} of value. Implementing recommended measures would cut it to ${formatCurrencyUsd(d.residualAalAfterAdaptation)} per year.` },
            ].map((x, i) => (
              <Card key={x.t} title={`${i + 1}. ${x.t}`}>
                <p className="text-sm text-slate-300 leading-relaxed">{x.b}</p>
              </Card>
            ))}
          </div>
          <Card title="Exposure by hazard" subtitle="Grouped by family; hazards with no exposure in this portfolio are hidden" bodyClassName="px-0 pb-0">
            <div className="relative overflow-x-auto border-t border-white/[0.06]">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-400 bg-white/[0.02]">
                  <tr className="text-left">
                    <th className="px-5 py-2.5 font-medium">Family</th>
                    <th className="px-5 py-2.5 font-medium">Hazard</th>
                    <th className="px-5 py-2.5 font-medium text-right">Avg score</th>
                    <th className="px-5 py-2.5 font-medium text-right">{summary.lossMetricType === 'AAL' ? 'Average annual loss' : `1-in-${(assessments[0]?.returnPeriod ?? '100yr').replace('yr', '')} event loss`}</th>
                    <th className="px-5 py-2.5 font-medium text-right">Sites High+</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {HAZARD_FAMILIES.flatMap((f) => summary.hazardBreakdown.filter((h) => HAZARD_TAXONOMY[h.hazard].family === f.id && h.averageScore > 0)).map((h) => (
                    <tr key={h.hazard}>
                      <td className="px-5 py-2.5 text-xs whitespace-nowrap" style={{ color: HAZARD_FAMILIES.find((f) => f.id === HAZARD_TAXONOMY[h.hazard].family)!.color }}>{HAZARD_FAMILIES.find((f) => f.id === HAZARD_TAXONOMY[h.hazard].family)!.short}</td>
                      <td className="px-5 py-2.5 text-white" title={HAZARD_CATALOG[h.hazard].cmip6ModelBasis}>{h.hazardName}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-slate-200">{h.averageScore}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-white">{formatCurrencyUsd(h.totalExpectedLossUsd)}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-slate-200">{h.assetsExposedHighOrSevere}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {fw === 'csrd_esrs' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Kpi label="E1-9 · Value at acute risk" value={formatCurrencyUsd(d.grossCarryingAcute)} sub={`Replacement value (proxy for carrying amount) of ${d.acuteSiteCount} of ${summary.totalAssets} sites where any one acute hazard scores High+, even if the overall rating is lower`} />
            <Kpi label="E1-9 · Value at chronic risk" value={formatCurrencyUsd(d.grossCarryingChronic)} sub={`Same test for chronic hazards (heat stress, water stress, sea level rise…): ${d.chronicSiteCount} of ${summary.totalAssets} sites`} />
            <Kpi label="E1-3 · Adaptation capex (High+ sites)" value={formatCurrencyUsd(d.adaptationCapexHighRisk)} sub={`Residual AAL after measures: ${formatCurrencyUsd(d.residualAalAfterAdaptation)}`} />
          </div>
          <TopSites d={d} />
        </>
      )}

      {fw === 'issb_ifrs2' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {d.horizons.map((h) => (
              <Kpi key={h.label} label={h.label} value={formatCurrencyUsd(h.lossUsd)} sub={`${summary.lossMetricType === 'AAL' ? 'Average annual loss' : 'Event loss'} · ${scen.code}`} />
            ))}
          </div>
          <Card title="Resilience assessment">
            <p className="text-sm text-slate-300 leading-relaxed">
              Losses move from {formatCurrencyUsd(d.horizons[0].lossUsd)} in the short term to {formatCurrencyUsd(d.horizons[2].lossUsd)} by 2080 under {scen.code}.
              The 1-in-200-year portfolio loss (VaR 99.5%) is {formatCurrencyUsd(summary.var995Usd)}, equal to {pct(summary.totalReplacementValueUsd ? summary.var995Usd / summary.totalReplacementValueUsd : 0)} of asset value.
            </p>
          </Card>
        </>
      )}

      {fw === 'sec_climate' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Kpi label="1% threshold (proxy)" value={formatCurrencyUsd(d.secThreshold)} sub="1% of portfolio replacement value" />
            <Kpi label="Annualised severe-weather loss" value={formatCurrencyUsd(d.totalAal)} sub="Average annual loss" />
            <div className={cx('rounded-2xl border px-4 py-3.5', d.secMaterial ? 'border-amber-400/30 bg-amber-500/[0.06]' : 'border-emerald-400/30 bg-emerald-500/[0.06]')}>
              <div className="text-xs text-slate-400">Footnote test</div>
              <div className={cx('mt-1.5 text-lg font-semibold flex items-center gap-2', d.secMaterial ? 'text-amber-200' : 'text-emerald-200')}>
                {d.secMaterial ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                {d.secMaterial ? 'Disclosure likely required' : 'Below threshold'}
              </div>
              <div className="text-xs text-slate-400 mt-1">Loss is {d.secThreshold ? (d.totalAal / d.secThreshold).toFixed(2) : '0'}× the threshold</div>
            </div>
          </div>
          <Card>
            <p className="text-sm text-slate-400">
              The SEC rule measures against pre-tax income and equity; portfolio value is used here as a proxy. Confirm against your financial statements before filing.
            </p>
          </Card>
        </>
      )}

      {fw === 'eu_taxonomy' && (
        <Card title="Do No Significant Harm — climate adaptation screening" subtitle="A group is flagged when at least one site scores Severe (75+) on any hazard in that group">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {d.dnsh.map((g) => (
              <div key={g.id} className={cx('rounded-xl p-4 ring-1', g.status === 'clear' ? 'ring-emerald-400/25 bg-emerald-500/[0.05]' : 'ring-amber-400/30 bg-amber-500/[0.06]')}>
                <div className="text-sm font-medium text-white">{g.name}</div>
                <div className="text-xs text-slate-500">{g.examples}</div>
                <div className={cx('mt-3 text-sm flex items-center gap-1.5', g.status === 'clear' ? 'text-emerald-200' : 'text-amber-200')}>
                  {g.status === 'clear' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {g.status === 'clear' ? 'No material risk' : `Plan needed · ${g.assetsAtRisk} site${g.assetsAtRisk === 1 ? '' : 's'}`}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {fw === 'eu_taxonomy' && (
        <Card
          title="Appendix A hazard screening coverage"
          subtitle={`${d.appendixA.filter((r) => r.status === 'modelled').length} modelled directly · ${d.appendixA.filter((r) => r.status === 'proxy').length} via proxy · ${d.appendixA.filter((r) => r.status === 'none').length} not modelled. Geophysical perils (earthquake, tsunami, volcano) are outside Appendix A: ${d.geophysicalHighPlus} site(s) High+.`}
          bodyClassName="px-0 pb-0"
        >
          <div className="relative overflow-x-auto border-t border-white/[0.06]">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-400 bg-white/[0.02]">
                <tr className="text-left">
                  <th className="px-5 py-2.5 font-medium">Group</th>
                  <th className="px-5 py-2.5 font-medium">Type</th>
                  <th className="px-5 py-2.5 font-medium">Appendix A hazard</th>
                  <th className="px-5 py-2.5 font-medium">ClimaRisk coverage</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium text-right">Sites High+</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {d.appendixA.map((r) => (
                  <tr key={r.hazard}>
                    <td className="px-5 py-2 text-xs text-slate-400 whitespace-nowrap">{r.group}</td>
                    <td className="px-5 py-2 text-xs text-slate-400">{r.onset}</td>
                    <td className="px-5 py-2 text-white">{r.hazard}</td>
                    <td className="px-5 py-2 text-xs text-slate-300">{r.covered.map((h) => HAZARD_CATALOG[h].shortName).join(', ') || '—'}</td>
                    <td className="px-5 py-2">
                      <span className={cx('text-[11px] px-2 py-0.5 rounded-full ring-1', r.status === 'modelled' ? 'text-emerald-200 ring-emerald-400/30 bg-emerald-500/10' : r.status === 'proxy' ? 'text-amber-200 ring-amber-400/30 bg-amber-500/10' : 'text-slate-400 ring-white/10')}>
                        {r.status === 'none' ? 'not modelled' : r.status}
                      </span>
                    </td>
                    <td className={cx('px-5 py-2 text-right tabular-nums', r.sitesHighPlus ? 'text-amber-200' : 'text-slate-500')}>{r.covered.length ? r.sitesHighPlus : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {fw === 'ngfs' && (
        <Card title="Scenario stress test" subtitle={`Portfolio ${summary.lossMetricType === 'AAL' ? 'average annual' : 'event'} loss in the ${currentDecade}s under each pathway`}>
          <ul className="space-y-3">
            {d.scenarioRows.map((r) => (
              <li key={r.scenario} className={cx('rounded-xl px-4 py-3', r.isActive ? 'bg-white/[0.05] ring-1 ring-white/[0.1]' : '')}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 text-white">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SSP_SCENARIOS[r.scenario].color }} />
                    {r.code} <span className="text-slate-400">· {r.ngfs}</span>
                    {r.isActive && <span className="text-[11px] px-1.5 py-0.5 rounded bg-cyan-400/15 text-cyan-200">selected</span>}
                  </span>
                  <span className="text-slate-300 tabular-nums">{r.warming} · avg score {r.avgScore} · <b className="text-white">{formatCurrencyUsd(r.lossUsd)}</b></span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/[0.05] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(r.lossUsd / maxScenLoss) * 100}%`, backgroundColor: SSP_SCENARIOS[r.scenario].color }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
};

const TopSites: React.FC<{ d: ReturnType<typeof computeDisclosures> }> = ({ d }) => (
  <Card title="Largest exposures" subtitle="Top 10 sites by modelled loss" bodyClassName="px-0 pb-0">
    <div className="relative overflow-x-auto border-t border-white/[0.06]">
      <table className="w-full text-sm">
        <thead className="text-xs text-slate-400 bg-white/[0.02]">
          <tr className="text-left">
            <th className="px-5 py-2.5 font-medium">Site</th>
            <th className="px-5 py-2.5 font-medium">Location</th>
            <th className="px-5 py-2.5 font-medium text-right">Carrying amount</th>
            <th className="px-5 py-2.5 font-medium">Rating</th>
            <th className="px-5 py-2.5 font-medium">Main hazard</th>
            <th className="px-5 py-2.5 font-medium text-right">Loss</th>
            <th className="px-5 py-2.5 font-medium text-right">Adaptation capex</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {d.topAssetsByLoss.map((a) => (
            <tr key={a.asset.id}>
              <td className="px-5 py-2.5 text-white">{a.asset.name}</td>
              <td className="px-5 py-2.5 text-xs text-slate-400">{a.asset.city}, {a.asset.country}</td>
              <td className="px-5 py-2.5 text-right tabular-nums text-slate-200">{formatCurrencyUsd(a.asset.replacementValueUsd)}</td>
              <td className="px-5 py-2.5"><RatingBadge rating={a.compositeRating} /></td>
              <td className="px-5 py-2.5 text-xs text-slate-300">{HAZARD_CATALOG[a.primaryHazard].shortName}</td>
              <td className="px-5 py-2.5 text-right tabular-nums text-white">{formatCurrencyUsd(a.totalExpectedAnnualLossUsd)}</td>
              <td className="px-5 py-2.5 text-right tabular-nums text-emerald-300">{formatCurrencyUsd(a.adaptationRoi.estimatedCapexUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Card>
);
