import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import TelematicsDatePicker from '../../components/ui/TelematicsDatePicker';
import TelematicsTimePicker, { to12Hour } from '../../components/ui/TelematicsTimePicker';
import {
  FileSpreadsheet, FileText, FileCode, Search, Loader2, Calendar, Info,
  Droplets, Flame, Gauge, Zap, TrendingUp, TrendingDown,
  Truck, ArrowUpRight, CheckCircle2, AlertTriangle, ShieldAlert, ArrowUpDown
} from 'lucide-react';
import axiosInstance from '../../api/axios';
import { exportToExcel, exportToCSV, exportToPDF } from '../../utils/exportUtils';
import AddressText from '../../components/ui/AddressText';
import { getLocalDateString } from '../../utils/dateUtils';
import * as vehicleApi from '../../api/vehicleApi';
import ReportGroupVehicleSidebar from '../../components/reports/ReportGroupVehicleSidebar';
import { hasVehicleFuelCapability } from '../../utils/licenseUtils';

const getYesterdayString = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateString(d);
};

const getTodayString = () => {
  return getLocalDateString(new Date());
};

const formatHMS = (seconds) => {
  if (!seconds || seconds <= 0 || isNaN(seconds)) return '00:00:00';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const formatHours = (seconds) => {
  if (!seconds || seconds <= 0 || isNaN(seconds)) return '0.00 hrs';
  return `${(seconds / 3600).toFixed(2)} hrs`;
};

const formatBannerDateTime = (dateStr, timeStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const formattedDate = (y && m && d) ? `${d}-${m}-${y}` : dateStr;
  const time12 = to12Hour(timeStr);
  return `${time12} ${formattedDate}`;
};

const FuelReportsPage = ({ type: propType }) => {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Detect report type from prop or route path
  const reportType = useMemo(() => {
    if (propType) return propType;
    if (location.pathname.includes('fuel-theft')) return 'theft';
    if (location.pathname.includes('fuel-consolidated')) return 'consolidated';
    if (location.pathname.includes('fuel-refill')) return 'refill';
    if (location.pathname.includes('fuel-consumption')) return 'consumption';
    if (location.pathname.includes('kmpl-mileage')) return 'kmpl';
    if (location.pathname.includes('lph-burn-rate')) return 'lph';
    return 'consumption';
  }, [propType, location.pathname]);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('All');
  const fuelCapableVehicles = useMemo(() => {
    return vehicles.filter(v => hasVehicleFuelCapability(v));
  }, [vehicles]);

  // Extract unique group names for the group dropdown
  // Group options (strictly official Dashboard groups)
  const groupOptions = useMemo(() => {
    if (groups && groups.length > 0) {
      const names = groups.map(g => g.name?.trim()).filter(Boolean);
      names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      return ['All', ...names];
    }
    const names = new Set();
    vehicles.forEach(v => {
      const gn = v.group_name || v.group?.name;
      if (gn) names.add(gn.trim());
      if (Array.isArray(v.groups)) v.groups.forEach(g => { if (g.name) names.add(g.name.trim()); });
    });
    return ['All', ...Array.from(names).sort()];
  }, [groups, vehicles]);

  // Filter vehicles according to selectedGroup
  const groupFilteredVehicles = useMemo(() => {
    const base = fuelCapableVehicles.length > 0 ? fuelCapableVehicles : vehicles;
    if (selectedGroup === 'All') return base;
    return base.filter(v => {
      const gName = (v.group_name || v.group?.name || '').trim().toLowerCase();
      const matchName = gName === selectedGroup.trim().toLowerCase();
      const matchArr = Array.isArray(v.groups) && v.groups.some(g => (g.name || '').trim().toLowerCase() === selectedGroup.trim().toLowerCase());
      const matchStr = (v.group_name || '').split(',').map(s => s.trim().toLowerCase()).includes(selectedGroup.trim().toLowerCase());
      return matchName || matchArr || matchStr;
    });
  }, [fuelCapableVehicles, vehicles, selectedGroup]);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortField, setSortField] = useState('vehicle_name');
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const defaultToday = getTodayString();
  const [activePreset, setActivePreset] = useState('today');
  const [filters, setFilters] = useState(() => ({
    vehicleId: searchParams.get('vehicleId') || '',
    startDate: defaultToday,
    startTime: '00:00',
    endDate: defaultToday,
    endTime: '23:59'
  }));

  const handleFetchReport = async (overrideFilters = null, overrideGroup = null) => {
    const activeFilters = overrideFilters || filters;
    if (!activeFilters.startDate || !activeFilters.endDate) return;

    setLoading(true);
    try {
      const [sY, sM, sD] = activeFilters.startDate.split('-');
      const [sH, sMin] = (activeFilters.startTime || '00:00').split(':');
      const startIso = `${sY}-${sM}-${sD}T${sH || '00'}:${sMin || '00'}:00+05:30`;

      const [eY, eM, eD] = activeFilters.endDate.split('-');
      const [eH, eMin] = (activeFilters.endTime || '23:59').split(':');
      const endIso = `${eY}-${eM}-${eD}T${eH || '23'}:${eMin || '59'}:59.999+05:30`;

      const params = new URLSearchParams();
      params.append('startDate', startIso);
      params.append('endDate', endIso);

      if (reportType !== 'consolidated' && activeFilters.vehicleId && activeFilters.vehicleId !== 'ALL' && activeFilters.vehicleId !== 'All') {
        params.append('vehicleId', activeFilters.vehicleId);
      }

      const curGroup = overrideGroup !== null ? overrideGroup : selectedGroup;
      if (curGroup !== 'All') {
        const matchedG = groups.find(g => (g.name || '').trim().toLowerCase() === curGroup.trim().toLowerCase());
        if (matchedG?.id) {
          params.append('groupId', matchedG.id);
        }
      } else {
        const activeOrgId = vehicles[0]?.org_id;
        if (activeOrgId) {
          params.append('orgId', activeOrgId);
        }
      }

      const res = await axiosInstance.get(`/api/reports/consolidated?${params.toString()}`);
      if (res.data?.success) {
        setData(res.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching fuel report:', err);
      alert('Failed to generate fuel report');
    } finally {
      setLoading(false);
    }
  };

  // Fetch vehicles & groups for dropdown & auto-load initial vehicle
  useEffect(() => {
    let isMounted = true;
    Promise.allSettled([
      vehicleApi.getVehicles({ t: Date.now(), limit: 1000 }),
      axiosInstance.get('/api/admin/groups')
    ]).then(([vRes, gRes]) => {
      if (!isMounted) return;
      if (gRes.status === 'fulfilled' && gRes.value?.data) {
        const gData = gRes.value.data.data || gRes.value.data.groups || [];
        setGroups(gData);
      }

      if (vRes.status === 'fulfilled' && vRes.value?.success && vRes.value?.data && vRes.value.data.length > 0) {
        const vList = vRes.value.data;
        setVehicles(vList);
        const fuelOnly = vList.filter(v => hasVehicleFuelCapability(v));
        const urlVId = searchParams.get('vehicleId');
        const initialVId = (urlVId && vList.some(v => String(v.id) === String(urlVId)))
          ? urlVId
          : (fuelOnly.length > 0 ? fuelOnly[0].id : vList[0].id);

        setFilters(prev => {
          const nextFilters = { ...prev, vehicleId: reportType === 'consolidated' ? 'ALL' : initialVId };
          handleFetchReport(nextFilters);
          return nextFilters;
        });
      } else if (vRes.status === 'fulfilled' && vRes.value?.success && vRes.value?.data) {
        setVehicles(vRes.value.data);
        handleFetchReport();
      }
    }).catch(err => {
      console.error(err);
      if (isMounted) handleFetchReport();
    });

    return () => { isMounted = false; };
  }, [reportType]);

  const handlePreset = (preset) => {
    let sDate = getTodayString();
    let eDate = getTodayString();
    if (preset === 'yesterday') {
      sDate = getYesterdayString();
      eDate = getYesterdayString();
    } else if (preset === 'today') {
      sDate = getTodayString();
      eDate = getTodayString();
    } else if (preset === 'last7') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      sDate = getLocalDateString(d);
      eDate = getTodayString();
    }
    setActivePreset(preset);
    const updated = {
      ...filters,
      startDate: sDate,
      startTime: '00:00',
      endDate: eDate,
      endTime: '23:59'
    };
    setFilters(updated);
    handleFetchReport(updated);
  };

  // Helper to resolve clean, official dashboard group name for a vehicle
  const resolveVehicleGroup = useCallback((vId, row = {}) => {
    if (selectedGroup && selectedGroup !== 'All') {
      return selectedGroup;
    }
    const vMeta = vehicles.find(v => String(v.id) === String(vId));
    if (Array.isArray(groups) && groups.length > 0) {
      for (const g of groups) {
        const gNameClean = (g.name || '').trim();
        const gNameLower = gNameClean.toLowerCase();
        if (!gNameLower) continue;

        const matchArr = Array.isArray(vMeta?.groups) && vMeta.groups.some(vg => vg.id === g.id || (vg.name && vg.name.trim().toLowerCase() === gNameLower));
        const matchSingle = vMeta?.group?.id === g.id || (vMeta?.group?.name && vMeta.group.name.trim().toLowerCase() === gNameLower);
        const rawStr = (vMeta?.group_name || row?.group_name || '');
        const matchStr = rawStr.split(',').map(s => s.trim().toLowerCase()).includes(gNameLower);

        if (matchArr || matchSingle || matchStr) {
          return gNameClean;
        }
      }
    }
    return (vMeta?.group_name || vMeta?.group?.name || row?.group_name || 'General Fleet').trim();
  }, [selectedGroup, vehicles, groups]);

  // Filter data by category & search query
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const name = (item.vehicle_name || '').toLowerCase();
      const plate = (item.plate || '').toLowerCase();
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || name.includes(q) || plate.includes(q);

      const cat = (item.vehicle_category || 'moving').toLowerCase();
      let matchesCat = true;
      if (categoryFilter === 'MOVING') matchesCat = cat === 'moving';
      if (categoryFilter === 'MACHINERY') matchesCat = cat === 'machinery';
      if (categoryFilter === 'GENERATOR') matchesCat = cat === 'generator';
      if (categoryFilter === 'DISPENSER') matchesCat = cat === 'dispenser';

      let matchesGroup = true;
      if (selectedGroup !== 'All') {
        const resolvedG = resolveVehicleGroup(item.vehicle_id, item).trim().toLowerCase();
        const selG = selectedGroup.trim().toLowerCase();
        const rawG = (item.group_name || '').toLowerCase();
        const vMeta = vehicles.find(v => String(v.id) === String(item.vehicle_id));
        const gName = (vMeta?.group_name || vMeta?.group?.name || '').trim().toLowerCase();
        const matchArr = Array.isArray(vMeta?.groups) && vMeta.groups.some(g => (g.name || '').trim().toLowerCase() === selG);
        const matchStr = (vMeta?.group_name || '').split(',').map(s => s.trim().toLowerCase()).includes(selG);
        const matchRawStr = rawG.split(',').map(s => s.trim().toLowerCase()).includes(selG);
        matchesGroup = resolvedG === selG || gName === selG || matchArr || matchStr || matchRawStr || (!vMeta && !rawG);
      }

      return matchesSearch && matchesCat && matchesGroup;
    });
  }, [data, searchQuery, categoryFilter, selectedGroup, resolveVehicleGroup, vehicles]);

  // Sort filtered data based on user selection
  const sortedData = useMemo(() => {
    if (!sortField) return filteredData;
    return [...filteredData].sort((a, b) => {
      let valA, valB;
      if (sortField === 'org_name') {
        valA = resolveVehicleGroup(a.vehicle_id, a);
        valB = resolveVehicleGroup(b.vehicle_id, b);
      } else if (sortField === 'vehicle_name') {
        valA = a.vehicle_name || a.plate || '';
        valB = b.vehicle_name || b.plate || '';
      } else if (sortField === 'vehicle_mode') {
        valA = a.vehicle_category || '';
        valB = b.vehicle_category || '';
      } else if (sortField === 'vehicle_model') {
        const vA = vehicles.find(v => String(v.id) === String(a.vehicle_id));
        const vB = vehicles.find(v => String(v.id) === String(b.vehicle_id));
        valA = vA?.metadata?.model || vA?.model || '';
        valB = vB?.metadata?.model || vB?.model || '';
      } else if (sortField === 'start_fuel') {
        valA = parseFloat(a.start_fuel) || 0;
        valB = parseFloat(b.start_fuel) || 0;
      } else if (sortField === 'end_fuel') {
        valA = parseFloat(a.end_fuel) || 0;
        valB = parseFloat(b.end_fuel) || 0;
      } else if (sortField === 'refill') {
        valA = parseFloat(a.total_refill) || 0;
        valB = parseFloat(b.total_refill) || 0;
      } else if (sortField === 'theft') {
        valA = parseFloat(a.total_theft) || 0;
        valB = parseFloat(b.total_theft) || 0;
      } else if (sortField === 'consumption') {
        valA = parseFloat(a.consumption) || 0;
        valB = parseFloat(b.consumption) || 0;
      } else if (sortField === 'distance') {
        valA = parseFloat(a.distance_travelled) || 0;
        valB = parseFloat(b.distance_travelled) || 0;
      } else if (sortField === 'kmpl') {
        valA = parseFloat(a.kmpl) || 0;
        valB = parseFloat(b.kmpl) || 0;
      } else if (sortField === 'running_sec') {
        valA = parseFloat(a.running_seconds) || 0;
        valB = parseFloat(b.running_seconds) || 0;
      } else if (sortField === 'engine_sec') {
        valA = parseFloat(a.engine_on_seconds) || ((parseFloat(a.running_seconds) || 0) + (parseFloat(a.idle_seconds) || 0));
        valB = parseFloat(b.engine_on_seconds) || ((parseFloat(b.running_seconds) || 0) + (parseFloat(b.idle_seconds) || 0));
      } else if (sortField === 'idle_sec') {
        valA = parseFloat(a.idle_seconds) || 0;
        valB = parseFloat(b.idle_seconds) || 0;
      } else if (sortField === 'lph') {
        valA = parseFloat(a.lph) || 0;
        valB = parseFloat(b.lph) || 0;
      } else {
        valA = a[sortField] || 0;
        valB = b[sortField] || 0;
      }

      if (typeof valA === 'string') {
        const cmp = valA.localeCompare(valB, undefined, { sensitivity: 'base' });
        return sortDir === 'asc' ? cmp : -cmp;
      }
      return sortDir === 'asc' ? (valA - valB) : (valB - valA);
    });
  }, [filteredData, sortField, sortDir, resolveVehicleGroup, vehicles]);

  // Group rows by assigned group for group-wise sectioning
  const groupedRows = useMemo(() => {
    const map = new Map();
    sortedData.forEach(row => {
      const gName = resolveVehicleGroup(row.vehicle_id, row);
      if (!map.has(gName)) {
        map.set(gName, []);
      }
      map.get(gName).push(row);
    });
    return Array.from(map.entries());
  }, [sortedData, resolveVehicleGroup]);

  // Aggregate Metrics based on report type
  const metrics = useMemo(() => {
    let totalRefill = 0;
    let refillCount = 0;
    let maxRefill = 0;
    let totalDispensed = 0;

    let totalConsumed = 0;
    let totalTheft = 0;
    let theftCount = 0;
    let maxTheft = 0;

    let totalDistance = 0;
    let totalEngineSec = 0;
    let totalRunningSec = 0;
    let totalIdleSec = 0;

    let bestKmplVehicle = '-';
    let bestKmplVal = 0;

    let highestBurnVehicle = '-';
    let highestBurnVal = 0;

    filteredData.forEach(row => {
      const refill = parseFloat(row.total_refill || 0);
      const dispensed = parseFloat(row.total_dispensed || 0);
      const theft = parseFloat(row.total_theft || 0);
      const consumed = parseFloat(row.consumption || 0);
      const dist = parseFloat(row.distance_travelled || 0);
      const engSec = parseFloat(row.engine_on_seconds) || ((parseFloat(row.running_seconds) || 0) + (parseFloat(row.idle_seconds) || 0));
      const runSec = parseFloat(row.running_seconds || 0);
      const idleSec = parseFloat(row.idle_seconds || 0);

      totalRefill += refill;
      if (refill > 0) refillCount++;
      if (refill > maxRefill) maxRefill = refill;
      totalDispensed += dispensed;

      totalConsumed += consumed;
      totalTheft += theft;
      if (theft > 0) theftCount++;
      if (theft > maxTheft) maxTheft = theft;

      totalDistance += dist;
      totalEngineSec += engSec;
      totalRunningSec += runSec;
      totalIdleSec += idleSec;

      const kmpl = parseFloat(row.kmpl || 0);
      if (kmpl > bestKmplVal && dist > 5) {
        bestKmplVal = kmpl;
        bestKmplVehicle = row.vehicle_name || row.plate;
      }

      const lph = parseFloat(row.lph || 0);
      if (lph > highestBurnVal && engSec > 1800) {
        highestBurnVal = lph;
        highestBurnVehicle = row.vehicle_name || row.plate;
      }
    });

    const fleetAvgKmpl = totalConsumed > 0 ? (totalDistance / totalConsumed).toFixed(2) : '0.00';
    const fleetAvgLph = totalEngineSec > 0 ? ((totalConsumed / (totalEngineSec / 3600))).toFixed(2) : '0.00';

    return {
      totalRefill: Math.round(totalRefill),
      refillCount,
      maxRefill: Math.round(maxRefill),
      totalDispensed: Math.round(totalDispensed),
      totalConsumed: Math.round(totalConsumed),
      totalTheft: Math.round(totalTheft),
      theftCount,
      maxTheft: Math.round(maxTheft),
      totalDistance: Math.round(totalDistance),
      totalEngineSec,
      totalRunningSec,
      totalIdleSec,
      fleetAvgKmpl,
      bestKmplVehicle: bestKmplVal > 0 ? `${bestKmplVehicle} (${bestKmplVal.toFixed(2)})` : '-',
      fleetAvgLph,
      highestBurnVehicle: highestBurnVal > 0 ? `${highestBurnVehicle} (${highestBurnVal.toFixed(2)})` : '-'
    };
  }, [filteredData]);

  // Titles, Subtitles & Config
  const config = useMemo(() => {
    switch (reportType) {
      case 'refill':
        return {
          title: 'Fuel Refill Report',
          badgeText: 'Refill Audit Log',
          icon: Droplets,
          accentColor: '#059669',
          bannerBg: 'linear-gradient(135deg, #064E3B 0%, #047857 100%)',
          cards: [
            { label: 'Total Fuel Refilled', val: `+${metrics.totalRefill} L`, sub: `${metrics.refillCount} vehicles refilled`, color: '#059669', bg: '#ECFDF5' },
            { label: 'Max Single Refill', val: `+${metrics.maxRefill} L`, sub: 'Peak refill event', color: '#7C3AED', bg: '#F5F3FF' },
            { label: 'Total Dispensed', val: `${metrics.totalDispensed} L`, sub: 'Bowser / dispenser units', color: '#0284C7', bg: '#F0F9FF' },
            { label: 'Total Assets Monitored', val: `${filteredData.length}`, sub: 'Fleet sensors reporting', color: '#D97706', bg: '#FFFBEB' }
          ]
        };
      case 'theft':
        return {
          title: 'Fuel Theft Report',
          badgeText: 'Fuel Siphoning & Sudden Drop Audit',
          icon: AlertTriangle,
          accentColor: '#DC2626',
          bannerBg: 'linear-gradient(135deg, #7F1D1D 0%, #DC2626 100%)',
          cards: [
            { label: 'Total Suspected Theft', val: `${metrics.totalTheft} L`, sub: `${metrics.theftCount} vehicles affected`, color: '#DC2626', bg: '#FEF2F2' },
            { label: 'Peak Single Theft', val: `${metrics.maxTheft} L`, sub: 'Highest drop recorded', color: '#991B1B', bg: '#FEE2E2' },
            { label: 'Standard Consumed', val: `${metrics.totalConsumed} L`, sub: 'Operational consumption', color: '#D97706', bg: '#FFFBEB' },
            { label: 'Monitored Assets', val: `${filteredData.length}`, sub: 'Sensors online', color: '#0284C7', bg: '#F0F9FF' }
          ]
        };
      case 'consolidated':
        return {
          title: 'Fuel Consolidated Report',
          badgeText: 'Fleet Fuel, Theft & Efficiency Master Summary',
          icon: Droplets,
          accentColor: '#0284C7',
          bannerBg: 'linear-gradient(135deg, #075985 0%, #0284C7 100%)',
          cards: [
            { label: 'Total Consumed', val: `${metrics.totalConsumed} L`, sub: 'Fleet burn volume', color: '#EA580C', bg: '#FFF7ED' },
            { label: 'Total Refilled', val: `+${metrics.totalRefill} L`, sub: `${metrics.refillCount} refills completed`, color: '#059669', bg: '#ECFDF5' },
            { label: 'Total Suspected Theft', val: `${metrics.totalTheft} L`, sub: 'Unaccounted drops', color: '#DC2626', bg: '#FEF2F2' },
            { label: 'Fleet Avg Mileage', val: `${metrics.fleetAvgKmpl} km/L`, sub: 'Distance economy', color: '#4F46E5', bg: '#EEF2FF' }
          ]
        };
      case 'kmpl':
        return {
          title: 'KMPL Mileage Report',
          badgeText: 'Distance vs Fuel Economy',
          icon: Gauge,
          accentColor: '#0284C7',
          bannerBg: 'linear-gradient(135deg, #0C4A6E 0%, #0284C7 100%)',
          cards: [
            { label: 'Fleet Avg Mileage', val: `${metrics.fleetAvgKmpl} km/L`, sub: 'Combined fleet economy', color: '#0284C7', bg: '#F0F9FF' },
            { label: 'Total Distance', val: `${metrics.totalDistance} km`, sub: 'Total fleet travel', color: '#4F46E5', bg: '#EEF2FF' },
            { label: 'Total Fuel Used', val: `${metrics.totalConsumed} L`, sub: 'Consumed during trips', color: '#D97706', bg: '#FFFBEB' },
            { label: 'Top Mileage Asset', val: metrics.bestKmplVehicle, sub: 'Best fuel efficiency', color: '#059669', bg: '#ECFDF5' }
          ]
        };
      case 'lph':
        return {
          title: 'LPH Engine Burn Rate Report',
          badgeText: 'Engine Hours vs Fuel Burn',
          icon: Zap,
          accentColor: '#7C3AED',
          bannerBg: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%)',
          cards: [
            { label: 'Fleet Avg Burn Rate', val: `${metrics.fleetAvgLph} L/h`, sub: 'Litres burned per engine hour', color: '#7C3AED', bg: '#F5F3FF' },
            { label: 'Total Engine Hours', val: formatHours(metrics.totalEngineSec), sub: 'Combined ignition ON', color: '#0284C7', bg: '#F0F9FF' },
            { label: 'Total Fuel Burned', val: `${metrics.totalConsumed} L`, sub: 'Engine consumption', color: '#D97706', bg: '#FFFBEB' },
            { label: 'Peak Burn Asset', val: metrics.highestBurnVehicle, sub: 'Highest consumption rate', color: '#DC2626', bg: '#FEF2F2' }
          ]
        };
      case 'consumption':
      default:
        return {
          title: 'Fuel Consumption Report',
          badgeText: 'Net Fuel & Theft Audit',
          icon: Flame,
          accentColor: '#EA580C',
          bannerBg: 'linear-gradient(135deg, #7C2D12 0%, #EA580C 100%)',
          cards: [
            { label: 'Total Fuel Consumed', val: `${metrics.totalConsumed} L`, sub: 'Work & travel consumption', color: '#EA580C', bg: '#FFF7ED' },
            { label: 'Suspected Theft', val: `${metrics.totalTheft} L`, sub: 'Unauthorized drops', color: '#DC2626', bg: '#FEF2F2' },
            { label: 'Total Fuel Refilled', val: `+${metrics.totalRefill} L`, sub: 'Added to tanks', color: '#059669', bg: '#ECFDF5' },
            { label: 'Fleet Running Time', val: formatHours(metrics.totalRunningSec), sub: 'Active vehicle motion', color: '#4F46E5', bg: '#EEF2FF' }
          ]
        };
    }
  }, [reportType, metrics, filteredData.length]);

  // Build Exports based on report type
  const getExportData = () => {
    return filteredData.map((row, idx) => {
      const vName = row.vehicle_name || row.plate || 'Vehicle';
      const cat = (row.vehicle_category || 'moving').toUpperCase();

      if (reportType === 'refill') {
        return {
          'S.No': idx + 1,
          'Vehicle Name': vName,
          'Group Name': resolveVehicleGroup(row.vehicle_id, row),
          'Reg No': row.plate || '-',
          'Category': cat,
          'Start Fuel (L)': row.start_fuel != null ? row.start_fuel : '-',
          'End Fuel (L)': row.end_fuel != null ? row.end_fuel : '-',
          'Refill (+L)': row.total_refill || 0,
          'Dispensed (L)': row.total_dispensed || 0,
          'Consumed (L)': row.consumption != null ? row.consumption : '-',
          'Start Latitude': row.start_lat || '-',
          'Start Longitude': row.start_lng || '-',
          'End Latitude': row.end_lat || '-',
          'End Longitude': row.end_lng || '-'
        };
      }

      if (reportType === 'theft') {
        return {
          'S.No': idx + 1,
          'Vehicle Name': vName,
          'Reg No': row.plate || '-',
          'Category': cat,
          'Start Fuel (L)': row.start_fuel != null ? row.start_fuel : '-',
          'End Fuel (L)': row.end_fuel != null ? row.end_fuel : '-',
          'Suspected Theft (-L)': row.total_theft || 0,
          'Refill (+L)': row.total_refill || 0,
          'Consumed (L)': row.consumption != null ? row.consumption : '-',
          'Location': (row.start_lat && row.start_lng) ? `${row.start_lat}, ${row.start_lng}` : '-'
        };
      }

      if (reportType === 'consolidated') {
        const vMeta = vehicles.find(v => String(v.id) === String(row.vehicle_id));
        const vModel = vMeta?.metadata?.model || vMeta?.metadata?.make || vMeta?.model || 'ASHOK LEYLAND';
        const startKms = row.start_odometer || 0;
        const dist = parseFloat(row.distance_travelled || 0);
        const endKms = row.end_odometer || (startKms > 0 ? (startKms + Math.round(dist)) : Math.round(dist));

        return {
          'Organization Name': resolveVehicleGroup(row.vehicle_id, row),
          'Vehicle Name': vName,
          'Vehicle Mode': cat === 'moving' ? 'Moving Vehicle' : cat === 'generator' ? 'Generator DG' : cat === 'machinery' ? 'Machinery Asset' : 'Dispenser Bowser',
          'Vehicle Model': vModel,
          'Sensor': vMeta?.metadata?.sensorCount || 1,
          'Start Fuel': row.start_fuel != null ? parseFloat(row.start_fuel).toFixed(2) : '0.00',
          'End Fuel': row.end_fuel != null ? parseFloat(row.end_fuel).toFixed(2) : '0.00',
          'Fuel Filling': parseFloat(row.total_refill || 0).toFixed(2),
          'Fuel Theft': parseFloat(row.total_theft || 0).toFixed(2),
          'Fuel Consumption': row.consumption != null ? parseFloat(row.consumption).toFixed(2) : '0.00',
          'Start Kms': startKms,
          'End Kms': endKms,
          'Distance Travelled': dist.toFixed(1),
          'Kmpl': row.kmpl != null && row.kmpl > 0 ? parseFloat(row.kmpl).toFixed(2) : '-',
          'Running Hrs': formatHMS(row.running_seconds),
          'Engine ON Hours': formatHMS(row.engine_on_seconds || ((parseFloat(row.running_seconds) || 0) + (parseFloat(row.idle_seconds) || 0))),
          'Secondary Engine Hrs': '00:00:00',
          'Engine Idle Hrs': formatHMS(row.idle_seconds),
          'Ltr Per Hr': row.lph != null && row.lph > 0 ? parseFloat(row.lph).toFixed(2) : '0.00',
          'Start Loc': (row.start_lat && row.start_lng) ? `${row.start_lat}, ${row.start_lng}` : '-',
          'End Loc': (row.end_lat && row.end_lng) ? `${row.end_lat}, ${row.end_lng}` : '-',
          'Driver Name': vMeta?.driver_name || row.driver_name || '-',
          'Driver Mobile Number': vMeta?.driver_phone || row.driver_phone || '-',
          'Remarks': vMeta?.metadata?.sensor_id ? (`SENSOR: ${vMeta.metadata.sensor_id}`) : (row.remarks || '-')
        };
      }

      if (reportType === 'kmpl') {
        return {
          'S.No': idx + 1,
          'Vehicle Name': vName,
          'Group Name': resolveVehicleGroup(row.vehicle_id, row),
          'Reg No': row.plate || '-',
          'Category': cat,
          'Distance Travelled (km)': row.distance_travelled || 0,
          'Running Duration': formatHMS(row.running_seconds),
          'Fuel Consumed (L)': row.consumption != null ? row.consumption : '-',
          'Actual Mileage (km/L)': row.kmpl != null ? row.kmpl : '-',
          'Avg Speed (km/h)': row.avg_speed || 0,
          'Max Speed (km/h)': row.max_speed || 0
        };
      }

      if (reportType === 'lph') {
        return {
          'S.No': idx + 1,
          'Vehicle / Asset Name': vName,
          'Group Name': resolveVehicleGroup(row.vehicle_id, row),
          'Reg No': row.plate || '-',
          'Category': cat,
          'Engine ON Hours': formatHMS(row.engine_on_seconds || ((parseFloat(row.running_seconds) || 0) + (parseFloat(row.idle_seconds) || 0))),
          'Working / Moving Time': formatHMS(row.running_seconds),
          'Idle Time': formatHMS(row.idle_seconds),
          'Fuel Consumed (L)': row.consumption != null ? row.consumption : '-',
          'Burn Rate (L/h)': row.lph != null ? row.lph : '-'
        };
      }

      // Default consumption
      return {
        'S.No': idx + 1,
        'Vehicle Name': vName,
        'Reg No': row.plate || '-',
        'Category': cat,
        'Start Fuel (L)': row.start_fuel != null ? row.start_fuel : '-',
        'End Fuel (L)': row.end_fuel != null ? row.end_fuel : '-',
        'Refill (+L)': row.total_refill || 0,
        'Theft (-L)': row.total_theft || 0,
        'Net Consumed (L)': row.consumption != null ? row.consumption : '-',
        'Distance (km)': row.distance_travelled || 0,
        'Engine ON Time': formatHMS(row.engine_on_seconds || ((parseFloat(row.running_seconds) || 0) + (parseFloat(row.idle_seconds) || 0))),
        'Burn Rate (L/h)': row.lph != null ? row.lph : '-'
      };
    });
  };

  const IconComp = config.icon;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      width: '100%',
      height: '100%',
      minHeight: 0,
      overflow: 'hidden',
      background: '#F1F5F9',
      boxSizing: 'border-box'
    }}>
      {/* ═══════════ LEFT: GROUP ACCORDION VEHICLE SIDEBAR ═══════════ */}
      <ReportGroupVehicleSidebar
        vehicles={fuelCapableVehicles.length > 0 ? fuelCapableVehicles : vehicles}
        groups={groups}
        selectedVehicleId={filters.vehicleId}
        selectedGroupId={selectedGroup}
        showAllOption={true}
        onSelectVehicle={(id, meta) => {
          if (meta?.isAllInGroup) {
            setSelectedGroup(meta.groupName);
            const nextFilters = { ...filters, vehicleId: 'ALL' };
            setFilters(nextFilters);
            handleFetchReport(nextFilters, meta.groupName);
          } else if (meta?.isAll) {
            setSelectedGroup('All');
            const nextFilters = { ...filters, vehicleId: 'ALL' };
            setFilters(nextFilters);
            handleFetchReport(nextFilters, 'All');
          } else {
            const nextFilters = { ...filters, vehicleId: id };
            setFilters(nextFilters);
            handleFetchReport(nextFilters, selectedGroup);
          }
        }}
        onSelectGroup={(gName) => {
          setSelectedGroup(gName);
          const nextFilters = { ...filters, vehicleId: 'ALL' };
          setFilters(nextFilters);
          handleFetchReport(nextFilters, gName);
        }}
        width="175px"
      />

      {/* ═══════════ RIGHT: REPORT CONTENT ═══════════ */}
      <div style={{
        flex: 1,
        minWidth: 0,
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '8px 12px',
        boxSizing: 'border-box'
      }}>

      {/* 1. Header Box with Filter Controls (Compact Excel Ribbon) */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '6px',
        padding: '8px 12px',
        border: '1px solid #CBD5E1',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        flexShrink: 0
      }}>
        {/* Title row with Quick Presets */}
        {reportType === 'consolidated' ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '2px 0'
          }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Consolidated Fuel Report</span>
              <Info size={16} color="#0284C7" title="Consolidated fleet fuel, filling, theft, mileage and operational summary" style={{ cursor: 'pointer' }} />
            </h3>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <select
                value={selectedGroup}
                onChange={e => {
                  const newG = e.target.value;
                  setSelectedGroup(newG);
                  const updated = { ...filters, vehicleId: 'ALL' };
                  setFilters(updated);
                  handleFetchReport(updated, newG);
                }}
                style={{
                  padding: '5px 8px',
                  borderRadius: '5px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  outline: 'none',
                  minWidth: '130px'
                }}
              >
                {groupOptions.map(gName => (
                  <option key={gName} value={gName}>
                    {gName === 'All' ? 'All Groups' : gName}
                  </option>
                ))}
              </select>

              <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Select Date:</span>
              <TelematicsDatePicker
                value={filters.startDate}
                onChange={(isoDate) => {
                  setActivePreset(null);
                  setFilters(prev => ({ ...prev, startDate: isoDate, endDate: isoDate }));
                }}
              />
              <button
                type="button"
                onClick={() => handleFetchReport({ ...filters, vehicleId: 'ALL' })}
                disabled={loading}
                style={{
                  padding: '5px 16px',
                  borderRadius: '4px',
                  border: '1px solid #94A3B8',
                  background: '#F8FAFC',
                  color: '#0F172A',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: loading ? 'wait' : 'pointer'
                }}
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : null}
                Submit
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '22px', height: '14px', background: '#DC2626', display: 'inline-block', borderRadius: '2px' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>No Data Vehicles</span>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '26px', height: '26px', borderRadius: '6px',
                background: `${config.accentColor}18`,
                border: `1px solid ${config.accentColor}35`,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <IconComp size={15} color={config.accentColor} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{config.title}</span>
                </h3>
                <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 700, background: '#F8FAFC', padding: '2px 6px', borderRadius: '4px', border: '1px solid #E2E8F0', textTransform: 'uppercase' }}>
                  {config.badgeText}
                </span>
                <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>
                  • {formatBannerDateTime(filters.startDate, filters.startTime)} to {formatBannerDateTime(filters.endDate, filters.endTime)}
                </span>
              </div>
            </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => handlePreset('yesterday')}
              style={{
                padding: '4px 10px',
                borderRadius: '5px',
                border: activePreset === 'yesterday' ? '1px solid #059669' : '1px solid #CBD5E1',
                background: activePreset === 'yesterday' ? '#059669' : '#FFFFFF',
                color: activePreset === 'yesterday' ? '#FFFFFF' : '#334155',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => handlePreset('today')}
              style={{
                padding: '4px 10px',
                borderRadius: '5px',
                border: activePreset === 'today' ? '1px solid #059669' : '1px solid #CBD5E1',
                background: activePreset === 'today' ? '#059669' : '#FFFFFF',
                color: activePreset === 'today' ? '#FFFFFF' : '#334155',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handlePreset('last7')}
              style={{
                padding: '4px 10px',
                borderRadius: '5px',
                border: activePreset === 'last7' ? '1px solid #059669' : '1px solid #CBD5E1',
                background: activePreset === 'last7' ? '#059669' : '#FFFFFF',
                color: activePreset === 'last7' ? '#FFFFFF' : '#334155',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Last 7 Days
            </button>
          </div>
        </div>

        {/* Filters Controls Row */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '6px'
        }}>
          {/* Group Dropdown */}
          <select
            value={selectedGroup}
            onChange={e => {
              const newG = e.target.value;
              setSelectedGroup(newG);
              const updated = { ...filters, vehicleId: 'ALL' };
              setFilters(updated);
              handleFetchReport(updated, newG);
            }}
            style={{
              padding: '5px 8px',
              borderRadius: '5px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#0F172A',
              fontSize: '11.5px',
              fontWeight: 600,
              outline: 'none',
              minWidth: '130px'
            }}
            title="Filter by Vehicle Group"
          >
            <option value="All">All Groups</option>
            {groupOptions.filter(g => g !== 'All').map(gName => (
              <option key={gName} value={gName}>
                {gName}
              </option>
            ))}
          </select>

          {/* Vehicle Dropdown */}
          <select
            value={filters.vehicleId}
            onChange={e => {
              const newVId = e.target.value;
              const updated = { ...filters, vehicleId: newVId };
              setFilters(updated);
              handleFetchReport(updated);
            }}
            style={{
              padding: '5px 8px',
              borderRadius: '5px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#0F172A',
              fontSize: '11.5px',
              fontWeight: 600,
              outline: 'none',
              minWidth: '160px'
            }}
          >
            <option value="ALL">
              {selectedGroup === 'All'
                ? `── All Fuel Vehicles (${groupFilteredVehicles.length}) ──`
                : `── All in ${selectedGroup} (${groupFilteredVehicles.length}) ──`}
            </option>
            {groupFilteredVehicles.map(v => (
              <option key={v.id} value={v.id}>
                {v.name} {v.plate ? `(${v.plate})` : ''}
              </option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            style={{
              padding: '5px 8px',
              borderRadius: '5px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#0F172A',
              fontSize: '11.5px',
              fontWeight: 600,
              outline: 'none'
            }}
          >
            <option value="ALL">All Categories</option>
            <option value="MOVING">Moving Vehicles</option>
            <option value="MACHINERY">Machinery (JCB/Rig)</option>
            <option value="GENERATOR">Generators (DG)</option>
            <option value="DISPENSER">Fuel Dispensers</option>
          </select>

          {/* From Date */}
          <TelematicsDatePicker
            value={filters.startDate}
            onChange={(isoDate) => {
              setActivePreset(null);
              setFilters(prev => ({ ...prev, startDate: isoDate }));
            }}
          />

          {/* From Time */}
          <TelematicsTimePicker
            value={filters.startTime}
            onChange={(time24) => {
              setActivePreset(null);
              setFilters(prev => ({ ...prev, startTime: time24 }));
            }}
          />

          {/* To Date */}
          <TelematicsDatePicker
            value={filters.endDate}
            onChange={(isoDate) => {
              setActivePreset(null);
              setFilters(prev => ({ ...prev, endDate: isoDate }));
            }}
          />

          {/* To Time */}
          <TelematicsTimePicker
            value={filters.endTime}
            onChange={(time24) => {
              setActivePreset(null);
              setFilters(prev => ({ ...prev, endTime: time24 }));
            }}
          />

          {/* Submit Button */}
          <button
            type="button"
            onClick={() => handleFetchReport()}
            disabled={loading}
            style={{
              padding: '5px 14px',
              borderRadius: '5px',
              border: 'none',
              background: config.accentColor,
              color: '#FFFFFF',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              boxShadow: `0 1px 3px ${config.accentColor}40`
            }}
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : null}
            Submit
          </button>

          {/* Search Box */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
            <Search size={13} color="#94A3B8" style={{ position: 'absolute', left: '8px' }} />
            <input
              type="text"
              placeholder="Search vehicle / plate..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                padding: '5px 8px 5px 26px',
                borderRadius: '5px',
                border: '1px solid #CBD5E1',
                fontSize: '11.5px',
                outline: 'none',
                width: '160px',
                color: '#0F172A'
              }}
            />
          </div>

          {/* Export Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <button
              type="button"
              onClick={() => exportToExcel(getExportData(), config.title.replace(/\s+/g, '_'))}
              disabled={filteredData.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 10px',
                borderRadius: '5px',
                border: 'none',
                background: filteredData.length === 0 ? '#E2E8F0' : '#10B981',
                color: '#FFFFFF',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: filteredData.length === 0 ? 'not-allowed' : 'pointer'
              }}
              title="Export to Excel"
            >
              <FileSpreadsheet size={12} />
              Excel
            </button>
            <button
              type="button"
              onClick={() => exportToPDF(Object.keys(getExportData()[0] || {}), getExportData(), config.title.replace(/\s+/g, '_'))}
              disabled={filteredData.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 10px',
                borderRadius: '5px',
                border: 'none',
                background: filteredData.length === 0 ? '#E2E8F0' : '#EF4444',
                color: '#FFFFFF',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: filteredData.length === 0 ? 'not-allowed' : 'pointer'
              }}
              title="Export to PDF"
            >
              <FileText size={12} />
              PDF
            </button>
          </div>
        </div>
      </>
    )}
      </div>

      {/* 2. Compact KPI Summary Bar OR Consolidated 2-Column Matrix */}
      {reportType === 'consolidated' ? (
        <div style={{
          background: '#FFFFFF',
          borderRadius: '5px',
          border: '1px solid #CBD5E1',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          flexShrink: 0
        }}>
          {/* Header of summary: Date & Time on left, Excel/CSV/PDF export buttons on right */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 12px',
            background: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 800, color: '#0F172A' }}>
              <span>Date & Time:</span>
              <span style={{ color: '#0284C7', fontFamily: 'monospace' }}>
                {filters.startDate === filters.endDate ? filters.startDate : `${filters.startDate} to ${filters.endDate}`}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => exportToExcel(getExportData(), 'Consolidated_Fuel_Report')}
                disabled={filteredData.length === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: 'none',
                  background: filteredData.length === 0 ? '#E2E8F0' : '#10B981',
                  color: '#FFFFFF',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: filteredData.length === 0 ? 'not-allowed' : 'pointer',
                  boxShadow: '0 1px 2px rgba(16,185,129,0.3)'
                }}
                title="Export to Excel"
              >
                <FileSpreadsheet size={13} />
                Excel
              </button>
              <button
                type="button"
                onClick={() => exportToCSV(getExportData(), 'Consolidated_Fuel_Report')}
                disabled={filteredData.length === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: 'none',
                  background: filteredData.length === 0 ? '#E2E8F0' : '#0284C7',
                  color: '#FFFFFF',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: filteredData.length === 0 ? 'not-allowed' : 'pointer',
                  boxShadow: '0 1px 2px rgba(2,132,199,0.3)'
                }}
                title="Export to CSV"
              >
                <FileCode size={13} />
                CSV
              </button>
              <button
                type="button"
                onClick={() => exportToPDF(Object.keys(getExportData()[0] || {}), getExportData(), 'Consolidated Fuel Report', 'Consolidated_Fuel_Report')}
                disabled={filteredData.length === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: 'none',
                  background: filteredData.length === 0 ? '#E2E8F0' : '#EF4444',
                  color: '#FFFFFF',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: filteredData.length === 0 ? 'not-allowed' : 'pointer',
                  boxShadow: '0 1px 2px rgba(239,68,68,0.3)'
                }}
                title="Export to PDF"
              >
                <FileText size={13} />
                PDF
              </button>
            </div>
          </div>

          {/* 2-Column Key-Value Grid matching legacy matrix */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                <td style={{ padding: '6px 12px', width: '25%', color: '#475569', fontWeight: 600, background: '#F8FAFC', borderRight: '1px solid #E2E8F0' }}>Total Fuel Consumption</td>
                <td style={{ padding: '6px 12px', width: '25%', fontWeight: 800, color: '#EA580C', borderRight: '1px solid #E2E8F0', fontFamily: 'monospace' }}>{metrics.totalConsumed.toFixed(2)}</td>
                <td style={{ padding: '6px 12px', width: '25%', color: '#475569', fontWeight: 600, background: '#F8FAFC', borderRight: '1px solid #E2E8F0' }}>Total Fuel Fill</td>
                <td style={{ padding: '6px 12px', width: '25%', fontWeight: 800, color: '#059669', fontFamily: 'monospace' }}>{metrics.totalRefill.toFixed(2)}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                <td style={{ padding: '6px 12px', color: '#475569', fontWeight: 600, background: '#F8FAFC', borderRight: '1px solid #E2E8F0' }}>Total Distance</td>
                <td style={{ padding: '6px 12px', fontWeight: 800, color: '#0F172A', borderRight: '1px solid #E2E8F0', fontFamily: 'monospace' }}>{metrics.totalDistance}</td>
                <td style={{ padding: '6px 12px', color: '#475569', fontWeight: 600, background: '#F8FAFC', borderRight: '1px solid #E2E8F0' }}>Total Fuel Theft</td>
                <td style={{ padding: '6px 12px', fontWeight: 800, color: metrics.totalTheft > 0 ? '#DC2626' : '#64748B', fontFamily: 'monospace' }}>{metrics.totalTheft.toFixed(2)}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                <td style={{ padding: '6px 12px', color: '#475569', fontWeight: 600, background: '#F8FAFC', borderRight: '1px solid #E2E8F0' }}>Total Engine Idle Hrs</td>
                <td style={{ padding: '6px 12px', fontWeight: 800, color: '#0284C7', borderRight: '1px solid #E2E8F0', fontFamily: 'monospace' }}>{formatHMS(metrics.totalIdleSec)}</td>
                <td style={{ padding: '6px 12px', color: '#475569', fontWeight: 600, background: '#F8FAFC', borderRight: '1px solid #E2E8F0' }}>Total Engine ON Hours</td>
                <td style={{ padding: '6px 12px', fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>{formatHMS(metrics.totalEngineSec)}</td>
              </tr>
              <tr>
                <td style={{ padding: '6px 12px', color: '#475569', fontWeight: 600, background: '#F8FAFC', borderRight: '1px solid #E2E8F0' }}>KMPL</td>
                <td style={{ padding: '6px 12px', fontWeight: 800, color: '#4F46E5', borderRight: '1px solid #E2E8F0', fontFamily: 'monospace' }}>{metrics.fleetAvgKmpl}</td>
                <td style={{ padding: '6px 12px', color: '#475569', fontWeight: 600, background: '#F8FAFC', borderRight: '1px solid #E2E8F0' }}>LTPH</td>
                <td style={{ padding: '6px 12px', fontWeight: 800, color: '#0F766E', fontFamily: 'monospace' }}>{metrics.fleetAvgLph}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '6px',
          flexShrink: 0
        }}>
          {config.cards.map((card, cIdx) => (
            <div
              key={cIdx}
              style={{
                background: '#FFFFFF',
                borderRadius: '5px',
                padding: '6px 12px',
                border: '1px solid #CBD5E1',
                borderLeft: `4px solid ${card.color}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
              }}
            >
              <span style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {card.label}
              </span>
              <span style={{ fontSize: '14.5px', fontWeight: 800, color: card.color, fontFamily: 'monospace, "SF Mono", monospace' }}>
                {card.val}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 3. Excel Format Data Table */}
      <div style={{
        flex: 1,
        minHeight: 0,
        background: '#FFFFFF',
        borderRadius: '5px',
        border: '1px solid #CBD5E1',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {loading ? (
          <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Loader2 size={24} className="animate-spin text-emerald-600" />
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Loading telematics data...</div>
          </div>
        ) : filteredData.length === 0 ? (
          <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Info size={28} color="#94A3B8" />
            <div style={{ fontSize: '13px', color: '#334155', fontWeight: 700 }}>No telemetry records found</div>
            <div style={{ fontSize: '11.5px', color: '#64748B' }}>Try selecting another date range or vehicle.</div>
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px', color: '#0F172A', minWidth: '850px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                {reportType === 'consolidated' ? (
                  <tr style={{ background: '#0F172A' }}>
                    <th onClick={() => handleSort('org_name')} style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>Organization Name <ArrowUpDown size={10} /></div>
                    </th>
                    <th onClick={() => handleSort('vehicle_name')} style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>Vehicle Name <ArrowUpDown size={10} /></div>
                    </th>
                    <th onClick={() => handleSort('vehicle_mode')} style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', cursor: 'pointer', userSelect: 'none', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>Vehicle Mode <ArrowUpDown size={10} /></div>
                    </th>
                    <th onClick={() => handleSort('vehicle_model')} style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', cursor: 'pointer', userSelect: 'none', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>Vehicle Model <ArrowUpDown size={10} /></div>
                    </th>
                    <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      Sensor
                    </th>
                    <th onClick={() => handleSort('start_fuel')} style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'right', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px' }}>Start Fuel <ArrowUpDown size={10} /></div>
                    </th>
                    <th onClick={() => handleSort('end_fuel')} style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'right', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px' }}>End Fuel <ArrowUpDown size={10} /></div>
                    </th>
                    <th onClick={() => handleSort('refill')} style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'right', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px' }}>Fuel Filling <ArrowUpDown size={10} /></div>
                    </th>
                    <th onClick={() => handleSort('theft')} style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'right', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px' }}>Fuel Theft <ArrowUpDown size={10} /></div>
                    </th>
                    <th onClick={() => handleSort('consumption')} style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'right', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px' }}>Fuel Consumption <ArrowUpDown size={10} /></div>
                    </th>
                    <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      Start Kms
                    </th>
                    <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      End Kms
                    </th>
                    <th onClick={() => handleSort('distance')} style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'right', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px' }}>Distance Travelled <ArrowUpDown size={10} /></div>
                    </th>
                    <th onClick={() => handleSort('kmpl')} style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'center', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>Kmpl <ArrowUpDown size={10} /></div>
                    </th>
                    <th onClick={() => handleSort('running_sec')} style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'center', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>Running Hrs <ArrowUpDown size={10} /></div>
                    </th>
                    <th onClick={() => handleSort('engine_sec')} style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'center', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>Engine ON Hours <ArrowUpDown size={10} /></div>
                    </th>
                    <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      Secondary Engine Hrs
                    </th>
                    <th onClick={() => handleSort('idle_sec')} style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'center', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>Engine Idle Hrs <ArrowUpDown size={10} /></div>
                    </th>
                    <th onClick={() => handleSort('lph')} style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'center', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>Ltr Per Hr <ArrowUpDown size={10} /></div>
                    </th>
                    <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      Start Loc
                    </th>
                    <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      End Loc
                    </th>
                    <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      Driver Name
                    </th>
                    <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      Driver Mobile Number
                    </th>
                    <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'left', whiteSpace: 'nowrap' }}>
                      Remarks
                    </th>
                  </tr>
                ) : (
                  <tr style={{ background: '#0F172A' }}>
                    <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', width: '38px', textAlign: 'center' }}>#</th>
                    <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)' }}>Vehicle Name</th>
                    <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'center' }}>Category</th>

                    {/* Type-Specific Table Headers */}
                    {reportType === 'refill' && (
                      <>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'right' }}>Start Fuel</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'right' }}>End Fuel</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'center' }}>Refill Quantity</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'right' }}>Dispensed</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'right' }}>Consumed</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)' }}>Refill Location</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'center' }}>Status</th>
                      </>
                    )}

                    {reportType === 'theft' && (
                      <>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'right' }}>Start Fuel</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'right' }}>End Fuel</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'center' }}>Suspected Theft</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'right' }}>Refill (+L)</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'right' }}>Consumed</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)' }}>Location</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'center' }}>Severity</th>
                      </>
                    )}

                    {reportType === 'kmpl' && (
                      <>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'right' }}>Distance</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'center' }}>Running Time</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'right' }}>Fuel Consumed</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'center' }}>Actual Mileage</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'right' }}>Avg Speed</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'right' }}>Max Speed</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'center' }}>Rating</th>
                      </>
                    )}

                    {reportType === 'lph' && (
                      <>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'center' }}>Engine ON</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'center' }}>Working Time</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'center' }}>Idle Time</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'right' }}>Fuel Consumed</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'center' }}>Burn Rate</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'center' }}>Efficiency</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'right' }}>Current Fuel</th>
                      </>
                    )}

                    {reportType === 'consumption' && (
                      <>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'right' }}>Start Fuel</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'right' }}>End Fuel</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'right' }}>Refill (+L)</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'right' }}>Theft (-L)</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'center' }}>Net Consumed</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'right' }}>Distance</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'center' }}>Engine Hours</th>
                        <th style={{ padding: '6px 8px', background: '#0F172A', color: '#FFFFFF', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.03em', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'center' }}>Status</th>
                      </>
                    )}
                  </tr>
                )}
              </thead>
              {reportType === 'consolidated' ? (
                <>
                  <tbody>
                    {sortedData.map((row, idx) => {
                      const cat = (row.vehicle_category || 'moving').toLowerCase();
                      const refill = parseFloat(row.total_refill || 0);
                      const theft = parseFloat(row.total_theft || 0);
                      const consumed = row.consumption != null ? parseFloat(row.consumption) : null;
                      const kmpl = row.kmpl != null ? parseFloat(row.kmpl) : null;
                      const lph = row.lph != null ? parseFloat(row.lph) : null;

                      const vMeta = vehicles.find(v => String(v.id) === String(row.vehicle_id));
                      const vModel = vMeta?.metadata?.model || vMeta?.metadata?.make || vMeta?.model || 'ASHOK LEYLAND';
                      const startKms = row.start_odometer || 0;
                      const dist = parseFloat(row.distance_travelled || 0);
                      const endKms = row.end_odometer || (startKms > 0 ? (startKms + Math.round(dist)) : Math.round(dist));

                      const isNoData = (!row.distance_travelled || Number(row.distance_travelled) === 0) &&
                                       (!row.consumption || Number(row.consumption) === 0) &&
                                       (!row.total_refill || Number(row.total_refill) === 0) &&
                                       (!row.start_fuel || Number(row.start_fuel) === 0);

                      const textColor = isNoData ? '#DC2626' : undefined;
                      const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';

                      return (
                        <tr
                          key={row.vehicle_id || idx}
                          style={{
                            background: bg,
                            color: textColor || '#0F172A',
                            transition: 'background 0.1s ease'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = isNoData ? '#FEE2E2' : '#F0F9FF'}
                          onMouseLeave={e => e.currentTarget.style.background = bg}
                        >
                          {/* 1. Organization Name */}
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', color: textColor || '#0F172A', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {resolveVehicleGroup(row.vehicle_id, row)}
                          </td>
                          {/* 2. Vehicle Name */}
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', color: textColor || '#0F172A', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {row.vehicle_name || row.plate || '-'}
                          </td>
                          {/* 3. Vehicle Mode */}
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', color: textColor || '#475569', textAlign: 'center', fontSize: '11px', whiteSpace: 'nowrap' }}>
                            {cat === 'moving' ? 'Moving Vehicle' : cat === 'generator' ? 'Generator DG' : cat === 'machinery' ? 'Machinery Asset' : 'Dispenser Bowser'}
                          </td>
                          {/* 4. Vehicle Model */}
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', color: textColor || '#334155', textAlign: 'center', fontSize: '11px', whiteSpace: 'nowrap' }}>
                            {vModel}
                          </td>
                          {/* 5. Sensor */}
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', color: textColor || '#334155', textAlign: 'center', fontFamily: 'monospace' }}>
                            {vMeta?.metadata?.sensorCount || 1}
                          </td>
                          {/* 6. Start Fuel */}
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', color: textColor || '#0F172A', textAlign: 'right', fontFamily: 'monospace' }}>
                            {row.start_fuel != null ? parseFloat(row.start_fuel).toFixed(2) : '0.00'}
                          </td>
                          {/* 7. End Fuel */}
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', color: textColor || '#0F172A', textAlign: 'right', fontFamily: 'monospace' }}>
                            {row.end_fuel != null ? parseFloat(row.end_fuel).toFixed(2) : '0.00'}
                          </td>
                          {/* 8. Fuel Filling */}
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', color: textColor || '#059669', textAlign: 'right', fontFamily: 'monospace', fontWeight: refill > 0 ? 700 : 400 }}>
                            {refill.toFixed(2)}
                          </td>
                          {/* 9. Fuel Theft */}
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', color: textColor || (theft > 0 ? '#DC2626' : '#64748B'), textAlign: 'right', fontFamily: 'monospace', fontWeight: theft > 0 ? 700 : 400 }}>
                            {theft.toFixed(2)}
                          </td>
                          {/* 10. Fuel Consumption */}
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', color: textColor || '#EA580C', textAlign: 'right', fontFamily: 'monospace', fontWeight: consumed > 0 ? 700 : 400 }}>
                            {consumed != null ? parseFloat(consumed).toFixed(2) : '0.00'}
                          </td>
                          {/* 11. Start Kms */}
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', color: textColor || '#334155', textAlign: 'right', fontFamily: 'monospace' }}>
                            {startKms}
                          </td>
                          {/* 12. End Kms */}
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', color: textColor || '#334155', textAlign: 'right', fontFamily: 'monospace' }}>
                            {endKms}
                          </td>
                          {/* 13. Distance Travelled */}
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', color: textColor || '#0F172A', textAlign: 'right', fontFamily: 'monospace', fontWeight: dist > 0 ? 700 : 400 }}>
                            {dist > 0 ? (dist % 1 === 0 ? dist.toFixed(0) : dist.toFixed(1)) : '0'}
                          </td>
                          {/* 14. Kmpl */}
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', color: textColor || '#4F46E5', textAlign: 'center', fontFamily: 'monospace', fontWeight: kmpl > 0 ? 700 : 400 }}>
                            {kmpl != null && kmpl > 0 ? kmpl.toFixed(2) : '-'}
                          </td>
                          {/* 15. Running Hrs */}
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', color: textColor || '#0F172A', textAlign: 'center', fontFamily: 'monospace' }}>
                            {formatHMS(row.running_seconds)}
                          </td>
                          {/* 16. Engine ON Hours */}
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', color: textColor || '#0284C7', textAlign: 'center', fontFamily: 'monospace' }}>
                            {formatHMS(row.engine_on_seconds || ((parseFloat(row.running_seconds) || 0) + (parseFloat(row.idle_seconds) || 0)))}
                          </td>
                          {/* 17. Secondary Engine Hrs */}
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', color: textColor || '#64748B', textAlign: 'center', fontFamily: 'monospace' }}>
                            00:00:00
                          </td>
                          {/* 18. Engine Idle Hrs */}
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', color: textColor || '#D97706', textAlign: 'center', fontFamily: 'monospace' }}>
                            {formatHMS(row.idle_seconds)}
                          </td>
                          {/* 19. Ltr Per Hr */}
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', color: textColor || '#0F766E', textAlign: 'center', fontFamily: 'monospace' }}>
                            {lph != null && lph > 0 ? (lph % 1 === 0 ? lph.toFixed(0) : lph.toFixed(2)) : '0'}
                          </td>
                          {/* 20. Start Loc */}
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', textAlign: 'center', fontSize: '11px', whiteSpace: 'nowrap' }}>
                            {row.start_lat && row.start_lng ? (
                              <a
                                href={`https://www.google.com/maps?q=${row.start_lat},${row.start_lng}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: '#0284C7', textDecoration: 'underline', fontWeight: 600 }}
                              >
                                Link
                              </a>
                            ) : (
                              <span style={{ color: textColor || '#94A3B8' }}>Link</span>
                            )}
                          </td>
                          {/* 21. End Loc */}
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', textAlign: 'center', fontSize: '11px', whiteSpace: 'nowrap' }}>
                            {row.end_lat && row.end_lng ? (
                              <a
                                href={`https://www.google.com/maps?q=${row.end_lat},${row.end_lng}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: '#0284C7', textDecoration: 'underline', fontWeight: 600 }}
                              >
                                Link
                              </a>
                            ) : (
                              <span style={{ color: textColor || '#94A3B8' }}>Link</span>
                            )}
                          </td>
                          {/* 22. Driver Name */}
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', color: textColor || '#334155', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {vMeta?.driver_name || row.driver_name || '-'}
                          </td>
                          {/* 23. Driver Mobile Number */}
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', color: textColor || '#334155', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {vMeta?.driver_phone || row.driver_phone || '-'}
                          </td>
                          {/* 24. Remarks */}
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', color: textColor || '#475569', fontSize: '10.5px', whiteSpace: 'nowrap' }}>
                            {vMeta?.metadata?.sensor_id ? `SENSOR: ${vMeta.metadata.sensor_id}` : (row.remarks || '-')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 5, background: '#F8FAFC' }}>
                    <tr style={{ background: '#F1F5F9', borderTop: '2px solid #CBD5E1', fontWeight: 800 }}>
                      <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1' }}></td>
                      <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', color: '#0F172A', fontWeight: 800 }}>Total</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1' }}></td>
                      <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1' }}></td>
                      <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1' }}></td>
                      <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontFamily: 'monospace' }}>-</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontFamily: 'monospace' }}>-</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontFamily: 'monospace', color: '#059669', fontWeight: 800 }}>
                        {metrics.totalRefill.toFixed(2)}
                      </td>
                      <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontFamily: 'monospace', color: metrics.totalTheft > 0 ? '#DC2626' : '#64748B', fontWeight: 800 }}>
                        {metrics.totalTheft.toFixed(2)}
                      </td>
                      <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontFamily: 'monospace', color: '#EA580C', fontWeight: 800 }}>
                        {metrics.totalConsumed.toFixed(2)}
                      </td>
                      <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontFamily: 'monospace' }}>-</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontFamily: 'monospace' }}>-</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontFamily: 'monospace', color: '#0F172A', fontWeight: 800 }}>
                        {metrics.totalDistance}
                      </td>
                      <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', textAlign: 'center', fontFamily: 'monospace', color: '#4F46E5', fontWeight: 800 }}>
                        {metrics.fleetAvgKmpl}
                      </td>
                      <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800 }}>
                        {formatHMS(metrics.totalRunningSec)}
                      </td>
                      <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', textAlign: 'center', fontFamily: 'monospace', color: '#0284C7', fontWeight: 800 }}>
                        {formatHMS(metrics.totalEngineSec)}
                      </td>
                      <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800 }}>
                        00:00:00
                      </td>
                      <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', textAlign: 'center', fontFamily: 'monospace', color: '#D97706', fontWeight: 800 }}>
                        {formatHMS(metrics.totalIdleSec)}
                      </td>
                      <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800 }}>
                        {metrics.fleetAvgLph != null && parseFloat(metrics.fleetAvgLph) > 0 ? metrics.fleetAvgLph : '0'}
                      </td>
                      <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1' }}></td>
                      <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1' }}></td>
                      <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1' }}></td>
                      <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1' }}></td>
                      <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1' }}></td>
                    </tr>
                  </tfoot>
                </>
              ) : (
                <tbody>
                  {groupedRows.map(([gName, rows], gIdx) => {
                    const gConsumed = rows.reduce((acc, r) => acc + (parseFloat(r.consumption) || 0), 0);
                    const gRefill = rows.reduce((acc, r) => acc + (parseFloat(r.total_refill) || 0), 0);
                    const gTheft = rows.reduce((acc, r) => acc + (parseFloat(r.total_theft) || 0), 0);
                    const gDist = rows.reduce((acc, r) => acc + (parseFloat(r.distance_travelled) || 0), 0);
                    const gKmpl = gConsumed > 0 ? (gDist / gConsumed).toFixed(2) : '-';

                    return (
                      <React.Fragment key={gName || gIdx}>
                        {/* Group Header Strip with Group Totals */}
                        <tr style={{ background: '#E0F2FE', borderTop: '2px solid #0284C7', borderBottom: '1px solid #BAE6FD' }}>
                          <td colSpan={22} style={{ padding: '6px 10px', fontWeight: 800, fontSize: '11.5px', color: '#0369A1', textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0284C7', display: 'inline-block' }} />
                                Group: {gName} ({rows.length} {rows.length === 1 ? 'Vehicle' : 'Vehicles'})
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '11px', fontWeight: 700, color: '#0F172A' }}>
                                <span>Distance: <strong style={{ color: '#0284C7' }}>{Math.round(gDist)} km</strong></span>
                                <span>Refill: <strong style={{ color: '#059669' }}>+{Math.round(gRefill)} L</strong></span>
                                <span>Theft: <strong style={{ color: gTheft > 0 ? '#DC2626' : '#64748B' }}>{Math.round(gTheft)} L</strong></span>
                                <span>Consumed: <strong style={{ color: '#EA580C' }}>{Math.round(gConsumed)} L</strong></span>
                                <span>Avg Mileage: <strong style={{ color: '#4F46E5' }}>{gKmpl} km/L</strong></span>
                              </div>
                            </div>
                          </td>
                        </tr>

                        {rows.map((row, idx) => {
                          const cat = (row.vehicle_category || 'moving').toLowerCase();
                          const refill = parseFloat(row.total_refill || 0);
                          const dispensed = parseFloat(row.total_dispensed || 0);
                          const theft = parseFloat(row.total_theft || 0);
                          const consumed = row.consumption != null ? parseFloat(row.consumption) : null;
                          const kmpl = row.kmpl != null ? parseFloat(row.kmpl) : null;
                          const lph = row.lph != null ? parseFloat(row.lph) : null;

                          const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';

                          return (
                            <tr
                              key={row.vehicle_id || idx}
                              style={{
                                background: bg,
                                transition: 'background 0.1s ease'
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = '#F0F9FF'}
                              onMouseLeave={e => e.currentTarget.style.background = bg}
                            >
                              <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'center', color: '#64748B', fontWeight: 600 }}>
                                {idx + 1}
                              </td>

                              {/* Vehicle Name */}
                              <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', whiteSpace: 'nowrap' }}>
                                <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>{row.vehicle_name || 'Vehicle'}</span>
                                  {row.plate && (
                                    <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600, background: '#F1F5F9', padding: '1px 5px', borderRadius: '3px', border: '1px solid #E2E8F0' }}>
                                      {row.plate}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Category Badge */}
                              <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <span style={{
                                  padding: '1px 6px',
                                  borderRadius: '3px',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.02em',
                                  background: cat === 'generator' ? '#FEF3C7' : cat === 'machinery' ? '#E0E7FF' : cat === 'dispenser' ? '#CCFBF1' : '#F1F5F9',
                                  color: cat === 'generator' ? '#B45309' : cat === 'machinery' ? '#4338CA' : cat === 'dispenser' ? '#0F766E' : '#475569',
                                  border: '1px solid rgba(0,0,0,0.06)'
                                }}>
                                  {cat}
                                </span>
                              </td>

                              {/* REFILL REPORT ROWS */}
                              {reportType === 'refill' && (
                                <>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontFamily: 'monospace', color: '#334155' }}>
                                    {row.start_fuel != null ? `${row.start_fuel} L` : '-'}
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontFamily: 'monospace', color: '#334155' }}>
                                    {row.end_fuel != null ? `${row.end_fuel} L` : '-'}
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'center', fontFamily: 'monospace' }}>
                                    {refill > 0 ? (
                                      <span style={{
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        background: '#ECFDF5',
                                        border: '1px solid #A7F3D0',
                                        color: '#047857',
                                        fontWeight: 800,
                                        fontSize: '11px'
                                      }}>
                                        +{refill} L
                                      </span>
                                    ) : (
                                      <span style={{ color: '#94A3B8', fontWeight: 600 }}>0 L</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#0284C7' }}>
                                    {dispensed > 0 ? `${dispensed} L` : '-'}
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#D97706' }}>
                                    {consumed != null ? `${consumed} L` : '-'}
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', maxWidth: '200px', fontSize: '10.5px', color: '#334155', lineHeight: 1.2 }}>
                                    {(row.start_lat && row.start_lng) ? (
                                      <AddressText lat={row.start_lat} lng={row.start_lng} />
                                    ) : (
                                      <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Location unavailable</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'center' }}>
                                    {refill > 0 ? (
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#059669', fontWeight: 700, fontSize: '10.5px' }}>
                                        <CheckCircle2 size={12} /> Refilled
                                      </span>
                                    ) : (
                                      <span style={{ color: '#94A3B8', fontSize: '10.5px' }}>Normal</span>
                                    )}
                                  </td>
                                </>
                              )}

                              {/* THEFT REPORT ROWS */}
                              {reportType === 'theft' && (
                                <>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontFamily: 'monospace', color: '#334155' }}>
                                    {row.start_fuel != null ? `${row.start_fuel} L` : '-'}
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontFamily: 'monospace', color: '#334155' }}>
                                    {row.end_fuel != null ? `${row.end_fuel} L` : '-'}
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'center', fontFamily: 'monospace' }}>
                                    {theft > 0 ? (
                                      <span style={{
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        background: '#FEF2F2',
                                        border: '1px solid #FECACA',
                                        color: '#DC2626',
                                        fontWeight: 800,
                                        fontSize: '11px'
                                      }}>
                                        -{theft} L
                                      </span>
                                    ) : (
                                      <span style={{ color: '#059669', fontWeight: 600, fontSize: '11px' }}>0 L</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#059669' }}>
                                    {refill > 0 ? `+${refill} L` : '-'}
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#D97706' }}>
                                    {consumed != null ? `${consumed} L` : '-'}
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', maxWidth: '200px', fontSize: '10.5px', color: '#334155', lineHeight: 1.2 }}>
                                    {(row.start_lat && row.start_lng) ? (
                                      <AddressText lat={row.start_lat} lng={row.start_lng} />
                                    ) : (
                                      <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Location unavailable</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'center' }}>
                                    {theft >= 20 ? (
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#DC2626', fontWeight: 800, fontSize: '10.5px' }}>
                                        <AlertTriangle size={12} /> Critical Theft
                                      </span>
                                    ) : theft > 0 ? (
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#B45309', fontWeight: 700, fontSize: '10.5px' }}>
                                        <AlertTriangle size={12} /> Drop Detected
                                      </span>
                                    ) : (
                                      <span style={{ color: '#059669', fontWeight: 700, fontSize: '10.5px' }}>Secure</span>
                                    )}
                                  </td>
                                </>
                              )}

                              {/* KMPL MILEAGE ROWS */}
                              {reportType === 'kmpl' && (
                                <>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0F172A' }}>
                                    {row.distance_travelled || 0} km
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'center', fontFamily: 'monospace', color: '#475569', fontWeight: 600 }}>
                                    {formatHMS(row.running_seconds)}
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#D97706' }}>
                                    {consumed != null ? `${consumed} L` : '-'}
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'center', fontFamily: 'monospace' }}>
                                    {kmpl != null && kmpl > 0 ? (
                                      <span style={{
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        background: kmpl >= 3.5 ? '#ECFDF5' : kmpl >= 2.0 ? '#FFFBEB' : '#FEF2F2',
                                        border: `1px solid ${kmpl >= 3.5 ? '#A7F3D0' : kmpl >= 2.0 ? '#FDE68A' : '#FECACA'}`,
                                        color: kmpl >= 3.5 ? '#047857' : kmpl >= 2.0 ? '#B45309' : '#DC2626',
                                        fontWeight: 800,
                                        fontSize: '11px'
                                      }}>
                                        {kmpl.toFixed(2)} km/L
                                      </span>
                                    ) : (
                                      <span style={{ color: '#94A3B8' }}>—</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontFamily: 'monospace', color: '#475569', fontWeight: 600 }}>
                                    {row.avg_speed || 0} km/h
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontFamily: 'monospace', color: '#475569', fontWeight: 600 }}>
                                    {row.max_speed || 0} km/h
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'center' }}>
                                    {kmpl != null && kmpl >= 3.5 ? (
                                      <span style={{ color: '#059669', fontWeight: 700, fontSize: '10.5px' }}>Optimal</span>
                                    ) : kmpl != null && kmpl >= 2.0 ? (
                                      <span style={{ color: '#D97706', fontWeight: 700, fontSize: '10.5px' }}>Moderate</span>
                                    ) : kmpl != null && kmpl > 0 ? (
                                      <span style={{ color: '#DC2626', fontWeight: 700, fontSize: '10.5px' }}>Low Mileage</span>
                                    ) : (
                                      <span style={{ color: '#94A3B8', fontSize: '10.5px' }}>—</span>
                                    )}
                                  </td>
                                </>
                              )}

                              {/* LPH BURN RATE ROWS */}
                              {reportType === 'lph' && (
                                <>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'center', fontFamily: 'monospace', color: '#0284C7', fontWeight: 700 }}>
                                    {formatHMS(row.engine_on_seconds || ((parseFloat(row.running_seconds) || 0) + (parseFloat(row.idle_seconds) || 0)))}
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'center', fontFamily: 'monospace', color: '#475569', fontWeight: 600 }}>
                                    {formatHMS(row.running_seconds)}
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'center', fontFamily: 'monospace', color: '#D97706', fontWeight: 600 }}>
                                    {formatHMS(row.idle_seconds)}
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#EA580C' }}>
                                    {consumed != null ? `${consumed} L` : '-'}
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'center', fontFamily: 'monospace' }}>
                                    {lph != null && lph > 0 ? (
                                      <span style={{
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        background: lph <= 2.5 ? '#F0FDFA' : lph <= 5.0 ? '#FFFBEB' : '#FAF5FF',
                                        border: `1px solid ${lph <= 2.5 ? '#99F6E4' : lph <= 5.0 ? '#FDE68A' : '#E9D5FF'}`,
                                        color: lph <= 2.5 ? '#0F766E' : lph <= 5.0 ? '#B45309' : '#7E22CE',
                                        fontWeight: 800,
                                        fontSize: '11px'
                                      }}>
                                        {lph.toFixed(2)} L/h
                                      </span>
                                    ) : (
                                      <span style={{ color: '#94A3B8' }}>—</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'center' }}>
                                    {lph != null && lph <= 2.5 ? (
                                      <span style={{ color: '#0F766E', fontWeight: 700, fontSize: '10.5px' }}>Efficient</span>
                                    ) : lph != null && lph <= 5.0 ? (
                                      <span style={{ color: '#D97706', fontWeight: 700, fontSize: '10.5px' }}>Standard</span>
                                    ) : lph != null && lph > 0 ? (
                                      <span style={{ color: '#7E22CE', fontWeight: 700, fontSize: '10.5px' }}>High Burn</span>
                                    ) : (
                                      <span style={{ color: '#94A3B8', fontSize: '10.5px' }}>—</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontFamily: 'monospace', color: '#475569', fontWeight: 600 }}>
                                    {row.end_fuel != null ? `${row.end_fuel} L` : '-'}
                                  </td>
                                </>
                              )}

                              {/* CONSUMPTION REPORT ROWS */}
                              {reportType === 'consumption' && (
                                <>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontFamily: 'monospace', color: '#334155' }}>
                                    {row.start_fuel != null ? `${row.start_fuel} L` : '-'}
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontFamily: 'monospace', color: '#334155' }}>
                                    {row.end_fuel != null ? `${row.end_fuel} L` : '-'}
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>
                                    {refill > 0 ? `+${refill} L` : '0 L'}
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: theft > 0 ? '#DC2626' : '#94A3B8' }}>
                                    {theft > 0 ? `-${theft} L` : '0 L'}
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#C2410C' }}>
                                    {consumed != null ? `${consumed} L` : '-'}
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#0F172A' }}>
                                    {row.distance_travelled || 0} km
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'center', fontFamily: 'monospace', color: '#475569', fontWeight: 600 }}>
                                    {formatHMS(row.engine_on_seconds || ((parseFloat(row.running_seconds) || 0) + (parseFloat(row.idle_seconds) || 0)))}
                                  </td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'center' }}>
                                    {theft > 0 ? (
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#DC2626', fontWeight: 700, fontSize: '10.5px' }}>
                                        <AlertTriangle size={12} /> Fuel Theft
                                      </span>
                                    ) : (
                                      <span style={{ color: '#059669', fontWeight: 700, fontSize: '10.5px' }}>Normal</span>
                                    )}
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              )}
            </table>
          </div>
        )}
      </div>

      </div>
    </div>
  );
};

export default FuelReportsPage;
