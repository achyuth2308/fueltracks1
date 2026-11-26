import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Fuel,
  ArrowLeft,
  Calendar,
  Search,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Download,
  Printer,
  Droplets,
  Gauge,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  TrendingDown,
  Clock,
  User,
  SlidersHorizontal
} from 'lucide-react';
import { getNonSensorFuelReport } from '../../api/manualFuelApi';
import { exportToExcel, exportToPDF, exportToCSV } from '../../utils/exportUtils';
import { formatLocalTime, formatLocalDate } from '../../utils/dateUtils';
import CustomDatePicker from '../../components/ui/CustomDatePicker';

const getStatusBadge = (status) => {
  switch (status) {
    case 'Healthy':
      return {
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500',
        label: 'Healthy'
      };
    case 'Normal':
      return {
        bg: 'bg-blue-50 text-blue-700 border-blue-200',
        dot: 'bg-blue-500',
        label: 'Normal'
      };
    case 'Low Fuel':
      return {
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-500',
        label: 'Low Fuel'
      };
    case 'Critical Fuel':
      return {
        bg: 'bg-rose-50 text-rose-700 border-rose-200',
        dot: 'bg-rose-500',
        label: 'Critical Fuel'
      };
    default:
      return {
        bg: 'bg-slate-50 text-slate-600 border-slate-200',
        dot: 'bg-slate-400',
        label: 'No Data'
      };
  }
};

const getTodayDateStr = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getPastDateStr = (daysAgo) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const NonSensorFuelReportPage = () => {
  const navigate = useNavigate();
  const todayStr = getTodayDateStr();

  // Filters
  const [selectedVehicleId, setSelectedVehicleId] = useState('all');
  const [activePreset, setActivePreset] = useState('7d');
  const [startDate, setStartDate] = useState(getPastDateStr(7));
  const [endDate, setEndDate] = useState(todayStr);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'entries'

  // Data
  const [vehicles, setVehicles] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch report data
  const fetchReport = useCallback(async (sDate, eDate, vId) => {
    setLoading(true);
    try {
      const curStart = sDate || startDate;
      const curEnd = eDate || endDate;
      const curVId = vId || selectedVehicleId;

      const params = {};
      if (curVId && curVId !== 'all') params.vehicleId = curVId;
      if (curStart) params.startDate = `${curStart}T00:00:00.000Z`;
      if (curEnd) params.endDate = `${curEnd}T23:59:59.999Z`;

      const res = await getNonSensorFuelReport(params);
      if (res?.success && res.data) {
        setVehicles(res.data.vehicles || []);
        setEntries(res.data.entries || []);
      }
    } catch (err) {
      console.error('Failed to load non-sensor fuel report:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedVehicleId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Preset Handler
  const handlePresetChange = (preset) => {
    setActivePreset(preset);
    let s = todayStr;
    const e = todayStr;

    if (preset === 'today') {
      s = todayStr;
    } else if (preset === 'yesterday') {
      s = getPastDateStr(1);
    } else if (preset === '7d') {
      s = getPastDateStr(7);
    } else if (preset === '30d') {
      s = getPastDateStr(30);
    }

    setStartDate(s);
    setEndDate(e);
    fetchReport(s, e, selectedVehicleId);
  };

  // Filtered vehicles
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const matchSearch =
        (v.plate || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.vehicle_name || '').toLowerCase().includes(search.toLowerCase());
      return matchSearch;
    });
  }, [vehicles, search]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const matchSearch =
        (e.plate || '').toLowerCase().includes(search.toLowerCase()) ||
        (e.vehicle_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (e.driver_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (e.remarks || '').toLowerCase().includes(search.toLowerCase());
      return matchSearch;
    });
  }, [entries, search]);

  // Summary KPIs
  const stats = useMemo(() => {
    let totalFuel = 0;
    let totalConsumed = 0;
    let totalRange = 0;
    let totalDist = 0;
    let mileageSum = 0;
    let count = 0;

    filteredVehicles.forEach(v => {
      if (v.current_fuel != null) totalFuel += Number(v.current_fuel);
      if (v.total_fuel_consumed != null) totalConsumed += Number(v.total_fuel_consumed);
      if (v.estimated_range_km != null) totalRange += Number(v.estimated_range_km);
      if (v.total_distance_travelled != null) totalDist += Number(v.total_distance_travelled);
      if (v.current_mileage != null && Number(v.current_mileage) > 0) {
        mileageSum += Number(v.current_mileage);
        count++;
      }
    });

    return {
      totalFuel: totalFuel.toFixed(1),
      totalConsumed: totalConsumed.toFixed(1),
      totalRange: Math.round(totalRange),
      totalDist: Math.round(totalDist),
      avgMileage: count > 0 ? (mileageSum / count).toFixed(1) : '8.0'
    };
  }, [filteredVehicles]);

  // Export to Excel
  const handleExportExcel = () => {
    if (activeTab === 'summary') {
      const exportData = filteredVehicles.map(v => ({
        'Vehicle Plate': v.plate,
        'Vehicle Name': v.vehicle_name || v.plate,
        'Non-Sensor Fuel (L)': Math.round(Number(v.current_fuel || 0)),
        'Fuel %': v.tank_capacity ? `${Math.min(100, Math.round((Number(v.current_fuel) / Number(v.tank_capacity)) * 100))}%` : '-',
        'Range (KM)': Math.round(Number(v.estimated_range_km || 0)),
        'Entered Fuel (L)': Number(v.last_entered_fuel || v.initial_fuel || 0).toFixed(1),
        'Fuel Used (L)': Number(v.total_fuel_consumed || 0).toFixed(1),
        'Distance Tracked (KM)': Number(v.total_distance_travelled || 0).toFixed(1),
        'Average Mileage (km/l)': Number(v.current_mileage || 8.0).toFixed(1),
        'Tank Capacity (L)': v.tank_capacity || '-',
        'Fuel Status': v.fuel_status || 'Normal',
        'Last Refill (L)': Number(v.last_fuel_filled || 0) > 0 ? `+${Number(v.last_fuel_filled).toFixed(1)}` : '-',
        'Last Entry Date': v.last_entry_time ? formatLocalTime(v.last_entry_time) : '-'
      }));
      exportToExcel(exportData, `Non_Sensor_Fuel_Summary`);
    } else {
      const exportData = filteredEntries.map(e => ({
        'Date & Time': formatLocalTime(e.entry_time),
        'Vehicle Plate': e.plate,
        'Vehicle Name': e.vehicle_name || e.plate,
        'Entry Type': e.entry_type,
        'Entered Fuel (L)': Number(e.entered_fuel || 0).toFixed(1),
        'Fuel Added (L)': Number(e.fuel_filled || 0) > 0 ? `+${Number(e.fuel_filled).toFixed(1)}` : '-',
        'Odometer (KM)': e.odometer ? Number(e.odometer).toLocaleString() : '-',
        'Logged By': e.driver_name || 'Admin',
        'Remarks': e.remarks || '-'
      }));
      exportToExcel(exportData, `Non_Sensor_Fuel_Entries`);
    }
  };

  // Export to PDF
  const handleExportPDF = () => {
    if (activeTab === 'summary') {
      const columns = ['Vehicle Plate', 'Vehicle Name', 'Non-Sensor Fuel (L)', 'Range (KM)', 'Entered Fuel (L)', 'Fuel Used (L)', 'Distance (KM)', 'Mileage (km/l)', 'Status'];
      const pdfData = filteredVehicles.map(v => ({
        'Vehicle Plate': v.plate,
        'Vehicle Name': v.vehicle_name || v.plate,
        'Non-Sensor Fuel (L)': `${Math.round(Number(v.current_fuel || 0))} L`,
        'Range (KM)': `${Math.round(Number(v.estimated_range_km || 0))} km`,
        'Entered Fuel (L)': `${Number(v.last_entered_fuel || v.initial_fuel || 0).toFixed(1)} L`,
        'Fuel Used (L)': `${Number(v.total_fuel_consumed || 0).toFixed(1)} L`,
        'Distance (KM)': `${Number(v.total_distance_travelled || 0).toFixed(1)} km`,
        'Mileage (km/l)': `${Number(v.current_mileage || 8.0).toFixed(1)} km/l`,
        'Status': v.fuel_status || 'Normal'
      }));
      exportToPDF(columns, pdfData, 'Non-Sensor Fuel Report Summary', 'Non_Sensor_Fuel_Summary');
    } else {
      const columns = ['Date & Time', 'Vehicle Plate', 'Entry Type', 'Entered Fuel (L)', 'Fuel Added (L)', 'Odometer (KM)', 'Logged By'];
      const pdfData = filteredEntries.map(e => ({
        'Date & Time': formatLocalTime(e.entry_time),
        'Vehicle Plate': e.plate,
        'Entry Type': e.entry_type,
        'Entered Fuel (L)': `${Number(e.entered_fuel || 0).toFixed(1)} L`,
        'Fuel Added (L)': Number(e.fuel_filled || 0) > 0 ? `+${Number(e.fuel_filled).toFixed(1)} L` : '-',
        'Odometer (KM)': e.odometer ? `${Number(e.odometer).toLocaleString()} km` : '-',
        'Logged By': e.driver_name || 'Admin'
      }));
      exportToPDF(columns, pdfData, 'Non-Sensor Fuel Entry History', 'Non_Sensor_Fuel_Entries');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto min-h-screen">
      {/* ── Top Breadcrumbs & Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <button
              onClick={() => navigate('/dashboard')}
              className="hover:text-slate-800 transition-colors cursor-pointer flex items-center gap-1"
            >
              <ArrowLeft size={13} />
              <span>Dashboard</span>
            </button>
            <span>/</span>
            <button
              onClick={() => navigate('/fuel-overview')}
              className="hover:text-slate-800 transition-colors cursor-pointer"
            >
              Non-Sensor Fuel
            </button>
            <span>/</span>
            <span className="text-orange-600 font-bold">Fuel Report</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center">
              <Fuel size={20} />
            </div>
            <span>Non-Sensor Fuel Report</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Fleet report for non-sensor vehicles: tracking Fuel level, Range, Entered Fuel, Fuel Used (Consumption), and Mileage.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigate('/fuel-entry')}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs shadow-sm flex items-center gap-2 transition-all cursor-pointer"
          >
            <Droplets size={14} />
            <span>+ Log Fuel Entry</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
            title="Export to Excel"
          >
            <FileSpreadsheet size={14} className="text-emerald-600" />
            <span>Excel</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
            title="Export to PDF"
          >
            <FileText size={14} className="text-rose-600" />
            <span>PDF</span>
          </button>
          <button
            onClick={() => window.print()}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 shadow-sm transition-all cursor-pointer"
            title="Print Report"
          >
            <Printer size={15} />
          </button>
        </div>
      </div>

      {/* ── Filters & Date Bar ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Vehicle Select */}
          <div className="flex items-center gap-2 min-w-[220px]">
            <span className="text-xs font-bold text-slate-600">Vehicle:</span>
            <select
              value={selectedVehicleId}
              onChange={(e) => {
                setSelectedVehicleId(e.target.value);
                fetchReport(startDate, endDate, e.target.value);
              }}
              className="flex-1 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
            >
              <option value="all">All Non-Sensor Vehicles</option>
              {vehicles.map(v => {
                const displayName = v.plate 
                  ? (v.vehicle_name && v.vehicle_name !== v.plate ? `${v.plate} (${v.vehicle_name})` : v.plate)
                  : (v.vehicle_name || 'Vehicle');
                return (
                  <option key={v.vehicle_id} value={v.vehicle_id}>
                    {displayName}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '7d', label: 'Last 7 Days' },
              { id: '30d', label: 'Last 30 Days' }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => handlePresetChange(p.id)}
                className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all whitespace-nowrap cursor-pointer ${
                  activePreset === p.id
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers & Generate Button */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-32">
              <CustomDatePicker
                value={startDate}
                onChange={(d) => {
                  setStartDate(d);
                  setActivePreset('custom');
                }}
                placeholder="Start Date"
              />
            </div>
            <span className="text-xs text-slate-400 font-bold">to</span>
            <div className="w-32">
              <CustomDatePicker
                value={endDate}
                onChange={(d) => {
                  setEndDate(d);
                  setActivePreset('custom');
                }}
                placeholder="End Date"
              />
            </div>
            <button
              onClick={() => fetchReport(startDate, endDate, selectedVehicleId)}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Apply</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Non-Sensor Fuel</span>
            <Fuel size={14} className="text-orange-600" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-900">{stats.totalFuel}</span>
            <span className="text-xs font-bold text-slate-500">Litres</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Total remaining fuel</p>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Fuel Used</span>
            <TrendingDown size={14} className="text-rose-600" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-900">{stats.totalConsumed}</span>
            <span className="text-xs font-bold text-slate-500">Litres</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Total fuel consumed</p>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Fleet Range</span>
            <Gauge size={14} className="text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-900">{stats.totalRange.toLocaleString()}</span>
            <span className="text-xs font-bold text-slate-500">KM</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Distance vehicle can run</p>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">GPS Distance</span>
            <Navigation size={14} className="text-blue-600" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-900">{stats.totalDist.toLocaleString()}</span>
            <span className="text-xs font-bold text-slate-500">KM</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Total distance tracked</p>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Average Mileage</span>
            <SlidersHorizontal size={14} className="text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-900">{stats.avgMileage}</span>
            <span className="text-xs font-bold text-slate-500">km/l</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Fleet learned mileage</p>
        </div>
      </div>

      {/* ── View Switcher & Search Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        {/* Tab Toggle */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'summary'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Vehicle Summary ({filteredVehicles.length})
          </button>
          <button
            onClick={() => setActiveTab('entries')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'entries'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Fuel Entry History ({filteredEntries.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder={activeTab === 'summary' ? "Search vehicle plate or name..." : "Search entries, driver, notes..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
          />
        </div>
      </div>

      {/* ── Tab 1: Vehicle Summary Table ── */}
      {activeTab === 'summary' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-3">Vehicle</th>
                  <th className="py-3 px-3 text-right">Non-Sensor Fuel</th>
                  <th className="py-3 px-3 text-right">Range</th>
                  <th className="py-3 px-3 text-right">Entered Fuel</th>
                  <th className="py-3 px-3 text-right">Fuel Used</th>
                  <th className="py-3 px-3 text-right">Distance Tracked</th>
                  <th className="py-3 px-3 text-right">Average Mileage</th>
                  <th className="py-3 px-3 text-right">Tank Capacity</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Last Refill / Entry</th>
                  <th className="py-3 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan="11" className="text-center py-10 text-slate-400">
                      <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-orange-500" />
                      Loading non-sensor fuel data...
                    </td>
                  </tr>
                ) : filteredVehicles.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="text-center py-12 text-slate-400">
                      <Fuel size={32} className="mx-auto mb-2 text-slate-300" />
                      No non-sensor fuel vehicles configured yet.
                    </td>
                  </tr>
                ) : (
                  filteredVehicles.map((v) => {
                    const st = getStatusBadge(v.fuel_status);
                    const pct = v.tank_capacity ? Math.min(100, Math.round((Number(v.current_fuel) / Number(v.tank_capacity)) * 100)) : null;

                    return (
                      <tr key={v.vehicle_id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Vehicle */}
                        <td className="py-3 px-3">
                          <div className="font-extrabold text-slate-900 text-xs">
                            {v.plate || v.vehicle_name || 'Vehicle'}
                          </div>
                          {v.plate && v.vehicle_name && v.vehicle_name !== v.plate && (
                            <div className="text-[10px] text-slate-400 font-medium">{v.vehicle_name}</div>
                          )}
                        </td>

                        {/* Non-Sensor Fuel */}
                        <td className="py-3 px-3 text-right">
                          <div className="font-black text-slate-900 text-xs">
                            {Math.round(Number(v.current_fuel || 0))} L
                          </div>
                          {pct !== null && (
                            <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.2 rounded">
                              {pct}%
                            </span>
                          )}
                        </td>

                        {/* Range */}
                        <td className="py-3 px-3 text-right">
                          <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md text-xs">
                            {Math.round(Number(v.estimated_range_km || 0))} km
                          </span>
                        </td>

                        {/* Entered Fuel (From entered how much fuel) */}
                        <td className="py-3 px-3 text-right font-extrabold text-slate-800">
                          {Number(v.last_entered_fuel || v.initial_fuel || 0).toFixed(1)} L
                        </td>

                        {/* Fuel Used */}
                        <td className="py-3 px-3 text-right">
                          <span className="font-extrabold text-rose-600">
                            {Number(v.total_fuel_consumed || 0).toFixed(1)} L
                          </span>
                        </td>

                        {/* Distance Tracked */}
                        <td className="py-3 px-3 text-right font-bold text-slate-700">
                          {Number(v.total_distance_travelled || 0).toFixed(1)} km
                        </td>

                        {/* Average Mileage */}
                        <td className="py-3 px-3 text-right font-bold text-indigo-700">
                          {Number(v.current_mileage || 8.0).toFixed(1)} km/l
                        </td>

                        {/* Tank Capacity */}
                        <td className="py-3 px-3 text-right text-slate-500 font-semibold">
                          {v.tank_capacity ? `${v.tank_capacity} L` : '-'}
                        </td>

                        {/* Fuel Status */}
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.bg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                            {st.label}
                          </span>
                        </td>

                        {/* Last Refill / Entry */}
                        <td className="py-3 px-3">
                          {Number(v.last_fuel_filled || 0) > 0 ? (
                            <div className="font-bold text-emerald-600 text-xs">
                              +{Number(v.last_fuel_filled).toFixed(1)} L Refill
                            </div>
                          ) : (
                            <div className="text-slate-500 text-[11px] font-semibold">
                              {v.last_entry_type || 'Entry'}
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400">
                            {v.last_entry_time ? formatLocalTime(v.last_entry_time) : 'No entries'}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => navigate(`/fuel-graph?vehicle=${v.vehicle_id}`)}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors cursor-pointer"
                            title="View fuel trend graph"
                          >
                            Graph
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

      {/* ── Tab 2: Detailed Entries & Consumption History ── */}
      {activeTab === 'entries' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-3">Date & Time</th>
                  <th className="py-3 px-3">Vehicle</th>
                  <th className="py-3 px-3">Entry Type</th>
                  <th className="py-3 px-3 text-right">Entered Fuel</th>
                  <th className="py-3 px-3 text-right">Fuel Added (Refill)</th>
                  <th className="py-3 px-3 text-right">Odometer Reading</th>
                  <th className="py-3 px-3">Logged By</th>
                  <th className="py-3 px-3">Remarks / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="text-center py-10 text-slate-400">
                      <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-orange-500" />
                      Loading entry logs...
                    </td>
                  </tr>
                ) : filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-12 text-slate-400">
                      <Calendar size={32} className="mx-auto mb-2 text-slate-300" />
                      No manual fuel entries recorded in this time range.
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">
                        {formatLocalTime(e.entry_time)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-slate-900">{e.plate || e.vehicle_name || 'Vehicle'}</div>
                        {e.plate && e.vehicle_name && e.vehicle_name !== e.plate && (
                          <div className="text-[10px] text-slate-400">{e.vehicle_name}</div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          e.entry_type === 'REFILL'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : e.entry_type === 'INITIAL'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}>
                          {e.entry_type}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-black text-slate-900">
                        {Number(e.entered_fuel || 0).toFixed(1)} L
                      </td>
                      <td className="py-3 px-3 text-right">
                        {Number(e.fuel_filled || 0) > 0 ? (
                          <span className="font-extrabold text-emerald-600">
                            +{Number(e.fuel_filled).toFixed(1)} L
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-700">
                        {e.odometer ? `${Number(e.odometer).toLocaleString()} km` : '-'}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-600">
                        {e.driver_name || 'Driver / Admin'}
                      </td>
                      <td className="py-3 px-3 text-slate-500 max-w-xs truncate">
                        {e.remarks || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default NonSensorFuelReportPage;