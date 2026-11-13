import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, Loader2,
  Trash2, RefreshCw, Cpu, Layers, Download, Check
} from 'lucide-react';
import axiosInstance from '../../api/axios';

export const MANUFACTURER_PRESETS = [
  { id: 'auto', label: '⚡ Auto-Detect (From Sheet / Serial Prefix)', mfr: null, defaultModel: null },
  { id: 'volty', label: 'Volty (Volty IoT Solutions Private Limited)', mfr: 'VOLTY IOT SOLUTIONS PRIVATE LIMITED', defaultModel: 'VOLTY-AIS140' },
  { id: 'apm', label: 'APM (APM Kingstrack Private Limited)', mfr: 'APM KINGSTRACK PRIVATE LIMITED', defaultModel: '1819001A' },
  { id: 'teltonika', label: 'Teltonika Telematics', mfr: 'TELTONIKA TELEMATICS', defaultModel: 'FMB 920' },
  { id: 'concox', label: 'Concox / Jimi IoT', mfr: 'CONCOX / JIMI IOT', defaultModel: 'V5 / GT800' },
  { id: 'bstpl', label: 'BSTPL (Bharat Satellite Tracking Pvt Ltd)', mfr: 'BHARAT SATELLITE TRACKING PVT LTD', defaultModel: 'BSTPL-17' },
  { id: 'tracknow', label: 'TrackNow Solutions Private Limited', mfr: 'TRACKNOW SOLUTIONS PRIVATE LIMITED', defaultModel: 'AIS140' },
  { id: 'vamo', label: 'VAMO Systems Private Limited', mfr: 'VAMO SYSTEMS PRIVATE LIMITED', defaultModel: 'AIS140 V2' },
  { id: 'transync', label: 'TranSync Telematics', mfr: 'TRANSYNC TELEMATICS', defaultModel: 'NAV 140' },
  { id: 'custom', label: '✏️ Custom / Other Manufacturer...', mfr: '', defaultModel: 'AIS140' }
];

export function normalizeManufacturerName(name) {
  if (!name || typeof name !== 'string') return '';
  const up = name.trim().toUpperCase();
  if (up.includes('VOLTY') || up.includes('VOLTSYS') || up.includes('VOL1') || up.includes('VLY') || up === 'VOLTY') {
    return 'VOLTY IOT SOLUTIONS PRIVATE LIMITED';
  }
  if (up.includes('APM') || up.includes('KINGSTRACK') || up.includes('KINGSTRACKS')) {
    return 'APM KINGSTRACK PRIVATE LIMITED';
  }
  if (up.includes('TELTONIKA')) {
    return 'TELTONIKA TELEMATICS';
  }
  if (up.includes('CONCOX') || up.includes('JIMI')) {
    return 'CONCOX / JIMI IOT';
  }
  if (up.includes('BSTPL') || up.includes('BHARAT SATELLITE')) {
    return 'BHARAT SATELLITE TRACKING PVT LTD';
  }
  if (up.includes('TRACKNOW')) {
    return 'TRACKNOW SOLUTIONS PRIVATE LIMITED';
  }
  if (up.includes('VAMO')) {
    return 'VAMO SYSTEMS PRIVATE LIMITED';
  }
  if (up.includes('TRANSYNC')) {
    return 'TRANSYNC TELEMATICS';
  }
  return name.trim();
}

export function detectManufacturer(model, serialNo, explicitMfr, presetId, customName) {
  // 1. Explicit preset chosen by user
  if (presetId && presetId !== 'auto') {
    if (presetId === 'custom' && customName && customName.trim()) {
      return customName.trim();
    }
    const found = MANUFACTURER_PRESETS.find(p => p.id === presetId);
    if (found && found.mfr) return found.mfr;
  }

  // 2. Explicit manufacturer column from sheet
  if (explicitMfr && typeof explicitMfr === 'string' && explicitMfr.trim() && explicitMfr.trim() !== 'FUELTRACKS TECHNOLOGIES PRIVATE LIMITED') {
    return normalizeManufacturerName(explicitMfr);
  }

  // 3. Auto-detect from Model and Serial Number
  const text = `${model || ''} ${serialNo || ''}`.toUpperCase().trim();
  if (text.includes('VOLTY') || text.includes('VOL1') || text.includes('VLY') || text.includes('VLT') || text.includes('VOLTSYS') || text.startsWith('VOL') || text.startsWith('VLY')) {
    return 'VOLTY IOT SOLUTIONS PRIVATE LIMITED';
  }
  if (text.includes('APM') || text.includes('KINGSTRACK') || text.startsWith('APM') || text.includes('1819001A')) {
    return 'APM KINGSTRACK PRIVATE LIMITED';
  }
  if (text.includes('TELTONIKA') || text.includes('FMC') || text.includes('FMB') || text.includes('FMM') || text.includes('TST')) {
    return 'TELTONIKA TELEMATICS';
  }
  if (text.includes('CONCOX') || text.includes('JIMI') || text.includes('WETRACK') || text.includes('GT06') || text.includes('GT800') || text.includes('V5')) {
    return 'CONCOX / JIMI IOT';
  }
  if (text.includes('BSTPL') || text.includes('BST')) {
    return 'BHARAT SATELLITE TRACKING PVT LTD';
  }
  if (text.includes('TRACKNOW') || text.includes('TRK')) {
    return 'TRACKNOW SOLUTIONS PRIVATE LIMITED';
  }
  if (text.includes('VAMO')) {
    return 'VAMO SYSTEMS PRIVATE LIMITED';
  }
  if (text.includes('TRANSYNC') || text.includes('NAV140') || text.includes('NAV 140')) {
    return 'TRANSYNC TELEMATICS';
  }

  return 'VOLTY IOT SOLUTIONS PRIVATE LIMITED';
}

export function getDefaultModelForManufacturer(mfr) {
  if (!mfr) return 'AIS140';
  const up = mfr.toUpperCase();
  if (up.includes('VOLTY')) return 'VOLTY-AIS140';
  if (up.includes('APM')) return '1819001A';
  if (up.includes('TELTONIKA')) return 'FMB 920';
  if (up.includes('CONCOX')) return 'V5 / GT800';
  if (up.includes('BSTPL')) return 'BSTPL-17';
  if (up.includes('TRACKNOW')) return 'AIS140';
  if (up.includes('VAMO')) return 'AIS140 V2';
  if (up.includes('TRANSYNC')) return 'NAV 140';
  return 'AIS140';
}

export default function DeviceInventoryUploadModal({ isOpen, onClose, onSuccess }) {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedDevices, setParsedDevices] = useState([]);
  const [batchName, setBatchName] = useState('');
  const [selectedManufacturer, setSelectedManufacturer] = useState('auto');
  const [customMfrName, setCustomMfrName] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  if (!isOpen) return null;

  function extractField(row, targetNames) {
    const rowKeys = Object.keys(row || {});
    for (const t of targetNames) {
      const cleanT = t.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const rk of rowKeys) {
        const cleanRk = rk.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanRk === cleanT && row[rk] !== undefined && row[rk] !== null) {
          const val = String(row[rk]).trim();
          if (val) return val;
        }
      }
    }
    return '';
  }

  function extractSerialNo(row) {
    // 1. Check direct exact serial headers first
    const exactHeaders = [
      'deviceserialnumber', 'deviceserialno', 'deviceserial', 'deviceslno',
      'serialnumber', 'serialno', 'serialnum', 'serial',
      'vltdserialnumber', 'vltdserialno', 'vltdslno', 'vlttdslno',
      'devicesno', 'srno', 'sn', 'dsn', 'deviceuid', 'uid', 'hardwareid',
      'boxserialnumber', 'boxserialno', 'machineserialnumber', 'unitserialnumber'
    ];
    const val = extractField(row, exactHeaders);
    if (val) return val;

    // 2. Check generic 'slno' or 'sno' ONLY if value contains letters or length > 5 (not a 1, 2, 3 counter)
    const genericSl = extractField(row, ['slno', 'sno']);
    if (genericSl && (/[a-zA-Z]/.test(genericSl) || genericSl.length > 5)) {
      return genericSl;
    }
    return '';
  }

  const parseWorkbook = (wb, chosenMfrPreset, chosenCustomMfr) => {
    const wsName = wb.SheetNames[0];
    const ws = wb.Sheets[wsName];

    // 1. Object rows
    const objRows = XLSX.utils.sheet_to_json(ws, { raw: true });
    // 2. 2D array rows (header: 1) for headerless files
    const arrRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

    if (!arrRows || arrRows.length === 0) {
      setStatusMessage({ type: 'error', text: 'Uploaded Excel file is empty.' });
      setIsParsing(false);
      return [];
    }

    const normalized = [];
    const seenImeis = new Set();

    let hasNamedHeaders = false;
    if (objRows.length > 0) {
      const sampleKeys = Object.keys(objRows[0] || {}).map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
      hasNamedHeaders = sampleKeys.some(k =>
        k.includes('imei') || k.includes('device') || k.includes('serial') || k.includes('iccid') || k.includes('vltd')
      );
    }

    if (hasNamedHeaders) {
      for (let i = 0; i < objRows.length; i++) {
        const r = objRows[i];
        let imeiRaw = extractField(r, ['imei', 'deviceidimei', 'imeinumber', 'imeino', 'deviceid', 'deviceimei', 'vltdimei', 'vltddslno', 'primaryimei', 'imei1']);
        if (imeiRaw.includes('e+') || imeiRaw.includes('E+')) {
          try { imeiRaw = BigInt(Number(imeiRaw)).toString(); } catch (_) {}
        }
        const imei = imeiRaw.replace(/\D/g, '');

        if (!imei || imei.length < 10) continue;
        if (seenImeis.has(imei)) continue;
        seenImeis.add(imei);

        const serialNo = extractSerialNo(r);
        const iccid = extractField(r, ['iccid', 'iccidnumber', 'iccidno', 'esimiccid', 'simiccid', 'simnumber', 'simno']);
        const model = extractField(r, ['devicemodel', 'model', 'modelname', 'modelnumber', 'devicetype', 'deviceversion', 'hardwareversion', 'type']);
        const explicitMfr = extractField(r, ['manufacturer', 'vltdmanufacturer', 'vltdmanufacturername', 'mfr', 'make', 'vendor', 'brand']);
        const simProvider = extractField(r, ['simprovider', 'simserviceprovider', 'provider', 'operator', 'telco']) || 'Technojacks';
        const simNo = extractField(r, ['simno', 'simnumber', 'simphonenumber', 'simnumber1', 'gpssimnumber1', 'mobilenumber', 'phone', 'sim1', 'msisdn']);

        const resolvedMfr = detectManufacturer(model, serialNo, explicitMfr, chosenMfrPreset, chosenCustomMfr);
        const resolvedModel = model || getDefaultModelForManufacturer(resolvedMfr);

        const isVolty = resolvedMfr.includes('VOLTY');
        const defaultSerial = isVolty ? `VLY2N2I${imei.slice(-10)}` : `APM1K2I${imei.slice(-10)}`;

        normalized.push({
          imei,
          serialNo: serialNo || defaultSerial,
          iccid: iccid || '8991430008117572979F',
          model: resolvedModel,
          manufacturer: resolvedMfr,
          simProvider,
          simNo
        });
      }
    } else {
      // Parse headerless raw row arrays
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
          // 2. Detect Serial No (starts with VLY, VOL, APM, FMB, FMC, BST, or alphanumeric >= 6)
          else if (/^(?:APM|VOL|VLY|VLT|FMB|FMC|BST)[A-Z0-9]+$/i.test(str) && !detectedSerial) {
            detectedSerial = str.toUpperCase();
          }
          // 3. Detect ICCID starting with 8991 (18-22 chars)
          else if (/^8991[0-9A-Z]{14,18}$/i.test(str)) {
            if (str.toUpperCase().endsWith('F') || !detectedIccid) {
              detectedIccid = str.toUpperCase();
            }
          }
          // 4. Detect 10-15 digit SIM phone number
          else if (/^(?:91)?[6-9]\d{9}$/.test(str) && !detectedSimNo) {
            detectedSimNo = str;
          }
        }

        // Secondary fallback for serial in headerless row: any remaining token that looks like a serial
        if (!detectedSerial && detectedImei) {
          for (const cell of row) {
            const str = String(cell || '').trim();
            if (!str || str === detectedImei || str === detectedIccid || str === detectedSimNo) continue;
            if (/^[A-Z0-9_-]{6,25}$/i.test(str) && !/^\d{10}$/.test(str)) {
              detectedSerial = str.toUpperCase();
              break;
            }
          }
        }

        if (detectedImei && !seenImeis.has(detectedImei)) {
          seenImeis.add(detectedImei);
          const resolvedMfr = detectManufacturer('', detectedSerial, '', chosenMfrPreset, chosenCustomMfr);
          const isVolty = resolvedMfr.includes('VOLTY');
          const defaultSerial = isVolty ? `VLY2N2I${detectedImei.slice(-10)}` : `APM1K2I${detectedImei.slice(-10)}`;

          normalized.push({
            imei: detectedImei,
            serialNo: detectedSerial || defaultSerial,
            iccid: detectedIccid || '8991430008117572979F',
            model: getDefaultModelForManufacturer(resolvedMfr),
            manufacturer: resolvedMfr,
            simProvider: 'Technojacks',
            simNo: detectedSimNo
          });
        }
      }
    }

    return normalized;
  };

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
        const normalized = parseWorkbook(wb, selectedManufacturer, customMfrName);

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

  const handleManufacturerChange = (newPreset) => {
    setSelectedManufacturer(newPreset);
    if (parsedDevices.length > 0) {
      const match = MANUFACTURER_PRESETS.find(p => p.id === newPreset);
      if (match && match.mfr) {
        setParsedDevices(prev =>
          prev.map(d => ({
            ...d,
            manufacturer: match.mfr,
            model: match.defaultModel || d.model
          }))
        );
      }
    }
  };

  const handleUpdateDeviceRow = (index, field, value) => {
    setParsedDevices(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      if (field === 'manufacturer') {
        copy[index].model = getDefaultModelForManufacturer(value);
      }
      return copy;
    });
  };

  const handleApplyManufacturerToAll = (mfrName) => {
    if (!mfrName) return;
    const norm = normalizeManufacturerName(mfrName);
    const model = getDefaultModelForManufacturer(norm);
    setParsedDevices(prev =>
      prev.map(d => ({
        ...d,
        manufacturer: norm,
        model: model || d.model
      }))
    );
  };

  const downloadTemplate = () => {
    const headers = [
      'IMEI',
      'Device Serial Number',
      'ICCID',
      'Manufacturer',
      'Device Model',
      'SIM Provider',
      'SIM Phone Number'
    ];
    const sampleData = [
      [
        '865006049210219',
        'VLY2N2I052685344688',
        '8991430008117572979F',
        'VOLTY IOT SOLUTIONS PRIVATE LIMITED',
        'VOLTY-AIS140',
        'Technojacks',
        '9876543210'
      ],
      [
        '861329082344004',
        'APM1K2I102690315363',
        '8991430008117575493F',
        'APM KINGSTRACK PRIVATE LIMITED',
        '1819001A',
        'Technojacks',
        '915755184128165'
      ],
      [
        '862419041234567',
        'FMB920-1234567',
        '8991430008117579999F',
        'TELTONIKA TELEMATICS',
        'FMB 920',
        'Airtel',
        '9811223344'
      ]
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
    ws['!cols'] = [
      { wch: 18 },
      { wch: 24 },
      { wch: 24 },
      { wch: 36 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Device Master');
    XLSX.writeFile(wb, 'FuelTracks_Device_Master_Template.xlsx');
  };

  const handleUploadSubmit = async () => {
    if (parsedDevices.length === 0) return;
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const allRecords = parsedDevices.map(d => ({
        imei: d.imei,
        serial_no: d.serialNo,
        iccid: d.iccid,
        device_model: d.model,
        manufacturer: d.manufacturer,
        sim_provider: d.simProvider,
        sim_no: d.simNo
      }));

      // Automatically batch in chunks of 1,000 for seamless safety
      const BATCH_SIZE = 1000;
      const totalBatches = Math.ceil(allRecords.length / BATCH_SIZE);
      let totalImported = 0;

      for (let b = 0; b < totalBatches; b++) {
        const start = b * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, allRecords.length);
        const chunk = allRecords.slice(start, end);

        if (totalBatches > 1) {
          setStatusMessage({
            type: 'info',
            text: `Importing batch ${b + 1} of ${totalBatches} (${start + 1} - ${end} of ${allRecords.length} devices)...`
          });
        }

        const payload = {
          batchName: batchName ? `${batchName}${totalBatches > 1 ? `_part${b + 1}` : ''}` : 'Imported_Batch',
          records: chunk
        };

        const res = await axiosInstance.post('/api/admin/device-inventory/bulk-import', payload);
        if (res.data && res.data.success) {
          totalImported += (res.data.importedCount !== undefined ? res.data.importedCount : chunk.length);
        } else {
          throw new Error(res.data?.error || `Failed to save batch ${b + 1}.`);
        }
      }

      setStatusMessage({
        type: 'success',
        text: `Success! ${totalImported} devices saved into master inventory.`
      });
      if (onSuccess) onSuccess({ importedCount: totalImported });
      setTimeout(() => {
        onClose();
      }, 1500);
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
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
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
                Upload manufacturer Excel sheet (Volty, APM, Teltonika, etc.) with IMEI, Device Serial Number, ICCID, and SIM numbers.
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
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {/* Manufacturer Selector */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2">
              <div>
                <label className="block text-xs font-bold text-slate-800">
                  Select Device Manufacturer (Optional Preset)
                </label>
                <p className="text-[11px] text-slate-500">
                  Specify which vendor sheet you are uploading, or leave as Auto-Detect.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedManufacturer}
                  onChange={(e) => handleManufacturerChange(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                >
                  {MANUFACTURER_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedManufacturer === 'custom' && (
              <div className="mt-2 flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Enter custom manufacturer name (e.g. MapmyIndia, Roadpoint, etc.)"
                  value={customMfrName}
                  onChange={(e) => setCustomMfrName(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => handleApplyManufacturerToAll(customMfrName)}
                  className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900"
                >
                  Apply to All
                </button>
              </div>
            )}

            {/* Quick Chips for One-Click Switch */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2.5 border-t border-slate-200 text-xs">
              <span className="text-[11px] font-semibold text-slate-500 mr-1">Quick Select:</span>
              <button
                type="button"
                onClick={() => handleManufacturerChange('volty')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition ${
                  selectedManufacturer === 'volty'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white hover:bg-blue-50 text-slate-700 border-slate-300'
                }`}
              >
                Volty IoT Solutions
              </button>
              <button
                type="button"
                onClick={() => handleManufacturerChange('apm')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition ${
                  selectedManufacturer === 'apm'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white hover:bg-blue-50 text-slate-700 border-slate-300'
                }`}
              >
                APM Kingstrack
              </button>
              <button
                type="button"
                onClick={() => handleManufacturerChange('teltonika')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition ${
                  selectedManufacturer === 'teltonika'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white hover:bg-blue-50 text-slate-700 border-slate-300'
                }`}
              >
                Teltonika
              </button>
              <button
                type="button"
                onClick={() => handleManufacturerChange('concox')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition ${
                  selectedManufacturer === 'concox'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white hover:bg-blue-50 text-slate-700 border-slate-300'
                }`}
              >
                Concox / Jimi
              </button>
              <button
                type="button"
                onClick={() => handleManufacturerChange('auto')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition ${
                  selectedManufacturer === 'auto'
                    ? 'bg-slate-700 text-white border-slate-700 shadow-sm'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-300'
                }`}
              >
                Auto-Detect
              </button>
            </div>
          </div>

          {/* File Upload Drop Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50/80 rounded-xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2"
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
              Supports any Volty, APM, Teltonika, or generic vendor sheet containing IMEI, Device Serial Number, and ICCID
            </p>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3 rounded-lg flex items-center gap-2.5 text-xs font-medium ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : statusMessage.type === 'info'
                  ? 'bg-blue-50 text-blue-800 border border-blue-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : statusMessage.type === 'info' ? (
                <Loader2 className="w-4 h-4 shrink-0 animate-spin text-blue-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Parsed Preview Table */}
          {parsedDevices.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  Ready to Import ({parsedDevices.length} devices found)
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Set All To:</span>
                  <button
                    type="button"
                    onClick={() => handleApplyManufacturerToAll('VOLTY IOT SOLUTIONS PRIVATE LIMITED')}
                    className="px-2 py-0.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 rounded font-bold text-[11px]"
                  >
                    All Volty
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyManufacturerToAll('APM KINGSTRACK PRIVATE LIMITED')}
                    className="px-2 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-300 rounded font-bold text-[11px]"
                  >
                    All APM
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto shadow-inner">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 w-12">#</th>
                      <th className="px-3 py-2">IMEI</th>
                      <th className="px-3 py-2">Device Serial Number</th>
                      <th className="px-3 py-2">Manufacturer</th>
                      <th className="px-3 py-2">Device Model</th>
                      <th className="px-3 py-2">ICCID</th>
                      <th className="px-3 py-2">SIM No</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {parsedDevices.slice(0, 100).map((d, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-1.5 text-slate-400 font-sans">{i + 1}</td>
                        <td className="px-3 py-1.5 font-bold text-slate-800">{d.imei}</td>
                        <td className="px-3 py-1.5">
                          <input
                            type="text"
                            value={d.serialNo}
                            onChange={(e) => handleUpdateDeviceRow(i, 'serialNo', e.target.value)}
                            className="w-full px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-800 font-mono text-[11px]"
                          />
                        </td>
                        <td className="px-3 py-1.5 font-sans">
                          <select
                            value={d.manufacturer}
                            onChange={(e) => handleUpdateDeviceRow(i, 'manufacturer', e.target.value)}
                            className="w-full px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-bold text-slate-800"
                          >
                            <option value="VOLTY IOT SOLUTIONS PRIVATE LIMITED">VOLTY IOT SOLUTIONS PRIVATE LIMITED</option>
                            <option value="APM KINGSTRACK PRIVATE LIMITED">APM KINGSTRACK PRIVATE LIMITED</option>
                            <option value="TELTONIKA TELEMATICS">TELTONIKA TELEMATICS</option>
                            <option value="CONCOX / JIMI IOT">CONCOX / JIMI IOT</option>
                            <option value="BHARAT SATELLITE TRACKING PVT LTD">BHARAT SATELLITE TRACKING PVT LTD</option>
                            <option value="TRACKNOW SOLUTIONS PRIVATE LIMITED">TRACKNOW SOLUTIONS PRIVATE LIMITED</option>
                            <option value="VAMO SYSTEMS PRIVATE LIMITED">VAMO SYSTEMS PRIVATE LIMITED</option>
                            <option value="TRANSYNC TELEMATICS">TRANSYNC TELEMATICS</option>
                          </select>
                        </td>
                        <td className="px-3 py-1.5 font-sans font-medium text-slate-700">{d.model}</td>
                        <td className="px-3 py-1.5 text-slate-600">{d.iccid}</td>
                        <td className="px-3 py-1.5 text-slate-600">{d.simNo || '-'}</td>
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
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={downloadTemplate}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition cursor-pointer"
              title="Download standardized Excel template with sample Volty & APM rows"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Excel Template</span>
            </button>
          </div>
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
