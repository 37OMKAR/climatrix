import React, { useEffect, useMemo, useState } from 'react';
import { computeDisclosures } from '../services/disclosures';
import {
  AssetRiskAssessment,
  PortfolioSummary,
  SSPScenario,
  Decade,
  RegulatoryFramework,
  SpatialResolution,
} from '../types/climate';
import {
  ALL_HAZARDS,
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
  const d = useMemo(() => computeDisclosures(assessments, summary, scenario), [assessments, summary, scenario]);
  const liveCount = assessments.filter((a) => a.usesLiveData).length;
  const decadeRpLabel = (assessments[0]?.returnPeriod ?? '100yr').replace('yr', '');
  useEffect(() => {
    if (!isOpen) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [isOpen, onClose]);

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
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto font-sans">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 text-slate-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.02] flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Disclosure dossier
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300 border border-white/[0.08]">
                  {resolution} Downscaled Grid
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Printable statement for the selected framework, scenario and year
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-white/[0.08] transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-cyan-400" />
              <span>Print / Save PDF</span>
            </button>

            <button
              onClick={handleExportJson}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-white/[0.08] transition cursor-pointer"
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
        <div className="px-6 py-2.5 bg-white/[0.03] border-b border-white/[0.06] flex items-center gap-2 overflow-x-auto print:hidden">
          <span className="text-slate-400 text-[11px] mr-1">Framework:</span>
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
        <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-900/70 print:bg-white print:text-black font-sans">
          {/* Executive Dossier Header */}
          <div className="border-b border-white/[0.06] print:border-slate-300 pb-6">
            <div className="flex items-center justify-between text-xs text-cyan-400 print:text-slate-600 mb-2">
              <span>{frameworkMeta.acronym} disclosure statement</span>
              <span>SCENARIO: {currentScenarioMeta.name} ({currentScenarioMeta.ngfsEquivalent})</span>
            </div>
            <h1 className="text-2xl font-semibold text-white print:text-black tracking-tight">
              {frameworkMeta.name} Physical Climate Risk Disclosure
            </h1>
            <p className="text-xs text-slate-400 print:text-slate-600 mt-1">
              Horizon: <strong>{decade === 2025 ? 'today' : `${decade}s`}</strong> • {ALL_HAZARDS.length} hazards • Data: <strong>{liveCount === 0 ? 'screening estimates (geographic heuristics)' : `screening estimates, ${liveCount} of ${assessments.length} sites calibrated with live data`}</strong>
            </p>
            <div className="mt-3 flex items-center gap-3 text-xs">
              <span className="text-slate-300 print:text-slate-700">Authority: <strong>{frameworkMeta.authority}</strong></span>
              <span>•</span>
              <span className="text-slate-400 print:text-slate-600">Applicability depends on jurisdiction and entity size</span>
            </div>
          </div>

          {/* Key Executive Disclosures Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] print:bg-slate-50 print:border-slate-200">
              <span className="text-[11px] text-slate-400 print:text-slate-600">Assessed Capital</span>
              <div className="text-xl font-semibold text-white print:text-black mt-1">
                {formatCurrencyUsd(summary.totalReplacementValueUsd)}
              </div>
              <span className="text-[11px] text-slate-500">{summary.totalAssets} site{summary.totalAssets === 1 ? '' : 's'}</span>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] print:bg-slate-50 print:border-slate-200">
              <div className="flex items-center justify-between text-[11px] text-slate-400 print:text-slate-600">
                <span>Average annual loss</span>
              </div>
              <div className="text-xl font-semibold text-white print:text-black mt-1">
                {formatCurrencyUsd(summary.totalAalUsd)}
              </div>
              <div className="text-[11px] text-slate-500">
                {summary.totalReplacementValueUsd ? ((summary.totalAalUsd / summary.totalReplacementValueUsd) * 100).toFixed(2) : '0'}% of replacement value per year
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] print:bg-slate-50 print:border-slate-200">
              <span className="text-[11px] text-slate-400 print:text-slate-600">Portfolio 1-in-200 loss (VaR 99.5%)</span>
              <div className="text-xl font-semibold text-white print:text-black mt-1">
                {formatCurrencyUsd(summary.var995Usd)}
              </div>
              <span className="text-[11px] text-slate-500">
                after diversification across sites
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] print:bg-slate-50 print:border-slate-200">
              <span className="text-[11px] text-slate-400 print:text-slate-600">Portfolio Risk Rating</span>
              <div className="text-xl font-semibold text-amber-300 print:text-amber-700 mt-1">
                {summary.portfolioRiskScore} / 100
              </div>
              <span className="text-[11px] text-slate-500">{summary.portfolioRating} Tier Exposure</span>
            </div>
          </div>

          {/* Statutory Requirements Checklist */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] print:bg-slate-50 print:border-slate-200 space-y-2">
            <h4 className="text-xs font-bold text-white print:text-black">
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
              <h3 className="text-sm font-bold text-slate-300 print:text-black border-b border-white/[0.06] pb-1">
                TCFD Core Recommendations Compliance
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] print:bg-slate-50 print:border-slate-200 space-y-2">
                  <div className="font-bold text-cyan-400 print:text-cyan-700 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>1. Governance & Board Oversight</span>
                  </div>
                  <p className="text-slate-300 print:text-slate-700 leading-relaxed text-[11px]">
                    [Describe board and management oversight of physical climate risk, and how screening results feed capital and risk decisions.]
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] print:bg-slate-50 print:border-slate-200 space-y-2">
                  <div className="font-bold text-cyan-400 print:text-cyan-700 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" />
                    <span>2. Strategy & Scenario Analysis</span>
                  </div>
                  <p className="text-slate-300 print:text-slate-700 leading-relaxed text-[11px]">
                    Portfolio screened across five SSP emissions pathways and decades 2025–2090. [Describe resulting strategic responses, e.g. relocation, redundancy or adaptation plans.]
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] print:bg-slate-50 print:border-slate-200 space-y-2">
                  <div className="font-bold text-cyan-400 print:text-cyan-700 flex items-center gap-1.5">
                    <Layers className="w-4 h-4" />
                    <span>3. Risk Management</span>
                  </div>
                  <p className="text-slate-300 print:text-slate-700 leading-relaxed text-[11px]">
                    All {ALL_HAZARDS.length} acute, chronic and geophysical hazards assessed with multiple return periods (10-yr, 50-yr, 100-yr, 250-yr, 500-yr). Engineering countermeasures deployed based on positive NPV resilience benefit.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] print:bg-slate-50 print:border-slate-200 space-y-2">
                  <div className="font-bold text-cyan-400 print:text-cyan-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>4. Metrics & Targets</span>
                  </div>
                  <p className="text-slate-300 print:text-slate-700 leading-relaxed text-[11px]">
                    Average annual loss is currently {(d.aalPctOfValue * 100).toFixed(2)}% of asset value. Recommended adaptation would reduce it to {formatCurrencyUsd(d.residualAalAfterAdaptation)} per year ({d.positiveNpvAssetCount} sites with positive 15-year payback).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* CSRD ESRS E1 Specific Section */}
          {activeFramework === 'csrd_esrs' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-300 print:text-black border-b border-white/[0.06] pb-1">
                CSRD ESRS E1-9 Physical Climate Risk Financial Effects
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] print:bg-slate-50">
                  <span className="text-[11px] text-slate-400">Gross Carrying Amount (Acute Risk)</span>
                  <div className="text-lg font-bold text-rose-400 mt-1">
                    {formatCurrencyUsd(d.grossCarryingAcute)}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] print:bg-slate-50">
                  <span className="text-[11px] text-slate-400">Gross Carrying Amount (Chronic Risk)</span>
                  <div className="text-lg font-bold text-amber-400 mt-1">
                    {formatCurrencyUsd(d.grossCarryingChronic)}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] print:bg-slate-50">
                  <span className="text-[11px] text-slate-400">Residual Annual Loss (Post-Adaptation)</span>
                  <div className="text-lg font-bold text-emerald-400 mt-1">
                    {formatCurrencyUsd(d.residualAalAfterAdaptation)}/yr
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SEC Reg S-K 1502/1504 Specific Section */}
          {activeFramework === 'sec_climate' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-300 print:text-black border-b border-white/[0.06] pb-1">
                SEC Reg S-K Item 1502/1504 1% Financial Footnote Materiality Test
              </h3>
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] print:bg-slate-50 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span>1.0% Capitalized Base Threshold:</span>
                  <span className="font-bold text-white">{formatCurrencyUsd(summary.totalReplacementValueUsd * 0.01)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Annualized Severe Weather Loss Exposure (AAL):</span>
                  <span className="font-bold text-rose-400">{formatCurrencyUsd(d.totalAal)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-white/[0.06] pt-2">
                  <span>Footnote Disclosure Status:</span>
                  <span className={`font-bold ${d.secMaterial ? 'text-amber-300' : 'text-emerald-400'}`}>{d.secMaterial ? 'Exceeds 1% threshold — footnote disclosure required' : 'Below 1% threshold'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Exposure by hazard */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-300 print:text-black border-b border-white/[0.06] pb-1">
              Exposure by hazard ({ALL_HAZARDS.length} hazards)
            </h3>

            <div className="overflow-x-auto rounded-xl border border-white/[0.06] print:border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/[0.03] print:bg-slate-100 text-slate-400 print:text-slate-700 text-[11px] border-b border-white/[0.06]">
                  <tr>
                    <th className="px-3.5 py-2.5">Hazard Category</th>
                    <th className="px-3.5 py-2.5">Physical Metric Unit</th>
                    <th className="px-3.5 py-2.5 text-center">Avg Score</th>
                    <th className="px-3.5 py-2.5 text-right">{summary.lossMetricType === 'AAL' ? 'Average annual loss' : `1-in-${decadeRpLabel} event loss`}</th>
                    <th className="px-3.5 py-2.5 text-center">Exposed Assets (High+)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] print:divide-slate-200 text-slate-300 print:text-slate-800 text-[11px]">
                  {summary.hazardBreakdown.filter((item) => item.averageScore > 0).map((item) => {
                    const meta = HAZARD_CATALOG[item.hazard];
                    return (
                      <tr key={item.hazard}>
                        <td className="px-3.5 py-2 font-bold text-white print:text-black">{item.hazardName}</td>
                        <td className="px-3.5 py-2 text-slate-400 print:text-slate-600">{meta.unit}</td>
                        <td className="px-3.5 py-2 text-center text-cyan-300 print:text-cyan-700 font-bold">{item.averageScore}</td>
                        <td className="px-3.5 py-2 text-right text-white print:text-black font-bold">{formatCurrencyUsd(item.totalExpectedLossUsd)}</td>
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
        <div className="px-6 py-3 border-t border-white/[0.06] bg-white/[0.03] flex items-center justify-between text-xs text-slate-400 print:hidden">
          <span>Screening estimate — not for pricing or assurance. Bracketed text is for you to complete.</span>
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

