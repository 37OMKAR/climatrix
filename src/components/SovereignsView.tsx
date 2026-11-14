import React, { useState } from 'react';
import {
  GLOBAL_SOVEREIGNS,
  US_COUNTIES_SAMPLE,
  USCountyProfile,
} from '../services/sovereignData';
import { SovereignRiskProfile } from '../types/climate';
import {
  HAZARD_CATALOG,
  queryLocationClimateData,
  PointClimateDiagnostic,
} from '../services/climateEngine';
import {
  Landmark,
  ShieldAlert,
  Globe2,
  Search,
  Filter,
  Flag,
  ChevronLeft,
  ChevronRight,
  Crosshair,
} from 'lucide-react';

export const SovereignsView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'countries' | 'counties'>('countries');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedFiscalTier, setSelectedFiscalTier] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 8;

  const [selectedCountry, setSelectedCountry] = useState<SovereignRiskProfile | null>(GLOBAL_SOVEREIGNS[0]);
  const [selectedCounty, setSelectedCounty] = useState<USCountyProfile | null>(US_COUNTIES_SAMPLE[0]);

  // Coordinate Diagnostic Sandbox State
  const [diagLat, setDiagLat] = useState<string>('34.68');
  const [diagLon, setDiagLon] = useState<string>('-105.93');
  const [diagResult, setDiagResult] = useState<PointClimateDiagnostic | null>(() =>
    queryLocationClimateData(34.68, -105.93)
  );

  const handleRunDiagnostic = (latNum?: number, lonNum?: number) => {
    const lat = latNum !== undefined ? latNum : parseFloat(diagLat);
    const lon = lonNum !== undefined ? lonNum : parseFloat(diagLon);
    if (!isNaN(lat) && !isNaN(lon)) {
      setDiagLat(lat.toString());
      setDiagLon(lon.toString());
      const res = queryLocationClimateData(lat, lon);
      setDiagResult(res);
    }
  };

  const allRegions = Array.from(new Set(GLOBAL_SOVEREIGNS.map((c) => c.region))).sort();

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleRegionChange = (val: string) => {
    setSelectedRegion(val);
    setCurrentPage(1);
  };

  const handleFiscalTierChange = (val: string) => {
    setSelectedFiscalTier(val);
    setCurrentPage(1);
  };

  const filteredCountries = GLOBAL_SOVEREIGNS.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      c.countryName.toLowerCase().includes(q) ||
      c.countryCode.toLowerCase().includes(q) ||
      c.region.toLowerCase().includes(q);
    const matchesRegion = selectedRegion === 'all' || c.region === selectedRegion;
    const matchesTier = selectedFiscalTier === 'all' || c.fiscalVulnerabilityTier === selectedFiscalTier;
    return matchesSearch && matchesRegion && matchesTier;
  });

  const filteredCounties = US_COUNTIES_SAMPLE.filter((co) => {
    const q = searchQuery.toLowerCase();
    return (
      co.countyName.toLowerCase().includes(q) ||
      co.stateName.toLowerCase().includes(q) ||
      co.stateCode.toLowerCase().includes(q)
    );
  });

  // Country pagination
  const totalCountryPages = Math.max(1, Math.ceil(filteredCountries.length / itemsPerPage));
  const safeCountryPage = Math.min(currentPage, totalCountryPages);
  const paginatedCountries = filteredCountries.slice(
    (safeCountryPage - 1) * itemsPerPage,
    safeCountryPage * itemsPerPage
  );

  // County pagination
  const totalCountyPages = Math.max(1, Math.ceil(filteredCounties.length / itemsPerPage));
  const safeCountyPage = Math.min(currentPage, totalCountyPages);
  const paginatedCounties = filteredCounties.slice(
    (safeCountyPage - 1) * itemsPerPage,
    safeCountyPage * itemsPerPage
  );

  return (
    <div className="max-w-[1720px] mx-auto px-4 sm:px-6 py-6 space-y-6 text-slate-100">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/40 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="max-w-3xl space-y-2 relative z-10">
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs uppercase tracking-wider">
            <Landmark className="w-4 h-4" />
            <span>Sovereign & Municipal Physical Climate Intelligence</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Comprehensive Sovereign, Subnational & Municipal Risk Coverage
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Direct physical risk modeling across <strong>over 200 countries</strong>, <strong>2,100 subnational jurisdictions</strong>, and all <strong>50 U.S. states and 3,100 counties</strong>. Assessing GDP at climate risk, sovereign bond spread escalation (bps), FEMA National Risk Index scores, and ND-GAIN institutional adaptation readiness.
          </p>
        </div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      {/* Global Coordinate Climate Verification Diagnostic Bar */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
            <Crosshair className="w-4 h-4" />
            <span className="font-bold uppercase tracking-wider">Global Coordinate Verification Diagnostic</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 flex-wrap">
            <span className="text-slate-500">Presets:</span>
            <button
              onClick={() => handleRunDiagnostic(34.68, -105.93)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            >
              New Mexico (Desert Plateau)
            </button>
            <button
              onClick={() => handleRunDiagnostic(25.76, -80.19)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            >
              Miami (Coastal Surge)
            </button>
            <button
              onClick={() => handleRunDiagnostic(51.92, 4.47)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            >
              Rotterdam (Rhine Estuary)
            </button>
            <button
              onClick={() => handleRunDiagnostic(1.35, 103.82)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            >
              Singapore (Equatorial)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-4 flex items-center gap-2">
            <div className="flex-1 flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono">
              <span className="text-slate-500 mr-2">Lat:</span>
              <input
                type="text"
                value={diagLat}
                onChange={(e) => setDiagLat(e.target.value)}
                className="bg-transparent text-white w-full focus:outline-none"
                placeholder="34.68"
              />
            </div>
            <div className="flex-1 flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono">
              <span className="text-slate-500 mr-2">Lon:</span>
              <input
                type="text"
                value={diagLon}
                onChange={(e) => setDiagLon(e.target.value)}
                className="bg-transparent text-white w-full focus:outline-none"
                placeholder="-105.93"
              />
            </div>
            <button
              onClick={() => handleRunDiagnostic()}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition shadow-sm"
            >
              Verify
            </button>
          </div>

          {diagResult && (
            <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              <div>
                <span className="text-slate-500 text-[10px]">Elevation / Terrain:</span>
                <div className="font-bold text-white mt-0.5">{diagResult.elevationMeters}m MSL</div>
              </div>
              <div>
                <span className="text-slate-500 text-[10px]">Distance to Ocean:</span>
                <div className="font-bold text-cyan-300 mt-0.5">{diagResult.distanceToOceanKm} km</div>
              </div>
              <div>
                <span className="text-slate-500 text-[10px]">Coastal Flood Zero-Cut:</span>
                <div className={`font-bold mt-0.5 ${diagResult.distanceToOceanKm > 60 || diagResult.elevationMeters > 30 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {diagResult.distanceToOceanKm > 60 || diagResult.elevationMeters > 30 ? 'Zero Risk (>60km)' : 'Active Surge Zone'}
                </div>
              </div>
              <div>
                <span className="text-slate-500 text-[10px]">Köppen Climate:</span>
                <div className="font-bold text-amber-300 truncate mt-0.5" title={diagResult.koppenDescription}>
                  {diagResult.koppenClimateClass} ({diagResult.detectedLocation})
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tab Switcher & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3 rounded-xl shadow-lg">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setActiveSubTab('countries');
              setSearchQuery('');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeSubTab === 'countries'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Globe2 className="w-3.5 h-3.5" />
            <span>Global Sovereigns (200+ Countries)</span>
          </button>

          <button
            onClick={() => {
              setActiveSubTab('counties');
              setSearchQuery('');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeSubTab === 'counties'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Flag className="w-3.5 h-3.5 text-red-400" />
            <span>U.S. Municipalities & Counties (3,100 Counties)</span>
          </button>

          {activeSubTab === 'countries' && (
            <div className="flex items-center gap-2 ml-2">
              {/* Region Filter */}
              <div className="flex items-center gap-1 text-xs">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={selectedRegion}
                  onChange={(e) => handleRegionChange(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">All Regions ({GLOBAL_SOVEREIGNS.length})</option>
                  {allRegions.map((reg) => (
                    <option key={reg} value={reg}>
                      {reg}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fiscal Tier Filter */}
              <div className="flex items-center gap-1 text-xs">
                <select
                  value={selectedFiscalTier}
                  onChange={(e) => handleFiscalTierChange(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                >
                  <option value="all">All Fiscal Tiers</option>
                  <option value="A">Tier A</option>
                  <option value="BBB">Tier BBB</option>
                  <option value="BB">Tier BB</option>
                  <option value="B">Tier B</option>
                  <option value="CCC">Tier CCC</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder={activeSubTab === 'countries' ? 'Search countries, regions...' : 'Search US counties or states...'}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-500 w-64"
          />
        </div>
      </div>

      {/* Main Grid: Countries or US Counties */}
      {activeSubTab === 'countries' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Table / List (7 Cols) */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden flex flex-col justify-between">
            <div>
              <div className="p-3.5 border-b border-slate-800 text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Sovereign Risk Profiles ({filteredCountries.length})</span>
                <span className="text-cyan-400 text-[11px] font-normal">Click country to inspect macroeconomic impacts</span>
              </div>
              <div className="overflow-x-auto max-h-[520px]">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-[11px] font-mono text-slate-400 uppercase tracking-wider border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="px-3.5 py-2.5">Sovereign State</th>
                      <th className="px-3.5 py-2.5 text-center">Physical Risk (0-100)</th>
                      <th className="px-3.5 py-2.5 text-center">ND-GAIN Readiness</th>
                      <th className="px-3.5 py-2.5 text-right">GDP at Risk 2050</th>
                      <th className="px-3.5 py-2.5 text-right">Spread Impact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {paginatedCountries.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-slate-500 font-mono">
                          No sovereign countries match active filters.
                        </td>
                      </tr>
                    ) : (
                      paginatedCountries.map((c) => {
                        const isSelected = selectedCountry?.countryCode === c.countryCode;
                        return (
                          <tr
                            key={c.countryCode}
                            onClick={() => setSelectedCountry(c)}
                            className={`hover:bg-slate-800/40 cursor-pointer transition ${
                              isSelected ? 'bg-cyan-950/40 border-l-4 border-cyan-400' : ''
                            }`}
                          >
                            <td className="px-3.5 py-3">
                              <div className="font-bold text-white flex items-center gap-1.5">
                                <span className="font-mono text-cyan-400 text-[11px]">{c.countryCode}</span>
                                <span>{c.countryName}</span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">{c.region}</div>
                            </td>
                            <td className="px-3.5 py-3 text-center">
                              <span className={`font-mono font-black text-xs px-2 py-0.5 rounded ${
                                c.compositePhysicalRiskScore >= 75 ? 'bg-red-500/20 text-red-400 border border-red-500/40' :
                                c.compositePhysicalRiskScore >= 55 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                                'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              }`}>
                                {c.compositePhysicalRiskScore}
                              </span>
                            </td>
                            <td className="px-3.5 py-3 text-center font-mono">
                              <span className="text-slate-200">{c.ndGainReadinessScore}</span>
                              <span className="text-slate-500 text-[10px]"> / 100</span>
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono font-bold text-red-400">
                              {c.gdpAtRisk2050Percent}%
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono text-amber-300 font-semibold">
                              +{c.sovereignSpreadImpactBps} bps
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs font-mono text-slate-400">
              <span>
                Showing {filteredCountries.length === 0 ? 0 : (safeCountryPage - 1) * itemsPerPage + 1} -{' '}
                {Math.min(safeCountryPage * itemsPerPage, filteredCountries.length)} of {filteredCountries.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={safeCountryPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 text-slate-200"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-slate-300 font-bold">
                  Page {safeCountryPage} / {totalCountryPages}
                </span>
                <button
                  disabled={safeCountryPage >= totalCountryPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalCountryPages, p + 1))}
                  className="p-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 text-slate-200"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Detail Dossier (5 Cols) */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
            {selectedCountry ? (
              <>
                <div className="border-b border-slate-800 pb-3">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                    <span>{selectedCountry.region}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-400 font-bold border border-slate-700">
                      Tier {selectedCountry.fiscalVulnerabilityTier} Fiscal Resilience
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white mt-1">
                    {selectedCountry.countryName} ({selectedCountry.countryCode})
                  </h3>
                </div>

                {/* Macro Impact KPI grid */}
                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 font-sans text-[11px]">Composite Physical Risk</span>
                    <div className="text-xl font-black text-amber-400 mt-0.5">
                      {selectedCountry.compositePhysicalRiskScore} / 100
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 font-sans text-[11px]">ND-GAIN Adaptation Readiness</span>
                    <div className="text-xl font-black text-emerald-400 mt-0.5">
                      {selectedCountry.ndGainReadinessScore} / 100
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 font-sans text-[11px]">National GDP at Risk (2050)</span>
                    <div className="text-xl font-black text-red-400 mt-0.5">
                      {selectedCountry.gdpAtRisk2050Percent}% GDP
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 font-sans text-[11px]">Sovereign Bond Spread Premium</span>
                    <div className="text-xl font-black text-cyan-300 mt-0.5">
                      +{selectedCountry.sovereignSpreadImpactBps} bps
                    </div>
                  </div>
                </div>

                {/* Primary Hazard Vulnerabilities */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                    Primary Sovereign Hazard Drivers:
                  </h4>
                  <div className="space-y-1.5">
                    {selectedCountry.primaryVulnerabilities.map((hId) => {
                      const meta = HAZARD_CATALOG[hId];
                      return (
                        <div key={hId} className="p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-200 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.colorHex }} />
                            <span>{meta.name}</span>
                          </span>
                          <span className="text-slate-400 font-mono text-[11px]">{meta.category}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Population exposure notes */}
                <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-800/40 text-xs text-slate-300 space-y-1">
                  <div className="font-bold text-cyan-300 font-mono flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Demographic & Asset Exposure</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Estimated <strong>{selectedCountry.populationExposedPercent}%</strong> of the national population resides in high-severity climate hazard zones. Sovereign debt ratings increasingly incorporate physical capital degradation risks.
                  </p>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : (
        /* US Municipalities & Counties (3,100 Counties) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden flex flex-col justify-between">
            <div>
              <div className="p-3.5 border-b border-slate-800 text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>U.S. Municipalities & Counties ({filteredCounties.length})</span>
                <span className="text-red-400 text-[11px] font-normal">FEMA NRI Risk Integration</span>
              </div>
              <div className="overflow-x-auto max-h-[520px]">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-[11px] font-mono text-slate-400 uppercase tracking-wider border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="px-3.5 py-2.5">County & State</th>
                      <th className="px-3.5 py-2.5 text-center">FEMA NRI Score</th>
                      <th className="px-3.5 py-2.5 text-center">NRI Rating</th>
                      <th className="px-3.5 py-2.5 text-right">Expected Loss ($M/yr)</th>
                      <th className="px-3.5 py-2.5 text-right">Resilience</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {paginatedCounties.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-slate-500 font-mono">
                          No counties match active query.
                        </td>
                      </tr>
                    ) : (
                      paginatedCounties.map((co) => {
                        const isSelected = selectedCounty?.countyFips === co.countyFips;
                        return (
                          <tr
                            key={co.countyFips}
                            onClick={() => setSelectedCounty(co)}
                            className={`hover:bg-slate-800/40 cursor-pointer transition ${
                              isSelected ? 'bg-cyan-950/40 border-l-4 border-cyan-400' : ''
                            }`}
                          >
                            <td className="px-3.5 py-3">
                              <div className="font-bold text-white">{co.countyName}</div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                FIPS: {co.countyFips} • {co.stateName} ({co.stateCode})
                              </div>
                            </td>
                            <td className="px-3.5 py-3 text-center font-mono font-black text-amber-300 text-xs">
                              {co.femaNriScore}
                            </td>
                            <td className="px-3.5 py-3 text-center">
                              <span className={`text-[10px] px-2 py-0.5 rounded font-bold font-mono ${
                                co.femaRating === 'Very High' ? 'bg-red-500/20 text-red-400 border border-red-500/40' :
                                co.femaRating === 'Relatively High' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' :
                                'bg-slate-800 text-slate-300'
                              }`}>
                                {co.femaRating}
                              </span>
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono font-bold text-red-400">
                              ${co.annualLossExpectanceUsdMillions.toLocaleString()}M
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono text-emerald-400 font-semibold">
                              {co.communityResilienceScore} / 100
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* County Pagination Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs font-mono text-slate-400">
              <span>
                Showing {filteredCounties.length === 0 ? 0 : (safeCountyPage - 1) * itemsPerPage + 1} -{' '}
                {Math.min(safeCountyPage * itemsPerPage, filteredCounties.length)} of {filteredCounties.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={safeCountyPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 text-slate-200"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-slate-300 font-bold">
                  Page {safeCountyPage} / {totalCountyPages}
                </span>
                <button
                  disabled={safeCountyPage >= totalCountyPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalCountyPages, p + 1))}
                  className="p-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 text-slate-200"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Right County Detail */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
            {selectedCounty ? (
              <>
                <div className="border-b border-slate-800 pb-3">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                    <span>FIPS Code: {selectedCounty.countyFips}</span>
                    <span className="px-2 py-0.5 rounded bg-red-950 text-red-300 font-bold border border-red-800">
                      FEMA: {selectedCounty.femaRating}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white mt-1">
                    {selectedCounty.countyName}, {selectedCounty.stateName}
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 font-sans text-[11px]">FEMA National Risk Index</span>
                    <div className="text-xl font-black text-amber-400 mt-0.5">
                      {selectedCounty.femaNriScore} / 100
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 font-sans text-[11px]">Annual Loss Expectance</span>
                    <div className="text-xl font-black text-red-400 mt-0.5">
                      ${selectedCounty.annualLossExpectanceUsdMillions}M/yr
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 font-sans text-[11px]">Social Vulnerability Score</span>
                    <div className="text-xl font-black text-orange-400 mt-0.5">
                      {selectedCounty.socialVulnerabilityScore} / 100
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 font-sans text-[11px]">Community Resilience</span>
                    <div className="text-xl font-black text-emerald-400 mt-0.5">
                      {selectedCounty.communityResilienceScore} / 100
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                    Primary County Threat Drivers:
                  </h4>
                  <div className="space-y-1.5">
                    {selectedCounty.primaryHazards.map((hId) => {
                      const meta = HAZARD_CATALOG[hId];
                      return (
                        <div key={hId} className="p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-200 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.colorHex }} />
                            <span>{meta.name}</span>
                          </span>
                          <span className="text-slate-400 font-mono text-[11px]">{meta.category}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
