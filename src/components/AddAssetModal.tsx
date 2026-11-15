import React, { useEffect, useMemo, useState } from 'react';
import { Asset, AssetCategory, Decade, ReturnPeriod, SSPScenario } from '../types/climate';
import {
  ASSET_TAXONOMY_GROUPS,
  HAZARD_CATALOG,
  SSP_SCENARIOS,
  assessAssetRisk,
  estimateGlobalElevationMeters,
  formatCurrencyUsd,
  getDistanceToOceanKm,
  reverseGeocodeLocation,
} from '../services/climateEngine';
import { Check, X, MapPin } from 'lucide-react';
import { ModalShell, Button, RatingBadge, cx } from './ui';
import { parseMoney } from '../services/csvImport';

interface AddAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddAsset: (asset: Asset) => void;
  initialCoordinates?: { lat: number; lon: number } | null;
  initialAssetType?: string;
  initialCategory?: AssetCategory;
  scenario?: SSPScenario;
  decade?: Decade;
  returnPeriod?: ReturnPeriod;
}

const CITY_PRESETS = [
  { city: 'Miami', country: 'United States', lat: 25.7617, lon: -80.1918, elev: 2.1 },
  { city: 'New York', country: 'United States', lat: 40.7128, lon: -74.006, elev: 10 },
  { city: 'Houston', country: 'United States', lat: 29.7604, lon: -95.3698, elev: 15 },
  { city: 'Denver', country: 'United States', lat: 39.7392, lon: -104.9903, elev: 1610 },
  { city: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503, elev: 40 },
  { city: 'Singapore', country: 'Singapore', lat: 1.3521, lon: 103.8198, elev: 15 },
  { city: 'London', country: 'United Kingdom', lat: 51.5074, lon: -0.1278, elev: 11 },
  { city: 'Rotterdam', country: 'Netherlands', lat: 51.9244, lon: 4.4777, elev: -1 },
  { city: 'Mumbai', country: 'India', lat: 19.076, lon: 72.8777, elev: 14 },
  { city: 'Madrid', country: 'Spain', lat: 40.4168, lon: -3.7038, elev: 660 },
];

const CATEGORIES = Object.keys(ASSET_TAXONOMY_GROUPS) as AssetCategory[];
const field = 'w-full rounded-xl bg-slate-950/70 ring-1 ring-inset ring-white/[0.08] px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-cyan-400/60';

const Field: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({ label, children, hint }) => (
  <label className="block">
    <span className="block text-xs text-slate-400 mb-1">{label}</span>
    {children}
    {hint && <span className="block text-xs text-slate-400 mt-1">{hint}</span>}
  </label>
);

export const AddAssetModal: React.FC<AddAssetModalProps> = ({ isOpen, onClose, onAddAsset, initialCoordinates, initialAssetType, initialCategory, scenario = 'ssp245', decade = 2050, returnPeriod = 'aal' }) => {
  const [name, setName] = useState('');
  const [parentEntity, setParentEntity] = useState('');
  const [category, setCategory] = useState<AssetCategory>('Commercial Real Estate');
  const [assetType, setAssetType] = useState(ASSET_TAXONOMY_GROUPS['Commercial Real Estate'][0]);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [elevation, setElevation] = useState('');
  const [elevTouched, setElevTouched] = useState(false);
  const [placeTouched, setPlaceTouched] = useState(false);
  const [value, setValue] = useState('150M');
  const [yearBuilt, setYearBuilt] = useState('2020');
  const [error, setError] = useState<string | null>(null);

  const applyCoords = (lat: number, lon: number, preset?: { city: string; country: string; elev: number }) => {
    setLatitude(lat.toFixed(4));
    setLongitude(lon.toFixed(4));
    const geo = reverseGeocodeLocation(lat, lon);
    setCity(preset?.city ?? (geo.city === 'Unknown city' ? '' : geo.city));
    setCountry(preset?.country ?? geo.country);
    setElevation(String(preset?.elev ?? estimateGlobalElevationMeters(lat, lon)));
    setElevTouched(false);
    setPlaceTouched(false);
  };
  // Re-detect place and elevation when coordinates change, unless the user typed them in
  const onCoordsBlur = () => {
    if (!coordsOk) return;
    const geo = reverseGeocodeLocation(lat, lon);
    if (!placeTouched) {
      setCity(geo.city === 'Unknown city' ? '' : geo.city);
      setCountry(geo.country);
    }
    if (!elevTouched) setElevation(String(estimateGlobalElevationMeters(lat, lon)));
  };

  // Reset each time the modal opens, applying any preset passed in
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setName('');
    setParentEntity('');
    const cat = initialCategory && CATEGORIES.includes(initialCategory) ? initialCategory : 'Commercial Real Estate';
    setCategory(cat);
    setAssetType(initialAssetType && ASSET_TAXONOMY_GROUPS[cat]?.includes(initialAssetType) ? initialAssetType : ASSET_TAXONOMY_GROUPS[cat][0]);
    if (initialCoordinates) applyCoords(initialCoordinates.lat, initialCoordinates.lon);
    else applyCoords(CITY_PRESETS[0].lat, CITY_PRESETS[0].lon, CITY_PRESETS[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);
  const coordsOk = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  const val = parseMoney(value);
  const elev = parseFloat(elevation);

  // Live risk preview while typing
  const preview = useMemo(() => {
    if (!coordsOk) return null;
    return assessAssetRisk(
      {
        id: 'preview', name: name || 'Preview', entityName: '', parentEntity: '', assetType, category,
        latitude: lat, longitude: lon, city, country,
        replacementValueUsd: Number.isFinite(val) && val > 0 ? val : 1e8,
        yearBuilt: 2020, elevationMeters: Number.isFinite(elev) ? elev : undefined, criticalityTier: 2,
      },
      scenario, decade, returnPeriod,
    );
  }, [coordsOk, lat, lon, assetType, category, val, elev, name, city, country, scenario, decade, returnPeriod]);

  const shortType = assetType.replace(/\s*\(.*\)\s*/g, '').trim();
  const defaultName = `${city.trim() || 'New'} ${shortType}`.trim();

  if (!isOpen) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!coordsOk) return setError('Latitude must be between -90 and 90 and longitude between -180 and 180.');
    if (!Number.isFinite(val) || val <= 0) return setError('Enter a replacement value, e.g. 250000000 or 250M.');
    const yr = parseInt(yearBuilt, 10);
    onAddAsset({
      id: `manual-${Date.now().toString(36)}`,
      name: name.trim() || defaultName,
      entityName: parentEntity.trim() || 'My organisation',
      parentEntity: parentEntity.trim() || 'My organisation',
      assetType,
      category,
      latitude: lat,
      longitude: lon,
      city: city.trim() || reverseGeocodeLocation(lat, lon).city,
      country: country.trim() || reverseGeocodeLocation(lat, lon).country,
      elevationMeters: Number.isFinite(elev) ? elev : estimateGlobalElevationMeters(lat, lon),
      replacementValueUsd: val,
      yearBuilt: Number.isFinite(yr) ? yr : 2020,
      criticalityTier: 2,
    });
    onClose();
  };

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-3xl" labelledBy="add-title">
      <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <h2 id="add-title" className="text-base font-semibold text-white">Add a site</h2>
          <p className="text-xs text-slate-400 mt-0.5">Elevation and location fill in automatically from the coordinates.</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06]" aria-label="Close"><X className="w-5 h-5" /></button>
      </div>

      <form onSubmit={submit} className="flex-1 overflow-y-auto">
        <div className="grid md:grid-cols-[1fr_240px]">
          <div className="p-6 space-y-4">
            <div>
              <div className="text-xs text-slate-400 mb-1.5">Quick locations</div>
              <div className="flex flex-wrap gap-1.5">
                {CITY_PRESETS.map((p) => (
                  <button
                    type="button"
                    key={p.city}
                    onClick={() => applyCoords(p.lat, p.lon, p)}
                    className={cx('px-2.5 py-1 rounded-lg text-xs ring-1 ring-inset', city === p.city ? 'bg-cyan-400/15 text-cyan-200 ring-cyan-400/40' : 'text-slate-400 ring-white/[0.08] hover:text-white')}
                  >
                    {p.city}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Name"><input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder={defaultName} /></Field>
              <Field label="Owner / parent company"><input className={field} value={parentEntity} onChange={(e) => setParentEntity(e.target.value)} placeholder="My organisation" /></Field>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Category">
                <select className={field} value={category} onChange={(e) => { const c = e.target.value as AssetCategory; setCategory(c); setAssetType(ASSET_TAXONOMY_GROUPS[c][0]); }}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Asset type">
                <select className={field} value={assetType} onChange={(e) => setAssetType(e.target.value)}>
                  {ASSET_TAXONOMY_GROUPS[category].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="Latitude">
                <input className={field} inputMode="decimal" value={latitude} onChange={(e) => setLatitude(e.target.value)}
                  onBlur={onCoordsBlur} />
              </Field>
              <Field label="Longitude">
                <input className={field} inputMode="decimal" value={longitude} onChange={(e) => setLongitude(e.target.value)}
                  onBlur={onCoordsBlur} />
              </Field>
              <Field label="Elevation (m)"><input className={field} inputMode="decimal" value={elevation} onChange={(e) => { setElevation(e.target.value); setElevTouched(true); }} /></Field>
              <Field label="Year built"><input className={field} inputMode="numeric" value={yearBuilt} onChange={(e) => setYearBuilt(e.target.value)} /></Field>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Replacement value (USD)" hint={Number.isFinite(val) ? formatCurrencyUsd(val) : 'e.g. 250M or 1.2B'}>
                <input className={field} value={value} onChange={(e) => setValue(e.target.value)} />
              </Field>
              <Field label="City"><input className={field} value={city} placeholder="e.g. Mumbai" onChange={(e) => { setCity(e.target.value); setPlaceTouched(true); }} /></Field>
              <Field label="Country"><input className={field} value={country} placeholder="e.g. India" onChange={(e) => { setCountry(e.target.value); setPlaceTouched(true); }} /></Field>
            </div>

            {error && <div className="text-xs text-red-300 rounded-lg bg-red-500/10 ring-1 ring-red-400/30 px-3 py-2">{error}</div>}
          </div>

          {/* Live preview */}
          <aside className="border-t md:border-t-0 md:border-l border-white/[0.06] p-5 bg-white/[0.02] space-y-3">
            <div className="text-xs text-slate-400">Risk preview · {SSP_SCENARIOS[scenario].code}, {decade === 2025 ? 'today' : decade}, {returnPeriod === 'aal' ? 'average year' : `1-in-${returnPeriod.replace('yr', '')}`}</div>
            <div className="text-[11px] text-slate-500 -mt-2">Same settings as the dashboard</div>
            {preview ? (
              <>
                <RatingBadge rating={preview.compositeRating} score={preview.compositeScore} size="md" />
                <div className="text-xs text-slate-400 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{getDistanceToOceanKm(lat, lon)} km to coast</div>
                <div>
                  <div className="text-xs text-slate-400">Average annual loss</div>
                  <div className="text-lg font-semibold text-red-300 tabular-nums">{formatCurrencyUsd(preview.aalUsd)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">Top hazards</div>
                  <ul className="space-y-1">
                    {Object.values(preview.hazardResults).sort((a, b) => b.score - a.score).slice(0, 3).map((h) => (
                      <li key={h.hazardId} className="flex justify-between text-xs"><span className="text-slate-300">{HAZARD_CATALOG[h.hazardId].shortName}</span><span className="tabular-nums text-slate-400">{Math.round(h.score)}</span></li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-500">Enter valid coordinates to see a preview.</div>
            )}
          </aside>
        </div>

        <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" icon={<Check className="w-4 h-4" />}>Add site</Button>
        </div>
      </form>
    </ModalShell>
  );
};
