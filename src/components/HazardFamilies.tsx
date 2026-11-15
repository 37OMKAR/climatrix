import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Radio } from 'lucide-react';
import { AssetRiskAssessment, HazardFamily, HazardType } from '../types/climate';
import { ALL_HAZARDS, HAZARD_CATALOG, HAZARD_FAMILIES, HAZARD_TAXONOMY, RATING_HEX, getRatingFromScore } from '../services/climateEngine';
import { cx } from './ui';

const LIVE_HAZARDS: HazardType[] = ['extreme_heat', 'extreme_cold', 'pluvial_flood', 'fluvial_flood', 'earthquake', 'extratropical_storm'];
const fmt = (v: number) => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString() : Number(v.toFixed(2)).toString());

export const familyMeta = (f: HazardFamily) => HAZARD_FAMILIES.find((x) => x.id === f)!;

/** Hazards grouped by family, families sorted by score; zero-exposure hazards collapse into one line. */
export const HazardFamilyList: React.FC<{
  assessment: AssetRiskAssessment;
  selected?: HazardType;
  onSelect?: (h: HazardType) => void;
  compact?: boolean;
}> = ({ assessment: a, selected, onSelect, compact }) => {
  const fams = [...a.familyScores].sort((x, y) => y.score - x.score);
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(fams.map((f, i) => [f.family, !compact || i < 1])));

  return (
    <div className="space-y-2">
      {fams.map((f) => {
        const m = familyMeta(f.family);
        const members = ALL_HAZARDS.filter((h) => HAZARD_TAXONOMY[h].family === f.family).map((h) => a.hazardResults[h]).sort((x, y) => y.score - x.score);
        const exposed = members.filter((h) => h.score > 0);
        const notExposed = members.filter((h) => h.score === 0);
        const rating = getRatingFromScore(f.score);
        const isOpen = open[f.family];
        return (
          <div key={f.family} className="rounded-xl bg-white/[0.02] ring-1 ring-white/[0.05]">
            <button
              onClick={() => setOpen((o) => ({ ...o, [f.family]: !o[f.family] }))}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
              aria-expanded={isOpen}
            >
              {isOpen ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
              <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: m.color }} />
              <span className="text-sm text-white flex-1 truncate">{m.name}</span>
              <span className="text-xs text-slate-400 hidden sm:inline" title="hazards with any exposure / hazards in family">{exposed.length}/{members.length}</span>
              <div className="w-20 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${f.score}%`, backgroundColor: RATING_HEX[rating] }} />
              </div>
              <span className="w-7 text-right text-sm tabular-nums text-white">{Math.round(f.score)}</span>
            </button>
            {isOpen && (
              <div className="px-3 pb-3 space-y-2">
                {exposed.map((h) => {
                  const meta = HAZARD_CATALOG[h.hazardId];
                  const isLive = a.usesLiveData && LIVE_HAZARDS.includes(h.hazardId) && h.confidenceScore === 'High';
                  const sel = selected === h.hazardId;
                  const Row = onSelect ? 'button' : 'div';
                  return (
                    <Row
                      key={h.hazardId}
                      {...(onSelect ? { onClick: () => onSelect(h.hazardId) } : {})}
                      className={cx('block w-full text-left rounded-lg px-2 py-1.5', onSelect && 'hover:bg-white/[0.04]', sel && 'bg-white/[0.06] ring-1 ring-cyan-400/50')}
                      title={`${meta.name}: ${fmt(h.absoluteValue)} ${h.unit} · ${h.rating}`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1 gap-2">
                        <span className="text-slate-200 flex items-center gap-1.5 min-w-0">
                          <span className="truncate">{meta.shortName}</span>
                          {h.hazardId === a.primaryHazard && <span className="text-[11px] px-1.5 rounded bg-white/[0.08] text-slate-300 shrink-0">main</span>}
                          {isLive && <span className="text-[11px] px-1.5 rounded bg-emerald-400/15 text-emerald-200 shrink-0 inline-flex items-center gap-1"><Radio className="w-2.5 h-2.5" />live</span>}
                          {!HAZARD_TAXONOMY[h.hazardId].climateDriven && <span className="text-[11px] text-slate-400 shrink-0">not climate-driven</span>}
                        </span>
                        <span className="tabular-nums shrink-0">
                          {!compact && <span className="text-slate-400">{fmt(h.absoluteValue)} {h.unit}</span>}
                          <span className="text-slate-200 ml-2 inline-block w-7 text-right">{Math.round(h.score)}</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${h.score}%`, backgroundColor: RATING_HEX[h.rating] }} />
                      </div>
                    </Row>
                  );
                })}
                {notExposed.length > 0 && (
                  <div className="text-xs text-slate-400 px-2">Not exposed: {notExposed.map((h) => HAZARD_CATALOG[h.hazardId].shortName).join(', ')}</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
