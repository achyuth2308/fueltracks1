import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  Fuel,
  TrendingUp,
  Droplets,
  Gauge,
  Calendar,
  Clock,
  RefreshCw,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  BarChart2,
  ShieldAlert,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { getFuelChartData } from '../../api/manualFuelApi';

/**
 * Custom Tooltip for Manual Fuel Chart (Fuel Analytics Multi-Card Pattern)
 */
const CustomTooltip = ({ active, payload, showRefills, showThefts, tankCapacity }) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const isRefill = Boolean(data.isRefill && showRefills);
  const isTheft = Boolean(data.isTheft && showThefts);

  return (
    <div className="flex flex-col sm:flex-row items-stretch gap-2.5 pointer-events-none select-none drop-shadow-2xl">
      {/* CARD 1: DEDICATED REFILL CARD (Emerald Green) */}
      {isRefill && (
        <div className="bg-slate-900/95 backdrop-blur-md border border-emerald-500/60 p-3 rounded-xl shadow-2xl text-xs space-y-2 text-white min-w-[200px] max-w-[240px] flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-400 border-b border-emerald-500/30 pb-1.5">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              REFILL DETECTED
            </span>
            <span className="font-mono text-emerald-300 font-bold bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/40">
              +{Number(data.refillLiters || data.fuelFilled).toFixed(1)} L
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
            <div>
              <span className="text-slate-400 text-[10px] block">Time:</span>
              <span className="font-mono text-slate-200 font-semibold">{data.date}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">After Refill:</span>
              <span className="font-mono text-emerald-300 font-bold">{Number(data.fuelLevel).toFixed(1)} L</span>
            </div>
            {data.refillEvent?.startFuel != null && (
              <div>
                <span className="text-slate-400 text-[10px] block">Before Refill:</span>
                <span className="font-mono text-slate-300">{Number(data.refillEvent.startFuel).toFixed(1)} L</span>
              </div>
            )}
            <div>
              <span className="text-slate-400 text-[10px] block">Fuel Added:</span>
              <span className="font-mono text-emerald-400 font-bold">+{Number(data.refillLiters || data.fuelFilled).toFixed(1)} L</span>
            </div>
            {data.driverName && (
              <div className="col-span-2">
                <span className="text-slate-400 text-[10px] block">Logged by:</span>
                <span className="text-slate-200 truncate">{data.driverName}</span>
              </div>
            )}
          </div>
          {data.remarks && (
            <p className="text-[10px] text-slate-400 italic border-t border-slate-800/80 pt-1">
              "{data.remarks}"
            </p>
          )}
        </div>
      )}

      {/* CARD 2: DEDICATED THEFT / ABNORMAL DROP CARD (Crimson Red) */}
      {isTheft && (
        <div className="bg-slate-900/95 backdrop-blur-md border border-rose-500/60 p-3 rounded-xl shadow-2xl text-xs space-y-2 text-white min-w-[200px] max-w-[240px] flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-rose-400 border-b border-rose-500/30 pb-1.5">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
              THEFT / DRAIN
            </span>
            <span className="font-mono text-rose-300 font-bold bg-rose-950/80 px-2 py-0.5 rounded-md border border-rose-500/40">
              -{Number(data.theftLiters || 0).toFixed(1)} L
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
            <div>
              <span className="text-slate-400 text-[10px] block">Time:</span>
              <span className="font-mono text-slate-200 font-semibold">{data.date}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">Resulting:</span>
              <span className="font-mono text-rose-300 font-bold">{Number(data.fuelLevel).toFixed(1)} L</span>
            </div>
            {data.theftEvent?.startFuel != null && (
              <div>
                <span className="text-slate-400 text-[10px] block">Expected:</span>
                <span className="font-mono text-slate-300">{Number(data.theftEvent.startFuel).toFixed(1)} L</span>
              </div>
            )}
            {data.driverName && (
              <div>
                <span className="text-slate-400 text-[10px] block">Source:</span>
                <span className="text-slate-200 truncate">{data.driverName}</span>
              </div>
            )}
          </div>
          <p className="text-[10px] text-rose-300/90 italic border-t border-slate-800/80 pt-1">
            {data.remarks || 'Unaccounted fuel drop recorded during level inspection'}
          </p>
        </div>
      )}

      {/* CARD 3: MAIN TELEMETRY SNAPSHOT CARD */}
      <div className="bg-slate-900/95 text-white p-3.5 rounded-xl shadow-xl border border-slate-700/80 text-xs backdrop-blur-md space-y-2 min-w-[200px]">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="font-bold text-slate-300 font-mono text-[11px]">{data.date}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
            isRefill
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : isTheft
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              : data.entryType === 'INITIAL'
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              : data.entryType === 'CURRENT_ESTIMATE'
              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
              : 'bg-slate-700 text-slate-300'
          }`}>
            {isRefill ? 'Refill Event' : isTheft ? 'Theft Event' : data.entryType === 'CURRENT_ESTIMATE' ? 'Live Telemetry' : data.entryType === 'GPS_DEPLETION' ? 'GPS Move' : data.entryType}
          </span>
        </div>

        <div className="space-y-1.5 pt-0.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Estimated Fuel:</span>
            <span className="font-extrabold text-orange-400 text-sm font-mono">
              {Number(data.fuelLevel).toFixed(1)} L
            </span>
          </div>

          {tankCapacity > 0 && (
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Tank Capacity:</span>
              <span className="font-semibold text-slate-300 font-mono">
                {Math.min(100, Math.round((Number(data.fuelLevel) / tankCapacity) * 100))}% ({tankCapacity} L)
              </span>
            </div>
          )}

          {data.odometer > 0 && (
            <div className="flex items-center justify-between text-slate-300 text-[11px]">
              <span className="text-slate-400">Odometer:</span>
              <span className="font-mono font-semibold">{Number(data.odometer).toLocaleString()} KM</span>
            </div>
          )}

          {data.driverName && !isRefill && !isTheft && (
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Logged by:</span>
              <span className="text-slate-200 font-medium">{data.driverName}</span>
            </div>
          )}

          {data.remarks && !isRefill && !isTheft && (
            <div className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-800/80">
              "{data.remarks}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Date-Time formatting helpers
const toDateTimeLocalString = (date) => {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatDisplayDateTime = (dtStr) => {
  if (!dtStr) return '--/--/---- --:--';
  const d = new Date(dtStr);
  if (isNaN(d.getTime())) return dtStr;
  const pad = (n) => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = pad(d.getMinutes());
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${day}/${month}/${year} ${pad(hours)}:${minutes} ${ampm}`;
};

const getInitialDates = () => {
  const now = new Date();
  const end = toDateTimeLocalString(now);
  const startObj = new Date();
  startObj.setDate(startObj.getDate() - 7);
  startObj.setHours(0, 0, 0, 0);
  const start = toDateTimeLocalString(startObj);
  return { start, end };
};

/**
 * ManualFuelChartCard
 * Single unified Fuel Analytics graph for Non-Sensor Fuel Telemetry.
 * Shows Fuel Depletion Curve with Refill (Filling) and Theft (Drain) events directly on the graph.
 */
const ManualFuelChartCard = ({
  vehicleId,
  vehicleName = 'Vehicle',
  plate = '',
  vehicles = [],
  onSelectVehicle,
}) => {
  const [customStart, setCustomStart] = useState(() => getInitialDates().start);
  const [customEnd, setCustomEnd] = useState(() => getInitialDates().end);
  const [selectedPreset, setSelectedPreset] = useState('last7d');
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Unified Graph Layer Toggles (like Fuel Analytics)
  const [showFilteredFuel, setShowFilteredFuel] = useState(true);
  const [showRefills, setShowRefills] = useState(true);
  const [showThefts, setShowThefts] = useState(true);

  const startInputRef = useRef(null);
  const endInputRef = useRef(null);

  const fetchChart = (startOverride, endOverride) => {
    if (!vehicleId) return;
    const s = startOverride || customStart;
    const e = endOverride || customEnd;

    const sDate = new Date(s);
    const eDate = new Date(e);
    if (sDate > eDate) {
      setError('"From" date cannot be after "To" date.');
      return;
    }

    setLoading(true);
    setError(null);
    getFuelChartData(vehicleId, { startDate: s, endDate: e })
      .then(res => {
        if (res?.success) {
          setChartData(res.data);
        } else {
          setChartData(null);
        }
      })
      .catch(err => {
        console.error('Failed to load fuel chart data:', err);
        setError('Failed to load fuel trend graph.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchChart();
  }, [vehicleId]);

  const handlePresetChange = (preset) => {
    setSelectedPreset(preset);
    const now = new Date();
    let s = new Date();
    let e = new Date();

    if (preset === 'today') {
      s.setHours(0, 0, 0, 0);
    } else if (preset === 'yesterday') {
      s.setDate(s.getDate() - 1);
      s.setHours(0, 0, 0, 0);
      e.setDate(e.getDate() - 1);
      e.setHours(23, 59, 59, 999);
    } else if (preset === 'last24h') {
      s.setTime(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (preset === 'last7d') {
      s.setDate(s.getDate() - 7);
      s.setHours(0, 0, 0, 0);
    } else if (preset === 'last30d') {
      s.setDate(s.getDate() - 30);
      s.setHours(0, 0, 0, 0);
    } else if (preset === 'thisMonth') {
      s.setDate(1);
      s.setHours(0, 0, 0, 0);
    } else {
      return;
    }

    const sStr = toDateTimeLocalString(s);
    const eStr = toDateTimeLocalString(e);
    setCustomStart(sStr);
    setCustomEnd(eStr);
    fetchChart(sStr, eStr);
  };

  const timeline = chartData?.timeline || [];
  const tankCapacity = chartData?.tankCapacity || 100;
  const currentFuel = chartData?.currentFuel || 0;
  const fillPercentage = tankCapacity > 0 ? Math.min(100, Math.round((currentFuel / tankCapacity) * 100)) : 0;
  const refillCount = chartData?.refillCount || 0;
  const theftCount = chartData?.theftCount || 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
      {/* Top Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-600">
              <BarChart2 size={18} />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              Fuel & Telemetry Correlation
              <span className="text-xs font-mono font-medium text-slate-400 lowercase">
                ({timeline.length} points)
              </span>
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
              Estimated Non-Sensor
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Single unified fuel curve tracking tank depletion, verified fillings & detected theft/drain events.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Optional Vehicle Switcher */}
          {vehicles && vehicles.length > 1 && onSelectVehicle && (
            <select
              value={vehicleId}
              onChange={(e) => onSelectVehicle(e.target.value)}
              className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 cursor-pointer"
            >
              {vehicles.map(v => (
                <option key={v.id || v.vehicle_id} value={v.id || v.vehicle_id}>
                  {v.plate || v.name || v.vehicle_name}
                </option>
              ))}
            </select>
          )}

          {/* Inline Mini-Pill Telematics Toggles (Fuel Analytics Style) */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            {/* Filtered Fuel Layer */}
            <button
              type="button"
              onClick={() => setShowFilteredFuel(!showFilteredFuel)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                showFilteredFuel
                  ? 'bg-white text-orange-600 shadow-xs ring-1 ring-orange-500/20 font-bold'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Toggle Fuel Depletion Curve"
            >
              <span className={`w-2 h-2 rounded-full ${showFilteredFuel ? 'bg-orange-500' : 'bg-slate-300'}`} />
              <span>Fuel Level</span>
            </button>

            {/* Refills (Fillings) Layer */}
            <button
              type="button"
              onClick={() => setShowRefills(!showRefills)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                showRefills
                  ? 'bg-white text-emerald-600 shadow-xs ring-1 ring-emerald-500/20 font-bold'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Highlight Refill / Fuel Filling Events"
            >
              <span className={`w-2 h-2 rounded-full ${showRefills ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <span>Fillings ({refillCount})</span>
            </button>

            {/* Thefts Layer */}
            <button
              type="button"
              onClick={() => setShowThefts(!showThefts)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                showThefts
                  ? 'bg-white text-rose-600 shadow-xs ring-1 ring-rose-500/20 font-bold'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Highlight Fuel Theft & Unaccounted Drop Events"
            >
              <span className={`w-2 h-2 rounded-full ${showThefts ? 'bg-rose-500' : 'bg-slate-300'}`} />
              <span>Thefts ({theftCount})</span>
            </button>
          </div>

          {/* From Date-Time Selector */}
          <div
            onClick={() => {
              try { startInputRef.current?.showPicker?.(); } catch (e) { startInputRef.current?.focus?.(); }
            }}
            className="relative h-[32px] flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 hover:border-orange-500 rounded-lg px-2.5 shadow-xs transition-colors cursor-pointer shrink-0"
            title="Click to select start date and time"
          >
            <div className="flex items-center gap-1 text-slate-500 shrink-0 pointer-events-none">
              <Calendar className="w-3.5 h-3.5 text-orange-600 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">From</span>
            </div>
            <div className="font-mono text-xs font-semibold text-slate-800 select-none pointer-events-none">
              {formatDisplayDateTime(customStart)}
            </div>
            <input
              ref={startInputRef}
              type="datetime-local"
              value={customStart}
              max={customEnd}
              onClick={(e) => {
                e.stopPropagation();
                try { e.target.showPicker?.(); } catch (err) {}
              }}
              onChange={(e) => {
                setCustomStart(e.target.value);
                setSelectedPreset('custom');
                setError(null);
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>

          {/* To Date-Time Selector */}
          <div
            onClick={() => {
              try { endInputRef.current?.showPicker?.(); } catch (e) { endInputRef.current?.focus?.(); }
            }}
            className="relative h-[32px] flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 hover:border-orange-500 rounded-lg px-2.5 shadow-xs transition-colors cursor-pointer shrink-0"
            title="Click to select end date and time"
          >
            <div className="flex items-center gap-1 text-slate-500 shrink-0 pointer-events-none">
              <Clock className="w-3.5 h-3.5 text-orange-600 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">To</span>
            </div>
            <div className="font-mono text-xs font-semibold text-slate-800 select-none pointer-events-none">
              {formatDisplayDateTime(customEnd)}
            </div>
            <input
              ref={endInputRef}
              type="datetime-local"
              value={customEnd}
              min={customStart}
              onClick={(e) => {
                e.stopPropagation();
                try { e.target.showPicker?.(); } catch (err) {}
              }}
              onChange={(e) => {
                setCustomEnd(e.target.value);
                setSelectedPreset('custom');
                setError(null);
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>

          {/* Preset Helper Dropdown */}
          <select
            value={selectedPreset}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="h-[32px] text-xs font-semibold px-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 hover:border-slate-400 focus:outline-none focus:border-orange-500 cursor-pointer shrink-0"
            title="Quick date ranges"
          >
            <option value="custom">Custom Range</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last24h">Last 24 Hours</option>
            <option value="last7d">Last 7 Days</option>
            <option value="last30d">Last 30 Days</option>
            <option value="thisMonth">This Month</option>
          </select>

          {/* Apply Range Button */}
          <button
            type="button"
            onClick={() => fetchChart()}
            disabled={loading}
            className="h-[32px] flex items-center gap-1.5 px-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs shadow-orange-500/20 disabled:opacity-50 shrink-0 cursor-pointer"
            title="Apply Date-Time Range"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Loading...' : 'Apply Range'}</span>
          </button>
        </div>
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-semibold">
          <AlertTriangle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Stats Row (Unified: Fuel, Fillings, Thefts, Consumed, Mileage) */}
      {chartData && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {/* Card 1: Current Est. Fuel */}
          <div className="p-3 rounded-xl bg-orange-50/60 border border-orange-100">
            <span className="text-[10px] font-extrabold uppercase text-orange-800 tracking-wider">
              Current Est. Fuel
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-orange-950 font-mono">
                {Number(chartData.currentFuel).toFixed(1)}
              </span>
              <span className="text-xs font-bold text-orange-700">/ {chartData.tankCapacity} L</span>
            </div>
            <span className="text-[10.5px] font-bold text-orange-800">
              {fillPercentage}% Capacity
            </span>
          </div>

          {/* Card 2: Total Fillings (Refills) */}
          <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
            <span className="text-[10px] font-extrabold uppercase text-emerald-800 tracking-wider">
              Total Fillings
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-emerald-950 font-mono">
                +{Number(chartData.totalFuelRefilled || 0).toFixed(1)}
              </span>
              <span className="text-xs font-bold text-emerald-700">Litres</span>
            </div>
            <span className="text-[10.5px] font-semibold text-emerald-700">
              {refillCount} verified {refillCount === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          {/* Card 3: Total Thefts / Drains */}
          <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-100">
            <span className="text-[10px] font-extrabold uppercase text-rose-800 tracking-wider flex items-center gap-1">
              <ShieldAlert size={12} className="text-rose-600" />
              Theft / Drains
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-rose-950 font-mono">
                {Number(chartData.totalFuelTheft || 0) > 0 ? `-${Number(chartData.totalFuelTheft).toFixed(1)}` : '0.0'}
              </span>
              <span className="text-xs font-bold text-rose-700">Litres</span>
            </div>
            <span className="text-[10.5px] font-semibold text-rose-700">
              {theftCount} {theftCount === 1 ? 'theft event' : 'theft events'}
            </span>
          </div>

          {/* Card 4: Estimated Fuel Consumed */}
          <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100">
            <span className="text-[10px] font-extrabold uppercase text-amber-800 tracking-wider">
              Est. Fuel Consumed
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-amber-950 font-mono">
                {Number(chartData.totalFuelConsumed || 0).toFixed(1)}
              </span>
              <span className="text-xs font-bold text-amber-700">Litres</span>
            </div>
            <span className="text-[10.5px] font-semibold text-amber-700">GPS Distance / Mileage</span>
          </div>

          {/* Card 5: GPS Distance & Average Mileage */}
          <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100">
            <span className="text-[10px] font-extrabold uppercase text-blue-800 tracking-wider">
              GPS Dist. & Mileage
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-blue-950 font-mono">
                {Math.round(chartData.totalDistance || 0)}
              </span>
              <span className="text-xs font-bold text-blue-700">KM ({Number(chartData.currentMileage || 16.0).toFixed(1)} km/l)</span>
            </div>
            <span className="text-[10.5px] font-semibold text-blue-700">Computed telemetry</span>
          </div>
        </div>
      )}

      {/* SINGLE UNIFIED CHART CANVAS */}
      <div className="w-full h-72 sm:h-84 bg-slate-50/50 rounded-xl border border-slate-100 p-2 sm:p-4">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold">Correlating fuel telemetry & events...</span>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center gap-1.5 text-rose-500 text-xs font-semibold">
            <AlertTriangle size={24} />
            <span>{error}</span>
          </div>
        ) : timeline.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400 text-center px-4">
            <Fuel size={36} className="text-slate-300" />
            <p className="text-xs font-bold text-slate-600">No fuel entries recorded yet for this vehicle.</p>
            <p className="text-[11px] text-slate-400 max-w-sm">
              Log an Initial Setup or Fuel Refill transaction to start visualizing fuel trends and consumption over time.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={timeline} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="fuelLevelGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EA580C" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#EA580C" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} />
              <YAxis
                domain={[0, tankCapacity > 0 ? Math.round(tankCapacity * 1.1) : 'auto']}
                unit="L"
                tick={{ fontSize: 10, fill: '#64748B' }}
              />
              <Tooltip
                content={
                  <CustomTooltip
                    showRefills={showRefills}
                    showThefts={showThefts}
                    tankCapacity={tankCapacity}
                  />
                }
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />

              {/* Tank Capacity Reference Line */}
              {tankCapacity > 0 && (
                <ReferenceLine
                  y={tankCapacity}
                  label={{ value: `Full Tank: ${tankCapacity}L`, position: 'insideTopRight', fill: '#059669', fontSize: 10, fontWeight: 700 }}
                  stroke="#059669"
                  strokeDasharray="4 4"
                />
              )}

              {/* Low Fuel Threshold Reference Line */}
              {chartData?.lowFuelThreshold > 0 && (
                <ReferenceLine
                  y={chartData.lowFuelThreshold}
                  label={{ value: `Low Fuel: ${chartData.lowFuelThreshold}L`, position: 'insideBottomRight', fill: '#D97706', fontSize: 10, fontWeight: 700 }}
                  stroke="#D97706"
                  strokeDasharray="3 3"
                />
              )}

              {/* Single Unified Fuel Depletion Curve with Refill & Theft Points */}
              {showFilteredFuel && (
                <Area
                  type="monotone"
                  dataKey="fuelLevel"
                  name="Estimated Fuel Level (L)"
                  stroke="#EA580C"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#fuelLevelGradient)"
                  dot={({ cx, cy, payload }) => {
                    const isRefill = Boolean(payload.isRefill && showRefills);
                    const isTheft = Boolean(payload.isTheft && showThefts);
                    const isInitial = payload.isInitial;

                    if (isRefill) {
                      return (
                        <g key={`refill-dot-${cx}-${cy}`}>
                          <circle cx={cx} cy={cy} r={7} fill="#10B981" stroke="#FFFFFF" strokeWidth={2.5} />
                          <circle cx={cx} cy={cy} r={2.5} fill="#FFFFFF" />
                        </g>
                      );
                    }

                    if (isTheft) {
                      return (
                        <g key={`theft-dot-${cx}-${cy}`}>
                          <circle cx={cx} cy={cy} r={7} fill="#EF4444" stroke="#FFFFFF" strokeWidth={2.5} />
                          <circle cx={cx} cy={cy} r={2.5} fill="#FFFFFF" />
                        </g>
                      );
                    }

                    if (isInitial) {
                      return (
                        <circle
                          key={`init-dot-${cx}-${cy}`}
                          cx={cx}
                          cy={cy}
                          r={5}
                          fill="#3B82F6"
                          stroke="#FFFFFF"
                          strokeWidth={2}
                        />
                      );
                    }

                    return (
                      <circle
                        key={`norm-dot-${cx}-${cy}`}
                        cx={cx}
                        cy={cy}
                        r={3}
                        fill="#EA580C"
                        stroke="#FFFFFF"
                        strokeWidth={1.5}
                      />
                    );
                  }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default ManualFuelChartCard;
