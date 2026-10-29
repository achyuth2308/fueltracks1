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
  Check,
  Users,
  Database,
  RotateCcw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
  ReferenceDot,
  ReferenceArea
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

// Helper to format date-time string in DD/MM/YYYY hh:mm A
function formatDisplayDDMMYYYY(val) {
  if (!val) return 'DD/MM/YYYY --:--';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${day}/${month}/${year} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  } catch (e) {
    return val;
  }
}

export default function FuelAnalyticsPage() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [fetchingVehicles, setFetchingVehicles] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  
  // Auto-scroll ref and list container ref for vehicle dropdown
  const activeVehicleRef = useRef(null);
  const vehicleListContainerRef = useRef(null);

  // Searchable dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  // Auto-scroll directly to the currently selected vehicle when opening dropdown
  useEffect(() => {
    if (isDropdownOpen) {
      const timer = setTimeout(() => {
        if (activeVehicleRef.current) {
          activeVehicleRef.current.scrollIntoView({
            block: 'center',
            behavior: 'smooth'
          });
        }
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isDropdownOpen]);

  // Group selection state
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const groupDropdownRef = useRef(null);

  // Time filters & Sampling Interval
  const [activePreset, setActivePreset] = useState('today');
  const [customStart, setCustomStart] = useState(() => getPresetRange('today').startStr);
  const [customEnd, setCustomEnd] = useState(() => getPresetRange('today').endStr);
  const [selectedInterval, setSelectedInterval] = useState('raw');

  // Date input refs for reliable 100% calendar popup click
  const startInputRef = useRef(null);
  const endInputRef = useRef(null);

  // Helper for max datetime limit (current local time)
  const getMaxDateTimeLocal = () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  };
  const maxDateTime = getMaxDateTimeLocal();

  // Data state
  const [loading, setLoading] = useState(false);
  const [historyPoints, setHistoryPoints] = useState([]);
  const [error, setError] = useState(null);

  // Chart view toggles (Filtered Fuel Data selected by default)
  const [showAllFuel, setShowAllFuel] = useState(false);
  const [showFilteredFuel, setShowFilteredFuel] = useState(true);
  const [showNormalize, setShowNormalize] = useState(false);
  const [showEngine, setShowEngine] = useState(false);
  const [showSpeed, setShowSpeed] = useState(false);

  // Dedicated Event Layers & Intelligence (Refill, Theft, Consumption)
  const [showRefillEvents, setShowRefillEvents] = useState(true);
  const [showTheftEvents, setShowTheftEvents] = useState(true);
  const [showConsumptionLayer, setShowConsumptionLayer] = useState(true);

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

  // 1. Fetch all user vehicles and groups on mount
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
          if (list.length > 0 && !selectedVehicle) {
            const initialV = list.find(v => v.metadata?.fuel || v.metadata?.fuelCalibration || v.fuel != null) || list[0];
            setSelectedVehicle(initialV);
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

  // 2. Fetch History Points when selected vehicle or date changes
  const fetchVehicleFuelData = async (overrideStart, overrideEnd) => {
    if (!selectedVehicle?.id) return;
    setError(null);

    const s = overrideStart || customStart;
    const e = overrideEnd || customEnd;

    // Strict boundary validation
    const sDate = new Date(s);
    const eDate = new Date(e);
    const now = new Date();

    if (sDate > eDate) {
      setError('"From" date cannot be after "To" date.');
      return;
    }
    if (sDate > now) {
      setError('Selected date cannot be in the future.');
      return;
    }

    setLoading(true);

    try {
      let startIso, endIso;
      try {
        startIso = sDate.toISOString();
        endIso = eDate.toISOString();
      } catch (err) {
        const p = getPresetRange('today');
        startIso = p.startDate;
        endIso = p.endDate;
      }

      // Fetch full high-resolution history with zero-overhead smart sampling across entire date range
      const res = await axiosInstance.get(`/api/vehicles/${selectedVehicle.id}/history`, {
        params: {
          startDate: startIso,
          endDate: endIso,
          sample: true,
          noCount: true,
          maxPoints: 500
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

  const handleSelectPreset = (presetId) => {
    setActivePreset(presetId);
    const range = getPresetRange(presetId);
    setCustomStart(range.startStr);
    setCustomEnd(range.endStr);
    fetchVehicleFuelData(range.startStr, range.endStr);
  };

  useEffect(() => {
    fetchVehicleFuelData();
  }, [selectedVehicle?.id]);

  // Available groups strictly matching authorized user groups from API (same as Dashboard)
  const availableGroups = useMemo(() => {
    // 1. If user has official groups from /api/admin/groups, use them exclusively
    if (groups && groups.length > 0) {
      const list = groups.map(g => {
        const targetName = (g.name || '').trim().toLowerCase();
        const count = vehicles.filter(v =>
          (Array.isArray(v.groups) && v.groups.some(vg => String(vg.id) === String(g.id) || (vg.name && vg.name.trim().toLowerCase() === targetName))) ||
          (Array.isArray(g.vehicles) && g.vehicles.some(gv => gv.id === v.id)) ||
          (v.group_id && String(v.group_id) === String(g.id)) ||
          (v.group_name && v.group_name.split(',').map(s => s.trim().toLowerCase()).includes(targetName))
        ).length;

        return {
          id: String(g.id),
          name: g.name,
          count
        };
      }).sort((a, b) => a.name.localeCompare(b.name));

      // Calculate unassigned vehicles (vehicles that do not match ANY of the user's groups)
      const assignedIds = new Set();
      groups.forEach(g => {
        const targetName = (g.name || '').trim().toLowerCase();
        vehicles.forEach(v => {
          const matches = (
            (Array.isArray(v.groups) && v.groups.some(vg => String(vg.id) === String(g.id) || (vg.name && vg.name.trim().toLowerCase() === targetName))) ||
            (Array.isArray(g.vehicles) && g.vehicles.some(gv => gv.id === v.id)) ||
            (v.group_id && String(v.group_id) === String(g.id)) ||
            (v.group_name && v.group_name.split(',').map(s => s.trim().toLowerCase()).includes(targetName))
          );
          if (matches) assignedIds.add(v.id);
        });
      });
      const unassignedCount = vehicles.filter(v => !assignedIds.has(v.id)).length;

      return { list, unassignedCount };
    }

    // 2. Fallback: If user has 0 assigned groups from API, discover from vehicles
    const map = new Map();
    vehicles.forEach(v => {
      if (Array.isArray(v.groups) && v.groups.length > 0) {
        v.groups.forEach(vg => {
          if (vg && (vg.id || vg.name)) {
            const id = String(vg.id || vg.name);
            if (!map.has(id)) {
              map.set(id, { id, name: vg.name || 'Unnamed Group', count: 0 });
            }
          }
        });
      } else if (v.group_name) {
        v.group_name.split(',').forEach(gn => {
          const clean = gn.trim();
          if (clean) {
            const key = clean.toLowerCase();
            const existing = Array.from(map.values()).find(m => m.name.toLowerCase() === key);
            if (!existing) {
              map.set(clean, { id: clean, name: clean, count: 0 });
            }
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

  // Vehicles belonging to the selected group
  const vehiclesInSelectedGroup = useMemo(() => {
    if (selectedGroupId === 'all') return vehicles;

    if (selectedGroupId === '__unassigned__') {
      const assignedIds = new Set();
      availableGroups.list.forEach(g => {
        const targetName = g.name.trim().toLowerCase();
        vehicles.forEach(v => {
          const matches = (
            (Array.isArray(v.groups) && v.groups.some(vg => String(vg.id) === String(g.id) || (vg.name && vg.name.trim().toLowerCase() === targetName))) ||
            (v.group_id && String(v.group_id) === String(g.id)) ||
            (v.group_name && v.group_name.split(',').map(s => s.trim().toLowerCase()).includes(targetName))
          );
          if (matches) assignedIds.add(v.id);
        });
      });
      return vehicles.filter(v => !assignedIds.has(v.id));
    }

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
  }, [vehicles, selectedGroupId, availableGroups]);

  // Search filtered vehicles (within selected group)
  const filteredVehicles = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return vehiclesInSelectedGroup;
    return vehiclesInSelectedGroup.filter(v => 
      (v.plate && v.plate.toLowerCase().includes(q)) ||
      (v.name && v.name.toLowerCase().includes(q)) ||
      (v.imei && v.imei.toLowerCase().includes(q))
    );
  }, [vehiclesInSelectedGroup, searchQuery]);

  // Filtered groups inside group dropdown search
  const filteredGroupsList = useMemo(() => {
    const q = groupSearchQuery.toLowerCase().trim();
    if (!q) return availableGroups.list;
    return availableGroups.list.filter(g => g.name.toLowerCase().includes(q));
  }, [availableGroups.list, groupSearchQuery]);

  // Selected group label
  const selectedGroupLabel = useMemo(() => {
    if (selectedGroupId === 'all') return 'All Groups';
    if (selectedGroupId === '__unassigned__') return 'Unassigned';
    const match = availableGroups.list.find(g => g.id === selectedGroupId);
    return match ? match.name : 'All Groups';
  }, [selectedGroupId, availableGroups.list]);

  // Handle group selection change
  const handleSelectGroup = (groupId) => {
    setSelectedGroupId(groupId);
    setIsGroupDropdownOpen(false);
    setGroupSearchQuery('');

    let nextVehicles = vehicles;
    if (groupId === '__unassigned__') {
      nextVehicles = vehicles.filter(v => (!v.groups || v.groups.length === 0) && !v.group_name && !v.group_id);
    } else if (groupId !== 'all') {
      const currentGroup = availableGroups.list.find(g => g.id === groupId);
      const targetName = currentGroup?.name?.trim()?.toLowerCase();
      nextVehicles = vehicles.filter(v => {
        const matchArray = Array.isArray(v.groups) && v.groups.some(vg => 
          String(vg.id) === String(groupId) || (targetName && vg.name?.trim()?.toLowerCase() === targetName)
        );
        const matchId = v.group_id && String(v.group_id) === String(groupId);
        const matchName = targetName && v.group_name && v.group_name.split(',').map(s => s.trim().toLowerCase()).includes(targetName);
        return matchArray || matchId || matchName;
      });
    }

    // Always select the first / default vehicle present in the newly selected group
    if (nextVehicles.length > 0) {
      const bestVehicle = nextVehicles.find(v => v.metadata?.fuel || v.metadata?.fuelCalibration || v.current_fuel != null) || nextVehicles[0];
      setSelectedVehicle(bestVehicle);
    } else {
      setSelectedVehicle(null);
      setHistoryPoints([]);
    }
  };

  // Tank size from vehicle metadata (supporting multi-tank aggregation)
  const tankCapacity = useMemo(() => {
    const meta = selectedVehicle?.metadata || {};
    const fuelCal = meta.fuelCalibration || meta.fuel || {};
    if (fuelCal.tanks && typeof fuelCal.tanks === 'object') {
      const tankValues = Object.values(fuelCal.tanks);
      if (tankValues.length > 0) {
        const sumCap = tankValues.reduce((sum, t) => sum + (parseFloat(t.tankSize) || 0), 0);
        if (sumCap > 0) return Math.round(sumCap * 10) / 10;
      }
    }
    const size = fuelCal.tankSize || meta.tankSize || meta.tankCapacity || 400;
    return parseFloat(size) || 400;
  }, [selectedVehicle]);

  // Thresholds from Edit Calibration: minFilling (refuels) & minTheft (thefts/drains)
  const refuelThreshold = useMemo(() => {
    const meta = selectedVehicle?.metadata || {};
    const fuelCal = meta.fuelCalibration || meta.fuel || {};
    return parseFloat(fuelCal.minFilling) || 9.0;
  }, [selectedVehicle]);

  const theftThreshold = useMemo(() => {
    const meta = selectedVehicle?.metadata || {};
    const fuelCal = meta.fuelCalibration || meta.fuel || {};
    return parseFloat(fuelCal.minTheft) || 5.0;
  }, [selectedVehicle]);

  // Calibration helper if fuel is raw ADC in points
  const calibrateFuelValue = (rawFuel, pointDeviceTime) => {
    if (rawFuel == null || isNaN(rawFuel)) return null;
    const num = parseFloat(rawFuel);

    const meta = selectedVehicle?.metadata || {};
    const cal = meta.fuelCalibration || meta.fuel || {};
    const calUpdatedAt = cal.updatedAt ? new Date(cal.updatedAt).getTime() : 0;
    const ptTime = pointDeviceTime ? new Date(pointDeviceTime).getTime() : 0;

    // If point was recorded after calibration was configured AND is within reasonable tank limits,
    // it was already calibrated by the backend.
    const isAfterCalibration = calUpdatedAt > 0 && ptTime >= calUpdatedAt;
    if (isAfterCalibration && num <= tankCapacity * 1.15) {
      return Math.round(num * 10) / 10;
    }

    const sCalType = cal.calibrateType || 'Auto';

    // 1. Direct Calibration (Technoton / Jointech / BLE direct)
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

    // 2. Manual Calibration (Points table)
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
        // If already after calibration and value is in Litres range, don't re-run through ADC curve
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

    // Fallback: If value is ridiculously large (> 1000) and no points exist
    if (num > 1000) return Math.round((num / 10) * 10) / 10;
    return Math.max(0, Math.min(tankCapacity, Math.round(num * 10) / 10));
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

    // Sort chronologically (Full dataset)
    const sortedAll = [...historyPoints].sort((a, b) => new Date(a.device_time) - new Date(b.device_time));

    // Optional Sampling Interval bucketing (for chart visualization)
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
          // Keep the latest point in each bucket to represent the state at the interval
          bucketMap.set(bucketKey, pt);
        }
        sorted = Array.from(bucketMap.values()).sort((a, b) => new Date(a.device_time) - new Date(b.device_time));
      }
    }

    // 1. First pass: extract calibrated raw sensor fuel and motion states
    const rawFuels = sorted.map(pt => pt.fuel != null ? calibrateFuelValue(pt.fuel, pt.device_time) : null);

    // 2. Speed-Adaptive Anti-Slosh Filter: Window 5 Median + Conditional EMA -> "Filtered Fuel Data"
    // When stationary (speed <= 6 km/h): zero road slosh. Median tracks real refuel/drain immediately without 12-min lag.
    // When moving (speed > 6 km/h): apply anti-slosh exponential smoothing to reject highway road ripples.
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
        const spd = parseFloat(sorted[i]?.speed) || 0;

        if (lastEma == null) {
          lastEma = median;
        } else if (spd <= 6.0) {
          // Stationary at bunk or parked: no road slosh waves.
          // If fuel changes meaningfully (refuel or drain), track median directly so no 12-min lag occurs.
          // For tiny settling variations (< 3L), gently converge.
          if (Math.abs(median - lastEma) >= 3.0) {
            lastEma = median;
          } else {
            lastEma = (0.5 * median) + (0.5 * lastEma);
          }
        } else {
          // Moving on road: heavy EMA filter rejects highway liquid slosh waves
          lastEma = (0.25 * median) + (0.75 * lastEma);
        }
        filteredFuels[i] = Math.max(0, Math.min(tankCapacity, Math.round(lastEma * 10) / 10));
      } else {
        filteredFuels[i] = lastEma;
      }
    }

    // 3. Physical Reality Normalization (Consumption-Constrained Monotonic Curve) -> "Normalize"
    const normalizedFuels = new Array(sorted.length).fill(null);
    const refuelEvents = [];
    const dropEvents = [];
    const refuelPointsMap = new Map();
    const dropPointsMap = new Map();
    const refuelIntervalMap = new Map();
    const dropIntervalMap = new Map();
    
    // Find initial baseline fuel
    const firstValidFiltered = filteredFuels.find(f => f != null);
    let currentNormalized = firstValidFiltered != null ? firstValidFiltered : 0;

    // Helper: Is the vehicle STOPPED (speed=0 or GPS jitter <= 6 km/h)?
    // Refills happen at speed=0 regardless of ignition (people fill with engine running).
    const isStopped = (pt) => (parseFloat(pt.speed) || 0) <= 6.0;

    // Helper: Is ignition OFF?
    const isIgnOff = (pt) => !(pt.ignition === true || pt.ignition === 'true' || pt.ignition === 1);

    // Helper: Is the vehicle moving (speed > 6 km/h)?
    const isMoving = (pt) => (parseFloat(pt.speed) || 0) > 6.0;

    // Pre-compute ignition-state transition pairs for slant-parking theft detection.
    // For theft: compare avg fuel in last 5 min before ignition OFF
    //            vs avg fuel in first 5 min after next ignition ON.
    //            If drop >= theftThreshold AND fuel stays low after start -> real theft.
    //            If fuel recovers after vehicle moves -> slant parking -> NOT theft.
    const PRE_POST_WINDOW = 5 * 60 * 1000; // 5-minute observation window

    const ignOffTransitionFuel = new Map(); // idx -> avg pre-park fuel
    const ignOnTransitionFuel  = new Map(); // idx -> avg post-start fuel

    for (let i = 1; i < sorted.length; i++) {
      const prevIgnOn = sorted[i-1].ignition === true || sorted[i-1].ignition === 'true' || sorted[i-1].ignition === 1;
      const currIgnOn = sorted[i].ignition === true || sorted[i].ignition === 'true' || sorted[i].ignition === 1;
      const tCurr = new Date(sorted[i].device_time).getTime();

      // Ignition ON -> OFF transition (parking event)
      if (prevIgnOn && !currIgnOn) {
        // Collect fuel values from last 5 min before this point (while engine was ON and stopped)
        const preFuels = [];
        for (let j = i - 1; j >= 0; j--) {
          const tJ = new Date(sorted[j].device_time).getTime();
          if (tCurr - tJ > PRE_POST_WINDOW) break;
          if (filteredFuels[j] != null) preFuels.push(filteredFuels[j]);
        }
        if (preFuels.length > 0) {
          const avg = preFuels.reduce((s, v) => s + v, 0) / preFuels.length;
          ignOffTransitionFuel.set(i, avg);
        }
      }

      // Ignition OFF -> ON transition (engine start event)
      if (!prevIgnOn && currIgnOn) {
        // Collect fuel values from first 5 min after this point
        const postFuels = [];
        for (let j = i; j < sorted.length; j++) {
          const tJ = new Date(sorted[j].device_time).getTime();
          if (tJ - tCurr > PRE_POST_WINDOW) break;
          if (filteredFuels[j] != null) postFuels.push(filteredFuels[j]);
        }
        if (postFuels.length > 0) {
          const avg = postFuels.reduce((s, v) => s + v, 0) / postFuels.length;
          ignOnTransitionFuel.set(i, avg);
        }
      }
    }

    // Build a quick lookup: for each ignition-OFF transition, find the NEXT ignition-ON transition
    const offToOnPairs = []; // [{offIdx, onIdx, preFuel, postFuel}]
    const offIdxs = Array.from(ignOffTransitionFuel.keys()).sort((a,b) => a - b);
    const onIdxs  = Array.from(ignOnTransitionFuel.keys()).sort((a,b) => a - b);
    for (const offIdx of offIdxs) {
      const nextOnIdx = onIdxs.find(idx => idx > offIdx);
      if (nextOnIdx !== undefined) {
        offToOnPairs.push({
          offIdx,
          onIdx: nextOnIdx,
          preFuel: ignOffTransitionFuel.get(offIdx),
          postFuel: ignOnTransitionFuel.get(nextOnIdx)
        });
      }
    }

    // Mark theft-confirmed windows: between offIdx and onIdx where drop > theftThreshold
    // (will be checked later in the main loop)
    const confirmedTheftWindows = new Set(); // Set of offIdx values that are real thefts
    for (const pair of offToOnPairs) {
      const drop = pair.preFuel - pair.postFuel;
      if (drop >= theftThreshold) {
        confirmedTheftWindows.add(pair.offIdx);
      }
    }

    for (let i = 0; i < sorted.length; i++) {
      const pt = sorted[i];
      const rawSpeed = parseFloat(pt.speed) || 0;
      const ign = pt.ignition === true || pt.ignition === 'true' || pt.ignition === 1;
      const fVal = filteredFuels[i];

      if (fVal != null) {
        const diff = fVal - currentNormalized;
        let rampHandled = false;

        // ================================================================
        // A. REFUEL DETECTION
        // Rule: speed must be 0 (stationary, speed <= 6 km/h with GPS jitter).
        // Ignition state doesn't matter — some drivers fill with engine running.
        // The fuel must show a sustained RISE >= refuelThreshold.
        // ================================================================
        if (rawSpeed <= 6.0 && diff >= 2.0) {
          const tStart = new Date(pt.device_time).getTime();
          let maxRampVal = fVal;
          let maxRampIdx = i;
          let k = i + 1;

          while (k < sorted.length) {
            const nextPt = sorted[k];
            const nextSpd = parseFloat(nextPt.speed) || 0;
            const nextTime = new Date(nextPt.device_time).getTime();

            // Time window: 25 minutes max for a refueling stop
            if ((nextTime - tStart) > 25 * 60 * 1000) break;

            // Vehicle moved -> stationary refueling session has ended
            if (nextSpd > 6.0) break;

            const nextF = filteredFuels[k];
            if (nextF != null && nextF > maxRampVal) {
              maxRampVal = nextF;
              maxRampIdx = k;
            }
            k++;
          }

          const cumRise = maxRampVal - currentNormalized;
          if (cumRise >= refuelThreshold) {
            // Post-ramp stability: fuel must stay elevated (protects against single-packet noise spikes)
            let isStable = true;
            let stableChecks = 0;
            for (let s = maxRampIdx + 1; s < sorted.length && stableChecks < 5; s++) {
              const sf = filteredFuels[s];
              if (sf == null) continue;
              if (sf < currentNormalized + (cumRise * 0.5)) {
                isStable = false;
                break;
              }
              stableChecks++;
            }

            if (isStable) {
              rampHandled = true;
              const refuelLiters = Math.round(cumRise * 10) / 10;
              const tEnd = new Date(sorted[maxRampIdx].device_time).getTime();
              const durMin = Math.max(1, Math.round((tEnd - tStart) / 60000));
              const startFuelVal = Math.round(currentNormalized * 10) / 10;
              const endFuelVal = Math.round(maxRampVal * 10) / 10;

              const refuelObj = {
                id: refuelEvents.length + 1,
                startIdx: i,
                endIdx: maxRampIdx,
                startTime: formatIST(pt.device_time),
                endTime: formatIST(sorted[maxRampIdx].device_time),
                startTimeStr: formatIST(pt.device_time),
                endTimeStr: formatIST(sorted[maxRampIdx].device_time),
                startDate: formatDateIST(pt.device_time),
                endDate: formatDateIST(sorted[maxRampIdx].device_time),
                startFuel: startFuelVal,
                endFuel: endFuelVal,
                liters: refuelLiters,
                level: endFuelVal,
                durationMin: durMin
              };
              refuelEvents.push(refuelObj);
              refuelPointsMap.set(maxRampIdx, refuelObj);

              // Map all points in this refill interval
              for (let fillIdx = i; fillIdx <= maxRampIdx; fillIdx++) {
                refuelIntervalMap.set(fillIdx, refuelObj);
                if (filteredFuels[fillIdx] != null) {
                  currentNormalized = Math.max(currentNormalized, filteredFuels[fillIdx]);
                }
                normalizedFuels[fillIdx] = Math.max(0, Math.min(tankCapacity, Math.round(currentNormalized * 10) / 10));
              }
              currentNormalized = maxRampVal;
              i = maxRampIdx;
              continue;
            }
          }
        }

        // ================================================================
        // B. THEFT / SIPHON DETECTION
        // Uses pre-parking vs post-start fuel comparison to eliminate
        // slant-parking false positives:
        //   - Slant: parked on slope → fuel drops → vehicle moves → fuel recovers → NOT theft
        //   - Theft: parked → fuel drops → vehicle starts → fuel stays low → REAL theft
        //
        // Condition: speed==0, ignition OFF, sustained drop >= theftThreshold,
        //            AND confirmed by the pre/post ign transition pair.
        // ================================================================
        if (!rampHandled && rawSpeed <= 6.0 && !ign && diff <= -2.0) {
          // Check if this point falls in a confirmed theft window
          // (a pre/post ignition pair where the fuel drop was confirmed)
          let isConfirmedTheft = false;
          for (const pair of offToOnPairs) {
            if (i >= pair.offIdx && i < pair.onIdx) {
              if (confirmedTheftWindows.has(pair.offIdx)) {
                isConfirmedTheft = true;
              }
              break;
            }
          }

          if (isConfirmedTheft) {
            const tStart = new Date(pt.device_time).getTime();
            let minRampVal = fVal;
            let minRampIdx = i;
            let k = i + 1;

            while (k < sorted.length) {
              const nextPt = sorted[k];
              const nextSpd = parseFloat(nextPt.speed) || 0;
              const nextIgn = nextPt.ignition === true || nextPt.ignition === 'true' || nextPt.ignition === 1;
              const nextTime = new Date(nextPt.device_time).getTime();

              if ((nextTime - tStart) > 25 * 60 * 1000) break;
              if (nextSpd > 6.0 || nextIgn) break; // Stop at motion or engine start

              const nextF = filteredFuels[k];
              if (nextF != null && nextF < minRampVal) {
                minRampVal = nextF;
                minRampIdx = k;
              }
              k++;
            }

            const cumDrop = currentNormalized - minRampVal;
            if (cumDrop >= theftThreshold) {
              rampHandled = true;
              const dropLiters = Math.round(cumDrop * 10) / 10;
              const tEnd = new Date(sorted[minRampIdx].device_time).getTime();
              const durMin = Math.max(1, Math.round((tEnd - tStart) / 60000));
              const startFuelVal = Math.round(currentNormalized * 10) / 10;
              const endFuelVal = Math.round(minRampVal * 10) / 10;

              const dropObj = {
                id: dropEvents.length + 1,
                startIdx: i,
                endIdx: minRampIdx,
                startTime: formatIST(pt.device_time),
                endTime: formatIST(sorted[minRampIdx].device_time),
                startTimeStr: formatIST(pt.device_time),
                endTimeStr: formatIST(sorted[minRampIdx].device_time),
                startDate: formatDateIST(pt.device_time),
                endDate: formatDateIST(sorted[minRampIdx].device_time),
                startFuel: startFuelVal,
                endFuel: endFuelVal,
                liters: dropLiters,
                level: endFuelVal,
                durationMin: durMin
              };
              dropEvents.push(dropObj);
              dropPointsMap.set(minRampIdx, dropObj);

              // Map all points in this theft interval
              for (let fillIdx = i; fillIdx <= minRampIdx; fillIdx++) {
                dropIntervalMap.set(fillIdx, dropObj);
                if (filteredFuels[fillIdx] != null) {
                  currentNormalized = Math.min(currentNormalized, filteredFuels[fillIdx]);
                }
                normalizedFuels[fillIdx] = Math.max(0, Math.min(tankCapacity, Math.round(currentNormalized * 10) / 10));
              }
              currentNormalized = minRampVal;
              i = minRampIdx;
              continue;
            }
          }
        }

        // ================================================================
        // C. STANDARD MOTION & CONSUMPTION RULES
        // (applied when not a verified refill or theft event)
        // ================================================================
        if (!rampHandled) {
          if (rawSpeed > 6.0) {
            // C1. VEHICLE MOVING:
            if (diff >= refuelThreshold) {
              // LATE CATCH: If vehicle departed bunk or sensor scrutinized data stepped up,
              // check if the higher fuel reading is sustained over the next 5 packets (~1.5 min).
              let sustainedCount = 0;
              let sampleCount = 0;
              const lookAhead = Math.min(sorted.length, i + 6);
              for (let j = i + 1; j < lookAhead; j++) {
                const fj = filteredFuels[j];
                if (fj != null) {
                  sampleCount++;
                  if (fj >= currentNormalized + (refuelThreshold * 0.6)) {
                    sustainedCount++;
                  }
                }
              }
              if (sampleCount === 0 || sustainedCount >= Math.ceil(sampleCount * 0.75)) {
                // Confirmed sustained refuel level on highway -> catch up to filtered fuel
                currentNormalized = fVal;
              }
              // If not sustained (road bump slosh), diff is safely rejected
            } else if (diff < 0) {
              // Normal consumption while moving: smooth blend rejects sharp slosh dips
              currentNormalized = (0.88 * currentNormalized) + (0.12 * fVal);
            }
            // diff between 0 and refuelThreshold while moving: road slosh ripple -> silently rejected
          } else if (ign) {
            // C2. STOPPED + IGNITION ON (idling, genset, machinery running)
            // Fuel is being consumed. Positive diff = sensor noise → REJECT.
            if (diff < 0) {
              currentNormalized = (0.92 * currentNormalized) + (0.08 * fVal);
            }
            // diff > 0 while idling → silently rejected
          } else {
            // C3. STOPPED + IGNITION OFF (vehicle parked)
            // Allow gentle sensor settling convergence for small fluctuations.
            // Large deviations without a confirmed theft window → slant parking or noise → ignore.
            if (Math.abs(diff) < refuelThreshold) {
              currentNormalized = (0.88 * currentNormalized) + (0.12 * fVal);
            }
            // diff >= refuelThreshold while parked & not confirmed theft → likely slant → ignore
          }
        }
      }

      normalizedFuels[i] = Math.max(0, Math.min(tankCapacity, Math.round(currentNormalized * 10) / 10));
    }

    let cumulativeDist = 0;
    let maxSpd = 0;
    let sumSpd = 0;
    let speedSamples = 0;
    let idleMinutes = 0;
    let movingMinutes = 0;

    const chartPoints = [];
    const sessions = [];
    let currentSession = null;

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
      const normF = normalizedFuels[i];
      const filtF = filteredFuels[i];
      const rawF = rawFuels[i];

      // Real elapsed time delta between consecutive packets
      let deltaMin = 0;
      if (i > 0) {
        const prevTime = new Date(sorted[i - 1].device_time).getTime();
        const currTime = new Date(pt.device_time).getTime();
        if (currTime > prevTime) {
          deltaMin = Math.min(15, Math.max(0, (currTime - prevTime) / 60000));
        }
      }

      // Engine Status: strictly evaluated from speed + ignition
      let engineState = 'OFF';
      if (rawSpeed > 6.0) {
        engineState = 'ON (Moving)';
        movingMinutes += deltaMin;
      } else if (ign) {
        engineState = 'ON (Idle)';
        idleMinutes += deltaMin;
      } else {
        engineState = 'OFF';
      }

      // Cumulative Distance calculation
      if (i > 0) {
        const prevPt = sorted[i - 1];
        if (pt.lat && pt.lng && prevPt.lat && prevPt.lng) {
          const segDist = haversine(prevPt.lat, prevPt.lng, pt.lat, pt.lng);
          if (segDist > 0.005 && segDist < 10) {
            cumulativeDist += segDist;
          }
        }
      }

      if (rawSpeed > maxSpd) maxSpd = rawSpeed;
      sumSpd += rawSpeed;
      speedSamples++;

      // Session grouping (moving vs idle)
      if (!currentSession || currentSession.status !== engineState) {
        if (currentSession) {
          currentSession.endTime = pt.device_time;
          currentSession.endFuel = normF;
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
          startFuel: normF,
          endFuel: normF,
          startDist: cumulativeDist,
          endDist: cumulativeDist,
          maxSpeed: rawSpeed,
          avgSpeed: rawSpeed
        };
      } else {
        if (rawSpeed > currentSession.maxSpeed) currentSession.maxSpeed = rawSpeed;
      }

      const refEv = refuelPointsMap.get(i);
      const dropEv = dropPointsMap.get(i);
      const inRefill = refuelIntervalMap.get(i);
      const inDrop = dropIntervalMap.get(i);

      chartPoints.push({
        timestamp: new Date(pt.device_time).getTime(),
        timeStr: formatIST(pt.device_time),
        dateStr: formatDateIST(pt.device_time),
        rawFuel: rawF,
        filteredFuel: filtF,
        normalizedFuel: normF,
        fuel: normF, // Backward compatibility
        refuelLiters: refEv ? refEv.liters : null,
        dropLiters: dropEv ? dropEv.liters : null,
        // Event Highlights & Interval Tracking
        isRefillInterval: !!inRefill,
        refillEvent: inRefill || null,
        refillHighlightFuel: inRefill ? filtF : null,
        isRefillStart: inRefill && inRefill.startIdx === i,
        isRefillEnd: inRefill && inRefill.endIdx === i,

        isTheftInterval: !!inDrop,
        theftEvent: inDrop || null,
        theftHighlightFuel: inDrop ? filtF : null,
        isTheftStart: inDrop && inDrop.startIdx === i,
        isTheftEnd: inDrop && inDrop.endIdx === i,

        speed: Math.round(rawSpeed),
        distance: Math.round(cumulativeDist * 10) / 10,
        engineVal: (rawSpeed > 6.0 || ign) ? 1 : 0,
        status: engineState,
        odometer: pt.odometer != null ? parseFloat(pt.odometer).toFixed(2) : (cumulativeDist > 0 ? cumulativeDist.toFixed(2) : '0.00'),
        vehicleBattery: pt.voltage != null ? parseFloat(pt.voltage).toFixed(2) : (pt.sensor_voltage != null ? parseFloat(pt.sensor_voltage).toFixed(2) : (ign ? '25.38' : '24.10')),
        volt: pt.voltage != null ? parseFloat(pt.voltage).toFixed(2) : (pt.sensor_voltage != null ? parseFloat(pt.sensor_voltage).toFixed(2) : '25.38')
      });
    }

    if (currentSession) sessions.push(currentSession);

    // Initial and Final Fuel calculation based on Normalized Fuel
    const validNorms = normalizedFuels.filter(p => p != null);
    const startF = validNorms.length > 0 ? validNorms[0] : 0;
    const endF = validNorms.length > 0 ? validNorms[validNorms.length - 1] : 0;

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
    if (latestSpeed > 6.0) latestStatus = 'ON (Moving)';
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
  }, [historyPoints, tankCapacity, refuelThreshold, theftThreshold, selectedInterval]);

  // Live fuel percentage
  const fuelPercent = useMemo(() => {
    if (!tankCapacity || !processedData.currentFuel) return 0;
    return Math.min(100, Math.max(0, Math.round((processedData.currentFuel / tankCapacity) * 100)));
  }, [processedData.currentFuel, tankCapacity]);

  return (
    <div className="min-h-screen bg-[#F0F4F8] dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-6 transition-colors duration-200">
      <div className="w-full space-y-5">

        {/* ── LINE 1: HEADER TITLE ── */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-md shadow-emerald-500/20 text-white shrink-0">
            <Fuel className="w-5 h-5" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 dark:from-white dark:via-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
            Fuel Analytics
          </h1>
        </div>

        {/* ── LINE 2: CONTROLS BAR (Group, Vehicle, From, To, Interval, Apply) ── */}
        <div className="relative z-50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 px-4 py-3 rounded-2xl shadow-sm">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            
            {/* Group Selector Dropdown */}
            <div className="relative min-w-[140px] sm:min-w-[170px] shrink-0" ref={groupDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setIsGroupDropdownOpen(!isGroupDropdownOpen);
                  setIsDropdownOpen(false);
                }}
                className="w-full flex items-center justify-between gap-2 px-3.5 py-2 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl text-left text-xs font-medium hover:border-emerald-500 dark:hover:border-emerald-500 transition-all shadow-sm"
                title="Filter vehicles by fleet group"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Users className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="font-semibold truncate text-slate-800 dark:text-slate-100 text-xs">
                    {selectedGroupLabel}
                  </span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isGroupDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isGroupDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute z-[9999] left-0 w-full sm:w-[260px] mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl ring-1 ring-black/10 overflow-hidden flex flex-col"
                  >
                    {/* Search inside group dropdown */}
                    {availableGroups.list.length > 5 && (
                      <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                          <input
                            type="text"
                            value={groupSearchQuery}
                            onChange={(e) => setGroupSearchQuery(e.target.value)}
                            placeholder="Search groups..."
                            className="w-full pl-8 pr-2.5 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1.5 focus:ring-emerald-500"
                            autoFocus
                          />
                        </div>
                      </div>
                    )}

                    {/* Group items */}
                    <div className="overflow-y-auto max-h-64 divide-y divide-slate-100 dark:divide-slate-800/60 p-1.5">
                      {/* All Groups Option */}
                      <button
                        type="button"
                        onClick={() => handleSelectGroup('all')}
                        className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left rounded-xl transition-all ${
                          selectedGroupId === 'all'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Users className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="truncate">All Groups</span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                          {vehicles.length}
                        </span>
                      </button>

                      {/* Individual Groups */}
                      {filteredGroupsList.map(g => {
                        const isSelected = selectedGroupId === g.id;
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => handleSelectGroup(g.id)}
                            className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left rounded-xl transition-all ${
                              isSelected
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span className="truncate font-medium">{g.name}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                                {g.count}
                              </span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                            </div>
                          </button>
                        );
                      })}

                      {/* Unassigned Option (if any exist) */}
                      {availableGroups.unassignedCount > 0 && (
                        <button
                          type="button"
                          onClick={() => handleSelectGroup('__unassigned__')}
                          className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left rounded-xl transition-all ${
                            selectedGroupId === '__unassigned__'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span className="truncate text-slate-500 italic">Unassigned</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                              {availableGroups.unassignedCount}
                            </span>
                            {selectedGroupId === '__unassigned__' && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                          </div>
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Custom Searchable Vehicle Dropdown */}
            <div className="relative min-w-[200px] sm:min-w-[260px] shrink-0" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center justify-between gap-2 px-3.5 py-2 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl text-left text-xs font-medium hover:border-emerald-500 dark:hover:border-emerald-500 transition-all shadow-sm"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    selectedVehicle?.is_online ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-slate-400'
                  }`} />
                  <span className="font-semibold truncate text-slate-900 dark:text-white">
                    {selectedVehicle ? (selectedVehicle.name || selectedVehicle.plate || selectedVehicle.imei) : 'Select Vehicle...'}
                  </span>
                  {selectedVehicle?.name && selectedVehicle?.plate && (
                    <span className="text-[11px] text-slate-400 truncate hidden xl:inline">
                      ({selectedVehicle.plate})
                    </span>
                  )}
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute z-[9999] left-0 sm:left-auto sm:right-0 w-full sm:w-[360px] mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl ring-1 ring-black/10 overflow-hidden flex flex-col"
                  >
                    {/* Search inside dropdown with Reset button */}
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search vehicle name, plate or IMEI..."
                          className="w-full pl-8 pr-2.5 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1.5 focus:ring-emerald-500 shadow-sm"
                          autoFocus
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          if (vehicleListContainerRef.current) {
                            vehicleListContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                          }
                          if (vehiclesInSelectedGroup.length > 0) {
                            setSelectedVehicle(vehiclesInSelectedGroup[0]);
                          }
                        }}
                        className="px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-emerald-500 transition-all flex items-center gap-1 shrink-0 shadow-sm"
                        title="Reset to first vehicle in group and scroll to top"
                      >
                        <RotateCcw className="w-3 h-3 text-slate-400" />
                        <span>Reset</span>
                      </button>
                    </div>

                    {/* Vehicle list */}
                    <div 
                      ref={vehicleListContainerRef}
                      className="overflow-y-auto max-h-72 divide-y divide-slate-100 dark:divide-slate-800/60 p-1.5"
                    >
                      {filteredVehicles.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400">No vehicles match your search</div>
                      ) : (
                        filteredVehicles.map((v, index) => {
                          const isSelected = selectedVehicle?.id === v.id;
                          return (
                            <button
                              key={v.id}
                              ref={isSelected ? activeVehicleRef : null}
                              type="button"
                              onClick={() => {
                                setSelectedVehicle(v);
                                setIsDropdownOpen(false);
                                setSearchQuery('');
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left rounded-xl transition-all ${
                                isSelected 
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold ring-1 ring-emerald-500/30' 
                                  : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="font-mono text-[10px] text-slate-400 w-5 shrink-0 text-right">
                                  {index + 1}.
                                </span>
                                <span className={`w-2 h-2 rounded-full shrink-0 ${v.is_online ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-slate-400'}`} />
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
                              {isSelected && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 ml-2" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* From Date-Time */}
            <div 
              onClick={() => {
                try { startInputRef.current?.showPicker?.(); } catch (e) { startInputRef.current?.focus?.(); }
              }}
              className="relative flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 shadow-sm hover:border-emerald-500 transition-colors cursor-pointer shrink-0"
              title="Click to select start date and time"
            >
              <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 shrink-0 pointer-events-none">
                <Calendar className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">From</span>
              </div>
              <div className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-100 select-none pointer-events-none">
                {formatDisplayDDMMYYYY(customStart)}
              </div>
              <input 
                ref={startInputRef}
                type="datetime-local"
                value={customStart}
                max={customEnd || maxDateTime}
                onClick={(e) => {
                  e.stopPropagation();
                  try { e.target.showPicker?.(); } catch (err) {}
                }}
                onChange={(e) => {
                  let val = e.target.value;
                  if (val > maxDateTime) val = maxDateTime;
                  setCustomStart(val);
                  setActivePreset('custom');
                  setError(null);
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>

            {/* To Date-Time */}
            <div 
              onClick={() => {
                try { endInputRef.current?.showPicker?.(); } catch (e) { endInputRef.current?.focus?.(); }
              }}
              className="relative flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 shadow-sm hover:border-cyan-500 transition-colors cursor-pointer shrink-0"
              title="Click to select end date and time"
            >
              <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 shrink-0 pointer-events-none">
                <Clock className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">To</span>
              </div>
              <div className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-100 select-none pointer-events-none">
                {formatDisplayDDMMYYYY(customEnd)}
              </div>
              <input 
                ref={endInputRef}
                type="datetime-local"
                value={customEnd}
                min={customStart}
                max={maxDateTime}
                onClick={(e) => {
                  e.stopPropagation();
                  try { e.target.showPicker?.(); } catch (err) {}
                }}
                onChange={(e) => {
                  let val = e.target.value;
                  if (val > maxDateTime) val = maxDateTime;
                  setCustomEnd(val);
                  setActivePreset('custom');
                  setError(null);
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>

            {/* Sampling Interval Selector */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 shadow-sm shrink-0">
              <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <Sliders className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Interval</span>
              </div>
              <select
                value={selectedInterval}
                onChange={(e) => setSelectedInterval(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer pr-1"
                title="Select Sampling Interval"
              >
                {INTERVAL_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Apply Button */}
            <button
              type="button"
              onClick={() => fetchVehicleFuelData(customStart, customEnd)}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-500/20 disabled:opacity-50 shrink-0"
              title="Apply Date-Time Range"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Loading...' : 'Apply Range'}</span>
            </button>
          </div>
        </div>

        {/* Error Alert Banner */}
        {error && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold shadow-sm">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* ── 1. MULTI-AXIS SYNCHRONIZED VISUALIZATION GRAPH ── */}
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 rounded-2xl shadow-sm space-y-4">
          
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-500" />
                Fuel vs. Speed vs. Distance Correlation
              </h2>
              <p className="text-xs text-slate-400">
                Interactive time-series displaying fuel level drops during speed bursts and idle idling intervals
              </p>
            </div>

            {/* 5-Layer Telematics Visibility Toggles inside Graph Card */}
            <div className="flex items-center flex-wrap gap-2 shrink-0">
              {/* Layer 1: All Fuel Data */}
              <button
                type="button"
                onClick={() => setShowAllFuel(!showAllFuel)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer select-none ${
                  showAllFuel
                    ? 'bg-slate-200 dark:bg-slate-700/80 text-slate-900 dark:text-slate-100 border-slate-400/60 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 border-dashed border-slate-200 dark:border-slate-700/60'
                }`}
                title="Toggle Raw Unfiltered Sensor Fuel Telemetry"
              >
                <span className={`w-2 h-2 rounded-full ${showAllFuel ? 'bg-slate-600 dark:bg-slate-300' : 'bg-slate-400'}`} />
                All Fuel Data
              </button>

              {/* Layer 2: Filtered Fuel Data */}
              <button
                type="button"
                onClick={() => setShowFilteredFuel(!showFilteredFuel)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer select-none ${
                  showFilteredFuel
                    ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-400/60 shadow-sm ring-1 ring-sky-500/20'
                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 border-dashed border-slate-200 dark:border-slate-700/60'
                }`}
                title="Toggle Anti-Slosh Smoothed Fuel Curve"
              >
                <span className={`w-2 h-2 rounded-full ${showFilteredFuel ? 'bg-sky-500' : 'bg-slate-400'}`} />
                Filtered Fuel Data
              </button>

              {/* Layer 3: Normalize (Physical Truth) */}
              <button
                type="button"
                onClick={() => setShowNormalize(!showNormalize)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer select-none ${
                  showNormalize
                    ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-400/60 shadow-sm ring-1 ring-rose-500/20'
                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 border-dashed border-slate-200 dark:border-slate-700/60'
                }`}
                title="Toggle Monotonic Physical Reality Consumption Curve"
              >
                <span className={`w-2 h-2 rounded-full ${showNormalize ? 'bg-rose-500' : 'bg-slate-400'}`} />
                Normalize
              </button>

              {/* Layer 4: Engine */}
              <button
                type="button"
                onClick={() => setShowEngine(!showEngine)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer select-none ${
                  showEngine
                    ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-400/60 shadow-sm ring-1 ring-amber-500/20'
                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 border-dashed border-slate-200 dark:border-slate-700/60'
                }`}
                title="Toggle Engine Ignition Status"
              >
                <span className={`w-2 h-2 rounded-full ${showEngine ? 'bg-amber-500' : 'bg-slate-400'}`} />
                Engine
              </button>

              {/* Layer 5: Speed */}
              <button
                type="button"
                onClick={() => setShowSpeed(!showSpeed)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer select-none ${
                  showSpeed
                    ? 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 border-cyan-400/60 shadow-sm ring-1 ring-cyan-500/20'
                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 border-dashed border-slate-200 dark:border-slate-700/60'
                }`}
                title="Toggle Speed Secondary Axis"
              >
                <span className={`w-2 h-2 rounded-full ${showSpeed ? 'bg-cyan-500' : 'bg-slate-400'}`} />
                Speed
              </button>
            </div>
          </div>

          {/* Side-by-Side: Correlation Graph on Left + Fuel Intelligence Panel on Right */}
          <div className="flex flex-col lg:flex-row gap-5 items-stretch pt-2">
            
            {/* Left: Correlation Graph (Reduced horizontally towards left) */}
            <div className="flex-1 min-w-0">
              <div className="h-[390px] w-full">
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
                    <ComposedChart data={processedData.chartData} margin={{ top: 10, right: 15, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="filteredFuelGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0284c7" stopOpacity={0.22} />
                          <stop offset="95%" stopColor="#0284c7" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>

                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                      
                      <XAxis 
                        dataKey="timeStr" 
                        stroke="#64748b" 
                        fontSize={11} 
                        tickLine={false} 
                      />

                      {/* Left Y Axis: Fuel (Litres) */}
                      <YAxis 
                        yAxisId="fuel" 
                        width={50}
                        domain={[0, Math.ceil(tankCapacity * 1.05)]} 
                        stroke="#0284c7" 
                        fontSize={11} 
                        tickLine={false}
                        orientation="left"
                        unit="L"
                      />

                      {/* Right Y Axis: Speed (km/h) */}
                      <YAxis 
                        yAxisId="speed" 
                        domain={[0, Math.max(80, processedData.maxSpeed + 10)]} 
                        stroke="#06b6d4" 
                        fontSize={11} 
                        tickLine={false} 
                        orientation="right"
                        unit="km/h"
                      />

                      {/* Hidden Y Axis for Engine Ignition baseline step line */}
                      <YAxis 
                        yAxisId="engine" 
                        domain={[0, 10]} 
                        hide={true}
                      />

                      {/* High Precision Multi-Layer Tooltip with Dedicated Side-by-Side Cards (Left: Event Card, Right: Telemetry Card) */}
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const pt = payload[0].payload;
                          const hasRefill = showRefillEvents && (pt.refillEvent || pt.refuelLiters);
                          const hasTheft = showTheftEvents && (pt.theftEvent || pt.dropLiters);

                          return (
                            <div className="flex flex-row items-stretch gap-3 pointer-events-none select-none drop-shadow-2xl">
                              {/* CARD 1 (LEFT SIDE): DEDICATED REFILL CARD */}
                              {hasRefill && (
                                <div className="bg-slate-900/95 backdrop-blur-md border border-emerald-500/60 p-3.5 rounded-2xl shadow-2xl text-xs space-y-2 text-white min-w-[210px] max-w-[240px] flex flex-col justify-between">
                                  <div className="flex items-center justify-between text-xs font-bold text-emerald-400 border-b border-emerald-500/30 pb-1.5 mb-0.5">
                                    <span className="flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                      REFILL DETECTED
                                    </span>
                                    <span className="font-mono text-emerald-300 font-bold bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/40">
                                      +{pt.refillEvent?.liters || pt.refuelLiters} L
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px] pt-1">
                                    <div>
                                      <span className="text-slate-400 text-[10px] block">Start:</span>
                                      <span className="font-mono text-slate-200 font-semibold">{pt.refillEvent?.startTime || pt.timeStr}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 text-[10px] block">Start Fuel:</span>
                                      <span className="font-mono text-emerald-300 font-bold">{pt.refillEvent?.startFuel ?? pt.filteredFuel} L</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 text-[10px] block">End:</span>
                                      <span className="font-mono text-slate-200 font-semibold">{pt.refillEvent?.endTime || pt.timeStr}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 text-[10px] block">End Fuel:</span>
                                      <span className="font-mono text-emerald-300 font-bold">{pt.refillEvent?.endFuel ?? pt.filteredFuel} L</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 text-[10px] block">Duration:</span>
                                      <span className="font-mono text-slate-200">{pt.refillEvent?.durationMin || '—'} min</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 text-[10px] block">Speed:</span>
                                      <span className="font-mono text-cyan-300">{pt.speed} km/h</span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* CARD 1 (LEFT SIDE): DEDICATED THEFT CARD */}
                              {hasTheft && (
                                <div className="bg-slate-900/95 backdrop-blur-md border border-rose-500/60 p-3.5 rounded-2xl shadow-2xl text-xs space-y-2 text-white min-w-[210px] max-w-[240px] flex flex-col justify-between">
                                  <div className="flex items-center justify-between text-xs font-bold text-rose-400 border-b border-rose-500/30 pb-1.5 mb-0.5">
                                    <span className="flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                                      THEFT / DRAIN
                                    </span>
                                    <span className="font-mono text-rose-300 font-bold bg-rose-950/80 px-2 py-0.5 rounded-md border border-rose-500/40">
                                      -{pt.theftEvent?.liters || pt.dropLiters} L
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px] pt-1">
                                    <div>
                                      <span className="text-slate-400 text-[10px] block">Start:</span>
                                      <span className="font-mono text-slate-200 font-semibold">{pt.theftEvent?.startTime || pt.timeStr}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 text-[10px] block">Start Fuel:</span>
                                      <span className="font-mono text-rose-300 font-bold">{pt.theftEvent?.startFuel ?? pt.filteredFuel} L</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 text-[10px] block">End:</span>
                                      <span className="font-mono text-slate-200 font-semibold">{pt.theftEvent?.endTime || pt.timeStr}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 text-[10px] block">End Fuel:</span>
                                      <span className="font-mono text-rose-300 font-bold">{pt.theftEvent?.endFuel ?? pt.filteredFuel} L</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 text-[10px] block">Duration:</span>
                                      <span className="font-mono text-slate-200">{pt.theftEvent?.durationMin || '—'} min</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 text-[10px] block">Speed:</span>
                                      <span className="font-mono text-cyan-300">{pt.speed} km/h</span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* CARD 2 (RIGHT SIDE): STANDARD TELEMETRY CURSOR CARD */}
                              <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 p-3.5 rounded-2xl shadow-2xl text-xs space-y-1.5 text-white min-w-[210px] max-w-[250px]">
                                {/* Standard Point Header */}
                                <div className="font-bold border-b border-slate-800 pb-1.5 flex items-center justify-between gap-4">
                                  <span className="text-slate-300 font-mono">{pt.dateStr}</span>
                                  <span className="text-emerald-400 font-mono font-bold">{pt.timeStr}</span>
                                </div>
                                
                                {/* Speed */}
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-cyan-400 font-medium flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                                    Speed:
                                  </span>
                                  <span className="font-bold text-cyan-300 font-mono">{pt.speed} km/h</span>
                                </div>

                                {/* Filtered Fuel */}
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-sky-400 font-medium flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                                    Filter Fuel:
                                  </span>
                                  <span className="font-bold text-sky-300 font-mono">
                                    {pt.filteredFuel != null ? `${pt.filteredFuel} Ltrs` : '—'}
                                  </span>
                                </div>

                                {/* Normalize */}
                                {(showNormalize || showConsumptionLayer) && (
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-red-400 font-semibold flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-red-500" />
                                      Normalize:
                                    </span>
                                    <span className="font-bold text-red-400 font-mono">
                                      {pt.normalizedFuel != null ? `${pt.normalizedFuel} Ltrs` : '—'}
                                    </span>
                                  </div>
                                )}

                                {/* All Fuel Data */}
                                {showAllFuel && (
                                  <div className="flex items-center justify-between gap-4 text-slate-300">
                                    <span className="flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-slate-400" />
                                      All Fuel:
                                    </span>
                                    <span className="font-mono">{pt.rawFuel != null ? `${pt.rawFuel} Ltrs` : '—'}</span>
                                  </div>
                                )}

                                {/* Engine Status */}
                                <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-800/80">
                                  <span className="text-amber-400 font-medium flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                                    Engine:
                                  </span>
                                  <span className={`font-bold font-mono ${pt.engineVal === 1 ? 'text-emerald-400' : 'text-slate-400'}`}>
                                    {pt.engineVal === 1 ? 'ON' : 'OFF'}
                                  </span>
                                </div>

                                {/* Odometer */}
                                <div className="flex items-center justify-between gap-4 text-slate-300">
                                  <span className="text-slate-400">Odometer:</span>
                                  <span className="font-mono font-medium">{pt.odometer} km</span>
                                </div>

                                {/* Vehicle Battery */}
                                <div className="flex items-center justify-between gap-4 text-slate-300">
                                  <span className="text-slate-400">Vehicle Battery:</span>
                                  <span className="font-mono font-medium text-amber-300">{(pt.vehicleBattery || pt.volt || '25.38')} V</span>
                                </div>
                              </div>
                            </div>
                          );
                        }}
                      />

                      {/* 1. Filtered Fuel Area (Translucent Glass Background Tint) */}
                      {showFilteredFuel && (
                        <Area
                          yAxisId="fuel"
                          type="monotone"
                          dataKey="filteredFuel"
                          stroke="#0284c7"
                          strokeWidth={2}
                          strokeOpacity={0.85}
                          fillOpacity={1}
                          fill="url(#filteredFuelGradient)"
                          connectNulls={true}
                          dot={false}
                          name="Filtered Fuel Data (L)"
                        />
                      )}

                      {/* 2. All Fuel Data (Raw Telemetry Scatter/Dashed Line) */}
                      {showAllFuel && (
                        <Line
                          yAxisId="fuel"
                          type="linear"
                          dataKey="rawFuel"
                          stroke="#64748b"
                          strokeWidth={1.2}
                          strokeOpacity={0.55}
                          strokeDasharray="2 2"
                          dot={{ r: 1.5, fill: '#64748b', strokeWidth: 0, fillOpacity: 0.55 }}
                          connectNulls={true}
                          name="All Fuel Data (L)"
                        />
                      )}

                      {/* 3. Engine Ignition Baseline Step Line (Yellow Line at Bottom) */}
                      {showEngine && (
                        <Line
                          yAxisId="engine"
                          type="stepAfter"
                          dataKey="engineVal"
                          stroke="#eab308"
                          strokeWidth={2.5}
                          dot={false}
                          name="Engine (ON/OFF)"
                        />
                      )}

                      {/* 4. Speed Line (Cyan Line on Right Axis) */}
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

                      {/* 5. Master Hero: Normalize / Consumption Line (RED) */}
                      {(showNormalize || showConsumptionLayer) && (
                        <Line
                          yAxisId="fuel"
                          type="monotone"
                          dataKey="normalizedFuel"
                          stroke="#ef4444"
                          strokeWidth={3.5}
                          dot={false}
                          activeDot={{ r: 6, fill: '#ef4444', stroke: '#ffffff', strokeWidth: 2 }}
                          connectNulls={true}
                          name="Normalize / Consumption (L)"
                        />
                      )}

                      {/* 6. Refill Highlight Curve (Emerald Green on refill intervals) */}
                      {showRefillEvents && (
                        <Line
                          yAxisId="fuel"
                          type="monotone"
                          dataKey="refillHighlightFuel"
                          stroke="#10b981"
                          strokeWidth={4.5}
                          dot={false}
                          activeDot={{ r: 6, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                          connectNulls={false}
                          name="Refill Highlight"
                          isAnimationActive={false}
                        />
                      )}

                      {/* 7. Theft Highlight Curve (Crimson Red on theft intervals) */}
                      {showTheftEvents && (
                        <Line
                          yAxisId="fuel"
                          type="monotone"
                          dataKey="theftHighlightFuel"
                          stroke="#ef4444"
                          strokeWidth={4.5}
                          dot={false}
                          activeDot={{ r: 6, fill: '#ef4444', stroke: '#ffffff', strokeWidth: 2 }}
                          connectNulls={false}
                          name="Theft Highlight"
                          isAnimationActive={false}
                        />
                      )}

                      {/* 8. Refill Starting & Ending Reference Dots & Bands */}
                      {showRefillEvents && processedData.refuels.map((r, idx) => (
                        <React.Fragment key={`ref-marks-${idx}`}>
                          <ReferenceDot
                            yAxisId="fuel"
                            x={r.startTimeStr}
                            y={r.startFuel}
                            r={5}
                            fill="#10b981"
                            stroke="#ffffff"
                            strokeWidth={2}
                            isFront={true}
                          />
                          <ReferenceDot
                            yAxisId="fuel"
                            x={r.endTimeStr}
                            y={r.endFuel}
                            r={6}
                            fill="#059669"
                            stroke="#ffffff"
                            strokeWidth={2}
                            isFront={true}
                          />
                          <ReferenceArea
                            yAxisId="fuel"
                            x1={r.startTimeStr}
                            x2={r.endTimeStr}
                            fill="#10b981"
                            fillOpacity={0.15}
                            stroke="#10b981"
                            strokeOpacity={0.4}
                            strokeDasharray="2 2"
                          />
                        </React.Fragment>
                      ))}

                      {/* 9. Theft Starting & Ending Reference Dots & Bands */}
                      {showTheftEvents && processedData.drops.map((d, idx) => (
                        <React.Fragment key={`theft-marks-${idx}`}>
                          <ReferenceDot
                            yAxisId="fuel"
                            x={d.startTimeStr}
                            y={d.startFuel}
                            r={5}
                            fill="#ef4444"
                            stroke="#ffffff"
                            strokeWidth={2}
                            isFront={true}
                          />
                          <ReferenceDot
                            yAxisId="fuel"
                            x={d.endTimeStr}
                            y={d.endFuel}
                            r={6}
                            fill="#b91c1c"
                            stroke="#ffffff"
                            strokeWidth={2}
                            isFront={true}
                          />
                          <ReferenceArea
                            yAxisId="fuel"
                            x1={d.startTimeStr}
                            x2={d.endTimeStr}
                            fill="#ef4444"
                            fillOpacity={0.16}
                            stroke="#ef4444"
                            strokeOpacity={0.4}
                            strokeDasharray="2 2"
                          />
                        </React.Fragment>
                      ))}

                      <Brush 
                        dataKey="timeStr" 
                        height={24} 
                        stroke="#38bdf8" 
                        fill="#0f172a" 
                        travellerWidth={10}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Right Column: Dedicated Fuel Intelligence & Event Layer Control Panel (Compact & Sleek) */}
            <div className="w-full lg:w-[220px] xl:w-[230px] shrink-0 flex flex-col justify-between bg-slate-50/80 dark:bg-slate-800/60 backdrop-blur-md rounded-2xl p-3 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
              <div className="space-y-2.5">
                {/* Panel Title */}
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/80 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Fuel Intelligence
                    </span>
                  </div>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Live Engine
                  </span>
                </div>

                {/* 3 Interactive Layer Checkboxes */}
                <div className="space-y-2">
                  {/* 1. Refill Checkbox */}
                  <label className={`flex items-start gap-2 p-2 rounded-xl border transition-all cursor-pointer select-none ${
                    showRefillEvents
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400/60 dark:border-emerald-700/60 shadow-sm ring-1 ring-emerald-500/20'
                      : 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700/60 hover:border-emerald-300 opacity-70'
                  }`}>
                    <input
                      type="checkbox"
                      checked={showRefillEvents}
                      onChange={(e) => setShowRefillEvents(e.target.checked)}
                      className="mt-0.5 w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-600 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          1. Refill
                        </span>
                        <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono">
                          +{processedData.refuels.reduce((acc, r) => acc + r.liters, 0).toFixed(1)} L
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                        {processedData.refuels.length} refuels (settled)
                      </p>
                    </div>
                  </label>

                  {/* 2. Theft / Drain Checkbox */}
                  <label className={`flex items-start gap-2 p-2 rounded-xl border transition-all cursor-pointer select-none ${
                    showTheftEvents
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400/60 dark:border-rose-700/60 shadow-sm ring-1 ring-rose-500/20'
                      : 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700/60 hover:border-rose-300 opacity-70'
                  }`}>
                    <input
                      type="checkbox"
                      checked={showTheftEvents}
                      onChange={(e) => setShowTheftEvents(e.target.checked)}
                      className="mt-0.5 w-3.5 h-3.5 rounded text-rose-600 focus:ring-rose-500 border-slate-300 dark:border-slate-600 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          2. Theft / Drain
                        </span>
                        <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 font-mono">
                          -{processedData.drops.reduce((acc, d) => acc + d.liters, 0).toFixed(1)} L
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                        {processedData.drops.length} siphons verified
                      </p>
                    </div>
                  </label>

                  {/* 3. Consumption Checkbox */}
                  <label className={`flex items-start gap-2 p-2 rounded-xl border transition-all cursor-pointer select-none ${
                    showConsumptionLayer
                      ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-400/60 dark:border-sky-700/60 shadow-sm ring-1 ring-sky-500/20'
                      : 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700/60 hover:border-sky-300 opacity-70'
                  }`}>
                    <input
                      type="checkbox"
                      checked={showConsumptionLayer}
                      onChange={(e) => setShowConsumptionLayer(e.target.checked)}
                      className="mt-0.5 w-3.5 h-3.5 rounded text-sky-600 focus:ring-sky-500 border-slate-300 dark:border-slate-600 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                          3. Consumption
                        </span>
                        <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 font-mono">
                          {processedData.fuelConsumed.toFixed(1)} L
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                        Burn ({processedData.mileageKmpl} km/L)
                      </p>
                    </div>
                  </label>
                </div>

                {/* Event Audit Snippet */}
                <div className="space-y-1 pt-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Detected Events
                  </span>
                  <div className="max-h-[90px] overflow-y-auto space-y-1 pr-1">
                    {processedData.refuels.length === 0 && processedData.drops.length === 0 ? (
                      <div className="text-[10px] text-slate-400 italic py-1.5 text-center">
                        No events in range
                      </div>
                    ) : (
                      <>
                        {showRefillEvents && processedData.refuels.map((r, idx) => (
                          <div key={`ref-${idx}`} className="flex items-center justify-between p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px]">
                            <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-semibold truncate">
                              <span>⛽</span>
                              <span className="font-mono text-[9px] text-slate-500 dark:text-slate-400 truncate">{r.startTimeStr}</span>
                            </div>
                            <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400 shrink-0">+{r.liters} L</span>
                          </div>
                        ))}
                        {showTheftEvents && processedData.drops.map((d, idx) => (
                          <div key={`drp-${idx}`} className="flex items-center justify-between p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[10px]">
                            <div className="flex items-center gap-1 text-rose-700 dark:text-rose-300 font-semibold truncate">
                              <span>⚠️</span>
                              <span className="font-mono text-[9px] text-slate-500 dark:text-slate-400 truncate">{d.startTimeStr}</span>
                            </div>
                            <span className="font-bold font-mono text-rose-600 dark:text-rose-400 shrink-0">-{d.liters} L</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Help Note */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 text-[9px] text-slate-400 flex items-center justify-between">
                <span>Hover curve for event</span>
                <span className="font-mono text-slate-500">5-10m settling</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 2. TELEMETRY EXECUTIVE KPI CARDS (BELOW GRAPH) ── */}
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
