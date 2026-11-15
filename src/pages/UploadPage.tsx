import React, { useState } from 'react';
import Papa from 'papaparse';
import { Upload, Download, AlertTriangle } from 'lucide-react';
import { Card, Button, cx } from '../ui/kit';
import { FIELDS, autoMap, rowsToLoans, TEMPLATE_CSV, type FieldId, type Loan } from '../engine/portfolio';
import { inr } from '../lib/format';

export const UploadPage: React.FC<{ onImport: (loans: Loan[], mode: 'replace' | 'append') => void }> = ({ onImport }) => {
  const [file, setFile] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [map, setMap] = useState<Partial<Record<FieldId, string>>>({});
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<'replace' | 'append'>('replace');

  const read = async (f: File) => {
    setErr(null);
    if (/\.xlsx?$/i.test(f.name)) { setErr('Excel files: save as CSV (File › Save As › CSV UTF-8) and upload that.'); return; }
    Papa.parse<Record<string, unknown>>(f, {
      header: true, skipEmptyLines: 'greedy', transformHeader: (h) => h.replace(/^﻿/, '').trim(),
      complete: (res) => {
        const hs = (res.meta.fields ?? []).filter(Boolean);
        if (!res.data.length || !hs.length) { setErr('The file has no header row or no data rows.'); return; }
        setFile(f.name); setRows(res.data); setHeaders(hs); setMap(autoMap(hs));
      },
      error: (e) => setErr(e.message),
    });
  };
  const preview = rows.length ? rowsToLoans(rows, map) : [];
  const missing = FIELDS.filter((f) => f.required && !map[f.id]);
  const noLocation = !map.address && !map.district && !map.state && !map.pincode && !(map.lat && map.lon);
  const bad = preview.filter((l) => l.issues.length);
  const total = preview.reduce((t, l) => t + (Number.isFinite(l.amount) ? l.amount : 0), 0);
  const step = !file ? 1 : 2;

  return (
    <div className="max-w-[1100px] mx-auto flex flex-col gap-3">
      <div>
        <h1 className="text-2xl font-bold">Upload loan file</h1>
        <p className="text-sm text-muted mt-1">CSV, one row per loan or collateral site. Rows are geocoded with OpenStreetMap; anything that can’t be read or located is flagged, never guessed.</p>
      </div>
      <ol className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {['Choose file', 'Match columns', 'Geocode addresses', 'Assess risk'].map((s, i) => (
          <li key={s} className={cx('px-3.5 py-3 rounded-xl border text-sm', i + 1 === step ? 'bg-accent text-on-accent border-accent' : 'bg-panel border-line')}>
            <span className="text-xs opacity-80">Step {i + 1}</span><span className="block font-semibold">{s}</span>
          </li>
        ))}
      </ol>
      <label className="rounded-2xl bg-panel border-2 border-dashed border-line p-6 flex flex-wrap items-center gap-5 cursor-pointer hover:border-accent"
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) read(f); }}>
        <span className="w-14 h-14 rounded-2xl bg-chip flex items-center justify-center"><Upload className="w-6 h-6" /></span>
        <span className="flex-1 min-w-[240px]">
          <span className="block font-semibold">{file ?? 'Drop a CSV here or click to choose'}</span>
          <span className="block text-[13px] text-muted mt-1">{file ? `${rows.length} rows · ${headers.length} columns` : 'Columns are matched automatically; you can change any match below.'}</span>
        </span>
        <input type="file" accept=".csv,text/csv,.xlsx,.xls" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f); e.target.value = ''; }} />
        <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE_CSV)}`} download="climaris_loan_template.csv" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 text-sm text-accent font-semibold"><Download className="w-4 h-4" />Template</a>
      </label>
      {err && <p className="p-3 rounded-xl bg-[#dc26261a] text-[#dc2626] text-sm">{err}</p>}

      {file && (
        <>
          <Card title="Match columns" sub="* required · at least one location column (address, district, state, PIN or latitude + longitude)" pad={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead><tr className="text-left text-xs text-muted bg-chip"><th className="py-2.5 px-4 font-medium">CLIMARIS field</th><th className="py-2.5 px-3 font-medium">Column in your file</th><th className="py-2.5 px-4 font-medium">First value</th></tr></thead>
                <tbody>
                  {FIELDS.map((f) => (
                    <tr key={f.id} className="border-t border-line">
                      <td className="py-2.5 px-4 font-medium">{f.label}{f.required ? ' *' : ''}</td>
                      <td className="py-2 px-3">
                        <select aria-label={f.label} value={map[f.id] ?? ''} onChange={(e) => setMap({ ...map, [f.id]: e.target.value || undefined })} className="min-h-10 min-w-[220px] px-3 rounded-[10px] border border-line bg-bg text-ink text-[13px]">
                          <option value="">— not in file —</option>
                          {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </td>
                      <td className="py-2.5 px-4 text-muted text-[13px] truncate max-w-[260px]">{map[f.id] ? String(rows[0]?.[map[f.id]!] ?? '') : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[280px] text-sm">
                <p><b>{preview.length - bad.length}</b> rows ready · total <b>{inr(total)}</b>{bad.length ? <> · <span className="text-[#ea580c]"><b>{bad.length}</b> with issues</span></> : null}</p>
                <p className="text-xs text-muted mt-1">Amounts in rupees; “2.5 cr”, “40 lakh”, “1,20,00,000” are all read. Country defaults to India only when blank.</p>
                {(missing.length > 0 || noLocation) && <p className="text-xs text-[#dc2626] mt-1 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />Match {[...missing.map((m) => m.label), ...(noLocation ? ['a location column'] : [])].join(', ')} to continue.</p>}
              </div>
              <label className="text-sm flex items-center gap-2"><input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} />Replace portfolio</label>
              <label className="text-sm flex items-center gap-2"><input type="radio" checked={mode === 'append'} onChange={() => setMode('append')} />Add to portfolio</label>
              <Button kind="primary" disabled={missing.length > 0 || noLocation} onClick={() => onImport(preview, mode)}>Geocode and assess</Button>
            </div>
            {bad.length > 0 && (
              <details className="mt-3 text-[13px]"><summary className="cursor-pointer text-muted">Show rows with issues</summary>
                <ul className="mt-2 flex flex-col gap-1 max-h-48 overflow-auto">{bad.slice(0, 200).map((l) => <li key={l.key}>Row {l.row} ({l.borrower}): {l.issues.join('; ')}</li>)}</ul>
              </details>
            )}
          </Card>
        </>
      )}
    </div>
  );
};
