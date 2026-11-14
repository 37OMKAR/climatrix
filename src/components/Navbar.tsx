import React, { useState } from 'react';
import {
  Globe2,
  Sliders,
  Calendar,
  Layers,
  Upload,
  PlusCircle,
  FileSpreadsheet,
  Download,
  Building2,
  Landmark,
  GitCompare,
  BarChart3,
  MapPin,
  ChevronDown,
  Info,
  BookOpen,
  LayoutDashboard,
  Cpu,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { Decade, ReturnPeriod, SpatialResolution, SSPScenario } from '../types/climate';
import { SSP_SCENARIOS, SPATIAL_RESOLUTIONS } from '../services/climateEngine';
import { SAMPLE_PORTFOLIOS } from '../services/sampleData';

interface NavbarProps {
  currentScenario: SSPScenario;
  onScenarioChange: (scenario: SSPScenario) => void;
  currentDecade: Decade;
  onDecadeChange: (decade: Decade) => void;
  currentReturnPeriod: ReturnPeriod;
  onReturnPeriodChange: (rp: ReturnPeriod) => void;
  currentResolution?: SpatialResolution;
  onResolutionChange?: (resolution: SpatialResolution) => void;
  activePortfolioId?: string;
  activeTab: 'dashboard' | 'map' | 'sovereigns' | 'corporate';
  onTabChange: (tab: 'dashboard' | 'map' | 'sovereigns' | 'corporate') => void;
  onOpenUpload: () => void;
  onOpenAddAsset: () => void;
  onOpenTaxonomy?: () => void;
  onOpenReport: () => void;
  onOpenCompare: () => void;
  onLoadSamplePortfolio: (portfolioId: string) => void;
  onExportCsv: () => void;
  totalAssets: number;
}

const DECADES: Decade[] = [2025, 2030, 2040, 2050, 2060, 2070, 2080, 2090];
const RETURN_PERIODS: { id: ReturnPeriod; label: string; tooltip: string }[] = [
  { id: 'aal', label: 'AAL', tooltip: 'Average Annual Loss (Expected annual severity)' },
  { id: '10yr', label: '10-Yr', tooltip: '1-in-10 Year Event (10% Annual Exceedance Probability)' },
  { id: '50yr', label: '50-Yr', tooltip: '1-in-50 Year Event (2% Annual Exceedance Probability)' },
  { id: '100yr', label: '100-Yr', tooltip: '1-in-100 Year Event (1% Annual Exceedance Probability)' },
  { id: '250yr', label: '250-Yr', tooltip: '1-in-250 Year Event (0.4% Annual Exceedance Probability)' },
  { id: '500yr', label: '500-Yr', tooltip: '1-in-500 Year Event (0.2% Tail Risk)' },
];

export const Navbar: React.FC<NavbarProps> = ({
  currentScenario,
  onScenarioChange,
  currentDecade,
  onDecadeChange,
  currentReturnPeriod,
  onReturnPeriodChange,
  currentResolution = '1km',
  onResolutionChange,
  activePortfolioId = 'global-flagship',
  activeTab,
  onTabChange,
  onOpenUpload,
  onOpenAddAsset,
  onOpenTaxonomy,
  onOpenReport,
  onOpenCompare,
  onLoadSamplePortfolio,
  onExportCsv,
  totalAssets,
}) => {
  const [sampleMenuOpen, setSampleMenuOpen] = useState(false);
  const activePortfolio = SAMPLE_PORTFOLIOS.find((p) => p.id === activePortfolioId) || SAMPLE_PORTFOLIOS[0];

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-xl">
      {/* Top Banner: Brand, Navigation Tabs, Portfolio Switcher, and Quick Actions */}
      <div className="max-w-[1780px] mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 shadow-lg shadow-cyan-500/20 border border-cyan-400/30">
            <Globe2 className="w-6 h-6 text-white animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tight text-white flex items-center gap-1.5 font-mono">
                CLIMA<span className="text-cyan-400">RISK</span> <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-sans font-semibold">AI v4.9</span>
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-medium hidden sm:inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                CMIP6 AR6 & HighResMIP
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-none mt-0.5 hidden md:block">
              Absolute Physical Climate Risk Analytics • 12 Hazards • 9M+ Asset Locations • TCFD / CSRD / SEC
            </p>
          </div>
        </div>

        {/* Center: Module View Tabs */}
        <nav className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800/80">
          <button
            onClick={() => onTabChange('dashboard')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'dashboard'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Terminal Dashboard</span>
          </button>

          <button
            onClick={() => onTabChange('map')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'map'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Full Map ({totalAssets})</span>
          </button>

          <button
            onClick={() => onTabChange('sovereigns')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'sovereigns'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Landmark className="w-3.5 h-3.5" />
            <span>Sovereigns (200+)</span>
          </button>

          <button
            onClick={() => onTabChange('corporate')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'corporate'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>850k Entities</span>
          </button>
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Active Institutional Portfolio Dropdown */}
          <div className="relative">
            <button
              onClick={() => setSampleMenuOpen(!sampleMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition"
              title="Switch Active Institutional Portfolio"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
              <div className="text-left hidden sm:block">
                <span className="font-semibold text-white truncate max-w-[150px] inline-block">{activePortfolio?.name || 'Portfolio'}</span>
              </div>
              <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800">
                {activePortfolio?.totalCapitalUsd || `${totalAssets} assets`}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {sampleMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-96 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95"
                onMouseLeave={() => setSampleMenuOpen(false)}
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 px-3 py-1.5 uppercase tracking-wider border-b border-slate-800 mb-1">
                  <span>5 Institutional Portfolios ($338B+)</span>
                  <span className="text-cyan-400 font-mono">54 Real Facilities</span>
                </div>
                {SAMPLE_PORTFOLIOS.map((p) => {
                  const isCurrent = activePortfolioId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        onLoadSamplePortfolio(p.id);
                        setSampleMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg transition group ${
                        isCurrent ? 'bg-cyan-950/60 border border-cyan-800/60' : 'hover:bg-slate-800'
                      }`}
                    >
                      <div className="text-xs font-semibold text-slate-100 group-hover:text-cyan-400 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                          {p.name}
                        </span>
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="text-emerald-400 text-[11px] font-bold">{p.totalCapitalUsd}</span>
                          <span className="text-[10px] text-slate-400">({p.assetCount})</span>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                        {p.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upload Button */}
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/30 transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Upload CSV</span>
          </button>

          {/* Add Single Asset Button */}
          <button
            onClick={onOpenAddAsset}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="Add Single Facility with Auto DEM Elevation"
          >
            <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">Add Asset</span>
          </button>

          {/* Scenario Compare Button */}
          <button
            onClick={onOpenCompare}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="Side-by-side SSP Scenario Modeling"
          >
            <GitCompare className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden lg:inline">Compare Scenarios</span>
          </button>

          {/* Taxonomy Catalog Button */}
          {onOpenTaxonomy && (
            <button
              onClick={onOpenTaxonomy}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Explore >250 Asset Taxonomy Classifications & Damage Functions"
            >
              <BookOpen className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden xl:inline">&gt;250 Taxonomy</span>
            </button>
          )}

          {/* TCFD / CSRD / SEC Report Button */}
          <button
            onClick={onOpenReport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-600/20 transition cursor-pointer"
            title="Generate Universal TCFD / CSRD / SEC Regulatory Disclosure Dossier"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Regulatory Dossier</span>
          </button>
        </div>
      </div>

      {/* Climate Parameters Bar: Scenario, Spatial Downscaling Resolution, Decade, Return Period */}
      <div className="bg-slate-950/90 border-t border-slate-800/80 px-4 sm:px-6 py-2">
        <div className="max-w-[1780px] mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* SSP Scenario Selector (with NGFS Phase IV crosswalk) */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>SSP Scenario:</span>
            </span>
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
              {(Object.keys(SSP_SCENARIOS) as SSPScenario[]).map((scKey) => {
                const sc = SSP_SCENARIOS[scKey];
                const isSelected = currentScenario === scKey;
                return (
                  <button
                    key={scKey}
                    onClick={() => onScenarioChange(scKey)}
                    title={`${sc.name} (${sc.co2Trajectory}) • NGFS Equivalent: ${sc.ngfsEquivalent}`}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: sc.color }}
                    />
                    <span>{sc.code}</span>
                    <span className="text-[10px] text-slate-400 font-mono font-normal hidden xl:inline">
                      {sc.warming2100}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Spatial Downscaling Resolution Selector */}
          {onResolutionChange && (
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span>Spatial Downscaling:</span>
              </span>
              <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                {(['25km', '10km', '1km', '90m'] as SpatialResolution[]).map((resKey) => {
                  const meta = SPATIAL_RESOLUTIONS[resKey];
                  const isSelected = currentResolution === resKey;
                  return (
                    <button
                      key={resKey}
                      onClick={() => onResolutionChange(resKey)}
                      title={`${meta.name} • ${meta.provider}\nMethod: ${meta.methodology}\nUncertainty: ±${meta.uncertaintyBandPercent}%`}
                      className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition flex items-center gap-1 ${
                        isSelected
                          ? 'bg-emerald-600 text-white font-bold shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                      }`}
                    >
                      <span>{resKey}</span>
                      <span className="text-[9px] opacity-75 font-sans hidden 2xl:inline">
                        (±{meta.uncertaintyBandPercent}%)
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Decade Horizon Selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Decade Horizon:</span>
            </span>
            <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 overflow-x-auto">
              {DECADES.map((d) => {
                const isSelected = currentDecade === d;
                return (
                  <button
                    key={d}
                    onClick={() => onDecadeChange(d)}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition ${
                      isSelected
                        ? 'bg-cyan-600 text-white font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                  >
                    {d === 2025 ? 'Today' : `${d}s`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Return Period Exceedance Probability Selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>Return Period:</span>
            </span>
            <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
              {RETURN_PERIODS.map((rp) => {
                const isSelected = currentReturnPeriod === rp.id;
                return (
                  <button
                    key={rp.id}
                    onClick={() => onReturnPeriodChange(rp.id)}
                    title={rp.tooltip}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition ${
                      isSelected
                        ? 'bg-purple-600 text-white font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                  >
                    {rp.label}
                  </button>
                );
              })}
            </div>
            <button
              onClick={onExportCsv}
              className="text-slate-400 hover:text-cyan-400 p-1 transition"
              title="Download Full Portfolio Risk Table (CSV)"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

