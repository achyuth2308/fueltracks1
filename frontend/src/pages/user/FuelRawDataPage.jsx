import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Database, Fuel, Search, Calendar, Clock, RefreshCw, Download,
  FileSpreadsheet, FileText, ChevronDown, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, Gauge, Zap, CheckCircle2, AlertTriangle,
  Radio, ShieldAlert, Cpu, ArrowUpDown, Filter, X, Sliders
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import axiosInstance from '../../api/axios';
import { useAuth } from '../../hooks/useAuth';

// Safe date formatter for Indian Standard Time (IST)
function formatIST(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(d);
  } catch (e) {
    return String(dateStr);
  }
}

// Sampling Interval options (matching reference system)
const INTERVAL_OPTIONS = [
  { value: 'raw', label: 'Raw (All Data)' },
  { value: '5m', label: '5 mins', ms: 5 * 60 * 1000 },
  { value: '10m', label: '10 mins', ms: 10 * 60 * 1000 },
  { value: '15m', label: '15 mins', ms: 15 * 60 * 1000 },
  { value: '20m', label: '20 mins', ms: 20 * 60 * 1000 },
  { value: '30m', label: '30 mins', ms: 30 * 60 * 1000 },
  { value: '1h', label: '1 hour', ms: 60 * 60 * 1000 }
];

// Quick Date Range Presets
const getPresetRange = (type) => {
  const now = new Date();
  const formatIsoLocal = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  if (type === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    return {
      startDate: start.toISOString(),
      endDate: now.toISOString(),
      startStr: formatIsoLocal(start),
      endStr: formatIsoLocal(now)
    };
  }
  if (type === 'yesterday') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      startStr: formatIsoLocal(start),
      endStr: formatIsoLocal(end)
    };
  }
  if (type === 'last24h') {
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return {
      startDate: start.toISOString(),
      endDate: now.toISOString(),
      startStr: formatIsoLocal(start),
      endStr: formatIsoLocal(now)
    };
  }
  if (type === 'last7d') {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return {
      startDate: start.toISOString(),
      endDate: now.toISOString(),
      startStr: formatIsoLocal(start),
      endStr: formatIsoLocal(now)
    };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  return {
    startDate: start.toISOString(),
    endDate: now.toISOString(),
    startStr: formatIsoLocal(start),
    endStr: formatIsoLocal(now)
  };
};

export default function FuelRawDataPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Fleet & Vehicle Selection State
  const [vehicles, setVehicles] = useState([]);
  const [groups, setGroups] = useState([]);
  const [fetchingVehicles, setFetchingVehicles] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');

  // Dropdown DOM refs
  const dropdownRef = useRef(null);
  const groupDropdownRef = useRef(null);

  // Date Range & Sampling Interval State
  const defaultToday = useMemo(() => getPresetRange('today'), []);
  const [customStart, setCustomStart] = useState(defaultToday.startStr);
  const [customEnd, setCustomEnd] = useState(defaultToday.endStr);
  const [activePreset, setActivePreset] = useState('today');
  const [selectedInterval, setSelectedInterval] = useState('raw');

  // Telemetry Packets State
  const [loading, setLoading] = useState(false);
  const [historyPoints, setHistoryPoints] = useState([]);
  const [error, setError] = useState(null);

  // Table Search & Pagination State
  const [tableSearch, setTableSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (groupDropdownRef.current && !groupDropdownRef.current.contains(event.target)) {
        setIsGroupDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 1. Initial Load of Vehicles and Groups
  useEffect(() => {
    const fetchInitialData = async () => {
      setFetchingVehicles(true);
      try {
        const [vehiclesRes, groupsRes] = await Promise.allSettled([
          axiosInstance.get('/api/vehicles'),
          axiosInstance.get('/api/admin/groups')
        ]);

        let list = [];
        if (vehiclesRes.status === 'fulfilled') {
          list = Array.isArray(vehiclesRes.value?.data?.data)
            ? vehiclesRes.value.data.data
            : (Array.isArray(vehiclesRes.value?.data?.vehicles) ? vehiclesRes.value.data.vehicles : []);
          setVehicles(list);

          // If query param ?vehicle=... was provided, pick it
          const queryParams = new URLSearchParams(location.search);
          const vParam = queryParams.get('vehicle');
          if (vParam) {
            const found = list.find(v => String(v.id) === vParam || v.plate === vParam || v.imei === vParam);
            if (found) setSelectedVehicle(found);
          } else if (list.length > 0 && !selectedVehicle) {
            const withFuel = list.find(v => v.metadata?.fuel || v.metadata?.fuelCalibration || v.fuel != null) || list[0];
            setSelectedVehicle(withFuel);
          }
        }

        if (groupsRes.status === 'fulfilled') {
          const gList = Array.isArray(groupsRes.value?.data?.data)
            ? groupsRes.value.data.data
            : (Array.isArray(groupsRes.value?.data?.groups) ? groupsRes.value.data.groups : []);
          setGroups(gList);
        }
      } catch (err) {
        console.error('Failed to load initial vehicles/groups:', err);
      } finally {
        setFetchingVehicles(false);
      }
    };
    fetchInitialData();
  }, []);

  // 2. Fetch History Points
  const fetchTelemetryHistory = async (overrideStart, overrideEnd) => {
    if (!selectedVehicle?.id) return;
    setLoading(true);
    setError(null);
    setCurrentPage(1);

    let startIso, endIso;
    const s = overrideStart || customStart;
    const e = overrideEnd || customEnd;
    try {
      startIso = new Date(s).toISOString();
      endIso = new Date(e).toISOString();
    } catch (err) {
      const p = getPresetRange('today');
      startIso = p.startDate;
      endIso = p.endDate;
    }

    try {
      const res = await axiosInstance.get(`/api/vehicles/${selectedVehicle.id}/history`, {
        params: {
          startDate: startIso,
          endDate: endIso,
          noCount: true,
          sample: false, // In raw data page, pull true high-res telemetry without downsampling
          maxPoints: 1000
        }
      });

      if (res.data?.success && Array.isArray(res.data.data)) {
        setHistoryPoints(res.data.data);
      } else {
        setHistoryPoints([]);
      }
    } catch (err) {
      console.error('Failed to fetch fuel history:', err);
      setError('Unable to load telemetry packets for the selected period.');
      setHistoryPoints([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPreset = (presetId) => {
    setActivePreset(presetId);
    const range = getPresetRange(presetId);
    setCustomStart(range.startStr);
    setCustomEnd(range.endStr);
    fetchTelemetryHistory(range.startStr, range.endStr);
  };

  useEffect(() => {
    if (selectedVehicle?.id) {
      fetchTelemetryHistory();
    }
  }, [selectedVehicle?.id]);

  // Available Groups strictly scoped to user's authorized groups
  const availableGroups = useMemo(() => {
    const map = new Map();
    if (Array.isArray(groups) && groups.length > 0) {
      groups.forEach(g => {
        const id = String(g.id);
        const name = g.name || 'Unnamed Group';
        map.set(id, { id, name, count: 0 });
      });
    }

    vehicles.forEach(v => {
      if (Array.isArray(v.groups) && v.groups.length > 0) {
        v.groups.forEach(vg => {
          const id = String(vg.id);
          if (map.has(id)) {
            // Already present
          } else if (!groups || groups.length === 0) {
            map.set(id, { id, name: vg.name || 'Unnamed Group', count: 0 });
          }
        });
      } else if (v.group_name && (!groups || groups.length === 0)) {
        v.group_name.split(',').forEach(gn => {
          const clean = gn.trim();
          if (clean && !map.has(clean)) {
            map.set(clean, { id: clean, name: clean, count: 0 });
          }
        });
      }
    });

    vehicles.forEach(v => {
      map.forEach((gObj, gId) => {
        const targetName = gObj.name.trim().toLowerCase();
        const matches = (
          (Array.isArray(v.groups) && v.groups.some(vg => String(vg.id) === gId || (vg.name && vg.name.trim().toLowerCase() === targetName))) ||
          (v.group_id && String(v.group_id) === gId) ||
          (v.group_name && v.group_name.split(',').map(s => s.trim().toLowerCase()).includes(targetName))
        );
        if (matches) gObj.count++;
      });
    });

    const list = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    return { list, unassignedCount: 0 };
  }, [groups, vehicles]);

  // Vehicles filtered by selected group
  const vehiclesInSelectedGroup = useMemo(() => {
    if (selectedGroupId === 'all') return vehicles;

    const currentGroup = availableGroups.list.find(g => g.id === selectedGroupId);
    const targetName = currentGroup?.name?.trim()?.toLowerCase();

    return vehicles.filter(v => {
      const matchArray = Array.isArray(v.groups) && v.groups.some(vg => 
        String(vg.id) === String(selectedGroupId) || (targetName && vg.name?.trim()?.toLowerCase() === targetName)
      );
      const matchId = v.group_id && String(v.group_id) === String(selectedGroupId);
      const matchName = targetName && v.group_name && v.group_name.split(',').map(s => s.trim().toLowerCase()).includes(targetName);
      return matchArray || matchId || matchName;
    });
  }, [selectedGroupId, vehicles, availableGroups]);

  // Filtered vehicles for search input in vehicle dropdown
  const filteredVehicles = useMemo(() => {
    if (!vehicleSearch.trim()) return vehiclesInSelectedGroup;
    const q = vehicleSearch.toLowerCase().trim();
    return vehiclesInSelectedGroup.filter(v => 
      (v.plate && v.plate.toLowerCase().includes(q)) ||
      (v.name && v.name.toLowerCase().includes(q)) ||
      (v.imei && v.imei.toLowerCase().includes(q))
    );
  }, [vehiclesInSelectedGroup, vehicleSearch]);

  // Calibration Engine (Exact Look-Up Table & Min/Max Formula)
  // Calibration Engine (Exact Look-Up Table & Min/Max Formula)
  const tankCapacity = useMemo(() => {
    if (!selectedVehicle) return 400;
    const meta = selectedVehicle.metadata || {};
    const cal = meta.fuelCalibration || meta.fuel || {};
    const cap = cal.tankSize ?? meta.tankSize ?? cal.capacity ?? cal.tankCapacity ?? meta.tankCapacity ?? meta.tank_capacity;
    return parseFloat(cap) || 400;
  }, [selectedVehicle]);

  // Resolves both the exact Raw ADC Sensor packet and the Calibrated Litres (bidirectional)
  const resolveFuelTelemetry = (rawInput, ptTime) => {
    if (rawInput === null || rawInput === undefined || isNaN(Number(rawInput))) {
      return { rawSensor: null, convertedFuel: null };
    }
    const num = Number(rawInput);
    if (!selectedVehicle) {
      return { rawSensor: Math.round(num), convertedFuel: Math.round(num * 10) / 10 };
    }

    const meta = selectedVehicle.metadata || {};
    const cal = meta.fuelCalibration || meta.fuel || {};
    const points = cal.calibrationPoints || cal.tanks?.['1']?.calibrationPoints || cal.tanks?.tank1?.calibrationPoints || [];

    if (Array.isArray(points) && points.length >= 2) {
      const sorted = points
        .map(p => ({
          adc: parseFloat(p.adcValue !== undefined ? p.adcValue : (p.frequency !== undefined ? p.frequency : p.volt)),
          ltr: parseFloat(p.litres)
        }))
        .filter(p => !isNaN(p.adc) && !isNaN(p.ltr))
        .sort((a, b) => a.adc - b.adc);

      if (sorted.length >= 2) {
        const maxLtr = sorted[sorted.length - 1].ltr;

        // CASE 1: num is RAW ADC / Sensor Reading (num > maxLtr * 1.15 or num > 800)
        if (num > maxLtr * 1.15 || num > 800) {
          const rawAdc = Math.round(num);
          let ltr = 0;
          if (num <= sorted[0].adc) ltr = sorted[0].ltr;
          else if (num >= sorted[sorted.length - 1].adc) ltr = sorted[sorted.length - 1].ltr;
          else {
            for (let i = 0; i < sorted.length - 1; i++) {
              const p1 = sorted[i];
              const p2 = sorted[i + 1];
              if (num >= p1.adc && num <= p2.adc) {
                const range = p2.adc - p1.adc;
                const ratio = range !== 0 ? (num - p1.adc) / range : 0;
                ltr = p1.ltr + ratio * (p2.ltr - p1.ltr);
                break;
              }
            }
          }
          return {
            rawSensor: rawAdc,
            convertedFuel: Math.round(ltr * 10) / 10
          };
        }

        // CASE 2: num is ALREADY CONVERTED LITRES (e.g. 366.14 from backend subscriber)
        // Reverse-interpolate to find the exact raw ADC/sensor value!
        const convertedLtr = Math.round(num * 10) / 10;
        let calculatedAdc = sorted[0].adc;
        const sortedByLtr = [...sorted].sort((a, b) => a.ltr - b.ltr);

        if (num <= sortedByLtr[0].ltr) {
          calculatedAdc = sortedByLtr[0].adc;
        } else if (num >= sortedByLtr[sortedByLtr.length - 1].ltr) {
          calculatedAdc = sortedByLtr[sortedByLtr.length - 1].adc;
        } else {
          for (let i = 0; i < sortedByLtr.length - 1; i++) {
            const p1 = sortedByLtr[i];
            const p2 = sortedByLtr[i + 1];
            if (num >= p1.ltr && num <= p2.ltr) {
              const range = p2.ltr - p1.ltr;
              const ratio = range !== 0 ? (num - p1.ltr) / range : 0;
              calculatedAdc = Math.round(p1.adc + ratio * (p2.adc - p1.adc));
              break;
            }
          }
        }
        return {
          rawSensor: calculatedAdc,
          convertedFuel: convertedLtr
        };
      }
    }

    // Default fallback
    return {
      rawSensor: Math.round(num),
      convertedFuel: Math.round(num * 10) / 10
    };
  };

  // Process Telemetry Rows with Calibration, 5-Point Median + EMA, and Normalization
  const processedRows = useMemo(() => {
    if (!historyPoints.length) return [];

    // Sort chronologically (Full dataset)
    const sortedAll = [...historyPoints].sort((a, b) => new Date(a.device_time) - new Date(b.device_time));

    // Optional Sampling Interval bucketing (for table audit & report export)
    let sorted = sortedAll;
    if (selectedInterval !== 'raw') {
      const targetOption = INTERVAL_OPTIONS.find(o => o.value === selectedInterval);
      if (targetOption?.ms && sortedAll.length > 0) {
        const intervalMs = targetOption.ms;
        const bucketMap = new Map();
        for (const pt of sortedAll) {
          const t = new Date(pt.device_time).getTime();
          if (isNaN(t)) continue;
          const bucketKey = Math.floor(t / intervalMs);
          bucketMap.set(bucketKey, pt);
        }
        sorted = Array.from(bucketMap.values()).sort((a, b) => new Date(a.device_time) - new Date(b.device_time));
      }
    }

    // Resolve Raw ADC and Converted Litres for each point
    const resolvedFuels = sorted.map(pt => resolveFuelTelemetry(pt.fuel, pt.device_time));
    const rawFuels = resolvedFuels.map(r => r.convertedFuel);

    // 5-Point Median Filter + EMA (Stage 1 & 2)
    const filteredFuels = new Array(sorted.length).fill(null);
    let lastEma = null;
    for (let i = 0; i < sorted.length; i++) {
      const windowVals = [];
      for (let w = Math.max(0, i - 2); w <= Math.min(sorted.length - 1, i + 2); w++) {
        if (rawFuels[w] != null) windowVals.push(rawFuels[w]);
      }
      if (windowVals.length > 0) {
        windowVals.sort((a, b) => a - b);
        const median = windowVals[Math.floor(windowVals.length / 2)];
        if (lastEma == null) {
          lastEma = median;
        } else {
          lastEma = (0.25 * median) + (0.75 * lastEma);
        }
        filteredFuels[i] = Math.max(0, Math.min(tankCapacity, Math.round(lastEma * 10) / 10));
      } else {
        filteredFuels[i] = lastEma;
      }
    }

    // Physical Reality Normalization (Stage 3)
    const normalizedFuels = new Array(sorted.length).fill(null);
    const firstValid = filteredFuels.find(f => f != null);
    let currentNorm = firstValid != null ? firstValid : 0;
    const refuelThreshold = 25.0;
    const theftThreshold = 15.0;

    for (let i = 0; i < sorted.length; i++) {
      const pt = sorted[i];
      const rawSpeed = parseFloat(pt.speed) || 0;
      const ign = pt.ignition === true || pt.ignition === 'true' || pt.ignition === 1;
      const isEngineOn = rawSpeed > 6.0 || ign; // 6 km/h speed threshold
      const fVal = filteredFuels[i];

      if (fVal != null) {
        const diff = fVal - currentNorm;
        // Refuel: Sustained jump >= refuelThreshold while vehicle is stationary/stopped
        if (diff >= refuelThreshold && rawSpeed <= 6.0) {
          currentNorm = fVal;
        }
        // Theft / Drain: Drop <= -theftThreshold while engine is OFF
        else if (diff <= -theftThreshold && !isEngineOn) {
          currentNorm = fVal;
        }
        // Engine ON (Driving or Idling / Machinery / Genset running)
        // Fuel is actively being consumed: fuel CANNOT rise without a verified refill!
        else if (isEngineOn) {
          if (diff < 0) {
            if (rawSpeed > 6.0) {
              currentNorm = (0.85 * currentNorm) + (0.15 * fVal);
            } else {
              currentNorm = (0.90 * currentNorm) + (0.10 * fVal);
            }
          }
          // Positive diff while running without a refill is sensor ripple/vibration -> REJECTED!
        }
        // Engine OFF & Parked (rawSpeed <= 6.0 and !isEngineOn)
        // Static resting state: gently converge to true physical resting volume
        else {
          if (Math.abs(diff) < refuelThreshold) {
            currentNorm = (0.85 * currentNorm) + (0.15 * fVal);
          }
        }
      }
      normalizedFuels[i] = Math.max(0, Math.min(tankCapacity, Math.round(currentNorm * 10) / 10));
    }

    // Assemble enriched rows (Full 4-Stage Fuel Telemetry Pipeline)
    return sorted.map((pt, idx) => {
      const speed = parseFloat(pt.speed) || 0;
      const ign = pt.ignition === true || pt.ignition === 'true' || pt.ignition === 1;
      const fuelInfo = resolvedFuels[idx] || { rawSensor: null, convertedFuel: null };
      const rawSensor = fuelInfo.rawSensor;
      const converted = fuelInfo.convertedFuel;
      const filtered = filteredFuels[idx];
      const normalized = normalizedFuels[idx];

      // Classify event tag based on raw/normalized step changes
      let eventTag = 'Normal';
      let eventType = 'normal';
      const prevConverted = idx > 0 ? rawFuels[idx - 1] : null;
      const step = (converted != null && prevConverted != null) ? Math.round((converted - prevConverted) * 10) / 10 : 0;
      
      if (step >= refuelThreshold) {
        eventTag = `Refuel (+${step}L)`;
        eventType = 'refuel';
      } else if (step <= -theftThreshold && !ign) {
        eventTag = `Theft (${step}L)`;
        eventType = 'theft';
      } else if (speed > 6) {
        eventTag = 'Moving';
        eventType = 'moving';
      } else if (ign && speed <= 6) {
        eventTag = 'Idling';
        eventType = 'idle';
      } else {
        eventTag = 'Parked';
        eventType = 'parked';
      }

      return {
        index: idx + 1,
        timeRaw: pt.device_time,
        timeFormatted: formatIST(pt.device_time),
        speed: speed,
        ignition: ign,
        rawSensor: rawSensor,
        convertedFuel: converted,
        filteredFuel: filtered,
        normalizedFuel: normalized,
        odometer: pt.odometer != null ? Math.round(Number(pt.odometer) * 10) / 10 : '—',
        voltage: pt.voltage != null ? Math.round(Number(pt.voltage) * 10) / 10 : (pt.battery != null ? `${pt.battery}V` : '—'),
        battery: pt.backup_battery ?? pt.battery_level ?? '—',
        eventTag: eventTag,
        eventType: eventType,
        lat: pt.lat,
        lng: pt.lng
      };
    });
  }, [historyPoints, tankCapacity, selectedInterval]);

  // Telemetry Health Metrics Summary
  const telemetrySummary = useMemo(() => {
    if (!processedRows.length) {
      return { totalPackets: 0, minRaw: 0, maxRaw: 0, endFuel: 0, maxSpeed: 0, avgSpeed: 0 };
    }
    const rawVals = processedRows.map(r => r.rawSensor).filter(v => v != null);
    const speeds = processedRows.map(r => r.speed);
    const validFuels = processedRows.map(r => r.normalizedFuel).filter(v => v != null);

    return {
      totalPackets: processedRows.length,
      minRaw: rawVals.length ? Math.min(...rawVals) : 0,
      maxRaw: rawVals.length ? Math.max(...rawVals) : 0,
      endFuel: validFuels.length ? validFuels[validFuels.length - 1] : 0,
      maxSpeed: speeds.length ? Math.max(...speeds) : 0,
      avgSpeed: speeds.length ? Math.round((speeds.reduce((a, b) => a + b, 0) / speeds.length) * 10) / 10 : 0
    };
  }, [processedRows]);

  // Filtered Rows for Table Search & Sort
  const filteredAndSortedRows = useMemo(() => {
    let rows = [...processedRows];

    // Search filter
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim();
      rows = rows.filter(r =>
        r.timeFormatted.toLowerCase().includes(q) ||
        String(r.speed).includes(q) ||
        String(r.rawSensor).includes(q) ||
        String(r.convertedFuel).includes(q) ||
        String(r.filteredFuel).includes(q) ||
        String(r.normalizedFuel).includes(q) ||
        r.eventTag.toLowerCase().includes(q)
      );
    }

    // Sort order
    if (sortOrder === 'desc') {
      rows.sort((a, b) => new Date(b.timeRaw) - new Date(a.timeRaw));
    } else {
      rows.sort((a, b) => new Date(a.timeRaw) - new Date(b.timeRaw));
    }

    return rows;
  }, [processedRows, tableSearch, sortOrder]);

  // Pagination Slice
  const totalPages = Math.ceil(filteredAndSortedRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedRows.slice(start, start + pageSize);
  }, [filteredAndSortedRows, currentPage, pageSize]);

  // Excel / CSV Export (Full 4-Stage Fuel Pipeline, Delta Removed)
  const handleExportExcel = () => {
    if (!processedRows.length) return;
    const vName = selectedVehicle?.plate || selectedVehicle?.name || 'Vehicle';
    const exportData = processedRows.map(r => ({
      '#': r.index,
      'Timestamp (IST)': r.timeFormatted,
      'Speed (km/h)': r.speed,
      'Ignition': r.ignition ? 'ON' : 'OFF',
      'Raw Sensor Packet': r.rawSensor != null ? r.rawSensor : '—',
      'Converted Fuel (Liters)': r.convertedFuel != null ? r.convertedFuel : '—',
      'Filtered Fuel (Liters)': r.filteredFuel != null ? r.filteredFuel : '—',
      'Normalized Fuel (Liters)': r.normalizedFuel != null ? r.normalizedFuel : '—',
      'Odometer (km)': r.odometer,
      'Voltage (V)': r.voltage,
      'Event Classification': r.eventTag
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fuel Raw Data');
    const safePlate = (selectedVehicle?.plate || 'vehicle').replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(wb, `Fuel_Raw_Data_${safePlate}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // PDF Report Export (Full 4-Stage Fuel Pipeline, Delta Removed)
  const handleExportPDF = () => {
    if (!processedRows.length) return;
    const doc = new jsPDF('landscape');
    const vName = selectedVehicle?.plate || selectedVehicle?.name || 'Vehicle';
    const imei = selectedVehicle?.imei || '—';

    // Corporate Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('FuelTracks Telematics — Raw Fuel Packet Audit Report', 14, 12);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Vehicle: ${vName} | IMEI: ${imei} | Capacity: ${tankCapacity}L | Period: ${customStart.replace('T', ' ')} to ${customEnd.replace('T', ' ')} | Generated: ${formatIST(new Date().toISOString())}`, 14, 18);

    const tableColumn = [
      '#', 'Timestamp (IST)', 'Speed', 'Engine', 'Raw Packet', 'Converted (L)',
      'Filtered (L)', 'Normalized (L)', 'Odometer', 'Voltage', 'Event Tag'
    ];

    const tableRows = processedRows.map(r => [
      r.index,
      r.timeFormatted,
      `${r.speed} km/h`,
      r.ignition ? 'ON' : 'OFF',
      r.rawSensor != null ? r.rawSensor : '—',
      r.convertedFuel != null ? `${r.convertedFuel} L` : '—',
      r.filteredFuel != null ? `${r.filteredFuel} L` : '—',
      r.normalizedFuel != null ? `${r.normalizedFuel} L` : '—',
      r.odometer !== '—' ? `${r.odometer} km` : '—',
      r.voltage !== '—' ? `${r.voltage} V` : '—',
      r.eventTag
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 22,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    const safePlate = (selectedVehicle?.plate || 'vehicle').replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Fuel_Raw_Data_${safePlate}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div style={{ background: '#F0F4F8', minHeight: '100vh', padding: '20px', boxSizing: 'border-box' }} className="w-full space-y-4">
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 1. TOP HEADER BANNER (Terminal Navy Style) */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div style={{
        background: 'linear-gradient(135deg, #1E3A5F 0%, #0F2744 100%)',
        borderRadius: '14px',
        padding: '18px 24px',
        color: '#FFFFFF',
        boxShadow: '0 4px 20px rgba(15, 39, 68, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.15)',
            borderRadius: '10px',
            padding: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Database size={24} color="#7DD3FC" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
                Fuel Raw Data
              </h1>
              <span style={{
                background: 'rgba(34, 197, 94, 0.2)',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                borderRadius: '20px',
                padding: '2px 10px',
                fontSize: '11px',
                color: '#86EFAC',
                fontWeight: 700
              }}>
                Telemetry Audit
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '12px', opacity: 0.85, color: '#E2E8F0' }}>
              4-Stage Telemetry: Raw Sensor (ADC) &bull; Converted (L) &bull; Filtered (L) &bull; Normalized (L)
            </p>
          </div>
        </div>

        {/* Live / Vehicle Identifier Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '12px',
            fontFamily: 'monospace',
            color: '#BAE6FD',
            border: '1px solid rgba(255,255,255,0.15)'
          }}>
            {selectedVehicle ? `${selectedVehicle.plate || selectedVehicle.name} (${selectedVehicle.imei || ''})` : 'Select Vehicle'}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 2. FILTER CONTROLS (Group, Vehicle, Date Range, Presets) */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-slate-900/80 p-4 md:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* A. Group Dropdown */}
          <div className="relative" ref={groupDropdownRef}>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Fleet Group
            </label>
            <button
              type="button"
              onClick={() => setIsGroupDropdownOpen(!isGroupDropdownOpen)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 transition-all shadow-xs"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="truncate">
                  {selectedGroupId === 'all'
                    ? `All Groups (${vehicles.length} Veh)`
                    : availableGroups.list.find(g => g.id === selectedGroupId)?.name || 'Selected Group'}
                </span>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
            </button>

            {isGroupDropdownOpen && (
              <div className="absolute z-50 left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search groups..."
                      value={groupSearch}
                      onChange={(e) => setGroupSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGroupId('all');
                      setIsGroupDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors ${
                      selectedGroupId === 'all' ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <span>All Groups</span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {vehicles.length}
                    </span>
                  </button>

                  {availableGroups.list
                    .filter(g => !groupSearch || g.name.toLowerCase().includes(groupSearch.toLowerCase()))
                    .map(g => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          setSelectedGroupId(g.id);
                          setIsGroupDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors ${
                          selectedGroupId === g.id ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <span className="truncate">{g.name}</span>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {g.count}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* B. Vehicle Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Select Vehicle
            </label>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 transition-all shadow-xs"
            >
              <div className="flex items-center gap-2 truncate">
                <span className={`w-2 h-2 rounded-full ${selectedVehicle?.status === 'online' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                <span className="truncate font-bold text-slate-900 dark:text-white">
                  {selectedVehicle?.plate || selectedVehicle?.name || 'Select Vehicle'}
                </span>
                {selectedVehicle?.name && selectedVehicle.plate && selectedVehicle.name !== selectedVehicle.plate && (
                  <span className="text-slate-400 truncate">({selectedVehicle.name})</span>
                )}
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
            </button>

            {isDropdownOpen && (
              <div className="absolute z-50 left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search plate, name, IMEI..."
                      value={vehicleSearch}
                      onChange={(e) => setVehicleSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto p-1 text-xs">
                  {filteredVehicles.length === 0 ? (
                    <div className="p-3 text-center text-slate-400 text-xs">No vehicles found</div>
                  ) : (
                    filteredVehicles.map(v => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setSelectedVehicle(v);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition-colors ${
                          selectedVehicle?.id === v.id ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <div className="truncate">
                          <span className="font-bold">{v.plate || v.name || 'Unnamed'}</span>
                          {v.name && v.plate && v.name !== v.plate && (
                            <span className="text-[11px] text-slate-400 ml-1.5">({v.name})</span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-2">
                          {v.imei ? v.imei.slice(-6) : ''}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* C. Date Pickers & Apply Button */}
          <div className="lg:col-span-2 flex flex-col sm:flex-row items-end gap-2.5">
            <div className="w-full sm:w-1/2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                From Date & Time
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="datetime-local"
                  value={customStart}
                  onChange={(e) => {
                    setCustomStart(e.target.value);
                    setActivePreset('custom');
                  }}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-800 dark:text-slate-100 font-medium focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="w-full sm:w-1/2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                To Date & Time
              </label>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="datetime-local"
                  value={customEnd}
                  onChange={(e) => {
                    setCustomEnd(e.target.value);
                    setActivePreset('custom');
                  }}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-800 dark:text-slate-100 font-medium focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="w-full sm:w-auto shrink-0 min-w-[130px]">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Interval
              </label>
              <div className="relative">
                <Sliders className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <select
                  value={selectedInterval}
                  onChange={(e) => setSelectedInterval(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-800 dark:text-slate-100 font-semibold focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  title="Select Sampling Interval"
                >
                  {INTERVAL_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => fetchTelemetryHistory()}
              disabled={loading}
              className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 shrink-0"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Apply
            </button>
          </div>
        </div>

        {/* Quick Date Range Preset Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Presets:</span>
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'last24h', label: 'Last 24h' },
              { id: 'last7d', label: '7 Days' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPreset(p.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activePreset === p.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Export Actions (Excel & PDF) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={!processedRows.length}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all disabled:opacity-50 shadow-xs"
              title="Download Excel / CSV SpreadSheet"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel / CSV
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              disabled={!processedRows.length}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold hover:bg-rose-100 transition-all disabled:opacity-50 shadow-xs"
              title="Download Branded PDF Audit Report"
            >
              <FileText className="w-3.5 h-3.5" />
              PDF Report
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 3. TELEMETRY HEALTH METRIC CARDS */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* Metric 1: Total Packets */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-50/70 via-white to-indigo-50/40 dark:from-slate-900/90 dark:via-slate-900/70 dark:to-blue-950/30 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/40 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 text-xs font-bold">
            <span>PACKETS AUDITED</span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mt-1.5 tracking-tight font-mono">
            {telemetrySummary.totalPackets.toLocaleString()}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span>High-res hardware stream</span>
          </div>
        </div>

        {/* Metric 2: Current Calibrated Fuel */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/40 dark:from-slate-900/90 dark:via-slate-900/70 dark:to-emerald-950/30 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 text-xs font-bold">
            <span>CURRENT / END FUEL</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <Fuel className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5 tracking-tight font-mono">
            {telemetrySummary.endFuel ? `${telemetrySummary.endFuel} L` : '—'}
          </div>
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
            <span>Capacity: {tankCapacity} L</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {tankCapacity > 0 ? `${Math.min(100, Math.round(((telemetrySummary.endFuel || 0) / tankCapacity) * 100))}%` : '—'}
            </span>
          </div>
        </div>

        {/* Metric 3: Sensor Dynamic Range */}
        <div className="relative overflow-hidden bg-gradient-to-br from-purple-50/70 via-white to-fuchsia-50/40 dark:from-slate-900/90 dark:via-slate-900/70 dark:to-purple-950/30 p-4 rounded-2xl border border-purple-100 dark:border-purple-900/40 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 text-xs font-bold">
            <span>RAW SENSOR RANGE</span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base md:text-lg font-black text-purple-600 dark:text-purple-400 mt-2 truncate font-mono">
            {telemetrySummary.minRaw} → {telemetrySummary.maxRaw}
          </div>
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
            Raw ADC / Volts stream
          </div>
        </div>

        {/* Metric 4: Max Speed & Motion */}
        <div className="relative overflow-hidden bg-gradient-to-br from-cyan-50/70 via-white to-sky-50/40 dark:from-slate-900/90 dark:via-slate-900/70 dark:to-cyan-950/30 p-4 rounded-2xl border border-cyan-100 dark:border-cyan-900/40 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 text-xs font-bold">
            <span>MAX SPEED</span>
            <div className="p-1.5 rounded-lg bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400">
              <Gauge className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-black text-cyan-600 dark:text-cyan-400 mt-1.5 tracking-tight font-mono">
            {telemetrySummary.maxSpeed} <span className="text-xs font-semibold text-slate-400 font-sans">km/h</span>
          </div>
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
            Avg: {telemetrySummary.avgSpeed} km/h
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 4. HIGH-DENSITY TELEMETRY AUDIT TABLE */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Table Filter Toolbar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by timestamp, speed, fuel..."
              value={tableSearch}
              onChange={(e) => {
                setTableSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
            {tableSearch && (
              <button
                type="button"
                onClick={() => setTableSearch('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end text-xs">
            {/* Sort Toggle */}
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
            >
              <ArrowUpDown className="w-3 h-3 text-slate-400" />
              <span>{sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
            </button>

            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5 text-slate-500 font-medium">
              <span>Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table Data Container */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
              <span className="text-sm font-semibold">Retrieving high-resolution telemetry packets...</span>
            </div>
          ) : paginatedRows.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Database className="w-10 h-10 opacity-30" />
              <span className="text-sm font-semibold">No telemetry packets found for this period</span>
              <span className="text-xs text-slate-400">Try adjusting your date range or selecting another vehicle</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr style={{ background: '#1E3A5F', color: '#F8FAFC' }}>
                  <th style={{ padding: '13px 12px', fontWeight: 700, width: '45px', textAlign: 'center', fontSize: '12px' }}>#</th>
                  <th style={{ padding: '13px 14px', fontWeight: 700, fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={13} color="#7DD3FC" /> Date & Time (IST)
                    </div>
                  </th>
                  <th style={{ padding: '13px 12px', fontWeight: 700, textAlign: 'center', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <Gauge size={13} color="#7DD3FC" /> Speed
                    </div>
                  </th>
                  <th style={{ padding: '13px 12px', fontWeight: 700, textAlign: 'center', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <Cpu size={13} color="#7DD3FC" /> Engine
                    </div>
                  </th>
                  <th style={{ padding: '13px 12px', fontWeight: 700, textAlign: 'right', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                      <Radio size={13} color="#C084FC" /> RAW SENSOR (ADC)
                    </div>
                  </th>
                  <th style={{ padding: '13px 12px', fontWeight: 700, textAlign: 'right', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                      <Fuel size={13} color="#94A3B8" /> CONVERTED (L)
                    </div>
                  </th>
                  <th style={{ padding: '13px 12px', fontWeight: 700, textAlign: 'right', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                      <Sliders size={13} color="#38BDF8" /> FILTERED (L)
                    </div>
                  </th>
                  <th style={{ padding: '13px 12px', fontWeight: 700, textAlign: 'right', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                      <TrendingUp size={13} color="#4ADE80" /> NORMALIZED (L)
                    </div>
                  </th>
                  <th style={{ padding: '13px 12px', fontWeight: 700, textAlign: 'right', fontSize: '12px' }}>
                    Odometer
                  </th>
                  <th style={{ padding: '13px 12px', fontWeight: 700, textAlign: 'center', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <Zap size={13} color="#FBBF24" /> Voltage
                    </div>
                  </th>
                  <th style={{ padding: '13px 14px', fontWeight: 700, fontSize: '12px' }}>
                    Event / Tag
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row, idx) => (
                  <tr
                    key={row.index}
                    style={{
                      borderBottom: '1px solid #F1F5F9',
                      background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA'
                    }}
                    className="hover:bg-blue-50/50 transition-colors"
                  >
                    {/* Index */}
                    <td style={{ padding: '11px 12px', textAlign: 'center' }} className="font-mono text-slate-400 text-[11px]">
                      {row.index}
                    </td>

                    {/* Timestamp */}
                    <td style={{ padding: '11px 14px' }} className="font-mono font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {row.timeFormatted}
                    </td>

                    {/* Speed */}
                    <td style={{ padding: '11px 12px', textAlign: 'center' }} className="whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 font-bold ${row.speed > 0 ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`}>
                        {row.speed} <span className="text-[10px] font-normal">km/h</span>
                      </span>
                    </td>

                    {/* Engine Ignition */}
                    <td style={{ padding: '11px 12px', textAlign: 'center' }} className="whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                        row.ignition
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}>
                        {row.ignition ? 'ON' : 'OFF'}
                      </span>
                    </td>

                    {/* 1. Raw Sensor Packet (ADC / Volts) */}
                    <td style={{ padding: '11px 12px', textAlign: 'right' }} className="font-mono font-bold whitespace-nowrap">
                      {row.rawSensor != null ? (
                        <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          {row.rawSensor}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* 2. Converted Fuel in Litres */}
                    <td style={{ padding: '11px 12px', textAlign: 'right' }} className="font-mono font-bold whitespace-nowrap">
                      {row.convertedFuel != null ? (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {row.convertedFuel} <span className="text-[10px] font-normal text-slate-400">L</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* 3. Filtered Fuel (Anti-slosh filter) */}
                    <td style={{ padding: '11px 12px', textAlign: 'right' }} className="font-mono font-bold whitespace-nowrap">
                      {row.filteredFuel != null ? (
                        <span className="px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/60">
                          {row.filteredFuel} <span className="text-[10px] font-normal text-slate-400">L</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* 4. Normalized Fuel (Physical ground truth) */}
                    <td style={{ padding: '11px 12px', textAlign: 'right' }} className="font-mono font-bold whitespace-nowrap">
                      {row.normalizedFuel != null ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 font-black">
                          {row.normalizedFuel} <span className="text-[10px] font-normal text-emerald-500">L</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Odometer */}
                    <td style={{ padding: '11px 12px', textAlign: 'right' }} className="font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {row.odometer !== '—' ? `${row.odometer} km` : '—'}
                    </td>

                    {/* Voltage */}
                    <td style={{ padding: '11px 12px', textAlign: 'center' }} className="font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {row.voltage}
                    </td>

                    {/* Event Tag */}
                    <td style={{ padding: '11px 14px' }} className="whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        row.eventType === 'refuel'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-black'
                          : row.eventType === 'theft'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-black'
                          : row.eventType === 'moving'
                          ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300'
                          : row.eventType === 'idle'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {row.eventTag}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Toolbar */}
        <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing <span className="font-bold text-slate-700 dark:text-slate-200">
              {filteredAndSortedRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </span> to <span className="font-bold text-slate-700 dark:text-slate-200">
              {Math.min(currentPage * pageSize, filteredAndSortedRows.length)}
            </span> of <span className="font-bold text-slate-700 dark:text-slate-200">
              {filteredAndSortedRows.length.toLocaleString()}
            </span> packets
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium disabled:opacity-40 hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-slate-600 dark:text-slate-400 font-semibold">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium disabled:opacity-40 hover:bg-slate-100 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
