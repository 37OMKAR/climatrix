import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { FAMILIES, HAZARDS, HAZARD, type Family, type Scenario, type Year, SCENARIOS } from '../engine/hazards';
import { hazardAt, type SiteParams } from '../engine/assess';
import { SOURCES } from '../data/api';
import { RatingChip, Tabs } from './kit';

export const fmtValue = (id: string, v: number, unit?: string) => {
  if (!Number.isFinite(v)) return '—';
  const u = unit ?? HAZARD[id as keyof typeof HAZARD].unit;
  const d = u === 'g' ? 3 : u === 'm' || u === 'index' || u === 'probability' || u.startsWith('strokes') ? 2 : u === '°C' || u === '/5' || u === 'mm/yr' || u === 'cm/yr' ? 1 : 0;
  const num = v.toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d === 3 ? 3 : 0 });
  if (u === '°') return `${num}°`;
  if (u === '/5') return `${num} / 5`;
  return `${num}${u && u !== 'index' && u !== 'probability' ? ` ${u}` : ''}`;
};

export const HazardTable: React.FC<{ site: SiteParams | null; loading?: boolean; scenario: Scenario; year: Year }> = ({ site, loading, scenario, year }) => {
  const [fam, setFam] = useState<'all' | Family>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [showNa, setShowNa] = useState(false);
  const inFam = HAZARDS.filter((h) => fam === 'all' || h.family === fam);
  const scoreOf = (id: (typeof HAZARDS)[number]['id']) => { if (!site) return -1; const v = hazardAt(site, id, scenario, year); return v.status === 'ok' ? v.score : -1; };
  const assessedRows = inFam.filter((h) => !h.notAssessed).sort((a, b) => scoreOf(b.id) - scoreOf(a.id));
  const naRows = inFam.filter((h) => h.notAssessed);
  const rows = [...assessedRows, ...(showNa ? naRows : [])];
  const sc = SCENARIOS.find((s) => s.id === scenario)!;
  return (
    <section className="rounded-2xl bg-panel border border-line overflow-hidden">
      <div className="px-4 py-3.5 flex flex-wrap items-center gap-3">
        <h2 className="text-[17px] font-bold flex-1">Physical risks <span className="text-muted font-medium text-sm">· {HAZARDS.filter((h) => !h.notAssessed).length} assessed, {HAZARDS.filter((h) => h.notAssessed).length} listed</span></h2>
        <Tabs dark label="Hazard group" value={fam} onChange={setFam}
          options={[{ value: 'all', label: 'All' }, ...FAMILIES.map((f) => ({ value: f.id, label: f.short }))]} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[860px]">
          <thead>
            <tr className="text-left text-xs text-muted bg-chip">
              <th className="py-2.5 pl-4 pr-2 font-medium w-8" />
              <th className="py-2.5 px-2 font-medium">Hazard</th>
              <th className="py-2.5 px-2 font-medium">Indicator</th>
              <th className="py-2.5 px-2 font-medium text-right">Now</th>
              <th className="py-2.5 px-2 font-medium text-right">{year} · {sc.label}</th>
              <th className="py-2.5 px-2 font-medium">Rating</th>
              <th className="py-2.5 pl-2 pr-4 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => {
              const now = site ? hazardAt(site, h.id, scenario, 2025) : null;
              const fut = site ? hazardAt(site, h.id, scenario, year) : null;
              const isOpen = open === h.id;
              const status = h.notAssessed ? 'na' : !site ? (loading ? 'loading' : 'idle') : fut!.status;
              return (
                <React.Fragment key={h.id}>
                  <tr className="border-t border-line hover:bg-chip/60 cursor-pointer" onClick={() => setOpen(isOpen ? null : h.id)}>
                    <td className="py-3 pl-4 pr-2 text-muted">{isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</td>
                    <td className="py-3 px-2"><span className="font-semibold">{h.name}</span><span className="block text-xs text-muted">{FAMILIES.find((f) => f.id === h.family)!.name} · {h.acute ? 'acute' : 'chronic'}</span></td>
                    <td className="py-3 px-2 text-muted">{h.notAssessed ? '—' : h.indicator}</td>
                    <td className="py-3 px-2 text-right tabular">{status === 'ok' ? fmtValue(h.id, now!.value, now!.unit) : <Dim s={status} />}</td>
                    <td className="py-3 px-2 text-right tabular font-semibold">{status === 'ok' ? fmtValue(h.id, fut!.value, fut!.unit) : <Dim s={status} />}</td>
                    <td className="py-3 px-2">{status === 'ok' ? <RatingChip rating={fut!.rating} score={fut!.score} small /> : status === 'na' ? <span className="text-xs text-muted">Not assessed</span> : status === 'error' ? <span className="text-xs text-[#dc2626]">Data error</span> : <span className="text-xs text-muted">{status === 'loading' ? 'Fetching…' : '—'}</span>}</td>
                    <td className="py-3 pl-2 pr-4 text-muted text-xs max-w-[220px] truncate">{h.sources.map((s) => SOURCES[s].name.split(' (')[0]).join(' · ') || '—'}</td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-chip/50">
                      <td />
                      <td colSpan={6} className="py-3 pr-4 text-[13px] leading-relaxed">
                        {h.notAssessed ? <p className="text-muted">{h.notAssessed}</p> : (
                          <div className="flex flex-col gap-1.5">
                            <p><span className="font-semibold">Method: </span>{h.method}</p>
                            {h.scoreNote && <p className="text-muted">Scale: {h.scoreNote}</p>}
                            {fut?.extra && <p className="text-muted">{fut.extra}</p>}
                            {fut?.note && <p className="text-muted">{fut.note}</p>}
                            {fut?.error && <p className="text-[#dc2626]">Could not compute: {fut.error}</p>}
                            <p className="flex flex-wrap gap-x-4 gap-y-1">{h.sources.map((s) => (
                              <a key={s} href={SOURCES[s].url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">{SOURCES[s].name}<ExternalLink className="w-3 h-3" /></a>
                            ))}</p>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {naRows.length > 0 && (
              <tr className="border-t border-line">
                <td colSpan={7} className="py-2.5 px-4">
                  <button onClick={() => setShowNa((v) => !v)} className="text-[13px] text-muted hover:text-ink">
                    {showNa ? 'Hide' : 'Show'} {naRows.length} hazard{naRows.length > 1 ? 's' : ''} not assessed (no open global data source): {naRows.map((h) => h.name).join(', ')}
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
const Dim: React.FC<{ s: string }> = ({ s }) => <span className="text-muted font-normal">{s === 'loading' ? '…' : '—'}</span>;
