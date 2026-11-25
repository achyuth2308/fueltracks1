import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
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
  LineChart as LineChartIcon
} from 'lucide-react';
import { getFuelChartData } from '../../api/manualFuelApi';

/**
 * Custom Tooltip for Manual Fuel Chart
 */
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900/95 text-white p-3 rounded-xl shadow-xl border border-slate-700/80 text-xs backdrop-blur-md space-y-1.5 min-w-[190px]">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="font-bold text-slate-300">{data.date}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
            data.entryType === 'REFILL'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : data.entryType === 'INITIAL'
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              : data.entryType === 'GPS_DEPLETION'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : data.entryType === 'CURRENT_ESTIMATE'
              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
              : 'bg-slate-700 text-slate-300'
          }`}>
            {data.entryType === 'CURRENT_ESTIMATE'
              ? 'Live Telemetry'
              : data.entryType === 'GPS_DEPLETION'
              ? 'GPS Telemetry'
              : data.entryType}
          </span>
        </div>

        <div className="space-y-1 pt-0.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Fuel Level:</span>
            <span className="font-extrabold text-orange-400 text-sm font-mono">
              {Number(data.fuelLevel).toFixed(1)} L
            </span>
          </div>

          {data.fuelFilled > 0 && (
            <div className="flex items-center justify-between text-emerald-400 font-semibold">
              <span>Fuel Added:</span>
              <span className="font-mono">+{Number(data.fuelFilled).toFixed(1)} L</span>
            </div>
          )}

          {data.odometer > 0 && (
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Odometer:</span>
              <span className="font-mono font-semibold">{Number(data.odometer).toLocaleString()} KM</span>
            </div>
          )}

          {data.driverName && (
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Logged by:</span>
              <span className="text-slate-200 font-medium">{data.driverName}</span>
            </div>
          )}

          {data.remarks && (
            <div className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-800/80">
              "{data.remarks}"
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

// Helpers for datetime-local
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
 * Full interactive analytics graph for Manual Fuel Monitoring without physical sensors.
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
  const [activeMetric, setActiveMetric] = useState('level'); // 'level' | 'refills' | 'mileage'
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const startInputRef = React.useRef(null);
  const endInputRef = React.useRef(null);

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

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
      {/* Top Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-600">
              <BarChart2 size={18} />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Fuel Telemetry & Mileage Graph
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
              Estimated Values
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Visualizing tank level depletion based on GPS distance & verified driver refill events.
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

          {/* Metric View Switcher */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveMetric('level')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                activeMetric === 'level'
                  ? 'bg-white text-orange-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Fuel Level (L)
            </button>
            <button
              type="button"
              onClick={() => setActiveMetric('refills')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                activeMetric === 'refills'
                  ? 'bg-white text-emerald-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Refills (L)
            </button>
            <button
              type="button"
              onClick={() => setActiveMetric('mileage')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                activeMetric === 'mileage'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mileage (km/l)
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

      {/* KPI Stats Row */}
      {chartData && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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

          <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
            <span className="text-[10px] font-extrabold uppercase text-emerald-800 tracking-wider">
              Total Refilled
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-emerald-950 font-mono">
                +{Number(chartData.totalFuelRefilled).toFixed(1)}
              </span>
              <span className="text-xs font-bold text-emerald-700">Litres</span>
            </div>
            <span className="text-[10.5px] font-semibold text-emerald-700">Verified entries</span>
          </div>

          <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-100">
            <span className="text-[10px] font-extrabold uppercase text-rose-800 tracking-wider">
              Est. Fuel Consumed
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-rose-950 font-mono">
                {Number(chartData.totalFuelConsumed).toFixed(1)}
              </span>
              <span className="text-xs font-bold text-rose-700">Litres</span>
            </div>
            <span className="text-[10.5px] font-semibold text-rose-700">GPS Distance / Mileage</span>
          </div>

          <div className="p-3 rounded-xl bg-sky-50/60 border border-sky-100">
            <span className="text-[10px] font-extrabold uppercase text-sky-800 tracking-wider">
              GPS Distance Tracked
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-sky-950 font-mono">
                {Math.round(chartData.totalDistance).toLocaleString()}
              </span>
              <span className="text-xs font-bold text-sky-700">KM</span>
            </div>
            <span className="text-[10.5px] font-semibold text-sky-700">Total travelled</span>
          </div>

          <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-100">
            <span className="text-[10px] font-extrabold uppercase text-purple-800 tracking-wider">
              Average Mileage
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-purple-950 font-mono">
                {Number(chartData.currentMileage).toFixed(1)}
              </span>
              <span className="text-xs font-bold text-purple-700">km/l</span>
            </div>
            <span className="text-[10.5px] font-semibold text-purple-700">Learned rolling avg</span>
          </div>
        </div>
      )}

      {/* Chart Canvas */}
      <div className="w-full h-72 sm:h-80 bg-slate-50/50 rounded-xl border border-slate-100 p-2 sm:p-4">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold">Generating fuel telemetry graph...</span>
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
            {activeMetric === 'refills' ? (
              <ComposedChart data={timeline} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} />
                <YAxis unit="L" tick={{ fontSize: 10, fill: '#64748B' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="fuelFilled" name="Fuel Added (Litres)" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="fuelLevel" name="Resulting Tank Level (L)" stroke="#EA580C" strokeWidth={2} dot={{ r: 4 }} />
              </ComposedChart>
            ) : activeMetric === 'mileage' ? (
              <ComposedChart
                data={chartData?.mileageHistory?.length ? chartData.mileageHistory : timeline}
                margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} />
                <YAxis unit=" km/l" tick={{ fontSize: 10, fill: '#64748B' }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Line
                  type="monotone"
                  dataKey="calculatedMileage"
                  name="Calculated Trip Mileage (km/l)"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="rollingAverage"
                  name="Rolling Avg Mileage (km/l)"
                  stroke="#8B5CF6"
                  strokeWidth={2.5}
                  strokeDasharray="4 4"
                />
              </ComposedChart>
            ) : (
              <ComposedChart data={timeline} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="fuelLevelGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EA580C" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#EA580C" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} />
                <YAxis
                  domain={[0, tankCapacity > 0 ? Math.round(tankCapacity * 1.1) : 'auto']}
                  unit="L"
                  tick={{ fontSize: 10, fill: '#64748B' }}
                />
                <Tooltip content={<CustomTooltip />} />
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

                <Area
                  type="monotone"
                  dataKey="fuelLevel"
                  name="Estimated Fuel Level (L)"
                  stroke="#EA580C"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#fuelLevelGradient)"
                  dot={({ cx, cy, payload }) => {
                    const isRefill = payload.isRefill;
                    const isInitial = payload.isInitial;
                    return (
                      <circle
                        key={cx + '-' + cy}
                        cx={cx}
                        cy={cy}
                        r={isRefill ? 6 : isInitial ? 5 : 4}
                        fill={isRefill ? '#10B981' : isInitial ? '#3B82F6' : '#EA580C'}
                        stroke="#FFFFFF"
                        strokeWidth={2}
                      />
                    );
                  }}
                />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default ManualFuelChartCard;
