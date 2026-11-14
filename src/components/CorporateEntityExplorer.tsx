import React, { useState } from 'react';
import { CORPORATE_ENTITIES_SAMPLE } from '../services/corporateEntities';
import { CorporateEntity } from '../types/climate';
import { HAZARD_CATALOG } from '../services/climateEngine';
import {
  Building2,
  Search,
  Database,
  Globe2,
  Filter,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

interface CorporateEntityExplorerProps {
  onLoadEntityPortfolio?: (entityName: string) => void;
}

export const CorporateEntityExplorer: React.FC<CorporateEntityExplorerProps> = ({
  onLoadEntityPortfolio,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [selectedRating, setSelectedRating] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 8;
  const [selectedEntity, setSelectedEntity] = useState<CorporateEntity | null>(
    CORPORATE_ENTITIES_SAMPLE[0]
  );

  const allSectors = Array.from(
    new Set(CORPORATE_ENTITIES_SAMPLE.map((e) => e.sector.split(' / ')[0]))
  ).sort();

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleSectorChange = (val: string) => {
    setSelectedSector(val);
    setCurrentPage(1);
  };

  const handleRatingChange = (val: string) => {
    setSelectedRating(val);
    setCurrentPage(1);
  };

  const filteredEntities = CORPORATE_ENTITIES_SAMPLE.filter((ent) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      ent.name.toLowerCase().includes(q) ||
      ent.sector.toLowerCase().includes(q) ||
      (ent.ticker && ent.ticker.toLowerCase().includes(q)) ||
      ent.headquarters.toLowerCase().includes(q);
    const matchesSector =
      selectedSector === 'all' ||
      ent.sector.toLowerCase().includes(selectedSector.toLowerCase());
    const matchesRating = selectedRating === 'all' || ent.climateRating === selectedRating;
    return matchesSearch && matchesSector && matchesRating;
  });

  const totalPages = Math.max(1, Math.ceil(filteredEntities.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedEntities = filteredEntities.slice(
    (safePage - 1) * itemsPerPage,
    safePage * itemsPerPage
  );

  return (
    <div className="max-w-[1720px] mx-auto px-4 sm:px-6 py-6 space-y-6 text-slate-100">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-indigo-950/40 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="max-w-3xl space-y-2 relative z-10">
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs uppercase tracking-wider">
            <Building2 className="w-4 h-4" />
            <span>Proprietary Geo-Specific Corporate Intelligence</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            9M+ Asset Locations • 850,000+ Corporate Entities (99% Global Market Cap)
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Every physical facility is linked to parent corporations and ultimate parent entities (UPEs) globally. Seamlessly screen entity-level physical risk exposures, portfolio replacement values, TCFD alignment scores, and aggregate climate ratings.
          </p>
        </div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3 rounded-xl shadow-lg">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <Database className="w-4 h-4 text-cyan-400" />
            <span>Universe: {filteredEntities.length} of {CORPORATE_ENTITIES_SAMPLE.length} Entities</span>
          </div>

          {/* Sector Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedSector}
              onChange={(e) => handleSectorChange(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Sectors ({CORPORATE_ENTITIES_SAMPLE.length})</option>
              {allSectors.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </div>

          {/* Climate Rating Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <select
              value={selectedRating}
              onChange={(e) => handleRatingChange(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 font-mono"
            >
              <option value="all">All Ratings</option>
              <option value="AAA">Rating AAA</option>
              <option value="AA">Rating AA</option>
              <option value="A">Rating A</option>
              <option value="BBB">Rating BBB</option>
              <option value="CCC">Rating CCC</option>
            </select>
          </div>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search corporate entity, ticker, sector..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-500 w-72"
          />
        </div>
      </div>

      {/* Main Grid: Corporate Table & Selected Entity Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Table (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-3.5 border-b border-slate-800 text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Corporate Universe ({filteredEntities.length})</span>
              <span className="text-cyan-400 text-[11px] font-normal">Click entity to inspect physical footprint</span>
            </div>
            <div className="overflow-x-auto max-h-[520px]">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-[11px] font-mono text-slate-400 uppercase tracking-wider border-b border-slate-800 sticky top-0">
                  <tr>
                    <th className="px-3.5 py-2.5">Corporate Entity & Ticker</th>
                    <th className="px-3.5 py-2.5 text-right">Market Cap</th>
                    <th className="px-3.5 py-2.5 text-center">Tracked Assets</th>
                    <th className="px-3.5 py-2.5 text-center">Physical Score</th>
                    <th className="px-3.5 py-2.5 text-center">Climate Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {paginatedEntities.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-500 font-mono">
                        No corporate entities match the active filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedEntities.map((ent) => {
                      const isSelected = selectedEntity?.id === ent.id;
                      return (
                        <tr
                          key={ent.id}
                          onClick={() => setSelectedEntity(ent)}
                          className={`hover:bg-slate-800/40 cursor-pointer transition ${
                            isSelected ? 'bg-cyan-950/40 border-l-4 border-cyan-400' : ''
                          }`}
                        >
                          <td className="px-3.5 py-3">
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>{ent.name}</span>
                              {ent.ticker && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 font-mono">
                                  {ent.ticker}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{ent.sector}</div>
                          </td>
                          <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-200">
                            ${ent.marketCapUsdBillions}B
                          </td>
                          <td className="px-3.5 py-3 text-center font-mono text-cyan-300">
                            {ent.trackedAssetCount.toLocaleString()} locations
                          </td>
                          <td className="px-3.5 py-3 text-center font-mono font-black text-xs text-amber-300">
                            {ent.aggregatePhysicalRiskScore} / 100
                          </td>
                          <td className="px-3.5 py-3 text-center">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold font-mono ${
                              ent.climateRating === 'AAA' || ent.climateRating === 'AA'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : ent.climateRating === 'A' || ent.climateRating === 'BBB'
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                                : 'bg-red-500/20 text-red-400 border border-red-500/40'
                            }`}>
                              {ent.climateRating}
                            </span>
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
              Showing {filteredEntities.length === 0 ? 0 : (safePage - 1) * itemsPerPage + 1} -{' '}
              {Math.min(safePage * itemsPerPage, filteredEntities.length)} of {filteredEntities.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 text-slate-200"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-slate-300 font-bold">
                Page {safePage} / {totalPages}
              </span>
              <button
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 text-slate-200"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Selected Entity Dossier (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          {selectedEntity ? (
            <>
              <div className="border-b border-slate-800 pb-3">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>HQ: {selectedEntity.headquarters}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-400 font-bold border border-slate-700">
                    Parent: {selectedEntity.ultimateParent}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mt-1">
                  {selectedEntity.name}
                </h3>
                <div className="text-xs text-slate-400 mt-0.5 font-mono">
                  Sector: {selectedEntity.sector}
                </div>
              </div>

              {/* KPI Strip */}
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 font-sans text-[11px]">Market Capitalization</span>
                  <div className="text-xl font-black text-white mt-0.5">
                    ${selectedEntity.marketCapUsdBillions}B
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 font-sans text-[11px]">Portfolio Replacement Value</span>
                  <div className="text-xl font-black text-cyan-300 mt-0.5">
                    ${(selectedEntity.portfolioReplacementValueUsd / 1e9).toFixed(1)}B
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 font-sans text-[11px]">Aggregate Physical Risk Score</span>
                  <div className="text-xl font-black text-amber-400 mt-0.5">
                    {selectedEntity.aggregatePhysicalRiskScore} / 100
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 font-sans text-[11px]">TCFD Disclosure Alignment</span>
                  <div className="text-xl font-black text-emerald-400 mt-0.5">
                    {selectedEntity.tcfdAlignmentScore}%
                  </div>
                </div>
              </div>

              {/* Top Hazard Risks */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                  Top Physical Hazard Vulnerabilities:
                </h4>
                <div className="space-y-1.5">
                  {selectedEntity.topHazardRisks.map((hId) => {
                    const meta = HAZARD_CATALOG[hId];
                    return (
                      <div key={hId} className="p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-200 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.colorHex }} />
                          <span>{meta.name}</span>
                        </span>
                        <span className="text-cyan-400 font-mono text-[11px]">{meta.category}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 9M+ Asset Database Citation */}
              <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-800/40 text-xs text-slate-300 space-y-1.5">
                <div className="font-bold text-indigo-300 font-mono flex items-center gap-1.5">
                  <Globe2 className="w-4 h-4" />
                  <span>Geo-Spatial Footprint Coverage</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Linked to <strong>{selectedEntity.trackedAssetCount} geocoded physical facilities</strong> in our 9M+ global asset database, verified via satellite imagery and regulatory corporate registry filings.
                </p>
              </div>

              {/* Action Button: Load into Terminal */}
              {onLoadEntityPortfolio && (
                <button
                  onClick={() => onLoadEntityPortfolio(selectedEntity.name)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition shadow-md shadow-cyan-600/30 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Inspect {selectedEntity.name.split(' ')[0]} Facilities in Terminal</span>
                </button>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

