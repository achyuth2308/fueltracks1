import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Database, Fuel, Search, Calendar, Clock, RefreshCw, Download,
  FileSpreadsheet, FileText, ChevronDown, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, Gauge, Zap, CheckCircle2, AlertTriangle,
  Radio, ShieldAlert, Cpu, ArrowUpDown, Filter, X
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

  // Date Range State
  const defaultToday = useMemo(() => getPresetRange('today'), []);
  const [customStart, setCustomStart] = useState(defaultToday.startStr);
  const [customEnd, setCustomEnd] = useState(defaultToday.endStr);
  const [activePreset, setActivePreset] = useState('today');

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
  const tankCapacity = useMemo(() => {
    if (!selectedVehicle) return 300;
    const meta = selectedVehicle.metadata || {};
    const cal = meta.fuelCalibration || meta.fuel || {};
    return parseFloat(cal.capacity ?? cal.tankCapacity ?? meta.tankCapacity ?? 300) || 300;
  }, [selectedVehicle]);

  const calibrateFuelValue = (rawInput, ptTime) => {
    if (rawInput === null || rawInput === undefined || isNaN(Number(rawInput))) {
      return null;
    }
    const num = Number(rawInput);
    if (!selectedVehicle) return num;

    const meta = selectedVehicle.metadata || {};
    const cal = meta.fuelCalibration || meta.fuel || {};
    const calTime = cal.calibratedAt || cal.updatedAt || meta.calibratedAt;
    const isAfterCalibration = !calTime || !ptTime || new Date(ptTime) >= new Date(calTime);

    if (cal.isCalibrated === false && !meta.fuelCalibrationPoints?.length) {
      return Math.round(num * 10) / 10;
    }

    const sCalType = cal.calibrateType || 'Auto';

    // 1. Direct Scaling (Technoton / CAN / BLE Percentage)
    if (sCalType === 'Direct') {
      const mult = parseFloat(cal.directMultiplier ?? 1.0) || 1.0;
      const offset = parseFloat(cal.directOffset ?? 0.0) || 0.0;
      const unit = cal.directUnit || 'Litres';
      const scaled = (num * mult) + offset;
      if (unit === 'Percentage' && tankCapacity > 0) {
        return Math.max(0, Math.min(tankCapacity, Math.round(((scaled / 100) * tankCapacity) * 10) / 10));
      }
      return Math.max(0, tankCapacity > 0 ? Math.min(tankCapacity, Math.round(scaled * 10) / 10) : Math.round(scaled * 10) / 10);
    }

    // 2. Multi-Point Table (Piecewise Linear Interpolation)
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
        if (isAfterCalibration && num <= sorted[sorted.length - 1].ltr * 1.1) {
          return Math.round(num * 10) / 10;
        }
        if (num <= sorted[0].adc) return sorted[0].ltr;
        if (num >= sorted[sorted.length - 1].adc) return sorted[sorted.length - 1].ltr;

        for (let i = 0; i < sorted.length - 1; i++) {
          const p1 = sorted[i];
          const p2 = sorted[i + 1];
          if (num >= p1.adc && num <= p2.adc) {
            const range = p2.adc - p1.adc;
            const ratio = range !== 0 ? (num - p1.adc) / range : 0;
            const val = p1.ltr + ratio * (p2.ltr - p1.ltr);
            return Math.max(0, Math.min(tankCapacity, Math.round(val * 10) / 10));
          }
        }
      }
    }

    // 3. Auto Calibration (minAdc -> maxAdc)
    const emptyAdc = parseFloat(cal.minAdc ?? meta.fuelEmptyAdc ?? 0);
    const fullAdc = parseFloat(cal.maxAdc ?? meta.fuelFullAdc ?? 4095);
    if (tankCapacity > 0 && fullAdc !== emptyAdc && !isNaN(emptyAdc) && !isNaN(fullAdc)) {
      if (num > tankCapacity * 1.15 || !isAfterCalibration) {
        let frac = (num - emptyAdc) / (fullAdc - emptyAdc);
        frac = Math.max(0, Math.min(1, frac));
        return Math.round((tankCapacity * frac) * 10) / 10;
      }
    }

    if (num > 1000) return Math.round((num / 10) * 10) / 10;
    return Math.max(0, Math.min(tankCapacity, Math.round(num * 10) / 10));
  };

  // Process Telemetry Rows with Calibration, 5-Point Median + EMA, and Normalization
  const processedRows = useMemo(() => {
    if (!historyPoints.length) return [];

    // Sort chronologically
    const sorted = [...historyPoints].sort((a, b) => new Date(a.device_time) - new Date(b.device_time));

    // Raw calibrated values
    const rawFuels = sorted.map(pt => pt.fuel != null ? calibrateFuelValue(pt.fuel, pt.device_time) : null);

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
      const isEngineOn = rawSpeed > 6.0 || ign; // 6 km/h threshold
      const fVal = filteredFuels[i];

      if (fVal != null) {
        const diff = fVal - currentNorm;
        // Refuel
        if (diff >= refuelThreshold && rawSpeed <= 6.0) {
          currentNorm = fVal;
        }
        // Theft
        else if (diff <= -theftThreshold && !isEngineOn) {
          currentNorm = fVal;
        }
        // Stationary / Idling
        else if (rawSpeed <= 6.0) {
          if (Math.abs(diff) < refuelThreshold) {
            currentNorm = fVal;
          }
        }
        // Moving (> 6 km/h)
        else {
          if (Math.abs(diff) < refuelThreshold) {
            currentNorm = (0.85 * currentNorm) + (0.15 * fVal);
          } else if (fVal < currentNorm) {
            currentNorm = fVal;
          }
        }
      }
      normalizedFuels[i] = Math.max(0, Math.min(tankCapacity, Math.round(currentNorm * 10) / 10));
    }

    // Assemble enriched rows
    return sorted.map((pt, idx) => {
      const speed = parseFloat(pt.speed) || 0;
      const ign = pt.ignition === true || pt.ignition === 'true' || pt.ignition === 1;
      const rawSensor = pt.fuel != null ? Number(pt.fuel) : null;
      const converted = rawFuels[idx];
      const normalized = normalizedFuels[idx];
      const prevConverted = idx > 0 ? rawFuels[idx - 1] : null;
      const delta = (converted != null && prevConverted != null) ? Math.round((converted - prevConverted) * 10) / 10 : 0;

      // Classify event tag
      let eventTag = 'Normal';
      let eventType = 'normal';
      if (delta >= refuelThreshold) {
        eventTag = `Refuel (+${delta}L)`;
        eventType = 'refuel';
      } else if (delta <= -theftThreshold && !ign) {
        eventTag = `Theft (${delta}L)`;
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
        normalizedFuel: normalized,
        delta: delta,
        odometer: pt.odometer != null ? Math.round(Number(pt.odometer) * 10) / 10 : '—',
        voltage: pt.voltage != null ? Math.round(Number(pt.voltage) * 10) / 10 : (pt.battery != null ? `${pt.battery}V` : '—'),
        battery: pt.backup_battery ?? pt.battery_level ?? '—',
        eventTag: eventTag,
        eventType: eventType,
        lat: pt.lat,
        lng: pt.lng
      };
    });
  }, [historyPoints, tankCapacity]);

  // Telemetry Health Metrics Summary
  const telemetrySummary = useMemo(() => {
    if (!processedRows.length) {
      return { totalPackets: 0, minRaw: 0, maxRaw: 0, endFuel: 0, maxSpeed: 0, avgSpeed: 0 };
    }
    const rawVals = processedRows.map(r => r.rawSensor).filter(v => v != null);
    const speeds = processedRows.map(r => r.speed);
    const validFuels = processedRows.map(r => r.convertedFuel).filter(v => v != null);

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

  // Excel / CSV Export
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
      'Normalized Fuel (Liters)': r.normalizedFuel != null ? r.normalizedFuel : '—',
      'Delta Change (L)': r.delta !== 0 ? r.delta : 0,
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

  // PDF Report Export
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
      'Normalized (L)', 'Delta (L)', 'Odometer', 'Voltage', 'Event Tag'
    ];

    const tableRows = processedRows.map(r => [
      r.index,
      r.timeFormatted,
      `${r.speed} km/h`,
      r.ignition ? 'ON' : 'OFF',
      r.rawSensor != null ? r.rawSensor : '—',
      r.convertedFuel != null ? `${r.convertedFuel} L` : '—',
      r.normalizedFuel != null ? `${r.normalizedFuel} L` : '—',
      r.delta > 0 ? `+${r.delta}` : (r.delta < 0 ? `${r.delta}` : '0'),
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
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto min-h-screen">
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 1. TOP HEADER & TELEMETRICS BREADCRUMB */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900/80 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Fuel Raw Data
                </h1>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60">
                  Precision Audit
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Inspect raw hardware packets (ADC, Volts, Serial) vs calibrated and normalized physical fuel
              </p>
            </div>
          </div>
        </div>

        {/* User / Organization Profile Badge */}
        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/60">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
            {user?.name ? user.name.slice(0, 2).toUpperCase() : 'FT'}
          </div>
          <div className="text-left">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">
              {user?.name || 'FUELTESTING'}
            </div>
            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {user?.role || 'Customer'}
            </div>
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
        <div className="bg-white dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold">
            <span>PACKETS AUDITED</span>
            <Radio className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mt-1">
            {telemetrySummary.totalPackets.toLocaleString()}
          </div>
          <div className="text-[11px] font-medium text-slate-400 mt-0.5">
            100% Raw device stream
          </div>
        </div>

        {/* Metric 2: Current Calibrated Fuel */}
        <div className="bg-white dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold">
            <span>CURRENT / END FUEL</span>
            <Fuel className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl md:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {telemetrySummary.endFuel ? `${telemetrySummary.endFuel} L` : '—'}
          </div>
          <div className="text-[11px] font-medium text-slate-400 mt-0.5">
            Capacity: {tankCapacity} Litres
          </div>
        </div>

        {/* Metric 3: Sensor Dynamic Range */}
        <div className="bg-white dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold">
            <span>SENSOR RANGE (RAW)</span>
            <Cpu className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-base md:text-lg font-black text-purple-600 dark:text-purple-400 mt-1.5 truncate font-mono">
            {telemetrySummary.minRaw} → {telemetrySummary.maxRaw}
          </div>
          <div className="text-[11px] font-medium text-slate-400 mt-0.5">
            Min to max sensor packet
          </div>
        </div>

        {/* Metric 4: Max Speed & Motion */}
        <div className="bg-white dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold">
            <span>MAX SPEED</span>
            <Gauge className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="text-xl md:text-2xl font-black text-cyan-600 dark:text-cyan-400 mt-1">
            {telemetrySummary.maxSpeed} <span className="text-xs font-semibold text-slate-400">km/h</span>
          </div>
          <div className="text-[11px] font-medium text-slate-400 mt-0.5">
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
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3 w-12 text-center">#</th>
                  <th className="py-3 px-3">Date & Time (IST)</th>
                  <th className="py-3 px-3 text-center">Speed</th>
                  <th className="py-3 px-3 text-center">Engine</th>
                  <th className="py-3 px-3 text-right">Raw Packet</th>
                  <th className="py-3 px-3 text-right">Converted (L)</th>
                  <th className="py-3 px-3 text-right">Normalize (L)</th>
                  <th className="py-3 px-3 text-center">Delta (L)</th>
                  <th className="py-3 px-3 text-right">Odometer</th>
                  <th className="py-3 px-3 text-center">Voltage</th>
                  <th className="py-3 px-3">Event / Tag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {paginatedRows.map((row) => (
                  <tr
                    key={row.index}
                    className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Index */}
                    <td className="py-2.5 px-3 text-center font-mono text-slate-400 text-[11px]">
                      {row.index}
                    </td>

                    {/* Timestamp */}
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {row.timeFormatted}
                    </td>

                    {/* Speed */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 font-bold ${row.speed > 0 ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`}>
                        {row.speed} <span className="text-[10px] font-normal">km/h</span>
                      </span>
                    </td>

                    {/* Engine Ignition */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                        row.ignition
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}>
                        {row.ignition ? 'ON' : 'OFF'}
                      </span>
                    </td>

                    {/* Raw Sensor Packet */}
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {row.rawSensor != null ? (
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
                          {row.rawSensor}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Converted Fuel in Litres */}
                    <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                      {row.convertedFuel != null ? (
                        <span className="text-blue-600 dark:text-blue-400">
                          {row.convertedFuel} <span className="text-[10px] font-normal text-slate-400">L</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Normalized Fuel */}
                    <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                      {row.normalizedFuel != null ? (
                        <span className="text-rose-600 dark:text-rose-400">
                          {row.normalizedFuel} <span className="text-[10px] font-normal text-slate-400">L</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Delta Change */}
                    <td className="py-2.5 px-3 text-center font-mono whitespace-nowrap">
                      {row.delta > 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-bold">
                          <TrendingUp className="w-3 h-3" /> +{row.delta}
                        </span>
                      ) : row.delta < 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400 font-bold">
                          <TrendingDown className="w-3 h-3" /> {row.delta}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">0</span>
                      )}
                    </td>

                    {/* Odometer */}
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {row.odometer !== '—' ? `${row.odometer} km` : '—'}
                    </td>

                    {/* Voltage */}
                    <td className="py-2.5 px-3 text-center font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {row.voltage}
                    </td>

                    {/* Event Tag */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
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
