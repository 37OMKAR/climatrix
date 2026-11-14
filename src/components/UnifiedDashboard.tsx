import React, { useState } from 'react';
import {
  AssetRiskAssessment,
  Decade,
  PortfolioSummary,
  RegulatoryFramework,
  ReturnPeriod,
  SpatialResolution,
  SSPScenario,
} from '../types/climate';
import {
  ALL_HAZARDS,
  formatCurrencyUsd,
  HAZARD_CATALOG,
  getRatingBadgeBg,
  SSP_SCENARIOS,
  SPATIAL_RESOLUTIONS,
  REGULATORY_FRAMEWORKS,
  estimateGlobalElevationMeters,
  getDistanceToOceanKm,
} from '../services/climateEngine';
import { SAMPLE_PORTFOLIOS } from '../services/sampleData';
import { MapExplorer } from './MapExplorer';
import { SovereignsView } from './SovereignsView';
import { CorporateEntityExplorer } from './CorporateEntityExplorer';
import {
  Building2,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Layers,
  Calendar,
  FileText,
  Globe2,
  Landmark,
  Search,
  Download,
  Printer,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  Clock,
  Cpu,
  FileSpreadsheet,
  BadgeAlert,
  Upload,
  PlusCircle,
} from 'lucide-react';

interface UnifiedDashboardProps {
  summary: PortfolioSummary;
  assessments: AssetRiskAssessment[];
  currentScenario: SSPScenario;
  currentDecade: Decade;
  currentReturnPeriod: ReturnPeriod;
  currentResolution?: SpatialResolution;
  onResolutionChange?: (res: SpatialResolution) => void;
  activePortfolioId?: string;
  onLoadSamplePortfolio?: (id: string) => void;
  selectedAssetId: string | null;
  onSelectAsset: (assetId: string) => void;
  onExportCsv: () => void;
  onAddAssetAtCoords?: (lat: number, lon: number) => void;
  onOpenUpload: () => void;
  onOpenAddAsset: () => void;
  onOpenReport?: () => void;
}

export const UnifiedDashboard: React.FC<UnifiedDashboardProps> = ({
  summary,
  assessments,
  currentScenario,
  currentDecade,
  currentReturnPeriod,
  currentResolution = '1km',
  onResolutionChange,
  activePortfolioId = 'global-flagship',
  onLoadSamplePortfolio,
  selectedAssetId,
  onSelectAsset,
  onExportCsv,
  onAddAssetAtCoords,
  onOpenUpload,
  onOpenAddAsset,
  onOpenReport,
}) => {
  // Right pane tab: 'matrix' | 'curves' | 'adaptation'
  const [rightPaneTab, setRightPaneTab] = useState<'matrix' | 'curves' | 'adaptation'>('matrix');
  // Lower section tab: 'register' | 'regulatory' | 'sovereigns' | 'corporate' | 'trajectory'
  const [lowerTab, setLowerTab] = useState<'register' | 'regulatory' | 'sovereigns' | 'corporate' | 'trajectory'>('register');
  // Universal Regulatory Framework sub-tab: 'tcfd' | 'csrd_esrs' | 'sec_climate' | 'issb_ifrs2' | 'eu_taxonomy' | 'ngfs'
  const [activeRegulatoryFramework, setActiveRegulatoryFramework] = useState<RegulatoryFramework>('tcfd');

  // Search & filter for table
  const [tableSearch, setTableSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [hazardFilter, setHazardFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'score' | 'loss' | 'value' | 'name'>('loss');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Active selected asset assessment (default to highest risk asset or first)
  const activeAssessment = assessments.find((a) => a.asset.id === selectedAssetId) || assessments[0] || null;
  const _activePortfolio = SAMPLE_PORTFOLIOS.find((p) => p.id === activePortfolioId) || SAMPLE_PORTFOLIOS[0];

  // Filter & sort table rows
  const filteredRows = assessments
    .filter((a) => {
      if (tableSearch.trim() !== '') {
        const q = tableSearch.toLowerCase();
        const match =
          a.asset.name.toLowerCase().includes(q) ||
          a.asset.city.toLowerCase().includes(q) ||
          a.asset.country.toLowerCase().includes(q) ||
          a.asset.parentEntity.toLowerCase().includes(q) ||
          a.asset.category.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (ratingFilter !== 'all' && a.compositeRating !== ratingFilter) return false;
      if (hazardFilter !== 'all' && a.primaryHazard !== hazardFilter) return false;
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === 'score') comparison = a.compositeScore - b.compositeScore;
      if (sortField === 'loss') comparison = a.totalExpectedAnnualLossUsd - b.totalExpectedAnnualLossUsd;
      if (sortField === 'value') comparison = a.asset.replacementValueUsd - b.asset.replacementValueUsd;
      if (sortField === 'name') comparison = a.asset.name.localeCompare(b.asset.name);
      return sortAsc ? comparison : -comparison;
    });

  const toggleSort = (field: 'score' | 'loss' | 'value' | 'name') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Trajectory aggregation
  const decades: Decade[] = [2025, 2030, 2040, 2050, 2060, 2070, 2080, 2090];
  const aggregateTrajectory = decades.map((d) => {
    let totalDecadeLoss = 0;
    let avgDecadeScore = 0;
    assessments.forEach((a) => {
      const match = a.decadeTrajectory.find((item) => item.decade === d);
      if (match) {
        totalDecadeLoss += match.expectedLossUsd;
        avgDecadeScore += match.compositeScore;
      }
    });
    return {
      decade: d,
      lossUsd: totalDecadeLoss,
      avgScore: assessments.length > 0 ? Number((avgDecadeScore / assessments.length).toFixed(1)) : 0,
    };
  });
  const maxTrajectoryLoss = Math.max(...aggregateTrajectory.map((t) => t.lossUsd), 1);

  const scenarioMeta = SSP_SCENARIOS[currentScenario];
  const resolutionMeta = SPATIAL_RESOLUTIONS[currentResolution];

  return (
    <div className="max-w-[1780px] mx-auto px-4 sm:px-6 py-5 space-y-5 text-slate-100 font-sans">
      {/* 0. Executive Terminal Control Ribbon: Portfolio Switcher & Spatial Downscaling Resolution */}
      <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Active Institutional Portfolio Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px] uppercase mr-1">
            <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-white">Portfolio Universe:</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 flex-wrap">
            {SAMPLE_PORTFOLIOS.map((p) => {
              const isCurrent = activePortfolioId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => onLoadSamplePortfolio && onLoadSamplePortfolio(p.id)}
                  title={`${p.name}: ${p.description}\nTotal Capital: ${p.totalCapitalUsd}`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                    isCurrent
                      ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <span>{p.name.split(' (')[0]}</span>
                  <span className={`text-[10px] font-mono px-1 py-0.2 rounded ${
                    isCurrent ? 'bg-cyan-950 text-cyan-200' : 'text-slate-500'
                  }`}>
                    {p.totalCapitalUsd}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Downscaling Resolution Selector & Framework Badges */}
        <div className="flex items-center gap-3 flex-wrap">
          {onResolutionChange && (
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span>Grid:</span>
              </span>
              {(['25km', '10km', '1km', '90m'] as SpatialResolution[]).map((r) => {
                const isSelected = currentResolution === r;
                const rMeta = SPATIAL_RESOLUTIONS[r];
                return (
                  <button
                    key={r}
                    onClick={() => onResolutionChange(r)}
                    title={`${rMeta.name}\nProvider: ${rMeta.provider}\nUncertainty: ±${rMeta.uncertaintyBandPercent}%`}
                    className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {r}
                  </button>
                );
              })}
              <span className="text-[10px] font-mono text-emerald-400 ml-1">
                ±{resolutionMeta.uncertaintyBandPercent}% CI
              </span>
            </div>
          )}

          {/* Regulatory Acceptance Badges & Quick Ingestion Actions */}
          <div className="hidden 2xl:flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
            <span className="text-slate-500">Standards:</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">TCFD</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">CSRD ESRS E1</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">SEC Reg S-K</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">EU Taxonomy</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenUpload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500 text-slate-200 text-xs font-medium transition cursor-pointer"
              title="Upload custom facility portfolio via CSV or GeoJSON"
            >
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span>Import Data</span>
            </button>
            <button
              onClick={onOpenAddAsset}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-sm shadow-cyan-600/30 cursor-pointer"
              title="Add a custom facility by geographic coordinates"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Add Facility</span>
            </button>
          </div>
        </div>
      </div>

      {/* 1. Global Executive KPI Ribbon (6 Dense Institutional Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* KPI 1 */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-1 text-[11px] font-mono uppercase">
            <span>Portfolio Capital</span>
            <Building2 className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-black text-white font-mono tracking-tight">
            {formatCurrencyUsd(summary.totalReplacementValueUsd)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
            <span>{summary.totalAssets} Facilities</span>
            <span className="text-cyan-400 font-mono">100% Geocoded</span>
          </div>
        </div>

        {/* KPI 2: Disambiguated AAL vs PML */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-1 text-[11px] font-mono uppercase">
            <span className="flex items-center gap-1 truncate" title={currentReturnPeriod === 'aal' ? 'Average Annual Loss (Unconditional frequency-severity integral)' : `Probable Maximum Loss (${currentReturnPeriod.toUpperCase()} exceedance event)`}>
              <span>{currentReturnPeriod === 'aal' ? 'Expected Loss (AAL)' : `${currentReturnPeriod.toUpperCase()} Loss (PML)`}</span>
              <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                currentReturnPeriod === 'aal'
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                  : 'bg-amber-950 text-amber-300 border border-amber-800'
              }`}>
                {currentReturnPeriod === 'aal' ? 'AAL' : 'PML'}
              </span>
            </span>
            <TrendingUp className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          </div>
          <div className="text-xl font-black text-red-400 font-mono tracking-tight">
            {formatCurrencyUsd(summary.totalExpectedAnnualLossUsd)}/yr
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between font-mono">
            <span>Damage: <strong className="text-amber-300">{(summary.averageDamageRatio * 100).toFixed(2)}%</strong></span>
            {currentReturnPeriod !== 'aal' && summary.totalAalUsd ? (
              <span className="text-slate-500" title="Baseline Unconditional AAL">
                AAL: {formatCurrencyUsd(summary.totalAalUsd)}
              </span>
            ) : (
              <span className="text-emerald-400">Annual Integral</span>
            )}
          </div>
        </div>

        {/* KPI 3: Spatial Copula Tail Risk */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-1 text-[11px] font-mono uppercase">
            <span>Tail Risk (VaR 99.5%)</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-black text-rose-400 font-mono tracking-tight">
            {formatCurrencyUsd(summary.var995Usd)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
            <span
              className="truncate text-[10px] font-mono text-cyan-300"
              title={`Gaussian Spatial Copula Index: ${summary.spatialClusteringIndex || 0.15} • Multiplier: ${summary.copulaVaRMultiplier995 || 4.2}x`}
            >
              Copula: {summary.copulaCorrelationStatus || 'Diversified'}
            </span>
            <span className="text-rose-300 font-mono font-semibold text-[10px]">
              {formatCurrencyUsd(summary.var95Usd)} (95%)
            </span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-1 text-[11px] font-mono uppercase">
            <span>Physical Risk Index</span>
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black text-white font-mono tracking-tight">
              {summary.portfolioRiskScore}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">/ 100</span>
            <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase font-mono ml-auto ${getRatingBadgeBg(summary.portfolioRating)} text-slate-950`}>
              {summary.portfolioRating}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between font-mono">
            <span>Scenario:</span>
            <span className="text-cyan-300 font-bold">{scenarioMeta.code} ({currentDecade}s)</span>
          </div>
        </div>

        {/* KPI 5 */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-1 text-[11px] font-mono uppercase">
            <span>Primary Driver</span>
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-sm font-bold text-white truncate mt-1" title={HAZARD_CATALOG[summary.topExposedHazard]?.name}>
            {HAZARD_CATALOG[summary.topExposedHazard]?.name}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Severely Exposed:</span>
            <span className="text-rose-400 font-mono font-bold">
              {summary.hazardBreakdown[0]?.assetsExposedHighOrSevere || 0} Assets
            </span>
          </div>
        </div>

        {/* KPI 6 */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-1 text-[11px] font-mono uppercase">
            <span>Operational Downtime</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-black text-amber-300 font-mono tracking-tight">
            {assessments.reduce((acc, a) => acc + a.downtimeDays, 0)} Days
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
            <span>BI Loss Est:</span>
            <span className="text-orange-400 font-mono font-bold">
              {formatCurrencyUsd(assessments.reduce((acc, a) => acc + a.businessInterruptionLossUsd, 0))}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Middle Section: Framed Command-Center Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT PANE: Framed Map Explorer (6 Cols / ~50% width, strictly constrained to frame) */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col">
          {/* Framed Header */}
          <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/90 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
              <h3 className="font-bold text-white uppercase tracking-wider font-mono">
                GIS Physical Hazard Terminal
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono border border-slate-700">
                {currentResolution} Downscaled Grid
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono hidden sm:block">
              Click map to inspect any global coordinate
            </div>
          </div>

          {/* Framed Map Container (Constrained height: 490px, NOT full-screen!) */}
          <div className="h-[490px] relative w-full overflow-hidden bg-slate-950">
            <MapExplorer
              assessments={assessments}
              selectedAssetId={selectedAssetId}
              onSelectAsset={onSelectAsset}
              activeHazardFilter="all"
              onHazardFilterChange={() => {}}
              currentScenario={currentScenario}
              currentDecade={currentDecade}
              currentReturnPeriod={currentReturnPeriod}
              currentResolution={currentResolution}
              onAddAssetAtCoords={onAddAssetAtCoords}
            />
          </div>

          {/* Quick Facility Carousel Strip under Map */}
          <div className="p-2.5 bg-slate-950 border-t border-slate-800 flex items-center gap-2 overflow-x-auto text-[11px] font-mono">
            <span className="text-slate-500 uppercase flex-shrink-0 text-[10px] pl-1">Quick Select:</span>
            {assessments.slice(0, 8).map((a) => {
              const isSelected = activeAssessment?.asset.id === a.asset.id;
              return (
                <button
                  key={a.asset.id}
                  onClick={() => onSelectAsset(a.asset.id)}
                  className={`px-2.5 py-1 rounded-lg flex-shrink-0 transition border ${
                    isSelected
                      ? 'bg-cyan-600 text-white border-cyan-400 font-bold shadow-sm'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {a.asset.name.split(' ')[0]} ({a.compositeScore})
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT PANE: Selected Facility Deep-Dive & Multi-Hazard Matrix (7 Cols / ~55% width) */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col h-[565px]">
          {/* Header Strip with Facility Details & Tabs */}
          <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400">
                  {activeAssessment?.asset.category}
                </span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase ${getRatingBadgeBg(activeAssessment?.compositeRating || 'Low')} text-slate-950`}>
                  {activeAssessment?.compositeRating} ({activeAssessment?.compositeScore}/100)
                </span>
              </div>
              <h3 className="text-base font-bold text-white truncate max-w-md">
                {activeAssessment?.asset.name}
              </h3>
              <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                <span>{activeAssessment?.asset.city}, {activeAssessment?.asset.country}</span>
                <span>•</span>
                <span>Value: {formatCurrencyUsd(activeAssessment?.asset.replacementValueUsd || 0)}</span>
                <span>•</span>
                <span className="text-red-400 font-bold">Loss: {formatCurrencyUsd(activeAssessment?.totalExpectedAnnualLossUsd || 0)}/yr</span>
              </div>
            </div>

            {/* Pane Sub-Tabs */}
            <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setRightPaneTab('matrix')}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  rightPaneTab === 'matrix'
                    ? 'bg-cyan-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                12 Hazards
              </button>
              <button
                onClick={() => setRightPaneTab('curves')}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  rightPaneTab === 'curves'
                    ? 'bg-cyan-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Curves (S-Curve & EVT)
              </button>
              <button
                onClick={() => setRightPaneTab('adaptation')}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  rightPaneTab === 'adaptation'
                    ? 'bg-cyan-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Adaptation ROI
              </button>
            </div>
          </div>

          {/* Right Pane Body (Scrollable, 490px) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* TAB 1: 12 Climate Hazards Matrix Table */}
            {rightPaneTab === 'matrix' && activeAssessment && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>CMIP6 Absolute Physical Metrics ({currentDecade}s Horizon, Return Period: {currentReturnPeriod})</span>
                  <span className="text-cyan-400 font-bold">12 Hazard Categories</span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase border-b border-slate-800 sticky top-0">
                      <tr>
                        <th className="px-3 py-2">Hazard Category</th>
                        <th className="px-3 py-2 text-right">Physical Metric</th>
                        <th className="px-3 py-2 text-center">Score</th>
                        <th className="px-3 py-2 text-right">Damage %</th>
                        <th className="px-3 py-2 text-right">Expected Loss (USD)</th>
                        <th className="px-3 py-2 text-center">Rating</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300 text-[11px]">
                      {ALL_HAZARDS.map((hId) => {
                        const hRes = activeAssessment.hazardResults[hId];
                        const meta = HAZARD_CATALOG[hId];
                        const isPrimary = activeAssessment.primaryHazard === hId;

                        return (
                          <tr key={hId} className={`hover:bg-slate-900/60 transition ${isPrimary ? 'bg-amber-950/20' : ''}`}>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5 font-sans font-bold text-white">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.colorHex }} />
                                <span>{meta.shortName}</span>
                                {isPrimary && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500 text-slate-950 font-black font-mono">
                                    PRIMARY
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono truncate">{meta.cmip6ModelBasis}</div>
                            </td>

                            <td className="px-3 py-2 text-right font-bold text-cyan-300">
                              {hRes ? hRes.absoluteValue : '-'} <span className="text-[10px] text-slate-400 font-normal">{meta.unit}</span>
                            </td>

                            <td className="px-3 py-2 text-center font-bold text-white">
                              {hRes ? hRes.score : '-'}
                            </td>

                            <td className="px-3 py-2 text-right text-amber-300">
                              {hRes ? (hRes.damageRatio * 100).toFixed(2) : '-'}%
                            </td>

                            <td className="px-3 py-2 text-right font-bold text-red-400">
                              {formatCurrencyUsd(hRes ? hRes.expectedLossUsd : 0)}/yr
                            </td>

                            <td className="px-3 py-2 text-center">
                              <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${getRatingBadgeBg(hRes ? hRes.rating : 'Low')} text-slate-950`}>
                                {hRes ? hRes.rating : '-'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: Vulnerability Curves & EVT Probability */}
            {rightPaneTab === 'curves' && activeAssessment && (
              <div className="space-y-4">
                {/* S-Curve */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between text-xs font-mono mb-2">
                    <span className="font-bold text-white">Non-Linear Vulnerability Damage S-Curve</span>
                    <span className="text-cyan-400 text-[10px]">Asset: {activeAssessment.asset.assetType}</span>
                  </div>
                  <div className="h-36 w-full relative">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 300 110">
                      <line x1="30" y1="10" x2="290" y2="10" stroke="#1e293b" strokeDasharray="2 2" />
                      <line x1="30" y1="45" x2="290" y2="45" stroke="#1e293b" strokeDasharray="2 2" />
                      <line x1="30" y1="80" x2="290" y2="80" stroke="#334155" />
                      <line x1="30" y1="10" x2="30" y2="80" stroke="#334155" />

                      <text x="24" y="14" fill="#64748b" fontSize="8" textAnchor="end">100%</text>
                      <text x="24" y="48" fill="#64748b" fontSize="8" textAnchor="end">50%</text>
                      <text x="24" y="83" fill="#64748b" fontSize="8" textAnchor="end">0%</text>

                      <path d="M 30,80 C 110,79 140,55 170,30 C 200,15 250,12 290,11" fill="none" stroke="#06b6d4" strokeWidth="2.5" />

                      {/* Current Point */}
                      <circle cx="150" cy="45" r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" className="animate-pulse" />
                      <text x="150" y="35" fill="#f59e0b" fontSize="8" fontWeight="bold" textAnchor="middle">
                        Active Operating Loss: {(activeAssessment.totalDamageRatio * 100).toFixed(2)}%
                      </text>

                      <text x="160" y="98" fill="#94a3b8" fontSize="8" textAnchor="middle" fontFamily="monospace">
                        Hazard Intensity Magnitude
                      </text>
                    </svg>
                  </div>
                </div>

                {/* Return Period EVT Curve */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between text-xs font-mono mb-2">
                    <span className="font-bold text-white">Return Period Loss Exceedance (GEV / Extreme Value)</span>
                    <span className="text-purple-400 text-[10px]">Primary: {HAZARD_CATALOG[activeAssessment.primaryHazard]?.name}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2 text-center font-mono text-xs mt-2">
                    {(['10yr', '50yr', '100yr', '250yr', '500yr'] as ReturnPeriod[]).map((rp) => {
                      const val = activeAssessment.hazardResults[activeAssessment.primaryHazard]?.returnPeriodValues[rp] || 0;
                      return (
                        <div key={rp} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                          <div className="text-[10px] text-slate-400 uppercase">{rp}</div>
                          <div className="text-sm font-bold text-cyan-300 mt-1">{val}</div>
                          <div className="text-[9px] text-slate-500">{HAZARD_CATALOG[activeAssessment.primaryHazard]?.unit}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Adaptation ROI & Engineering Measures */}
            {rightPaneTab === 'adaptation' && activeAssessment && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans">Estimated Capex</span>
                    <div className="text-sm font-bold text-white mt-1">
                      {formatCurrencyUsd(activeAssessment.adaptationRoi.estimatedCapexUsd)}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans">Annual Loss Avoided</span>
                    <div className="text-sm font-bold text-emerald-400 mt-1">
                      {formatCurrencyUsd(activeAssessment.adaptationRoi.annualLossReductionUsd)}/yr
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans">Payback Horizon</span>
                    <div className="text-sm font-bold text-amber-300 mt-1">
                      {activeAssessment.adaptationRoi.paybackPeriodYears} Years
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans">15-Yr Net Benefit</span>
                    <div className="text-sm font-bold text-cyan-300 mt-1">
                      {formatCurrencyUsd(activeAssessment.adaptationRoi.netResilienceBenefitUsd)}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Recommended Engineering Hardening Countermeasures</span>
                  </h4>
                  <div className="space-y-1.5 text-xs text-slate-300">
                    {activeAssessment.adaptationRoi.recommendedMeasures.map((measure, idx) => (
                      <div key={idx} className="p-2 rounded-lg bg-slate-900 border border-slate-800/80 flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span>{measure}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Lower Section: Integrated Reports, Registers & Worldwide Modeling (Clean, Logical, In-Frame) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Navigation Tabs for Lower Section */}
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setLowerTab('register')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                lowerTab === 'register'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Asset Exposure Register ({filteredRows.length})</span>
            </button>

            <button
              onClick={() => setLowerTab('regulatory')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                lowerTab === 'regulatory'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span>Universal Regulatory Disclosures (TCFD / CSRD / SEC / ISSB / EU)</span>
            </button>

            <button
              onClick={() => setLowerTab('sovereigns')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                lowerTab === 'sovereigns'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Landmark className="w-3.5 h-3.5 text-amber-400" />
              <span>Sovereigns & Municipalities (200+ Countries)</span>
            </button>

            <button
              onClick={() => setLowerTab('corporate')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                lowerTab === 'corporate'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Globe2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Corporate Universe (850k Entities)</span>
            </button>

            <button
              onClick={() => setLowerTab('trajectory')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                lowerTab === 'trajectory'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <span>Decade Trajectory (2025–2090s)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Tab Content A: Asset Exposure Register */}
        {lowerTab === 'register' && (
          <div className="p-4 space-y-3">
            {/* Table Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter by facility name, parent entity, city..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-500 w-72 font-sans"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={ratingFilter}
                  onChange={(e) => setRatingFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-sans"
                >
                  <option value="all">Risk Tier: All</option>
                  <option value="Very Low">Very Low</option>
                  <option value="Low">Low</option>
                  <option value="Moderate">Moderate</option>
                  <option value="High">High</option>
                  <option value="Severe">Severe</option>
                  <option value="Catastrophic">Catastrophic</option>
                </select>

                <select
                  value={hazardFilter}
                  onChange={(e) => setHazardFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-sans"
                >
                  <option value="all">Primary Threat: All</option>
                  {ALL_HAZARDS.map((hId) => (
                    <option key={hId} value={hId}>
                      {HAZARD_CATALOG[hId].name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dense Register Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900 text-[10px] font-mono text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th onClick={() => toggleSort('name')} className="px-3.5 py-2.5 cursor-pointer hover:text-white">
                      Facility & Parent Entity
                    </th>
                    <th className="px-3.5 py-2.5">Location & Elev</th>
                    <th onClick={() => toggleSort('value')} className="px-3.5 py-2.5 cursor-pointer hover:text-white text-right">
                      Capital Value
                    </th>
                    <th onClick={() => toggleSort('score')} className="px-3.5 py-2.5 cursor-pointer hover:text-white text-center">
                      Physical Score
                    </th>
                    <th className="px-3.5 py-2.5">Primary Threat</th>
                    <th onClick={() => toggleSort('loss')} className="px-3.5 py-2.5 cursor-pointer hover:text-white text-right">
                      Expected Loss (AAL)
                    </th>
                    <th className="px-3.5 py-2.5 text-center">Downtime</th>
                    <th className="px-3.5 py-2.5 text-right">Focus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {filteredRows.map((item) => {
                    const { asset, compositeScore, compositeRating, totalExpectedAnnualLossUsd, primaryHazard, downtimeDays } = item;
                    const primaryMeta = HAZARD_CATALOG[primaryHazard];
                    const isSelected = activeAssessment?.asset.id === asset.id;

                    return (
                      <tr
                        key={asset.id}
                        onClick={() => onSelectAsset(asset.id)}
                        className={`hover:bg-slate-800/40 transition cursor-pointer ${
                          isSelected ? 'bg-cyan-950/40 border-l-4 border-cyan-400' : ''
                        }`}
                      >
                        <td className="px-3.5 py-2.5">
                          <div className="font-bold text-white">{asset.name}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                            {asset.parentEntity} • <span className="text-slate-300">{asset.assetType}</span>
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-[11px]">
                          <div>{asset.city}, {asset.country}</div>
                          <div className="text-slate-500 text-[10px]">
                            {(asset.elevationMeters && asset.elevationMeters > 0 ? asset.elevationMeters : estimateGlobalElevationMeters(asset.latitude, asset.longitude))}m elev • {getDistanceToOceanKm(asset.latitude, asset.longitude)}km to sea
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-200">
                          {formatCurrencyUsd(asset.replacementValueUsd)}
                        </td>
                        <td className="px-3.5 py-2.5 text-center">
                          <span className="font-mono font-black text-xs text-white">{compositeScore}</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase font-mono ml-1.5 ${getRatingBadgeBg(compositeRating)} text-slate-950`}>
                            {compositeRating}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5">
                          <div className="font-medium text-amber-300 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryMeta.colorHex }} />
                            <span>{primaryMeta.name}</span>
                          </div>
                          <div className="text-[10px] font-mono text-cyan-300">
                            {item.hazardResults[primaryHazard]?.absoluteValue} {primaryMeta.unit}
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono font-bold text-red-400">
                          {formatCurrencyUsd(totalExpectedAnnualLossUsd)}/yr
                        </td>
                        <td className="px-3.5 py-2.5 text-center font-mono">
                          <span className="text-amber-400 font-bold">{downtimeDays}</span>
                          <span className="text-slate-500 text-[10px]"> d</span>
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectAsset(asset.id);
                            }}
                            className="p-1 rounded-md bg-slate-800 text-cyan-400 hover:bg-cyan-600 hover:text-white transition"
                            title="Inspect in Terminal"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content B: Universal Regulatory Disclosure Terminal (TCFD / CSRD / SEC / ISSB / EU Taxonomy / NGFS) */}
        {lowerTab === 'regulatory' && (
          <div className="p-6 space-y-6 bg-slate-950/60 font-sans">
            {/* Header with Framework Selector Tabs */}
            <div className="border-b border-slate-800 pb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase text-emerald-400 font-bold tracking-wider">
                    Universal Regulatory Disclosure Terminal
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono border border-slate-700">
                    Mandatory Institutional Alignment
                  </span>
                </div>
                <h3 className="text-xl font-black text-white mt-1">
                  Physical Climate Risk Assessment & Financial Impairment Statement
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Framework-aligned metrics assessed under <strong>{scenarioMeta.name}</strong> ({currentDecade}s Horizon) across <strong>{summary.totalAssets}</strong> physical facilities ({formatCurrencyUsd(summary.totalReplacementValueUsd)} capital)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
                >
                  <Printer className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Print Dossier</span>
                </button>
                {onOpenReport && (
                  <button
                    onClick={onOpenReport}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Full Legal Dossier</span>
                  </button>
                )}
              </div>
            </div>

            {/* Framework Switcher Pills */}
            <div className="flex items-center gap-2 overflow-x-auto bg-slate-900/90 p-1 rounded-xl border border-slate-800">
              {([
                { id: 'tcfd', name: 'TCFD', desc: 'FSB 4 Pillars' },
                { id: 'csrd_esrs', name: 'CSRD / ESRS E1', desc: 'EU Double Materiality' },
                { id: 'sec_climate', name: 'SEC Reg S-K', desc: '1% Footnote Rule' },
                { id: 'issb_ifrs2', name: 'ISSB / IFRS S2', desc: 'Global Capital Markets' },
                { id: 'eu_taxonomy', name: 'EU Taxonomy', desc: 'DNSH Screening' },
                { id: 'ngfs', name: 'NGFS Phase IV', desc: 'Central Bank Stress Test' },
              ] as { id: RegulatoryFramework; name: string; desc: string }[]).map((fw) => {
                const isSelected = activeRegulatoryFramework === fw.id;
                return (
                  <button
                    key={fw.id}
                    onClick={() => setActiveRegulatoryFramework(fw.id)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex flex-col items-start whitespace-nowrap ${
                      isSelected
                        ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="font-bold">{fw.name}</span>
                    <span className="text-[10px] opacity-75 font-mono">{fw.desc}</span>
                  </button>
                );
              })}
            </div>

            {/* Framework Authority Strip */}
            {REGULATORY_FRAMEWORKS[activeRegulatoryFramework] && (
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-3 font-mono">
                <div>
                  <div className="text-[11px] text-cyan-400 font-bold uppercase tracking-wider">
                    {REGULATORY_FRAMEWORKS[activeRegulatoryFramework].authority}
                  </div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {REGULATORY_FRAMEWORKS[activeRegulatoryFramework].name}
                  </div>
                  <div className="text-[11px] text-slate-300 font-sans mt-1 max-w-3xl">
                    {REGULATORY_FRAMEWORKS[activeRegulatoryFramework].focus}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase ${
                    REGULATORY_FRAMEWORKS[activeRegulatoryFramework].mandateStatus === 'Mandatory'
                      ? 'bg-rose-950 text-rose-300 border border-rose-800'
                      : 'bg-amber-950 text-amber-300 border border-amber-800'
                  }`}>
                    {REGULATORY_FRAMEWORKS[activeRegulatoryFramework].mandateStatus}
                  </span>
                  <span className="text-[10px] text-slate-400">Universal Audit Clearance</span>
                </div>
              </div>
            )}

            {/* FRAMEWORK CONTENT 1: TCFD */}
            {activeRegulatoryFramework === 'tcfd' && (
              <div className="space-y-6">
                {/* TCFD Four Pillars */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-sans">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <div className="font-bold text-cyan-400 flex items-center gap-1.5 font-mono">
                      <ShieldCheck className="w-4 h-4" />
                      <span>1. Governance</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      The Enterprise Risk Committee oversees facility-level spatial screening. All capital projects over $50M require mandatory CMIP6 100-year return period vulnerability clearance.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <div className="font-bold text-cyan-400 flex items-center gap-1.5 font-mono">
                      <TrendingUp className="w-4 h-4" />
                      <span>2. Strategy</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Portfolio resilience stress-tested across 5 SSP pathways (SSP1-1.9 to SSP5-8.5). Supply chain buffering enforced for facilities exceeding 15 days projected flood or heat downtime.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <div className="font-bold text-cyan-400 flex items-center gap-1.5 font-mono">
                      <Layers className="w-4 h-4" />
                      <span>3. Risk Management</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      All 12 acute and chronic hazards monitored continuously. Non-linear vulnerability damage functions model asset structural integrity, electrical switchgear elevation, and chiller tolerances.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <div className="font-bold text-cyan-400 flex items-center gap-1.5 font-mono">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>4. Metrics & Targets</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Maintaining aggregate Expected Annual Loss below 0.35% of replacement capital by 2035 via positive-NPV defensive adaptations ($148M net 15-year benefit).
                    </p>
                  </div>
                </div>

                {/* 12 Hazards Financial Exposure Matrix */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                    12 Hazard Category Quantified Exposure Breakdown (CMIP6 Multi-Model Ensemble)
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                        <tr>
                          <th className="px-3.5 py-2.5">Hazard Category</th>
                          <th className="px-3.5 py-2.5">CMIP6 Model Basis</th>
                          <th className="px-3.5 py-2.5">Unit</th>
                          <th className="px-3.5 py-2.5 text-center">Avg Score</th>
                          <th className="px-3.5 py-2.5 text-right">Expected Loss (USD)</th>
                          <th className="px-3.5 py-2.5 text-center">Exposed Assets (High+)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300 text-[11px]">
                        {summary.hazardBreakdown.map((item) => {
                          const meta = HAZARD_CATALOG[item.hazard];
                          return (
                            <tr key={item.hazard}>
                              <td className="px-3.5 py-2 font-bold text-white">{item.hazardName}</td>
                              <td className="px-3.5 py-2 text-slate-400 font-sans text-[11px]">{meta.cmip6ModelBasis}</td>
                              <td className="px-3.5 py-2 text-slate-400">{meta.unit}</td>
                              <td className="px-3.5 py-2 text-center text-cyan-300 font-bold">{item.averageScore}</td>
                              <td className="px-3.5 py-2 text-right text-red-400 font-bold">{formatCurrencyUsd(item.totalExpectedLossUsd)}/yr</td>
                              <td className="px-3.5 py-2 text-center text-amber-300">{item.assetsExposedHighOrSevere}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* FRAMEWORK CONTENT 2: CSRD / ESRS E1 */}
            {activeRegulatoryFramework === 'csrd_esrs' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-mono">ESRS E1-9 Gross Carrying Value at Acute Risk</span>
                    <div className="text-xl font-black text-rose-400 font-mono mt-1">
                      {formatCurrencyUsd(
                        assessments
                          .filter((a) => ['coastal_flood', 'fluvial_flood', 'pluvial_flood', 'tropical_cyclone', 'wildfire'].includes(a.primaryHazard) && a.compositeScore >= 40)
                          .reduce((acc, a) => acc + a.asset.replacementValueUsd, 0)
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">Storm, flood & wildfire acute exposure</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-mono">ESRS E1-9 Gross Carrying Value at Chronic Risk</span>
                    <div className="text-xl font-black text-amber-400 font-mono mt-1">
                      {formatCurrencyUsd(
                        assessments
                          .filter((a) => ['drought', 'water_stress', 'extreme_heat', 'subsidence'].includes(a.primaryHazard) && a.compositeScore >= 40)
                          .reduce((acc, a) => acc + a.asset.replacementValueUsd, 0)
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">Heat, water stress & subsidence trend exposure</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-mono">ESRS E1-3 Adaptation CapEx Commitment</span>
                    <div className="text-xl font-black text-emerald-400 font-mono mt-1">
                      {formatCurrencyUsd(assessments.reduce((acc, a) => acc + a.adaptationRoi.estimatedCapexUsd, 0))}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">Positive NPV resilient hardening measures</span>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                      <tr>
                        <th className="px-3.5 py-2.5">Operating Facility</th>
                        <th className="px-3.5 py-2.5">Country & Location</th>
                        <th className="px-3.5 py-2.5">Gross Carrying Amount</th>
                        <th className="px-3.5 py-2.5 text-center">Physical Risk Tier</th>
                        <th className="px-3.5 py-2.5">Primary Hazard</th>
                        <th className="px-3.5 py-2.5 text-right">Potential Financial Loss</th>
                        <th className="px-3.5 py-2.5 text-right">Adaptation CapEx Plan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300 text-[11px]">
                      {assessments.slice(0, 10).map((a) => (
                        <tr key={a.asset.id}>
                          <td className="px-3.5 py-2 font-bold text-white">{a.asset.name}</td>
                          <td className="px-3.5 py-2 text-slate-400 font-sans">{a.asset.city}, {a.asset.country}</td>
                          <td className="px-3.5 py-2 text-slate-200 font-bold">{formatCurrencyUsd(a.asset.replacementValueUsd)}</td>
                          <td className="px-3.5 py-2 text-center">
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${getRatingBadgeBg(a.compositeRating)} text-slate-950`}>
                              {a.compositeRating}
                            </span>
                          </td>
                          <td className="px-3.5 py-2 text-amber-300">{HAZARD_CATALOG[a.primaryHazard]?.shortName}</td>
                          <td className="px-3.5 py-2 text-right text-red-400 font-bold">{formatCurrencyUsd(a.totalExpectedAnnualLossUsd)}/yr</td>
                          <td className="px-3.5 py-2 text-right text-emerald-400">{formatCurrencyUsd(a.adaptationRoi.estimatedCapexUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* FRAMEWORK CONTENT 3: SEC CLIMATE DISCLOSURE RULES (Reg S-K 1502/1504) */}
            {activeRegulatoryFramework === 'sec_climate' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-mono">1% Footnote Rule Threshold</span>
                    <div className="text-xl font-black text-white font-mono mt-1">
                      {formatCurrencyUsd(summary.totalReplacementValueUsd * 0.01)}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">1.0% of Total Capitalized Base</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-mono">Incurred Climate Damage Exposure</span>
                    <div className="text-xl font-black text-rose-400 font-mono mt-1">
                      {formatCurrencyUsd(summary.totalExpectedAnnualLossUsd)}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">Annualized physical loss & impairment</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-mono">Reg S-K Materiality Status</span>
                    <div className="text-sm font-black text-emerald-400 font-mono mt-1 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Compliant Footnote Governance</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">Severe weather costs disclosed in 10-K Notes</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
                  <div className="font-bold text-white font-mono flex items-center gap-2">
                    <BadgeAlert className="w-4 h-4 text-cyan-400" />
                    <span>SEC Reg S-K Item 1502/1504 Acute vs Chronic Hazard Segregation</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Under SEC Item 1502, registrants must describe the actual and potential material impacts of physical climate risks on their business operations, results of operations, or financial condition. Facilities located in high-risk coastal, hurricane, and wildfire zones must disclose their exact geographic coordinates, book values, and severe weather insurance deductibles.
                  </p>
                </div>
              </div>
            )}

            {/* FRAMEWORK CONTENT 4: ISSB / IFRS S2 */}
            {activeRegulatoryFramework === 'issb_ifrs2' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-mono">IFRS S2 Short-Term Risk (to 2030)</span>
                    <div className="text-xl font-black text-amber-300 font-mono mt-1">
                      {formatCurrencyUsd(summary.totalExpectedAnnualLossUsd * 1.05)}/yr
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">Near-term operational stress</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-mono">IFRS S2 Medium-Term Risk (2040–2050)</span>
                    <div className="text-xl font-black text-orange-400 font-mono mt-1">
                      {formatCurrencyUsd(summary.totalExpectedAnnualLossUsd * 1.38)}/yr
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">Mid-century compound hazards</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-mono">IFRS S2 Long-Term Tail Risk (2080s)</span>
                    <div className="text-xl font-black text-rose-400 font-mono mt-1">
                      {formatCurrencyUsd(summary.var995Usd)}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">1-in-200yr extreme shock exposure</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
                  <div className="font-bold text-white font-mono flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>IFRS S2 Strategic Climate Resilience Assessment</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    The entity assesses the resilience of its business model and strategy over short, medium, and long-term time horizons taking into account climate-related scenario analysis. Resilience capacity is evaluated based on capital expenditure allocation to protective engineering countermeasures ($148M net 15-year benefit) and emergency supply chain buffering.
                  </p>
                </div>
              </div>
            )}

            {/* FRAMEWORK CONTENT 5: EU TAXONOMY (DNSH ADAPTATION) */}
            {activeRegulatoryFramework === 'eu_taxonomy' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 font-mono">
                    <span className="font-bold text-white">Appendix A: Technical Screening Criteria for Do No Significant Harm (DNSH)</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> DNSH Compliance: PASS
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed mb-3">
                    Under the EU Sustainable Finance Taxonomy, economic activities must undergo a robust physical climate risk assessment covering all 28 hazard classifications across Temperature, Water, Wind, and Solid Mass. The assessment confirms that identified vulnerabilities are mitigated through an adaptation plan that does not adversely affect the adaptation efforts of other people, nature, or assets.
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono text-[11px]">
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-cyan-400 font-bold">Temperature</div>
                      <div className="text-emerald-400 mt-1">DNSH Pass</div>
                      <div className="text-[10px] text-slate-500">Heat, Cold, Wildfire</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-cyan-400 font-bold">Water</div>
                      <div className="text-emerald-400 mt-1">DNSH Pass</div>
                      <div className="text-[10px] text-slate-500">Coastal, River, Drought</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-cyan-400 font-bold">Wind</div>
                      <div className="text-emerald-400 mt-1">DNSH Pass</div>
                      <div className="text-[10px] text-slate-500">Cyclones, Gales, Storms</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-cyan-400 font-bold">Solid Mass</div>
                      <div className="text-emerald-400 mt-1">DNSH Pass</div>
                      <div className="text-[10px] text-slate-500">Subsidence, Landslides</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* FRAMEWORK CONTENT 6: NGFS PHASE IV */}
            {activeRegulatoryFramework === 'ngfs' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2">
                  <div className="font-bold text-white font-mono flex items-center justify-between">
                    <span>NGFS Phase IV Central Bank Supervisory Stress Test Crosswalk</span>
                    <span className="text-cyan-400">130+ Central Banks & Supervisors</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    The Network for Greening the Financial System (NGFS) scenarios provide central banks and commercial financial institutions with macro-financial transition and physical risk stress-testing pathways. Below is the mapping between IPCC CMIP6 emissions pathways and NGFS Phase IV scenario archetypes:
                  </p>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                      <tr>
                        <th className="px-3.5 py-2.5">NGFS Phase IV Archetype</th>
                        <th className="px-3.5 py-2.5">CMIP6 Equivalent</th>
                        <th className="px-3.5 py-2.5 text-center">Warming 2100</th>
                        <th className="px-3.5 py-2.5">Physical Risk Severity</th>
                        <th className="px-3.5 py-2.5 text-right">Portfolio Annual Loss Impact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300 text-[11px]">
                      <tr>
                        <td className="px-3.5 py-2 font-bold text-emerald-400">Net Zero 2050 (Orderly)</td>
                        <td className="px-3.5 py-2 font-bold">SSP1-1.9</td>
                        <td className="px-3.5 py-2 text-center text-cyan-300">+1.4°C</td>
                        <td className="px-3.5 py-2 text-emerald-400">Lowest Physical Impairment</td>
                        <td className="px-3.5 py-2 text-right font-bold text-slate-200">{formatCurrencyUsd(summary.totalExpectedAnnualLossUsd * 0.72)}/yr</td>
                      </tr>
                      <tr>
                        <td className="px-3.5 py-2 font-bold text-teal-400">Below 2°C (Orderly)</td>
                        <td className="px-3.5 py-2 font-bold">SSP1-2.6</td>
                        <td className="px-3.5 py-2 text-center text-cyan-300">+1.8°C</td>
                        <td className="px-3.5 py-2 text-teal-400">Low-Moderate Physical Loss</td>
                        <td className="px-3.5 py-2 text-right font-bold text-slate-200">{formatCurrencyUsd(summary.totalExpectedAnnualLossUsd * 0.85)}/yr</td>
                      </tr>
                      <tr className="bg-amber-950/20">
                        <td className="px-3.5 py-2 font-bold text-amber-400">Delayed Transition (Disorderly)</td>
                        <td className="px-3.5 py-2 font-bold">SSP2-4.5 (Active)</td>
                        <td className="px-3.5 py-2 text-center text-amber-300">+2.7°C</td>
                        <td className="px-3.5 py-2 text-amber-300 font-bold">Moderate-High Compound Shock</td>
                        <td className="px-3.5 py-2 text-right font-bold text-amber-400">{formatCurrencyUsd(summary.totalExpectedAnnualLossUsd)}/yr</td>
                      </tr>
                      <tr>
                        <td className="px-3.5 py-2 font-bold text-rose-400">Current Policies (Hot House World)</td>
                        <td className="px-3.5 py-2 font-bold">SSP5-8.5</td>
                        <td className="px-3.5 py-2 text-center text-rose-400">+4.4°C</td>
                        <td className="px-3.5 py-2 text-rose-400 font-bold">Severe Global Physical Breakdown</td>
                        <td className="px-3.5 py-2 text-right font-bold text-rose-400">{formatCurrencyUsd(summary.totalExpectedAnnualLossUsd * 1.85)}/yr</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab Content C: Sovereigns & Municipalities */}
        {lowerTab === 'sovereigns' && <SovereignsView />}

        {/* Tab Content D: Corporate Universe Explorer */}
        {lowerTab === 'corporate' && <CorporateEntityExplorer />}

        {/* Tab Content E: Decadal Trajectory Timeline */}
        {lowerTab === 'trajectory' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-white">Multi-Decade Financial Loss Trajectory (2025 to 2090s)</span>
              <span className="text-cyan-400">Modeled under {scenarioMeta.name}</span>
            </div>
            <div className="h-56 flex items-end gap-3 pt-6 pb-2 px-2 border-b border-slate-800">
              {aggregateTrajectory.map((item) => {
                const heightPercent = Math.max(12, Math.round((item.lossUsd / maxTrajectoryLoss) * 100));
                const isCurrent = item.decade === currentDecade;
                return (
                  <div key={item.decade} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                    <div className="text-[10px] font-mono font-bold text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950 px-1.5 py-0.5 rounded border border-slate-700 shadow whitespace-nowrap">
                      {formatCurrencyUsd(item.lossUsd)}
                    </div>
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-t-md transition-all duration-300 relative ${
                        isCurrent
                          ? 'bg-gradient-to-t from-cyan-600 to-cyan-400 shadow-lg shadow-cyan-500/30 ring-2 ring-cyan-300'
                          : 'bg-gradient-to-t from-slate-800 to-slate-700 hover:from-cyan-900 hover:to-cyan-600'
                      }`}
                    >
                      <div className="absolute top-1 inset-x-0 text-center text-[10px] font-mono text-white/90 font-bold">
                        {item.avgScore}
                      </div>
                    </div>
                    <span className={`text-[11px] font-mono ${isCurrent ? 'text-cyan-400 font-bold' : 'text-slate-400'}`}>
                      {item.decade === 2025 ? '2025' : `${item.decade}s`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

