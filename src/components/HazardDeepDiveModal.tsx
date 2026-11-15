import React, { useEffect, useState } from 'react';
import { AssetRiskAssessment, HazardType, ReturnPeriod, SSPScenario } from '../types/climate';
import {
  HAZARD_CATALOG,
  SSP_SCENARIOS,
  formatCurrencyUsd,
  siteElevation,
  getDistanceToOceanKm,
  getAssetVulnerabilityWeights,
  HAZARD_TAXONOMY,
} from '../services/climateEngine';
import { X, MapPin, ShieldCheck, Radio, Loader2 } from 'lucide-react';
import { HazardFamilyList, familyMeta } from './HazardFamilies';
import { LIVE_SOURCES } from '../services/liveData';
import { ModalShell, RatingBadge, Button, cx } from './ui';

interface HazardDeepDiveModalProps {
  assessment: AssetRiskAssessment | null;
  onClose: () => void;
  activeScenario: SSPScenario;
  onFetchLive?: (id: string) => void;
  onClearLive?: (id: string) => void;
  liveBusy?: boolean;
}

const RPS: Array<{ id: ReturnPeriod; label: string }> = [
  { id: 'aal', label: 'Average' },
  { id: '10yr', label: '1-in-10' },
  { id: '50yr', label: '1-in-50' },
  { id: '100yr', label: '1-in-100' },
  { id: '250yr', label: '1-in-250' },
  { id: '500yr', label: '1-in-500' },
];
const fmt = (v: number) => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString() : Number(v.toFixed(2)).toString());

export const HazardDeepDiveModal: React.FC<HazardDeepDiveModalProps> = ({ assessment, onClose, activeScenario, onFetchLive, onClearLive, liveBusy }) => {
  const [hz, setHz] = useState<HazardType>('coastal_flood');

  // Open on the asset's main hazard, and reset when a different asset is opened
  useEffect(() => {
    if (assessment) setHz(assessment.primaryHazard);
  }, [assessment?.asset.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!assessment) return null;
  const a = assessment;
  const { asset, adaptationRoi: roi } = a;
  const h = a.hazardResults[hz];
  const meta = HAZARD_CATALOG[hz];
  const elev = siteElevation(asset);
  const vWeight = getAssetVulnerabilityWeights(asset.assetType)[hz] ?? 1;

  // Fragility curve exactly as the engine computes it for this asset type
  const dmg = (s: number) => Math.min(0.95, Math.max(0.001, (1 / (1 + Math.exp(-6 * (s / 100 - 0.45)))) * vWeight * 0.35));
  const yMax = Math.max(0.05, dmg(100));
  const W = 300, H = 120, L = 34, B = 100, T = 10;
  const px = (s: number) => L + (s / 100) * (W - L - 6);
  const py = (d: number) => B - (d / yMax) * (B - T);
  const curve = Array.from({ length: 51 }, (_, i) => i * 2).map((s, i) => `${i ? 'L' : 'M'}${px(s).toFixed(1)},${py(dmg(s)).toFixed(1)}`).join(' ');
  const rpVals = RPS.map((r) => h.returnPeriodValues[r.id]);
  const rpMax = Math.max(1e-9, ...rpVals.map(Math.abs));

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-6xl" labelledBy="dd-title">
      <div className="px-6 py-4 border-b border-white/[0.06] flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 id="dd-title" className="text-lg font-semibold text-white">{asset.name}</h2>
            <RatingBadge rating={a.compositeRating} score={a.compositeScore} size="md" />
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
            {asset.parentEntity} · {asset.assetType}
            <span className="text-slate-600">·</span>
            <MapPin className="w-3.5 h-3.5" /> {asset.city}, {asset.country} ({asset.latitude.toFixed(3)}, {asset.longitude.toFixed(3)})
            <span className="text-slate-600">·</span> {elev} m · {getDistanceToOceanKm(asset.latitude, asset.longitude)} km to coast
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06]" aria-label="Close"><X className="w-5 h-5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { l: 'Replacement value', v: formatCurrencyUsd(asset.replacementValueUsd), c: undefined as string | undefined },
            { l: 'Average annual loss', v: formatCurrencyUsd(a.aalUsd) },
            { l: a.lossMetricType === 'AAL' ? 'Damage ratio' : `${a.returnPeriod.replace('yr', '')}-yr event loss`, v: a.lossMetricType === 'AAL' ? `${(a.aalDamageRatio * 100).toFixed(2)}%` : formatCurrencyUsd(a.periodExceedanceLossUsd) },
            { l: 'VaR 99.5%', v: formatCurrencyUsd(a.valueAtRisk995) },
            { l: 'Downtime per event', v: `${a.downtimeDays} days` },
            { l: 'Business interruption', v: formatCurrencyUsd(a.businessInterruptionLossUsd) },
          ].map((k) => (
            <div key={k.l} className="rounded-xl bg-white/[0.03] ring-1 ring-white/[0.05] px-3 py-2.5">
              <div className="text-xs text-slate-400">{k.l}</div>
              <div className={`text-base font-semibold tabular-nums ${k.c ?? 'text-white'}`}>{k.v}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-5">
          <div className="text-sm text-white font-medium mb-2">Hazards by family <span className="text-slate-500 font-normal text-xs">· select one for detail</span></div>
          <HazardFamilyList assessment={a} selected={hz} onSelect={setHz} />
        </div>
        <div className="lg:col-span-7 lg:sticky lg:top-0">
        <div className="rounded-2xl ring-1 ring-white/[0.06] bg-white/[0.02] p-5 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <div className="text-xs mb-1" style={{ color: familyMeta(HAZARD_TAXONOMY[hz].family).color }}>{familyMeta(HAZARD_TAXONOMY[hz].family).name} · {HAZARD_TAXONOMY[hz].onset}{HAZARD_TAXONOMY[hz].climateDriven ? '' : ' · not climate-driven'}</div>
              <div className="flex items-center gap-2"><h3 className="text-base font-semibold text-white">{meta.shortName}</h3>{meta.shortName !== meta.name && <span className="text-xs text-slate-500">{meta.name}</span>}<RatingBadge rating={h.rating} score={h.score} /></div>
              <p className="text-xs text-slate-400 mt-1">{meta.description}</p>
            </div>
            <div className="text-xs text-slate-500 w-full">Basis: {meta.cmip6ModelBasis}</div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div><div className="text-xs text-slate-400">{a.lossMetricType === 'AAL' ? 'Share of annual loss' : `Share of 1-in-${a.returnPeriod.replace('yr', '')} loss`}</div><div className="font-semibold text-white tabular-nums">{formatCurrencyUsd(h.expectedLossUsd)}</div></div>
            <div><div className="text-xs text-slate-400">Damage if this hazard hits alone</div><div className="font-semibold text-white tabular-nums">{(h.damageRatio * 100).toFixed(2)}%</div></div>
            <div><div className="text-xs text-slate-400">Change vs today</div><div className={cx('font-semibold tabular-nums', h.deltaPercent > 0 ? 'text-red-300' : h.deltaPercent < 0 ? 'text-emerald-300' : 'text-slate-300')}>{h.deltaPercent > 0 ? '+' : ''}{h.deltaPercent}%</div></div>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <div>
              <div className="text-xs text-slate-400 mb-2">Intensity by return period ({h.unit})</div>
              <ul className="space-y-2">
                {RPS.map((r, i) => (
                  <li key={r.id} className="flex items-center gap-3 text-xs">
                    <span className={cx('w-16', r.id === a.returnPeriod ? 'text-white font-medium' : 'text-slate-400')}>{r.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-white/[0.05] overflow-hidden">
                      <div className="h-full rounded-full bg-cyan-400" style={{ width: `${(Math.abs(rpVals[i]) / rpMax) * 100}%`, opacity: r.id === a.returnPeriod ? 1 : 0.5 }} />
                    </div>
                    <span className="w-20 text-right tabular-nums text-slate-200">{fmt(rpVals[i])}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-2">Damage curve for this asset type (×{vWeight} vulnerability)</div>
              <svg viewBox={`0 0 ${W} ${H + 14}`} className="w-full h-44" role="img" aria-label="Damage ratio versus hazard score">
                {[0, 0.5, 1].map((f) => (
                  <g key={f}>
                    <line x1={L} x2={W - 6} y1={py(yMax * f)} y2={py(yMax * f)} stroke="#1e293b" />
                    <text x={L - 4} y={py(yMax * f) + 3} fill="#64748b" fontSize="10" textAnchor="end">{Math.round(yMax * f * 100)}%</text>
                  </g>
                ))}
                <path d={curve} fill="none" stroke="#22d3ee" strokeWidth="2" />
                {h.score > 0 && (
                  <g>
                    <line x1={px(h.score)} x2={px(h.score)} y1={B} y2={py(h.damageRatio)} stroke="#f59e0b" strokeDasharray="2 2" />
                    <circle cx={px(h.score)} cy={py(h.damageRatio)} r="4.5" fill="#f59e0b" stroke="#0f172a" strokeWidth="2" />
                  </g>
                )}
                {[0, 50, 100].map((s) => <text key={s} x={px(s)} y={B + 12} fill="#64748b" fontSize="10" textAnchor="middle">{s}</text>)}
                <text x={(L + W) / 2} y={H + 12} fill="#94a3b8" fontSize="10" textAnchor="middle">hazard score</text>
              </svg>
            </div>
          </div>
        </div>

        </div>
        </div>

        {/* Live data */}
        <div className="rounded-2xl ring-1 ring-white/[0.06] bg-white/[0.02] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Radio className={cx('w-5 h-5', asset.liveData ? 'text-emerald-300' : 'text-slate-500')} />
              <h3 className="text-base font-semibold text-white">Live data</h3>
              <span className="text-xs text-slate-500">{asset.liveData ? `fetched ${new Date(asset.liveData.fetchedAt).toLocaleString()}` : 'not fetched — scores use modelled baselines'}</span>
            </div>
            <div className="flex gap-2">
              {asset.liveData && onClearLive && <Button size="sm" variant="ghost" onClick={() => onClearLive(asset.id)}>Revert to modelled</Button>}
              {onFetchLive && (
                <Button size="sm" variant="primary" disabled={liveBusy} icon={liveBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />} onClick={() => onFetchLive(asset.id)}>
                  {asset.liveData ? 'Refresh' : 'Fetch live data'}
                </Button>
              )}
            </div>
          </div>
          {asset.liveData ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { l: 'DEM elevation', v: asset.liveData.demElevationM, u: 'm', s: 'Copernicus GLO-90' },
                { l: 'Days > 35°C', v: asset.liveData.heatDays35Now, v2: asset.liveData.heatDays35Mid, u: 'days/yr', s: 'CMIP6 2015-24 → 2041-50' },
                { l: 'Frost days', v: asset.liveData.frostDaysNow, v2: asset.liveData.frostDaysMid, u: 'days/yr', s: 'CMIP6 2015-24 → 2041-50' },
                { l: 'Max 1-day rain', v: asset.liveData.rx1dayNowMm, v2: asset.liveData.rx1dayMidMm, u: 'mm', s: 'CMIP6 2015-24 → 2041-50' },
                { l: 'Max wind (daily)', v: asset.liveData.windMaxNowKmh, v2: asset.liveData.windMaxMidKmh, u: 'km/h', s: 'CMIP6 2015-24 → 2041-50' },
                { l: 'M5+ earthquakes ≤150 km', v: asset.liveData.quakesM5Within150km, u: 'since 1975', s: 'USGS ComCat' },
                { l: 'Peak river flow', v: asset.liveData.riverMaxDischargeM3s, u: 'm³/s', s: 'GloFAS, nearest river' },
              ].map((k) => (
                <div key={k.l} className="rounded-xl bg-white/[0.03] px-3 py-2.5">
                  <div className="text-xs text-slate-400">{k.l}</div>
                  <div className="text-base font-semibold text-white tabular-nums">
                    {k.v === undefined ? <span className="text-slate-600">n/a</span> : <>{k.v}{'v2' in k && k.v2 !== undefined && <span className="text-slate-400"> → {k.v2}</span>} <span className="text-xs font-normal text-slate-500">{k.u}</span></>}
                  </div>
                  <div className="text-xs text-slate-400">{k.s}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Fetches real elevation, CMIP6 climate projections, earthquake history and river discharge for this exact location from free public services, then re-scores heat, cold, heavy rain, river flood, windstorm and earthquake with them.
            </p>
          )}
          {asset.liveData?.errors && <div className="text-xs text-amber-200">Some sources failed: {asset.liveData.errors.join(' · ')}</div>}
          <div className="text-xs text-slate-400">Sources: {LIVE_SOURCES.map((x) => x.name).join(' · ')}</div>
        </div>

        <div className="rounded-2xl ring-1 ring-white/[0.06] bg-white/[0.02] p-5 space-y-4">
          <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-300" /><h3 className="text-base font-semibold text-white">Adaptation</h3></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { l: 'Estimated cost', v: formatCurrencyUsd(roi.estimatedCapexUsd), s: '~3.5% of value' },
              { l: 'Loss avoided / yr', v: formatCurrencyUsd(roi.annualLossReductionUsd), s: '45% of AAL', c: 'text-emerald-300' },
              { l: 'Payback', v: roi.paybackPeriodYears >= 999 ? 'n/a' : `${roi.paybackPeriodYears} yrs`, c: roi.paybackPeriodYears <= 15 ? 'text-emerald-300' : 'text-amber-200' },
              { l: '15-yr net benefit', v: formatCurrencyUsd(roi.netResilienceBenefitUsd), c: roi.netResilienceBenefitUsd >= 0 ? 'text-emerald-300' : 'text-red-300' },
            ].map((k) => (
              <div key={k.l} className="rounded-xl bg-white/[0.03] px-3 py-2.5">
                <div className="text-xs text-slate-400">{k.l}</div>
                <div className={`text-base font-semibold tabular-nums ${k.c ?? 'text-white'}`}>{k.v}</div>
                {k.s && <div className="text-xs text-slate-400">{k.s}</div>}
              </div>
            ))}
          </div>
          <ul className="grid sm:grid-cols-2 gap-2">
            {roi.recommendedMeasures.map((m) => (
              <li key={m} className="flex gap-2 text-xs text-slate-200 rounded-lg bg-white/[0.03] px-3 py-2"><ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />{m}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="px-6 py-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-500">
        <span>{SSP_SCENARIOS[activeScenario].name} · {a.decade === 2025 ? 'today' : `${a.decade}s`}</span>
        <Button onClick={onClose}>Close</Button>
      </div>
    </ModalShell>
  );
};
