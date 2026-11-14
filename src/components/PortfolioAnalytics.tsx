import React, { useState } from 'react';
import {
  AssetRiskAssessment,
  HazardType,
  PortfolioSummary,
  RiskRating,
  SSPScenario,
  Decade,
} from '../types/climate';
import {
  formatCurrencyUsd,
  HAZARD_CATALOG,
  getRatingBadgeBg,
  getRatingColor,
  ALL_HAZARDS,
  estimateGlobalElevationMeters,
  getDistanceToOceanKm,
} from '../services/climateEngine';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ShieldAlert,
  Building,
  Layers,
  ArrowUpDown,
  Search,
  Filter,
  ExternalLink,
  Flame,
  Waves,
  Wind,
  Calendar,
  Sparkles,
  Download,
} from 'lucide-react';

interface PortfolioAnalyticsProps {
  summary: PortfolioSummary;
  assessments: AssetRiskAssessment[];
  currentScenario: SSPScenario;
  currentDecade: Decade;
  onSelectAsset: (assetId: string) => void;
  onExportCsv: () => void;
}

export const PortfolioAnalytics: React.FC<PortfolioAnalyticsProps> = ({
  summary,
  assessments,
  currentScenario,
  currentDecade,
  onSelectAsset,
  onExportCsv,
}) => {
  const [tableSearch, setTableSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [hazardFilter, setHazardFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'score' | 'loss' | 'value' | 'name'>('loss');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Filter & sort table rows
  const filteredRows = assessments
    .filter((a) => {
      if (tableSearch.trim() !== '') {
        const q = tableSearch.toLowerCase();
        const match =
          a.asset.name.toLowerCase().includes(q) ||
          a.asset.city.toLowerCase().includes(q) ||
          a.asset.country.toLowerCase().includes(q) ||
          a.asset.entityName.toLowerCase().includes(q) ||
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

  // Trajectory aggregation for current scenario across decades (2025 - 2090)
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

  return (
    <div className="max-w-[1720px] mx-auto px-4 sm:px-6 py-6 space-y-6 text-slate-100">
      {/* KPI Top Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Replacement Value */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold tracking-wider uppercase font-mono">Portfolio Value</span>
            <Building className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono tracking-tight">
            {formatCurrencyUsd(summary.totalReplacementValueUsd)}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
            <span>{summary.totalAssets} Assessed Assets</span>
            <span className="text-cyan-400 font-mono text-[11px]">&gt;250 Taxonomy Types</span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-cyan-500/10 rounded-full blur-xl pointer-events-none"></div>
        </div>

        {/* Card 2: Expected Annual Loss */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold tracking-wider uppercase font-mono">Expected Annual Loss (AAL)</span>
            <TrendingUp className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-black text-red-400 font-mono tracking-tight">
            {formatCurrencyUsd(summary.totalExpectedAnnualLossUsd)}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
            <span>Damage Ratio:</span>
            <span className="font-mono text-amber-300 font-bold">{(summary.averageDamageRatio * 100).toFixed(2)}%</span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-red-500/10 rounded-full blur-xl pointer-events-none"></div>
        </div>

        {/* Card 3: Value at Risk (VaR 99.5%) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold tracking-wider uppercase font-mono">Tail Risk (VaR 99.5%)</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400 font-mono tracking-tight">
            {formatCurrencyUsd(summary.var995Usd)}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
            <span>VaR 95%:</span>
            <span className="font-mono text-slate-300 font-semibold">{formatCurrencyUsd(summary.var95Usd)}</span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-rose-500/10 rounded-full blur-xl pointer-events-none"></div>
        </div>

        {/* Card 4: Composite Risk Index */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold tracking-wider uppercase font-mono">Portfolio Risk Score</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-mono tracking-tight">
              {summary.portfolioRiskScore}
            </span>
            <span className="text-xs text-slate-400 font-mono">/ 100</span>
            <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase font-mono ml-auto ${getRatingBadgeBg(summary.portfolioRating)} text-slate-950`}>
              {summary.portfolioRating}
            </span>
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
            <span>Decade Horizon:</span>
            <span className="text-cyan-300 font-mono">{currentDecade}s</span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-amber-500/10 rounded-full blur-xl pointer-events-none"></div>
        </div>

        {/* Card 5: Top Hazard Exposure */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold tracking-wider uppercase font-mono">Peak Hazard Driver</span>
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-lg font-bold text-white truncate" title={HAZARD_CATALOG[summary.topExposedHazard]?.name}>
            {HAZARD_CATALOG[summary.topExposedHazard]?.name}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
            <span>High/Severe Assets:</span>
            <span className="text-rose-400 font-mono font-bold">
              {summary.hazardBreakdown[0]?.assetsExposedHighOrSevere || 0}
            </span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-purple-500/10 rounded-full blur-xl pointer-events-none"></div>
        </div>
      </div>

      {/* Middle Row: Visual Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left (7 Cols): Multi-Decade Escalation Trajectory (2025 to 2090) */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-400" />
                <span>Multi-Decade Financial Loss Trajectory (2025 – 2090)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                CMIP6 Ensemble projection modeled under active scenario ({currentScenario.toUpperCase()})
              </p>
            </div>
            <div className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800 text-cyan-300 border border-slate-700">
              Peak 2090: {formatCurrencyUsd(aggregateTrajectory[aggregateTrajectory.length - 1]?.lossUsd || 0)}/yr
            </div>
          </div>

          {/* Interactive Decadal Bar / Timeline Chart */}
          <div className="h-64 flex items-end gap-3 pt-6 pb-2 px-2 border-b border-slate-800">
            {aggregateTrajectory.map((item) => {
              const heightPercent = Math.max(12, Math.round((item.lossUsd / maxTrajectoryLoss) * 100));
              const isCurrent = item.decade === currentDecade;
              return (
                <div key={item.decade} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                  {/* Tooltip on hover */}
                  <div className="text-[10px] font-mono font-bold text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950 px-1.5 py-0.5 rounded border border-slate-700 shadow whitespace-nowrap">
                    {formatCurrencyUsd(item.lossUsd)}
                  </div>

                  {/* Bar */}
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full rounded-t-md transition-all duration-300 relative ${
                      isCurrent
                        ? 'bg-gradient-to-t from-cyan-600 to-cyan-400 shadow-lg shadow-cyan-500/30 ring-2 ring-cyan-300'
                        : 'bg-gradient-to-t from-slate-800 to-slate-700 hover:from-cyan-900 hover:to-cyan-600'
                    }`}
                  >
                    {/* Score tag inside bar */}
                    <div className="absolute top-1 inset-x-0 text-center text-[10px] font-mono text-white/90 font-bold">
                      {item.avgScore}
                    </div>
                  </div>

                  {/* Decade label */}
                  <span className={`text-[11px] font-mono ${isCurrent ? 'text-cyan-400 font-bold' : 'text-slate-400'}`}>
                    {item.decade === 2025 ? '2025' : `${item.decade}s`}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 font-sans">
            <span>Bars show Expected Annual Loss ($ USD); numbers indicate Average Physical Risk Score</span>
            <span className="text-cyan-400 font-mono">Target: Paris 1.5°C Resilience</span>
          </div>
        </div>

        {/* Right (5 Cols): 12 Climate Change Hazards Breakdown */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                <span>12 Hazard Categories Severity</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Absolute loss & average physical risk score</p>
            </div>
            <span className="text-xs font-mono text-purple-400 font-semibold">All Hazards</span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-72">
            {summary.hazardBreakdown.map((item) => {
              const meta = HAZARD_CATALOG[item.hazard];
              const scoreWidth = Math.min(100, item.averageScore);
              return (
                <div key={item.hazard} className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.colorHex }} />
                      <span>{item.hazardName}</span>
                    </span>
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="text-slate-400">{formatCurrencyUsd(item.totalExpectedLossUsd)}/yr</span>
                      <span className="font-bold text-cyan-300">{item.averageScore}</span>
                    </div>
                  </div>

                  {/* Progress track */}
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${scoreWidth}%`,
                        backgroundColor: meta.colorHex,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 font-mono">
                    <span>{meta.unit}</span>
                    <span>{item.assetsExposedHighOrSevere} assets exposed high+</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Section: Asset Portfolio Exposure Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl shadow-xl overflow-hidden">
        {/* Table Controls */}
        <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Building className="w-4 h-4 text-cyan-400" />
              <span>Asset Risk Exposure Register ({filteredRows.length})</span>
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search assets, parent, city..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-500 w-48 sm:w-60"
              />
            </div>

            {/* Risk Tier Filter */}
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

            {/* Hazard Filter */}
            <select
              value={hazardFilter}
              onChange={(e) => setHazardFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-sans"
            >
              <option value="all">Primary Hazard: All</option>
              {ALL_HAZARDS.map((hId) => (
                <option key={hId} value={hId}>
                  {HAZARD_CATALOG[hId].name}
                </option>
              ))}
            </select>

            {/* Export CSV */}
            <button
              onClick={onExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] font-mono text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th
                  onClick={() => toggleSort('name')}
                  className="px-4 py-3 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>Asset & Entity</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  </div>
                </th>
                <th className="px-4 py-3">Location & Elevation</th>
                <th
                  onClick={() => toggleSort('value')}
                  className="px-4 py-3 cursor-pointer hover:text-white text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Replacement Value</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('score')}
                  className="px-4 py-3 cursor-pointer hover:text-white text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Risk Score</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  </div>
                </th>
                <th className="px-4 py-3">Primary Threat & Metric</th>
                <th
                  onClick={() => toggleSort('loss')}
                  className="px-4 py-3 cursor-pointer hover:text-white text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Expected Loss (AAL)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  </div>
                </th>
                <th className="px-4 py-3 text-center">Downtime</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredRows.map((item) => {
                const { asset, compositeScore, compositeRating, totalExpectedAnnualLossUsd, primaryHazard, downtimeDays } = item;
                const primaryMeta = HAZARD_CATALOG[primaryHazard];
                const primaryRes = item.hazardResults[primaryHazard];

                return (
                  <tr
                    key={asset.id}
                    className="hover:bg-slate-800/40 transition group cursor-pointer"
                    onClick={() => onSelectAsset(asset.id)}
                  >
                    {/* Asset Name & Entity */}
                    <td className="px-4 py-3">
                      <div className="font-bold text-white group-hover:text-cyan-400 transition">
                        {asset.name}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <span className="font-semibold text-slate-300">{asset.parentEntity}</span>
                        <span>•</span>
                        <span className="truncate max-w-[200px]">{asset.assetType}</span>
                      </div>
                    </td>

                    {/* Location */}
                    <td className="px-4 py-3 font-mono text-[11px]">
                      <div className="text-slate-200">{asset.city}, {asset.country}</div>
                      <div className="text-slate-500 text-[10px]">
                        {asset.latitude.toFixed(3)}°, {asset.longitude.toFixed(3)}° • {(asset.elevationMeters && asset.elevationMeters > 0 ? asset.elevationMeters : estimateGlobalElevationMeters(asset.latitude, asset.longitude))}m elev • {getDistanceToOceanKm(asset.latitude, asset.longitude)}km to ocean
                      </div>
                    </td>

                    {/* Replacement Value */}
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-200">
                      {formatCurrencyUsd(asset.replacementValueUsd)}
                    </td>

                    {/* Risk Score */}
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className="font-mono font-black text-sm text-white">
                          {compositeScore}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase font-mono ${getRatingBadgeBg(compositeRating)} text-slate-950 mt-0.5`}>
                          {compositeRating}
                        </span>
                      </div>
                    </td>

                    {/* Primary Threat */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-amber-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryMeta.colorHex }} />
                        <span>{primaryMeta.name}</span>
                      </div>
                      <div className="text-[11px] font-mono text-cyan-300 mt-0.5">
                        {primaryRes ? primaryRes.absoluteValue : '-'} {primaryMeta.unit}
                      </div>
                    </td>

                    {/* Expected Annual Loss */}
                    <td className="px-4 py-3 text-right font-mono">
                      <div className="font-black text-red-400">
                        {formatCurrencyUsd(totalExpectedAnnualLossUsd)}/yr
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Damage: {(item.totalDamageRatio * 100).toFixed(2)}%
                      </div>
                    </td>

                    {/* Downtime */}
                    <td className="px-4 py-3 text-center font-mono">
                      <span className="text-amber-400 font-bold">{downtimeDays}</span>
                      <span className="text-slate-500 text-[10px]"> days</span>
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectAsset(asset.id);
                        }}
                        className="p-1.5 rounded-lg bg-cyan-950/80 text-cyan-400 hover:bg-cyan-600 hover:text-white border border-cyan-800 transition"
                        title="View Full 12-Hazard Scientific Assessment"
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
    </div>
  );
};

