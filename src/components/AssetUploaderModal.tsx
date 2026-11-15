import React, { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { Asset } from '../types/climate';
import { rowsToAssets } from '../services/csvImport';
import { SAMPLE_PORTFOLIOS } from '../services/sampleData';
import { formatCurrencyUsd } from '../services/climateEngine';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, Download } from 'lucide-react';
import { ModalShell, Button, Segmented, cx } from './ui';

interface AssetUploaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadAssets: (assets: Asset[], mode: 'replace' | 'append') => void;
  onLoadSamplePortfolio: (portfolioId: string) => void;
  currentAssetCount?: number;
}

const TEMPLATE =
  'Asset Name,Entity Name,Parent Entity,Asset Type,Category,Latitude,Longitude,Replacement Value,City,Country,Elevation\n' +
  '"Ashburn AI Data Center 1","Cloud Services LLC","Tech Holdings","Hyperscale Cloud Data Center (>50MW)","Data Center & Telecom",39.0438,-77.4874,2500000000,"Ashburn","United States",88\n' +
  '"Port of Rotterdam Berth 4","Euro Container Terminals","State of Netherlands","Deepwater Container Port Terminal","Maritime Port & Shipping",51.9566,4.0287,4200000000,"Rotterdam","Netherlands",4.5\n' +
  '"Sonoran Solar Array 300MW","SunPower Grid Corp","Energy Capital","Utility-Scale Solar PV Farm (>100MW)","Renewable Energy & Power",33.4484,-112.0740,650000000,"Phoenix","United States",330\n' +
  '"Miami Biscayne Tower","Coastal REIT Capital","Real Estate Partners","High-Rise Grade-A Office Tower (>30 floors)","Commercial Real Estate",25.7667,-80.1936,1100000000,"Miami","United States",2.4\n';

export const AssetUploaderModal: React.FC<AssetUploaderModalProps> = ({ isOpen, onClose, onUploadAssets, onLoadSamplePortfolio, currentAssetCount = 0 }) => {
  const [parsed, setParsed] = useState<Asset[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [mode, setMode] = useState<'replace' | 'append'>('append');
  const [assumed, setAssumed] = useState<Record<string, string[]>>({});
  const [dragging, setDragging] = useState(false);

  // Reset when reopened
  useEffect(() => {
    if (isOpen) {
      setParsed([]);
      setErrors([]);
      setWarnings([]);
      setFileName(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setBusy(true);
    setErrors([]);
    setWarnings([]);
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (res) => {
        const out = rowsToAssets(res.data);
        setParsed(out.assets);
        setErrors(out.errors);
        setWarnings(out.warnings);
        setAssumed(out.assumed);
        setBusy(false);
      },
      error: (err) => {
        setErrors([`Could not read the file: ${err.message}`]);
        setBusy(false);
      },
    });
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ClimaRisk_import_template.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-3xl" labelledBy="upload-title">
      <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <h2 id="upload-title" className="text-base font-semibold text-white">Import sites</h2>
          <p className="text-xs text-slate-400 mt-0.5">CSV with one row per site. Only latitude and longitude are required.</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06]" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]); }}
          className={cx('block rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors', dragging ? 'border-cyan-400 bg-cyan-400/[0.06]' : 'border-white/[0.1] hover:border-cyan-400/60 bg-white/[0.02]')}
        >
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => handleFile(e.target.files?.[0])} />
          <FileSpreadsheet className="w-8 h-8 text-cyan-300 mx-auto" />
          <div className="mt-3 text-sm text-white">Drop a CSV here or <span className="text-cyan-300 underline">browse</span></div>
          <div className="mt-1 text-xs text-slate-500">Recognised columns: name, latitude, longitude, value, asset type, category, city, country, elevation</div>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button size="sm" variant="ghost" icon={<Download className="w-4 h-4" />} onClick={downloadTemplate}>Download template</Button>
          {currentAssetCount > 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              When importing
              <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: 'append', label: `Keep my ${currentAssetCount} sites` }, { value: 'replace', label: 'Replace them' }]} />
            </div>
          )}
        </div>

        {busy && <div className="text-xs text-cyan-300">Reading {fileName}…</div>}

        {errors.length > 0 && (
          <div className="rounded-xl bg-red-500/[0.08] ring-1 ring-red-400/30 p-4 text-xs text-red-200 space-y-1">
            <div className="font-medium flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> {errors.length} row{errors.length === 1 ? '' : 's'} skipped</div>
            {errors.slice(0, 5).map((e) => <div key={e} className="text-red-200/80">{e}</div>)}
            {errors.length > 5 && <div className="text-red-200/60">…and {errors.length - 5} more</div>}
          </div>
        )}
        {warnings.length > 0 && (
          <div className="rounded-xl bg-amber-500/[0.06] ring-1 ring-amber-400/25 p-3 text-xs text-amber-200 space-y-0.5">
            {warnings.slice(0, 4).map((w) => <div key={w}>{w}</div>)}
            {warnings.length > 4 && <div className="text-amber-200/60">…and {warnings.length - 4} more</div>}
          </div>
        )}

        {parsed.length > 0 && (
          <div>
            <div className="text-sm text-emerald-300 flex items-center gap-1.5 mb-2">
              <CheckCircle2 className="w-4 h-4" /> {parsed.length} site{parsed.length === 1 ? '' : 's'} ready from {fileName}
            </div>
            <div className="max-h-52 overflow-y-auto rounded-xl ring-1 ring-white/[0.06]">
              <table className="w-full text-xs">
                <thead className="bg-white/[0.03] text-slate-400 sticky top-0">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Location</th>
                    <th className="px-3 py-2 font-medium text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {parsed.slice(0, 50).map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-1.5 text-white">{r.name}{assumed[r.id] && <span className="ml-2 text-[11px] text-amber-200">({assumed[r.id].join(', ')})</span>}</td>
                      <td className="px-3 py-1.5 text-slate-400 truncate max-w-[200px]">{r.assetType}</td>
                      <td className="px-3 py-1.5 text-slate-300">{r.city}, {r.country}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-200">{formatCurrencyUsd(r.replacementValueUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div>
          <div className="text-xs text-slate-500 mb-2">Or start from a sample portfolio</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SAMPLE_PORTFOLIOS.map((p) => (
              <button
                key={p.id}
                onClick={() => { onLoadSamplePortfolio(p.id); onClose(); }}
                className="text-left rounded-xl bg-white/[0.03] hover:bg-white/[0.06] ring-1 ring-white/[0.06] px-3 py-2.5"
              >
                <div className="flex justify-between gap-2 text-sm text-white"><span className="line-clamp-2">{p.name}</span><span className="text-xs text-slate-400 shrink-0">{p.assetCount} sites</span></div>
                <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">{p.description}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          icon={<Upload className="w-4 h-4" />}
          disabled={parsed.length === 0}
          onClick={() => { onUploadAssets(parsed, currentAssetCount > 0 ? mode : 'replace'); onClose(); }}
        >
          {currentAssetCount > 0
            ? mode === 'append'
              ? `Add ${parsed.length || ''} site${parsed.length === 1 ? '' : 's'} to current portfolio`
              : `Replace portfolio with ${parsed.length || ''} site${parsed.length === 1 ? '' : 's'}`
            : `Import ${parsed.length || ''} site${parsed.length === 1 ? '' : 's'}`}
        </Button>
      </div>
    </ModalShell>
  );
};
