import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LocationPage } from './pages/LocationPage';
import { PortfolioPage, siteKey } from './pages/PortfolioPage';
import { UploadPage } from './pages/UploadPage';
import { MethodologyPage } from './pages/MethodologyPage';
import type { Theme } from './ui/MapView';
import { cx } from './ui/kit';
import { getSite, cachedSite, type SiteParams } from './engine/assess';
import { geocodeLoan, usable, type Loan } from './engine/portfolio';
import { setOpenMeteoKey } from './data/api';
import type { Scenario, Year } from './engine/hazards';
import { DEFAULT_FX, type NgfsScenario, type FxSettings } from './engine/transition';
import { idbClear } from './data/idb';

type Page = 'location' | 'portfolio' | 'upload' | 'method';
const LS = { settings: 'climaris:settings:v1', loans: 'climaris:loans:v1' };
const load = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? { ...d, ...JSON.parse(v) } : d; } catch { return d; } };

export default function App() {
  const init = load(LS.settings, { theme: 'light' as Theme, scenario: 'ssp245' as Scenario, year: 2050 as Year, horizon: 'maturity' as 'maturity' | 'fixed', apiKey: '', ngfs: 'NZ' as NgfsScenario, fx: DEFAULT_FX as FxSettings });
  const [page, setPage] = useState<Page>('location');
  const [theme, setTheme] = useState<Theme>(init.theme);
  const [scenario, setScenario] = useState<Scenario>(init.scenario);
  const [year, setYear] = useState<Year>(init.year);
  const [horizon, setHorizon] = useState(init.horizon);
  const [apiKey, setApiKey] = useState(init.apiKey);
  const [ngfs, setNgfs] = useState<NgfsScenario>(init.ngfs);
  const [fx, setFx] = useState<FxSettings>(init.fx);
  const [loans, setLoans] = useState<Loan[]>(() => { try { return JSON.parse(localStorage.getItem(LS.loans) ?? '[]'); } catch { return []; } });
  const [sites, setSites] = useState<Record<string, SiteParams>>({});
  const [run, setRun] = useState<{ phase: 'idle' | 'geocoding' | 'assessing'; done: number; total: number; error?: string }>({ phase: 'idle', done: 0, total: 0 });
  const [cacheCount, setCacheCount] = useState(0);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { setOpenMeteoKey(apiKey); }, [apiKey]);
  useEffect(() => { localStorage.setItem(LS.settings, JSON.stringify({ theme, scenario, year, horizon, apiKey, ngfs, fx })); }, [theme, scenario, year, horizon, apiKey, ngfs, fx]);
  useEffect(() => { try { localStorage.setItem(LS.loans, JSON.stringify(loans)); } catch { /* quota */ } }, [loans]);
  useEffect(() => { setCacheCount(Object.keys(localStorage).filter((k) => k.startsWith('climaris:site:')).length); }, [sites, page]);

  /** Geocode pending loans, then fetch open data for each distinct site (2 at a time). */
  const process = useCallback(async (list: Loan[]) => {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    let cur = list;
    try {
      const pending = cur.filter((l) => l.geo.status === 'pending');
      if (pending.length) {
        setRun({ phase: 'geocoding', done: 0, total: pending.length });
        let i = 0;
        for (const l of pending) {
          const g = await geocodeLoan(l, ctl.signal);
          cur = cur.map((x) => (x.key === l.key ? g : x));
          setLoans(cur);
          setRun({ phase: 'geocoding', done: ++i, total: pending.length });
        }
      }
      const keys = [...new Set(cur.filter(usable).map((l) => siteKey(l.lat!, l.lon!)))];
      const have: Record<string, SiteParams> = {};
      for (const k of keys) { const [a, b] = k.split(',').map(Number); const c = cachedSite(a, b); if (c) have[k] = c; }
      setSites((s) => ({ ...s, ...have }));
      const todo = keys.filter((k) => !have[k]);
      setRun({ phase: 'assessing', done: 0, total: todo.length });
      let done = 0;
      const worker = async () => {
        while (todo.length && !ctl.signal.aborted) {
          const k = todo.shift()!;
          const [a, b] = k.split(',').map(Number);
          const s = await getSite(a, b, undefined, ctl.signal);
          setSites((m) => ({ ...m, [k]: s }));
          setRun({ phase: 'assessing', done: ++done, total: keys.length - Object.keys(have).length });
        }
      };
      await Promise.all([worker(), worker()]);
      setRun({ phase: 'idle', done: 0, total: 0 });
    } catch (e) {
      if (!ctl.signal.aborted) setRun({ phase: 'idle', done: 0, total: 0, error: `Stopped: ${(e as Error).message}. Finished sites are kept; press Retry to continue.` });
    }
  }, []);

  // pick up cached sites (and continue unfinished work) on first load
  useEffect(() => { if (loans.length) process(loans); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const importLoans = (incoming: Loan[], mode: 'replace' | 'append') => {
    const stamp = Date.now().toString(36);
    const next = [...(mode === 'append' ? loans : []), ...incoming.map((l) => ({ ...l, key: `${stamp}-${l.key}` }))];
    setLoans(next); setPage('portfolio'); process(next);
  };

  const NAV: Array<[Page, string]> = [['location', 'Location'], ['portfolio', 'Portfolio'], ['upload', 'Upload'], ['method', 'Methodology']];
  return (
    <div className="min-h-screen">
      <header className="bg-panel border-b border-line sticky top-0 z-[600]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 min-h-16 flex flex-wrap items-center gap-x-7 gap-y-2 py-2">
          <div className="flex items-center gap-2">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.6" aria-hidden="true"><path d="M5 21V3h8a5 5 0 010 10H5" /><path d="M12 13l7 8" /></svg>
            <span className="text-lg font-bold tracking-wide">CLIMARIS</span>
          </div>
          <nav aria-label="Main" className="flex flex-wrap gap-0.5 text-sm">
            {NAV.map(([id, label]) => (
              <button key={id} onClick={() => setPage(id)} aria-current={page === id ? 'page' : undefined}
                className={cx('px-3 py-2.5 rounded-lg', page === id ? 'font-semibold text-ink' : 'text-muted hover:text-ink')}>
                {label}{id === 'portfolio' && loans.length ? <span className="ml-1.5 text-xs text-muted tabular">{loans.length}</span> : null}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted hidden sm:inline">Theme</span>
            <div className="inline-flex gap-0.5 p-[3px] rounded-full bg-chip" role="radiogroup" aria-label="Theme">
              {(['light', 'dark', 'ocean'] as Theme[]).map((t) => (
                <button key={t} role="radio" aria-checked={theme === t} onClick={() => setTheme(t)}
                  className={cx('min-h-8 px-3 rounded-full text-xs font-semibold capitalize', theme === t ? 'bg-accent text-on-accent' : 'text-muted')}>{t}</button>
              ))}
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-4">
        {page === 'location' && <LocationPage theme={theme} scenario={scenario} year={year} setScenario={setScenario} setYear={setYear} ngfs={ngfs} setNgfs={setNgfs} fx={fx}
          onAddLoan={(l) => { const next = [...loans, l]; setLoans(next); process(next); setPage('portfolio'); }} />}
        {page === 'portfolio' && <PortfolioPage theme={theme} loans={loans} sites={sites} scenario={scenario} year={year} ngfs={ngfs} setNgfs={setNgfs} fx={fx} horizon={horizon} setHorizon={setHorizon} run={run}
          onUpload={() => setPage('upload')} onClear={() => { abort.current?.abort(); setLoans([]); setRun({ phase: 'idle', done: 0, total: 0 }); }} onRetry={() => process(loans)} />}
        {page === 'upload' && <UploadPage onImport={importLoans} />}
        {page === 'method' && <MethodologyPage apiKey={apiKey} onApiKey={setApiKey} cacheCount={cacheCount} fx={fx} onFx={setFx}
          onClearRasters={() => idbClear()}
          onClearCache={() => { Object.keys(localStorage).filter((k) => k.startsWith('climaris:site:')).forEach((k) => localStorage.removeItem(k)); setSites({}); setCacheCount(0); }} />}
      </main>
      <footer className="max-w-[1440px] mx-auto px-6 pb-6 text-xs text-muted">CLIMARIS · physical climate risk from open data · results are screening estimates, see Methodology for sources and limits.</footer>
    </div>
  );
}
