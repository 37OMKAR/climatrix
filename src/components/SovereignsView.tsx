import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { AssetRiskAssessment, SovereignRiskProfile } from '../types/climate';
import { GLOBAL_SOVEREIGNS, US_COUNTIES_SAMPLE, USCountyProfile } from '../services/sovereignData';
import { HAZARD_CATALOG, HAZARD_TAXONOMY, HAZARD_FAMILIES, formatCurrencyUsd, getRatingFromScore } from '../services/climateEngine';
import { Card, Kpi, RatingBadge, ScoreBar, Segmented, Select, EmptyState, cx } from './ui';

interface Props {
  /** Current portfolio, so each country shows how much of *your* exposure sits there. */
  assessments?: AssetRiskAssessment[];
}

const familyColor = (h: keyof typeof HAZARD_TAXONOMY) => HAZARD_FAMILIES.find((f) => f.id === HAZARD_TAXONOMY[h].family)!.color;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

const HazardChips: React.FC<{ hazards: Array<keyof typeof HAZARD_CATALOG> }> = ({ hazards }) => (
  <div className="flex flex-wrap gap-1.5">
    {hazards.map((h) => (
      <span key={h} className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2 py-1 text-xs text-slate-200">
        <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: familyColor(h) }} />
        {HAZARD_CATALOG[h].shortName}
      </span>
    ))}
  </div>
);

export const SovereignsView: React.FC<Props> = ({ assessments = [] }) => {
  const [mode, setMode] = useState<'countries' | 'counties'>('countries');
  const [q, setQ] = useState('');
  const [region, setRegion] = useState('all');
  const [selCountry, setSelCountry] = useState<SovereignRiskProfile>(GLOBAL_SOVEREIGNS[0]);
  const [selCounty, setSelCounty] = useState<USCountyProfile>(US_COUNTIES_SAMPLE[0]);

  // Portfolio exposure per country (matched on country name)
  const exposure = useMemo(() => {
    const m = new Map<string, { n: number; value: number; aal: number }>();
    for (const a of assessments) {
      const k = norm(a.asset.country);
      const cur = m.get(k) ?? { n: 0, value: 0, aal: 0 };
      m.set(k, { n: cur.n + 1, value: cur.value + a.asset.replacementValueUsd, aal: cur.aal + a.aalUsd });
    }
    return m;
  }, [assessments]);
  const expFor = (c: SovereignRiskProfile) => exposure.get(norm(c.countryName));

  const regions = useMemo(() => Array.from(new Set(GLOBAL_SOVEREIGNS.map((c) => c.region))).sort(), []);
  const countries = GLOBAL_SOVEREIGNS.filter(
    (c) => (region === 'all' || c.region === region) && `${c.countryName} ${c.countryCode} ${c.region}`.toLowerCase().includes(q.toLowerCase()),
  ).sort((a, b) => (expFor(b)?.value ?? 0) - (expFor(a)?.value ?? 0) || b.compositePhysicalRiskScore - a.compositePhysicalRiskScore);
  const counties = US_COUNTIES_SAMPLE.filter((c) => `${c.countyName} ${c.stateName} ${c.stateCode}`.toLowerCase().includes(q.toLowerCase())).sort(
    (a, b) => b.femaNriScore - a.femaNriScore,
  );

  const e = expFor(selCountry);

  return (
    <div className="px-4 sm:px-6 py-6 space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">Countries & regions</h1>
        <p className="text-sm text-slate-400 mt-1">
          Physical risk to national economies and US counties — useful context for sovereign exposure and for where your sites sit. Sample of {GLOBAL_SOVEREIGNS.length} countries and {US_COUNTIES_SAMPLE.length} counties.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={mode}
          onChange={(v) => { setMode(v); setQ(''); }}
          options={[{ value: 'countries', label: `Countries (${GLOBAL_SOVEREIGNS.length})` }, { value: 'counties', label: `US counties (${US_COUNTIES_SAMPLE.length})` }]}
        />
        <div className="relative ml-auto">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(ev) => setQ(ev.target.value)}
            placeholder={mode === 'countries' ? 'Search countries' : 'Search counties or states'}
            aria-label="Search"
            className="w-56 rounded-xl bg-slate-950/70 ring-1 ring-inset ring-white/[0.08] pl-8 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-cyan-400/60"
          />
        </div>
        {mode === 'countries' && (
          <Select value={region} onChange={(ev) => setRegion(ev.target.value)} aria-label="Region">
            <option value="all">All regions</option>
            {regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
        )}
      </div>

      {mode === 'countries' ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          <Card className="xl:col-span-7" bodyClassName="p-0">
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-400 bg-white/[0.02]">
                  <tr className="text-left">
                    <th className="px-4 py-2.5 font-medium">Country</th>
                    <th className="px-4 py-2.5 font-medium">Physical risk</th>
                    <th className="px-4 py-2.5 font-medium text-right" title="ND-GAIN adaptation readiness (higher is better)">Readiness</th>
                    <th className="px-4 py-2.5 font-medium text-right">GDP at risk 2050</th>
                    <th className="px-4 py-2.5 font-medium text-right">Your sites</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {countries.map((c) => {
                    const sel = c.countryCode === selCountry.countryCode;
                    const ex = expFor(c);
                    return (
                      <tr key={c.countryCode} onClick={() => setSelCountry(c)} className={cx('cursor-pointer', sel ? 'bg-cyan-400/[0.06]' : 'hover:bg-white/[0.03]')}>
                        <td className={cx('px-4 py-2.5', sel && 'shadow-[inset_3px_0_0_#22d3ee]')}>
                          <div className="text-white">{c.countryName}</div>
                          <div className="text-xs text-slate-500">{c.region}</div>
                        </td>
                        <td className="px-4 py-2.5"><RatingBadge rating={getRatingFromScore(c.compositePhysicalRiskScore)} score={c.compositePhysicalRiskScore} /></td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-200">{c.ndGainReadinessScore}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-200">{c.gdpAtRisk2050Percent}%</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{ex ? <span className="text-white">{ex.n}</span> : <span className="text-slate-600">—</span>}</td>
                      </tr>
                    );
                  })}
                  {countries.length === 0 && <tr><td colSpan={5}><EmptyState title="No countries match" /></td></tr>}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="xl:col-span-5" title={selCountry.countryName} subtitle={`${selCountry.region} · fiscal resilience tier ${selCountry.fiscalVulnerabilityTier}`}>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                  <span>Physical risk</span>
                  <RatingBadge rating={getRatingFromScore(selCountry.compositePhysicalRiskScore)} score={selCountry.compositePhysicalRiskScore} />
                </div>
                <ScoreBar score={selCountry.compositePhysicalRiskScore} rating={getRatingFromScore(selCountry.compositePhysicalRiskScore)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Kpi label="Adaptation readiness" value={`${selCountry.ndGainReadinessScore}`} sub="ND-GAIN, out of 100 (higher is better)" />
                <Kpi label="GDP at risk by 2050" value={`${selCountry.gdpAtRisk2050Percent}%`} sub="share of national GDP exposed" />
                <Kpi label="Bond spread impact" value={`+${selCountry.sovereignSpreadImpactBps} bps`} sub="added borrowing cost" />
                <Kpi label="Population exposed" value={`${selCountry.populationExposedPercent}%`} sub="living in high-hazard zones" />
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-2">Main national hazards</div>
                <HazardChips hazards={selCountry.primaryVulnerabilities} />
              </div>
              <div className="rounded-xl bg-white/[0.03] px-4 py-3 text-sm">
                <div className="text-xs text-slate-400 mb-1">Your portfolio here</div>
                {e ? (
                  <span className="text-slate-200">{e.n} site{e.n === 1 ? '' : 's'} · {formatCurrencyUsd(e.value)} value · {formatCurrencyUsd(e.aal)} average annual loss</span>
                ) : (
                  <span className="text-slate-500">No sites in this country in the current portfolio.</span>
                )}
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          <Card className="xl:col-span-7" bodyClassName="p-0">
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-400 bg-white/[0.02]">
                  <tr className="text-left">
                    <th className="px-4 py-2.5 font-medium">County</th>
                    <th className="px-4 py-2.5 font-medium" title="FEMA National Risk Index">FEMA risk index</th>
                    <th className="px-4 py-2.5 font-medium text-right">Expected annual loss</th>
                    <th className="px-4 py-2.5 font-medium text-right" title="Higher = more socially vulnerable">Social vulnerability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {counties.map((c) => {
                    const sel = c.countyFips === selCounty.countyFips;
                    return (
                      <tr key={c.countyFips} onClick={() => setSelCounty(c)} className={cx('cursor-pointer', sel ? 'bg-cyan-400/[0.06]' : 'hover:bg-white/[0.03]')}>
                        <td className={cx('px-4 py-2.5', sel && 'shadow-[inset_3px_0_0_#22d3ee]')}>
                          <div className="text-white">{c.countyName}</div>
                          <div className="text-xs text-slate-500">{c.stateName}</div>
                        </td>
                        <td className="px-4 py-2.5"><RatingBadge rating={getRatingFromScore(c.femaNriScore)} score={c.femaNriScore} /></td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-200">{formatCurrencyUsd(c.annualLossExpectanceUsdMillions * 1e6)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-200">{c.socialVulnerabilityScore}</td>
                      </tr>
                    );
                  })}
                  {counties.length === 0 && <tr><td colSpan={4}><EmptyState title="No counties match" /></td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
          <Card className="xl:col-span-5" title={selCounty.countyName} subtitle={`${selCounty.stateName} · FEMA rating: ${selCounty.femaRating}`}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Kpi label="FEMA risk index" value={`${selCounty.femaNriScore}`} sub="out of 100" />
                <Kpi label="Expected annual loss" value={formatCurrencyUsd(selCounty.annualLossExpectanceUsdMillions * 1e6)} sub="all hazards, county-wide" />
                <Kpi label="Social vulnerability" value={`${selCounty.socialVulnerabilityScore}`} sub="higher = more vulnerable" />
                <Kpi label="Community resilience" value={`${selCounty.communityResilienceScore}`} sub="higher = more resilient" />
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-2">Main county hazards</div>
                <HazardChips hazards={selCounty.primaryHazards} />
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
