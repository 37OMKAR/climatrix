import React, { useState, useEffect } from 'react';
import { Asset, AssetCategory } from '../types/climate';
import {
  ASSET_TAXONOMY_GROUPS,
  estimateGlobalElevationMeters,
  getDistanceToOceanKm,
  reverseGeocodeLocation,
} from '../services/climateEngine';
import { PlusCircle, MapPin, Building, DollarSign, X, Check, Compass, Mountain, Waves } from 'lucide-react';

interface AddAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddAsset: (asset: Asset) => void;
  initialCoordinates?: { lat: number; lon: number } | null;
}

const CITY_PRESETS = [
  { city: 'Miami', country: 'United States', lat: 25.7617, lon: -80.1918, elev: 2.1 },
  { city: 'New York', country: 'United States', lat: 40.7128, lon: -74.0060, elev: 10.0 },
  { city: 'Houston', country: 'United States', lat: 29.7604, lon: -95.3698, elev: 15.0 },
  { city: 'Denver', country: 'United States', lat: 39.7392, lon: -104.9903, elev: 1610.0 },
  { city: 'Albuquerque', country: 'United States', lat: 35.0844, lon: -106.6504, elev: 1615.0 },
  { city: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503, elev: 40.0 },
  { city: 'Singapore', country: 'Singapore', lat: 1.3521, lon: 103.8198, elev: 15.0 },
  { city: 'London', country: 'United Kingdom', lat: 51.5074, lon: -0.1278, elev: 11.0 },
  { city: 'Rotterdam', country: 'Netherlands', lat: 51.9244, lon: 4.4777, elev: -1.0 },
  { city: 'Madrid', country: 'Spain', lat: 40.4168, lon: -3.7038, elev: 660.0 },
];

export const AddAssetModal: React.FC<AddAssetModalProps> = ({
  isOpen,
  onClose,
  onAddAsset,
  initialCoordinates,
}) => {
  const [name, setName] = useState('');
  const [entityName, setEntityName] = useState('Global Enterprise Corp');
  const [parentEntity, setParentEntity] = useState('Global Holdings PLC');
  const [category, setCategory] = useState<AssetCategory>('Commercial Real Estate');
  const [assetType, setAssetType] = useState('Mid-Rise Commercial Office Park');
  const [latitude, setLatitude] = useState('34.6775');
  const [longitude, setLongitude] = useState('-105.9282');
  const [city, setCity] = useState('Torrance County / Estancia Basin');
  const [country, setCountry] = useState('United States');
  const [elevationMeters, setElevationMeters] = useState('1850');
  const [replacementValueUsd, setReplacementValueUsd] = useState('150000000');
  const [yearBuilt, setYearBuilt] = useState('2021');

  // Parse current coordinates
  const latNum = parseFloat(latitude) || 0;
  const lonNum = parseFloat(longitude) || 0;
  const estimatedElev = estimateGlobalElevationMeters(latNum, lonNum);
  const distanceToOcean = getDistanceToOceanKm(latNum, lonNum);
  const geoDetails = reverseGeocodeLocation(latNum, lonNum);

  useEffect(() => {
    if (initialCoordinates) {
      const lat = initialCoordinates.lat;
      const lon = initialCoordinates.lon;
      setLatitude(lat.toFixed(4));
      setLongitude(lon.toFixed(4));
      const autoElev = estimateGlobalElevationMeters(lat, lon);
      setElevationMeters(autoElev.toString());
      const geo = reverseGeocodeLocation(lat, lon);
      setCity(geo.city);
      setCountry(geo.country);
      if (!name || name.startsWith('Site (')) {
        setName(`${geo.city} ${assetType}`);
      }
    }
  }, [initialCoordinates]);

  if (!isOpen) return null;

  const handleSelectPreset = (p: typeof CITY_PRESETS[0]) => {
    setCity(p.city);
    setCountry(p.country);
    setLatitude(p.lat.toString());
    setLongitude(p.lon.toString());
    setElevationMeters(p.elev.toString());
    setName(`${p.city} ${assetType}`);
  };

  const handleAutoDetectGeography = () => {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    if (!isNaN(lat) && !isNaN(lon)) {
      const autoElev = estimateGlobalElevationMeters(lat, lon);
      setElevationMeters(autoElev.toString());
      const geo = reverseGeocodeLocation(lat, lon);
      setCity(geo.city);
      setCountry(geo.country);
      if (!name || name.includes('Site (')) {
        setName(`${geo.city} ${assetType}`);
      }
    }
  };

  const handleCategoryChange = (newCat: AssetCategory) => {
    setCategory(newCat);
    const types = ASSET_TAXONOMY_GROUPS[newCat];
    if (types && types.length > 0) {
      setAssetType(types[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const val = parseFloat(replacementValueUsd);
    const elev = parseFloat(elevationMeters);
    const yr = parseInt(yearBuilt, 10);

    if (isNaN(lat) || isNaN(lon) || isNaN(val)) {
      alert('Please enter valid numeric coordinates and replacement value.');
      return;
    }

    const newAsset: Asset = {
      id: `manual-asset-${Date.now()}`,
      name: name.trim() || `${city} ${assetType}`,
      entityName: entityName.trim() || 'Custom Entity',
      parentEntity: parentEntity.trim() || 'Parent Holding Co',
      assetType,
      category,
      latitude: lat,
      longitude: lon,
      city,
      country,
      elevationMeters: isNaN(elev) ? 20 : elev,
      replacementValueUsd: isNaN(val) ? 100000000 : val,
      yearBuilt: isNaN(yr) ? 2020 : yr,
      criticalityTier: 1,
    };

    onAddAsset(newAsset);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 text-slate-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Add Custom Asset to Physical Risk Model
              </h2>
              <p className="text-xs text-slate-400">
                Input geographic location and choose from &gt;250 asset taxonomy classifications
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs font-sans">
          {/* Quick Preset Location Selector */}
          <div>
            <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1.5">
              Quick Geographic Presets:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {CITY_PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.city}
                  onClick={() => handleSelectPreset(p)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition border ${
                    city === p.city
                      ? 'bg-cyan-600 text-white border-cyan-400'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {p.city}
                </button>
              ))}
            </div>
          </div>

          {/* Asset Name & Parent */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Asset Name</label>
              <input
                type="text"
                required
                placeholder="e.g. South Bay AI Compute Cluster"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Corporate Parent Entity</label>
              <input
                type="text"
                placeholder="e.g. Apex Global Infrastructure"
                value={parentEntity}
                onChange={(e) => setParentEntity(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Category & Asset Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Asset Category</label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value as AssetCategory)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-sans"
              >
                {Object.keys(ASSET_TAXONOMY_GROUPS).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Specific Asset Taxonomy Type</label>
              <select
                value={assetType}
                onChange={(e) => setAssetType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-sans"
              >
                {(ASSET_TAXONOMY_GROUPS[category] || []).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Geographic Coordinates & Elevation */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Latitude</label>
              <input
                type="number"
                step="any"
                required
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Longitude</label>
              <input
                type="number"
                step="any"
                required
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Elevation (m)</label>
              <input
                type="number"
                step="any"
                value={elevationMeters}
                onChange={(e) => setElevationMeters(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Year Built</label>
              <input
                type="number"
                value={yearBuilt}
                onChange={(e) => setYearBuilt(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Topographic Elevation & Coastline Distance Scientific Indicator */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-slate-300">
                <Mountain className="w-4 h-4 text-emerald-400" />
                <span>USGS DEM Topo: <strong className="text-white font-mono">{estimatedElev}m</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <Waves className="w-4 h-4 text-cyan-400" />
                <span>Ocean Distance: <strong className="text-white font-mono">{distanceToOcean} km</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 hidden sm:inline">{geoDetails.region}</span>
              <button
                type="button"
                onClick={handleAutoDetectGeography}
                className="px-2.5 py-1 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-300 hover:bg-cyan-900 transition text-[11px] font-mono cursor-pointer"
              >
                Sync DEM Elevation
              </button>
            </div>
          </div>

          {/* Replacement Value & Location Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Replacement Value ($ USD)</label>
              <input
                type="number"
                required
                step="100000"
                value={replacementValueUsd}
                onChange={(e) => setReplacementValueUsd(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Country</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Assess Asset Risk</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

