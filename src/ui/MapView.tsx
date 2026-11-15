import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Maximize2, Minimize2 } from 'lucide-react';

export type Pin = { id: string; lat: number; lon: number; color: string; label: string; sub?: string };
export type Theme = 'light' | 'dark' | 'ocean';
export type Layer =
  | 'google_hybrid'
  | 'google_sat'
  | 'google_roads'
  | 'google_terrain'
  | 'street'
  | 'osm'
  | 'satellite'
  | 'dark'
  | 'topo'
  | 'mapbox'
  | 'mapbox_sat';

const mapboxToken = ((import.meta as { env?: Record<string, string> }).env?.VITE_MAPBOX_TOKEN ?? '').trim();

const TILES: Record<string, { url: string; attr: string; subdomains?: string; maxZoom?: number }> = {
  google_hybrid: {
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attr: '&copy; Google Maps & Earth',
    subdomains: '0123',
    maxZoom: 21,
  },
  google_sat: {
    url: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attr: '&copy; Google Earth Imagery',
    subdomains: '0123',
    maxZoom: 21,
  },
  google_roads: {
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    attr: '&copy; Google Maps',
    subdomains: '0123',
    maxZoom: 21,
  },
  google_terrain: {
    url: 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    attr: '&copy; Google Terrain',
    subdomains: '0123',
    maxZoom: 21,
  },
  osm: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  street: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attr: '&copy; CARTO &copy; OpenStreetMap contributors',
    subdomains: 'abcd',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attr: '&copy; CARTO &copy; OpenStreetMap contributors',
    subdomains: 'abcd',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attr: '&copy; OpenTopoMap &copy; OpenStreetMap contributors',
    subdomains: 'abc',
  },
  ...(mapboxToken ? {
    mapbox: {
      url: `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`,
      attr: '&copy; <a href="https://www.mapbox.com/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
    },
    mapbox_sat: {
      url: `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`,
      attr: '&copy; <a href="https://www.mapbox.com/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
    },
  } : {}),
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const MapView: React.FC<{
  pins: Pin[]; selectedId?: string | null; theme: Theme; layer: Layer; height?: number;
  flyTo?: { lat: number; lon: number; zoom?: number; seq: number } | null;
  fitKey?: string; onPick?: (lat: number, lon: number) => void; onSelect?: (id: string) => void;
  overlay?: React.ReactNode; analysisCell?: { lat: number; lon: number } | null;
}> = ({ pins, selectedId, theme, layer, height = 400, flyTo, fitKey, onPick, onSelect, overlay, analysisCell }) => {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tile = useRef<L.TileLayer | null>(null);
  const group = useRef<L.LayerGroup | null>(null);
  const cell = useRef<L.Rectangle | null>(null);
  const cbs = useRef({ onPick, onSelect });
  cbs.current = { onPick, onSelect };
  const [full, setFull] = React.useState(false);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, {
      center: [22.5, 79],
      zoom: 4,
      zoomControl: true,
      worldCopyJump: true,
      attributionControl: true,
    });
    m.on('click', (e: L.LeafletMouseEvent) => cbs.current.onPick?.(e.latlng.lat, ((e.latlng.lng + 540) % 360) - 180));
    group.current = L.layerGroup().addTo(m);
    map.current = m;

    // Immediately trigger size recalculation to prevent blank/grey map bug in flex/grid
    const t1 = setTimeout(() => {
      m.invalidateSize();
    }, 100);
    const t2 = setTimeout(() => {
      m.invalidateSize();
    }, 350);

    const ro = new ResizeObserver(() => {
      if (map.current && el.current?.isConnected) map.current.invalidateSize();
    });
    ro.observe(el.current);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      ro.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const tileKey = (layer && TILES[layer]) ? layer : (theme === 'light' ? 'street' : 'dark');
    const t = TILES[tileKey] || TILES.osm;
    tile.current?.remove();
    const tl = L.tileLayer(t.url, {
      attribution: t.attr,
      maxZoom: t.maxZoom ?? 19,
      subdomains: t.subdomains || 'abc',
    });
    // Fallback to OpenStreetMap if primary tile server is blocked or errors
    tl.on('tileerror', () => {
      if (t !== TILES.osm && tile.current === tl) {
        tl.setUrl(TILES.osm.url);
      }
    });
    tl.addTo(m);
    tile.current = tl;
  }, [theme, layer]);

  useEffect(() => {
    const g = group.current;
    if (!g) return;
    g.clearLayers();
    for (const p of pins) {
      const sel = p.id === selectedId;
      const icon = L.divIcon({ className: '', html: `<div class="cl-pin${sel ? ' sel' : ''}" style="background:${p.color}"></div>`, iconSize: sel ? [20, 20] : [14, 14], iconAnchor: sel ? [10, 10] : [7, 7] });
      L.marker([p.lat, p.lon], { icon, zIndexOffset: sel ? 1000 : 0, title: p.label, keyboard: true })
        .bindTooltip(`<b>${esc(p.label)}</b>${p.sub ? `<br/>${esc(p.sub)}` : ''}`, { direction: 'top', offset: [0, -8] })
        .on('click', () => cbs.current.onSelect?.(p.id))
        .addTo(g);
    }
  }, [pins, selectedId]);

  useEffect(() => {
    const m = map.current;
    if (!m || !pins.length) return;
    const b = L.latLngBounds(pins.map((p) => [p.lat, p.lon] as [number, number]));
    m.fitBounds(b.pad(0.2), { maxZoom: 9, animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  useEffect(() => {
    if (!flyTo || !map.current) return;
    const m = map.current;
    const isVisible = m.getBounds().pad(-0.05).contains([flyTo.lat, flyTo.lon]);
    if (isVisible && (flyTo.zoom === undefined || flyTo.zoom === m.getZoom())) {
      m.panTo([flyTo.lat, flyTo.lon], { animate: true, duration: 0.25 });
    } else {
      m.flyTo([flyTo.lat, flyTo.lon], flyTo.zoom ?? 13, { duration: 0.6 });
    }
  }, [flyTo]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    cell.current?.remove();
    cell.current = null;
    if (analysisCell) {
      const d = 0.0008 * 1.5, dl = d / Math.max(0.2, Math.cos((analysisCell.lat * Math.PI) / 180));
      cell.current = L.rectangle([[analysisCell.lat - d, analysisCell.lon - dl], [analysisCell.lat + d, analysisCell.lon + dl]], { color: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2349e8', weight: 2, dashArray: '5 4', fill: true, fillOpacity: 0.12 }).addTo(m);
    }
  }, [analysisCell]);

  useEffect(() => { setTimeout(() => map.current?.invalidateSize(), 50); }, [full]);

  return (
    <div
      className={full ? 'fixed inset-3 z-[1000] rounded-2xl overflow-hidden border border-line bg-panel shadow-2xl' : 'relative rounded-2xl overflow-hidden border border-line bg-panel shadow-sm w-full'}
      style={{ height: full ? undefined : height, minHeight: full ? undefined : `${height}px` }}
    >
      <div ref={el} className="w-full h-full" style={{ minHeight: full ? '100%' : `${height}px` }} />
      <div className="absolute top-3 left-3 right-14 z-[500] flex flex-wrap gap-2 pointer-events-none [&>*]:pointer-events-auto">{overlay}</div>
      <button
        onClick={() => setFull((f) => !f)}
        aria-label={full ? 'Exit full screen' : 'Full screen map'}
        className="absolute top-3 right-3 z-[500] w-10 h-10 rounded-[10px] border border-line bg-panel text-ink flex items-center justify-center hover:bg-chip shadow-md transition"
      >
        {full ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </button>
    </div>
  );
};
