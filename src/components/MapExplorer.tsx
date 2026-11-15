import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  AssetRiskAssessment,
  HazardType,
  RiskRating,
  SSPScenario,
  Decade,
  ReturnPeriod,
  SpatialResolution,
} from '../types/climate';
import {
  formatCurrencyUsd,
  HAZARD_CATALOG,
  queryLocationClimateData,
  siteElevation,
  SPATIAL_RESOLUTIONS,
  RATING_HEX,
  RATING_ORDER,
  HAZARD_FAMILIES,
  getRatingFromScore,
} from '../services/climateEngine';
import type { HazardFamily } from '../types/climate';
import { Maximize2, Crosshair, PlusCircle, X, Search, Layers, Grid } from 'lucide-react';
import { RatingBadge, cx } from './ui';

interface MapExplorerProps {
  assessments: AssetRiskAssessment[];
  selectedAssetId: string | null; // explicit user selection: the map flies to it
  highlightAssetId?: string | null; // drawn emphasised (defaults to selectedAssetId)
  onSelectAsset: (assetId: string) => void;
  onOpenAsset?: (assetId: string) => void;
  currentScenario: SSPScenario;
  currentDecade: Decade;
  currentReturnPeriod: ReturnPeriod;
  currentResolution: SpatialResolution;
  onAddAssetAtCoords?: (lat: number, lon: number) => void;
  onResolutionChange?: (r: SpatialResolution) => void;
  compact?: boolean;
}

type BasemapStyle = 'dark' | 'satellite' | 'streets' | 'osm';
type OverlayId = 'none' | 'coastal_flood' | 'tropical_cyclone' | 'wildfire' | 'extreme_heat';

const escapeHtml = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

// Indicative hotspot overlays (illustrative regions, not modelled rasters)
const OVERLAYS: Record<Exclude<OverlayId, 'none'>, { label: string; color: string; zones: Array<[number, number, number, string]> }> = {
  coastal_flood: {
    label: 'Coastal surge hotspots',
    color: '#0ea5e9',
    zones: [
      [26.5, -81.0, 280, 'Florida coastal surge basin'],
      [29.5, -94.0, 260, 'Gulf of Mexico inundation zone'],
      [52.5, 4.5, 220, 'North Sea polder delta'],
      [1.3, 103.8, 140, 'Singapore & Malacca Strait'],
      [31.2, 121.5, 260, 'Yangtze River delta'],
    ],
  },
  tropical_cyclone: {
    label: 'Cyclone corridors',
    color: '#a855f7',
    zones: [
      [25.0, -76.0, 650, 'Atlantic hurricane corridor'],
      [22.0, 125.0, 800, 'Western Pacific typhoon belt'],
      [18.0, 88.0, 450, 'Bay of Bengal cyclone basin'],
    ],
  },
  wildfire: {
    label: 'Wildfire hotspots',
    color: '#f97316',
    zones: [
      [35.0, -119.0, 380, 'California high fire-severity zone'],
      [-34.0, 145.0, 550, 'SE Australia bushfire zone'],
      [40.0, -4.0, 420, 'Iberian high fire-weather zone'],
    ],
  },
  extreme_heat: {
    label: 'Extreme heat belts',
    color: '#ef4444',
    zones: [
      [33.0, -112.0, 450, 'US Southwest heat dome'],
      [25.0, 55.0, 600, 'Arabian Gulf wet-bulb stress zone'],
      [28.0, 77.0, 550, 'Indo-Gangetic heatwave belt'],
    ],
  },
};

const TILES: Record<BasemapStyle, { url: string; attribution: string }> = {
  dark: { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: '&copy; CARTO &copy; OpenStreetMap' },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri' },
  streets: { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attribution: '&copy; CARTO &copy; OpenStreetMap' },
  osm: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap contributors' },
};

export const MapExplorer: React.FC<MapExplorerProps> = ({
  assessments,
  selectedAssetId,
  highlightAssetId,
  onSelectAsset,
  onOpenAsset,
  currentScenario,
  currentDecade,
  currentReturnPeriod,
  currentResolution,
  onAddAssetAtCoords,
  onResolutionChange,
  compact = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const overlayRef = useRef<L.LayerGroup | null>(null);
  const gridRef = useRef<L.LayerGroup | null>(null);
  const pinRef = useRef<L.LayerGroup | null>(null);
  const lastFitKey = useRef<string>('');
  const fitBoundsRef = useRef<L.LatLngBounds | null>(null);
  const userMovedRef = useRef(false);

  const [basemap, setBasemap] = useState<BasemapStyle>('dark');
  const [overlay, setOverlay] = useState<OverlayId>('none');
  const [showGrid, setShowGrid] = useState(false);
  const [minRating, setMinRating] = useState<RiskRating | 'All'>('All');
  const [search, setSearch] = useState('');
  const [colorBy, setColorBy] = useState<'overall' | HazardFamily>('overall');
  const [probe, setProbe] = useState<{ lat: number; lon: number } | null>(null);
  const [viewTick, setViewTick] = useState(0);

  // Keep latest callbacks available to Leaflet handlers registered once at mount
  const cbRef = useRef({ onSelectAsset, onOpenAsset });
  cbRef.current = { onSelectAsset, onOpenAsset };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const minIdx = minRating === 'All' ? 0 : RATING_ORDER.indexOf(minRating);
    return assessments.filter((a) => {
      if (q) {
        const hay = `${a.asset.name} ${a.asset.city} ${a.asset.country} ${a.asset.entityName} ${a.asset.parentEntity}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return RATING_ORDER.indexOf(a.compositeRating) >= minIdx;
    });
  }, [assessments, search, minRating]);

  // Point probe re-runs whenever the scenario controls change (fixes stale-closure bug)
  const diagnostic = useMemo(
    () => (probe ? queryLocationClimateData(probe.lat, probe.lon, currentScenario, currentDecade, currentReturnPeriod, currentResolution) : null),
    [probe, currentScenario, currentDecade, currentReturnPeriod, currentResolution],
  );

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: [25, 10], zoom: 2, minZoom: 2, maxZoom: 18, zoomControl: false, worldCopyJump: true });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    overlayRef.current = L.layerGroup().addTo(map);
    gridRef.current = L.layerGroup().addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    pinRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    map.on('click', (e: L.LeafletMouseEvent) => {
      const t = e.originalEvent.target as HTMLElement | null;
      if (t?.closest('.leaflet-popup-content-wrapper') || t?.closest('.custom-asset-marker')) return;
      setProbe({ lat: e.latlng.lat, lon: ((e.latlng.lng + 540) % 360) - 180 });
    });
    map.on('moveend', () => setViewTick((v) => v + 1));
    map.on('dragstart zoomstart', (e: L.LeafletEvent) => {
      // only count genuine user gestures, not programmatic fits
      if ((e as unknown as { originalEvent?: Event }).originalEvent || e.type === 'dragstart') userMovedRef.current = true;
    });

    // Leaflet needs a size recalculation when its container is laid out after mount;
    // refit to the portfolio until the user has moved the map themselves.
    const ro = new ResizeObserver(() => {
      if (!mapRef.current || !containerRef.current?.isConnected) return;
      map.invalidateSize();
      if (!userMovedRef.current && fitBoundsRef.current) map.fitBounds(fitBoundsRef.current, { padding: [40, 40], maxZoom: 6 });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Basemap
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    tileRef.current?.remove();
    const tl = L.tileLayer(TILES[basemap].url, { attribution: TILES[basemap].attribution, maxZoom: 19, subdomains: 'abcd' });
    tl.on('tileerror', () => {
      tl.setUrl('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    });
    tl.addTo(map);
    tl.bringToBack();
    tileRef.current = tl;
  }, [basemap]);

  // Hotspot overlay
  useEffect(() => {
    const layer = overlayRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (overlay === 'none') return;
    const o = OVERLAYS[overlay];
    o.zones.forEach(([lat, lng, km, label]) => {
      L.circle([lat, lng], { radius: km * 1000, color: o.color, fillColor: o.color, fillOpacity: 0.18, weight: 1, dashArray: '4 4' })
        .bindTooltip(escapeHtml(label), { sticky: true, className: 'leaflet-dark-tooltip' })
        .addTo(layer);
    });
  }, [overlay]);

  // Resolution grid (redrawn on pan/zoom; capped so it never floods the DOM)
  useEffect(() => {
    const layer = gridRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    if (!showGrid) return;
    const step = currentResolution === '25km' ? 0.25 : currentResolution === '10km' ? 0.1 : currentResolution === '1km' ? 0.01 : 0.0009;
    const b = map.getBounds();
    const span = Math.max(b.getNorth() - b.getSouth(), b.getEast() - b.getWest());
    if (span / step > 120) return; // too dense at this zoom; legend explains
    const style = { color: '#22d3ee', weight: 0.6, opacity: 0.35 };
    for (let lat = Math.floor(b.getSouth() / step) * step; lat <= b.getNorth(); lat += step) {
      L.polyline([[lat, b.getWest()], [lat, b.getEast()]], style).addTo(layer);
    }
    for (let lng = Math.floor(b.getWest() / step) * step; lng <= b.getEast(); lng += step) {
      L.polyline([[b.getSouth(), lng], [b.getNorth(), lng]], style).addTo(layer);
    }
  }, [showGrid, currentResolution, viewTick]);

  const gridTooDense = useMemo(() => {
    const map = mapRef.current;
    if (!map || !showGrid) return false;
    const step = currentResolution === '25km' ? 0.25 : currentResolution === '10km' ? 0.1 : currentResolution === '1km' ? 0.01 : 0.0009;
    const b = map.getBounds();
    return Math.max(b.getNorth() - b.getSouth(), b.getEast() - b.getWest()) / step > 120;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- viewTick forces re-evaluation after pan/zoom
  }, [showGrid, currentResolution, viewTick]);

  // Markers
  useEffect(() => {
    const layer = markersRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();

    filtered.forEach((a) => {
      const { asset } = a;
      const fam = colorBy === 'overall' ? null : a.familyScores.find((f) => f.family === colorBy);
      const shownScore = fam ? Math.round(fam.score) : a.compositeScore;
      const shownRating = fam ? getRatingFromScore(fam.score) : a.compositeRating;
      const color = RATING_HEX[shownRating];
      const selected = asset.id === (highlightAssetId ?? selectedAssetId);
      const size = selected ? 22 : 14;
      const icon = L.divIcon({
        className: 'custom-asset-marker',
        iconSize: [size + 8, size + 8],
        iconAnchor: [(size + 8) / 2, (size + 8) / 2],
        html: `<div style="width:${size + 8}px;height:${size + 8}px;display:flex;align-items:center;justify-content:center">
          <div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid ${selected ? '#ffffff' : '#0b1020'};box-shadow:0 0 0 ${selected ? 4 : 0}px ${color}55, 0 2px 6px rgba(0,0,0,.5)"></div>
        </div>`,
      });

      const primary = HAZARD_CATALOG[a.primaryHazard];
      const elev = siteElevation(asset);
      const html = `
        <div style="padding:14px;width:260px;font-family:inherit">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:4px">
            <span style="font-size:11px;color:#94a3b8">${escapeHtml(asset.category)}</span>
            <span style="font-size:11px;color:${color};font-weight:600">${fam ? escapeHtml(HAZARD_FAMILIES.find((f) => f.id === colorBy)!.short) + ': ' : ''}${escapeHtml(shownRating)} · ${shownScore}</span>
          </div>
          <div style="font-size:14px;font-weight:600;color:#fff;line-height:1.3">${escapeHtml(asset.name)}</div>
          <div style="font-size:12px;color:#94a3b8;margin:2px 0 10px">${escapeHtml(asset.city)}, ${escapeHtml(asset.country)} · ${escapeHtml(elev)} m</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;margin-bottom:10px">
            <div><div style="color:#64748b;font-size:11px">Value</div><div style="color:#e2e8f0;font-weight:600">${formatCurrencyUsd(asset.replacementValueUsd)}</div></div>
            <div><div style="color:#64748b;font-size:11px">${a.lossMetricType === 'AAL' ? 'Avg annual loss' : 'Event loss'}</div><div style="color:#fca5a5;font-weight:600">${formatCurrencyUsd(a.totalExpectedAnnualLossUsd)}</div></div>
          </div>
          <div style="font-size:12px;color:#cbd5e1;margin-bottom:12px">Main threat: <b style="color:#fff">${escapeHtml(primary.name)}</b></div>
          <button data-open="${escapeHtml(asset.id)}" style="width:100%;padding:8px;border-radius:10px;background:#22d3ee;color:#020617;font-size:12px;font-weight:600;border:0;cursor:pointer">Open full analysis</button>
        </div>`;

      const marker = L.marker([asset.latitude, asset.longitude], { icon, zIndexOffset: selected ? 1000 : 0, riseOnHover: true })
        .bindPopup(html, { maxWidth: 300, closeButton: true })
        .bindTooltip(escapeHtml(asset.name), { direction: 'top', offset: [0, -8], className: 'leaflet-dark-tooltip' });
      marker.on('click', () => cbRef.current.onSelectAsset(asset.id));
      marker.on('popupopen', (ev) => {
        const btn = (ev.popup.getElement() as HTMLElement | undefined)?.querySelector<HTMLButtonElement>('[data-open]');
        if (btn) btn.onclick = () => (cbRef.current.onOpenAsset ?? cbRef.current.onSelectAsset)(asset.id);
      });
      layer.addLayer(marker);
    });

    // Only refit when the set of visible assets changes, not on every re-render
    const key = filtered.map((a) => a.asset.id).join('|');
    if (key !== lastFitKey.current) {
      lastFitKey.current = key;
      if (filtered.length > 0) {
        const b = L.latLngBounds(filtered.map((a) => [a.asset.latitude, a.asset.longitude] as [number, number]));
        fitBoundsRef.current = b;
        userMovedRef.current = false;
        map.fitBounds(b, { padding: [40, 40], maxZoom: 6 });
      }
    }
  }, [filtered, selectedAssetId, highlightAssetId, colorBy]);

  // Fly to the selected asset only when the selection itself changes
  useEffect(() => {
    if (!selectedAssetId || !mapRef.current) return;
    const item = assessments.find((a) => a.asset.id === selectedAssetId);
    userMovedRef.current = true;
    if (item) mapRef.current.flyTo([item.asset.latitude, item.asset.longitude], Math.max(mapRef.current.getZoom(), 5), { duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAssetId]);

  // Probe pin & grid-cell box
  useEffect(() => {
    const layer = pinRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!diagnostic || !probe) return;
    const [[a, b], [c, d]] = diagnostic.gridCellBounds;
    L.rectangle([[a, b], [c, d]], { color: '#22d3ee', weight: 1.5, fillOpacity: 0.12, dashArray: '3 3' }).addTo(layer);
    L.circleMarker([probe.lat, probe.lon], { radius: 6, color: '#ffffff', weight: 2, fillColor: '#22d3ee', fillOpacity: 1 }).addTo(layer);
  }, [diagnostic, probe]);

  const fitAll = () => {
    const map = mapRef.current;
    if (!map || filtered.length === 0) return;
    map.fitBounds(L.latLngBounds(filtered.map((a) => [a.asset.latitude, a.asset.longitude] as [number, number])), { padding: [40, 40], maxZoom: 8 });
  };

  const ctl = 'rounded-xl bg-slate-900/90 backdrop-blur ring-1 ring-white/[0.08] shadow-xl';

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0a0f1c]">
      <div ref={containerRef} className="absolute inset-0 z-10" />

      {/* Toolbars: one wrapping row so the groups never overlap on narrow screens */}
      <div className="absolute inset-x-3 top-3 z-20 flex flex-wrap items-start justify-between gap-1.5 pointer-events-none">
      <div className={cx('flex items-center gap-1.5 p-1.5 pointer-events-auto max-w-full', ctl)}>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find an asset or city"
            aria-label="Search assets on map"
            className={cx('bg-slate-950/70 rounded-lg pl-8 pr-2 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400/60', compact ? 'w-32 sm:w-40' : 'w-36 sm:w-56')}
          />
        </div>
        <select
          value={minRating}
          onChange={(e) => setMinRating(e.target.value as RiskRating | 'All')}
          aria-label="Minimum risk rating"
          className="bg-slate-950/70 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
        >
          <option value="All">All ratings</option>
          {RATING_ORDER.slice(2).map((r) => (
            <option key={r} value={r}>{r}+</option>
          ))}
        </select>
        <button onClick={fitAll} className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/[0.06]" title="Zoom to all assets" aria-label="Zoom to all assets">
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className={cx('flex-wrap items-center gap-1.5 p-1.5 pointer-events-auto', ctl, compact ? 'hidden sm:flex' : 'flex')}>
        {!compact && (
          <div className="flex items-center rounded-lg bg-slate-950/70 p-0.5">
            {(['dark', 'streets', 'satellite', 'osm'] as BasemapStyle[]).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBasemap(b)}
                className={cx('px-2 py-1 rounded-md text-[11px] uppercase tracking-wide', basemap === b ? 'bg-white text-slate-900 font-bold' : 'text-slate-400 hover:text-white')}
              >
                {b === 'osm' ? 'OSM' : b}
              </button>
            ))}
          </div>
        )}
        <select
          value={colorBy}
          onChange={(e) => setColorBy(e.target.value as 'overall' | HazardFamily)}
          aria-label="Colour markers by"
          title="Colour markers by overall risk or by one hazard family"
          className="bg-slate-950/70 rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none"
        >
          <option value="overall">Colour: overall risk</option>
          {HAZARD_FAMILIES.map((f) => <option key={f.id} value={f.id}>Colour: {f.name}</option>)}
        </select>
        {onResolutionChange && (
          <select
            value={currentResolution}
            onChange={(e) => onResolutionChange(e.target.value as SpatialResolution)}
            aria-label="Map grid resolution (point inspector only)"
            title="Grid resolution used by the point inspector and grid overlay. Does not change site scores."
            className="bg-slate-950/70 rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none"
          >
            {(['25km', '10km', '1km', '90m'] as SpatialResolution[]).map((r) => (
              <option key={r} value={r}>Grid {r}</option>
            ))}
          </select>
        )}
        <button
          onClick={() => setShowGrid((v) => !v)}
          className={cx('flex items-center gap-1 px-2 py-1 rounded-lg text-[11px]', showGrid ? 'bg-cyan-400/20 text-cyan-200' : 'text-slate-400 hover:text-white')}
          title={`Show the ${currentResolution} model grid`}
        >
          <Grid className="w-3.5 h-3.5" /> {!compact && 'Grid'}
        </button>
        <div className="flex items-center gap-1 pl-1">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={overlay}
            onChange={(e) => setOverlay(e.target.value as OverlayId)}
            aria-label="Hazard hotspot overlay"
            className="bg-slate-950/70 rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none"
          >
            <option value="none">No overlay</option>
            {(Object.keys(OVERLAYS) as Array<Exclude<OverlayId, 'none'>>).map((k) => (
              <option key={k} value={k}>{OVERLAYS[k].label}</option>
            ))}
          </select>
        </div>
      </div>

      </div>

      {filtered.length === 0 && assessments.length > 0 && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="rounded-xl bg-slate-900/90 ring-1 ring-white/[0.08] px-4 py-3 text-sm text-slate-200 pointer-events-auto">
            No sites match the map filters.{' '}
            <button className="text-cyan-300 hover:text-cyan-200" onClick={() => { setSearch(''); setMinRating('All'); }}>Clear filters</button>
          </div>
        </div>
      )}

      {/* Hint */}
      {!diagnostic && (
        <div className="absolute bottom-14 left-3 z-20 text-xs text-slate-300 hidden sm:flex bg-slate-900/80 rounded-lg px-2.5 py-1.5 ring-1 ring-white/[0.06] pointer-events-none items-center gap-1.5">
          <Crosshair className="w-3.5 h-3.5 text-cyan-300" /> Click anywhere on the map to check that spot
        </div>
      )}
      {gridTooDense && (
        <div className="absolute top-[60px] right-3 z-20 text-[11px] text-slate-300 bg-slate-900/90 rounded-lg px-2.5 py-1.5 ring-1 ring-white/[0.06]">
          Zoom in to see the {currentResolution} grid
        </div>
      )}

      {/* Point inspector */}
      {diagnostic && (
        <div className={cx('absolute z-30 w-[300px] p-4 space-y-3 slide-up', ctl, compact ? 'bottom-3 right-3' : 'top-[60px] right-3')}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">{diagnostic.detectedLocation}</div>
              <div className="text-[11px] text-slate-400 tabular-nums">
                {diagnostic.latitude}°, {diagnostic.longitude}° · {diagnostic.elevationMeters} m · {diagnostic.distanceToOceanKm} km to coast
              </div>
            </div>
            <button onClick={() => setProbe(null)} className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06]" aria-label="Close inspector">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <RatingBadge rating={diagnostic.compositeRating} score={diagnostic.compositePhysicalRiskScore} size="md" />
            <span className="text-[11px] text-slate-400">Köppen {diagnostic.koppenClimateClass}</span>
          </div>
          <div className="space-y-1.5">
            {(Object.values(diagnostic.hazardResults) as Array<(typeof diagnostic.hazardResults)[HazardType]>)
              .filter((h) => h.score > 0)
              .sort((x, y) => y.score - x.score)
              .slice(0, 4)
              .map((h) => (
                <div key={h.hazardId} className="flex items-center gap-2 text-xs">
                  <span className="w-24 text-slate-300 truncate">{HAZARD_CATALOG[h.hazardId].shortName}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${h.score}%`, backgroundColor: RATING_HEX[h.rating] }} />
                  </div>
                  <span className="w-8 text-right tabular-nums text-slate-300">{Math.round(h.score)}</span>
                </div>
              ))}
          </div>
          <div className="text-xs text-slate-400">
            {SPATIAL_RESOLUTIONS[currentResolution].name.split(' (')[0]} · indicative ±{SPATIAL_RESOLUTIONS[currentResolution].uncertaintyBandPercent}%
          </div>
          {onAddAssetAtCoords && (
            <button
              onClick={() => {
                onAddAssetAtCoords(diagnostic.latitude, diagnostic.longitude);
                setProbe(null);
              }}
              className="w-full py-2 rounded-xl bg-cyan-400 text-slate-950 text-xs font-semibold hover:bg-cyan-300 flex items-center justify-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Add a site here
            </button>
          )}
        </div>
      )}

      {/* Legend */}
      <div className={cx('absolute bottom-3 left-3 z-20 px-3 py-2 text-[11px] flex flex-wrap items-center gap-x-3 gap-y-1', ctl)}>
        {RATING_ORDER.map((r) => (
          <span key={r} className="flex items-center gap-1.5 text-slate-300">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: RATING_HEX[r] }} />
            {r}
          </span>
        ))}
        <span className="text-slate-400 border-l border-white/[0.08] pl-3">{colorBy === 'overall' ? 'Overall risk' : HAZARD_FAMILIES.find((f) => f.id === colorBy)!.name}</span>
        <span className="text-slate-500 border-l border-white/[0.08] pl-3 tabular-nums">
          {filtered.length}/{assessments.length} shown
        </span>
      </div>
    </div>
  );
};
