import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { formatLocalDate, formatLocalTime } from '../../utils/dateUtils';
import {
  Truck, Search, FileSpreadsheet, FileText, Download,
  Calendar, Clock, Loader2, Link as LinkIcon, RotateCcw, Play, ExternalLink
} from 'lucide-react';
import axiosInstance from '../../api/axios';
import { exportToExcel, exportToPDF, exportToCSV } from '../../utils/exportUtils';
import * as vehicleApi from '../../api/vehicleApi';
import { getAddressFromCoordinates } from '../../utils/geocodeUtils';

const AddressCell = ({ lat, lng }) => {
  const [address, setAddress] = useState('Fetching...');
  useEffect(() => {
    let mounted = true;
    if (lat && lng) {
      getAddressFromCoordinates(lat, lng).then(addr => {
        if (mounted) setAddress(addr);
      });
    } else {
      setAddress('N/A');
    }
    return () => { mounted = false; };
  }, [lat, lng]);

  return (
    <td
      title={address}
      style={{
        padding: '4px 8px',
        fontSize: '11.5px',
        color: '#334155',
        maxWidth: '220px',
        lineHeight: '1.3',
        textAlign: 'left',
        borderRight: '1px solid #E2E8F0',
        wordBreak: 'break-word'
      }}
    >
      {address}
    </td>
  );
};

const formatDuration = (seconds) => {
  if (!seconds) return '00:00:00';
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
};

const getTodayDates = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const curTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const dateStr = `${yyyy}-${mm}-${dd}`;
  return {
    startDate: dateStr,
    startTime: '00:00',
    endDate: dateStr,
    endTime: curTime
  };
};

const TripReportPage = () => {
  const defaultDates = getTodayDates();
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState('');
  const [searchVehicle, setSearchVehicle] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('All');

  const [startDate, setStartDate] = useState(defaultDates.startDate);
  const [startTime, setStartTime] = useState(defaultDates.startTime);
  const [endDate, setEndDate] = useState(defaultDates.endDate);
  const [endTime, setEndTime] = useState(defaultDates.endTime);

  const [activePreset, setActivePreset] = useState('today');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load vehicles
  useEffect(() => {
    vehicleApi.getVehicles({ t: Date.now(), limit: 1000 })
      .then(res => {
        if (res.success && res.data?.length > 0) {
          setVehicles(res.data);
          setVehicleId(res.data[0].id);
        }
      })
      .catch(console.error);
  }, []);

  // Fetch report data
  const fetchReport = useCallback(async (sDate, sTime, eDate, eTime, vId) => {
    const curStart = sDate || startDate;
    const curEnd = eDate || endDate;
    const curVId = vId || vehicleId;

    if (!curStart || !curEnd) return;
    setLoading(true);

    try {
      const start = new Date(`${curStart}T${sTime || startTime || '00:00'}`);
      const end = new Date(`${curEnd}T${eTime || endTime || '23:59'}`);

      const params = new URLSearchParams();
      params.append('startDate', start.toISOString());
      params.append('endDate', end.toISOString());
      if (curVId) params.append('vehicleId', curVId);

      const res = await axiosInstance.get('/api/reports/trip?' + params.toString());
      if (res.data?.success) {
        setData(res.data.data || []);
      } else {
        setData([]);
      }
    } catch (err) {
      console.error('Failed to load trips report:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, startTime, endDate, endTime, vehicleId]);

  // Initial fetch once vehicle is loaded
  useEffect(() => {
    if (vehicleId) {
      fetchReport(startDate, startTime, endDate, endTime, vehicleId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

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
    return vehicles.find(v => String(v.id) === String(vehicleId)) || vehicles[0] || null;
  }, [vehicles, vehicleId]);

  // Compute aggregate totals (Total Distance, Total Duration, etc.)
  const totals = useMemo(() => {
    let totalDist = 0;
    let totalSec = 0;
    data.forEach(r => {
      totalDist += parseFloat(r.distance || 0);
      totalSec += parseInt(r.duration_seconds || 0, 10);
    });
    return {
      distance: totalDist.toFixed(2),
      duration: formatDuration(totalSec),
      count: data.length
    };
  }, [data]);

  // Quick range links handler
  const setQuickRange = (rangeType) => {
    const now = new Date();
    const toDateStr = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    let start = new Date();
    let end = new Date();
    let sTime = '00:00';
    let eTime = '23:59';

    if (rangeType === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (rangeType === 'yesterday') {
      const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      start = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 0, 0, 0);
      end = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 23, 59, 59);
    } else if (rangeType === 'this_week') {
      const dayOfWeek = now.getDay();
      const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 0, 0, 0);
      end = now;
    } else if (rangeType === 'last_week') {
      const dayOfWeek = now.getDay();
      const diffToLastMonday = ((dayOfWeek === 0 ? -6 : 1) - dayOfWeek) - 7;
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToLastMonday, 0, 0, 0);
      end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000 + (23 * 3600 + 59 * 60 + 59) * 1000);
    } else if (rangeType === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      end = now;
    } else if (rangeType === 'last_month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    }

    const sDate = toDateStr(start);
    const eDate = toDateStr(end);
    setStartDate(sDate);
    setStartTime(sTime);
    setEndDate(eDate);
    setEndTime(eTime);
    setActivePreset(rangeType);

    fetchReport(sDate, sTime, eDate, eTime, vehicleId);
  };

  const handleResetFilters = () => {
    const dates = getTodayDates();
    setStartDate(dates.startDate);
    setStartTime(dates.startTime);
    setEndDate(dates.endDate);
    setEndTime(dates.endTime);
    setActivePreset('today');
    if (vehicles.length > 0) {
      setVehicleId(vehicles[0].id);
      fetchReport(dates.startDate, dates.startTime, dates.endDate, dates.endTime, vehicles[0].id);
    }
  };

  const columns = ['Vehicle Name', 'Start Time', 'Start Address', 'End Time', 'End Address', 'Duration (hh:mm:ss)', 'Distance (km)', 'Max Speed', 'Avg Speed'];

  const getExportData = () => {
    return data.map(row => ({
      'Vehicle Name': row.vehicle_name || selectedVehicle?.name || '-',
      'Start Time': formatLocalTime(row.start_time),
      'Start Address': (row.start_lat && row.start_lng) ? `${row.start_lat}, ${row.start_lng}` : 'N/A',
      'End Time': formatLocalTime(row.end_time),
      'End Address': (row.end_lat && row.end_lng) ? `${row.end_lat}, ${row.end_lng}` : 'N/A',
      'Duration (hh:mm:ss)': formatDuration(row.duration_seconds),
      'Distance (km)': row.distance || 0,
      'Max Speed': row.max_speed || 0,
      'Avg Speed': row.avg_speed ? Math.round(row.avg_speed) : 0
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

      {/* ═══════════ LEFT: MODERN COMPACT VEHICLE SIDEBAR (135px) ═══════════ */}
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
        {/* Search Input with magnifying glass icon */}
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
              const isSelected = String(v.id) === String(vehicleId);
              const isOnline = v.is_online || (v.speed && v.speed > 0) || v.ignition;

              return (
                <div
                  key={v.id}
                  onClick={() => {
                    setVehicleId(v.id);
                    fetchReport(startDate, startTime, endDate, endTime, v.id);
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

      {/* ═══════════ RIGHT: MODERN REPORT WORKSPACE ═══════════ */}
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
          {/* Date & Time Selectors */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Start Date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', border: '1px solid #E2E8F0', padding: '4px 8px', borderRadius: '6px', background: '#F8FAFC' }}>
              <Calendar size={13} color="#64748B" />
              <input
                type="date"
                value={startDate}
                onChange={e => { setStartDate(e.target.value); setActivePreset(''); }}
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '11.5px', color: '#0F172A', cursor: 'pointer', fontWeight: 500 }}
              />
            </div>

            {/* Start Time */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', border: '1px solid #E2E8F0', padding: '4px 8px', borderRadius: '6px', background: '#F8FAFC' }}>
              <Clock size={13} color="#64748B" />
              <input
                type="time"
                value={startTime}
                onChange={e => { setStartTime(e.target.value); setActivePreset(''); }}
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '11.5px', color: '#0F172A', cursor: 'pointer', fontWeight: 500 }}
              />
            </div>

            <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 600 }}>→</span>

            {/* End Date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', border: '1px solid #E2E8F0', padding: '4px 8px', borderRadius: '6px', background: '#F8FAFC' }}>
              <Calendar size={13} color="#64748B" />
              <input
                type="date"
                value={endDate}
                onChange={e => { setEndDate(e.target.value); setActivePreset(''); }}
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '11.5px', color: '#0F172A', cursor: 'pointer', fontWeight: 500 }}
              />
            </div>

            {/* End Time */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', border: '1px solid #E2E8F0', padding: '4px 8px', borderRadius: '6px', background: '#F8FAFC' }}>
              <Clock size={13} color="#64748B" />
              <input
                type="time"
                value={endTime}
                onChange={e => { setEndTime(e.target.value); setActivePreset(''); }}
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '11.5px', color: '#0F172A', cursor: 'pointer', fontWeight: 500 }}
              />
            </div>

            {/* Submit / Generate Button (Modern Royal Gradient) */}
            <button
              onClick={() => fetchReport(startDate, startTime, endDate, endTime, vehicleId)}
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
              onClick={() => exportToExcel(getExportData(), 'automated_trips_report')}
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
              onClick={() => exportToPDF(columns, getExportData(), 'Automated Trips Report', 'automated_trips_report')}
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
              onClick={() => exportToCSV(getExportData(), 'automated_trips_report')}
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

        {/* ── 2. Modern Segmented Quick Date Pill Bar ── */}
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
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'this_week', label: 'This Week' },
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
                  {totals.distance} Kms <span style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600 }}>({totals.duration} driving • {totals.count} trips)</span>
                </td>
              </tr>
              {/* Row 3 */}
              <tr>
                <td style={{ width: '14%', padding: '6px 10px', fontWeight: 800, color: '#064E3B', background: '#ECFDF5', borderRight: '1px solid #E2E8F0', textTransform: 'uppercase', fontSize: '10.5px', letterSpacing: '0.03em' }}>
                  From Date & Time :
                </td>
                <td style={{ width: '36%', padding: '6px 10px', fontWeight: 600, color: '#0F172A', borderRight: '1px solid #E2E8F0' }}>
                  {startTime} {formatLocalDate(startDate)}
                </td>
                <td style={{ width: '14%', padding: '6px 10px', fontWeight: 800, color: '#064E3B', background: '#ECFDF5', borderRight: '1px solid #E2E8F0', textTransform: 'uppercase', fontSize: '10.5px', letterSpacing: '0.03em' }}>
                  To Date & Time :
                </td>
                <td style={{ width: '36%', padding: '6px 10px', fontWeight: 600, color: '#0F172A' }}>
                  {endTime} {formatLocalDate(endDate)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── 4. Excel Format Results Data Table (Complete Info, Clear Text, Crisp Grid) ── */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          border: '1px solid #CBD5E1',
          background: '#FFFFFF',
          position: 'relative'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '11.5px', minWidth: '920px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr style={{ background: 'var(--brand-header, #064E3B)', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', borderRight: '1px solid rgba(255,255,255,0.15)', borderTop: 'none', width: '130px', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em' }}>Start Time</th>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', borderRight: '1px solid rgba(255,255,255,0.15)', borderTop: 'none', width: '130px', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em' }}>End Time</th>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', borderRight: '1px solid rgba(255,255,255,0.15)', borderTop: 'none', width: '80px', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em' }}>Duration</th>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', borderRight: '1px solid rgba(255,255,255,0.15)', borderTop: 'none', width: '85px', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em' }}>Distance (km)</th>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', borderRight: '1px solid rgba(255,255,255,0.15)', borderTop: 'none', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em', textAlign: 'left' }}>Start Address</th>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', borderRight: '1px solid rgba(255,255,255,0.15)', borderTop: 'none', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em', textAlign: 'left' }}>End Address</th>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', borderRight: '1px solid rgba(255,255,255,0.15)', borderTop: 'none', width: '70px', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em' }}>Max Spd</th>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', borderRight: '1px solid rgba(255,255,255,0.15)', borderTop: 'none', width: '70px', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em' }}>Avg Spd</th>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', borderTop: 'none', width: '60px', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em' }}>G-Map</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ padding: '30px', textAlign: 'center', color: '#64748B' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <Loader2 size={16} className="animate-spin" color="#059669" />
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>Generating automated trips report...</span>
                    </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '30px 10px', textAlign: 'center', color: '#94A3B8' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>No trips found for the selected criteria.</span>
                      <button
                        onClick={handleResetFilters}
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
                        <RotateCcw size={11} /> Reset to Today
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((row, idx) => {
                  const mapUrl = (row.start_lat && row.start_lng)
                    ? `https://www.google.com/maps?q=${row.start_lat},${row.start_lng}`
                    : `https://www.google.com/maps?q=${row.end_lat},${row.end_lng}`;

                  return (
                    <tr
                      key={idx}
                      style={{
                        background: idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC',
                        borderBottom: '1px solid #E2E8F0',
                        transition: 'background 0.1s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#ECFDF5'}
                      onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'}
                    >
                      <td style={{ padding: '4px 8px', borderRight: '1px solid #E2E8F0', color: '#0F172A', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {formatLocalTime(row.start_time)}
                      </td>
                      <td style={{ padding: '4px 8px', borderRight: '1px solid #E2E8F0', color: '#0F172A', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {formatLocalTime(row.end_time)}
                      </td>
                      <td style={{ padding: '4px 8px', borderRight: '1px solid #E2E8F0', color: '#475569', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {formatDuration(row.duration_seconds)}
                      </td>
                      <td style={{ padding: '4px 8px', borderRight: '1px solid #E2E8F0', color: '#0F172A', fontWeight: 800, whiteSpace: 'nowrap' }}>
                        {row.distance || 0}
                      </td>
                      <AddressCell lat={row.start_lat} lng={row.start_lng} />
                      <AddressCell lat={row.end_lat} lng={row.end_lng} />
                      <td style={{ padding: '4px 8px', borderRight: '1px solid #E2E8F0', color: '#475569', whiteSpace: 'nowrap' }}>
                        {row.max_speed || 0}
                      </td>
                      <td style={{ padding: '4px 8px', borderRight: '1px solid #E2E8F0', color: '#475569', whiteSpace: 'nowrap' }}>
                        {row.avg_speed ? Math.round(row.avg_speed) : 0}
                      </td>
                      <td style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>
                        <a
                          href={mapUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            color: '#2563EB',
                            textDecoration: 'none',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            background: '#EFF6FF',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            fontSize: '10.5px',
                            lineHeight: '1.2'
                          }}
                        >
                          <ExternalLink size={10} /> Link
                        </a>
                      </td>
                    </tr>
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

export default TripReportPage;
