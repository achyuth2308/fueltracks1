import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import TelematicsDatePicker from '../../components/ui/TelematicsDatePicker';
import TelematicsTimePicker, { to12Hour } from '../../components/ui/TelematicsTimePicker';
import {
  FileSpreadsheet, FileText, Search, Loader2, Calendar, Info,
  Droplets, Flame, Gauge, Zap, TrendingUp, TrendingDown,
  Truck, ArrowUpRight, CheckCircle2, AlertTriangle, ShieldAlert
} from 'lucide-react';
import axiosInstance from '../../api/axios';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import AddressText from '../../components/ui/AddressText';
import { getLocalDateString } from '../../utils/dateUtils';
import * as vehicleApi from '../../api/vehicleApi';

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

  // Detect report type from prop or route path
  const reportType = useMemo(() => {
    if (propType) return propType;
    if (location.pathname.includes('fuel-refill')) return 'refill';
    if (location.pathname.includes('fuel-consumption')) return 'consumption';
    if (location.pathname.includes('kmpl-mileage')) return 'kmpl';
    if (location.pathname.includes('lph-burn-rate')) return 'lph';
    return 'consumption';
  }, [propType, location.pathname]);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const defaultYesterday = getYesterdayString();
  const [filters, setFilters] = useState(() => ({
    vehicleId: '',
    startDate: defaultYesterday,
    startTime: '00:00',
    endDate: defaultYesterday,
    endTime: '23:59'
  }));

  // Fetch vehicles for dropdown
  useEffect(() => {
    vehicleApi.getVehicles({ t: Date.now(), limit: 1000 })
      .then(res => {
        if (res.success && res.data) {
          setVehicles(res.data);
        }
      })
      .catch(console.error);
  }, []);

  const handleFetchReport = async (overrideFilters = null) => {
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
      if (activeFilters.vehicleId) {
        params.append('vehicleId', activeFilters.vehicleId);
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

  // Initial load
  useEffect(() => {
    handleFetchReport();
  }, [reportType]);

  const handlePreset = (preset) => {
    let sDate = defaultYesterday;
    let eDate = defaultYesterday;
    if (preset === 'today') {
      sDate = getTodayString();
      eDate = getTodayString();
    } else if (preset === 'last7') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      sDate = getLocalDateString(d);
      eDate = getTodayString();
    }
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

      return matchesSearch && matchesCat;
    });
  }, [data, searchQuery, categoryFilter]);

  // Aggregate Metrics based on report type
  const metrics = useMemo(() => {
    let totalRefill = 0;
    let refillCount = 0;
    let maxRefill = 0;
    let totalDispensed = 0;

    let totalConsumed = 0;
    let totalTheft = 0;

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
      const engSec = parseFloat(row.engine_on_seconds || 0);
      const runSec = parseFloat(row.running_seconds || 0);
      const idleSec = parseFloat(row.idle_seconds || 0);

      totalRefill += refill;
      if (refill > 0) refillCount++;
      if (refill > maxRefill) maxRefill = refill;
      totalDispensed += dispensed;

      totalConsumed += consumed;
      totalTheft += theft;

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

      if (reportType === 'kmpl') {
        return {
          'S.No': idx + 1,
          'Vehicle Name': vName,
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
          'Reg No': row.plate || '-',
          'Category': cat,
          'Engine ON Hours': formatHMS(row.engine_on_seconds),
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
        'Engine ON Time': formatHMS(row.engine_on_seconds),
        'Burn Rate (L/h)': row.lph != null ? row.lph : '-'
      };
    });
  };

  const IconComp = config.icon;

  return (
    <div style={{ padding: '16px', background: '#F8FAFC', minHeight: '100%', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      
      {/* 1. Header Box with Filter Controls */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '10px',
        padding: '14px 18px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {/* Title row with Quick Presets */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: `${config.accentColor}18`,
              border: `1px solid ${config.accentColor}35`,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <IconComp size={18} color={config.accentColor} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                {config.title}
              </h3>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>
                {config.badgeText} • Time Period: {formatBannerDateTime(filters.startDate, filters.startTime)} to {formatBannerDateTime(filters.endDate, filters.endTime)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => handlePreset('yesterday')}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#334155',
                fontSize: '11.5px',
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
                padding: '5px 12px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#334155',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handlePreset('last7')}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#334155',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer'
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
          gap: '8px'
        }}>
          {/* Vehicle Dropdown */}
          <select
            value={filters.vehicleId}
            onChange={e => setFilters(prev => ({ ...prev, vehicleId: e.target.value }))}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#0F172A',
              fontSize: '12px',
              fontWeight: 600,
              outline: 'none',
              minWidth: '150px'
            }}
          >
            <option value="">All Vehicles ({vehicles.length})</option>
            {vehicles.map(v => (
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
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#0F172A',
              fontSize: '12px',
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
            onChange={(isoDate) => setFilters(prev => ({ ...prev, startDate: isoDate }))}
          />

          {/* From Time */}
          <TelematicsTimePicker
            value={filters.startTime}
            onChange={(time24) => setFilters(prev => ({ ...prev, startTime: time24 }))}
          />

          {/* To Date */}
          <TelematicsDatePicker
            value={filters.endDate}
            onChange={(isoDate) => setFilters(prev => ({ ...prev, endDate: isoDate }))}
          />

          {/* To Time */}
          <TelematicsTimePicker
            value={filters.endTime}
            onChange={(time24) => setFilters(prev => ({ ...prev, endTime: time24 }))}
          />

          {/* Submit Button */}
          <button
            type="button"
            onClick={() => handleFetchReport()}
            disabled={loading}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: 'none',
              background: config.accentColor,
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: `0 2px 6px ${config.accentColor}40`
            }}
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : null}
            Submit
          </button>

          {/* Search Box */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
            <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: '10px' }} />
            <input
              type="text"
              placeholder="Search vehicle / plate..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                padding: '6px 10px 6px 30px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '12px',
                outline: 'none',
                width: '180px',
                color: '#0F172A'
              }}
            />
          </div>

          {/* Export Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => exportToExcel(getExportData(), config.title.replace(/\s+/g, '_'))}
              disabled={filteredData.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: filteredData.length === 0 ? '#E2E8F0' : '#10B981',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 700,
                cursor: filteredData.length === 0 ? 'not-allowed' : 'pointer'
              }}
              title="Export to Excel"
            >
              <FileSpreadsheet size={13} />
              Excel
            </button>
            <button
              type="button"
              onClick={() => exportToPDF(Object.keys(getExportData()[0] || {}), getExportData(), config.title.replace(/\s+/g, '_'))}
              disabled={filteredData.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: filteredData.length === 0 ? '#E2E8F0' : '#EF4444',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 700,
                cursor: filteredData.length === 0 ? 'not-allowed' : 'pointer'
              }}
              title="Export to PDF"
            >
              <FileText size={13} />
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* 2. Specialized KPI Summary Cards Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '12px'
      }}>
        {config.cards.map((card, cIdx) => (
          <div
            key={cIdx}
            style={{
              background: '#FFFFFF',
              borderRadius: '10px',
              padding: '12px 16px',
              border: '1px solid #E2E8F0',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}
          >
            <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600 }}>
              {card.label}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: card.color }}>
              {card.val}
            </div>
            <div style={{ fontSize: '10.5px', color: '#94A3B8', fontWeight: 500 }}>
              {card.sub}
            </div>
          </div>
        ))}
      </div>

      {/* 3. Specialized Data Table */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '10px',
        border: '1px solid #E2E8F0',
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
      }}>
        {loading ? (
          <div style={{ padding: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <Loader2 size={28} className="animate-spin text-orange-500" />
            <div style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Loading telematics data...</div>
          </div>
        ) : filteredData.length === 0 ? (
          <div style={{ padding: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Info size={32} color="#94A3B8" />
            <div style={{ fontSize: '14px', color: '#334155', fontWeight: 700 }}>No telemetry records found</div>
            <div style={{ fontSize: '12px', color: '#64748B' }}>Try selecting a broader date range or removing vehicle filters.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px', color: '#1E293B' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #CBD5E1', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '10px 12px', width: '40px', textAlign: 'center' }}>#</th>
                  <th style={{ padding: '10px 14px' }}>Vehicle Name</th>
                  <th style={{ padding: '10px 12px' }}>Category</th>

                  {/* Type-Specific Table Headers */}
                  {reportType === 'refill' && (
                    <>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Start Fuel</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>End Fuel</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center' }}>Refill Quantity</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Dispensed</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Consumed</th>
                      <th style={{ padding: '10px 14px' }}>Refill Location</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Status</th>
                    </>
                  )}

                  {reportType === 'kmpl' && (
                    <>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Distance (km)</th>
                      <th style={{ padding: '10px 12px' }}>Running Time</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Fuel Consumed</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center' }}>Actual Mileage</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Avg Speed</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Max Speed</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Rating</th>
                    </>
                  )}

                  {reportType === 'lph' && (
                    <>
                      <th style={{ padding: '10px 14px' }}>Engine ON Time</th>
                      <th style={{ padding: '10px 12px' }}>Working Time</th>
                      <th style={{ padding: '10px 12px' }}>Idle Time</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Fuel Consumed</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center' }}>Burn Rate</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Efficiency</th>
                      <th style={{ padding: '10px 14px' }}>Current Fuel</th>
                    </>
                  )}

                  {reportType === 'consumption' && (
                    <>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Start Fuel</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>End Fuel</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Refill (+L)</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Theft (-L)</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center' }}>Net Consumed</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Distance</th>
                      <th style={{ padding: '10px 12px' }}>Engine Hours</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Status</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, idx) => {
                  const cat = (row.vehicle_category || 'moving').toLowerCase();
                  const refill = parseFloat(row.total_refill || 0);
                  const dispensed = parseFloat(row.total_dispensed || 0);
                  const theft = parseFloat(row.total_theft || 0);
                  const consumed = row.consumption != null ? parseFloat(row.consumption) : null;
                  const kmpl = row.kmpl != null ? parseFloat(row.kmpl) : null;
                  const lph = row.lph != null ? parseFloat(row.lph) : null;

                  return (
                    <tr
                      key={row.vehicle_id || idx}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F0F9FF'}
                      onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA'}
                    >
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#94A3B8', fontWeight: 600 }}>
                        {idx + 1}
                      </td>

                      {/* Vehicle Name */}
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '12.5px' }}>
                          {row.vehicle_name || 'Vehicle'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>
                          {row.plate || '-'}
                        </div>
                      </td>

                      {/* Category Badge */}
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '999px',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.02em',
                          background: cat === 'generator' ? '#FEF3C7' : cat === 'machinery' ? '#E0E7FF' : cat === 'dispenser' ? '#CCFBF1' : '#F1F5F9',
                          color: cat === 'generator' ? '#B45309' : cat === 'machinery' ? '#4338CA' : cat === 'dispenser' ? '#0F766E' : '#475569'
                        }}>
                          {cat}
                        </span>
                      </td>

                      {/* REFILL REPORT ROWS */}
                      {reportType === 'refill' && (
                        <>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                            {row.start_fuel != null ? `${row.start_fuel} L` : '-'}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                            {row.end_fuel != null ? `${row.end_fuel} L` : '-'}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            {refill > 0 ? (
                              <span style={{
                                padding: '3px 10px',
                                borderRadius: '6px',
                                background: '#ECFDF5',
                                border: '1px solid #A7F3D0',
                                color: '#047857',
                                fontWeight: 800,
                                fontSize: '12px'
                              }}>
                                +{refill} L
                              </span>
                            ) : (
                              <span style={{ color: '#94A3B8', fontWeight: 600 }}>0 L</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#0284C7' }}>
                            {dispensed > 0 ? `${dispensed} L` : '-'}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#D97706' }}>
                            {consumed != null ? `${consumed} L` : '-'}
                          </td>
                          <td style={{ padding: '10px 14px', maxWidth: '240px', fontSize: '11px', color: '#334155', lineHeight: 1.3 }}>
                            {(row.start_lat && row.start_lng) ? (
                              <AddressText lat={row.start_lat} lng={row.start_lng} />
                            ) : (
                              <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Location unavailable</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {refill > 0 ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#059669', fontWeight: 700, fontSize: '11px' }}>
                                <CheckCircle2 size={13} /> Refilled
                              </span>
                            ) : (
                              <span style={{ color: '#94A3B8', fontSize: '11px' }}>Normal</span>
                            )}
                          </td>
                        </>
                      )}

                      {/* KMPL MILEAGE ROWS */}
                      {reportType === 'kmpl' && (
                        <>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                            {row.distance_travelled || 0} km
                          </td>
                          <td style={{ padding: '10px 12px', color: '#475569', fontWeight: 600 }}>
                            {formatHMS(row.running_seconds)}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#D97706' }}>
                            {consumed != null ? `${consumed} L` : '-'}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                            {kmpl != null && kmpl > 0 ? (
                              <span style={{
                                padding: '4px 12px',
                                borderRadius: '6px',
                                background: kmpl >= 3.5 ? '#ECFDF5' : kmpl >= 2.0 ? '#FFFBEB' : '#FEF2F2',
                                border: `1px solid ${kmpl >= 3.5 ? '#A7F3D0' : kmpl >= 2.0 ? '#FDE68A' : '#FECACA'}`,
                                color: kmpl >= 3.5 ? '#047857' : kmpl >= 2.0 ? '#B45309' : '#DC2626',
                                fontWeight: 800,
                                fontSize: '13px'
                              }}>
                                {kmpl.toFixed(2)} km/L
                              </span>
                            ) : (
                              <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#475569', fontWeight: 600 }}>
                            {row.avg_speed || 0} km/h
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#475569', fontWeight: 600 }}>
                            {row.max_speed || 0} km/h
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {kmpl != null && kmpl >= 3.5 ? (
                              <span style={{ color: '#059669', fontWeight: 700, fontSize: '11px' }}>Optimal</span>
                            ) : kmpl != null && kmpl >= 2.0 ? (
                              <span style={{ color: '#D97706', fontWeight: 700, fontSize: '11px' }}>Moderate</span>
                            ) : kmpl != null && kmpl > 0 ? (
                              <span style={{ color: '#DC2626', fontWeight: 700, fontSize: '11px' }}>Low Mileage</span>
                            ) : (
                              <span style={{ color: '#94A3B8', fontSize: '11px' }}>—</span>
                            )}
                          </td>
                        </>
                      )}

                      {/* LPH BURN RATE ROWS */}
                      {reportType === 'lph' && (
                        <>
                          <td style={{ padding: '10px 14px', color: '#0284C7', fontWeight: 700 }}>
                            {formatHMS(row.engine_on_seconds)}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#475569', fontWeight: 600 }}>
                            {formatHMS(row.running_seconds)}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#D97706', fontWeight: 600 }}>
                            {formatHMS(row.idle_seconds)}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#EA580C' }}>
                            {consumed != null ? `${consumed} L` : '-'}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                            {lph != null && lph > 0 ? (
                              <span style={{
                                padding: '4px 12px',
                                borderRadius: '6px',
                                background: lph <= 2.5 ? '#F0FDFA' : lph <= 5.0 ? '#FFFBEB' : '#FAF5FF',
                                border: `1px solid ${lph <= 2.5 ? '#99F6E4' : lph <= 5.0 ? '#FDE68A' : '#E9D5FF'}`,
                                color: lph <= 2.5 ? '#0F766E' : lph <= 5.0 ? '#B45309' : '#7E22CE',
                                fontWeight: 800,
                                fontSize: '13px'
                              }}>
                                {lph.toFixed(2)} L/h
                              </span>
                            ) : (
                              <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {lph != null && lph <= 2.5 ? (
                              <span style={{ color: '#0F766E', fontWeight: 700, fontSize: '11px' }}>Efficient</span>
                            ) : lph != null && lph <= 5.0 ? (
                              <span style={{ color: '#D97706', fontWeight: 700, fontSize: '11px' }}>Standard</span>
                            ) : lph != null && lph > 0 ? (
                              <span style={{ color: '#7E22CE', fontWeight: 700, fontSize: '11px' }}>High Burn</span>
                            ) : (
                              <span style={{ color: '#94A3B8', fontSize: '11px' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#475569', fontWeight: 600 }}>
                            {row.end_fuel != null ? `${row.end_fuel} L` : '-'}
                          </td>
                        </>
                      )}

                      {/* CONSUMPTION REPORT ROWS */}
                      {reportType === 'consumption' && (
                        <>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                            {row.start_fuel != null ? `${row.start_fuel} L` : '-'}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                            {row.end_fuel != null ? `${row.end_fuel} L` : '-'}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                            {refill > 0 ? `+${refill} L` : '0 L'}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: theft > 0 ? '#DC2626' : '#94A3B8' }}>
                            {theft > 0 ? `-${theft} L` : '0 L'}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            {consumed != null ? (
                              <span style={{
                                padding: '3px 10px',
                                borderRadius: '6px',
                                background: '#FFF7ED',
                                border: '1px solid #FFEDD5',
                                color: '#C2410C',
                                fontWeight: 800,
                                fontSize: '12px'
                              }}>
                                {consumed} L
                              </span>
                            ) : (
                              <span style={{ color: '#94A3B8' }}>-</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#0F172A' }}>
                            {row.distance_travelled || 0} km
                          </td>
                          <td style={{ padding: '10px 12px', color: '#475569', fontWeight: 600 }}>
                            {formatHMS(row.engine_on_seconds)}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {theft > 0 ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#DC2626', fontWeight: 700, fontSize: '11px' }}>
                                <AlertTriangle size={13} /> Fuel Theft
                              </span>
                            ) : (
                              <span style={{ color: '#059669', fontWeight: 600, fontSize: '11px' }}>Normal</span>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default FuelReportsPage;
