import React, { useState, useEffect, useMemo, useCallback } from 'react';
import CustomDatePicker from '../../components/ui/CustomDatePicker';
import { formatLocalTime } from '../../utils/dateUtils';
import { getAddressFromCoordinates } from '../../utils/geocodeUtils';
import { Search, Loader2, Calendar, FileSpreadsheet, FileText, Download, Play, ExternalLink } from 'lucide-react';
import axiosInstance from '../../api/axios';
import { exportToExcel, exportToPDF, exportToCSV } from '../../utils/exportUtils';
import * as vehicleApi from '../../api/vehicleApi';

const getTodayDateStr = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDuration = (seconds) => {
  if (!seconds || isNaN(seconds)) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const IdleReportPage = () => {
  const todayStr = getTodayDateStr();
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [searchVehicle, setSearchVehicle] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('All');

  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [activePreset, setActivePreset] = useState('today');

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load vehicles
  useEffect(() => {
    vehicleApi.getVehicles({ t: Date.now(), limit: 1000 })
      .then(res => {
        if (res.success && res.data?.length > 0) {
          setVehicles(res.data);
          setSelectedVehicleId(res.data[0].id);
        }
      })
      .catch(console.error);
  }, []);

  // Fetch report data
  const handleGenerate = useCallback(async (sDate, eDate, vId) => {
    const curStart = sDate || startDate;
    const curEnd = eDate || endDate;
    const curVId = vId || selectedVehicleId;

    if (!curStart || !curEnd) return;
    setLoading(true);

    try {
      const start = new Date(curStart);
      start.setHours(0, 0, 0, 0);
      const end = new Date(curEnd);
      end.setHours(23, 59, 59, 999);

      const params = new URLSearchParams();
      params.append('startDate', start.toISOString());
      params.append('endDate', end.toISOString());
      if (curVId) params.append('vehicleId', curVId);

      const res = await axiosInstance.get(`/api/reports/stoppages?${params.toString()}`);
      if (res.data?.success) {
        const rawList = res.data.data || [];
        // Only Idle records
        const idleOnly = rawList.filter(row => row.status === 'Idle');
        const dataWithAddresses = await Promise.all(idleOnly.map(async (row) => {
          let address = row.address;
          if (!address && row.lat && row.lng) {
            address = await getAddressFromCoordinates(row.lat, row.lng);
          }
          return { ...row, address: address || '-' };
        }));
        setData(dataWithAddresses);
      } else {
        setData([]);
      }
    } catch (err) {
      console.error('Failed to load idle wastage report:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedVehicleId]);

  // Initial fetch on vehicle load
  useEffect(() => {
    if (selectedVehicleId) {
      handleGenerate(startDate, endDate, selectedVehicleId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicleId]);

  // Selected vehicle object
  const selectedVehicle = useMemo(() => {
    return vehicles.find(v => String(v.id) === String(selectedVehicleId)) || vehicles[0] || null;
  }, [vehicles, selectedVehicleId]);

  // Group options
  const groupOptions = useMemo(() => {
    const set = new Set();
    vehicles.forEach(v => {
      const g = v.group_name || v.group?.name;
      if (g) set.add(g);
    });
    return ['All', ...Array.from(set)];
  }, [vehicles]);

  // Filtered vehicles
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const g = v.group_name || v.group?.name || '';
      if (selectedGroup !== 'All' && g !== selectedGroup) return false;
      if (searchVehicle.trim()) {
        const query = searchVehicle.toLowerCase();
        const nameMatch = (v.name || '').toLowerCase().includes(query);
        const plateMatch = (v.plate || '').toLowerCase().includes(query);
        return nameMatch || plateMatch;
      }
      return true;
    });
  }, [vehicles, selectedGroup, searchVehicle]);

  // Summary
  const totalIdleSeconds = useMemo(() => {
    return data.reduce((acc, row) => acc + (Number(row.duration_seconds) || 0), 0);
  }, [data]);

  // Quick Presets
  const setQuickRange = (preset) => {
    setActivePreset(preset);
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    let sDate = todayStr;
    let eDate = todayStr;

    if (preset === 'today') {
      sDate = todayStr;
      eDate = todayStr;
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      sDate = toISO(y);
      eDate = sDate;
    } else if (preset === 'this_week') {
      const cur = new Date(now);
      const day = cur.getDay();
      const diff = cur.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(cur.setDate(diff));
      sDate = toISO(mon);
      eDate = todayStr;
    } else if (preset === 'last_week') {
      const cur = new Date(now);
      const day = cur.getDay();
      const diffToMon = cur.getDate() - day + (day === 0 ? -6 : 1) - 7;
      const lastMon = new Date(cur.setDate(diffToMon));
      const lastSun = new Date(lastMon);
      lastSun.setDate(lastSun.getDate() + 6);
      sDate = toISO(lastMon);
      eDate = toISO(lastSun);
    } else if (preset === 'this_month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      sDate = toISO(first);
      eDate = todayStr;
    } else if (preset === 'last_month') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      sDate = toISO(first);
      eDate = toISO(last);
    }

    setStartDate(sDate);
    setEndDate(eDate);
    handleGenerate(sDate, eDate, selectedVehicleId);
  };

  const columns = ['#', 'Date & Time', 'Idle Wastage', 'Address', 'G-Map'];

  const getExportData = () => {
    return data.map((row, idx) => ({
      '#': idx + 1,
      'Vehicle Name': row.vehicle_name || selectedVehicle?.name || '-',
      'Date & Time': formatLocalTime(row.start_time),
      'Idle Wastage': formatDuration(row.duration_seconds || 0),
      'Address': row.address || '-'
    }));
  };

  return (
    <div style={{
      display: 'flex',
      flex: 1,
      height: '100%',
      minHeight: 0,
      overflow: 'hidden',
      background: '#F8FAFC',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    }}>

      {/* ═══════════ LEFT: COMPACT 135px VEHICLE SIDEBAR ═══════════ */}
      <div style={{
        width: '135px',
        minWidth: '135px',
        maxWidth: '135px',
        background: '#FFFFFF',
        borderRight: '1px solid #CBD5E1',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}>
        {/* Search */}
        <div style={{ padding: '6px', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: '#F8FAFC',
            border: '1px solid #CBD5E1',
            borderRadius: '4px',
            padding: '3px 6px'
          }}>
            <Search size={11} color="#64748B" />
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
                color: '#0F172A'
              }}
            />
          </div>
        </div>

        {/* Group Filter */}
        <div style={{ padding: '4px 6px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
          <select
            value={selectedGroup}
            onChange={e => setSelectedGroup(e.target.value)}
            style={{
              width: '100%',
              fontSize: '11px',
              padding: '2px 4px',
              borderRadius: '4px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#0F172A',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {groupOptions.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        {/* Vehicle List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px' }}>
          {filteredVehicles.length === 0 ? (
            <div style={{ padding: '8px', fontSize: '10.5px', color: '#94A3B8', textAlign: 'center' }}>
              No vehicles
            </div>
          ) : (
            filteredVehicles.map(v => {
              const isSelected = String(v.id) === String(selectedVehicleId);
              const isOnline = v.online || v.status === 'Running' || v.status === 'Idle';
              return (
                <div
                  key={v.id}
                  onClick={() => {
                    setSelectedVehicleId(v.id);
                    handleGenerate(startDate, endDate, v.id);
                  }}
                  title={v.name || v.plate}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    marginBottom: '2px',
                    cursor: 'pointer',
                    background: isSelected ? '#D1FAE5' : 'transparent',
                    borderLeft: isSelected ? '3px solid #059669' : '3px solid transparent',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) e.currentTarget.style.background = '#ECFDF5';
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
                    fontWeight: isSelected ? 700 : 500,
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

      {/* ═══════════ RIGHT: EXCEL WORKSPACE ═══════════ */}
      <div style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#FFFFFF',
        padding: '10px 14px',
        overflow: 'hidden',
        gap: '6px'
      }}>

        {/* ── 1. Top Controls Bar: Dates + Generate + Exports ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          paddingBottom: '4px',
          borderBottom: '1px solid #E2E8F0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Start Date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', border: '1px solid #CBD5E1', padding: '3px 8px', borderRadius: '5px', background: '#F8FAFC' }}>
              <Calendar size={13} color="#64748B" />
              <input
                type="date"
                value={startDate}
                onChange={e => { setStartDate(e.target.value); setActivePreset(''); }}
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '11.5px', color: '#0F172A', cursor: 'pointer', fontWeight: 500 }}
              />
            </div>

            <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 600 }}>→</span>

            {/* End Date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', border: '1px solid #CBD5E1', padding: '3px 8px', borderRadius: '5px', background: '#F8FAFC' }}>
              <Calendar size={13} color="#64748B" />
              <input
                type="date"
                value={endDate}
                onChange={e => { setEndDate(e.target.value); setActivePreset(''); }}
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '11.5px', color: '#0F172A', cursor: 'pointer', fontWeight: 500 }}
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={() => handleGenerate(startDate, endDate, selectedVehicleId)}
              disabled={loading}
              style={{
                background: 'linear-gradient(135deg, #059669, #047857)',
                color: '#FFFFFF',
                border: 'none',
                padding: '5px 16px',
                borderRadius: '999px',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 2px 4px rgba(5,150,105,0.25)'
              }}
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={10} fill="#FFFFFF" color="#FFFFFF" />}
              <span>Generate</span>
            </button>
          </div>

          {/* Export Icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => exportToExcel(getExportData(), 'idle_wastage_report')}
              disabled={data.length === 0}
              title="Download Excel Report"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: '#F0FDF4',
                border: '1px solid #DCFCE7',
                padding: '3px 8px',
                borderRadius: '5px',
                cursor: data.length ? 'pointer' : 'not-allowed',
                opacity: data.length ? 1 : 0.5
              }}
            >
              <FileSpreadsheet size={13} color="#16A34A" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#15803D' }}>Excel</span>
            </button>

            <button
              onClick={() => exportToPDF(columns, getExportData(), 'Idle Wastage Report', 'idle_wastage_report')}
              disabled={data.length === 0}
              title="Download PDF Report"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: '#FEF2F2',
                border: '1px solid #FEE2E2',
                padding: '3px 8px',
                borderRadius: '5px',
                cursor: data.length ? 'pointer' : 'not-allowed',
                opacity: data.length ? 1 : 0.5
              }}
            >
              <FileText size={13} color="#DC2626" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#B91C1C' }}>PDF</span>
            </button>

            <button
              onClick={() => exportToCSV(getExportData(), 'idle_wastage_report')}
              disabled={data.length === 0}
              title="Download CSV"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: '#EFF6FF',
                border: '1px solid #DBEAFE',
                padding: '3px 8px',
                borderRadius: '5px',
                cursor: data.length ? 'pointer' : 'not-allowed',
                opacity: data.length ? 1 : 0.5
              }}
            >
              <Download size={13} color="#2563EB" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#1D4ED8' }}>CSV</span>
            </button>
          </div>
        </div>

        {/* ── 2. Segmented Quick Date Pill Bar ── */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '6px',
          padding: '2px',
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
                  background: isActive ? '#064E3B' : '#E6F4EA',
                  border: 'none',
                  color: isActive ? '#FFFFFF' : '#334155',
                  fontSize: '11px',
                  fontWeight: isActive ? 700 : 600,
                  cursor: 'pointer',
                  padding: '4px 14px',
                  borderRadius: '999px',
                  boxShadow: isActive ? '0 1px 3px rgba(6,78,59,0.3)' : 'none',
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
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px', lineHeight: '1.25' }}>
            <tbody>
              {/* Row 1 */}
              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                <td style={{ width: '14%', padding: '5px 8px', fontWeight: 800, color: '#064E3B', background: '#ECFDF5', borderRight: '1px solid #E2E8F0', textTransform: 'uppercase', fontSize: '10.5px', letterSpacing: '0.03em' }}>
                  Vehicle Group
                </td>
                <td style={{ width: '36%', padding: '5px 8px', fontWeight: 700, color: '#0F172A', borderRight: '1px solid #E2E8F0' }}>
                  {selectedVehicle?.group_name || selectedVehicle?.group?.name || 'Default Group'}
                </td>
                <td style={{ width: '14%', padding: '5px 8px', fontWeight: 800, color: '#064E3B', background: '#ECFDF5', borderRight: '1px solid #E2E8F0', textTransform: 'uppercase', fontSize: '10.5px', letterSpacing: '0.03em' }}>
                  Vehicle Name
                </td>
                <td style={{ width: '36%', padding: '5px 8px', fontWeight: 700, color: '#0F172A' }}>
                  {selectedVehicle?.name || selectedVehicle?.plate || '-'}
                </td>
              </tr>
              {/* Row 2 */}
              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                <td style={{ padding: '5px 8px', fontWeight: 800, color: '#064E3B', background: '#ECFDF5', borderRight: '1px solid #E2E8F0', textTransform: 'uppercase', fontSize: '10.5px', letterSpacing: '0.03em' }}>
                  Vehicle Id
                </td>
                <td style={{ padding: '5px 8px', fontWeight: 700, color: '#0F172A', borderRight: '1px solid #E2E8F0', fontFamily: 'monospace' }}>
                  {selectedVehicle?.plate || selectedVehicle?.imei || selectedVehicle?.id || '-'}
                </td>
                <td style={{ padding: '5px 8px', fontWeight: 800, color: '#064E3B', background: '#ECFDF5', borderRight: '1px solid #E2E8F0', textTransform: 'uppercase', fontSize: '10.5px', letterSpacing: '0.03em' }}>
                  Total Idle Time
                </td>
                <td style={{ padding: '5px 8px', fontWeight: 800, color: '#059669' }}>
                  {formatDuration(totalIdleSeconds)} ({data.length} records)
                </td>
              </tr>
              {/* Row 3 */}
              <tr>
                <td style={{ padding: '5px 8px', fontWeight: 800, color: '#064E3B', background: '#ECFDF5', borderRight: '1px solid #E2E8F0', textTransform: 'uppercase', fontSize: '10.5px', letterSpacing: '0.03em' }}>
                  From Date
                </td>
                <td style={{ padding: '5px 8px', color: '#0F172A', borderRight: '1px solid #E2E8F0', fontWeight: 600 }}>
                  {startDate}
                </td>
                <td style={{ padding: '5px 8px', fontWeight: 800, color: '#064E3B', background: '#ECFDF5', borderRight: '1px solid #E2E8F0', textTransform: 'uppercase', fontSize: '10.5px', letterSpacing: '0.03em' }}>
                  To Date
                </td>
                <td style={{ padding: '5px 8px', color: '#0F172A', fontWeight: 600 }}>
                  {endDate}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── 4. Excel Format Data Table ── */}
        <div style={{
          flex: 1,
          border: '1px solid #CBD5E1',
          overflow: 'auto',
          background: '#FFFFFF'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', minWidth: '700px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr style={{ background: '#064E3B', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
                <th style={{ background: '#064E3B', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '8px 8px', border: '1px solid rgba(255,255,255,0.15)', width: '40px', textAlign: 'center' }}>#</th>
                <th style={{ background: '#064E3B', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '8px 8px', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center' }}>Date & Time</th>
                <th style={{ background: '#064E3B', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '8px 8px', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center' }}>Idle Wastage</th>
                <th style={{ background: '#064E3B', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '8px 8px', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center' }}>Address</th>
                <th style={{ background: '#064E3B', color: '#FFFFFF', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '8px 8px', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center', width: '60px' }}>G-Map</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: '40px', textAlign: 'center', border: '1px solid #CBD5E1' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#059669', fontSize: '12px', fontWeight: 600 }}>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Loading idle wastage records...</span>
                    </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: '#64748B', border: '1px solid #CBD5E1', fontSize: '12px' }}>
                    No idle wastage records found for the selected period.
                  </td>
                </tr>
              ) : (
                data.map((row, idx) => {
                  const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
                  const gMapUrl = row.lat && row.lng ? `https://www.google.com/maps?q=${row.lat},${row.lng}` : null;
                  return (
                    <tr
                      key={idx}
                      style={{ background: bg, transition: 'background 0.15s ease' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#ECFDF5'}
                      onMouseLeave={e => e.currentTarget.style.background = bg}
                    >
                      <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'center', fontWeight: 600, color: '#475569' }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'center', fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap' }}>
                        {formatLocalTime(row.start_time)}
                      </td>
                      <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'center', fontWeight: 700, color: '#D97706' }}>
                        {formatDuration(row.duration_seconds || 0)}
                      </td>
                      <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'left', color: '#1E293B', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.25' }}>
                        {row.address || '-'}
                      </td>
                      <td style={{ padding: '4px 8px', border: '1px solid #CBD5E1', textAlign: 'center' }}>
                        {gMapUrl ? (
                          <a
                            href={gMapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#2563EB', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                          >
                            <span>Link</span>
                            <ExternalLink size={10} />
                          </a>
                        ) : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
};

export default IdleReportPage;
