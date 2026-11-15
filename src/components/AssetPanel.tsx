import React, { useState } from 'react';
import { ArrowUpRight, MapPin, ShieldCheck, Radio, Loader2 } from 'lucide-react';
import { HazardFamilyList } from './HazardFamilies';
import { AssetRiskAssessment, Decade, SSPScenario } from '../types/climate';
import {
  HAZARD_CATALOG,
  SSP_SCENARIOS,
  formatCurrencyUsd,
  siteElevation,
  getDistanceToOceanKm,
} from '../services/climateEngine';
import { RatingBadge, Segmented, Button, EmptyState } from './ui';

interface Props {
  assessment: AssetRiskAssessment | null;
  currentDecade: Decade;
  currentScenario: SSPScenario;
  onOpenDetails: (id: string) => void;
  onFetchLive?: (id: string) => void;
  liveBusy?: boolean;
}


export const AssetPanel: React.FC<Props> = ({ assessment, currentDecade, currentScenario, onOpenDetails, onFetchLive, liveBusy }) => {
  const [tab, setTab] = useState<'hazards' | 'outlook' | 'adapt'>('hazards');

  if (!assessment) {
    return (
      <div className="h-full rounded-2xl border border-white/[0.06] bg-slate-900/70">
        <EmptyState title="No asset selected" body="Pick an asset on the map or in the table below to see its risk profile." />
      </div>
    );
  }

  const a = assessment;
  const elev = siteElevation(a.asset);
  const maxTraj = Math.max(1, ...a.decadeTrajectory.map((d) => d.expectedLossUsd));
  const scen = (Object.keys(SSP_SCENARIOS) as SSPScenario[]).map((s) => ({ s, ...a.scenarioComparison[s] }));
  const maxScen = Math.max(1, ...scen.map((x) => x.expectedLossUsd));
  const roi = a.adaptationRoi;

  return (
    <div className="h-full flex flex-col rounded-2xl border border-white/[0.06] bg-slate-900/70 overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-white/[0.06]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-slate-400 truncate">{a.asset.category} · {a.asset.parentEntity}</div>
            <h3 className="text-base font-semibold text-white leading-snug mt-0.5 line-clamp-2">{a.asset.name}</h3>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              {a.asset.city}, {a.asset.country}
              <span className="text-slate-600">·</span>
              <span className="tabular-nums">{elev} m elevation</span>
              <span className="text-slate-600">·</span>
              <span className="tabular-nums">{getDistanceToOceanKm(a.asset.latitude, a.asset.longitude)} km to coast</span>
            </div>
          </div>
          <RatingBadge rating={a.compositeRating} score={a.compositeScore} size="md" />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[
            { l: 'Value', v: formatCurrencyUsd(a.asset.replacementValueUsd), c: undefined as string | undefined },
            { l: 'Annual loss', v: formatCurrencyUsd(a.aalUsd) },
            { l: a.lossMetricType === 'AAL' ? 'Downtime / event' : `1-in-${a.returnPeriod.replace('yr', '')} loss`, v: a.lossMetricType === 'AAL' ? `${a.downtimeDays} days` : formatCurrencyUsd(a.periodExceedanceLossUsd) },
          ].map((k) => (
            <div key={k.l} className="rounded-xl bg-white/[0.03] px-3 py-2">
              <div className="text-xs text-slate-400 truncate">{k.l}</div>
              <div className={`text-sm font-semibold tabular-nums ${k.c ?? 'text-white'}`}>{k.v}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-3 gap-2">
          <Segmented
            size="sm"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'hazards', label: 'Hazards' },
              { value: 'outlook', label: 'Outlook' },
              { value: 'adapt', label: 'Adaptation' },
            ]}
          />
          <Button size="sm" variant="ghost" icon={<ArrowUpRight className="w-4 h-4" />} onClick={() => onOpenDetails(a.asset.id)}>
            Full analysis
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {tab === 'hazards' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              {a.usesLiveData ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-300"><Radio className="w-3.5 h-3.5" />Live data in use · fetched {new Date(a.asset.liveData!.fetchedAt).toLocaleDateString()}</span>
              ) : (
                <span className="text-slate-500">Modelled screening baselines</span>
              )}
              {onFetchLive && (
                <button
                  onClick={() => onFetchLive(a.asset.id)}
                  disabled={liveBusy}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-cyan-300 hover:bg-cyan-400/10 disabled:opacity-50"
                  title="Fetch real elevation, CMIP6 projections, earthquake history and river flow for this site"
                >
                  {liveBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />}
                  {a.usesLiveData ? 'Refresh live data' : 'Use live data'}
                </button>
              )}
            </div>
            <HazardFamilyList assessment={a} compact />
          </div>
        )}

        {tab === 'outlook' && (
          <div className="space-y-6">
            <div>
              <div className="text-xs text-slate-400 mb-2">
                Loss by decade · {SSP_SCENARIOS[currentScenario].code} · {a.lossMetricType === 'AAL' ? 'average year' : `1-in-${a.returnPeriod.replace('yr', '')} event`}
              </div>
              <div className="h-36 flex items-end gap-1.5">
                {a.decadeTrajectory.map((d) => {
                  const cur = d.decade === currentDecade;
                  return (
                    <div key={d.decade} className="flex-1 min-w-0 flex flex-col items-center gap-1 h-full justify-end group" title={`${d.decade}: ${formatCurrencyUsd(d.expectedLossUsd)} · score ${d.compositeScore}`}>
                      <div className={`relative w-full rounded-t ${cur ? 'bg-cyan-400' : 'bg-slate-600/70 group-hover:bg-slate-500'}`} style={{ height: `${Math.max(3, (d.expectedLossUsd / maxTraj) * 85)}%` }}>
                        <span className={`absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] tabular-nums pointer-events-none ${cur ? 'text-cyan-200' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`}>{formatCurrencyUsd(d.expectedLossUsd)}</span>
                      </div>
                      <span className={`text-[11px] tabular-nums ${cur ? 'text-cyan-300' : 'text-slate-500'}`}>{d.decade === 2025 ? 'Now' : `’${String(d.decade).slice(2)}`}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-2">Same year ({currentDecade}) under each scenario</div>
              <ul className="space-y-2">
                {scen.map((x) => {
                  const m = SSP_SCENARIOS[x.s];
                  const active = x.s === currentScenario;
                  return (
                    <li key={x.s} className="flex items-center gap-2 text-xs">
                      <span className={`w-20 shrink-0 flex items-center gap-1.5 ${active ? 'text-white font-medium' : 'text-slate-400'}`}>
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
                        {m.code}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-white/[0.05] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(x.expectedLossUsd / maxScen) * 100}%`, backgroundColor: m.color, opacity: active ? 1 : 0.55 }} />
                      </div>
                      <span className="w-16 text-right tabular-nums text-slate-300">{formatCurrencyUsd(x.expectedLossUsd)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {tab === 'adapt' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {[
                { l: 'Estimated cost', v: formatCurrencyUsd(roi.estimatedCapexUsd) },
                { l: 'Loss avoided / yr', v: formatCurrencyUsd(roi.annualLossReductionUsd), c: 'text-emerald-300' },
                { l: 'Payback', v: roi.paybackPeriodYears >= 999 ? 'n/a' : `${roi.paybackPeriodYears} yrs`, c: roi.paybackPeriodYears <= 15 ? 'text-emerald-300' : 'text-amber-200' },
                { l: '15-yr net benefit', v: formatCurrencyUsd(roi.netResilienceBenefitUsd), c: roi.netResilienceBenefitUsd >= 0 ? 'text-emerald-300' : 'text-red-300' },
              ].map((k) => (
                <div key={k.l} className="rounded-xl bg-white/[0.03] px-3 py-2">
                  <div className="text-xs text-slate-400">{k.l}</div>
                  <div className={`text-sm font-semibold tabular-nums ${k.c ?? 'text-white'}`}>{k.v}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              {roi.netResilienceBenefitUsd >= 0
                ? 'Adapting this site pays for itself within the 15-year horizon.'
                : 'At current risk levels the measures cost more than they save over 15 years — consider monitoring instead.'}
            </p>
            <div>
              <div className="text-xs text-slate-400 mb-2">Recommended measures for {HAZARD_CATALOG[a.primaryHazard].name.toLowerCase()}</div>
              <ul className="space-y-1.5">
                {roi.recommendedMeasures.map((m) => (
                  <li key={m} className="flex gap-2 text-xs text-slate-200 rounded-lg bg-white/[0.03] px-3 py-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
