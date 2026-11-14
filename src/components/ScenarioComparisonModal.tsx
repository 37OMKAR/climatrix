import React, { useState } from 'react';
import {
  Asset,
  Decade,
  SSPScenario,
} from '../types/climate';
import {
  assessAssetRisk,
  formatCurrencyUsd,
  SSP_SCENARIOS,
} from '../services/climateEngine';
import {
  X,
  GitCompare,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Info,
} from 'lucide-react';

interface ScenarioComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
}

export const ScenarioComparisonModal: React.FC<ScenarioComparisonModalProps> = ({
  isOpen,
  onClose,
  assets,
}) => {
  const [selectedDecade, setSelectedDecade] = useState<Decade>(2050);

  if (!isOpen) return null;

  const scenarios: SSPScenario[] = ['ssp119', 'ssp126', 'ssp245', 'ssp370', 'ssp585'];

  // Compute portfolio results across the 4 scenarios for the chosen decade
  const scenarioResults = scenarios.map((scKey) => {
    let totalLoss = 0;
    let sumScore = 0;

    assets.forEach((asset) => {
      const assessment = assessAssetRisk(asset, scKey, selectedDecade, 'aal');
      totalLoss += assessment.totalExpectedAnnualLossUsd;
      sumScore += assessment.compositeScore;
    });

    const avgScore = assets.length > 0 ? Number((sumScore / assets.length).toFixed(1)) : 0;
    return {
      scenario: scKey,
      meta: SSP_SCENARIOS[scKey],
      totalLoss,
      avgScore,
    };
  });

  const baseLossSsp126 = scenarioResults.find((s) => s.scenario === 'ssp126')?.totalLoss || 1;
  const maxLoss = Math.max(...scenarioResults.map((s) => s.totalLoss), 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 text-slate-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-950 border border-amber-800 flex items-center justify-center text-amber-400">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                CMIP6 Shared Socioeconomic Pathways (SSP) Comparison
              </h2>
              <p className="text-xs text-slate-400">
                Side-by-side stress testing: Paris 1.5°C vs Moderate vs Fossil-Fueled Worst Case
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Decade Horizon Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
            <div>
              <span className="text-xs font-bold text-white font-mono uppercase tracking-wider block">
                Select Time Horizon Decade:
              </span>
              <span className="text-xs text-slate-400">Observe divergence as warming paths separate over time</span>
            </div>

            <div className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-800 font-mono text-xs">
              {([2030, 2040, 2050, 2060, 2070, 2080, 2090] as Decade[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setSelectedDecade(d)}
                  className={`px-3 py-1.5 rounded-md font-bold transition ${
                    selectedDecade === d
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>

          {/* 5 SSP Scenario Cards Side-by-Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
            {scenarioResults.map((item) => {
              const deltaPercent = Number((((item.totalLoss - baseLossSsp126) / baseLossSsp126) * 100).toFixed(0));
              const heightBarPercent = Math.max(15, Math.round((item.totalLoss / maxLoss) * 100));

              return (
                <div
                  key={item.scenario}
                  className="p-5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between relative overflow-hidden group hover:border-slate-700 transition"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span
                        className="text-xs font-black font-mono px-2 py-0.5 rounded"
                        style={{ backgroundColor: `${item.meta.color}22`, color: item.meta.color }}
                      >
                        {item.meta.code}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-300">
                        {item.meta.warming2100}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-white line-clamp-1">{item.meta.name}</h3>
                    <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3">
                      {item.meta.description}
                    </p>
                  </div>

                  {/* Visual Bar Comparison */}
                  <div className="my-4 pt-4 border-t border-slate-800">
                    <div className="text-[10px] text-slate-400 font-mono uppercase mb-1">
                      Expected Annual Loss ({selectedDecade}s)
                    </div>
                    <div className="text-xl font-black text-white font-mono">
                      {formatCurrencyUsd(item.totalLoss)}/yr
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-slate-800 mt-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${heightBarPercent}%`,
                          backgroundColor: item.meta.color,
                        }}
                      />
                    </div>

                    {/* Delta comparison */}
                    <div className="flex items-center justify-between text-xs font-mono mt-3">
                      <span className="text-slate-400">Physical Score:</span>
                      <span className="font-bold text-cyan-300">{item.avgScore} / 100</span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono mt-1">
                      <span className="text-slate-400">vs Paris 1.5°C:</span>
                      <span className={`font-bold ${deltaPercent > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {deltaPercent > 0 ? `+${deltaPercent}% Loss` : 'Baseline'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Analytical Takeaway Box */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-3 text-xs text-slate-300">
            <Info className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-white font-mono uppercase">
                Stress Test Finding for {selectedDecade}s Horizon:
              </span>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Under worst-case scenario <strong>SSP5-8.5</strong>, portfolio annual losses exceed <strong>{formatCurrencyUsd(scenarioResults[3]?.totalLoss || 0)}</strong>—a <strong>{Number((((scenarioResults[3]?.totalLoss || 1) - baseLossSsp126) / baseLossSsp126 * 100).toFixed(0))}% increase</strong> compared to the sustainable Paris-aligned <strong>SSP1-2.6</strong> pathway. Proactive adaptation Capex yields substantial IRR under higher warming pathways.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>IPCC Sixth Assessment Report (AR6) Aligned</span>
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

