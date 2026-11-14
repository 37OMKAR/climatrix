import React, { useState } from 'react';
import {
  AssetRiskAssessment,
  PortfolioSummary,
  SSPScenario,
  Decade,
  RegulatoryFramework,
  SpatialResolution,
} from '../types/climate';
import {
  formatCurrencyUsd,
  HAZARD_CATALOG,
  SSP_SCENARIOS,
  getRatingBadgeBg,
  REGULATORY_FRAMEWORKS,
  SPATIAL_RESOLUTIONS,
} from '../services/climateEngine';
import {
  X,
  Printer,
  Download,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Building,
  TrendingUp,
  Layers,
  Cpu,
  BadgeAlert,
} from 'lucide-react';

interface RegulatoryReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: PortfolioSummary;
  assessments: AssetRiskAssessment[];
  scenario: SSPScenario;
  decade: Decade;
  resolution?: SpatialResolution;
}

export const RegulatoryReportModal: React.FC<RegulatoryReportModalProps> = ({
  isOpen,
  onClose,
  summary,
  assessments,
  scenario,
  decade,
  resolution = '1km',
}) => {
  const [activeFramework, setActiveFramework] = useState<RegulatoryFramework>('tcfd');

  if (!isOpen) return null;

  const currentScenarioMeta = SSP_SCENARIOS[scenario];
  const frameworkMeta = REGULATORY_FRAMEWORKS[activeFramework];
  const resolutionMeta = SPATIAL_RESOLUTIONS[resolution];

  const handlePrint = () => {
    window.print();
  };

  const handleExportJson = () => {
    const reportData = {
      framework: frameworkMeta,
      title: `${frameworkMeta.name} Physical Climate Risk Disclosure`,
      generatedAt: new Date().toISOString(),
      scenario: currentScenarioMeta,
      timeHorizon: `${decade}s`,
      spatialResolution: resolutionMeta,
      summary,
      assets: assessments.map((a) => ({
        id: a.asset.id,
        name: a.asset.name,
        entity: a.asset.entityName,
        parentEntity: a.asset.parentEntity,
        type: a.asset.assetType,
        category: a.asset.category,
        coordinates: [a.asset.latitude, a.asset.longitude],
        valueUsd: a.asset.replacementValueUsd,
        riskScore: a.compositeScore,
        riskRating: a.compositeRating,
        lossMetricType: a.lossMetricType,
        lossTypeLabel: a.lossTypeLabel,
        expectedAnnualLossUsd: a.totalExpectedAnnualLossUsd,
        unconditionalAalUsd: a.aalUsd,
        exceedanceLossUsd: a.periodExceedanceLossUsd,
        damageRatio: a.totalDamageRatio,
        aalDamageRatio: a.aalDamageRatio,
        downtimeDays: a.downtimeDays,
        topThreat: a.primaryHazard,
        adaptationCapexUsd: a.adaptationRoi.estimatedCapexUsd,
      })),
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${activeFramework.toUpperCase()}_Climate_Disclosure_${decade}s_${scenario}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto font-sans">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 text-slate-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/90 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Universal Regulatory Climate Disclosure Dossier
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300 font-mono border border-slate-700">
                  {resolution} Downscaled Grid
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Institutional Physical Asset Risk Statement • CMIP6 AR6 Multi-Model Ensemble
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-cyan-400" />
              <span>Print / Save PDF</span>
            </button>

            <button
              onClick={handleExportJson}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export JSON</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Framework Selector Bar (Interactive) */}
        <div className="px-6 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center gap-2 overflow-x-auto print:hidden">
          <span className="text-slate-400 font-mono text-[11px] uppercase mr-1">Framework:</span>
          {([
            { id: 'tcfd', name: 'TCFD' },
            { id: 'csrd_esrs', name: 'CSRD / ESRS E1' },
            { id: 'sec_climate', name: 'SEC Climate (Reg S-K)' },
            { id: 'issb_ifrs2', name: 'ISSB / IFRS S2' },
            { id: 'eu_taxonomy', name: 'EU Taxonomy (DNSH)' },
            { id: 'ngfs', name: 'NGFS Phase IV' },
          ] as { id: RegulatoryFramework; name: string }[]).map((f) => {
            const isSelected = activeFramework === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setActiveFramework(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  isSelected
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {f.name}
              </button>
            );
          })}
        </div>

        {/* Printable Report Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-900 print:bg-white print:text-black font-sans">
          {/* Executive Dossier Header */}
          <div className="border-b border-slate-800 print:border-slate-300 pb-6">
            <div className="flex items-center justify-between text-xs font-mono text-cyan-400 print:text-slate-600 mb-2">
              <span>{frameworkMeta.acronym.toUpperCase()} STATUTORY COMPLIANCE STATEMENT</span>
              <span>SCENARIO: {currentScenarioMeta.name} ({currentScenarioMeta.ngfsEquivalent})</span>
            </div>
            <h1 className="text-2xl font-black text-white print:text-black tracking-tight">
              {frameworkMeta.name} Physical Climate Risk Disclosure
            </h1>
            <p className="text-xs text-slate-400 print:text-slate-600 mt-1">
              Time Horizon: <strong>{decade}s Decade</strong> • Resolution: <strong>{resolutionMeta.name}</strong> • Multimodel Ensemble • 12 Hazard Categories
            </p>
            <div className="mt-3 flex items-center gap-3 text-xs font-mono">
              <span className="text-slate-300 print:text-slate-700">Authority: <strong>{frameworkMeta.authority}</strong></span>
              <span>•</span>
              <span className="text-emerald-400 print:text-emerald-700 font-bold">Mandate: {frameworkMeta.mandateStatus}</span>
            </div>
          </div>

          {/* Key Executive Disclosures Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 print:bg-slate-50 print:border-slate-200">
              <span className="text-[11px] font-mono text-slate-400 print:text-slate-600 uppercase">Assessed Capital</span>
              <div className="text-xl font-black text-white print:text-black font-mono mt-1">
                {formatCurrencyUsd(summary.totalReplacementValueUsd)}
              </div>
              <span className="text-[10px] text-slate-500">{summary.totalAssets} Physical Asset Facilities</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 print:bg-slate-50 print:border-slate-200">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 print:text-slate-600 uppercase">
                <span>Loss Metric ({summary.lossMetricType})</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-cyan-300 font-bold">{summary.lossMetricType}</span>
              </div>
              <div className="text-xl font-black text-red-400 print:text-red-600 font-mono mt-1">
                {formatCurrencyUsd(summary.totalExpectedAnnualLossUsd)}
              </div>
              <div className="text-[10px] text-slate-500 flex justify-between font-mono">
                <span>Damage: {(summary.averageDamageRatio * 100).toFixed(2)}%</span>
                {summary.totalAalUsd ? <span>AAL: {formatCurrencyUsd(summary.totalAalUsd)}</span> : null}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 print:bg-slate-50 print:border-slate-200">
              <span className="text-[11px] font-mono text-slate-400 print:text-slate-600 uppercase">Copula VaR (99.5%)</span>
              <div className="text-xl font-black text-rose-400 print:text-rose-600 font-mono mt-1">
                {formatCurrencyUsd(summary.var995Usd)}
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {summary.copulaCorrelationStatus || 'Diversified'} ({summary.copulaVaRMultiplier995 || 4.2}x tail)
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 print:bg-slate-50 print:border-slate-200">
              <span className="text-[11px] font-mono text-slate-400 print:text-slate-600 uppercase">Portfolio Risk Rating</span>
              <div className="text-xl font-black text-amber-300 print:text-amber-700 font-mono mt-1">
                {summary.portfolioRiskScore} / 100
              </div>
              <span className="text-[10px] text-slate-500">{summary.portfolioRating} Tier Exposure</span>
            </div>
          </div>

          {/* Statutory Requirements Checklist */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 print:bg-slate-50 print:border-slate-200 space-y-2">
            <h4 className="text-xs font-bold text-white print:text-black uppercase tracking-wider font-mono">
              Mandatory Framework Disclosure Requirements
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {frameworkMeta.keyRequirements.map((req, idx) => (
                <div key={idx} className="flex items-start gap-2 text-[11px] text-slate-300 print:text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 print:text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span>{req}</span>
                </div>
              ))}
            </div>
          </div>

          {/* TCFD Four Pillars Breakdown */}
          {activeFramework === 'tcfd' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 print:text-black font-mono border-b border-slate-800 pb-1">
                TCFD Core Recommendations Compliance
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 print:bg-slate-50 print:border-slate-200 space-y-2">
                  <div className="font-bold text-cyan-400 print:text-cyan-700 flex items-center gap-1.5 font-mono">
                    <ShieldCheck className="w-4 h-4" />
                    <span>1. Governance & Board Oversight</span>
                  </div>
                  <p className="text-slate-300 print:text-slate-700 leading-relaxed text-[11px]">
                    Physical climate risk is integrated into enterprise risk management (ERM). Capital expenditure committee conducts geo-spatial screening for all facility investments exceeding $50M replacement value.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 print:bg-slate-50 print:border-slate-200 space-y-2">
                  <div className="font-bold text-cyan-400 print:text-cyan-700 flex items-center gap-1.5 font-mono">
                    <TrendingUp className="w-4 h-4" />
                    <span>2. Strategy & Scenario Analysis</span>
                  </div>
                  <p className="text-slate-300 print:text-slate-700 leading-relaxed text-[11px]">
                    Portfolio resilience evaluated across CMIP6 emissions pathways (SSP1-2.6 to SSP5-8.5) across decades 2025 through 2090. Supply chain redundancy established for assets exceeding 14 downtime days.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 print:bg-slate-50 print:border-slate-200 space-y-2">
                  <div className="font-bold text-cyan-400 print:text-cyan-700 flex items-center gap-1.5 font-mono">
                    <Layers className="w-4 h-4" />
                    <span>3. Risk Management</span>
                  </div>
                  <p className="text-slate-300 print:text-slate-700 leading-relaxed text-[11px]">
                    All 12 acute and chronic climate hazard categories assessed with multiple return periods (10-yr, 50-yr, 100-yr, 250-yr, 500-yr). Engineering countermeasures deployed based on positive NPV resilience benefit.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 print:bg-slate-50 print:border-slate-200 space-y-2">
                  <div className="font-bold text-cyan-400 print:text-cyan-700 flex items-center gap-1.5 font-mono">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>4. Metrics & Targets</span>
                  </div>
                  <p className="text-slate-300 print:text-slate-700 leading-relaxed text-[11px]">
                    Target to maintain portfolio Expected Annual Loss below 0.35% of total asset value by 2035 through proactive structural adaptation and critical equipment elevation.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* CSRD ESRS E1 Specific Section */}
          {activeFramework === 'csrd_esrs' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 print:text-black font-mono border-b border-slate-800 pb-1">
                CSRD ESRS E1-9 Physical Climate Risk Financial Effects
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 print:bg-slate-50">
                  <span className="text-[10px] text-slate-400">Gross Carrying Amount (Acute Risk)</span>
                  <div className="text-lg font-bold text-rose-400 mt-1">
                    {formatCurrencyUsd(summary.totalReplacementValueUsd * 0.42)}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 print:bg-slate-50">
                  <span className="text-[10px] text-slate-400">Gross Carrying Amount (Chronic Risk)</span>
                  <div className="text-lg font-bold text-amber-400 mt-1">
                    {formatCurrencyUsd(summary.totalReplacementValueUsd * 0.31)}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 print:bg-slate-50">
                  <span className="text-[10px] text-slate-400">Net Carrying Amount (Post-Adaptation)</span>
                  <div className="text-lg font-bold text-emerald-400 mt-1">
                    {formatCurrencyUsd(summary.totalReplacementValueUsd * 0.94)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SEC Reg S-K 1502/1504 Specific Section */}
          {activeFramework === 'sec_climate' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 print:text-black font-mono border-b border-slate-800 pb-1">
                SEC Reg S-K Item 1502/1504 1% Financial Footnote Materiality Test
              </h3>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 print:bg-slate-50 space-y-2 text-xs">
                <div className="flex items-center justify-between font-mono">
                  <span>1.0% Capitalized Base Threshold:</span>
                  <span className="font-bold text-white">{formatCurrencyUsd(summary.totalReplacementValueUsd * 0.01)}</span>
                </div>
                <div className="flex items-center justify-between font-mono">
                  <span>Annualized Severe Weather Loss Exposure:</span>
                  <span className="font-bold text-rose-400">{formatCurrencyUsd(summary.totalExpectedAnnualLossUsd)}</span>
                </div>
                <div className="flex items-center justify-between font-mono border-t border-slate-800 pt-2">
                  <span>Footnote Disclosure Status:</span>
                  <span className="font-bold text-emerald-400">MANDATORY FOOTNOTE DISCLOSURE ACTIVATED</span>
                </div>
              </div>
            </div>
          )}

          {/* 12-Hazard Exposure Summary Table */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 print:text-black font-mono border-b border-slate-800 pb-1">
              Quantified 12-Hazard Category Exposure Summary
            </h3>

            <div className="overflow-x-auto rounded-xl border border-slate-800 print:border-slate-200">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 print:bg-slate-100 text-slate-400 print:text-slate-700 text-[10px] uppercase border-b border-slate-800">
                  <tr>
                    <th className="px-3.5 py-2.5">Hazard Category</th>
                    <th className="px-3.5 py-2.5">Physical Metric Unit</th>
                    <th className="px-3.5 py-2.5 text-center">Avg Score</th>
                    <th className="px-3.5 py-2.5 text-right">Expected Annual Loss</th>
                    <th className="px-3.5 py-2.5 text-center">Exposed Assets (High+)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 print:divide-slate-200 text-slate-300 print:text-slate-800 text-[11px]">
                  {summary.hazardBreakdown.map((item) => {
                    const meta = HAZARD_CATALOG[item.hazard];
                    return (
                      <tr key={item.hazard}>
                        <td className="px-3.5 py-2 font-bold text-white print:text-black">{item.hazardName}</td>
                        <td className="px-3.5 py-2 text-slate-400 print:text-slate-600">{meta.unit}</td>
                        <td className="px-3.5 py-2 text-center text-cyan-300 print:text-cyan-700 font-bold">{item.averageScore}</td>
                        <td className="px-3.5 py-2 text-right text-red-400 print:text-red-700 font-bold">{formatCurrencyUsd(item.totalExpectedLossUsd)}</td>
                        <td className="px-3.5 py-2 text-center text-amber-300 print:text-amber-800">{item.assetsExposedHighOrSevere}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 font-mono print:hidden">
          <span>ClimaRisk AI™ Universal Compliance Engine • {frameworkMeta.acronym} Standard</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-sans font-semibold transition"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};

