import React, { useState } from 'react';
import Papa from 'papaparse';
import { Asset, AssetCategory } from '../types/climate';
import { SAMPLE_PORTFOLIOS } from '../services/sampleData';
import { estimateGlobalElevationMeters, reverseGeocodeLocation } from '../services/climateEngine';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  Download,
  Database,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface AssetUploaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadAssets: (assets: Asset[]) => void;
  onLoadSamplePortfolio: (portfolioId: string) => void;
}

export const AssetUploaderModal: React.FC<AssetUploaderModalProps> = ({
  isOpen,
  onClose,
  onUploadAssets,
  onLoadSamplePortfolio,
}) => {
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsValidating(true);
    setValidationErrors([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        validateAndSetData(results.data);
        setIsValidating(false);
      },
      error: (error) => {
        setValidationErrors([`CSV Parsing error: ${error.message}`]);
        setIsValidating(false);
      },
    });
  };

  const validateAndSetData = (data: any[]) => {
    const errors: string[] = [];
    const validAssets: Asset[] = [];

    if (!Array.isArray(data) || data.length === 0) {
      setValidationErrors(['The uploaded file contains no data rows.']);
      return;
    }

    data.forEach((row, index) => {
      const rowNum = index + 2; // header is row 1
      // Header normalization
      const name = row.name || row.Name || row['Asset Name'] || row.asset_name || `Asset ${index + 1}`;
      const entity = row.entity || row.Entity || row['Entity Name'] || row.Company || 'Corporate Portfolio';
      const parent = row.parent || row.Parent || row['Parent Entity'] || entity;
      const assetType = row.asset_type || row.AssetType || row.Type || row.type || 'Commercial Real Estate';
      const category = (row.category || row.Category || 'Industrial & Logistics') as AssetCategory;
      const lat = parseFloat(row.lat || row.Lat || row.latitude || row.Latitude);
      const lon = parseFloat(row.lon || row.Lon || row.longitude || row.Longitude || row.lng || row.Lng);
      const value = parseFloat(row.value || row.Value || row.replacement_value || row['Replacement Value'] || 10000000);
      const year = parseInt(row.year_built || row.year || 2018, 10);

      if (isNaN(lat) || lat < -90 || lat > 90) {
        errors.push(`Row ${rowNum} (${name}): Invalid Latitude "${row.latitude || row.lat}". Must be between -90 and 90.`);
        return;
      }
      if (isNaN(lon) || lon < -180 || lon > 180) {
        errors.push(`Row ${rowNum} (${name}): Invalid Longitude "${row.longitude || row.lon}". Must be between -180 and 180.`);
        return;
      }

      // Automatically determine location and elevation if omitted or blank
      const geo = reverseGeocodeLocation(lat, lon);
      const city = row.city || row.City || geo.city;
      const country = row.country || row.Country || geo.country;

      const rawElev = row.elevation || row.Elevation || row['Elevation (m)'];
      const parsedElev = rawElev !== undefined && rawElev !== '' ? parseFloat(rawElev) : NaN;
      const elevation = !isNaN(parsedElev) ? parsedElev : estimateGlobalElevationMeters(lat, lon);

      validAssets.push({
        id: `uploaded-${Date.now()}-${index}`,
        name: String(name),
        entityName: String(entity),
        parentEntity: String(parent),
        assetType: String(assetType),
        category,
        latitude: lat,
        longitude: lon,
        city: String(city),
        country: String(country),
        replacementValueUsd: isNaN(value) ? 50000000 : value,
        yearBuilt: isNaN(year) ? 2018 : year,
        elevationMeters: elevation,
        criticalityTier: 1,
      });
    });

    setValidationErrors(errors);
    setParsedRows(validAssets);
  };

  const handleConfirmUpload = () => {
    if (parsedRows.length > 0) {
      onUploadAssets(parsedRows);
      onClose();
    }
  };

  const downloadSampleTemplate = () => {
    const csvContent =
      'Asset Name,Entity Name,Parent Entity,Asset Type,Category,Latitude,Longitude,Replacement Value,City,Country,Elevation\n' +
      '"Ashburn AI Data Center 1","Cloud Services LLC","Tech Holdings","Hyperscale Cloud Data Center (>50MW)","Data Center & Telecom",39.0438,-77.4874,2500000000,"Ashburn","United States",88\n' +
      '"Port of Rotterdam Berth 4","Euro Container Terminals","State of Netherlands","Deepwater Container Port Terminal","Maritime Port & Shipping",51.9566,4.0287,4200000000,"Rotterdam","Netherlands",4.5\n' +
      '"Sonoran Solar Array 300MW","SunPower Grid Corp","Energy Capital","Utility-Scale Solar PV Farm (>100MW)","Renewable Energy & Power",33.4484,-112.0740,650000000,"Phoenix","United States",330\n' +
      '"Taipei Silicon Foundry Fab 9","Global Microchips","Semiconductor Group","Semiconductor Fabrication Plant (Fab 300mm/200mm)","High-Tech & Semiconductor",23.1025,120.2858,8200000000,"Tainan","Taiwan",14\n' +
      '"Miami Biscayne Tower","Coastal REIT Capital","Real Estate Partners","High-Rise Grade-A Office Tower (>30 floors)","Commercial Real Estate",25.7667,-80.1936,1100000000,"Miami","United States",2.4\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'ClimaRisk_Asset_Upload_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 text-slate-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Upload Asset Portfolio & Model Physical Risk
              </h2>
              <p className="text-xs text-slate-400">
                Ingest CSV / Excel with lat/lon coordinates for instant CMIP6 SSP physical risk assessment
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Upload Drop Zone */}
          <div className="border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-2xl p-8 text-center bg-slate-950/50 hover:bg-slate-950 transition cursor-pointer relative group">
            <input
              type="file"
              accept=".csv,text/csv,application/vnd.ms-excel"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-cyan-950/80 border border-cyan-800 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                <FileSpreadsheet className="w-7 h-7" />
              </div>
              <div>
                <span className="text-sm font-bold text-white">
                  Drop your CSV file here or <span className="text-cyan-400 underline">browse</span>
                </span>
                <p className="text-xs text-slate-400 mt-1">
                  Required columns: <code className="text-cyan-300">Name</code>, <code className="text-cyan-300">Latitude</code>, <code className="text-cyan-300">Longitude</code>, <code className="text-cyan-300">Asset Type</code>, <code className="text-cyan-300">Replacement Value</code>
                </p>
              </div>
            </div>
          </div>

          {/* Action Row: Template Download & Pre-loaded Portfolios */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold text-slate-300">Need a sample structure?</span>
            </div>
            <button
              onClick={downloadSampleTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-cyan-300 border border-slate-700 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV Template (.csv)</span>
            </button>
          </div>

          {/* Instant Sample Portfolios */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Or Load a Benchmark Institutional Portfolio (1-Click)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {SAMPLE_PORTFOLIOS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onLoadSamplePortfolio(p.id);
                    onClose();
                  }}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-cyan-500 hover:bg-slate-800/50 text-left transition group"
                >
                  <div className="text-xs font-bold text-white group-hover:text-cyan-400 flex items-center justify-between">
                    <span>{p.name}</span>
                    <span className="text-[10px] text-cyan-400/80 font-mono">{p.assetCount} assets</span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                    {p.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Parsing Results / Preview */}
          {isValidating && (
            <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-800 text-center text-xs text-cyan-300 animate-pulse">
              Parsing and validating geographic coordinates & asset schema...
            </div>
          )}

          {validationErrors.length > 0 && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-xs text-red-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-red-200">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span>Validation Errors Encountered:</span>
              </div>
              {validationErrors.slice(0, 5).map((err, i) => (
                <div key={i} className="pl-5 text-red-300/90 font-mono text-[11px]">
                  • {err}
                </div>
              ))}
            </div>
          )}

          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="font-bold text-emerald-400 flex items-center gap-1.5 font-mono">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Ready to Model: {parsedRows.length} Valid Assets from {fileName}</span>
                </div>
              </div>

              {/* Preview Table */}
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Asset Name</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Lat, Lon</th>
                      <th className="px-3 py-2 text-right">Replacement Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300 text-[11px]">
                    {parsedRows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-900/40">
                        <td className="px-3 py-1.5 font-semibold text-white">{row.name}</td>
                        <td className="px-3 py-1.5 text-slate-400 truncate max-w-[180px]">{row.assetType}</td>
                        <td className="px-3 py-1.5 text-cyan-400">{row.latitude.toFixed(3)}°, {row.longitude.toFixed(3)}°</td>
                        <td className="px-3 py-1.5 text-right font-bold text-slate-200">${(row.replacementValueUsd / 1e6).toFixed(1)}M</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
          >
            Cancel
          </button>

          <button
            disabled={parsedRows.length === 0}
            onClick={handleConfirmUpload}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <span>Run Climate Risk Analytics ({parsedRows.length} Assets)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

