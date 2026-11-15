import React, { useEffect, useRef, useState } from 'react';
import {
  Globe2,
  Upload,
  PlusCircle,
  Building2,
  Landmark,
  GitCompare,
  MapPin,
  ChevronDown,
  BookOpen,
  LayoutDashboard,
  FileText,
  Check,
  FolderOpen,
  Plus,
  Info,
} from 'lucide-react';
import { Decade, ReturnPeriod, SSPScenario } from '../types/climate';
import { SSP_SCENARIOS, formatCurrencyUsd, ALL_ASSET_TYPES } from '../services/climateEngine';
import { Segmented, Button, cx } from './ui';

export type AppTab = 'dashboard' | 'map' | 'reporting' | 'sovereigns' | 'corporate';

export interface PortfolioOption {
  id: string;
  name: string;
  description?: string;
  assetCount: number;
  totalValueUsd: number;
}

interface NavbarProps {
  currentScenario: SSPScenario;
  onScenarioChange: (scenario: SSPScenario) => void;
  currentDecade: Decade;
  onDecadeChange: (decade: Decade) => void;
  currentReturnPeriod: ReturnPeriod;
  onReturnPeriodChange: (rp: ReturnPeriod) => void;
  showControls?: boolean;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  portfolios: PortfolioOption[];
  activePortfolioId: string;
  activePortfolioName: string;
  onSelectPortfolio: (portfolioId: string) => void;
  onOpenUpload: () => void;
  onOpenAddAsset: () => void;
  onOpenTaxonomy: () => void;
  onOpenReport: () => void;
  onOpenCompare: () => void;
  onOpenMethods: () => void;
  onExportCsv: () => void;
  totalAssets: number;
  totalValueUsd: number;
}

const DECADES: Decade[] = [2025, 2030, 2040, 2050, 2060, 2070, 2080, 2090];
export const RETURN_PERIOD_OPTIONS: { id: ReturnPeriod; label: string; tooltip: string }[] = [
  { id: 'aal', label: 'Avg year', tooltip: 'Average Annual Loss — the long-run yearly average' },
  { id: '10yr', label: '1-in-10', tooltip: '1-in-10 year event (10% chance each year)' },
  { id: '50yr', label: '1-in-50', tooltip: '1-in-50 year event (2% chance each year)' },
  { id: '100yr', label: '1-in-100', tooltip: '1-in-100 year event (1% chance each year)' },
  { id: '250yr', label: '1-in-250', tooltip: '1-in-250 year event (0.4% chance each year)' },
  { id: '500yr', label: '1-in-500', tooltip: '1-in-500 year event (0.2% chance each year)' },
];

const TABS: { id: AppTab; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'map', label: 'Map', icon: <MapPin className="w-4 h-4" /> },
  { id: 'reporting', label: 'Reporting', icon: <FileText className="w-4 h-4" /> },
  { id: 'sovereigns', label: 'Countries', icon: <Landmark className="w-4 h-4" /> },
  { id: 'corporate', label: 'Companies', icon: <Building2 className="w-4 h-4" /> },
];

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOutside: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onOutside();
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('keydown', k);
    };
  }, [ref, onOutside, active]);
}

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500 mr-2 whitespace-nowrap hidden lg:inline">{children}</span>
);

export const Navbar: React.FC<NavbarProps> = (p) => {
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const portfolioRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLDivElement>(null);
  useClickOutside(portfolioRef, () => setPortfolioOpen(false), portfolioOpen);
  useClickOutside(addRef, () => setAddOpen(false), addOpen);

  const scenario = SSP_SCENARIOS[p.currentScenario];

  return (
    <header className="sticky top-0 z-[500] border-b border-white/[0.06] bg-[#0b1020]/85 backdrop-blur-xl no-print">
      {/* Row 1: brand, tabs, actions */}
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 h-14 flex items-center gap-4">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-400 to-indigo-500 flex items-center justify-center">
            <Globe2 className="w-[18px] h-[18px] text-slate-950" />
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold text-white tracking-tight">ClimaRisk</div>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-0 lg:gap-0.5 min-w-0 flex-1 overflow-x-auto" aria-label="Main">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => p.onTabChange(t.id)}
              aria-current={p.activeTab === t.id ? 'page' : undefined}
              title={t.label}
              aria-label={t.label}
              className={cx(
                'flex items-center gap-1.5 lg:gap-2 rounded-lg px-2 lg:px-3 py-1.5 text-sm transition-colors whitespace-nowrap',
                p.activeTab === t.id ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]',
              )}
            >
              {t.icon}
              <span className="hidden md:inline text-xs lg:text-sm">{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Portfolio switcher */}
          <div className="relative" ref={portfolioRef}>
            <button
              onClick={() => setPortfolioOpen((v) => !v)}
              aria-expanded={portfolioOpen}
              className="flex items-center gap-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] ring-1 ring-inset ring-white/[0.06] px-3 py-1.5 text-sm text-slate-100 max-w-[44px] lg:max-w-[280px]"
            >
              <FolderOpen className="w-4 h-4 text-cyan-300 shrink-0" />
              <span className="truncate hidden lg:inline">{p.activePortfolioName}</span>
              <span className="text-xs text-slate-400 tabular-nums shrink-0 hidden lg:inline">
                {p.totalAssets} · {formatCurrencyUsd(p.totalValueUsd)}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 hidden lg:block" />
            </button>
            {portfolioOpen && (
              <div className="absolute right-0 mt-2 w-[380px] rounded-2xl border border-white/[0.08] bg-slate-900 p-1.5 shadow-2xl pop-in">
                <div className="px-3 pt-2 pb-1.5 text-[11px] uppercase tracking-wide text-slate-500">Portfolios</div>
                {p.portfolios.map((pf) => {
                  const active = pf.id === p.activePortfolioId;
                  return (
                    <button
                      key={pf.id}
                      onClick={() => {
                        p.onSelectPortfolio(pf.id);
                        setPortfolioOpen(false);
                      }}
                      className={cx('w-full text-left rounded-xl px-3 py-2 flex items-start gap-2.5 transition-colors', active ? 'bg-cyan-500/10' : 'hover:bg-white/[0.04]')}
                    >
                      <Check className={cx('w-4 h-4 mt-0.5 shrink-0', active ? 'text-cyan-300' : 'text-transparent')} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-white truncate">{pf.name}</span>
                          <span className="text-xs text-slate-400 tabular-nums shrink-0">
                            {pf.assetCount} · {formatCurrencyUsd(pf.totalValueUsd)}
                          </span>
                        </div>
                        {pf.description && <div className="text-xs text-slate-500 truncate mt-0.5">{pf.description}</div>}
                      </div>
                    </button>
                  );
                })}
                <div className="border-t border-white/[0.06] mt-1.5 pt-1.5">
                  <button
                    onClick={() => {
                      setPortfolioOpen(false);
                      p.onOpenUpload();
                    }}
                    className="w-full text-left rounded-xl px-3 py-2 text-sm text-cyan-300 hover:bg-white/[0.04] flex items-center gap-2.5"
                  >
                    <Upload className="w-4 h-4" /> Import your own CSV…
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Add menu */}
          <div className="relative" ref={addRef}>
            <Button variant="secondary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setAddOpen((v) => !v)} aria-expanded={addOpen}>
              <span className="hidden sm:inline">Add</span>
            </Button>
            {addOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-white/[0.08] bg-slate-900 p-1.5 shadow-2xl pop-in">
                {[
                  { icon: <PlusCircle className="w-4 h-4 text-emerald-300" />, label: 'Add a site', sub: 'By coordinates or city preset', fn: p.onOpenAddAsset },
                  { icon: <Upload className="w-4 h-4 text-cyan-300" />, label: 'Import CSV', sub: 'Replace or append a portfolio', fn: p.onOpenUpload },
                  { icon: <BookOpen className="w-4 h-4 text-violet-300" />, label: 'Browse asset types', sub: `${ALL_ASSET_TYPES.length} asset types with damage profiles`, fn: p.onOpenTaxonomy },
                ].map((it) => (
                  <button
                    key={it.label}
                    onClick={() => {
                      setAddOpen(false);
                      it.fn();
                    }}
                    className="w-full text-left rounded-xl px-3 py-2 hover:bg-white/[0.04] flex items-start gap-2.5"
                  >
                    <span className="mt-0.5">{it.icon}</span>
                    <span>
                      <span className="block text-sm text-white">{it.label}</span>
                      <span className="block text-xs text-slate-500">{it.sub}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button variant="primary" size="sm" icon={<FileText className="w-4 h-4" />} onClick={p.onOpenReport}>
            <span className="hidden lg:inline">Report</span>
          </Button>
        </div>
      </div>

      {/* Mobile tabs (below md) */}
      <nav className="md:hidden grid grid-cols-5 border-t border-white/[0.04]" aria-label="Main">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => p.onTabChange(t.id)}
            aria-current={p.activeTab === t.id ? 'page' : undefined}
            className={cx('flex flex-col items-center gap-0.5 py-1.5 text-[11px]', p.activeTab === t.id ? 'text-white' : 'text-slate-400')}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>

      {/* Row 2: model controls (hidden on reference-data tabs) */}
      {p.showControls === false ? (
        <div className="border-t border-white/[0.04]">
          <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-2.5 text-xs text-slate-400">
            Reference data (around 2050, middle-of-the-road warming). Not affected by the scenario, year and event size controls.
          </div>
        </div>
      ) : (
      <div className="border-t border-white/[0.04]">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-2 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="relative flex items-center min-w-0 max-w-full overflow-x-auto">
            <Label>Scenario</Label>
            <Segmented
              size="sm"
              ariaLabel="Emissions scenario"
              value={p.currentScenario}
              onChange={p.onScenarioChange}
              options={(Object.keys(SSP_SCENARIOS) as SSPScenario[]).map((k) => ({
                value: k,
                dot: SSP_SCENARIOS[k].color,
                label: (
                  <>
                    {SSP_SCENARIOS[k].code}
                    <span className="opacity-60 hidden 2xl:inline">{SSP_SCENARIOS[k].warming2100}</span>
                  </>
                ),
                title: `${SSP_SCENARIOS[k].name} · ${SSP_SCENARIOS[k].warming2100} by 2100 · NGFS: ${SSP_SCENARIOS[k].ngfsEquivalent}`,
              }))}
            />
          </div>

          <div className="relative flex items-center min-w-0 max-w-full overflow-x-auto">
            <Label>Year</Label>
            <Segmented
              size="sm"
              ariaLabel="Projection decade"
              value={p.currentDecade}
              onChange={p.onDecadeChange}
              options={DECADES.map((d) => ({ value: d, label: d === 2025 ? 'Now' : `’${String(d).slice(2)}`, title: d === 2025 ? 'Today' : `${d}s` }))}
            />
          </div>

          <div className="relative flex items-center min-w-0 max-w-full overflow-x-auto">
            <Label>Event size</Label>
            <Segmented
              size="sm"
              ariaLabel="Return period"
              value={p.currentReturnPeriod}
              onChange={p.onReturnPeriodChange}
              options={RETURN_PERIOD_OPTIONS.map((r) => ({ value: r.id, label: r.label, title: r.tooltip }))}
            />
          </div>

          <div className="ml-auto flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="sm" icon={<GitCompare className="w-4 h-4" />} onClick={p.onOpenCompare} title="Compare all five scenarios side by side">
              <span className="hidden xl:inline">Compare</span>
            </Button>
            <Button variant="ghost" size="sm" icon={<Info className="w-4 h-4" />} onClick={p.onOpenMethods} title="Hazards, data sources and how scores are calculated">
              <span className="hidden xl:inline">How it works</span>
            </Button>
          </div>
        </div>
        <div className="sr-only" aria-live="polite">
          Showing {scenario.code}, {p.currentDecade}
        </div>
      </div>
      )}
    </header>
  );
};
