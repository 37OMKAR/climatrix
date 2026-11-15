import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Card, Button, inputCls, RatingChip } from '../ui/kit';
import { HAZARDS, FAMILIES, RATINGS, SCENARIOS } from '../engine/hazards';
import { SOURCES } from '../data/api';
import { HEATMAP, NGFS_SCENARIOS, CPI_2010_TO_2024, type FxSettings } from '../engine/transition';

export const MethodologyPage: React.FC<{ apiKey: string; onApiKey: (k: string) => void; onClearCache: () => void; cacheCount: number; fx: FxSettings; onFx: (f: FxSettings) => void; onClearRasters: () => Promise<void> }> = ({ apiKey, onApiKey, onClearCache, cacheCount, fx, onFx, onClearRasters }) => {
  const [k, setK] = useState(apiKey);
  const [rate, setRate] = useState(String(fx.usdInr));
  const [asOf, setAsOf] = useState(fx.asOf);
  const [cleared, setCleared] = useState(false);
  return (
    <div className="max-w-[1100px] mx-auto flex flex-col gap-3">
      <div>
        <h1 className="text-2xl font-bold">Methodology & data</h1>
        <p className="text-sm text-muted mt-1">Every value is computed for the exact point from open, citable datasets using published methods. Where no open source exists, the hazard is listed as “Not assessed” — CLIMARIS never fills gaps with defaults.</p>
      </div>
      <Card title="How a score is made">
        <ol className="list-decimal pl-5 text-sm leading-relaxed flex flex-col gap-1.5">
          <li><b>Hazard indicator</b> in physical units (days, mm, m, km/h, g …). Flood depths, cyclone winds, subsidence, landslide susceptibility, water stress and lightning are read pixel-by-pixel from the publishers’ own high-resolution maps (JRC 90 m, Deltares 90 m, STORM 10 km, IIT Bombay 100 m, WRI Aqueduct, WWLLN); the rest come from observations / reanalysis for the present day.</li>
          <li><b>Future change</b> from two CMIP6 HighResMIP models (2036–49 vs 1995–14, high-emission forcing), pattern-scaled to each SSP and year by IPCC AR6 median global warming. Sea-level rise uses AR6 Table 9.9 medians.</li>
          <li><b>Score 0–100</b> by interpolating between published class limits (IMD rainfall and cyclone classes, GSHAP seismic classes, UNEP aridity, EFFIS fire danger …), shown for each hazard.</li>
          <li><b>Site rating</b> = the worst hazard, plus a count of hazards rated High or worse. No hidden weighting.</li>
          <li><b>Rupee loss</b> only where a published damage curve exists: Emanuel (2011) for cyclone wind integrated over the STORM return-period curve; JRC global depth–damage curves (Huizinga et al. 2017, Asia) integrated over the JRC river-flood return periods (expected annual loss, no defences) and applied to the Deltares 1-in-100 coastal depth.</li>
        </ol>
        <div className="flex flex-wrap gap-2 mt-3">{RATINGS.map((r, i) => <RatingChip key={r} rating={r} score={i * 20 + 10} small />)}</div>
        <p className="text-xs text-muted mt-2">Scenarios: {SCENARIOS.map((s) => `${s.label} (${s.warming} by 2100)`).join(' · ')}</p>
      </Card>
      <Card title="Hazards" pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[860px]">
            <thead><tr className="text-left text-xs text-muted bg-chip"><th className="py-2.5 px-4 font-medium">Hazard</th><th className="py-2.5 px-2 font-medium">Indicator</th><th className="py-2.5 px-2 font-medium">Method</th><th className="py-2.5 px-4 font-medium">Data</th></tr></thead>
            <tbody>
              {HAZARDS.map((h) => (
                <tr key={h.id} className="border-t border-line align-top">
                  <td className="py-3 px-4"><b>{h.name}</b><span className="block text-xs text-muted">{FAMILIES.find((f) => f.id === h.family)!.name}</span></td>
                  <td className="py-3 px-2">{h.notAssessed ? <span className="text-muted">Not assessed</span> : `${h.indicator}${h.unit ? ` (${h.unit})` : ''}`}{h.scoreNote && <span className="block text-xs text-muted mt-1">{h.scoreNote}</span>}</td>
                  <td className="py-3 px-2 text-muted leading-relaxed">{h.notAssessed ?? h.method}</td>
                  <td className="py-3 px-4 text-xs">{h.sources.map((s) => <a key={s} href={SOURCES[s].url} target="_blank" rel="noreferrer" className="block text-accent hover:underline">{SOURCES[s].name}</a>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Transition risk">
        <div className="text-sm leading-relaxed flex flex-col gap-2">
          <p><b>Sector sensitivity</b> — the UNEP FI TCFD Banking Programme heatmap (“Beyond the Horizon”, 2020): {HEATMAP.length} sector segments rated High → Low by 39 banks for an ambitious, well-below-2 °C transition. The borrower’s sector text is matched to a segment; unmatched sectors are left unrated.</p>
          <p><b>Policy pressure</b> — NGFS Phase V (Nov 2024) shadow carbon price for the borrower’s country, at the loan’s maturity year, from three integrated assessment models (GCAM 6.0, REMIND-MAgPIE 3.3, MESSAGEix-GLOBIOM 2.0) so the model spread is visible. Scenarios: {NGFS_SCENARIOS.map((s) => s.label).join(', ')}. Prices are US$2010; rupees use the US CPI-U ratio 2010→2024 (×{CPI_2010_TO_2024.toFixed(3)}) and the exchange rate below.</p>
          <p><b>Local emissions context</b> — Climate TRACE asset-level emissions (power plants, steel, cement, mines, oil & gas, …) within 50 km of the site, from the state / province list.</p>
          <p className="text-muted">The transition rating is the UNEP FI segment rating itself; CLIMARIS does not combine it with the carbon price into an invented composite.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2 mt-3">
          <label className="flex flex-col gap-1 text-xs text-muted w-[140px]">₹ per US$<input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" className={inputCls} /></label>
          <label className="flex flex-col gap-1 text-xs text-muted flex-1 min-w-[220px]">Rate source / date<input value={asOf} onChange={(e) => setAsOf(e.target.value)} className={inputCls} /></label>
          <Button kind="primary" onClick={() => { const r = Number(rate); if (r > 0) onFx({ usdInr: r, asOf }); }}>Save rate</Button>
        </div>
      </Card>
      <Card title="Known limitations">
        <ul className="list-disc pl-5 text-sm leading-relaxed flex flex-col gap-1.5 text-muted">
          <li>ERA5 and CMIP6 are ~25 km grids: local extremes (urban heat, convective cloudbursts) can be under-stated.</li>
          <li>JRC river-flood maps and expected losses assume no flood defences; small rivers (basins &lt; 500 km²) and urban drainage flooding are not mapped.</li>
          <li>Deltares coastal maps are 90 m with a 2018 and a 2050 sea level; other years are interpolated with AR6 sea-level rise. The 3 indexes (~26 MB each) download once per browser, only for coastal, low-lying sites.</li>
          <li>STORM cyclone maps download once per browser (deflated GeoTIFFs streamed out of a 1.1 GB Zenodo archive, ~6–9 MB each); tiles are then cached.</li>
          <li>Earthquake hazard is derived from a ~50-year catalogue and can understate rare large events in low-seismicity regions. The GEM global hazard map is licensed for non-commercial use only and is therefore not used.</li>
          <li>Subsidence, groundwater decline and lightning are present-day maps with no future projection.</li>
          <li>Wildfire weather does not know whether there is fuel (e.g. dense cities score on weather alone).</li>
          <li>Geocoding accuracy is shown per loan (address / locality / district / state). District-level points are the district centre.</li>
        </ul>
      </Card>
      <Card title="Data & limits" sub="Zero API keys required. Built-in CMIP6 physical science model automatically handles all calculations. An Open-Meteo API key is 100% optional (for enterprise bulk batch portfolios). Results cached per ~100 m for 90 days.">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted flex-1 min-w-[260px]">Open-Meteo API key (strictly optional — system works with zero keys)
            <input value={k} onChange={(e) => setK(e.target.value)} placeholder="paste optional commercial key" className={inputCls} type="password" autoComplete="off" />
          </label>
          <Button kind="primary" onClick={() => onApiKey(k)}>Save key</Button>
          <Button onClick={onClearCache}>Clear cached sites ({cacheCount})</Button>
          <Button onClick={async () => { await onClearRasters(); setCleared(true); }}>{cleared ? 'Map caches cleared' : 'Clear downloaded map caches'}</Button>
        </div>
        <p className="text-xs text-muted mt-3 flex flex-wrap gap-x-4 gap-y-1">{Object.values(SOURCES).map((s) => <a key={s.name} href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-ink">{s.name}<ExternalLink className="w-3 h-3" /></a>)}</p>
      </Card>
    </div>
  );
};
