import React, { useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { ALL_HAZARDS, HAZARD_CATALOG, HAZARD_FAMILIES, HAZARD_TAXONOMY } from '../services/climateEngine';
import { LIVE_SOURCES } from '../services/liveData';
import { ModalShell, Segmented, Button, RatingBadge, cx } from './ui';
import type { RiskRating } from '../types/climate';

const STEPS = [
  { t: '1. Hazard score (0–100)', b: 'Each of the hazards gets an intensity in physical units (metres, days, km/h …) from a location baseline. Each hazard responds to the extra global warming of the chosen scenario and decade (IPCC AR6 medians) with its own physical sensitivity — e.g. heavy rain +7% per °C, wet-bulb heat +0.9 °C per °C, cyclone wind +2.5% per °C — and coastal flooding rises with AR6 sea-level rise (SSP5-8.5: +0.15 m by 2050, +0.52 m by 2090 vs 2025). Values are capped at physical limits. The score is adjusted for the asset type’s vulnerability and softly capped so high values still differ.' },
  { t: '2. Family score', b: 'Hazards are grouped into six families. A family takes its worst hazard, plus a small bonus for other active hazards in the family, so adding minor perils never dilutes the result.' },
  { t: '3. Composite risk score', b: 'Family scores are averaged, weighted by how vulnerable the asset type is to each family, then mapped through a calibration curve so the rating bands (Very Low → Catastrophic) keep a consistent meaning.' },
  { t: '4. Average annual loss (AAL)', b: 'The average-year composite is converted to a damage ratio of replacement value with a convex curve (≈0.1% of value per year for low-risk sites, up to ~1.6% for the highest). AAL does not change with the event selector.' },
  { t: '5. Event loss & tail risk', b: 'A 1-in-N event loss is AAL × a return-period factor (≈3× for 1-in-10, ≈12.5× for 1-in-100). Portfolio VaR combines site VaRs with a correlation that falls with distance (≈750 km) and rises when sites share a main hazard, so concentrated portfolios have fatter tails.' },
  { t: '6. Live data (optional)', b: 'For any site you can fetch real values from open data services. These replace the modelled baseline for the matching hazards and flow through steps 1–5. Projections for other scenarios are pattern-scaled from the CMIP6 HighResMIP runs (≈SSP5-8.5).' },
];

const LIMITS = [
  'Without live data, baselines are screening heuristics built from geography (distance to coast, elevation, climate zone, known hazard belts) — not hazard rasters. Use them to prioritise, not to price.',
  'CMIP6 HighResMIP data on Open-Meteo runs to 2050 and follows a high-emissions pathway; other scenarios and later decades are scaled from it.',
  'GloFAS river discharge is read from the nearest modelled river cell, which can overstate exposure for sites near — but above — large rivers.',
  'Earthquake history (USGS, M5+ since 1975) is a proxy for seismic hazard, not a probabilistic seismic hazard assessment.',
  'Distance to the sea uses about 400 coastline reference points, and elevation is estimated from regional terrain boxes until live data is fetched. A map click on open water is treated as a nearby land point.',
  'Coastal flooding ignores sea walls and dykes (e.g. Netherlands, Thames Barrier), so protected low ground can read higher than its real residual risk.',
  'Model daily maximum wind is shown with the live data but does not replace the windstorm estimate, because it under-reads gusts.',
  'Financial figures use generic damage curves per asset type. Site-specific engineering, defences and insurance are not modelled.',
];

export const MethodsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [tab, setTab] = useState<'terms' | 'how' | 'hazards' | 'data'>('terms');
  if (!isOpen) return null;
  return (
    <ModalShell onClose={onClose} maxWidth="max-w-5xl" labelledBy="methods-title">
      <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between gap-4">
        <div>
          <h2 id="methods-title" className="text-base font-semibold text-white">How ClimaRisk works</h2>
          <p className="text-xs text-slate-400 mt-0.5">{ALL_HAZARDS.length} hazards in {HAZARD_FAMILIES.length} families · scoring method · data sources · limitations</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06]" aria-label="Close"><X className="w-5 h-5" /></button>
      </div>
      <div className="px-6 pt-4">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'terms', label: 'Ratings & terms' }, { value: 'how', label: 'Scoring method' }, { value: 'hazards', label: `Hazards (${ALL_HAZARDS.length})` }, { value: 'data', label: 'Data & limitations' }]} />
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'terms' && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <div className="text-sm font-medium text-white mb-2">Rating bands (risk score 0–100)</div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-white/[0.04]">
                  {[
                    ['Very Low', '0 – 17', 'Little or no exposure'],
                    ['Low', '18 – 35', 'Minor exposure; monitor'],
                    ['Moderate', '36 – 55', 'Material for some hazards; consider measures'],
                    ['High', '56 – 74', 'Significant; plan adaptation'],
                    ['Severe', '75 – 89', 'Major; prioritise action and insurance review'],
                    ['Catastrophic', '90 – 100', 'Extreme; question long-term viability'],
                  ].map(([r, band, meaning]) => (
                    <tr key={r}>
                      <td className="py-2 pr-3"><RatingBadge rating={r as RiskRating} /></td>
                      <td className="py-2 pr-3 tabular-nums text-slate-300">{band}</td>
                      <td className="py-2 text-slate-400">{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <div className="text-sm font-medium text-white mb-2">Terms</div>
              <dl className="space-y-3 text-sm">
                {[
                  ['Average annual loss (AAL)', 'Long-run average yearly damage from all hazards, as money. Use for budgets and adaptation business cases. Does not depend on the Event size control.'],
                  ['1-in-N event', 'An event so severe it has a 1/N chance of happening in any given year (e.g. 1-in-100 = 1% a year). Not "once every N years".'],
                  ['If every site is hit at once', 'Sum of each site’s 1-in-N event loss. An upper bound — in reality sites rarely all have a bad year together.'],
                  ['Portfolio bad year (VaR 99.5%)', 'The whole-portfolio loss exceeded only once in 200 years, after allowing for diversification between distant sites.'],
                  ['Scenario (SSP)', 'Shared Socioeconomic Pathway: an IPCC emissions storyline, from SSP1-1.9 (≈1.5°C warming by 2100) to SSP5-8.5 (≈4.4°C).'],
                  ['Hazard family', 'Group of related hazards (Flood, Wind, Heat & cold, Water, Wildfire, Ground). Family colours never mean a rating.'],
                  ['Estimated vs live data', 'Estimated = geographic screening rules. Live = real elevation, climate projections, earthquake and river data fetched for the exact site.'],
                ].map(([t, d]) => (
                  <div key={t}>
                    <dt className="text-white">{t}</dt>
                    <dd className="text-slate-400 mt-0.5">{d}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}

        {tab === 'how' && (
          <ol className="grid md:grid-cols-2 gap-3">
            {STEPS.map((s) => (
              <li key={s.t} className="rounded-xl bg-white/[0.03] ring-1 ring-white/[0.05] p-4">
                <div className="text-sm font-medium text-white">{s.t}</div>
                <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">{s.b}</p>
              </li>
            ))}
          </ol>
        )}

        {tab === 'hazards' && (
          <div className="space-y-5">
            {HAZARD_FAMILIES.map((f) => (
              <div key={f.id}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: f.color }} />
                  <span className="text-sm font-medium text-white">{f.name}</span>
                  <span className="text-xs text-slate-500">{f.description}</span>
                </div>
                <div className="relative overflow-x-auto rounded-xl ring-1 ring-white/[0.06]">
                  <table className="w-full text-xs">
                    <thead className="bg-white/[0.03] text-slate-400">
                      <tr className="text-left">
                        <th className="px-3 py-2 font-medium">Hazard</th>
                        <th className="px-3 py-2 font-medium">Type</th>
                        <th className="px-3 py-2 font-medium">Metric</th>
                        <th className="px-3 py-2 font-medium">EU Taxonomy Appendix A</th>
                        <th className="px-3 py-2 font-medium">Basis</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {ALL_HAZARDS.filter((h) => HAZARD_TAXONOMY[h].family === f.id).map((h) => {
                        const m = HAZARD_CATALOG[h];
                        const t = HAZARD_TAXONOMY[h];
                        return (
                          <tr key={h}>
                            <td className="px-3 py-2 whitespace-nowrap" title={m.description}><div className="text-white">{m.name}</div>{m.technicalName && m.technicalName !== m.name && <div className="text-xs text-slate-500">{m.technicalName}</div>}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className={cx('px-1.5 py-0.5 rounded', t.onset === 'acute' ? 'bg-red-400/10 text-red-200' : 'bg-amber-400/10 text-amber-200')}>{t.onset}</span>
                              {!t.climateDriven && <span className="ml-1 px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-300">geophysical</span>}
                            </td>
                            <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{m.unit}</td>
                            <td className="px-3 py-2 text-slate-300">{t.euTaxonomy}</td>
                            <td className="px-3 py-2 text-slate-500">{m.cmip6ModelBasis}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'data' && (
          <div className="space-y-6">
            <div>
              <div className="text-sm font-medium text-white mb-2">Live data sources (free, no API key)</div>
              <ul className="grid md:grid-cols-2 gap-3">
                {LIVE_SOURCES.map((s) => (
                  <li key={s.name} className="rounded-xl bg-white/[0.03] ring-1 ring-white/[0.05] p-4">
                    <a href={s.url} target="_blank" rel="noreferrer" className="text-sm text-cyan-300 hover:underline inline-flex items-center gap-1">{s.name}<ExternalLink className="w-3 h-3" /></a>
                    <div className="text-xs text-slate-500">{s.via}</div>
                    <p className="text-sm text-slate-300 mt-1.5">{s.feeds}</p>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-500 mt-2">Attribution: CMIP6 and Copernicus programmes via Open-Meteo (CC BY 4.0); U.S. Geological Survey. Results are cached in your browser for 30 days.</p>
            </div>
            <div>
              <div className="text-sm font-medium text-white mb-2">Limitations</div>
              <ul className="space-y-2">
                {LIMITS.map((l) => <li key={l} className="text-sm text-slate-300 rounded-lg bg-white/[0.02] px-3 py-2">{l}</li>)}
              </ul>
            </div>
          </div>
        )}
      </div>
      <div className="px-6 py-3 border-t border-white/[0.06] flex justify-end"><Button onClick={onClose}>Close</Button></div>
    </ModalShell>
  );
};
