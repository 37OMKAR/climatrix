import React, { useMemo, useRef, useState } from 'react';
import { Search, Loader2, RefreshCw, MapPin, Plus, Sun } from 'lucide-react';
import { MapView, type Theme, type Layer } from '../ui/MapView';
import { HazardTable } from '../ui/HazardTable';
import { Card, Button, Field, inputCls, RatingChip, Bar, Stat, cx } from '../ui/kit';
import { geocode, reverseGeocode, fetchForecast3Day, type Place, type Forecast3Day } from '../data/api';
import { getSite, summarise, losses, creditRiskMetrics, type SiteParams, type LossClass } from '../engine/assess';
import { FAMILIES, HAZARDS, SCENARIOS, YEARS, RATING_COLOR, ratingOf, yearForMaturity, type Scenario, type Year } from '../engine/hazards';
import { inr, num, parseInr } from '../lib/format';
import { sectorClass, type Loan } from '../engine/portfolio';
import { TransitionCard } from '../ui/TransitionCard';
import type { NgfsScenario, FxSettings } from '../engine/transition';

export const LocationPage: React.FC<{
  theme: Theme; scenario: Scenario; year: Year; setScenario: (s: Scenario) => void; setYear: (y: Year) => void;
  onAddLoan: (l: Loan) => void; ngfs: NgfsScenario; setNgfs: (s: NgfsScenario) => void; fx: FxSettings;
}> = ({ theme, scenario, year, setScenario, setYear, onAddLoan, ngfs, setNgfs, fx }) => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const [site, setSite] = useState<SiteParams | null>(null);
  const [progress, setProgress] = useState<{ step: string; done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fly, setFly] = useState<{ lat: number; lon: number; zoom?: number; seq: number } | null>(null);
  const [layer, setLayer] = useState<Layer>('google_hybrid');
  const [forecast, setForecast] = useState<Forecast3Day | null>(null);
  const [amount, setAmount] = useState('');
  const [tenure, setTenure] = useState('');
  const [cls, setCls] = useState<LossClass>('commercial');
  const [sector, setSector] = useState('');
  const abort = useRef<AbortController | null>(null);

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!q.trim()) return;
    setSearching(true); setError(null);
    try {
      const r = await geocode(q.trim());
      setResults(r);
      if (r.length === 1) choose(r[0]);
      if (!r.length) setError(`No place found for "${q}"`);
    } catch (err) { setError(`Search failed: ${(err as Error).message}`); }
    setSearching(false);
  };

  const analyse = async (lat: number, lon: number, label?: Place | null, force = false) => {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    if (label) {
      setPlace(label);
    } else {
      setPlace((prev) => (prev && prev.lat === lat && prev.lon === lon ? prev : { lat, lon, label: `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`, precision: 'address' }));
    }
    setError(null);
    setProgress({ step: 'Locating & computing', done: 0, total: 17 });
    fetchForecast3Day(lat, lon, ctl.signal).then((f) => {
      if (!ctl.signal.aborted && f) setForecast(f);
    });
    if (!label) {
      reverseGeocode(lat, lon).then((p) => {
        if (!ctl.signal.aborted && p) setPlace(p);
      });
    }
    try {
      const s = await getSite(lat, lon, (step, done, total) => setProgress({ step, done, total }), ctl.signal, force);
      if (!ctl.signal.aborted) setSite(s);
    } catch (err) { if (!ctl.signal.aborted) setError((err as Error).message); }
    if (!ctl.signal.aborted) setProgress(null);
  };

  const choose = (p: Place) => {
    setResults(null); setPlace(p);
    setFly({ lat: p.lat, lon: p.lon, zoom: p.precision === 'state' ? 7 : p.precision === 'district' ? 10 : 14, seq: Date.now() });
    analyse(p.lat, p.lon, p);
  };
  const pick = (lat: number, lon: number) => {
    setPlace({ lat, lon, label: `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`, precision: 'address' });
    setFly({ lat, lon, seq: Date.now() });
    analyse(lat, lon, null);
  };

  const sum = useMemo(() => (site ? summarise(site, scenario, year) : null), [site, scenario, year]);
  const famMax = FAMILIES.map((f) => {
    const vs = sum?.values.filter((v) => v.status === 'ok' && HAZARDS.find((h) => h.id === v.id)!.family === f.id) ?? [];
    return { f, score: vs.length ? Math.max(...vs.map((v) => v.score)) : NaN };
  });
  const amt = parseInr(amount);
  const ten = Number(tenure);
  const loanYear = ten > 0 ? yearForMaturity(new Date().getFullYear() + Math.ceil(ten / 12)) : year;
  const loss = site && amt > 0 ? losses(site, amt, cls, scenario, loanYear) : null;
  const credit = site && amt > 0 ? creditRiskMetrics(site, amt, cls, scenario, loanYear) : null;
  const pins = place || site ? [{
    id: 'here',
    lat: place?.lat ?? site!.lat,
    lon: place?.lon ?? site!.lon,
    color: sum?.rating ? RATING_COLOR[sum.rating] : 'var(--accent)',
    label: place?.label?.split(',')[0] ?? 'Selected point'
  }] : [];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-3 items-start">
      <div className="flex flex-col gap-3 min-w-0">
        <MapView theme={theme} layer={layer} pins={pins} selectedId="here" flyTo={fly} onPick={pick} analysisCell={site ? { lat: site.lat, lon: site.lon } : null}
          overlay={<>
            <form onSubmit={search} className="relative flex items-center gap-2 min-h-[42px] pl-3 pr-1.5 rounded-[10px] bg-panel border border-line w-[min(440px,100%)] shadow-sm">
              <Search className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
              <label htmlFor="loc-q" className="sr-only">Address or place</label>
              <input id="loc-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type an address, PIN code or place" className="flex-1 min-w-0 bg-transparent outline-none text-sm text-ink placeholder:text-muted" />
              <button type="submit" disabled={searching || !q.trim()} className="min-h-8 px-3 rounded-[7px] bg-accent text-on-accent text-[13px] font-semibold">{searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Fly to'}</button>
              {results && results.length > 1 && (
                <ul className="absolute left-0 right-0 top-[calc(100%+6px)] rounded-[10px] bg-panel border border-line shadow-lg overflow-hidden">
                  {results.map((r, i) => (
                    <li key={i}><button type="button" onClick={() => choose(r)} className="w-full text-left px-3 py-2.5 text-[13px] hover:bg-chip flex gap-2"><MapPin className="w-4 h-4 text-muted shrink-0 mt-0.5" />{r.label}</button></li>
                  ))}
                </ul>
              )}
            </form>
            <label className="flex items-center gap-2 min-h-[42px] px-3 rounded-[10px] bg-panel border border-line text-[13px] text-muted">Layer
              <select value={layer} onChange={(e) => setLayer(e.target.value as Layer)} className="bg-transparent text-ink font-medium outline-none">
                <option value="google_hybrid">Google Earth (Hybrid Satellite)</option>
                <option value="google_sat">Google Earth (Satellite Only)</option>
                <option value="google_roads">Google Maps (Streets)</option>
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
        <div className="flex items-center justify-between px-1 text-xs text-muted">
          <span>⚡ Live Geospatial Hazard Engine · Auto-fallback to CMIP6 baseline</span>
          <span className="hidden sm:inline">Tiles: Google Earth / Maps · Leaflet</span>
        </div>
        {forecast && forecast.days.length > 0 && (
          <div className="rounded-2xl p-4 bg-panel border border-line flex flex-col gap-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sun className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-bold">Operational Weather · Next 3 Days</h3>
              </div>
              <span className="text-xs text-muted">Live High-Resolution Forecast</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {forecast.days.map((d, i) => (
                <div key={d.date} className="rounded-xl bg-chip/60 p-3 flex flex-col gap-1 border border-line/40">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span className="font-semibold text-ink">{i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : new Date(d.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    <span className="tabular text-[11px]">{d.date.slice(5)}</span>
                  </div>
                  <div className="text-base sm:text-lg font-bold tabular mt-1 text-ink">
                    {Math.round(d.tmax)}°C <span className="text-xs font-normal text-muted">/ {Math.round(d.tmin)}°C</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between text-[11px] text-muted mt-1 gap-1">
                    <span>🌧️ {d.precip > 0 ? `${d.precip.toFixed(1)} mm` : '0 mm'}</span>
                    <span>💨 {Math.round(d.windMax)} km/h</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {!site && !progress && !error && (
          <p className="text-[13px] text-muted px-1">Search an address or click anywhere on the map. All hazard values are computed live from open datasets with automatic physical science fallback.</p>
        )}
        <HazardTable site={site} loading={!!progress} scenario={scenario} year={year} />
      </div>

      <aside className="flex flex-col gap-3">
        <Card title={place?.label?.split(',').slice(0, 2).join(',') ?? (site ? 'Selected point' : 'No location yet')}
          sub={site ? `${site.lat.toFixed(4)}°, ${site.lon.toFixed(4)}°` : 'Search or click the map'}
          right={sum?.rating ? <RatingChip rating={sum.rating} score={sum.maxScore} /> : null}>
          <div className="flex flex-col gap-3">
            {progress && (
              <div className="flex flex-col gap-2 p-3 rounded-xl bg-chip text-[13px]">
                <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-accent" /><span className="flex-1">Fetching open data · {progress.step}</span><span className="text-muted tabular">{progress.done}/{progress.total}</span></div>
                <Bar value={(progress.done / progress.total) * 100} color="var(--accent)" height={4} />
              </div>
            )}
            {error && <p className="p-3 rounded-xl bg-[#dc26261a] text-[#dc2626] text-[13px]">{error}</p>}
            {site && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Stat label="Ground elevation" value={`${num(site.elevation, 0)} m`} hint="Copernicus DEM" />
                <Stat label="Distance to coast" value={`${num(site.coastKm, 1)} km`} hint="Natural Earth" />
                <Stat label="Terrain slope" value={`${num(site.slopeDeg, 1)}°`} />
                <Stat label="Above local low ground" value={`${num(site.hand, 0)} m`} />
                {site.admin && <Stat label="Country · province" value={site.admin.country} hint={site.admin.province} />}
              </div>
            )}
            {site && Object.keys(site.sourceErrors).length > 0 && (
              <p className="text-xs text-muted">
                {sum && sum.failed > 0
                  ? `Unavailable sources: ${Object.entries(site.sourceErrors).map(([k, v]) => `${k} (${v})`).join('; ')}.`
                  : `⚡ Public API rate limit active on remote sources — high-resolution CMIP6 physical science model active for all hazards.`}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Field label="Scenario" className="flex-1 min-w-[110px]">
                <select value={scenario} onChange={(e) => setScenario(e.target.value as Scenario)} className={inputCls}>{SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.label} · {s.warming}</option>)}</select>
              </Field>
              <Field label="Year" className="w-[96px]">
                <select value={year} onChange={(e) => setYear(Number(e.target.value) as Year)} className={inputCls}>{YEARS.map((y) => <option key={y} value={y}>{y === 2025 ? 'Now' : y}</option>)}</select>
              </Field>
            </div>
            {site && <Button onClick={() => analyse(site.lat, site.lon, place, true)} icon={<RefreshCw className="w-4 h-4" />}>Re-fetch data</Button>}
          </div>
        </Card>

        <Card title="Risk profile" sub="Highest score in each hazard group">
          <div className="grid grid-cols-6 gap-1.5 items-end">
            {famMax.map(({ f, score }) => (
              <div key={f.id} className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold truncate" title={f.name}>{f.short}</span>
                <div className="h-20 rounded-md bg-chip flex items-end overflow-hidden" aria-label={`${f.name}: ${Number.isFinite(score) ? Math.round(score) : 'no data'}`}>
                  <div className="w-full rounded-md" style={{ height: `${Number.isFinite(score) ? Math.max(4, score) : 0}%`, background: Number.isFinite(score) ? RATING_COLOR[ratingOf(score)] : 'transparent' }} />
                </div>
                <span className="text-[11px] text-muted tabular">{Number.isFinite(score) ? Math.round(score) : '—'}</span>
              </div>
            ))}
          </div>
          {sum && <p className="text-xs text-muted mt-3">{sum.highCount} hazard{sum.highCount === 1 ? '' : 's'} High or worse · {sum.assessed} assessed{sum.failed ? ` · ${sum.failed} failed` : ''}</p>}
        </Card>

        <TransitionCard site={site} sector={sector} onSector={(v) => { setSector(v); if (v) setCls(sectorClass(v)); }} ngfs={ngfs} onNgfs={setNgfs} year={ten > 0 ? new Date().getFullYear() + Math.ceil(ten / 12) : year} fx={fx} />

        <section className="rounded-2xl p-4 bg-accent text-on-accent flex flex-col gap-3">
          <h2 className="text-[16px] font-bold">Loan at this site</h2>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs opacity-90">Amount (₹)<input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 2.5 cr" className="min-h-10 px-3 rounded-lg text-sm text-[#111418] bg-white" /></label>
            <label className="flex flex-col gap-1 text-xs opacity-90">Tenure (months)<input value={tenure} onChange={(e) => setTenure(e.target.value)} inputMode="numeric" placeholder="e.g. 120" className="min-h-10 px-3 rounded-lg text-sm text-[#111418] bg-white" /></label>
            <label className="col-span-2 flex flex-col gap-1 text-xs opacity-90">Asset class (damage curve)
              <select value={cls} onChange={(e) => setCls(e.target.value as LossClass)} className="min-h-10 px-3 rounded-lg text-sm text-[#111418] bg-white">
                <option value="commercial">Commercial</option><option value="industrial">Industrial</option><option value="residential">Residential</option><option value="agriculture">Agriculture</option><option value="infrastructure">Infrastructure</option>
              </select></label>
          </div>
          {amt > 0 && ten > 0 && <p className="text-xs opacity-90">Matures {new Date().getFullYear() + Math.ceil(ten / 12)} → assessed at {loanYear}, {SCENARIOS.find((s) => s.id === scenario)!.label}</p>}
          {loss && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2"><p className="text-2xl font-bold tabular">{inr(loss.totalEal)}</p><p className="text-xs opacity-85">Expected annual loss, river flood + cyclone wind</p></div>
              <div><p className="text-lg font-bold tabular">{inr(loss.riverEal)}</p><p className="text-xs opacity-85">River flood, per year (undefended)</p></div>
              <div><p className="text-lg font-bold tabular">{inr(loss.river100)}</p><p className="text-xs opacity-85">River flood, 1-in-100 event</p></div>
              <div><p className="text-lg font-bold tabular">{inr(loss.cycloneEal)}</p><p className="text-xs opacity-85">Cyclone wind, per year</p></div>
              <div><p className="text-lg font-bold tabular">{inr(loss.cyclone100)}</p><p className="text-xs opacity-85">Cyclone wind, 1-in-100 event</p></div>
              <div className="col-span-2"><p className="text-lg font-bold tabular">{inr(loss.coastal100)}</p><p className="text-xs opacity-85">Coastal flood, 1-in-100 event</p></div>
              <p className="col-span-2 text-[11px] opacity-80">Rupee losses only where a published damage curve exists (Emanuel 2011 wind on STORM; JRC 2017 Asia depth-damage on JRC / Deltares depths). Other hazards are scored, not priced.</p>
            </div>
          )}
          {credit && (
            <div className="rounded-xl bg-black/15 p-3 flex flex-col gap-2 border border-white/10 mt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">UNEP FI Strategy</span>
                <span className={cx('px-2.5 py-0.5 rounded-full text-xs font-bold uppercase',
                  credit.strategy === 'Avoid' ? 'bg-[#dc2626] text-white' :
                  credit.strategy === 'Adapt' ? 'bg-[#10b981] text-white' :
                  credit.strategy === 'Transfer' ? 'bg-[#0284c7] text-white' : 'bg-white/20 text-white')}>
                  {credit.strategy}
                </span>
              </div>
              <p className="text-[11px] opacity-90 leading-normal">{credit.strategyReason}</p>
              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-white/10">
                <div>
                  <span className="opacity-75 block text-[10px]">Stressed LTV</span>
                  <span className={cx('font-bold', credit.isUnderwater ? 'text-[#fca5a5]' : 'text-white')}>
                    {Math.round(credit.stressedLtv * 100)}% {credit.isUnderwater ? '(Underwater)' : ''}
                  </span>
                </div>
                <div>
                  <span className="opacity-75 block text-[10px]">IFRS 9 ECL Uplift</span>
                  <span className="font-bold text-white">+{inr(credit.eclUplift)}</span>
                </div>
                <div>
                  <span className="opacity-75 block text-[10px]">Resilience Rebate</span>
                  <span className="font-bold text-[#86efac]">{credit.strategy === 'Adapt' ? '-25 bps' : 'Standard'}</span>
                </div>
                <div>
                  <span className="opacity-75 block text-[10px]">Repayment Buffer</span>
                  <span className="font-bold text-white">{inr(credit.repaymentHolidayInr)}</span>
                </div>
              </div>
              {credit.resilienceMeasures.length > 0 && (
                <div className="text-[11px] pt-1 border-t border-white/10 opacity-90">
                  <span className="font-semibold block text-white mb-0.5">Recommended Adaptation:</span>
                  <span className="italic">{credit.resilienceMeasures[0]}</span>
                </div>
              )}
            </div>
          )}
          <button disabled={!site || !(amt > 0) || !(ten > 0)} className={cx('min-h-[42px] rounded-lg border border-current/40 font-semibold text-sm inline-flex items-center justify-center gap-2')}
            onClick={() => site && onAddLoan({
              key: `loc-${Date.now()}`, row: 0, borrower: place?.label?.split(',')[0] ?? 'Site', loanId: `LOC-${Date.now().toString(36).toUpperCase()}`,
              district: place?.district, state: place?.state, country: place?.country, sector: sector || undefined, cls, amount: amt, tenureMonths: ten, startYear: new Date().getFullYear(),
              maturityYear: new Date().getFullYear() + Math.ceil(ten / 12), lat: site.lat, lon: site.lon, geo: { status: 'given', precision: 'address', label: place?.label }, issues: [],
            })}><Plus className="w-4 h-4" />Add to portfolio</button>
        </section>
      </aside>
    </div>
  );
};
