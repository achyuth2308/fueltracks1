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
  Database
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
  
  // Recent visited vehicles state (persisted in localStorage)
  const [recentVehicleIds, setRecentVehicleIds] = useState(() => {
    try {
      const saved = localStorage.getItem('ft_recent_visited_vehicles_v1');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const recordRecentVehicle = (vehicleId) => {
    if (!vehicleId) return;
    setRecentVehicleIds(prev => {
      const updated = [vehicleId, ...prev.filter(id => id !== vehicleId)].slice(0, 6);
      try {
        localStorage.setItem('ft_recent_visited_vehicles_v1', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  // Searchable dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

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
            let initialV = null;
            try {
              const savedRecents = JSON.parse(localStorage.getItem('ft_recent_visited_vehicles_v1') || '[]');
              if (savedRecents.length > 0) {
                initialV = list.find(v => v.id === savedRecents[0]);
              }
            } catch (e) {}
            if (!initialV) {
              initialV = list.find(v => v.metadata?.fuel || v.metadata?.fuelCalibration || v.fuel != null) || list[0];
            }
            setSelectedVehicle(initialV);
            if (initialV?.id) recordRecentVehicle(initialV.id);
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
      startIso = new Date(s).toISOString();
      endIso = new Date(e).toISOString();
    } catch (err) {
      const p = getPresetRange('today');
      startIso = p.startDate;
      endIso = p.endDate;
    }

    try {
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

  // Recently visited vehicles list
  const recentVehiclesList = useMemo(() => {
    if (!recentVehicleIds.length) return [];
    return recentVehicleIds
      .map(id => vehicles.find(v => v.id === id))
      .filter(Boolean);
  }, [recentVehicleIds, vehicles]);

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

    const isCurrentValid = selectedVehicle && nextVehicles.some(v => v.id === selectedVehicle.id);
    if (!isCurrentValid) {
      if (nextVehicles.length > 0) {
        const bestVehicle = nextVehicles.find(v => v.metadata?.fuel || v.metadata?.fuelCalibration || v.current_fuel != null) || nextVehicles[0];
        setSelectedVehicle(bestVehicle);
      } else {
        setSelectedVehicle(null);
        setHistoryPoints([]);
      }
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

    // 2. Anti-Slosh Moving Median Filter (Window 5) + Exponential Smoothing (EMA) -> "Filtered Fuel Data"
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

    // 3. Physical Reality Normalization (Consumption-Constrained Monotonic Curve) -> "Normalize"
    const normalizedFuels = new Array(sorted.length).fill(null);
    const refuelEvents = [];
    const dropEvents = [];
    
    // Find initial baseline fuel
    const firstValidFiltered = filteredFuels.find(f => f != null);
    let currentNormalized = firstValidFiltered != null ? firstValidFiltered : 0;

    for (let i = 0; i < sorted.length; i++) {
      const pt = sorted[i];
      const rawSpeed = parseFloat(pt.speed) || 0;
      const ign = pt.ignition === true || pt.ignition === 'true' || pt.ignition === 1;
      const isEngineOn = rawSpeed > 6.0 || ign; // 6 km/h speed threshold
      const fVal = filteredFuels[i];

      if (fVal != null) {
        const diff = fVal - currentNormalized;

        // A. Valid Refill: Sustained jump >= refuelThreshold while vehicle is stationary/stopped
        if (diff >= refuelThreshold && rawSpeed <= 6.0) {
          let isSustained = true;
          for (let k = i + 1; k < Math.min(sorted.length, i + 3); k++) {
            if (filteredFuels[k] != null && filteredFuels[k] < currentNormalized + (refuelThreshold * 0.6)) {
              isSustained = false;
              break;
            }
          }
          if (isSustained) {
            currentNormalized = fVal;
            refuelEvents.push({
              time: formatIST(pt.device_time),
              liters: Math.round(diff * 10) / 10,
              level: fVal
            });
          }
        }
        // B. Valid Theft / Drain: Drop <= -theftThreshold while engine is OFF
        else if (diff <= -theftThreshold && !isEngineOn) {
          let isSustained = true;
          for (let k = i + 1; k < Math.min(sorted.length, i + 3); k++) {
            if (filteredFuels[k] != null && filteredFuels[k] > currentNormalized - (theftThreshold * 0.6)) {
              isSustained = false;
              break;
            }
          }
          if (isSustained) {
            currentNormalized = fVal;
            dropEvents.push({
              time: formatIST(pt.device_time),
              liters: Math.round(Math.abs(diff) * 10) / 10,
              level: fVal
            });
          }
        }
        // C. Engine ON (Driving or Idling / Machinery / Genset running)
        // Fuel is actively being consumed: fuel CANNOT rise without a verified refill!
        else if (isEngineOn) {
          if (diff < 0) {
            if (rawSpeed > 6.0) {
              // Road slosh dampening while driving
              currentNormalized = (0.85 * currentNormalized) + (0.15 * fVal);
            } else {
              // Stationary machinery / genset / idling: smooth monotonic burn without jumping to sensor noise dips
              currentNormalized = (0.90 * currentNormalized) + (0.10 * fVal);
            }
          }
          // Positive diff (diff > 0) while engine is running without a refill is sensor ripple/vibration -> REJECTED!
        }
        // D. Engine OFF & Parked (rawSpeed <= 6.0 and !isEngineOn)
        // Static resting state: gently converge to true physical resting volume
        else {
          if (Math.abs(diff) < refuelThreshold) {
            currentNormalized = (0.85 * currentNormalized) + (0.15 * fVal);
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

      chartPoints.push({
        timestamp: new Date(pt.device_time).getTime(),
        timeStr: formatIST(pt.device_time),
        dateStr: formatDateIST(pt.device_time),
        rawFuel: rawF,
        filteredFuel: filtF,
        normalizedFuel: normF,
        fuel: normF, // Backward compatibility
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

        {/* ── TOP HEADER & CONTROLS BAR ── */}
        <div className="relative z-50 flex flex-col gap-4 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm">
          
          {/* Top Row: Title & Searchable Vehicle Selector */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/20 text-white">
                <Fuel className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 dark:from-white dark:via-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                  Fuel Analytics
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Precision fuel telemetry, synchronized graphs & consumption breakdown
                </p>
              </div>
            </div>

            {/* Top Right: Group Selector + Searchable Vehicle Selector */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Group Selector Dropdown */}
              <div className="relative min-w-[170px] sm:min-w-[190px]" ref={groupDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIsGroupDropdownOpen(!isGroupDropdownOpen);
                    setIsDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl text-left text-xs sm:text-sm font-medium hover:border-emerald-500 dark:hover:border-emerald-500 transition-all shadow-sm"
                  title="Filter vehicles by fleet group"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Users className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="font-semibold truncate text-slate-800 dark:text-slate-100">
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
                      className="absolute z-[9999] left-0 sm:right-auto sm:left-0 w-full sm:w-[260px] mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl ring-1 ring-black/10 overflow-hidden flex flex-col"
                    >
                      {/* Search inside group dropdown */}
                      {availableGroups.list.length > 5 && (
                        <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                            <input
                              type="text"
                              value={groupSearchQuery}
                              onChange={(e) => setGroupSearchQuery(e.target.value)}
                              placeholder="Search groups..."
                              className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1.5 focus:ring-emerald-500"
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
                          className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left rounded-xl transition-all ${
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
                              className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left rounded-xl transition-all ${
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
                            className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left rounded-xl transition-all ${
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
              <div className="relative min-w-[240px] sm:min-w-[320px]" ref={dropdownRef}>
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
                      {/* Recently Visited Section */}
                      {recentVehiclesList.length > 0 && !searchQuery.trim() && (
                        <div className="pb-1.5 mb-1.5 border-b border-slate-100 dark:border-slate-800/80">
                          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center justify-between bg-emerald-500/5 rounded-lg mb-1">
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3 h-3 text-emerald-500" />
                              Recently Visited
                            </span>
                            <span className="text-[9px] font-semibold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">Recent</span>
                          </div>
                          <div className="space-y-0.5">
                            {recentVehiclesList.map((v) => {
                              const isSelected = selectedVehicle?.id === v.id;
                              return (
                                <button
                                  key={`recent-${v.id}`}
                                  type="button"
                                  onClick={() => {
                                    setSelectedVehicle(v);
                                    recordRecentVehicle(v.id);
                                    setIsDropdownOpen(false);
                                    setSearchQuery('');
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left rounded-xl transition-all ${
                                    isSelected 
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold' 
                                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 truncate">
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${v.is_online ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-slate-400'}`} />
                                    <div className="truncate">
                                      <div className="font-semibold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                                        <span>{v.name || v.plate || v.imei}</span>
                                        <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">Recent</span>
                                      </div>
                                      <div className="text-[10px] text-slate-400 flex items-center gap-2">
                                        {v.plate && <span>{v.plate}</span>}
                                        <span>IMEI: {v.imei}</span>
                                      </div>
                                    </div>
                                  </div>
                                  {isSelected && <Check className="w-4 h-4 text-emerald-500 shrink-0 ml-2" />}
                                </button>
                              );
                            })}
                          </div>
                          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5 mt-2">
                            <span>All Vehicles ({filteredVehicles.length})</span>
                          </div>
                        </div>
                      )}

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
                                recordRecentVehicle(v.id);
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
            </div>
          </div>

          {/* Date-Time Range Selection Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
            
            <div className="flex flex-wrap items-center gap-2.5">
              {/* From Date-Time (DD/MM/YYYY Display) */}
              <div 
                onClick={() => {
                  try {
                    startInputRef.current?.showPicker?.();
                  } catch (e) {
                    startInputRef.current?.focus?.();
                  }
                }}
                className="relative flex items-center gap-2 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 shadow-sm hover:border-emerald-500 transition-colors cursor-pointer"
                title="Click to select start date and time"
              >
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 shrink-0 pointer-events-none">
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

              {/* To Date-Time (DD/MM/YYYY Display) */}
              <div 
                onClick={() => {
                  try {
                    endInputRef.current?.showPicker?.();
                  } catch (e) {
                    endInputRef.current?.focus?.();
                  }
                }}
                className="relative flex items-center gap-2 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 shadow-sm hover:border-cyan-500 transition-colors cursor-pointer"
                title="Click to select end date and time"
              >
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 shrink-0 pointer-events-none">
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

              {/* Sampling Interval Selector (Matching Reference System) */}
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 shadow-sm">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <Sliders className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Interval</span>
                </div>
                <select
                  value={selectedInterval}
                  onChange={(e) => setSelectedInterval(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer pr-1"
                  title="Select Sampling Interval (Downsamples points for smoother visualization and fast rendering)"
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
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
                title="Apply Date-Time Range"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Loading...' : 'Apply Range'}</span>
              </button>
            </div>

            {/* Quick Presets */}
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
                  onClick={() => handleSelectPreset(tab.id)}
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

            {/* 5-Layer Telematics Visibility Toggles (Reference System) */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              {/* Layer 1: All Fuel Data */}
              <button
                type="button"
                onClick={() => setShowAllFuel(!showAllFuel)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
                  showAllFuel
                    ? 'bg-slate-200 dark:bg-slate-700/60 text-slate-800 dark:text-slate-100 border-slate-400/50 shadow-sm font-semibold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-transparent hover:text-slate-800'
                }`}
                title="Toggle Raw Unfiltered Sensor Fuel Telemetry"
              >
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                All Fuel Data
              </button>

              {/* Layer 2: Filtered Fuel Data */}
              <button
                type="button"
                onClick={() => setShowFilteredFuel(!showFilteredFuel)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
                  showFilteredFuel
                    ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/50 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-transparent hover:text-slate-300'
                }`}
                title="Toggle Anti-Slosh Smoothed Fuel Curve"
              >
                <span className="w-2 h-2 rounded-full bg-sky-600" />
                Filtered Fuel Data
              </button>

              {/* Layer 3: Normalize (Physical Truth) */}
              <button
                type="button"
                onClick={() => setShowNormalize(!showNormalize)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
                  showNormalize
                    ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/50 shadow-sm ring-1 ring-red-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-transparent hover:text-slate-300'
                }`}
                title="Toggle Monotonic Physical Reality Consumption Curve"
              >
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Normalize
              </button>

              {/* Layer 4: Engine */}
              <button
                type="button"
                onClick={() => setShowEngine(!showEngine)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
                  showEngine
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/50 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-transparent hover:text-slate-300'
                }`}
                title="Toggle Engine Ignition Status"
              >
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Engine
              </button>

              {/* Layer 5: Speed */}
              <button
                type="button"
                onClick={() => setShowSpeed(!showSpeed)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
                  showSpeed
                    ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/50 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-transparent hover:text-slate-300'
                }`}
                title="Toggle Speed Secondary Axis"
              >
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                Speed
              </button>
            </div>
          </div>

          {/* Chart Container */}
          <div className="h-[380px] w-full pt-4">
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

                  {/* High Precision Multi-Layer Tooltip */}
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const pt = payload[0].payload;
                      return (
                        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 p-3 rounded-xl shadow-2xl text-xs space-y-1.5 text-white min-w-[220px]">
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

                          {/* Normalize */}
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-red-400 font-semibold flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-red-500" />
                              Normalize:
                            </span>
                            <span className="font-bold text-red-400 font-mono">
                              {pt.normalizedFuel != null ? `${pt.normalizedFuel} Ltrs` : '—'}
                            </span>
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

                          {/* All Fuel Data */}
                          <div className="flex items-center justify-between gap-4 text-slate-300">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-slate-400" />
                              All Fuel:
                            </span>
                            <span className="font-mono">{pt.rawFuel != null ? `${pt.rawFuel} Ltrs` : '—'}</span>
                          </div>

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

                          {/* Status */}
                          {pt.status && (
                            <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/60 flex items-center justify-between">
                              <span>Status:</span>
                              <span className="text-slate-200 font-semibold">{pt.status}</span>
                            </div>
                          )}
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

                  {/* 5. Master Hero: Normalize Line (RED) - Rendered LAST so it is ALWAYS on TOP of all other layers */}
                  {showNormalize && (
                    <Line
                      yAxisId="fuel"
                      type="monotone"
                      dataKey="normalizedFuel"
                      stroke="#ef4444"
                      strokeWidth={4}
                      dot={false}
                      activeDot={{ r: 6, fill: '#ef4444', stroke: '#ffffff', strokeWidth: 2 }}
                      connectNulls={true}
                      name="Normalize (L)"
                    />
                  )}

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
