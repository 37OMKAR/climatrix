import React, { useEffect, useRef, useState } from 'react';
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
  getRatingBadgeBg,
  queryLocationClimateData,
  PointClimateDiagnostic,
  estimateGlobalElevationMeters,
  SPATIAL_RESOLUTIONS,
} from '../services/climateEngine';
import {
  Layers,
  Map as MapIcon,
  Maximize2,
  Filter,
  Eye,
  AlertTriangle,
  Flame,
  Waves,
  Wind,
  Sun,
  ShieldAlert,
  ChevronRight,
  TrendingUp,
  Crosshair,
  Compass,
  PlusCircle,
  X,
  Sparkles,
  Grid,
  Cpu,
} from 'lucide-react';

interface MapExplorerProps {
  assessments: AssetRiskAssessment[];
  selectedAssetId: string | null;
  onSelectAsset: (assetId: string) => void;
  activeHazardFilter: HazardType | 'all';
  onHazardFilterChange: (hazard: HazardType | 'all') => void;
  currentScenario?: SSPScenario;
  currentDecade?: Decade;
  currentReturnPeriod?: ReturnPeriod;
  currentResolution?: SpatialResolution;
  onAddAssetAtCoords?: (lat: number, lon: number) => void;
}

type BasemapStyle = 'dark' | 'satellite' | 'streets';

export const MapExplorer: React.FC<MapExplorerProps> = ({
  assessments,
  selectedAssetId,
  onSelectAsset,
  activeHazardFilter,
  onHazardFilterChange,
  currentScenario = 'ssp245',
  currentDecade = 2050,
  currentReturnPeriod = '100yr',
  currentResolution = '1km',
  onAddAssetAtCoords,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const hazardLayerRef = useRef<L.LayerGroup | null>(null);
  const queryPinLayerRef = useRef<L.LayerGroup | null>(null);
  const gridOverlayLayerRef = useRef<L.LayerGroup | null>(null);

  const [basemap, setBasemap] = useState<BasemapStyle>('dark');
  const [activeHazardLayer, setActiveHazardLayer] = useState<HazardType | 'none'>('coastal_flood');
  const [showGridOverlay, setShowGridOverlay] = useState<boolean>(false);
  const [minRatingFilter, setMinRatingFilter] = useState<RiskRating | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [pointDiagnostic, setPointDiagnostic] = useState<PointClimateDiagnostic | null>(null);

  // Rating color map for marker pins
  const getMarkerColor = (rating: RiskRating): string => {
    switch (rating) {
      case 'Very Low': return '#10b981'; // emerald
      case 'Low': return '#14b8a6';      // teal
      case 'Moderate': return '#f59e0b'; // amber
      case 'High': return '#f97316';     // orange
      case 'Severe': return '#ef4444';   // red
      case 'Catastrophic': return '#e11d48'; // rose
      default: return '#64748b';
    }
  };

  // Filtered assessments based on search and filters
  const filteredAssessments = assessments.filter((a) => {
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const match =
        a.asset.name.toLowerCase().includes(q) ||
        a.asset.city.toLowerCase().includes(q) ||
        a.asset.country.toLowerCase().includes(q) ||
        a.asset.entityName.toLowerCase().includes(q);
      if (!match) return false;
    }

    if (minRatingFilter !== 'All') {
      const ratingHierarchy: Record<RiskRating, number> = {
        'Very Low': 1,
        Low: 2,
        Moderate: 3,
        High: 4,
        Severe: 5,
        Catastrophic: 6,
      };
      if (ratingHierarchy[a.compositeRating] < ratingHierarchy[minRatingFilter]) {
        return false;
      }
    }

    if (activeHazardFilter !== 'all') {
      const hRes = a.hazardResults[activeHazardFilter];
      if (!hRes || hRes.score < 40) return false;
    }

    return true;
  });

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [28.0, 10.0],
        zoom: 3,
        minZoom: 2,
        maxZoom: 18,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Create LayerGroups
      const markersLayer = L.layerGroup().addTo(map);
      const hazardLayer = L.layerGroup().addTo(map);
      const gridOverlayLayer = L.layerGroup().addTo(map);
      const queryPinLayer = L.layerGroup().addTo(map);

      markersLayerRef.current = markersLayer;
      hazardLayerRef.current = hazardLayer;
      gridOverlayLayerRef.current = gridOverlayLayer;
      queryPinLayerRef.current = queryPinLayer;
      mapInstanceRef.current = map;

      // Global Map Click Inspector
      map.on('click', (e: L.LeafletMouseEvent) => {
        // Prevent click if clicking a marker popup
        const target = e.originalEvent.target as HTMLElement;
        if (target && target.closest('.leaflet-popup-content-wrapper')) return;

        const { lat, lng } = e.latlng;
        // Run real-time CMIP6 downscaling for this coordinate
        const diagnostic = queryLocationClimateData(
          lat,
          lng,
          currentScenario,
          currentDecade,
          currentReturnPeriod,
          currentResolution
        );
        setPointDiagnostic(diagnostic);

        // Render crosshair reticle and grid cell highlight box
        queryPinLayer.clearLayers();

        // Draw grid cell polygon
        const [[minLat, minLon], [maxLat, maxLon]] = diagnostic.gridCellBounds;
        const gridBox = L.rectangle([[minLat, minLon], [maxLat, maxLon]], {
          color: '#06b6d4',
          weight: 1.5,
          fillColor: '#06b6d4',
          fillOpacity: 0.15,
          dashArray: '3, 3',
        });
        gridBox.addTo(queryPinLayer);

        const reticleHtml = `
          <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
            <div class="w-8 h-8 rounded-full border-2 border-cyan-400 animate-ping absolute opacity-75"></div>
            <div class="w-6 h-6 rounded-full border-2 border-cyan-300 bg-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/50">
              <div class="w-1.5 h-1.5 rounded-full bg-cyan-100"></div>
            </div>
          </div>
        `;
        const reticleIcon = L.divIcon({
          html: reticleHtml,
          className: 'custom-reticle',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        L.marker([lat, lng], { icon: reticleIcon }).addTo(queryPinLayer);
      });
    }

    return () => {
      // Cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Basemap Tiles
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing tile layers
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    let tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    let attribution = '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap';

    if (basemap === 'satellite') {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attribution = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye';
    } else if (basemap === 'streets') {
      tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
      attribution = '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap';
    }

    L.tileLayer(tileUrl, {
      attribution,
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    // Ensure markers are on top
    if (hazardLayerRef.current) (hazardLayerRef.current as any).bringToFront?.();
    if (markersLayerRef.current) (markersLayerRef.current as any).bringToFront?.();
  }, [basemap]);

  // Update Hazard Overlay Layer (Visual CMIP6 synthetic heat zones)
  useEffect(() => {
    const hazardLayer = hazardLayerRef.current;
    if (!hazardLayer) return;

    hazardLayer.clearLayers();

    if (activeHazardLayer === 'none') return;

    // Render geographic hazard circles / polygons for key global exposure hot zones
    // E.g., Coastal Flood, Cyclone belts, Wildfire belts
    const hotZones: Array<{ lat: number; lng: number; radiusKm: number; color: string; opacity: number; label: string }> = [];

    if (activeHazardLayer === 'coastal_flood') {
      // Coastal sea level rise & surge zones
      hotZones.push(
        { lat: 26.5, lng: -81.0, radiusKm: 280, color: '#0284c7', opacity: 0.28, label: 'Florida Coastal Surge Basin (Cat 5 SLR)' },
        { lat: 29.5, lng: -94.0, radiusKm: 260, color: '#0284c7', opacity: 0.28, label: 'Gulf of Mexico Petrochemical Inundation Zone' },
        { lat: 52.5, lng: 4.5, radiusKm: 220, color: '#0284c7', opacity: 0.32, label: 'North Sea Polder Tidal Delta' },
        { lat: 1.3, lng: 103.8, radiusKm: 140, color: '#0284c7', opacity: 0.25, label: 'Singapore & Malacca Strait Maritime Surge' },
        { lat: 31.2, lng: 121.5, radiusKm: 260, color: '#0284c7', opacity: 0.30, label: 'Yangtze River Delta Lowland Zone' }
      );
    } else if (activeHazardLayer === 'tropical_cyclone') {
      // Major Tropical Cyclone corridors
      hotZones.push(
        { lat: 25.0, lng: -76.0, radiusKm: 650, color: '#9333ea', opacity: 0.24, label: 'Atlantic Major Hurricane Corridor (Cat 4-5)' },
        { lat: 22.0, lng: 125.0, radiusKm: 800, color: '#9333ea', opacity: 0.26, label: 'Western Pacific Super Typhoon Belt' },
        { lat: 18.0, lng: 88.0, radiusKm: 450, color: '#9333ea', opacity: 0.25, label: 'Bay of Bengal Cyclonic Surge Basin' }
      );
    } else if (activeHazardLayer === 'wildfire') {
      // Fire Weather Index hot zones
      hotZones.push(
        { lat: 35.0, lng: -119.0, radiusKm: 380, color: '#ea580c', opacity: 0.30, label: 'California Chaparral High Fire Severity Zone' },
        { lat: -34.0, lng: 145.0, radiusKm: 550, color: '#ea580c', opacity: 0.28, label: 'Southeastern Australia Bushfire Matrix' },
        { lat: 40.0, lng: -4.0, radiusKm: 420, color: '#ea580c', opacity: 0.25, label: 'Iberian Peninsula High FWI Zone' }
      );
    } else if (activeHazardLayer === 'extreme_heat') {
      // Extreme heat belts
      hotZones.push(
        { lat: 33.0, lng: -112.0, radiusKm: 450, color: '#dc2626', opacity: 0.28, label: 'US Southwest Thermal Dome (>45°C Days)' },
        { lat: 25.0, lng: 55.0, radiusKm: 600, color: '#dc2626', opacity: 0.32, label: 'Arabian Gulf Wet-Bulb Physiological Stress Zone' },
        { lat: 28.0, lng: 77.0, radiusKm: 550, color: '#dc2626', opacity: 0.30, label: 'Indo-Gangetic Plain Heatwave Belt' }
      );
    }

    hotZones.forEach((zone) => {
      const circle = L.circle([zone.lat, zone.lng], {
        radius: zone.radiusKm * 1000,
        color: zone.color,
        fillColor: zone.color,
        fillOpacity: zone.opacity,
        weight: 1.5,
        dashArray: '4, 4',
      });
      circle.bindTooltip(
        `<div class="text-xs font-semibold text-slate-100 font-sans">${zone.label}</div>`,
        { sticky: true, className: 'leaflet-dark-tooltip' }
      );
      hazardLayer.addLayer(circle);
    });
  }, [activeHazardLayer]);

  // Update Grid Overlay Layer (CMIP6 / NEX-GDDP spatial resolution grid)
  useEffect(() => {
    const gridLayer = gridOverlayLayerRef.current;
    const map = mapInstanceRef.current;
    if (!gridLayer || !map) return;

    gridLayer.clearLayers();
    if (!showGridOverlay) return;

    const step = currentResolution === '25km' ? 2 : currentResolution === '10km' ? 1 : currentResolution === '1km' ? 0.25 : 0.05;
    const bounds = map.getBounds();
    const minLat = Math.max(-80, Math.floor(bounds.getSouth() / step) * step);
    const maxLat = Math.min(80, Math.ceil(bounds.getNorth() / step) * step);
    const minLng = Math.max(-180, Math.floor(bounds.getWest() / step) * step);
    const maxLng = Math.min(180, Math.ceil(bounds.getEast() / step) * step);

    // Parallels (latitude lines)
    for (let lat = minLat; lat <= maxLat; lat += step) {
      const line = L.polyline([[lat, minLng], [lat, maxLng]], {
        color: '#06b6d4',
        weight: 0.75,
        opacity: 0.35,
        dashArray: '3, 4',
      });
      gridLayer.addLayer(line);
    }

    // Meridians (longitude lines)
    for (let lng = minLng; lng <= maxLng; lng += step) {
      const line = L.polyline([[minLat, lng], [maxLat, lng]], {
        color: '#06b6d4',
        weight: 0.75,
        opacity: 0.35,
        dashArray: '3, 4',
      });
      gridLayer.addLayer(line);
    }
  }, [showGridOverlay, currentResolution]);

  // Update Asset Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    const bounds = L.latLngBounds([]);

    filteredAssessments.forEach((assessment) => {
      const { asset, compositeScore, compositeRating, totalExpectedAnnualLossUsd, primaryHazard, primaryHazardScore } = assessment;
      const color = getMarkerColor(compositeRating);
      const isSelected = selectedAssetId === asset.id;

      const markerHtml = `
        <div class="relative group cursor-pointer" style="transform: translate(-50%, -50%);">
          <div class="w-7 h-7 rounded-full flex items-center justify-center shadow-lg border-2 transition-transform duration-200 ${
            isSelected ? 'scale-125 ring-4 ring-cyan-400' : 'hover:scale-110'
          }" style="background-color: ${color}22; border-color: ${color};">
            <div class="w-3.5 h-3.5 rounded-full" style="background-color: ${color}; box-shadow: 0 0 10px ${color};"></div>
          </div>
          ${
            compositeScore >= 75
              ? `<span class="absolute -top-1 -right-1 flex h-3 w-3">
                   <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style="background-color: ${color};"></span>
                   <span class="relative inline-flex rounded-full h-3 w-3" style="background-color: ${color};"></span>
                 </span>`
              : ''
          }
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-asset-marker',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([asset.latitude, asset.longitude], { icon: customIcon });

      // Build Rich Institutional Popup
      const primaryMeta = HAZARD_CATALOG[primaryHazard];
      const primaryRes = assessment.hazardResults[primaryHazard];
      const effectiveElev = asset.elevationMeters !== undefined
        ? asset.elevationMeters
        : estimateGlobalElevationMeters(asset.latitude, asset.longitude);

      const popupHtml = `
        <div class="p-4 w-72 text-slate-100 font-sans">
          <div class="flex items-center justify-between gap-2 mb-1.5">
            <span class="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              ${asset.category}
            </span>
            <span class="text-[10px] px-2 py-0.5 rounded font-bold uppercase ${getRatingBadgeBg(compositeRating)} text-slate-950 font-mono">
              ${compositeRating} (${compositeScore})
            </span>
          </div>

          <h3 class="text-sm font-bold text-white line-clamp-1 mb-0.5">
            ${asset.name}
          </h3>
          <div class="text-xs text-slate-400 mb-2.5 flex items-center gap-1">
            <span>${asset.city}, ${asset.country}</span>
            <span>•</span>
            <span class="font-mono">${effectiveElev}m elev</span>
          </div>

          <div class="grid grid-cols-2 gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 mb-2.5 text-xs font-mono">
            <div>
              <div class="text-[10px] text-slate-400 font-sans">Asset Value</div>
              <div class="font-bold text-slate-200">${formatCurrencyUsd(asset.replacementValueUsd)}</div>
            </div>
            <div>
              <div class="text-[10px] text-slate-400 font-sans">Expected Annual Loss</div>
              <div class="font-bold text-red-400">${formatCurrencyUsd(totalExpectedAnnualLossUsd)}</div>
            </div>
          </div>

          <div class="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 mb-3 text-xs">
            <div class="flex items-center justify-between text-[11px] mb-1">
              <span class="text-slate-300 font-medium">Primary Threat:</span>
              <span class="font-bold text-amber-400">${primaryMeta.name}</span>
            </div>
            <div class="flex items-center justify-between text-[11px] font-mono">
              <span class="text-slate-400">Absolute Intensity:</span>
              <span class="text-cyan-300 font-semibold">${primaryRes ? primaryRes.absoluteValue : '-'} ${primaryMeta.unit}</span>
            </div>
          </div>

          <button
            id="popup-btn-${asset.id}"
            class="w-full py-1.5 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-md shadow-cyan-600/30 cursor-pointer"
          >
            <span>Analyze Full 12-Hazard Profile</span>
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 320 });

      marker.on('popupopen', () => {
        const btn = document.getElementById(`popup-btn-${asset.id}`);
        if (btn) {
          btn.onclick = () => {
            onSelectAsset(asset.id);
          };
        }
      });

      marker.on('click', () => {
        onSelectAsset(asset.id);
      });

      markersLayer.addLayer(marker);
      bounds.extend([asset.latitude, asset.longitude]);
    });

    // Fit map bounds if there are markers and no specific asset was clicked
    if (filteredAssessments.length > 0 && !selectedAssetId) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 });
    }
  }, [filteredAssessments, selectedAssetId]);

  // Center on selected asset
  useEffect(() => {
    if (!selectedAssetId || !mapInstanceRef.current) return;
    const item = assessments.find((a) => a.asset.id === selectedAssetId);
    if (item) {
      mapInstanceRef.current.setView([item.asset.latitude, item.asset.longitude], 8, {
        animate: true,
      });
    }
  }, [selectedAssetId, assessments]);

  const fitPortfolio = () => {
    if (!mapInstanceRef.current || filteredAssessments.length === 0) return;
    const bounds = L.latLngBounds(filteredAssessments.map((a) => [a.asset.latitude, a.asset.longitude]));
    mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
  };

  return (
    <div className="relative w-full h-full min-h-[460px] bg-slate-950 overflow-hidden flex flex-col">
      {/* Map Header Floating Overlay */}
      <div className="absolute top-3 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Search & Filter Box */}
        <div className="flex items-center gap-2 pointer-events-auto bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/80 shadow-2xl">
          <div className="relative">
            <input
              type="text"
              placeholder="Search assets, cities, parents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 sm:w-64 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
            />
          </div>

          {/* Rating Filter */}
          <div className="flex items-center gap-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1" />
            <select
              value={minRatingFilter}
              onChange={(e) => setMinRatingFilter(e.target.value as any)}
              aria-label="Filter assets by minimum risk rating"
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-sans"
            >
              <option value="All">Min Risk: All</option>
              <option value="Moderate">Min: Moderate+</option>
              <option value="High">Min: High+</option>
              <option value="Severe">Min: Severe+</option>
              <option value="Catastrophic">Min: Catastrophic</option>
            </select>
          </div>

          {/* Fit Bounds Button */}
          <button
            onClick={fitPortfolio}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Recenter Portfolio Extents"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Map Layers & Basemap Controls */}
        <div className="flex items-center gap-2 pointer-events-auto bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/80 shadow-2xl">
          {/* Basemap Switcher */}
          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setBasemap('dark')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                basemap === 'dark' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Dark Matter
            </button>
            <button
              onClick={() => setBasemap('satellite')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                basemap === 'satellite' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Satellite
            </button>
            <button
              onClick={() => setBasemap('streets')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                basemap === 'streets' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Streets
            </button>
          </div>

          {/* Grid Mesh Toggle */}
          <button
            onClick={() => setShowGridOverlay(!showGridOverlay)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition border ${
              showGridOverlay
                ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/60 shadow-sm'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Toggle Spatial Resolution Grid Mesh Overlay"
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Grid ({currentResolution})</span>
          </button>

          {/* Hazard Layer Overlay Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-slate-300 pl-1 border-l border-slate-800">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <select
              value={activeHazardLayer}
              onChange={(e) => setActiveHazardLayer(e.target.value as any)}
              aria-label="Select climate hazard GIS layer overlay"
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-sans"
            >
              <option value="none">No Hazard Overlay</option>
              <option value="coastal_flood">Layer: Coastal & River Surge</option>
              <option value="tropical_cyclone">Layer: Tropical Cyclone Tracks</option>
              <option value="wildfire">Layer: Wildfire Fire Weather Index</option>
              <option value="extreme_heat">Layer: Extreme Heat Dome (&gt;45°C)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Floating Global CMIP6 Coordinate Inspector */}
      {pointDiagnostic && (
        <div className="absolute top-16 right-4 z-30 pointer-events-auto w-84 sm:w-96 bg-slate-900/95 backdrop-blur-md border border-cyan-500/40 rounded-2xl p-4 shadow-2xl text-slate-100 animate-in fade-in slide-in-from-right-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-white font-mono">Spatial Downscaled Inspector</span>
            </div>
            <button
              onClick={() => {
                setPointDiagnostic(null);
                queryPinLayerRef.current?.clearLayers();
              }}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <div className="text-[12px] font-bold text-white">
              {pointDiagnostic.detectedLocation}
            </div>
            <div className="text-[11px] font-mono text-cyan-300 font-semibold mt-0.5">
              {pointDiagnostic.latitude}° Lat, {pointDiagnostic.longitude}° Lon
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center justify-between">
              <span>Cell: [{pointDiagnostic.gridCellCenter[0]}°, {pointDiagnostic.gridCellCenter[1]}°]</span>
              <span className="text-emerald-400 font-bold">{currentResolution} downscaled</span>
            </div>
          </div>

          {/* Spatial Downscaling & Uncertainty Details */}
          <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-[10px] font-mono space-y-1">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Resolution Engine:</span>
              <span className="text-cyan-400 font-bold">{SPATIAL_RESOLUTIONS[currentResolution]?.name.split(' (')[0]}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Provider & Network:</span>
              <span className="text-slate-200 truncate max-w-[200px]" title={SPATIAL_RESOLUTIONS[currentResolution]?.provider}>
                {SPATIAL_RESOLUTIONS[currentResolution]?.provider}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <span className="text-slate-400">Uncertainty Confidence (90% CI):</span>
              <span className="text-emerald-400 font-bold">±{SPATIAL_RESOLUTIONS[currentResolution]?.uncertaintyBandPercent}%</span>
            </div>
          </div>

          {/* Topographic Elevation & Coastal Proximity */}
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-950 p-2 rounded-xl border border-slate-800">
            <div>
              <span className="text-[10px] text-slate-400 block font-sans">Elevation (DEM):</span>
              <span className="text-emerald-400 font-bold">{pointDiagnostic.elevationMeters}m elev</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-sans">Ocean Distance:</span>
              <span className="text-cyan-300 font-bold">{pointDiagnostic.distanceToOceanKm} km</span>
            </div>
          </div>

          {/* Climate Classification */}
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-400">Köppen Climate Zone:</span>
              <span className="text-amber-400 font-bold">{pointDiagnostic.koppenClimateClass}</span>
            </div>
            <div className="text-[10px] text-slate-300 mt-0.5 font-sans leading-tight">
              {pointDiagnostic.koppenDescription}
            </div>
            <div className="text-[10px] text-cyan-400 mt-1 font-mono truncate" title={pointDiagnostic.physiographicRegion}>
              Region: {pointDiagnostic.physiographicRegion}
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-1 pt-1 border-t border-slate-800">
              <span>CMIP6 Model Consensus:</span>
              <span className="text-emerald-400 font-bold">{pointDiagnostic.modelEnsembleConsensusPercent}%</span>
            </div>
          </div>

          {/* Composite Score & Top Hazard */}
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-400 font-sans">Physical Risk</span>
              <div className="text-base font-black text-white mt-0.5">
                {pointDiagnostic.compositePhysicalRiskScore} / 100
              </div>
              <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${getRatingBadgeBg(pointDiagnostic.compositeRating)} text-slate-950 mt-0.5 inline-block`}>
                {pointDiagnostic.compositeRating}
              </span>
            </div>

            <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-400 font-sans">Primary Threat</span>
              <div className="text-xs font-bold text-amber-300 mt-1 truncate" title={HAZARD_CATALOG[pointDiagnostic.primaryRiskHazard]?.name}>
                {HAZARD_CATALOG[pointDiagnostic.primaryRiskHazard]?.shortName}
              </div>
              <span className="text-[10px] text-cyan-300">
                {pointDiagnostic.hazardResults[pointDiagnostic.primaryRiskHazard]?.absoluteValue} {HAZARD_CATALOG[pointDiagnostic.primaryRiskHazard]?.unit}
              </span>
            </div>
          </div>

          {/* Quick Action to Add Asset at this Coordinate */}
          {onAddAssetAtCoords && (
            <button
              onClick={() => {
                onAddAssetAtCoords(pointDiagnostic.latitude, pointDiagnostic.longitude);
                setPointDiagnostic(null);
                queryPinLayerRef.current?.clearLayers();
              }}
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-600/30 transition cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Model New Asset at Coordinates</span>
            </button>
          )}
        </div>
      )}

      {/* Map Footer Bar: Legend & Visible Assets Tally */}
      <div className="absolute bottom-4 left-4 z-20 pointer-events-auto bg-slate-900/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-800 text-xs shadow-2xl flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-300 flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
            Risk Rating:
          </span>
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Very Low
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span> Low
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Moderate
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span> High
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Severe
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse"></span> Catastrophic
            </span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 border-l border-slate-800 pl-3 text-slate-400 font-mono text-[11px]">
          <span>Displaying: <strong className="text-white">{filteredAssessments.length}</strong> / {assessments.length} assets</span>
        </div>
      </div>
    </div>
  );
};
