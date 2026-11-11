import React, { useState, useEffect, useMemo, useCallback } from 'react';
import CustomDatePicker from '../../components/ui/CustomDatePicker';
import { formatLocalTime, formatLocalDate, getLocalDateString } from '../../utils/dateUtils';
import AddressText from '../../components/ui/AddressText';
import { useNavigate } from 'react-router-dom';
import {
  Download, Search, Loader2, FileText,
  FileSpreadsheet, Truck, Calendar, Play, RotateCcw,
  ChevronDown, ChevronUp, Activity, PlayCircle, Flag, Clock
} from 'lucide-react';
import axiosInstance from '../../api/axios';
import { exportToExcel, exportToPDF, exportToCSV } from '../../utils/exportUtils';
import * as vehicleApi from '../../api/vehicleApi';

const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const DailyTripReportPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});

  // Yesterday is the last completed full day
  const getYesterdayString = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getLocalDateString(d);
  };
  const yesterdayStr = getYesterdayString();

  const [vehicles, setVehicles] = useState([]);
  const [searchVehicle, setSearchVehicle] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [activePreset, setActivePreset] = useState('yesterday');

  // Filters (defaults strictly to completed days, single vehicle, no All Vehicles)
  const [filters, setFilters] = useState(() => ({
    vehicleId: '',
    startDate: yesterdayStr,
    endDate: yesterdayStr
  }));

  // Fetch report data
  const handleGenerate = useCallback(async (overrideFilters = null) => {
    const currentFilters = overrideFilters || filters;
    if (!currentFilters.startDate || !currentFilters.endDate || !currentFilters.vehicleId) return;
    setLoading(true);

    try {
      const effectiveEndDate = currentFilters.endDate > yesterdayStr ? yesterdayStr : currentFilters.endDate;
      const effectiveStartDate = currentFilters.startDate > yesterdayStr ? yesterdayStr : currentFilters.startDate;

      const start = new Date(effectiveStartDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(effectiveEndDate);
      end.setHours(23, 59, 59, 999);

      const params = new URLSearchParams();
      params.append('startDate', start.toISOString());
      params.append('endDate', end.toISOString());
      params.append('vehicleId', currentFilters.vehicleId);

      const res = await axiosInstance.get('/api/reports/daily-trip?' + params.toString());
      if (res.data?.success) {
        setData(res.data.data || []);
      } else {
        setData([]);
      }
    } catch (err) {
      console.error('Failed to generate daily trip report:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [filters.startDate, filters.endDate, filters.vehicleId, yesterdayStr]);

  // Load Vehicles on mount (no loop)
  useEffect(() => {
    vehicleApi.getVehicles({ t: Date.now(), limit: 1000 })
      .then(res => {
        const vList = Array.isArray(res) ? res : (res?.data || []);
        if (vList.length > 0) {
          setVehicles(vList);
          setFilters(prev => ({ ...prev, vehicleId: prev.vehicleId || vList[0].id }));
        }
      })
      .catch(console.error);
  }, []);

  // Auto-generate when vehicleId is set or changes
  useEffect(() => {
    if (filters.vehicleId) {
      handleGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.vehicleId]);

  const toggleRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Group list for dropdown
  const groupOptions = useMemo(() => {
    const set = new Set();
    vehicles.forEach(v => {
      const g = v.group_name || v.group?.name;
      if (g) set.add(g);
    });
    return ['All', ...Array.from(set)];
  }, [vehicles]);

  // Filtered vehicles for sidebar list
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const g = v.group_name || v.group?.name || '';
      const matchesGroup = selectedGroup === 'All' || g === selectedGroup;
      const vName = (v.name || v.plate || '').toLowerCase();
      const matchesSearch = !searchVehicle || vName.includes(searchVehicle.toLowerCase());
      return matchesGroup && matchesSearch;
    });
  }, [vehicles, selectedGroup, searchVehicle]);

  // Selected vehicle details for metadata table
  const selectedVehicle = useMemo(() => {
    return vehicles.find(v => String(v.id) === String(filters.vehicleId)) || vehicles[0] || null;
  }, [vehicles, filters.vehicleId]);

  // Cumulative metrics across filtered rows
  const totals = useMemo(() => {
    let totalDist = 0;
    let drivingSec = 0;
    let stoppageSec = 0;
    let totalSpanSec = 0;
    let stops = 0;
    let legs = 0;
    data.forEach(row => {
      totalDist += parseFloat(row.total_distance || 0);
      drivingSec += parseFloat(row.driving_seconds || 0);
      stoppageSec += parseFloat(row.stoppage_seconds || 0);
      totalSpanSec += parseFloat(row.total_span_seconds || 0);
      stops += parseInt(row.stops_count || 0, 10);
      legs += parseInt(row.legs_count || 0, 10);
    });
    return {
      distance: totalDist.toFixed(2),
      driving: formatDuration(drivingSec),
      stoppage: formatDuration(stoppageSec),
      span: formatDuration(totalSpanSec),
      stops,
      legs,
      count: data.length
    };
  }, [data]);

  // Quick Date Range Preset Selection (For Completed Days)
  const setQuickRange = (rangeType) => {
    const now = new Date();
    let start, end;

    if (rangeType === 'yesterday') {
      const y = new Date(now.getTime() - 24 * 3600 * 1000);
      start = getLocalDateString(y);
      end = getLocalDateString(y);
    } else if (rangeType === 'last_7_days') {
      const s = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      const e = new Date(now.getTime() - 24 * 3600 * 1000);
      start = getLocalDateString(s);
      end = getLocalDateString(e);
    } else if (rangeType === 'last_week') {
      const dayOfWeek = now.getDay();
      const diffToLastMonday = ((dayOfWeek === 0 ? -6 : 1) - dayOfWeek) - 7;
      const s = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToLastMonday);
      const e = new Date(s.getTime() + 6 * 24 * 3600 * 1000);
      start = getLocalDateString(s);
      end = getLocalDateString(e);
    } else if (rangeType === 'this_month') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const e = new Date(now.getTime() - 24 * 3600 * 1000);
      start = getLocalDateString(s);
      end = e < s ? getLocalDateString(s) : getLocalDateString(e);
    } else if (rangeType === 'last_month') {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      start = getLocalDateString(s);
      end = getLocalDateString(e);
    }

    const newFilters = {
      ...filters,
      startDate: start,
      endDate: end
    };
    setActivePreset(rangeType);
    setFilters(newFilters);
    handleGenerate(newFilters);
  };

  const columns = ['Date', 'Departure Time', 'Departure Lat/Lng', 'Final Arrival Time', 'Arrival Lat/Lng', 'Total Distance (km)', 'Driving Time', 'Stoppage Time', 'Total Span', 'Stops Count'];

  const getExportData = () => {
    return data.map(row => ({
      'Date': row.date,
      'Departure Time': formatLocalTime(row.start_time),
      'Departure Lat/Lng': `${row.start_lat}, ${row.start_lng}`,
      'Final Arrival Time': formatLocalTime(row.end_time),
      'Arrival Lat/Lng': `${row.end_lat}, ${row.end_lng}`,
      'Total Distance (km)': row.total_distance || 0,
      'Driving Time (HH:MM:SS)': formatDuration(row.driving_seconds),
      'Stoppage Time (HH:MM:SS)': formatDuration(row.stoppage_seconds),
      'Total Span (HH:MM:SS)': formatDuration(row.total_span_seconds),
      'Number of Stops': row.stops_count || 0,
      'Max Speed (km/h)': row.max_speed || 0,
      'Avg Speed (km/h)': row.avg_speed || 0
    }));
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'stretch',
      minHeight: '100%',
      gap: '12px',
      background: '#F8FAFC',
      padding: '10px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      color: '#0F172A',
      boxSizing: 'border-box'
    }}>

      {/* ═══════════ LEFT: COMPACT VEHICLE SIDEBAR (135px) ═══════════ */}
      <div style={{
        width: '135px',
        minWidth: '135px',
        maxWidth: '135px',
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '10px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        overflow: 'hidden'
      }}>
        {/* Search Input with magnifying glass */}
        <div style={{ padding: '6px 8px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: '5px', background: '#F8FAFC' }}>
          <Search size={12} color="#94A3B8" style={{ flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search..."
            value={searchVehicle}
            onChange={e => setSearchVehicle(e.target.value)}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '11px',
              color: '#0F172A',
              padding: 0
            }}
          />
        </div>

        {/* Group Selector */}
        {groupOptions.length > 1 && (
          <div style={{ padding: '4px 6px', borderBottom: '1px solid #F1F5F9', background: '#FFFFFF' }}>
            <select
              value={selectedGroup}
              onChange={e => setSelectedGroup(e.target.value)}
              style={{
                width: '100%',
                padding: '3px 4px',
                fontSize: '10px',
                fontWeight: 600,
                border: '1px solid #E2E8F0',
                borderRadius: '6px',
                color: '#334155',
                background: '#F8FAFC',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                outline: 'none'
              }}
            >
              {groupOptions.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        )}

        {/* Scrollable Vehicle List with Sleek Squircle Rows */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#FFFFFF', padding: '4px' }}>
          {filteredVehicles.length === 0 ? (
            <div style={{ padding: '16px 6px', textAlign: 'center', color: '#94A3B8', fontSize: '10.5px' }}>
              No vehicles
            </div>
          ) : (
            filteredVehicles.map(v => {
              const isSelected = String(v.id) === String(filters.vehicleId);
              const isOnline = v.is_online || (v.speed && v.speed > 0) || v.ignition;

              return (
                <div
                  key={v.id}
                  onClick={() => {
                    const newF = { ...filters, vehicleId: v.id };
                    setFilters(newF);
                    handleGenerate(newF);
                  }}
                  title={v.name || v.plate}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 8px',
                    borderRadius: '6px',
                    marginBottom: '2px',
                    cursor: 'pointer',
                    background: isSelected ? '#D1FAE5' : 'transparent',
                    borderLeft: isSelected ? '3px solid #059669' : '3px solid transparent',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) e.currentTarget.style.background = '#F0FDF4';
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: isOnline ? '#10B981' : '#94A3B8',
                    flexShrink: 0
                  }} />
                  <span style={{
                    fontSize: '11px',
                    fontWeight: isSelected ? 700 : 600,
                    color: isSelected ? '#065F46' : '#1E293B',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {v.name || v.plate}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ═══════════ RIGHT: MODERN REPORT WORKSPACE (Zero Wastage) ═══════════ */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '10px',
        padding: '10px 14px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        overflow: 'hidden',
        gap: '6px'
      }}>

        {/* ── 1. Top Controls Bar: Modern Filter Row + Submit + Export ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          paddingBottom: '6px',
          borderBottom: '1px solid #F1F5F9'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Start Date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B' }}>Start Date:</span>
              <CustomDatePicker
                value={filters.startDate}
                max={yesterdayStr}
                onChange={e => {
                  const val = e?.target ? e.target.value : e;
                  setFilters({ ...filters, startDate: val });
                  setActivePreset('');
                }}
                style={{ fontSize: '11.5px', padding: '4px 8px', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#FFFFFF' }}
              />
            </div>

            <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 600 }}>→</span>

            {/* End Date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B' }}>End Date:</span>
              <CustomDatePicker
                value={filters.endDate}
                max={yesterdayStr}
                onChange={e => {
                  const val = e?.target ? e.target.value : e;
                  setFilters({ ...filters, endDate: val });
                  setActivePreset('');
                }}
                style={{ fontSize: '11.5px', padding: '4px 8px', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#FFFFFF' }}
              />
            </div>

            {/* Generate / Submit Button (Forest Emerald Theme) */}
            <button
              onClick={() => handleGenerate()}
              disabled={loading}
              style={{
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: '#FFFFFF',
                border: 'none',
                padding: '5px 16px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(5,150,105,0.25)',
                transition: 'all 0.15s ease'
              }}
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Play size={11} fill="#FFFFFF" color="#FFFFFF" />}
              <span>Generate</span>
            </button>
          </div>

          {/* Export Icons on Top-Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => exportToExcel(getExportData(), 'Daily_Total_Trips_Report')}
              disabled={data.length === 0}
              title="Download Excel Report"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: '#F0FDF4',
                border: '1px solid #DCFCE7',
                padding: '4px 9px',
                borderRadius: '6px',
                cursor: data.length ? 'pointer' : 'not-allowed',
                opacity: data.length ? 1 : 0.5,
                transition: 'all 0.15s'
              }}
            >
              <FileSpreadsheet size={14} color="#16A34A" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#15803D' }}>Excel</span>
            </button>

            <button
              onClick={() => exportToPDF(['Date', 'Departure Time', 'Final Arrival Time', 'Total Distance (km)', 'Driving Time', 'Stoppage Time', 'Total Span', 'Stops Count'], getExportData(), 'Daily_Total_Trips_Report')}
              disabled={data.length === 0}
              title="Download PDF Report"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: '#FEF2F2',
                border: '1px solid #FEE2E2',
                padding: '4px 9px',
                borderRadius: '6px',
                cursor: data.length ? 'pointer' : 'not-allowed',
                opacity: data.length ? 1 : 0.5,
                transition: 'all 0.15s'
              }}
            >
              <FileText size={14} color="#DC2626" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#B91C1C' }}>PDF</span>
            </button>

            <button
              onClick={() => exportToCSV(getExportData(), 'Daily_Total_Trips_Report')}
              disabled={data.length === 0}
              title="Download CSV"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                padding: '4px 9px',
                borderRadius: '6px',
                cursor: data.length ? 'pointer' : 'not-allowed',
                opacity: data.length ? 1 : 0.5,
                transition: 'all 0.15s'
              }}
            >
              <Download size={14} color="#059669" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#047857' }}>CSV</span>
            </button>
          </div>
        </div>

        {/* ── 2. Modern Segmented Quick Date Pill Bar (Zero Wastage) ── */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '6px',
          padding: '2px',
          background: 'transparent',
          borderRadius: '999px',
          width: 'fit-content',
          margin: '0 auto'
        }}>
          {[
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'last_7_days', label: 'Last 7 Days' },
            { id: 'last_week', label: 'Last Week' },
            { id: 'this_month', label: 'This Month' },
            { id: 'last_month', label: 'Last Month' }
          ].map(p => {
            const isActive = activePreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setQuickRange(p.id)}
                style={{
                  background: isActive ? 'var(--brand-header, #064E3B)' : '#E6F4EA',
                  border: 'none',
                  color: isActive ? '#FFFFFF' : '#334155',
                  fontSize: '11px',
                  fontWeight: isActive ? 800 : 600,
                  cursor: 'pointer',
                  padding: '5px 14px',
                  borderRadius: '999px',
                  boxShadow: isActive ? '0 2px 5px rgba(0,0,0,0.2)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* ── 3. Executive Metadata Banner (Excel Sheet Format) ── */}
        <div style={{
          border: '1px solid #D1FAE5',
          background: '#F7FDF9',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px', lineHeight: '1.25' }}>
            <tbody>
              {/* Row 1 */}
              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                <td style={{ width: '14%', padding: '6px 10px', fontWeight: 800, color: '#064E3B', background: '#ECFDF5', borderRight: '1px solid #E2E8F0', textTransform: 'uppercase', fontSize: '10.5px', letterSpacing: '0.03em' }}>
                  Vehicle Group :
                </td>
                <td style={{ width: '36%', padding: '6px 10px', fontWeight: 700, color: '#0F172A', borderRight: '1px solid #E2E8F0' }}>
                  {selectedVehicle?.group_name || selectedVehicle?.group?.name || 'Default Group'}
                </td>
                <td style={{ width: '14%', padding: '6px 10px', fontWeight: 800, color: '#064E3B', background: '#ECFDF5', borderRight: '1px solid #E2E8F0', textTransform: 'uppercase', fontSize: '10.5px', letterSpacing: '0.03em' }}>
                  Vehicle Name :
                </td>
                <td style={{ width: '36%', padding: '6px 10px', fontWeight: 700, color: '#0F172A' }}>
                  {selectedVehicle?.name || selectedVehicle?.plate || '-'}
                </td>
              </tr>
              {/* Row 2 */}
              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                <td style={{ width: '14%', padding: '6px 10px', fontWeight: 800, color: '#064E3B', background: '#ECFDF5', borderRight: '1px solid #E2E8F0', textTransform: 'uppercase', fontSize: '10.5px', letterSpacing: '0.03em' }}>
                  Vehicle Id :
                </td>
                <td style={{ width: '36%', padding: '6px 10px', fontWeight: 700, color: '#0F172A', borderRight: '1px solid #E2E8F0' }}>
                  {selectedVehicle?.plate || selectedVehicle?.imei || selectedVehicle?.name || '-'}
                </td>
                <td style={{ width: '14%', padding: '6px 10px', fontWeight: 800, color: '#064E3B', background: '#ECFDF5', borderRight: '1px solid #E2E8F0', textTransform: 'uppercase', fontSize: '10.5px', letterSpacing: '0.03em' }}>
                  Total Distance :
                </td>
                <td style={{ width: '36%', padding: '6px 10px', fontWeight: 800, color: '#059669' }}>
                  {totals.distance} km <span style={{ fontSize: '10.5px', color: '#065F46', fontWeight: 600 }}>({totals.count} days • {totals.legs} legs • {totals.stops} stops)</span>
                </td>
              </tr>
              {/* Row 3 */}
              <tr>
                <td style={{ width: '14%', padding: '6px 10px', fontWeight: 800, color: '#064E3B', background: '#ECFDF5', borderRight: '1px solid #E2E8F0', textTransform: 'uppercase', fontSize: '10.5px', letterSpacing: '0.03em' }}>
                  From Date :
                </td>
                <td style={{ width: '36%', padding: '6px 10px', fontWeight: 600, color: '#0F172A', borderRight: '1px solid #E2E8F0' }}>
                  {formatLocalDate(filters.startDate)}
                </td>
                <td style={{ width: '14%', padding: '6px 10px', fontWeight: 800, color: '#064E3B', background: '#ECFDF5', borderRight: '1px solid #E2E8F0', textTransform: 'uppercase', fontSize: '10.5px', letterSpacing: '0.03em' }}>
                  To Date :
                </td>
                <td style={{ width: '36%', padding: '6px 10px', fontWeight: 600, color: '#0F172A' }}>
                  {formatLocalDate(filters.endDate)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── 4. Excel Format Results Data Table (Crisp Grid, Full Info, Small Rows) ── */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          border: '1px solid #CBD5E1',
          background: '#FFFFFF',
          position: 'relative'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11.5px', minWidth: '950px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr style={{ background: 'var(--brand-header, #064E3B)', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em', width: '35px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.15)', borderTop: 'none' }}>#</th>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em', width: '95px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.15)', borderTop: 'none' }}>Date</th>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em', width: '220px', borderRight: '1px solid rgba(255,255,255,0.15)', borderTop: 'none' }}>Initial Departure (Start)</th>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em', width: '220px', borderRight: '1px solid rgba(255,255,255,0.15)', borderTop: 'none' }}>Final Arrival (End)</th>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em', width: '85px', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.15)', borderTop: 'none' }}>Distance</th>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em', width: '85px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.15)', borderTop: 'none' }}>Driving Time</th>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em', width: '85px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.15)', borderTop: 'none' }}>Stoppage Time</th>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em', width: '85px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.15)', borderTop: 'none' }}>Total Span</th>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em', width: '65px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.15)', borderTop: 'none' }}>Stops</th>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em', width: '80px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.15)', borderTop: 'none' }}>Max/Avg</th>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em', width: '75px', textAlign: 'center', borderTop: 'none' }}>Breakdown</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="11" style={{ padding: '30px', textAlign: 'center', color: '#64748B' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <Loader2 size={16} className="animate-spin" color="#059669" />
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>Analyzing daily consolidated trip records...</span>
                    </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan="11" style={{ padding: '30px 10px', textAlign: 'center', color: '#94A3B8' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>No trips recorded for the selected vehicle and date range.</span>
                      <button
                        onClick={() => setQuickRange('yesterday')}
                        style={{
                          background: '#ECFDF5',
                          border: '1px solid #A7F3D0',
                          borderRadius: '999px',
                          color: '#065F46',
                          padding: '4px 14px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <RotateCcw size={11} /> Reset to Yesterday
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((row, idx) => {
                  const rowKey = `${row.vehicle_id}-${row.date}`;
                  const isExpanded = !!expandedRows[rowKey];

                  return (
                    <React.Fragment key={rowKey}>
                      <tr
                        style={{
                          borderBottom: '1px solid #E2E8F0',
                          background: isExpanded ? '#ECFDF5' : (idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'),
                          transition: 'background 0.1s ease'
                        }}
                        onMouseEnter={e => {
                          if (!isExpanded) e.currentTarget.style.background = '#ECFDF5';
                        }}
                        onMouseLeave={e => {
                          if (!isExpanded) e.currentTarget.style.background = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
                        }}
                      >
                        <td style={{ padding: '4px 6px', color: '#64748B', fontWeight: 600, textAlign: 'center', borderRight: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: '4px 8px', color: '#0F172A', fontWeight: 700, textAlign: 'center', borderRight: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>
                          {formatLocalDate(row.date)}
                        </td>
                        <td style={{ padding: '4px 8px', borderRight: '1px solid #E2E8F0', lineHeight: '1.3' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, color: '#10B981', fontSize: '11px' }}>
                            <PlayCircle size={11} color="#10B981" />
                            <span>{formatLocalTime(row.start_time)}</span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#475569', marginTop: '1px' }}>
                            <AddressText lat={row.start_lat} lng={row.start_lng} />
                          </div>
                        </td>
                        <td style={{ padding: '4px 8px', borderRight: '1px solid #E2E8F0', lineHeight: '1.3' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, color: '#EF4444', fontSize: '11px' }}>
                            <Flag size={11} color="#EF4444" />
                            <span>{formatLocalTime(row.end_time)}</span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#475569', marginTop: '1px' }}>
                            <AddressText lat={row.end_lat} lng={row.end_lng} />
                          </div>
                        </td>
                        <td style={{ padding: '4px 8px', color: '#0F172A', fontWeight: 800, textAlign: 'right', borderRight: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>
                          {row.total_distance || 0} km
                        </td>
                        <td style={{ padding: '4px 8px', color: '#059669', fontWeight: 700, textAlign: 'center', borderRight: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>
                          {formatDuration(row.driving_seconds)}
                        </td>
                        <td style={{ padding: '4px 8px', color: '#D97706', fontWeight: 700, textAlign: 'center', borderRight: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>
                          {formatDuration(row.stoppage_seconds)}
                        </td>
                        <td style={{ padding: '4px 8px', color: '#475569', fontWeight: 700, textAlign: 'center', borderRight: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>
                          {formatDuration(row.total_span_seconds)}
                        </td>
                        <td style={{ padding: '4px 8px', textAlign: 'center', borderRight: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: row.stops_count > 0 ? '#FFF7ED' : '#F1F5F9',
                            color: row.stops_count > 0 ? '#C2410C' : '#64748B',
                            fontWeight: 700,
                            fontSize: '10.5px'
                          }}>
                            {row.stops_count} stop{row.stops_count !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td style={{ padding: '4px 8px', textAlign: 'center', borderRight: '1px solid #E2E8F0', whiteSpace: 'nowrap', fontSize: '11px' }}>
                          <span style={{ fontWeight: 700, color: '#DC2626' }}>{row.max_speed || 0}</span>
                          <span style={{ color: '#94A3B8' }}> / </span>
                          <span style={{ fontWeight: 600, color: '#475569' }}>{row.avg_speed || 0}</span>
                        </td>
                        <td style={{ padding: '4px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => toggleRow(rowKey)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: isExpanded ? '#D1FAE5' : '#ECFDF5',
                              color: isExpanded ? '#065F46' : '#047857',
                              border: isExpanded ? '1px solid #A7F3D0' : '1px solid #D1FAE5',
                              fontSize: '10.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              lineHeight: '1.2'
                            }}
                          >
                            <span>{row.legs_count || 1} Legs</span>
                            {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Drawer: Clean Excel-format Intermediate Timeline */}
                      {isExpanded && row.timeline && (
                        <tr>
                          <td colSpan="11" style={{ padding: '8px 14px', background: '#F8FAFC', borderBottom: '1px solid #CBD5E1' }}>
                            <div style={{ fontSize: '11px', fontWeight: 800, color: '#0F172A', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Activity size={13} color="#10B981" />
                              <span>Intermediate Legs & Stoppages for {formatLocalDate(row.date)} ({row.vehicle_name})</span>
                            </div>

                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', background: '#FFFFFF', border: '1px solid #CBD5E1' }}>
                              <thead>
                                <tr style={{ background: '#F1F5F9', borderBottom: '1px solid #CBD5E1', fontSize: '10px' }}>
                                  <th style={{ padding: '3px 6px', borderRight: '1px solid #CBD5E1', width: '30px', textAlign: 'center' }}>#</th>
                                  <th style={{ padding: '3px 6px', borderRight: '1px solid #CBD5E1', width: '90px' }}>Type</th>
                                  <th style={{ padding: '3px 6px', borderRight: '1px solid #CBD5E1', width: '110px' }}>Start Time</th>
                                  <th style={{ padding: '3px 6px', borderRight: '1px solid #CBD5E1', width: '110px' }}>End Time</th>
                                  <th style={{ padding: '3px 6px', borderRight: '1px solid #CBD5E1', width: '70px', textAlign: 'center' }}>Duration</th>
                                  <th style={{ padding: '3px 6px', borderRight: '1px solid #CBD5E1', width: '70px', textAlign: 'right' }}>Distance</th>
                                  <th style={{ padding: '3px 6px', borderRight: '1px solid #CBD5E1', width: '65px', textAlign: 'right' }}>Max Spd</th>
                                  <th style={{ padding: '3px 6px' }}>Address / Location</th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.timeline.map((item, tIdx) => {
                                  const isLeg = item.type === 'leg';
                                  return (
                                    <tr key={tIdx} style={{ borderBottom: '1px solid #E2E8F0', background: isLeg ? '#FFFFFF' : '#FFFBEB' }}>
                                      <td style={{ padding: '3px 6px', borderRight: '1px solid #E2E8F0', textAlign: 'center', color: '#64748B' }}>
                                        {tIdx + 1}
                                      </td>
                                      <td style={{ padding: '3px 6px', borderRight: '1px solid #E2E8F0', fontWeight: 700, color: isLeg ? '#10B981' : '#D97706' }}>
                                        {isLeg ? '🚗 Driving Leg' : '⏸️ Stoppage'}
                                      </td>
                                      <td style={{ padding: '3px 6px', borderRight: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>
                                        {formatLocalTime(item.start_time)}
                                      </td>
                                      <td style={{ padding: '3px 6px', borderRight: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>
                                        {formatLocalTime(item.end_time)}
                                      </td>
                                      <td style={{ padding: '3px 6px', borderRight: '1px solid #E2E8F0', textAlign: 'center', fontWeight: 600 }}>
                                        {formatDuration(item.duration_seconds)}
                                      </td>
                                      <td style={{ padding: '3px 6px', borderRight: '1px solid #E2E8F0', textAlign: 'right', fontWeight: 700 }}>
                                        {isLeg ? `${item.distance_km || 0} km` : '-'}
                                      </td>
                                      <td style={{ padding: '3px 6px', borderRight: '1px solid #E2E8F0', textAlign: 'right', color: '#DC2626' }}>
                                        {isLeg ? `${item.max_speed || 0}` : '-'}
                                      </td>
                                      <td style={{ padding: '3px 6px', color: '#475569' }}>
                                        <AddressText lat={item.start_lat || item.lat} lng={item.start_lng || item.lng} />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};

export default DailyTripReportPage;
