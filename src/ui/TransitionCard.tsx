import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Card, Field, inputCls, RatingChip } from './kit';
import type { SiteParams } from '../engine/assess';
import { ratingOf } from '../engine/hazards';
import {
  transitionFor, NGFS_SCENARIOS, IAM_NAME, GCAM_REGION_LABEL, toInrPerTonne, HEATMAP,
  type NgfsScenario, type FxSettings, type IamModel,
} from '../engine/transition';
import { inr, num } from '../lib/format';

const fmtT = (t: number) => (t >= 1e6 ? `${num(t / 1e6, 2)} Mt` : t >= 1e3 ? `${num(t / 1e3, 1)} kt` : `${num(t, 0)} t`);

export const TransitionCard: React.FC<{
  site: SiteParams | null; sector: string; onSector?: (s: string) => void; ngfs: NgfsScenario; onNgfs: (s: NgfsScenario) => void; year: number; fx: FxSettings;
}> = ({ site, sector, onSector, ngfs, onNgfs, year, fx }) => {
  const iso3 = site?.admin?.iso3;
  const t = transitionFor(sector, iso3, ngfs, year);
  const models: IamModel[] = ['G', 'R', 'M'];
  const prices = models.map((m) => t.price[m]).filter(Number.isFinite);
  const trace = site?.trace;
  return (
    <Card title="Transition risk" sub={`UNEP FI heatmap · NGFS Phase V carbon price at ${year}`}
      right={t.segment ? <RatingChip rating={ratingOf(t.score)} score={t.score} small /> : null}>
      <div className="flex flex-col gap-3 text-[13px]">
        <div className="flex flex-wrap gap-2">
          {onSector && (
            <Field label="Borrower sector / purpose" className="flex-1 min-w-[160px]">
              <input list="unep-segments" value={sector} onChange={(e) => onSector(e.target.value)} placeholder="e.g. cement plant, home loan, solar" className={inputCls} />
              <datalist id="unep-segments">{HEATMAP.map((h) => <option key={h.segment} value={h.segment} />)}</datalist>
            </Field>
          )}
          <Field label="NGFS scenario" className="flex-1 min-w-[150px]">
            <select value={ngfs} onChange={(e) => onNgfs(e.target.value as NgfsScenario)} className={inputCls}>
              {NGFS_SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Field>
        </div>
        {t.segment ? (
          <p><span className="font-semibold">{t.segment.sector} · {t.segment.segment}</span><span className="text-muted"> — UNEP FI rating “{t.segment.rating}” under an ambitious (≤ 2 °C) transition.</span></p>
        ) : (
          <p className="text-muted">{sector ? `“${sector}” does not match a UNEP FI heatmap segment; pick one from the list.` : 'Enter the borrower’s sector to rate its transition sensitivity.'}</p>
        )}
        {site && (iso3 ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted">Carbon price in {site.admin!.country} ({NGFS_SCENARIOS.find((s) => s.id === ngfs)!.label}), US$2010 / t CO₂ and ₹ / t (2024 prices):</p>
            <table className="w-full text-[12.5px]">
              <tbody>
                {models.map((m) => (
                  <tr key={m} className="border-t border-line">
                    <td className="py-1.5 pr-2">{IAM_NAME[m]}<span className="block text-[11px] text-muted">{m === 'G' ? GCAM_REGION_LABEL(t.regions.G) : t.regions[m] ?? 'region not mapped'}</span></td>
                    <td className="py-1.5 px-2 text-right tabular text-muted">{Number.isFinite(t.priceNow[m]) ? `$${num(t.priceNow[m], 0)} now` : '—'}</td>
                    <td className="py-1.5 pl-2 text-right tabular font-semibold">{Number.isFinite(t.price[m]) ? `$${num(t.price[m], 0)}` : '—'}<span className="block text-[11px] font-normal text-muted">{Number.isFinite(t.price[m]) ? `${inr(toInrPerTonne(t.price[m], fx))}/t` : ''}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {prices.length > 1 && <p className="text-xs text-muted">Model range at {year}: ${num(Math.min(...prices), 0)}–{num(Math.max(...prices), 0)} / t. ₹ at {fx.usdInr} ₹/US$ ({fx.asOf}).{year > 2070 ? ' Prices held at their 2070 level.' : ''}</p>}
          </div>
        ) : <p className="text-xs text-muted">Country could not be resolved for this point, so no carbon price is shown.</p>)}
        {site && trace && ('error' in trace ? (
          <p className="text-xs text-muted">Climate TRACE unavailable: {trace.error}</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted">Emitting assets within {trace.withinKm} km (Climate TRACE): {trace.count} totalling {fmtT(trace.total)} CO₂e / yr</p>
            {trace.sources.slice(0, 5).map((s, i) => (
              <div key={i} className="flex items-baseline gap-2"><span className="flex-1 truncate" title={s.name}>{s.name}<span className="text-muted text-xs"> · {s.subsector.replace(/-/g, ' ')} · {num(s.km, 0)} km</span></span><span className="tabular text-xs">{fmtT(s.t)}</span></div>
            ))}
          </div>
        ))}
        <p className="flex flex-wrap gap-x-3 text-xs">
          <a className="text-accent hover:underline inline-flex items-center gap-1" href="https://www.unepfi.org/industries/banking/beyond-the-horizon/" target="_blank" rel="noreferrer">UNEP FI heatmap<ExternalLink className="w-3 h-3" /></a>
          <a className="text-accent hover:underline inline-flex items-center gap-1" href="https://data.ece.iiasa.ac.at/ngfs/" target="_blank" rel="noreferrer">NGFS Phase V<ExternalLink className="w-3 h-3" /></a>
          <a className="text-accent hover:underline inline-flex items-center gap-1" href="https://climatetrace.org/" target="_blank" rel="noreferrer">Climate TRACE<ExternalLink className="w-3 h-3" /></a>
        </p>
      </div>
    </Card>
  );
};
