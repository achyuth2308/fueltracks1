import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, Loader2,
  Trash2, RefreshCw, Cpu, Layers
} from 'lucide-react';
import axiosInstance from '../../api/axios';

export default function DeviceInventoryUploadModal({ isOpen, onClose, onSuccess }) {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedDevices, setParsedDevices] = useState([]);
  const [batchName, setBatchName] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsParsing(true);
    setStatusMessage(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];

        // 1. Try standard object rows
        const objRows = XLSX.utils.sheet_to_json(ws, { raw: true });
        // 2. Also get 2D array rows (header: 1) for headerless files
        const arrRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

        if (!arrRows || arrRows.length === 0) {
          setStatusMessage({ type: 'error', text: 'Uploaded Excel file is empty.' });
          setIsParsing(false);
          return;
        }

        const normalized = [];
        const seenImeis = new Set();

        // Check if first row looks like data rather than headers
        let hasNamedHeaders = false;
        if (objRows.length > 0) {
          const sampleKeys = Object.keys(objRows[0] || {}).map(k => k.toLowerCase());
          hasNamedHeaders = sampleKeys.some(k => k.includes('imei') || k.includes('device') || k.includes('serial') || k.includes('iccid'));
        }

        if (hasNamedHeaders) {
          // Parse using named column keys
          for (let i = 0; i < objRows.length; i++) {
            const r = objRows[i];
            let imei = String(r['Device ID(IMEI)'] || r['Device ID (IMEI)'] || r['IMEI Number'] || r['IMEI NO'] || r['IMEI NO.'] || r['IMEI'] || r.imei || r.deviceId || r['Device ID'] || '').trim();
            if (imei.includes('e+') || imei.includes('E+')) {
              try { imei = BigInt(Number(imei)).toString(); } catch (_) {}
            }
            imei = imei.replace(/\D/g, '');

            if (!imei || imei.length < 10) continue;
            if (seenImeis.has(imei)) continue;
            seenImeis.add(imei);

            const serialNo = String(r['VLTD SLNO'] || r['VLTTD SLNO'] || r['Serial Number'] || r['Device Serial Number'] || r['Device Serial No'] || r['Serial No'] || r.serialNo || r.serial_no || '').trim();
            const iccid = String(r['ICCID'] || r['ICCID Number'] || r['SIM Number'] || r.iccid || '').trim();
            const model = String(r['Device Model'] || r['Model Name / Number'] || r['Model Name/Number'] || r['Device Type'] || r.model || r.deviceModel || '').trim();
            const explicitMfr = String(r['VLTD Manufacturer Name'] || r['Manufacturer'] || r.manufacturer || '').trim();
            const simProvider = String(r['SIM Service Provider'] || r['Provider'] || r['Operator'] || r.simProvider || 'Technojacks').trim();
            const simNo = String(r['GPS SIM Number 1'] || r['SIM 1'] || r['Mobile Number'] || r.simNo || '').trim();

            let mfr = explicitMfr;
            if (!mfr || mfr === 'FUELTRACKS TECHNOLOGIES PRIVATE LIMITED') {
              const combined = `${model} ${serialNo}`.toUpperCase();
              if (combined.includes('VOLTY') || combined.includes('VOL1')) {
                mfr = 'VOLTY IOT SOLUTIONS PRIVATE LIMITED';
              } else if (combined.includes('APM') || combined.includes('KINGSTRACK')) {
                mfr = 'APM KINGSTRACK PRIVATE LIMITED';
              } else {
                mfr = 'APM KINGSTRACK PRIVATE LIMITED';
              }
            }

            normalized.push({
              imei,
              serialNo: serialNo || (mfr.includes('VOLTY') ? `VOL1K2I${imei.slice(-10)}` : `APM1K2I${imei.slice(-10)}`),
              iccid: iccid || '8991430008117572979F',
              model: model || (mfr.includes('VOLTY') ? 'VOLTY-AIS140' : '1819001A'),
              manufacturer: mfr,
              simProvider,
              simNo
            });
          }
        } else {
          // Parse headerless raw row arrays (e.g. manufacturer dispatch sheets)
          for (let i = 0; i < arrRows.length; i++) {
            const row = arrRows[i];
            if (!Array.isArray(row) || row.length === 0) continue;

            let detectedImei = '';
            let detectedSerial = '';
            let detectedIccid = '';
            let detectedSimNo = '';

            for (const cell of row) {
              const str = String(cell || '').trim();
              if (!str) continue;

              // 1. Detect 14-16 numeric digit IMEI
              if (/^\d{14,16}$/.test(str) && !detectedImei) {
                detectedImei = str;
              }
              // 2. Detect Serial No starting with APM or VOL
              else if (/^(?:APM|VOL)[A-Z0-9]+$/i.test(str) && !detectedSerial) {
                detectedSerial = str.toUpperCase();
              }
              // 3. Detect ICCID starting with 8991 (18-22 chars)
              else if (/^8991[0-9A-Z]{14,18}$/i.test(str)) {
                // If ending with F, prioritize as primary VLTD eSIM
                if (str.toUpperCase().endsWith('F') || !detectedIccid) {
                  detectedIccid = str.toUpperCase();
                }
              }
              // 4. Detect 10-15 digit SIM phone number
              else if (/^(?:91)?[6-9]\d{9}$/.test(str) && !detectedSimNo) {
                detectedSimNo = str;
              }
            }

            if (detectedImei && !seenImeis.has(detectedImei)) {
              seenImeis.add(detectedImei);
              const isVolty = detectedSerial.includes('VOL');
              const mfr = isVolty ? 'VOLTY IOT SOLUTIONS PRIVATE LIMITED' : 'APM KINGSTRACK PRIVATE LIMITED';
              const model = isVolty ? 'VOLTY-AIS140' : '1819001A';

              normalized.push({
                imei: detectedImei,
                serialNo: detectedSerial || (isVolty ? `VOL1K2I${detectedImei.slice(-10)}` : `APM1K2I${detectedImei.slice(-10)}`),
                iccid: detectedIccid || '8991430008117572979F',
                model,
                manufacturer: mfr,
                simProvider: 'Technojacks',
                simNo: detectedSimNo
              });
            }
          }
        }

        if (normalized.length === 0) {
          setStatusMessage({ type: 'error', text: 'No rows with valid numeric IMEIs found in file.' });
        } else {
          setParsedDevices(normalized);
          setBatchName(file.name.replace(/\.[^/.]+$/, ''));
        }
      } catch (err) {
        console.error('File parsing error:', err);
        setStatusMessage({ type: 'error', text: 'Failed to parse Excel file. Please ensure valid XLSX/XLS format.' });
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleUploadSubmit = async () => {
    if (parsedDevices.length === 0) return;
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const payload = {
        batchName: batchName || 'Imported_Batch',
        records: parsedDevices.map(d => ({
          imei: d.imei,
          serial_no: d.serialNo,
          iccid: d.iccid,
          device_model: d.model,
          manufacturer: d.manufacturer,
          sim_provider: d.simProvider,
          sim_no: d.simNo
        }))
      };

      const res = await axiosInstance.post('/api/admin/device-inventory/bulk-import', payload);
      if (res.data && res.data.success) {
        setStatusMessage({
          type: 'success',
          text: `Success! ${res.data.importedCount} devices saved into master inventory.`
        });
        if (onSuccess) onSuccess(res.data);
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setStatusMessage({ type: 'error', text: res.data?.error || 'Failed to save devices.' });
      }
    } catch (err) {
      console.error('Import submit error:', err);
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Server error during inventory import.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-700">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                Import Device Master Inventory
              </h2>
              <p className="text-xs text-slate-500">
                Upload manufacturer Excel sheet (APM, Volty, etc.) to auto-fetch Serial No, ICCID & Manufacturer on Fitment Certificates.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-5">
          {/* File Upload Drop Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50/80 rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="p-3 bg-white shadow-sm border border-blue-200 rounded-full text-blue-600">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div className="text-sm font-semibold text-slate-700">
              {selectedFile ? selectedFile.name : 'Click to select manufacturer Excel sheet'}
            </div>
            <p className="text-xs text-slate-500">
              Supports any APM or Volty dispatch sheet (with or without headers) containing IMEI, Serial No, and ICCID
            </p>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3 rounded-lg flex items-center gap-2.5 text-xs font-medium ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Parsed Preview Table */}
          {parsedDevices.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  Ready to Import ({parsedDevices.length} devices found)
                </span>
                <span className="text-[11px] text-slate-500">
                  Batch: <strong className="text-slate-800">{batchName}</strong>
                </span>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">IMEI</th>
                      <th className="px-3 py-2">Device Serial No</th>
                      <th className="px-3 py-2">ICCID</th>
                      <th className="px-3 py-2">Model</th>
                      <th className="px-3 py-2">Manufacturer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {parsedDevices.slice(0, 100).map((d, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-1.5 font-bold text-slate-800">{d.imei}</td>
                        <td className="px-3 py-1.5 text-slate-600">{d.serialNo}</td>
                        <td className="px-3 py-1.5 text-slate-600">{d.iccid}</td>
                        <td className="px-3 py-1.5 font-sans font-medium text-slate-700">{d.model}</td>
                        <td className="px-3 py-1.5 font-sans text-blue-700 font-medium">{d.manufacturer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedDevices.length > 100 && (
                <p className="text-[10px] text-slate-400 text-right">
                  Showing first 100 of {parsedDevices.length} devices
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleUploadSubmit}
            disabled={parsedDevices.length === 0 || isSubmitting || isParsing}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving to Inventory...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Save {parsedDevices.length > 0 ? `${parsedDevices.length} Devices` : ''} to Master Inventory
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
