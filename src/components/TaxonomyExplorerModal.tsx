import React, { useEffect, useState } from 'react';
import {
  HAZARD_FAMILIES,
  HAZARD_TAXONOMY,
  ASSET_TAXONOMY_GROUPS,
  HAZARD_CATALOG,
  ALL_HAZARDS,
  getAssetVulnerabilityWeights,
} from '../services/climateEngine';
import { AssetCategory, HazardType } from '../types/climate';
import {
  BookOpen,
  Search,
  Filter,
  X,
  ShieldCheck,
  PlusCircle,
  Layers,
  ChevronRight,
} from 'lucide-react';

interface TaxonomyExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTypeForNewAsset?: (assetType: string, category: AssetCategory) => void;
}

export const TaxonomyExplorerModal: React.FC<TaxonomyExplorerModalProps> = ({
  isOpen,
  onClose,
  onSelectTypeForNewAsset,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeAssetType, setActiveAssetType] = useState<string>(
    'Semiconductor Fabrication Plant (Fab 300mm/200mm)'
  );

  useEffect(() => {
    if (!isOpen) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories = Object.keys(ASSET_TAXONOMY_GROUPS);

  // Flattened entries
  const allEntries: Array<{ type: string; category: AssetCategory }> = [];
  categories.forEach((cat) => {
    ASSET_TAXONOMY_GROUPS[cat].forEach((t) => {
      allEntries.push({ type: t, category: cat as AssetCategory });
    });
  });

  const filteredEntries = allEntries.filter((item) => {
    if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return (
        item.type.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const currentWeights = getAssetVulnerabilityWeights(activeAssetType);
  const activeCategory = allEntries.find((e) => e.type === activeAssetType)?.category || 'High-Tech & Semiconductor';

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-6xl bg-slate-900 border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 text-slate-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.02] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-950 border border-purple-800 flex items-center justify-center text-purple-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Asset types & damage profiles</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800">
                  {allEntries.length} Types
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Calibrated physical damage curves, operational downtime rates, and engineering adaptation functions
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

        {/* Filter Controls Bar */}
        <div className="p-3 border-b border-white/[0.06] bg-white/[0.03] flex flex-wrap items-center justify-between gap-3">
          {/* Category Dropdown */}
          <div className="flex items-center gap-2 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-900/70 border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-sans"
            >
              <option value="All">All Verticals ({allEntries.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c} ({ASSET_TAXONOMY_GROUPS[c].length})
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search taxonomy type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-900/70 border border-white/[0.06] rounded-lg text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-500 w-64"
            />
          </div>
        </div>

        {/* Main Content: Left List (5 Cols), Right Dossier (7 Cols) */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-white/[0.04]">
          {/* Left: Scrollable List of Asset Taxonomy Types */}
          <div className="lg:col-span-5 p-4 space-y-1.5 overflow-y-auto max-h-[560px]">
            {filteredEntries.map((item) => {
              const isSelected = activeAssetType === item.type;
              return (
                <button
                  key={item.type}
                  onClick={() => setActiveAssetType(item.type)}
                  className={`w-full p-2.5 rounded-xl text-left transition flex items-center justify-between border ${
                    isSelected
                      ? 'bg-slate-800 border-cyan-500 shadow-md shadow-cyan-500/10'
                      : 'bg-white/[0.03] border-white/[0.06] hover:border-white/[0.08] hover:bg-slate-900'
                  }`}
                >
                  <div className="pr-2">
                    <div className="text-xs font-bold text-white line-clamp-1">{item.type}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{item.category}</div>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-cyan-400' : 'text-slate-600'}`} />
                </button>
              );
            })}
          </div>

          {/* Right: Detailed Vulnerability & Impact Functions */}
          <div className="lg:col-span-7 p-6 space-y-6 overflow-y-auto max-h-[560px] bg-slate-950/40">
            {/* Top Overview */}
            <div className="border-b border-white/[0.06] pb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[11px] text-cyan-400">
                  {activeCategory}
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">{activeAssetType}</h3>
              </div>

              {onSelectTypeForNewAsset && (
                <button
                  onClick={() => {
                    onSelectTypeForNewAsset(activeAssetType, activeCategory);
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-medium transition cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Add a site of this type</span>
                </button>
              )}
            </div>

            {/* Financial Parameters */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/70 border border-white/[0.06]">
                <span className="text-slate-400 font-sans text-[11px]">Design Lifespan</span>
                <div className="text-base font-semibold text-white mt-1">30–50 Years</div>
                <span className="text-[11px] text-slate-500">Asset replacement cycle</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/70 border border-white/[0.06]">
                <span className="text-slate-400 font-sans text-[11px]">Daily Downtime Burn</span>
                <div className="text-base font-semibold text-amber-400 mt-1">0.12% / Day</div>
                <span className="text-[11px] text-slate-500">Of replacement value</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/70 border border-white/[0.06]">
                <span className="text-slate-400 font-sans text-[11px]">Damage Function</span>
                <div className="text-base font-semibold text-cyan-300 mt-1">Sigmoid S-Curve</div>
                <span className="text-[11px] text-slate-500">Calibrated threshold</span>
              </div>
            </div>

            {/* 12 Climate Hazards Vulnerability Factor Matrix */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  <span>Hazard Vulnerability Sensitivity Multipliers</span>
                </h4>
                <span className="text-[11px] text-slate-500">1.0 = Baseline average</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ALL_HAZARDS.map((hId: HazardType) => {
                  const weight = currentWeights[hId] ?? 1.0;
                  const meta = HAZARD_CATALOG[hId];
                  const isHighSensitivity = weight >= 1.7;

                  return (
                    <div
                      key={hId}
                      className="p-2.5 rounded-xl border flex items-center justify-between text-xs bg-white/[0.02] border-white/[0.06]"
                    >
                      <div className="flex items-center gap-1.5 truncate pr-1">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: HAZARD_FAMILIES.find((f) => f.id === HAZARD_TAXONOMY[hId].family)!.color }} />
                        <span className="truncate font-sans font-semibold text-slate-200">{meta.shortName}</span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-xs tabular-nums bg-white/[0.06] ${isHighSensitivity ? 'text-white font-semibold' : weight > 1.0 ? 'text-slate-200' : 'text-slate-400'}`} title="Vulnerability multiplier vs a standard building">
                        {weight.toFixed(1)}x
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Standard Resilience Recommendations */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-white/[0.06] space-y-2">
              <div className="font-bold text-white text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Primary Engineering Defense Countermeasures</span>
              </div>
              <ul className="text-xs text-slate-300 space-y-1 font-sans">
                <li>• Relocation of critical electrical switchgear and chillers to +3m elevation datum.</li>
                <li>• Structural reinforcement for 1-in-250 year wind gust and seismic-subsidence shear.</li>
                <li>• Deployable flood barrier bulkheads and dual-redundant backup power generation.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/[0.06] bg-white/[0.03] flex items-center justify-between text-xs text-slate-400">
          <span>Multipliers above 1.0× mean more vulnerable than a standard building.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-sans font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
