import React, { useState, useEffect } from 'react';
import { X, History, FileSpreadsheet, FileText, Download, AlertCircle } from 'lucide-react';
import { getFuelEntries } from '../../api/manualFuelApi';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ManualFuelHistoryModal = ({ vehicle, onClose }) => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!vehicle?.id && !vehicle?.vehicle_id) return;
    const vId = vehicle.vehicle_id || vehicle.id;
    setLoading(true);
    getFuelEntries(vId, { limit: 100 })
      .then(res => {
        if (res?.success) {
          setEntries(res.data?.entries || []);
        } else {
          setError(res?.error || 'Failed to load entries');
        }
      })
      .catch(err => {
        setError(err.message || 'Error loading fuel entries');
      })
      .finally(() => setLoading(false));
  }, [vehicle]);

  const exportExcel = () => {
    if (entries.length === 0) return;
    const rows = entries.map(e => ({
      'Date & Time': new Date(e.entry_time).toLocaleString('en-IN'),
      'Entry Type': e.entry_type,
      'Driver Name': e.driver_name || 'N/A',
      'Fuel Quantity (L)': e.fuel_quantity,
      'Fuel Filled (L)': e.fuel_filled || 0,
      'Odometer (KM)': e.odometer,
      'Prev Estimated Fuel (L)': e.estimated_fuel_before ?? e.previous_estimated_fuel ?? 0,
      'Discrepancy (L)': e.fuel_difference || 0,
      'Remarks': e.remarks || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Fuel History');
    XLSX.writeFile(workbook, `Fuel_History_${vehicle.plate || 'Vehicle'}.xlsx`);
  };

  const exportPDF = () => {
    if (entries.length === 0) return;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Manual Fuel Entry History: ${vehicle.plate || 'Vehicle'}`, 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated on: ${new Date().toLocaleString('en-IN')} (Estimated Values)`, 14, 22);

    const tableRows = entries.map(e => [
      new Date(e.entry_time).toLocaleDateString('en-IN'),
      e.entry_type,
      e.driver_name || 'Driver',
      `${e.fuel_quantity} L`,
      e.fuel_filled > 0 ? `+${e.fuel_filled} L` : '-',
      `${e.odometer} km`,
      e.fuel_difference ? `${e.fuel_difference > 0 ? '+' : ''}${e.fuel_difference} L` : '-',
    ]);

    autoTable(doc, {
      startY: 28,
      head: [['Date', 'Type', 'Driver', 'Tank Level', 'Filled', 'Odometer', 'Diff']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [234, 88, 12] },
      styles: { fontSize: 8 },
    });

    doc.save(`Fuel_History_${vehicle.plate || 'Vehicle'}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center">
              <History size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Fuel Entry & Audit History</h3>
              <p className="text-xs text-slate-300">
                {vehicle?.vehicle_name || vehicle?.name || 'Vehicle'} • {vehicle?.plate || ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportExcel}
              disabled={entries.length === 0}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40"
              title="Export to Excel"
            >
              <FileSpreadsheet size={14} />
              <span>Excel</span>
            </button>
            <button
              onClick={exportPDF}
              disabled={entries.length === 0}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40"
              title="Export to PDF"
            >
              <FileText size={14} />
              <span>PDF</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800 ml-2"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {loading ? (
            <div className="py-12 flex items-center justify-center gap-3 text-slate-500">
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium">Loading history...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <History size={36} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium">No manual fuel entries recorded yet.</p>
              <p className="text-xs text-slate-400 mt-1">Driver entries from the mobile app will appear here.</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-3">Date & Time</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Driver</th>
                    <th className="py-3 px-3 text-right">Tank Level</th>
                    <th className="py-3 px-3 text-right">Refilled</th>
                    <th className="py-3 px-3 text-right">Odometer</th>
                    <th className="py-3 px-3 text-right">Discrepancy</th>
                    <th className="py-3 px-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {entries.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-900 font-semibold">
                        {new Date(e.entry_time).toLocaleString('en-IN', {
                          year: 'numeric', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit', hour12: true
                        })}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          e.entry_type === 'REFILL' ? 'bg-emerald-100 text-emerald-800' :
                          e.entry_type === 'INITIAL' ? 'bg-blue-100 text-blue-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {e.entry_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{e.driver_name || 'Driver'}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">{Number(e.fuel_quantity).toFixed(1)} L</td>
                      <td className="py-2.5 px-3 text-right text-emerald-600 font-semibold">
                        {e.fuel_filled > 0
                          ? `+${Number(e.fuel_filled).toFixed(1)} L`
                          : e.entry_type === 'INITIAL' && Number(e.fuel_quantity) > 0
                          ? `${Number(e.fuel_quantity).toFixed(1)} L`
                          : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">{Number(e.odometer).toLocaleString()} km</td>
                      <td className="py-2.5 px-3 text-right">
                        {e.fuel_difference ? (
                          <span className={`font-semibold ${Number(e.fuel_difference) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {Number(e.fuel_difference) > 0 ? '+' : ''}{Number(e.fuel_difference).toFixed(1)} L
                          </span>
                        ) : (
                          <span className="text-slate-400">0.0 L</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 italic truncate max-w-[150px]">
                        {e.remarks || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Showing {entries.length} recent entries. Values are labeled as <strong>ESTIMATED</strong>.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualFuelHistoryModal;
