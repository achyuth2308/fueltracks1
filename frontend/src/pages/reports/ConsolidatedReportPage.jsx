import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import TelematicsDatePicker from '../../components/ui/TelematicsDatePicker';
import TelematicsTimePicker, { to12Hour } from '../../components/ui/TelematicsTimePicker';
import {
  FileSpreadsheet, FileText, Search, Loader2, Calendar, Info,
  Truck, Clock, PauseCircle, PlayCircle, Fuel, Gauge, Flame,
  CheckCircle2, ChevronDown, ChevronRight, X, ArrowUpRight, ShieldAlert
} from 'lucide-react';
import axiosInstance from '../../api/axios';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import AddressText from '../../components/ui/AddressText';
import { getLocalDateString } from '../../utils/dateUtils';
import * as vehicleApi from '../../api/vehicleApi';
import ReportGroupVehicleSidebar from '../../components/reports/ReportGroupVehicleSidebar';

// Format seconds into HH:MM:SS
const formatHMS = (seconds) => {
  if (!seconds || seconds <= 0) return '00:00:00';
  const totalSecs = Math.round(seconds);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// Format short human duration: e.g. "64h 30m" or "45m"
const formatDurationHuman = (seconds) => {
  if (!seconds || seconds <= 0) return '0m';
  const totalSecs = Math.round(seconds);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

// Format timestamp into "HH:MM:SS DD-MM-YYYY"
const formatDateTime = (isoStr) => {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return String(isoStr);
  const timeStr = d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
  const parts = d.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }).split('/');
  const dateStr = parts.length === 3 ? `${parts[0]}-${parts[1]}-${parts[2]}` : d.toLocaleDateString('en-GB');
  return `${timeStr} ${dateStr}`;
};

// Format Date & Time for Banner: e.g. "12:00 AM 25-10-2026"
const formatBannerDateTime = (dateStr, timeStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const formattedDate = (y && m && d) ? `${d}-${m}-${y}` : dateStr;
  const time12 = to12Hour(timeStr);
  return `${time12} ${formattedDate}`;
};

const getYesterdayString = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateString(d);
};

// Merges brief traffic halts (<= 120s / 2 min) into surrounding 'Moving' intervals
const mergeTrafficIdles = (intervals, maxHaltSec = 120) => {
  if (!intervals || intervals.length <= 1) return intervals;

  const result = [];
  let i = 0;

  while (i < intervals.length) {
    let cur = { ...intervals[i] };

    if (cur.status === 'Moving') {
      let j = i + 1;
      let accumDuration = cur.duration_seconds;
      let accumDistance = cur.distance || 0;
      let maxSpeed = cur.max_speed || 0;
      let speedTimeProduct = (cur.avg_speed || 0) * (cur.duration_seconds || 1);
      let totalTimeForAvg = cur.duration_seconds || 1;
      let lastEndTime = cur.end_time;
      let lastLat = cur.lat;
      let lastLng = cur.lng;

      while (j < intervals.length) {
        let nextMovingIndex = -1;
        let cumulativePauseSec = 0;

        for (let k = j; k < intervals.length; k++) {
          if (intervals[k].status === 'Moving') {
            nextMovingIndex = k;
            break;
          }
          cumulativePauseSec += (intervals[k].duration_seconds || 0);
          if (cumulativePauseSec > maxHaltSec) {
            break;
          }
        }

        if (nextMovingIndex !== -1 && cumulativePauseSec <= maxHaltSec) {
          for (let m = j; m < nextMovingIndex; m++) {
            accumDuration += (intervals[m].duration_seconds || 0);
            lastEndTime = intervals[m].end_time;
            lastLat = intervals[m].lat || lastLat;
            lastLng = intervals[m].lng || lastLng;
          }

          const nextMoving = intervals[nextMovingIndex];
          accumDuration += (nextMoving.duration_seconds || 0);
          accumDistance += (nextMoving.distance || 0);
          maxSpeed = Math.max(maxSpeed, nextMoving.max_speed || 0);
          speedTimeProduct += (nextMoving.avg_speed || 0) * (nextMoving.duration_seconds || 1);
          totalTimeForAvg += (nextMoving.duration_seconds || 1);
          lastEndTime = nextMoving.end_time;
          lastLat = nextMoving.lat || lastLat;
          lastLng = nextMoving.lng || lastLng;

          j = nextMovingIndex + 1;
        } else {
          break;
        }
      }

      cur.duration_seconds = accumDuration;
      cur.end_time = lastEndTime;
      cur.distance = Math.round(accumDistance * 100) / 100;
      cur.max_speed = Math.round(maxSpeed);
      cur.avg_speed = totalTimeForAvg > 0 ? Math.round(speedTimeProduct / totalTimeForAvg) : cur.avg_speed;
      cur.lat = lastLat;
      cur.lng = lastLng;

      result.push(cur);
      i = j;
    } else {
      result.push(cur);
      i++;
    }
  }

  return result;
};

const ConsolidatedReportPage = () => {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  const pageTitle = useMemo(() => {
    if (location.pathname.includes('fuel-refill')) return 'Fuel Refill Report';
    if (location.pathname.includes('fuel-consumption')) return 'Fuel Consumption Report';
    if (location.pathname.includes('kmpl-mileage')) return 'KMPL Mileage Report';
    if (location.pathname.includes('lph-burn-rate')) return 'LPH Engine Burn Rate';
    return 'Vehicle Consolidated Report';
  }, [location.pathname]);

  // Default to yesterday full 24h
  const defaultYesterday = getYesterdayString();
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [filters, setFilters] = useState(() => ({
    vehicleId: '',
    startDate: defaultYesterday,
    startTime: '00:00',
    endDate: defaultYesterday,
    endTime: '23:59'
  }));

  // Category Filter: 'ALL' | 'Parked' | 'Idle' | 'Moving'
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  // Per-vehicle category override: { [vehicleId]: 'ALL' | 'Parked' | 'Idle' | 'Moving' }
  const [vehicleCategoryFilter, setVehicleCategoryFilter] = useState({});
  // Expanded vehicle cards: { [vehicleId]: boolean }
  const [expandedVehicles, setExpandedVehicles] = useState({});

  // Auto-expand first vehicle when data loads
  useEffect(() => {
    if (data && data.length > 0) {
      setExpandedVehicles(prev => {
        // If nothing is expanded yet, expand the first vehicle
        if (Object.keys(prev).length === 0) {
          return { [data[0].vehicle_id]: true };
        }
        return prev;
      });
    }
  }, [data]);

  const toggleVehicleExpand = (vId) => {
    setExpandedVehicles(prev => ({
      ...prev,
      [vId]: !prev[vId]
    }));
  };

  // Group options
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

  // Fetch vehicles & groups
  useEffect(() => {
    Promise.allSettled([
      vehicleApi.getVehicles({ t: Date.now() }),
      axiosInstance.get('/api/admin/groups')
    ]).then(([vRes, gRes]) => {
      if (gRes.status === 'fulfilled' && gRes.value?.data) {
        const gData = gRes.value.data.data || gRes.value.data.groups || [];
        setGroups(gData);
      }
      if (vRes.status === 'fulfilled' && vRes.value?.success && vRes.value?.data) {
        setVehicles(vRes.value.data);
      }
    }).catch(console.error);
  }, []);

  const handleFetchReport = async (overrideFilters = null, overrideGroup = null) => {
    const activeFilters = overrideFilters || filters;
    if (!activeFilters.startDate || !activeFilters.endDate) return;

    setLoading(true);
    try {
      const [sY, sM, sD] = activeFilters.startDate.split('-');
      const [sH, sMin] = (activeFilters.startTime || '00:00').split(':');
      const start = new Date(parseInt(sY, 10), parseInt(sM, 10) - 1, parseInt(sD, 10), parseInt(sH, 10), parseInt(sMin, 10), 0);

      const [eY, eM, eD] = activeFilters.endDate.split('-');
      const [eH, eMin] = (activeFilters.endTime || '23:59').split(':');
      const end = new Date(parseInt(eY, 10), parseInt(eM, 10) - 1, parseInt(eD, 10), parseInt(eH, 10), parseInt(eMin, 10), 59, 999);

      const params = new URLSearchParams();
      params.append('startDate', start.toISOString());
      params.append('endDate', end.toISOString());
      const activeOrgId = vehicles[0]?.org_id;
      if (activeOrgId) {
        params.append('orgId', activeOrgId);
      }
      if (activeFilters.vehicleId) {
        params.append('vehicleId', activeFilters.vehicleId);
      }

      const curGroup = overrideGroup !== null ? overrideGroup : selectedGroup;
      if (curGroup !== 'All') {
        const matchedG = groups.find(g => (g.name || '').trim().toLowerCase() === curGroup.trim().toLowerCase());
        if (matchedG?.id) {
          params.append('groupId', matchedG.id);
        }
      }

      const res = await axiosInstance.get(`/api/reports/consolidated?${params.toString()}`);
      if (res.data?.success) {
        setData(res.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching consolidated report:', err);
      alert('Failed to generate consolidated report');
    } finally {
      setLoading(false);
    }
  };

  const handleSetYesterday = () => {
    const yStr = getYesterdayString();
    const nextFilters = {
      ...filters,
      startDate: yStr,
      startTime: '00:00',
      endDate: yStr,
      endTime: '23:59'
    };
    setFilters(nextFilters);
    handleFetchReport(nextFilters);
  };

  const bannerStart = formatBannerDateTime(filters.startDate, filters.startTime);
  const bannerEnd = formatBannerDateTime(filters.endDate, filters.endTime);

  // Filter data according to single vehicle dropdown if active
  const filteredData = useMemo(() => {
    if (!filters.vehicleId) return data;
    return data.filter(d => String(d.vehicle_id) === String(filters.vehicleId));
  }, [data, filters.vehicleId]);

  // Aggregate fleet-wide category totals
  const fleetCategoryStats = useMemo(() => {
    let totalParkedSec = 0;
    let totalIdleSec = 0;
    let totalMovingSec = 0;
    let parkedCount = 0;
    let idleCount = 0;
    let movingCount = 0;
    let totalDistanceKm = 0;
    let totalVehicles = filteredData.length;

    filteredData.forEach(v => {
      const intervals = mergeTrafficIdles(v.intervals || [], 120);
      intervals.forEach(inv => {
        if (inv.status === 'Moving') {
          totalMovingSec += (inv.duration_seconds || 0);
          movingCount += 1;
          totalDistanceKm += (inv.distance || 0);
        } else if (inv.status === 'Idle') {
          totalIdleSec += (inv.duration_seconds || 0);
          idleCount += 1;
        } else {
          totalParkedSec += (inv.duration_seconds || 0);
          parkedCount += 1;
        }
      });
    });

    return {
      totalVehicles,
      totalParkedSec,
      totalIdleSec,
      totalMovingSec,
      parkedCount,
      idleCount,
      movingCount,
      totalDistanceKm: Math.round(totalDistanceKm),
      totalIntervals: parkedCount + idleCount + movingCount
    };
  }, [filteredData]);

  // Export Data preparation with complete Moving Time, Idle Time, Stoppage Time summary metrics
  const getExportData = () => {
    const exportRows = [];
    filteredData.forEach(v => {
      const vName = v.vehicle_name || v.plate || 'Vehicle';
      const intervals = mergeTrafficIdles(v.intervals || [], 120);
      const activeFilter = vehicleCategoryFilter[v.vehicle_id] || categoryFilter;
      const targetIntervals = activeFilter === 'ALL'
        ? intervals
        : intervals.filter(inv => inv.status === activeFilter);

      // Compute total times for this vehicle across its intervals
      let vehMovingSec = 0;
      let vehIdleSec = 0;
      let vehParkedSec = 0;
      intervals.forEach(inv => {
        if (inv.status === 'Moving') vehMovingSec += (inv.duration_seconds || 0);
        else if (inv.status === 'Idle') vehIdleSec += (inv.duration_seconds || 0);
        else vehParkedSec += (inv.duration_seconds || 0);
      });

      const totalMovingHMS = formatHMS(vehMovingSec || v.running_seconds);
      const totalIdleHMS = formatHMS(vehIdleSec || v.idle_seconds);
      const totalStoppageHMS = formatHMS(vehParkedSec || v.stopped_seconds);
      const totalDist = Math.round(v.distance_travelled || 0);

      targetIntervals.forEach(it => {
        const isMoving = it.status === 'Moving';
        exportRows.push({
          'Vehicle Name': vName,
          'Total Moving Time': totalMovingHMS,
          'Total Idle Time': totalIdleHMS,
          'Total Stoppage Time': totalStoppageHMS,
          'Total Distance (km)': totalDist,
          'Status': it.status,
          'Start Time': formatDateTime(it.start_time),
          'End Time': formatDateTime(it.end_time),
          'Duration': formatHMS(it.duration_seconds),
          'Length (km)': isMoving && it.distance != null ? Math.round(it.distance) : '-',
          'Speed Hike (km/h)': isMoving && it.max_speed != null ? Math.round(it.max_speed) : '-',
          'Speed Avg (km/h)': isMoving && it.avg_speed != null ? it.avg_speed : '-',
          'Location': it.lat && it.lng ? `${it.lat.toFixed(4)}, ${it.lng.toFixed(4)}` : '-'
        });
      });
    });
    return exportRows;
  };

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      width: '100%',
      minHeight: 0,
      background: '#F8FAFC',
      overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      {/* ═══════════ LEFT: SIDEBAR (Groups & Vehicles) ═══════════ */}
      <ReportGroupVehicleSidebar
        vehicles={vehicles}
        groups={groups}
        selectedVehicleId={filters.vehicleId}
        selectedGroupId={selectedGroup}
        showAllOption={true}
        onSelectVehicle={(id, meta) => {
          if (meta?.isAllInGroup) {
            setSelectedGroup(meta.groupName);
            const nextFilters = { ...filters, vehicleId: '' };
            setFilters(nextFilters);
            handleFetchReport(nextFilters, meta.groupName);
          } else if (meta?.isAll) {
            setSelectedGroup('All');
            const nextFilters = { ...filters, vehicleId: '' };
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
          const nextFilters = { ...filters, vehicleId: '' };
          setFilters(nextFilters);
          handleFetchReport(nextFilters, gName);
        }}
        width="175px"
      />

      {/* ═══════════ RIGHT: REPORT WORKSPACE ═══════════ */}
      <div style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#F8FAFC',
        padding: '12px 16px',
        overflow: 'hidden',
        height: '100%',
        minHeight: 0,
        gap: '12px',
        boxSizing: 'border-box'
      }}>
        {/* TOP FILTER & CONTROLS CARD */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '8px',
          padding: '12px 16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          flexShrink: 0
        }}>
          {/* Header row with Title & Badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
                {pageTitle}
              </h3>
              <span style={{
                background: '#F1F5F9',
                border: '1px solid #E2E8F0',
                color: '#475569',
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '6px'
              }}>
                {filters.vehicleId
                  ? `Vehicle: ${vehicles.find(v => String(v.id) === String(filters.vehicleId))?.name || filters.vehicleId}`
                  : (selectedGroup && selectedGroup !== 'All' ? `Group: ${selectedGroup}` : 'All Fleet Vehicles')}
              </span>
            </div>

            <button
              type="button"
              onClick={handleSetYesterday}
              style={{
                padding: '5px 14px',
                borderRadius: '6px',
                border: 'none',
                background: '#0F766E',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 1px 3px rgba(15, 118, 110, 0.25)'
              }}
              title="Set date range to Yesterday full 24h"
            >
              <Calendar size={13} />
              Yesterday
            </button>
          </div>

          {/* Date Pickers & Actions Row */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '8px'
          }}>
            <TelematicsDatePicker
              value={filters.startDate}
              onChange={(isoDate) => setFilters(prev => ({ ...prev, startDate: isoDate }))}
            />

            <TelematicsTimePicker
              value={filters.startTime}
              onChange={(time24) => setFilters(prev => ({ ...prev, startTime: time24 }))}
            />

            <span style={{ color: '#94A3B8', fontWeight: 600, fontSize: '13px' }}>to</span>

            <TelematicsDatePicker
              value={filters.endDate}
              onChange={(isoDate) => setFilters(prev => ({ ...prev, endDate: isoDate }))}
            />

            <TelematicsTimePicker
              value={filters.endTime}
              onChange={(time24) => setFilters(prev => ({ ...prev, endTime: time24 }))}
            />

            <button
              type="button"
              onClick={() => handleFetchReport()}
              disabled={loading}
              style={{
                padding: '7px 18px',
                borderRadius: '6px',
                border: 'none',
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 700,
                cursor: loading ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)'
              }}
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : null}
              Submit
            </button>

            {/* Export Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
              <button
                type="button"
                onClick={() => exportToExcel(getExportData(), pageTitle.replace(/\s+/g, '_'))}
                disabled={data.length === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  background: data.length === 0 ? '#F1F5F9' : '#FFFFFF',
                  color: data.length === 0 ? '#94A3B8' : '#0F766E',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: data.length === 0 ? 'not-allowed' : 'pointer'
                }}
                title="Export to Excel"
              >
                <FileSpreadsheet size={14} color="#10B981" />
                Excel
              </button>
              <button
                type="button"
                onClick={() => exportToPDF([
                  'Vehicle Name',
                  'Total Moving Time',
                  'Total Idle Time',
                  'Total Stoppage Time',
                  'Total Distance (km)',
                  'Status',
                  'Start Time',
                  'End Time',
                  'Duration',
                  'Length (km)',
                  'Location'
                ], getExportData(), pageTitle.replace(/\s+/g, '_'))}
                disabled={data.length === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  background: data.length === 0 ? '#F1F5F9' : '#FFFFFF',
                  color: data.length === 0 ? '#94A3B8' : '#DC2626',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: data.length === 0 ? 'not-allowed' : 'pointer'
                }}
                title="Export to PDF"
              >
                <FileText size={14} color="#EF4444" />
                PDF
              </button>
            </div>
          </div>
        </div>

        {/* ═══════════ TOP EXECUTIVE SUMMARY CARDS (MINIMAL & NEAT) ═══════════ */}
        {!loading && data.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '10px',
            flexShrink: 0
          }}>
            {/* 1. All Overview Card */}
            <div
              onClick={() => { setCategoryFilter('ALL'); setVehicleCategoryFilter({}); }}
              style={{
                background: categoryFilter === 'ALL' ? '#0F172A' : '#FFFFFF',
                color: categoryFilter === 'ALL' ? '#FFFFFF' : '#1E293B',
                borderRadius: '8px',
                padding: '10px 14px',
                border: '1px solid',
                borderColor: categoryFilter === 'ALL' ? '#0F172A' : '#E2E8F0',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                boxShadow: categoryFilter === 'ALL' ? '0 2px 4px rgba(15, 23, 42, 0.12)' : '0 1px 2px rgba(0,0,0,0.03)',
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 600, color: categoryFilter === 'ALL' ? '#94A3B8' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                All Events
              </span>
              <span style={{ fontSize: '16px', fontWeight: 700 }}>
                {fleetCategoryStats.totalIntervals} Total
              </span>
              <span style={{ fontSize: '11px', color: categoryFilter === 'ALL' ? '#CBD5E1' : '#64748B' }}>
                {fleetCategoryStats.totalVehicles} Vehicles • {fleetCategoryStats.totalDistanceKm} Km
              </span>
            </div>

            {/* 2. Moving Time Card */}
            <div
              onClick={() => { setCategoryFilter('Moving'); setVehicleCategoryFilter({}); }}
              style={{
                background: categoryFilter === 'Moving' ? '#0F172A' : '#FFFFFF',
                color: categoryFilter === 'Moving' ? '#FFFFFF' : '#1E293B',
                borderRadius: '8px',
                padding: '10px 14px',
                border: '1px solid',
                borderColor: categoryFilter === 'Moving' ? '#0F172A' : (categoryFilter === 'ALL' ? '#E2E8F0' : '#CBD5E1'),
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                boxShadow: categoryFilter === 'Moving' ? '0 2px 4px rgba(15, 23, 42, 0.12)' : '0 1px 2px rgba(0,0,0,0.03)',
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 600, color: categoryFilter === 'Moving' ? '#94A3B8' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Moving Time
              </span>
              <span style={{ fontSize: '16px', fontWeight: 700 }}>
                {formatDurationHuman(fleetCategoryStats.totalMovingSec)}
              </span>
              <span style={{ fontSize: '11px', color: categoryFilter === 'Moving' ? '#CBD5E1' : '#64748B' }}>
                {fleetCategoryStats.movingCount} trips • {fleetCategoryStats.totalDistanceKm} Km
              </span>
            </div>

            {/* 3. Parking / Stopped Time Card */}
            <div
              onClick={() => { setCategoryFilter('Parked'); setVehicleCategoryFilter({}); }}
              style={{
                background: categoryFilter === 'Parked' ? '#0F172A' : '#FFFFFF',
                color: categoryFilter === 'Parked' ? '#FFFFFF' : '#1E293B',
                borderRadius: '8px',
                padding: '10px 14px',
                border: '1px solid',
                borderColor: categoryFilter === 'Parked' ? '#0F172A' : (categoryFilter === 'ALL' ? '#E2E8F0' : '#CBD5E1'),
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                boxShadow: categoryFilter === 'Parked' ? '0 2px 4px rgba(15, 23, 42, 0.12)' : '0 1px 2px rgba(0,0,0,0.03)',
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 600, color: categoryFilter === 'Parked' ? '#94A3B8' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Parking / Stopped Time
              </span>
              <span style={{ fontSize: '16px', fontWeight: 700 }}>
                {formatDurationHuman(fleetCategoryStats.totalParkedSec)}
              </span>
              <span style={{ fontSize: '11px', color: categoryFilter === 'Parked' ? '#CBD5E1' : '#64748B' }}>
                {fleetCategoryStats.parkedCount} stops
              </span>
            </div>

            {/* 4. Idle Time Card */}
            <div
              onClick={() => { setCategoryFilter('Idle'); setVehicleCategoryFilter({}); }}
              style={{
                background: categoryFilter === 'Idle' ? '#0F172A' : '#FFFFFF',
                color: categoryFilter === 'Idle' ? '#FFFFFF' : '#1E293B',
                borderRadius: '8px',
                padding: '10px 14px',
                border: '1px solid',
                borderColor: categoryFilter === 'Idle' ? '#0F172A' : (categoryFilter === 'ALL' ? '#E2E8F0' : '#CBD5E1'),
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                boxShadow: categoryFilter === 'Idle' ? '0 2px 4px rgba(15, 23, 42, 0.12)' : '0 1px 2px rgba(0,0,0,0.03)',
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 600, color: categoryFilter === 'Idle' ? '#94A3B8' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Idle Time
              </span>
              <span style={{ fontSize: '16px', fontWeight: 700 }}>
                {formatDurationHuman(fleetCategoryStats.totalIdleSec)}
              </span>
              <span style={{ fontSize: '11px', color: categoryFilter === 'Idle' ? '#CBD5E1' : '#64748B' }}>
                {fleetCategoryStats.idleCount} idle halts
              </span>
            </div>
          </div>
        )}

        {/* ═══════════ MAIN CONTENT: ELEGANT VEHICLE CARDS & TABLES ═══════════ */}
        {loading ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#FFFFFF',
            borderRadius: '8px',
            border: '1px solid #E2E8F0',
            gap: '12px'
          }}>
            <Loader2 size={32} color="#059669" className="animate-spin" />
            <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Loading consolidated report...</span>
          </div>
        ) : data.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
            background: '#FFFFFF',
            borderRadius: '8px',
            border: '2px dashed #CBD5E1',
            textAlign: 'center'
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: '#F1F5F9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '10px'
            }}>
              <Calendar size={20} color="#94A3B8" />
            </div>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700, color: '#1E293B' }}>
              No Data Available
            </h4>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
              Select a date range and click <strong>Submit</strong> or <strong>Yesterday</strong> to generate report.
            </p>
          </div>
        ) : (
          <div style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            {filteredData.map((vehicleItem) => {
              const vName = vehicleItem.vehicle_name || vehicleItem.plate || 'Vehicle';
              const distanceKm = Math.round(vehicleItem.distance_travelled || 0);
              const intervals = mergeTrafficIdles(vehicleItem.intervals || [], 120);

              let movingSec = 0;
              let idleSec = 0;
              let parkedSec = 0;
              let movingCount = 0;
              let idleCount = 0;
              let parkedCount = 0;

              intervals.forEach(inv => {
                if (inv.status === 'Moving') {
                  movingSec += (inv.duration_seconds || 0);
                  movingCount += 1;
                } else if (inv.status === 'Idle') {
                  idleSec += (inv.duration_seconds || 0);
                  idleCount += 1;
                } else {
                  parkedSec += (inv.duration_seconds || 0);
                  parkedCount += 1;
                }
              });

              const movingHMS = formatHMS(movingSec || vehicleItem.running_seconds);
              const parkedHMS = formatHMS(parkedSec || vehicleItem.stopped_seconds);
              const idleHMS = formatHMS(idleSec || vehicleItem.idle_seconds);
              const speedHikeKm = Math.round(vehicleItem.max_speed || 0);
              const avgSpeedKm = Math.round(vehicleItem.avg_speed || 0);

              const activeVehicleFilter = vehicleCategoryFilter[vehicleItem.vehicle_id] || categoryFilter;
              const displayedIntervals = activeVehicleFilter === 'ALL'
                ? intervals
                : intervals.filter(inv => inv.status === activeVehicleFilter);

              const hasFuelData = (vehicleItem.start_fuel > 0) || (vehicleItem.total_refill > 0) ||
                                  (vehicleItem.total_theft > 0) || (vehicleItem.consumption > 0);

              const isExpanded = !!expandedVehicles[vehicleItem.vehicle_id];

              return (
                <div
                  key={vehicleItem.vehicle_id}
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    flexShrink: 0
                  }}
                >
                  {/* 1. DECENT & NEAT HEADER BAR (CLICKABLE ACCORDION) */}
                  <div
                    onClick={() => toggleVehicleExpand(vehicleItem.vehicle_id)}
                    style={{
                      background: '#FFFFFF',
                      borderBottom: isExpanded ? '1px solid #E2E8F0' : 'none',
                      padding: '11px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '10px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        background: '#F1F5F9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Truck size={17} color="#0F766E" />
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{vName}</span>
                          <span style={{ fontSize: '11px', fontWeight: 500, color: '#64748B', background: '#F1F5F9', padding: '1px 7px', borderRadius: '4px' }}>
                            {intervals.length} intervals
                          </span>
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '1px' }}>
                          From: {bannerStart} ➔ To: {bannerEnd}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        background: '#F0FDFA',
                        border: '1px solid #CCFBF1',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '5px'
                      }}>
                        <span style={{ fontSize: '11px', color: '#0F766E', textTransform: 'uppercase', fontWeight: 600 }}>Distance:</span>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#0D9488' }}>{distanceKm} Km</span>
                      </div>

                      <div style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '6px',
                        background: '#F1F5F9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#64748B'
                      }}>
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </div>
                    </div>
                  </div>

                  {/* 2. SECONDARY METRIC & CATEGORY DRILL-DOWN STRIP */}
                  <div style={{
                    background: '#FAFAFA',
                    padding: '8px 16px',
                    borderBottom: '1px solid #E2E8F0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}>
                    {/* Interactive Category Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setVehicleCategoryFilter(prev => ({
                            ...prev,
                            [vehicleItem.vehicle_id]: (prev[vehicleItem.vehicle_id] || categoryFilter) === 'Moving' ? 'ALL' : 'Moving'
                          }));
                          if (!isExpanded) toggleVehicleExpand(vehicleItem.vehicle_id);
                        }}
                        style={{
                          background: activeVehicleFilter === 'Moving' ? '#0F172A' : '#FFFFFF',
                          color: activeVehicleFilter === 'Moving' ? '#FFFFFF' : '#334155',
                          border: '1px solid',
                          borderColor: activeVehicleFilter === 'Moving' ? '#0F172A' : '#CBD5E1',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        Moving: {movingHMS} ({movingCount})
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setVehicleCategoryFilter(prev => ({
                            ...prev,
                            [vehicleItem.vehicle_id]: (prev[vehicleItem.vehicle_id] || categoryFilter) === 'Parked' ? 'ALL' : 'Parked'
                          }));
                          if (!isExpanded) toggleVehicleExpand(vehicleItem.vehicle_id);
                        }}
                        style={{
                          background: activeVehicleFilter === 'Parked' ? '#0F172A' : '#FFFFFF',
                          color: activeVehicleFilter === 'Parked' ? '#FFFFFF' : '#334155',
                          border: '1px solid',
                          borderColor: activeVehicleFilter === 'Parked' ? '#0F172A' : '#CBD5E1',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        Parked: {parkedHMS} ({parkedCount})
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setVehicleCategoryFilter(prev => ({
                            ...prev,
                            [vehicleItem.vehicle_id]: (prev[vehicleItem.vehicle_id] || categoryFilter) === 'Idle' ? 'ALL' : 'Idle'
                          }));
                          if (!isExpanded) toggleVehicleExpand(vehicleItem.vehicle_id);
                        }}
                        style={{
                          background: activeVehicleFilter === 'Idle' ? '#0F172A' : '#FFFFFF',
                          color: activeVehicleFilter === 'Idle' ? '#FFFFFF' : '#334155',
                          border: '1px solid',
                          borderColor: activeVehicleFilter === 'Idle' ? '#0F172A' : '#CBD5E1',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        Idle: {idleHMS} ({idleCount})
                      </button>

                      {activeVehicleFilter !== 'ALL' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setVehicleCategoryFilter(prev => ({ ...prev, [vehicleItem.vehicle_id]: 'ALL' }));
                          }}
                          style={{
                            background: '#F1F5F9',
                            border: '1px solid #CBD5E1',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#475569',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          Reset Filter ✕
                        </button>
                      )}
                    </div>

                    {/* Speed stats */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '11.5px', color: '#64748B' }}>
                      <span>Speed Hike: <strong style={{ color: '#0F172A' }}>{speedHikeKm} km/h</strong></span>
                      <span>Avg Speed: <strong style={{ color: '#0F172A' }}>{avgSpeedKm} km/h</strong></span>
                    </div>
                  </div>

                  {/* 3. DEDICATED CLEAN FUEL BADGES STRIP (If Vehicle Has Fuel Telemetry) */}
                  {hasFuelData && (
                    <div style={{
                      background: '#FFFFFF',
                      padding: '8px 16px',
                      borderBottom: '1px solid #E2E8F0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                      fontSize: '11.5px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span style={{ color: '#475569' }}>
                          Start: <strong style={{ color: '#0F172A' }}>{vehicleItem.start_fuel != null ? `${vehicleItem.start_fuel} L` : '-'}</strong>
                        </span>
                        <span style={{ color: '#475569' }}>
                          End: <strong style={{ color: '#0F172A' }}>{vehicleItem.end_fuel != null ? `${vehicleItem.end_fuel} L` : '-'}</strong>
                        </span>
                        <span style={{ color: '#166534', background: '#F0FDF4', border: '1px solid #DCFCE7', padding: '1px 8px', borderRadius: '4px', fontWeight: 600 }}>
                          Refill: +{vehicleItem.total_refill || 0} L
                        </span>
                        {vehicleItem.total_theft > 0 && (
                          <span style={{ color: '#DC2626', background: '#FEF2F2', border: '1px solid #FEE2E2', padding: '1px 8px', borderRadius: '4px', fontWeight: 600 }}>
                            Theft: -{vehicleItem.total_theft} L
                          </span>
                        )}
                        <span style={{ color: '#475569' }}>
                          Consumed: <strong style={{ color: '#B45309' }}>{vehicleItem.consumption != null ? `${vehicleItem.consumption} L` : '-'}</strong>
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {vehicleItem.vehicle_category !== 'generator' && (
                          <span style={{ color: '#0F766E', background: '#F0FDFA', border: '1px solid #CCFBF1', padding: '1px 8px', borderRadius: '4px', fontWeight: 600 }}>
                            Mileage: {vehicleItem.kmpl != null ? `${vehicleItem.kmpl} km/L` : '-'}
                          </span>
                        )}
                        {vehicleItem.lph != null && (
                          <span style={{ color: '#64748B' }}>
                            Burn Rate: <strong style={{ color: '#0F172A' }}>{vehicleItem.lph} L/h</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 4. INTERVAL DATA TABLE (COLLAPSIBLE ACCORDION BODY) */}
                  {isExpanded && (
                    <div style={{ width: '100%', overflowX: 'auto' }}>
                      <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '12px',
                        color: '#1E293B',
                        textAlign: 'left'
                      }}>
                        <thead>
                          <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            <th style={{ padding: '8px 14px', fontWeight: 600, width: '110px' }}>Status</th>
                            <th style={{ padding: '8px 14px', fontWeight: 600, width: '170px' }}>Start Time</th>
                            <th style={{ padding: '8px 14px', fontWeight: 600, width: '170px' }}>End Time</th>
                            <th style={{ padding: '8px 14px', fontWeight: 600, width: '130px' }}>Duration</th>
                            <th style={{ padding: '8px 14px', fontWeight: 600, width: '90px' }}>Distance</th>
                            <th style={{ padding: '8px 14px', fontWeight: 600, width: '100px' }}>Max Speed</th>
                            <th style={{ padding: '8px 14px', fontWeight: 600, width: '100px' }}>Avg Speed</th>
                            <th style={{ padding: '8px 14px', fontWeight: 600 }}>Location Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedIntervals.length > 0 ? (
                            displayedIntervals.map((item, idx) => {
                              const isMoving = item.status === 'Moving';
                              const isIdle = item.status === 'Idle';
                              const isParked = item.status === 'Parked';

                              return (
                                <tr
                                  key={idx}
                                  style={{
                                    borderBottom: '1px solid #F1F5F9',
                                    background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA'
                                  }}
                                >
                                  {/* Status badge */}
                                  <td style={{ padding: '7px 14px', verticalAlign: 'middle' }}>
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      padding: '2px 7px',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      background: '#F1F5F9',
                                      color: '#334155',
                                      border: '1px solid #E2E8F0'
                                    }}>
                                      {item.status}
                                    </span>
                                  </td>

                                  {/* Start */}
                                  <td style={{ padding: '7px 14px', color: '#475569', fontSize: '11.5px' }}>
                                    {formatDateTime(item.start_time)}
                                  </td>

                                  {/* End */}
                                  <td style={{ padding: '7px 14px', color: '#475569', fontSize: '11.5px' }}>
                                    {formatDateTime(item.end_time)}
                                  </td>

                                  {/* Duration */}
                                  <td style={{ padding: '7px 14px', fontWeight: 600, color: '#0F172A' }}>
                                    {formatHMS(item.duration_seconds)}
                                  </td>

                                  {/* Distance */}
                                  <td style={{ padding: '7px 14px', color: isMoving ? '#166534' : '#94A3B8', fontWeight: isMoving ? 600 : 400 }}>
                                    {isMoving && item.distance !== undefined ? `${Math.round(item.distance)} Km` : '-'}
                                  </td>

                                  {/* Max Speed */}
                                  <td style={{ padding: '7px 14px', color: isMoving ? '#0F172A' : '#94A3B8' }}>
                                    {isMoving && item.max_speed != null ? `${Math.round(item.max_speed)} km/h` : '-'}
                                  </td>

                                  {/* Avg Speed */}
                                  <td style={{ padding: '7px 14px', color: isMoving ? '#0F172A' : '#94A3B8' }}>
                                    {isMoving && item.avg_speed !== undefined ? `${item.avg_speed} km/h` : '-'}
                                  </td>

                                  {/* Location Details */}
                                  <td style={{ padding: '7px 14px', color: '#475569', fontSize: '11.5px' }}>
                                    {item.lat && item.lng ? (
                                      <AddressText lat={item.lat} lng={item.lng} />
                                    ) : (
                                      '-'
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: '#64748B', fontStyle: 'italic' }}>
                                No {activeVehicleFilter} intervals recorded for this vehicle in the selected period.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsolidatedReportPage;
