import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X, Download,
  Loader2, RefreshCw, Edit3, Trash2, Check, AlertTriangle, Eye, Plus
} from 'lucide-react';
import { bulkOnboardExcel, createOrg } from '../api/adminApi';
import { generateVehicleOnboardingTemplate } from '../utils/excelTemplateGenerator';
import AddGroupModal from './modals/AddGroupModal';
import AddUserModal from './modals/AddUserModal';

export default function ExcelBulkUploadModal({ isOpen, onClose, onSuccess, availableGroups = [], availableOrgs = [], currentOrgId, isSuperAdmin }) {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState(currentOrgId || '');
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'errors' | 'valid'
  const [editingRowIndex, setEditingRowIndex] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [importStatus, setImportStatus] = useState(null); // { success: boolean, message: string, count: number }

  // Quick Modal States
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isAddOrgOpen, setIsAddOrgOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgType, setNewOrgType] = useState('company');
  const [orgCreating, setOrgCreating] = useState(false);

  if (!isOpen) return null;

  const validateRows = (rows) => {
    const seenImeis = new Set();
    const seenPlates = new Set();

    return rows.map((row, index) => {
      const errors = [];
      const imei = String(row['Device ID(IMEI)'] || row['IMEI Number'] || row['IMEI'] || row.imei || '').trim();
      const vehicleNo = String(row['Vehicle Id'] || row['Registration Number'] || row['Registration No'] || row['Vehicle Number'] || row['Plate'] || row.vehicleNumber || row.vehicleId || '').trim();
      const category = String(row['Category'] || row.category || 'General').trim();
      const rawDeviceType = String(row['Device Type'] || row['Device Type (BSTPL/AIS140/AIS140V2/CONCOX/VOLTY/FMB 920)'] || row['Device Model'] || row.deviceModel || 'AIS140').trim();
      const deviceModel = rawDeviceType.split(' (')[0].trim();

      // IMEI Validation — must be exactly 15 numeric digits
      if (!imei) {
        errors.push('IMEI number is required');
      } else if (!/^\d{15}$/.test(imei)) {
        errors.push('IMEI must be exactly 15 numeric digits');
      } else if (seenImeis.has(imei)) {
        errors.push(`Duplicate IMEI in file (${imei})`);
      } else {
        seenImeis.add(imei);
      }

      // Vehicle Plate Validation
      if (!vehicleNo) {
        errors.push('Vehicle Id / Plate Number is required');
      } else if (seenPlates.has(vehicleNo.toUpperCase())) {
        errors.push(`Duplicate Vehicle Id in file (${vehicleNo})`);
      } else {
        seenPlates.add(vehicleNo.toUpperCase());
      }

      return {
        ...row,
        _rowIndex: index,
        _imei: imei,
        _vehicleNo: vehicleNo,
        _category: category,
        _deviceModel: deviceModel,
        _isValid: errors.length === 0,
        _errors: errors
      };
    });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsValidating(true);
    setImportStatus(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json(ws, { raw: true });

        if (!data || data.length === 0) {
          alert('Uploaded Excel sheet is empty.');
          setIsValidating(false);
          return;
        }

        const validated = validateRows(data);
        setParsedRows(validated);
      } catch (err) {
        console.error('Error parsing excel:', err);
        alert('Failed to parse Excel file. Please ensure it is a valid .xlsx or .csv file.');
      } finally {
        setIsValidating(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleStartEdit = (index) => {
    setEditingRowIndex(index);
    setEditFormData({ ...parsedRows[index] });
  };

  const handleSaveEdit = () => {
    const updated = [...parsedRows];
    updated[editingRowIndex] = {
      ...updated[editingRowIndex],
      ...editFormData,
      'Device ID(IMEI)': editFormData._imei || editFormData['Device ID(IMEI)'],
      'Vehicle Id': editFormData._vehicleNo || editFormData['Vehicle Id'] || editFormData['Vehicle Number'],
      'Category': editFormData._category || editFormData['Category'],
      'Device Type': editFormData._deviceModel || editFormData['Device Type']
    };
    const revalidated = validateRows(updated);
    setParsedRows(revalidated);
    setEditingRowIndex(null);
  };

  const handleDeleteRow = (index) => {
    const updated = parsedRows.filter((_, idx) => idx !== index);
    const revalidated = validateRows(updated);
    setParsedRows(revalidated);
  };

  const handleConfirmImport = async () => {
    const validRows = parsedRows.filter(r => r._isValid);
    if (validRows.length === 0) {
      alert('There are no valid vehicle rows to import. Please resolve the errors first.');
      return;
    }

    setIsSubmitting(true);
    setImportStatus(null);

    try {
      const recordsToSubmit = validRows.map(r => {
        const rawDeviceType = String(r['Device Type'] || r._deviceModel || 'AIS140').trim();
        const cleanDeviceType = rawDeviceType.split(' (')[0].trim();

        return {
          imei: r._imei || r['Device ID(IMEI)'] || '',
          registrationNo: r['Registration Number'] || r['Registration No'] || r._vehicleNo || '',
          vehicleName: r['Vehicle Name'] || r._vehicleNo || '',
          vehicleId: r['Vehicle Id'] || r._vehicleNo || '',
          vehicleModel: r['Vehicle Model'] || '',
          vehicleTypeSelect: r['Vehicle Type'] || '',
          deviceType: cleanDeviceType,
          category: r._category || r['Category'] || 'General',
          vlttdSlno: r['VLTD SLNO'] || r['VLTTD SLNO'] || '',
          iccid: r['ICCID'] || '',
          sim1: r['GPS SIM Number 1'] || r['GPS SIMNO 1'] || r['GPS SIMNO1'] || r['SIM 1'] || '',
          sim2: r['GPS SIM Number 2'] || r['GPS SIMNO 2'] || r['GPS SIMNO2'] || r['SIM 2'] || '',
          chassisNo: r['Chassis Number'] || '',
          engineNo: r['Engine Number'] || '',
          sensorNo: r['Sensor Number'] || r['Sensor No'] || '',
          engineOnStatus: r['Ignition ON Status'] || r['Ignition Detection'] || r['engine on status'] || r['Engine ON Status'] || 'Voltage+Ignition',
          vehicleVoltage: r['Vehicle Voltage'] || r['vehicle voltage'] || '',
          timezone: r['Timezone'] || r['timezone'] || 'IST',
          serviceEngineer: r['Service Engineer Number'] || r['Service Engineer'] || r['service engineer'] || '',
          serviceEngineerPhone: r['Service Mobile Number'] || r['Service Engineer Mobno'] || r['service engineer mobile number'] || '',
          salesman: r['Salesman'] || r['salesman'] || '',
          salesmanPhone: r['Salesman Mobile Number'] || r['Salesman Mobno'] || r['salesman mobile number'] || '',
          group: [
            r['Existing Group'] || r['Group'] || r['Groups'] || '',
            r['New Group (Auto-Create)'] || r['New Group'] || ''
          ].filter(Boolean).join(','),
          oldGroups: r['OLD GROUPS'] || '',
          ownerName: r['Owner Name'] || r['Customer Name'] || r['Owner name'] || '',
          ownerPhone: r['Owner Mobile Number'] || r['Customer Mobile Number'] || r['Owner mobile number'] || '',
          ownerAadhar: r['Owner Aadhar ID'] || r['Customer Aadhar'] || r['Owner AADHAR'] || '',
          ownerPan: r['Owner Pancard Number'] || r['Customer PAN'] || r['Owner PAN'] || '',
          rtoLocation: r['Owner Location'] || r['Customer Location'] || r['OWNER /RTO LOCATION'] || '',
          installedDate: r['Installation Date'] || r['Installed Date'] || null,
          onboardingDate: r['Onboarding Date'] || null,
          email: r['Owner Email ID'] || r['Customer Email ID'] || r['Email'] || '',
          username: r['Username'] || r['Username Name'] || '',
          password: r['Password'] || r['password'] || '',
          licenceId: r['LicenceId'] || r['LicenceId (Starter)'] || '',
          odoDistance: r['Odometer'] || r['Odo Distance'] || '',
          ticketId: r['Ticket Id'] || '',
          orgId: selectedOrgId || currentOrgId
        };
      });

      const res = await bulkOnboardExcel({
        records: recordsToSubmit,
        defaultOrgId: selectedOrgId || currentOrgId
      });

      if (res.success) {
        setImportStatus({
          success: true,
          message: res.message || `Successfully onboarded ${res.count} vehicles!`,
          count: res.count
        });
        if (onSuccess) onSuccess();
      } else {
        setImportStatus({
          success: false,
          message: res.error || 'Failed to onboard vehicles.'
        });
      }
    } catch (err) {
      console.error(err);
      setImportStatus({
        success: false,
        message: err.response?.data?.error || err.message || 'An unexpected error occurred during import.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const validCount = parsedRows.filter(r => r._isValid).length;
  const errorCount = parsedRows.filter(r => !r._isValid).length;

  const displayRows = parsedRows.filter(r => {
    if (filterMode === 'errors') return !r._isValid;
    if (filterMode === 'valid') return r._isValid;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>Bulk Vehicle Onboarding via Excel</h2>
              <p style={{ fontSize: '12px', color: '#334155', fontWeight: 600, margin: 0 }}>Upload pre-filled spreadsheet to onboard vehicles, configure devices, and auto-create customer accounts.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => generateVehicleOnboardingTemplate(availableGroups)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg border border-orange-200 transition-colors"
            >
              <Download size={14} /> Download Template
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {isSuperAdmin && availableOrgs.length > 0 && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-4">
              <div>
                <label style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', display: 'block' }}>Target Organization</label>
                <p style={{ fontSize: '12px', color: '#334155', fontWeight: 500, margin: 0 }}>Vehicles and customer accounts will be provisioned under this organization.</p>
              </div>
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                style={{ padding: '8px 12px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: '#0F172A', outline: 'none' }}
              >
                <option value="">Default (Current Organization)</option>
                {availableOrgs.map(org => (
                  <option key={org.id} value={org.id}>{org.name} ({org.type})</option>
                ))}
              </select>
            </div>
          )}

          {/* File Dropzone */}
          {parsedRows.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{ border: '2px dashed #CBD5E1', background: '#F8FAFC', borderRadius: '16px', padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#f97316'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#CBD5E1'}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-16 h-16 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mb-4">
                <Upload size={30} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', marginBottom: '8px', textAlign: 'center' }}>
                Click to Upload or Drag & Drop Excel File
              </h3>
              <p style={{ fontSize: '13px', color: '#334155', fontWeight: 600, marginBottom: '20px', textAlign: 'center', maxWidth: '520px', lineHeight: '1.5' }}>
                Supports <code style={{ background: '#E2E8F0', padding: '2px 6px', borderRadius: '4px', color: '#0F172A', fontWeight: 800 }}>.xlsx</code>, <code style={{ background: '#E2E8F0', padding: '2px 6px', borderRadius: '4px', color: '#0F172A', fontWeight: 800 }}>.xls</code>, or <code style={{ background: '#E2E8F0', padding: '2px 6px', borderRadius: '4px', color: '#0F172A', fontWeight: 800 }}>.csv</code> formatted files with IMEI, Vehicle Number, Category, Customer credentials, and Groups.
              </p>
              <span style={{ padding: '10px 24px', background: '#0F172A', color: '#FFFFFF', borderRadius: '10px', fontSize: '13px', fontWeight: 800, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                Browse Files
              </span>
            </div>
          ) : (
            /* Uploaded Preview Section */
            <div className="space-y-4">
              
              {/* Summary Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="text-orange-600" size={20} />
                  <div>
                    <span className="text-xs font-bold text-slate-800">{selectedFile?.name}</span>
                    <span className="text-xs text-slate-500 ml-2">({parsedRows.length} total rows parsed)</span>
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFilterMode('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      filterMode === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    All ({parsedRows.length})
                  </button>
                  <button
                    onClick={() => setFilterMode('valid')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                      filterMode === 'valid' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                    }`}
                  >
                    <CheckCircle2 size={14} /> Ready to Import ({validCount})
                  </button>
                  {errorCount > 0 && (
                    <button
                      onClick={() => setFilterMode('errors')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                        filterMode === 'errors' ? 'bg-rose-600 text-white shadow-sm' : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
                      }`}
                    >
                      <AlertCircle size={14} /> Issues Found ({errorCount})
                    </button>
                  )}

                  <button
                    onClick={() => { setParsedRows([]); setSelectedFile(null); setImportStatus(null); }}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg ml-2"
                    title="Upload Different File"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
              </div>

              {/* Status Notice */}
              {importStatus && (
                <div className={`p-4 rounded-xl border flex items-center gap-3 ${
                  importStatus.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  {importStatus.success ? <CheckCircle2 size={20} className="shrink-0" /> : <AlertCircle size={20} className="shrink-0" />}
                  <div className="text-xs font-semibold">{importStatus.message}</div>
                </div>
              )}

              {/* Interactive Data Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm max-h-[380px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">IMEI Number</th>
                      <th className="py-2.5 px-3">Vehicle Id</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Device Type</th>
                      <th className="py-2.5 px-3">Groups</th>
                      <th className="py-2.5 px-3">Customer / Username</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {displayRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                          No rows match the selected filter.
                        </td>
                      </tr>
                    ) : (
                      displayRows.map((row) => {
                        const isEditing = editingRowIndex === row._rowIndex;

                        return (
                          <tr
                            key={row._rowIndex}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              !row._isValid ? 'bg-rose-50/40' : ''
                            }`}
                          >
                            {/* Status */}
                            <td className="py-2.5 px-3">
                              {row._isValid ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  <Check size={10} /> Valid
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800"
                                  title={row._errors.join(', ')}
                                >
                                  <AlertTriangle size={10} /> {row._errors[0]}
                                </span>
                              )}
                            </td>

                            {/* IMEI */}
                            <td className="py-2.5 px-3 font-mono font-medium text-slate-800">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editFormData._imei || ''}
                                  onChange={(e) => setEditFormData({ ...editFormData, _imei: e.target.value })}
                                  className="px-2 py-1 border border-orange-400 rounded text-xs w-36"
                                />
                              ) : (
                                row._imei || <span className="text-rose-500 font-bold">Missing</span>
                              )}
                            </td>

                            {/* Vehicle Plate */}
                            <td className="py-2.5 px-3 font-semibold text-slate-800">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editFormData._vehicleNo || ''}
                                  onChange={(e) => setEditFormData({ ...editFormData, _vehicleNo: e.target.value })}
                                  className="px-2 py-1 border border-orange-400 rounded text-xs w-28 uppercase"
                                />
                              ) : (
                                row._vehicleNo || <span className="text-rose-500 font-bold">Missing</span>
                              )}
                            </td>

                            {/* Category */}
                            <td className="py-2.5 px-3">
                              {isEditing ? (
                                <select
                                  value={editFormData._category || 'General'}
                                  onChange={(e) => setEditFormData({ ...editFormData, _category: e.target.value })}
                                  className="px-2 py-1 border border-orange-400 rounded text-xs"
                                >
                                  <option value="General">General</option>
                                  <option value="TG Mining">TG Mining</option>
                                  <option value="VLTD">VLTD</option>
                                  <option value="VLTD + Mining">VLTD + Mining</option>
                                </select>
                              ) : (
                                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                  row._category === 'TG Mining' ? 'bg-amber-100 text-amber-800' :
                                  row._category === 'VLTD' ? 'bg-blue-100 text-blue-800' :
                                  row._category === 'VLTD + Mining' ? 'bg-purple-100 text-purple-800' :
                                  'bg-slate-100 text-slate-700'
                                }`}>
                                  {row._category || 'General'}
                                </span>
                              )}
                            </td>

                            {/* Device Model */}
                            <td className="py-2.5 px-3 text-slate-600 font-medium">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editFormData._deviceModel || ''}
                                  onChange={(e) => setEditFormData({ ...editFormData, _deviceModel: e.target.value })}
                                  className="px-2 py-1 border border-orange-400 rounded text-xs w-24"
                                />
                              ) : (
                                row._deviceModel || 'AIS140'
                              )}
                            </td>

                            {/* Groups */}
                            <td className="py-2.5 px-3 text-slate-600 max-w-[150px] truncate" title={row['Group'] || row['Groups'] || ''}>
                              {row['Group'] || row['Groups'] || <span className="text-slate-400 italic">None</span>}
                            </td>

                            {/* Customer / Username */}
                            <td className="py-2.5 px-3 text-slate-700">
                              <div className="font-semibold">{row['Owner Name'] || row['Customer Name'] || row['Owner Mobile Number'] || row['Customer Phone Number'] || '—'}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{row['Username'] || row['Owner Email ID'] || row['Email'] || ''}</div>
                            </td>

                            {/* Actions */}
                            <td className="py-2.5 px-3 text-right">
                              {isEditing ? (
                                <button
                                  onClick={handleSaveEdit}
                                  className="p-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded mr-1"
                                  title="Save Changes"
                                >
                                  <Check size={14} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleStartEdit(row._rowIndex)}
                                  className="p-1 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded mr-1"
                                  title="Quick Edit Row"
                                >
                                  <Edit3 size={14} />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteRow(row._rowIndex)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                title="Remove Row"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/80">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-bold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-all shadow-2xs cursor-pointer"
          >
            Cancel
          </button>

          {parsedRows.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 font-medium">
                {validCount} ready to import {errorCount > 0 && `(${errorCount} skipped/with issues)`}
              </span>
              <button
                onClick={handleConfirmImport}
                disabled={isSubmitting || validCount === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/20 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Onboarding Vehicles...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} /> Confirm & Onboard ({validCount})
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Quick Add Org Modal */}
        {isAddOrgOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 w-full max-w-md space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-800">Quick Add Organization</h3>
                <button onClick={() => setIsAddOrgOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Organization Name</label>
                  <input type="text" value={newOrgName} onChange={e => setNewOrgName(e.target.value)} placeholder="e.g. Apex Logistics" className="w-full px-3 py-2 border rounded-lg text-xs" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Organization Type</label>
                  <select value={newOrgType} onChange={e => setNewOrgType(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-xs">
                    <option value="company">Company</option>
                    <option value="dealer">Dealer</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setIsAddOrgOpen(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg">Cancel</button>
                <button
                  disabled={orgCreating || !newOrgName.trim()}
                  onClick={async () => {
                    setOrgCreating(true);
                    try {
                      const res = await createOrg({ name: newOrgName, type: newOrgType });
                      if (res.success) {
                        alert(`Organization "${newOrgName}" created successfully!`);
                        setIsAddOrgOpen(false);
                        setNewOrgName('');
                        if (onSuccess) onSuccess();
                      }
                    } catch (err) {
                      alert(err.response?.data?.error || 'Failed to create organization');
                    } finally {
                      setOrgCreating(false);
                    }
                  }}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-orange-600 rounded-lg cursor-pointer"
                >
                  {orgCreating ? 'Creating...' : 'Save Organization'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Add Group Modal */}
        {isAddGroupOpen && (
          <AddGroupModal
            isOpen={isAddGroupOpen}
            onClose={() => setIsAddGroupOpen(false)}
            orgs={availableOrgs}
            onSave={() => {
              setIsAddGroupOpen(false);
              if (onSuccess) onSuccess();
            }}
          />
        )}

        {/* Quick Add User Modal */}
        {isAddUserOpen && (
          <AddUserModal
            isOpen={isAddUserOpen}
            onClose={() => setIsAddUserOpen(false)}
            orgs={availableOrgs}
            onSave={() => {
              setIsAddUserOpen(false);
              if (onSuccess) onSuccess();
            }}
          />
        )}

      </div>
    </div>
  );
}
