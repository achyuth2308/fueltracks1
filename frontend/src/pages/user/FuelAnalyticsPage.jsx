import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Fuel, 
  Gauge, 
  Activity, 
  Zap, 
  Clock, 
  Calendar, 
  RefreshCw, 
  Search, 
  ChevronDown, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle2, 
  Sliders, 
  Download, 
  Maximize2, 
  Layers, 
  MapPin, 
  Info,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Compass,
  Check
} from 'lucide-react';
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
  Brush,
  ReferenceDot
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import axiosInstance from '../../api/axios';
import { formatLocalTime, formatLocalDate } from '../../utils/dateUtils';

// Helper to format IST strings cleanly
function formatIST(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch (e) {
    return '—';
  }
}

function formatDateIST(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return '—';
  }
}

// Preset range builder
function getPresetRange(preset) {
  const now = new Date();
  const end = new Date(now);
  let start = new Date(now);

  if (preset === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (preset === 'yesterday') {
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
  } else if (preset === '24h') {
    start.setTime(now.getTime() - 24 * 60 * 60 * 1000);
  } else if (preset === '7d') {
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
  }

  const toInput = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return {
    startStr: toInput(start),
    endStr: toInput(end),
    startDate: start.toISOString(),
    endDate: end.toISOString()
  };
}

export default function FuelAnalyticsPage() {
  const [vehicles, setVehicles] = useState([]);
  const [fetchingVehicles, setFetchingVehicles] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  
  // Searchable dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  // Time filters
  const [activePreset, setActivePreset] = useState('today');
  const [customStart, setCustomStart] = useState(() => getPresetRange('today').startStr);
  const [customEnd, setCustomEnd] = useState(() => getPresetRange('today').endStr);

  // Data state
  const [loading, setLoading] = useState(false);
  const [historyPoints, setHistoryPoints] = useState([]);
  const [error, setError] = useState(null);

  // Chart view toggles
  const [showFuel, setShowFuel] = useState(true);
  const [showSpeed, setShowSpeed] = useState(true);
  const [showDistance, setShowDistance] = useState(true);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 1. Fetch all user vehicles on mount
  useEffect(() => {
    const fetchVehicles = async () => {
      setFetchingVehicles(true);
      try {
        const res = await axiosInstance.get('/api/vehicles');
        const list = Array.isArray(res.data?.data)
          ? res.data.data
          : (Array.isArray(res.data?.vehicles) ? res.data.vehicles : []);
        setVehicles(list);
        if (list.length > 0 && !selectedVehicle) {
          // Select first vehicle or one with fuel sensor
          const withFuel = list.find(v => v.metadata?.fuel || v.metadata?.fuelCalibration || v.fuel != null) || list[0];
          setSelectedVehicle(withFuel);
        }
      } catch (err) {
        console.error('Failed to load vehicles list:', err);
      } finally {
        setFetchingVehicles(false);
      }
    };
    fetchVehicles();
  }, []);

  // 2. Fetch History Points when selected vehicle or date changes
  const fetchVehicleFuelData = async () => {
    if (!selectedVehicle?.id) return;
    setLoading(true);
    setError(null);

    let startIso, endIso;
    if (activePreset === 'custom') {
      startIso = new Date(customStart).toISOString();
      endIso = new Date(customEnd).toISOString();
    } else {
      const p = getPresetRange(activePreset);
      startIso = p.startDate;
      endIso = p.endDate;
    }

    try {
      // Fetch full high-resolution history for charts
      const res = await axiosInstance.get(`/api/vehicles/${selectedVehicle.id}/history`, {
        params: {
          startDate: startIso,
          endDate: endIso,
          limit: 1500
        }
      });

      if (res.data?.success && Array.isArray(res.data.data)) {
        setHistoryPoints(res.data.data);
      } else {
        setHistoryPoints([]);
      }
    } catch (err) {
      console.error('Failed to fetch fuel history:', err);
      setError('Unable to load fuel telemetry for the selected period.');
      setHistoryPoints([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicleFuelData();
  }, [selectedVehicle?.id, activePreset]);

  // Filtered vehicles for dropdown
  const filteredVehicles = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return vehicles;
    return vehicles.filter(v => 
      (v.plate && v.plate.toLowerCase().includes(q)) ||
      (v.name && v.name.toLowerCase().includes(q)) ||
      (v.imei && v.imei.toLowerCase().includes(q))
    );
  }, [vehicles, searchQuery]);

  // Tank size from vehicle metadata
  const tankCapacity = useMemo(() => {
    const meta = selectedVehicle?.metadata || {};
    const size = meta.fuel?.tankSize || meta.fuelCalibration?.tankSize || meta.tankCapacity || 250;
    return parseFloat(size) || 250;
  }, [selectedVehicle]);

  // Calibration helper if fuel is raw ADC in points
  const calibrateFuelValue = (rawFuel) => {
    if (rawFuel == null || isNaN(rawFuel)) return null;
    const num = parseFloat(rawFuel);
    // If already in normal range (<= tankCapacity * 1.2), return directly
    if (num <= tankCapacity * 1.2 && num < 1000) return Math.round(num * 10) / 10;

    // Check if calibration points exist in metadata
    const meta = selectedVehicle?.metadata || {};
    const cal = meta.fuelCalibration || meta.fuel || {};
    const points = cal.calibrationPoints || cal.tanks?.tank1?.calibrationPoints || [];

    if (Array.isArray(points) && points.length >= 2) {
      const sorted = points
        .map(p => ({ adc: parseFloat(p.adcValue || p.frequency || p.volt), ltr: parseFloat(p.litres) }))
        .filter(p => !isNaN(p.adc) && !isNaN(p.ltr))
        .sort((a, b) => a.adc - b.adc);

      if (sorted.length >= 2) {
        if (num <= sorted[0].adc) return sorted[0].ltr;
        if (num >= sorted[sorted.length - 1].adc) return sorted[sorted.length - 1].ltr;
        for (let i = 0; i < sorted.length - 1; i++) {
          const p1 = sorted[i];
          const p2 = sorted[i + 1];
          if (num >= p1.adc && num <= p2.adc) {
            const ratio = (num - p1.adc) / (p2.adc - p1.adc);
            return Math.round((p1.ltr + ratio * (p2.ltr - p1.ltr)) * 10) / 10;
          }
        }
      }
    }
    // Fallback: if value > 1000 and no points, scale by 10 or 100
    if (num > 1000) return Math.round((num / 10) * 10) / 10;
    return Math.round(num * 10) / 10;
  };

  // 3. Process Telemetry & Analytics Metrics
  const processedData = useMemo(() => {
    if (!historyPoints.length) {
      return {
        chartData: [],
        startFuel: 0,
        endFuel: 0,
        totalDistance: 0,
        fuelConsumed: 0,
        maxSpeed: 0,
        avgSpeed: 0,
        mileageKmpl: 0,
        idleHours: 0,
        movingHours: 0,
        currentStatus: 'OFF',
        currentSpeed: 0,
        currentFuel: 0,
        refuels: [],
        drops: [],
        sessions: []
      };
    }

    // Sort chronologically
    const sorted = [...historyPoints].sort((a, b) => new Date(a.device_time) - new Date(b.device_time));

    let cumulativeDist = 0;
    let maxSpd = 0;
    let sumSpd = 0;
    let speedSamples = 0;
    let idleMinutes = 0;
    let movingMinutes = 0;

    const chartPoints = [];
    const refuelEvents = [];
    const dropEvents = [];
    const sessions = [];

    let currentSession = null;
    let prevFuel = null;

    // Haversine distance calculator
    const haversine = (lat1, lon1, lat2, lon2) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    for (let i = 0; i < sorted.length; i++) {
      const pt = sorted[i];
      const rawSpeed = parseFloat(pt.speed) || 0;
      const ign = pt.ignition === true || pt.ignition === 'true' || pt.ignition === 1;
      const rawFuel = pt.fuel != null ? calibrateFuelValue(pt.fuel) : null;

      // Engine Status: strictly evaluated from speed + ignition
      let engineState = 'OFF';
      if (rawSpeed > 2.0) {
        engineState = 'ON (Moving)';
        movingMinutes += 0.5; // ~30 sec sampling approximation
      } else if (ign) {
        engineState = 'ON (Idle)';
        idleMinutes += 0.5;
      } else {
        engineState = 'OFF';
      }

      // Cumulative Distance calculation
      if (i > 0) {
        const prevPt = sorted[i - 1];
        if (pt.lat && pt.lng && prevPt.lat && prevPt.lng) {
          const segDist = haversine(prevPt.lat, prevPt.lng, pt.lat, pt.lng);
          // Filter GPS bounce spikes and static drift
          if (segDist > 0.005 && segDist < 10) {
            cumulativeDist += segDist;
          }
        }
      }

      // Detect refuels / drops (> 6L jump)
      if (prevFuel != null && rawFuel != null) {
        const diff = rawFuel - prevFuel;
        if (diff >= 6.0) {
          refuelEvents.push({
            time: formatIST(pt.device_time),
            liters: Math.round(diff * 10) / 10,
            level: rawFuel
          });
        } else if (diff <= -6.0) {
          dropEvents.push({
            time: formatIST(pt.device_time),
            liters: Math.round(Math.abs(diff) * 10) / 10,
            level: rawFuel
          });
        }
      }
      if (rawFuel != null) prevFuel = rawFuel;

      if (rawSpeed > maxSpd) maxSpd = rawSpeed;
      sumSpd += rawSpeed;
      speedSamples++;

      // Session grouping (moving vs idle)
      if (!currentSession || currentSession.status !== engineState) {
        if (currentSession) {
          currentSession.endTime = pt.device_time;
          currentSession.endFuel = rawFuel;
          currentSession.endDist = cumulativeDist;
          currentSession.durationMin = Math.max(1, Math.round((new Date(pt.device_time) - new Date(currentSession.startTime)) / 60000));
          currentSession.consumed = (currentSession.startFuel && currentSession.endFuel && currentSession.startFuel > currentSession.endFuel)
            ? Math.round((currentSession.startFuel - currentSession.endFuel) * 10) / 10 : 0;
          currentSession.distanceKm = Math.round((currentSession.endDist - currentSession.startDist) * 100) / 100;
          sessions.push(currentSession);
        }
        currentSession = {
          id: sessions.length + 1,
          status: engineState,
          startTime: pt.device_time,
          endTime: pt.device_time,
          startFuel: rawFuel,
          endFuel: rawFuel,
          startDist: cumulativeDist,
          endDist: cumulativeDist,
          maxSpeed: rawSpeed,
          avgSpeed: rawSpeed
        };
      } else {
        if (rawSpeed > currentSession.maxSpeed) currentSession.maxSpeed = rawSpeed;
      }

      chartPoints.push({
        timestamp: new Date(pt.device_time).getTime(),
        timeStr: formatIST(pt.device_time),
        dateStr: formatDateIST(pt.device_time),
        fuel: rawFuel,
        speed: Math.round(rawSpeed),
        distance: Math.round(cumulativeDist * 10) / 10,
        status: engineState
      });
    }

    if (currentSession) sessions.push(currentSession);

    // Initial and Final Fuel calculation
    const validFuels = chartPoints.filter(p => p.fuel != null);
    const startF = validFuels.length > 0 ? validFuels[0].fuel : 0;
    const endF = validFuels.length > 0 ? validFuels[validFuels.length - 1].fuel : 0;

    // Fuel consumed accounting for refuels
    const totalRefueled = refuelEvents.reduce((acc, r) => acc + r.liters, 0);
    const grossConsumed = Math.max(0, (startF + totalRefueled) - endF);
    const netDistance = Math.round(cumulativeDist * 10) / 10;
    const mileage = (grossConsumed > 0 && netDistance > 0) 
      ? Math.round((netDistance / grossConsumed) * 100) / 100 
      : 0;

    const latestPoint = sorted[sorted.length - 1];
    const latestSpeed = parseFloat(latestPoint?.speed) || 0;
    const latestIgn = latestPoint?.ignition === true || latestPoint?.ignition === 'true' || latestPoint?.ignition === 1;
    let latestStatus = 'OFF';
    if (latestSpeed > 2.0) latestStatus = 'ON (Moving)';
    else if (latestIgn) latestStatus = 'ON (Idle)';

    return {
      chartData: chartPoints,
      startFuel: Math.round(startF * 10) / 10,
      endFuel: Math.round(endF * 10) / 10,
      totalDistance: netDistance,
      fuelConsumed: Math.round(grossConsumed * 10) / 10,
      maxSpeed: Math.round(maxSpd),
      avgSpeed: speedSamples > 0 ? Math.round(sumSpd / speedSamples) : 0,
      mileageKmpl: mileage,
      idleHours: Math.round((idleMinutes / 60) * 10) / 10,
      movingHours: Math.round((movingMinutes / 60) * 10) / 10,
      currentStatus: latestStatus,
      currentSpeed: Math.round(latestSpeed),
      currentFuel: endF,
      refuels: refuelEvents,
      drops: dropEvents,
      sessions: sessions.slice(-10).reverse() // Show top 10 recent sessions
    };
  }, [historyPoints, tankCapacity]);

  // Live fuel percentage
  const fuelPercent = useMemo(() => {
    if (!tankCapacity || !processedData.currentFuel) return 0;
    return Math.min(100, Math.max(0, Math.round((processedData.currentFuel / tankCapacity) * 100)));
  }, [processedData.currentFuel, tankCapacity]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8 transition-colors duration-200">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── TOP HEADER & VEHICLE PICKER ── */}
        <div className="relative z-50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm">
          
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/20 text-white">
              <Fuel className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 dark:from-white dark:via-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                Fuel Analytics
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Precision fuel consumption, live engine metrics & distance correlation
              </p>
            </div>
          </div>

          {/* Searchable Vehicle Selector & Date Controls */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Custom Searchable Dropdown */}
            <div className="relative min-w-[260px] sm:min-w-[320px]" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl text-left text-sm font-medium hover:border-emerald-500 dark:hover:border-emerald-500 transition-all shadow-sm"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    selectedVehicle?.is_online ? 'bg-emerald-500 ring-4 ring-emerald-500/20' : 'bg-slate-400'
                  }`} />
                  <span className="font-semibold truncate">
                    {selectedVehicle ? (selectedVehicle.name || selectedVehicle.plate || selectedVehicle.imei) : 'Select Vehicle...'}
                  </span>
                  {selectedVehicle?.name && selectedVehicle?.plate && (
                    <span className="text-xs text-slate-400 truncate hidden sm:inline">
                      ({selectedVehicle.plate})
                    </span>
                  )}
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute z-[9999] right-0 w-full sm:w-[380px] mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl ring-1 ring-black/10 overflow-hidden flex flex-col"
                  >
                    {/* Search inside dropdown */}
                    <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70">
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search vehicle name, plate or IMEI..."
                          className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                          autoFocus
                        />
                      </div>
                    </div>

                    {/* Vehicle list */}
                    <div className="overflow-y-auto max-h-72 divide-y divide-slate-100 dark:divide-slate-800/60 p-1.5">
                      {filteredVehicles.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400">No vehicles match your search</div>
                      ) : (
                        filteredVehicles.map((v) => {
                          const isSelected = selectedVehicle?.id === v.id;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => {
                                setSelectedVehicle(v);
                                setIsDropdownOpen(false);
                                setSearchQuery('');
                              }}
                              className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs text-left rounded-xl transition-all ${
                                isSelected 
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold' 
                                  : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-3 truncate">
                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${v.is_online ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-slate-400'}`} />
                                <div className="truncate">
                                  <div className="font-semibold text-slate-900 dark:text-white truncate">
                                    {v.name || v.plate || v.imei}
                                  </div>
                                  <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                                    {v.plate && <span>{v.plate}</span>}
                                    <span>IMEI: {v.imei}</span>
                                  </div>
                                </div>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-emerald-500 shrink-0 ml-2" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Quick Range Presets */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs font-medium">
              {[
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: '24h', label: 'Last 24h' },
                { id: '7d', label: '7 Days' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActivePreset(tab.id)}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    activePreset === tab.id
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={fetchVehicleFuelData}
              disabled={loading}
              className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-all border border-slate-200 dark:border-slate-700/80 shadow-sm"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── TELEMETRY EXECUTIVE KPI CARDS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

          {/* CARD 1: ENGINE STATUS (Strictly Moving / Idle / OFF) */}
          <div className="relative overflow-hidden bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Engine Status</span>
              <Activity className="w-4 h-4 text-slate-400" />
            </div>

            <div className="my-1">
              {processedData.currentStatus === 'ON (Moving)' && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-sm font-bold">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  ON (Moving)
                </div>
              )}
              {processedData.currentStatus === 'ON (Idle)' && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-sm font-bold">
                  <Flame className="w-3.5 h-3.5" />
                  ON (Idle)
                </div>
              )}
              {processedData.currentStatus === 'OFF' && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 text-sm font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                  Engine OFF
                </div>
              )}
            </div>

            <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-2">
              <span>Moving: <strong className="text-slate-700 dark:text-slate-200">{processedData.movingHours}h</strong></span>
              <span>Idling: <strong className="text-slate-700 dark:text-slate-200">{processedData.idleHours}h</strong></span>
            </div>
          </div>

          {/* CARD 2: SPEED METRICS */}
          <div className="relative overflow-hidden bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Speed</span>
              <Gauge className="w-4 h-4 text-cyan-500" />
            </div>

            <div className="my-1 flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {processedData.currentSpeed}
              </span>
              <span className="text-xs text-slate-400 font-semibold">km/h</span>
            </div>

            <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-2">
              <span>Max: <strong className="text-slate-700 dark:text-slate-200">{processedData.maxSpeed} km/h</strong></span>
              <span>Avg: <strong className="text-slate-700 dark:text-slate-200">{processedData.avgSpeed} km/h</strong></span>
            </div>
          </div>

          {/* CARD 3: LIVE FUEL LEVEL */}
          <div className="relative overflow-hidden bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Fuel Level</span>
              <span className="text-xs font-bold text-emerald-500">{fuelPercent}%</span>
            </div>

            <div className="my-1 flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
                {processedData.currentFuel}
              </span>
              <span className="text-xs text-slate-400 font-semibold">L</span>
              <span className="text-[11px] text-slate-400">/ {tankCapacity}L</span>
            </div>

            {/* Fuel Progress Bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  fuelPercent < 15 ? 'bg-red-500' : (fuelPercent < 35 ? 'bg-amber-500' : 'bg-emerald-500')
                }`}
                style={{ width: `${fuelPercent}%` }}
              />
            </div>

            <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-2">
              <span>Start: <strong className="text-slate-700 dark:text-slate-200">{processedData.startFuel}L</strong></span>
              <span>End: <strong className="text-slate-700 dark:text-slate-200">{processedData.endFuel}L</strong></span>
            </div>
          </div>

          {/* CARD 4: DISTANCE TRAVELED */}
          <div className="relative overflow-hidden bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Distance</span>
              <Compass className="w-4 h-4 text-violet-500" />
            </div>

            <div className="my-1 flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {processedData.totalDistance}
              </span>
              <span className="text-xs text-slate-400 font-semibold">km</span>
            </div>

            <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-2">
              <span>Period: <strong className="text-slate-700 dark:text-slate-200">{activePreset}</strong></span>
              <span>Odo: <strong className="text-slate-700 dark:text-slate-200">{selectedVehicle?.odometer ? Math.round(selectedVehicle.odometer) : '—'} km</strong></span>
            </div>
          </div>

          {/* CARD 5: HERO FUEL ECONOMY & MILEAGE */}
          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-cyan-500/10 dark:from-emerald-950/40 dark:via-slate-900/60 dark:to-teal-950/30 border border-emerald-500/30 dark:border-emerald-500/20 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-500" /> Fuel Economy
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold">
                Efficiency
              </span>
            </div>

            <div className="my-1 flex items-baseline gap-1.5">
              <span className="text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                {processedData.mileageKmpl > 0 ? processedData.mileageKmpl : '—'}
              </span>
              <span className="text-xs text-emerald-700 dark:text-emerald-300 font-bold">km / L</span>
            </div>

            <div className="mt-3 text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between border-t border-emerald-500/20 pt-2">
              <span>Consumed: <strong className="text-emerald-600 dark:text-emerald-400">{processedData.fuelConsumed} L</strong></span>
              <span>Dist: <strong className="text-slate-700 dark:text-slate-200">{processedData.totalDistance} km</strong></span>
            </div>
          </div>

        </div>

        {/* ── MULTI-AXIS SYNCHRONIZED VISUALIZATION CHART ── */}
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 rounded-2xl shadow-sm space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-500" />
                Fuel vs. Speed vs. Distance Correlation
              </h2>
              <p className="text-xs text-slate-400">
                Interactive time-series displaying fuel level drops during speed bursts and idle idling intervals
              </p>
            </div>

            {/* Toggle Visibility Chips */}
            <div className="flex items-center gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setShowFuel(!showFuel)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
                  showFuel
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-transparent'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Fuel (L)
              </button>

              <button
                type="button"
                onClick={() => setShowSpeed(!showSpeed)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
                  showSpeed
                    ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/40 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-transparent'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-cyan-500" />
                Speed (km/h)
              </button>

              <button
                type="button"
                onClick={() => setShowDistance(!showDistance)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
                  showDistance
                    ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/40 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-transparent'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-violet-500" />
                Distance (km)
              </button>
            </div>
          </div>

          {/* Chart Container */}
          <div className="h-[360px] w-full pt-4">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
                <span className="text-sm font-medium">Loading high-resolution fuel graph...</span>
              </div>
            ) : processedData.chartData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
                <Fuel className="w-10 h-10 opacity-30" />
                <span className="text-sm font-medium">No telemetry packets found for this period</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={processedData.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fuelGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                  
                  <XAxis 
                    dataKey="timeStr" 
                    stroke="#64748b" 
                    fontSize={11} 
                    tickLine={false}
                  />

                  {/* Left Y Axis: Fuel (Litres) */}
                  <YAxis 
                    yAxisId="fuel" 
                    domain={[0, Math.ceil(tankCapacity * 1.05)]} 
                    stroke="#10b981" 
                    fontSize={11} 
                    tickLine={false}
                    orientation="left"
                  />

                  {/* Right Y Axis: Speed (km/h) */}
                  <YAxis 
                    yAxisId="speed" 
                    domain={[0, Math.max(80, processedData.maxSpeed + 10)]} 
                    stroke="#06b6d4" 
                    fontSize={11} 
                    tickLine={false} 
                    orientation="right"
                  />

                  {/* Custom Glass Tooltip */}
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const pt = payload[0].payload;
                      return (
                        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 p-3 rounded-xl shadow-2xl text-xs space-y-1.5 text-white">
                          <div className="font-bold border-b border-slate-800 pb-1 flex items-center justify-between gap-4">
                            <span>{pt.timeStr}</span>
                            <span className="text-[10px] text-slate-400 font-normal">{pt.dateStr}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-emerald-400 font-medium">Fuel Level:</span>
                            <span className="font-bold">{pt.fuel != null ? `${pt.fuel} L` : '—'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-cyan-400 font-medium">Speed:</span>
                            <span className="font-bold">{pt.speed} km/h</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-violet-400 font-medium">Distance:</span>
                            <span className="font-bold">{pt.distance} km</span>
                          </div>
                          <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-800/80">
                            <span className="text-slate-400">Status:</span>
                            <span className={`font-semibold ${
                              pt.status === 'ON (Moving)' ? 'text-emerald-400' : (pt.status === 'ON (Idle)' ? 'text-amber-400' : 'text-slate-400')
                            }`}>{pt.status}</span>
                          </div>
                        </div>
                      );
                    }}
                  />

                  {/* Fuel Area */}
                  {showFuel && (
                    <Area
                      yAxisId="fuel"
                      type="monotone"
                      dataKey="fuel"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#fuelGradient)"
                      connectNulls={true}
                      name="Fuel (L)"
                    />
                  )}

                  {/* Speed Line */}
                  {showSpeed && (
                    <Line
                      yAxisId="speed"
                      type="monotone"
                      dataKey="speed"
                      stroke="#06b6d4"
                      strokeWidth={1.8}
                      dot={false}
                      name="Speed (km/h)"
                    />
                  )}

                  {/* Distance Line */}
                  {showDistance && (
                    <Line
                      yAxisId="fuel"
                      type="monotone"
                      dataKey="distance"
                      stroke="#8b5cf6"
                      strokeWidth={1.8}
                      strokeDasharray="4 4"
                      dot={false}
                      name="Distance (km)"
                    />
                  )}

                  <Brush 
                    dataKey="timeStr" 
                    height={24} 
                    stroke="#10b981" 
                    fill="#0f172a" 
                    travellerWidth={10}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── REFUEL & ABNORMAL DRAIN EVENT BADGES ── */}
        {(processedData.refuels.length > 0 || processedData.drops.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Refuels */}
            <div className="bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-4">
              <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2 mb-2">
                <ArrowUpRight className="w-4 h-4" /> Detected Refuels ({processedData.refuels.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {processedData.refuels.map((r, idx) => (
                  <div key={idx} className="bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs flex items-center gap-2">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-300">+{r.liters} L</span>
                    <span className="text-slate-400">at {r.time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Drains */}
            <div className="bg-red-500/5 dark:bg-red-950/20 border border-red-500/20 rounded-2xl p-4">
              <h3 className="text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-2 mb-2">
                <ArrowDownRight className="w-4 h-4" /> Sudden Fuel Drops ({processedData.drops.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {processedData.drops.map((d, idx) => (
                  <div key={idx} className="bg-red-500/10 dark:bg-red-500/20 border border-red-500/30 px-3 py-1.5 rounded-xl text-xs flex items-center gap-2">
                    <span className="font-semibold text-red-600 dark:text-red-300">-{d.liters} L</span>
                    <span className="text-slate-400">at {d.time}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ── DRIVING SESSIONS & CONSUMPTION LOG TABLE ── */}
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Trip & Idling Consumption Breakdown</h3>
              <p className="text-xs text-slate-400">Segment-wise fuel burn and distance correlation</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg">
              {processedData.sessions.length} Sessions
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Engine Status</th>
                  <th className="px-4 py-3">Start Time (IST)</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Distance</th>
                  <th className="px-4 py-3">Fuel Consumed</th>
                  <th className="px-4 py-3">Max Speed</th>
                  <th className="px-4 py-3">Mileage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {processedData.sessions.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center text-slate-400">
                      No driving sessions recorded in this time range.
                    </td>
                  </tr>
                ) : (
                  processedData.sessions.map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                          s.status === 'ON (Moving)' 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                            : (s.status === 'ON (Idle)' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400')
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {formatIST(s.startTime)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {s.durationMin} mins
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        {s.distanceKm > 0 ? `${s.distanceKm} km` : '0 km'}
                      </td>
                      <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400 font-bold">
                        {s.consumed > 0 ? `${s.consumed} L` : '0 L'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {s.maxSpeed} km/h
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200">
                        {s.consumed > 0 && s.distanceKm > 0 ? `${Math.round((s.distanceKm / s.consumed) * 10) / 10} km/L` : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
