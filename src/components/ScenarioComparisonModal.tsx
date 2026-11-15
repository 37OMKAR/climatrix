import React, { useEffect, useMemo, useState } from 'react';
import { Asset, Decade, ReturnPeriod, SSPScenario } from '../types/climate';
import { assessAssetRisk, formatCurrencyUsd, SSP_SCENARIOS } from '../services/climateEngine';
import { X } from 'lucide-react';
import { ModalShell, Segmented, Button } from './ui';

interface ScenarioComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  initialDecade?: Decade;
  returnPeriod?: ReturnPeriod;
}

const SCENARIOS: SSPScenario[] = ['ssp119', 'ssp126', 'ssp245', 'ssp370', 'ssp585'];
const DECADES: Decade[] = [2030, 2040, 2050, 2060, 2070, 2080, 2090];

export const ScenarioComparisonModal: React.FC<ScenarioComparisonModalProps> = ({ isOpen, onClose, assets, initialDecade = 2050, returnPeriod = 'aal' }) => {
  const [decade, setDecade] = useState<Decade>(initialDecade === 2025 ? 2050 : initialDecade);
  const [metric, setMetric] = useState<'aal' | 'event'>(returnPeriod === 'aal' ? 'aal' : 'event');
  useEffect(() => {
    if (isOpen) {
      setDecade(initialDecade === 2025 ? 2050 : initialDecade);
      setMetric(returnPeriod === 'aal' ? 'aal' : 'event');
    }
  }, [isOpen, initialDecade, returnPeriod]);

  const rp: ReturnPeriod = metric === 'aal' ? 'aal' : returnPeriod === 'aal' ? '100yr' : returnPeriod;

  const results = useMemo(() => {
    if (!isOpen) return [];
    return SCENARIOS.map((s) => {
      let loss = 0;
      let score = 0;
      assets.forEach((a) => {
        const r = assessAssetRisk(a, s, decade, rp);
        loss += r.totalExpectedAnnualLossUsd;
        score += r.compositeScore;
      });
      return { s, meta: SSP_SCENARIOS[s], loss, avgScore: assets.length ? Number((score / assets.length).toFixed(1)) : 0 };
    });
  }, [isOpen, assets, decade, rp]);

  if (!isOpen) return null;

  const base = results.find((r) => r.s === 'ssp119')!;
  const worst = results.find((r) => r.s === 'ssp585')!;
  const max = Math.max(1, ...results.map((r) => r.loss));
  const uplift = base.loss > 0 ? Math.round(((worst.loss - base.loss) / base.loss) * 100) : 0;
  const metricLabel = metric === 'aal' ? 'Average annual loss' : `1-in-${rp.replace('yr', '')}-year event loss`;

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-5xl" labelledBy="cmp-title">
      <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <h2 id="cmp-title" className="text-base font-semibold text-white">Compare scenarios</h2>
          <p className="text-xs text-slate-400 mt-0.5">How the same {assets.length} sites fare under each emissions pathway</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06]" aria-label="Close"><X className="w-5 h-5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <Segmented size="sm" value={decade} onChange={setDecade} options={DECADES.map((d) => ({ value: d, label: String(d) }))} ariaLabel="Decade" />
          <Segmented size="sm" value={metric} onChange={setMetric} options={[{ value: 'aal', label: 'Average year' }, { value: 'event', label: `1-in-${(returnPeriod === 'aal' ? '100yr' : returnPeriod).replace('yr', '')} event` }]} ariaLabel="Metric" />
        </div>

        <div className="space-y-3">
          {results.map((r) => {
            const delta = base.loss > 0 ? Math.round(((r.loss - base.loss) / base.loss) * 100) : 0;
            return (
              <div key={r.s} className="rounded-xl bg-white/[0.03] ring-1 ring-white/[0.05] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: r.meta.color }} />
                    <span className="text-sm text-white font-medium">{r.meta.code}</span>
                    <span className="text-xs text-slate-400 truncate">{r.meta.name.replace(r.meta.code, '').replace(/^\s*\(|\)\s*$/g, '').trim()} · {r.meta.warming2100}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm tabular-nums">
                    <span className="text-slate-400 text-xs">score {r.avgScore}</span>
                    <span className="text-xs w-16 text-right" style={{ color: r.s === 'ssp119' ? '#94a3b8' : delta > 0 ? '#fca5a5' : '#6ee7b7' }}>
                      {r.s === 'ssp119' ? 'baseline' : `${delta > 0 ? '+' : ''}${delta}%`}
                    </span>
                    <span className="text-white font-semibold w-20 text-right">{formatCurrencyUsd(r.loss)}</span>
                  </div>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/[0.05] overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(r.loss / max) * 100}%`, backgroundColor: r.meta.color }} />
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-sm text-slate-300">
          In the {decade}s, {metricLabel.toLowerCase()} under <b>SSP5-8.5</b> is <b>{formatCurrencyUsd(worst.loss)}</b> — {uplift >= 0 ? `${uplift}% higher` : `${Math.abs(uplift)}% lower`} than the 1.5°C-aligned <b>SSP1-1.9</b> pathway ({formatCurrencyUsd(base.loss)}).
        </p>
      </div>

      <div className="px-6 py-3 border-t border-white/[0.06] flex justify-end">
        <Button onClick={onClose}>Close</Button>
      </div>
    </ModalShell>
  );
};
