import React, { useState, useEffect, useMemo, useCallback } from 'react';
import CustomDatePicker from '../../components/ui/CustomDatePicker';
import { formatLocalDate, formatLocalTime, getTodayReportRange } from '../../utils/dateUtils';
import { useNavigate } from 'react-router-dom';
import {
  Download, Search, Loader2, FileText,
  FileSpreadsheet, Truck, Calendar, Clock,
  Navigation, RotateCcw, ArrowRight, Eye, X, Play
} from 'lucide-react';
import axiosInstance from '../../api/axios';
import { exportToExcel, exportToPDF, exportToCSV } from '../../utils/exportUtils';
import * as vehicleApi from '../../api/vehicleApi';
import { MapContainer, TileLayer, Polyline, Circle, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '00:00:00';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// Map Bounds Controller for Preview Modal
const ModalMapBounds = ({ points, fromGeofence, toGeofence }) => {
  const map = useMap();
  useEffect(() => {
    const coords = [];
    if (points && points.length > 0) {
      points.forEach(p => {
        if (p.lat && p.lng) coords.push([parseFloat(p.lat), parseFloat(p.lng)]);
      });
    }
    if (fromGeofence?.center_lat && fromGeofence?.center_lng) {
      coords.push([parseFloat(fromGeofence.center_lat), parseFloat(fromGeofence.center_lng)]);
    }
    if (toGeofence?.center_lat && toGeofence?.center_lng) {
      coords.push([parseFloat(toGeofence.center_lat), parseFloat(toGeofence.center_lng)]);
    }
    if (coords.length > 0) {
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [points, fromGeofence, toGeofence, map]);
  return null;
};

const ManualTripsReportPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [searchVehicle, setSearchVehicle] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('All');

  const [geofences, setGeofences] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [activePreset, setActivePreset] = useState('today');

  // Filters
  const [filters, setFilters] = useState(() => {
    const range = getTodayReportRange();
    return {
      vehicleId: '',
      fromGeofenceId: '',
      toGeofenceId: '',
      startDate: range.startDate,
      endDate: range.endDate,
    };
  });

  // Modal map preview state
  const [previewTrip, setPreviewTrip] = useState(null);

  // Load Vehicles on mount
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

  // Load Geofences when vehicle changes
  useEffect(() => {
    if (!filters.vehicleId) {
      setGeofences([]);
      return;
    }
    axiosInstance.get(`/api/vehicles/${filters.vehicleId}/geofences`)
      .then(res => {
        const gList = Array.isArray(res.data?.data) ? res.data.data : [];
        setGeofences(gList);
      })
      .catch(err => {
        console.error('Failed to load vehicle geofences:', err);
        setGeofences([]);
      });
  }, [filters.vehicleId]);

  // Generate Report
  const handleGenerate = useCallback(async (overrideFilters = null) => {
    const currentFilters = overrideFilters || filters;
    if (!currentFilters.startDate || !currentFilters.endDate) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const start = new Date(currentFilters.startDate);
      const end = new Date(currentFilters.endDate);

      const params = new URLSearchParams();
      params.append('startDate', start.toISOString());
      params.append('endDate', end.toISOString());
      if (currentFilters.vehicleId) params.append('vehicleId', currentFilters.vehicleId);
      if (currentFilters.fromGeofenceId) params.append('fromGeofenceId', currentFilters.fromGeofenceId);
      if (currentFilters.toGeofenceId) params.append('toGeofenceId', currentFilters.toGeofenceId);

      const res = await axiosInstance.get(`/api/reports/geofence-transit?${params.toString()}`);
      if (res.data?.success) {
        setData(res.data.data || []);
      } else {
        setData([]);
      }
    } catch (err) {
      console.error('Failed to generate manual geofence report:', err);
      setData([]);
      setErrorMsg(err.response?.data?.error || err.message || 'Failed to generate report.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Auto generate on vehicle change or initial load
  useEffect(() => {
    if (filters.vehicleId) {
      handleGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.vehicleId]);

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

  // Quick Pair Selection (A -> B, A -> C, B -> C, A -> A, etc.)
  const handleQuickPair = (fromId, toId) => {
    const newFilters = { ...filters, fromGeofenceId: fromId || '', toGeofenceId: toId || '' };
    setFilters(newFilters);
    handleGenerate(newFilters);
  };

  // Quick Date Range Preset Selection
  const setQuickRange = (rangeType) => {
    const now = new Date();
    let start, end;
    if (rangeType === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (rangeType === 'yesterday') {
      const y = new Date(now.getTime() - 24 * 3600 * 1000);
      start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0);
      end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59);
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

    const newFilters = {
      ...filters,
      startDate: start.toISOString(),
      endDate: end.toISOString()
    };
    setActivePreset(rangeType);
    setFilters(newFilters);
    handleGenerate(newFilters);
  };

  // Generate permutation pairs for quick badges
  const quickPairs = useMemo(() => {
    if (!geofences || geofences.length === 0) return [];
    const pairs = [];
    for (let i = 0; i < geofences.length; i++) {
      for (let j = 0; j < geofences.length; j++) {
        const from = geofences[i];
        const to = geofences[j];
        if (i !== j) {
          pairs.push({
            label: `${from.name} → ${to.name}`,
            fromId: from.id,
            toId: to.id,
            isLoop: false,
          });
        }
      }
    }
    geofences.forEach(g => {
      pairs.push({
        label: `${g.name} → ${g.name} (Loop)`,
        fromId: g.id,
        toId: g.id,
        isLoop: true,
      });
    });
    return pairs;
  }, [geofences]);

  // Aggregate Metrics
  const summary = useMemo(() => {
    let totalDist = 0;
    let totalSecs = 0;
    let maxSpd = 0;
    let totalSpeedSum = 0;

    data.forEach(row => {
      const dist = parseFloat(row.distance_km || row.distance || 0);
      const dur = parseFloat(row.duration_seconds || 0);
      const spd = parseFloat(row.max_speed_kmh || row.max_speed || 0);
      const avg = parseFloat(row.avg_speed_kmh || row.avg_speed || 0);

      totalDist += dist;
      totalSecs += dur;
      if (spd > maxSpd) maxSpd = spd;
      totalSpeedSum += avg;
    });

    return {
      tripsCount: data.length,
      totalDistance: totalDist.toFixed(2),
      totalDurationFormatted: formatDuration(totalSecs),
      avgSpeed: data.length > 0 ? (totalSpeedSum / data.length).toFixed(1) : '0.0',
      maxSpeed: maxSpd.toFixed(0),
    };
  }, [data]);

  const columns = [
    'S.No', 'Vehicle', 'Trip Pair', 'Origin Geofence', 'Departure Time',
    'Destination Geofence', 'Arrival Time', 'Duration',
    'Distance (km)', 'Max Speed (km/h)', 'Avg Speed (km/h)', 'Fuel (L)'
  ];

  const getExportData = () => {
    return data.map((row, idx) => ({
      'S.No': idx + 1,
      'Vehicle': row.vehicle_name || row.plate || selectedVehicle?.name || '-',
      'Trip Pair': `${row.from_geofence_name || 'Start'} → ${row.to_geofence_name || 'End'}`,
      'Origin Geofence': row.from_geofence_name || 'Start',
      'Departure Time': row.departure_time ? formatLocalTime(row.departure_time) : '-',
      'Destination Geofence': row.to_geofence_name || 'End',
      'Arrival Time': row.arrival_time ? formatLocalTime(row.arrival_time) : '-',
      'Duration': formatDuration(row.duration_seconds),
      'Distance (km)': row.distance_km || 0,
      'Max Speed (km/h)': row.max_speed_kmh || 0,
      'Avg Speed (km/h)': row.avg_speed_kmh || 0,
      'Fuel (L)': row.fuel_consumed != null ? `${row.fuel_consumed} L` : '-',
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
                    const newF = { ...filters, vehicleId: v.id, fromGeofenceId: '', toGeofenceId: '' };
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Start Date Picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CustomDatePicker
                showTime
                value={filters.startDate}
                onChange={e => { setFilters({ ...filters, startDate: e.target.value }); setActivePreset(''); }}
                style={{ fontSize: '11.5px', padding: '4px 8px', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#FFFFFF' }}
              />
            </div>

            <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 600 }}>→</span>

            {/* End Date Picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CustomDatePicker
                showTime
                value={filters.endDate}
                onChange={e => { setFilters({ ...filters, endDate: e.target.value }); setActivePreset(''); }}
                style={{ fontSize: '11.5px', padding: '4px 8px', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#FFFFFF' }}
              />
            </div>

            {/* From Geofence Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748B' }}>From:</span>
              <select
                value={filters.fromGeofenceId}
                onChange={e => setFilters({ ...filters, fromGeofenceId: e.target.value })}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #E2E8F0',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  maxWidth: '160px',
                  outline: 'none'
                }}
              >
                <option value="">All Geofences (Origin)</option>
                {geofences.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            {/* To Geofence Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748B' }}>To:</span>
              <select
                value={filters.toGeofenceId}
                onChange={e => setFilters({ ...filters, toGeofenceId: e.target.value })}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #E2E8F0',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  maxWidth: '160px',
                  outline: 'none'
                }}
              >
                <option value="">All Geofences (Destination)</option>
                {geofences.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
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
              onClick={() => exportToExcel(getExportData(), 'Manual_Geofence_Trips_Report')}
              disabled={data.length === 0}
              title="Download Excel"
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
              onClick={() => exportToPDF(columns, getExportData(), 'Manual Geofence Trips Report', 'Manual_Geofence_Trips')}
              disabled={data.length === 0}
              title="Download PDF"
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
              onClick={() => exportToCSV(getExportData(), 'Manual_Geofence_Trips')}
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
                  background: isActive ? '#064E3B' : '#E6F4EA',
                  border: 'none',
                  color: isActive ? '#FFFFFF' : '#334155',
                  fontSize: '11px',
                  fontWeight: isActive ? 800 : 600,
                  cursor: 'pointer',
                  padding: '5px 14px',
                  borderRadius: '999px',
                  boxShadow: isActive ? '0 2px 5px rgba(6,78,59,0.3)' : 'none',
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
                  {summary.totalDistance} km <span style={{ fontSize: '10.5px', color: '#065F46', fontWeight: 600 }}>({summary.tripsCount} trips • {summary.totalDurationFormatted} transit)</span>
                </td>
              </tr>
              {/* Row 3 */}
              <tr>
                <td style={{ width: '14%', padding: '6px 10px', fontWeight: 800, color: '#064E3B', background: '#ECFDF5', borderRight: '1px solid #E2E8F0', textTransform: 'uppercase', fontSize: '10.5px', letterSpacing: '0.03em' }}>
                  From Date & Time :
                </td>
                <td style={{ width: '36%', padding: '6px 10px', fontWeight: 600, color: '#0F172A', borderRight: '1px solid #E2E8F0' }}>
                  {formatLocalDate(filters.startDate)}
                </td>
                <td style={{ width: '14%', padding: '6px 10px', fontWeight: 800, color: '#064E3B', background: '#ECFDF5', borderRight: '1px solid #E2E8F0', textTransform: 'uppercase', fontSize: '10.5px', letterSpacing: '0.03em' }}>
                  To Date & Time :
                </td>
                <td style={{ width: '36%', padding: '6px 10px', fontWeight: 600, color: '#0F172A' }}>
                  {formatLocalDate(filters.endDate)}
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
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11.5px', minWidth: '950px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr style={{ background: '#064E3B', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em', width: '35px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.15)', borderTop: 'none' }}>#</th>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em', width: '130px', borderRight: '1px solid rgba(255,255,255,0.15)', borderTop: 'none' }}>Departure Time</th>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em', width: '130px', borderRight: '1px solid rgba(255,255,255,0.15)', borderTop: 'none' }}>Arrival Time</th>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em', width: '220px', borderRight: '1px solid rgba(255,255,255,0.15)', borderTop: 'none' }}>Trip Pair</th>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em', width: '160px', borderRight: '1px solid rgba(255,255,255,0.15)', borderTop: 'none' }}>Origin</th>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em', width: '160px', borderRight: '1px solid rgba(255,255,255,0.15)', borderTop: 'none' }}>Destination</th>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em', width: '80px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.15)', borderTop: 'none' }}>Duration</th>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em', width: '85px', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.15)', borderTop: 'none' }}>Distance</th>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em', width: '65px', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.15)', borderTop: 'none' }}>Max Spd</th>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em', width: '65px', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.15)', borderTop: 'none' }}>Avg Spd</th>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em', width: '60px', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.15)', borderTop: 'none' }}>Fuel</th>
                <th style={{ padding: '8px 8px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em', width: '55px', textAlign: 'center', borderTop: 'none' }}>Map</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="12" style={{ padding: '30px', textAlign: 'center', color: '#64748B' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <Loader2 size={16} className="animate-spin" color="#059669" />
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>Analyzing geofence transit data...</span>
                    </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan="12" style={{ padding: '30px 10px', textAlign: 'center', color: '#94A3B8' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>No geofence-based trips detected for this criteria.</span>
                      {geofences.length === 0 && (
                        <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                          This vehicle currently has 0 geofences assigned.
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((row, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: '1px solid #E2E8F0',
                      background: idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC',
                      transition: 'background 0.1s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#ECFDF5'}
                    onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'}
                  >
                    <td style={{ padding: '4px 6px', color: '#64748B', fontWeight: 600, textAlign: 'center', borderRight: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: '4px 8px', color: '#0F172A', fontWeight: 600, whiteSpace: 'nowrap', borderRight: '1px solid #E2E8F0' }}>
                      {formatLocalTime(row.departure_time)}
                    </td>
                    <td style={{ padding: '4px 8px', color: '#0F172A', fontWeight: 600, whiteSpace: 'nowrap', borderRight: '1px solid #E2E8F0' }}>
                      {formatLocalTime(row.arrival_time)}
                    </td>
                    <td style={{ padding: '4px 8px', fontWeight: 700, borderRight: '1px solid #E2E8F0', lineHeight: '1.3' }}>
                      <span style={{ color: '#047857' }}>{row.from_geofence_name || 'Origin'}</span>
                      <span style={{ color: '#94A3B8', margin: '0 4px' }}>→</span>
                      <span style={{ color: '#059669' }}>{row.to_geofence_name || 'Dest'}</span>
                    </td>
                    <td style={{ padding: '4px 8px', color: '#334155', borderRight: '1px solid #E2E8F0', lineHeight: '1.3' }}>
                      {row.from_geofence_name || '-'}
                    </td>
                    <td style={{ padding: '4px 8px', color: '#334155', borderRight: '1px solid #E2E8F0', lineHeight: '1.3' }}>
                      {row.to_geofence_name || '-'}
                    </td>
                    <td style={{ padding: '4px 8px', color: '#0F172A', fontWeight: 600, textAlign: 'center', borderRight: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>
                      {formatDuration(row.duration_seconds)}
                    </td>
                    <td style={{ padding: '4px 8px', color: '#0F172A', fontWeight: 800, textAlign: 'right', borderRight: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>
                      {row.distance_km || 0} km
                    </td>
                    <td style={{ padding: '4px 8px', color: '#DC2626', fontWeight: 600, textAlign: 'right', borderRight: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>
                      {row.max_speed_kmh || 0}
                    </td>
                    <td style={{ padding: '4px 8px', color: '#059669', fontWeight: 600, textAlign: 'right', borderRight: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>
                      {row.avg_speed_kmh || 0}
                    </td>
                    <td style={{ padding: '4px 8px', color: '#64748B', textAlign: 'right', borderRight: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>
                      {row.fuel_consumed != null ? `${row.fuel_consumed} L` : '-'}
                    </td>
                    <td style={{ padding: '4px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => setPreviewTrip(row)}
                        title="View Route Map"
                        style={{
                          padding: '2px 7px',
                          background: '#EFF6FF',
                          border: '1px solid #BFDBFE',
                          borderRadius: '4px',
                          color: '#2563EB',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          lineHeight: '1.2'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#DBEAFE'}
                        onMouseLeave={e => e.currentTarget.style.background = '#EFF6FF'}
                      >
                        <Eye size={11} /> Map
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* ── Modal Map Preview ── */}
      {previewTrip && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            width: '900px',
            maxWidth: '100%',
            height: '600px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            border: '1px solid #E2E8F0'
          }}>
            <div style={{
              padding: '14px 18px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#F8FAFC',
            }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Navigation size={16} color="#2563EB" />
                  <span>Trip: {previewTrip.from_geofence_name} → {previewTrip.to_geofence_name}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                  {formatLocalTime(previewTrip.departure_time)} to {formatLocalTime(previewTrip.arrival_time)} • {previewTrip.distance_km} km • {formatDuration(previewTrip.duration_seconds)}
                </div>
              </div>

              <button
                onClick={() => setPreviewTrip(null)}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#475569',
                }}
              >
                <X size={15} />
              </button>
            </div>

            <div style={{ flex: 1, position: 'relative' }}>
              <MapContainer
                center={[parseFloat(previewTrip.start_lat || 17.3850), parseFloat(previewTrip.start_lng || 78.4867)]}
                zoom={14}
                style={{ width: '100%', height: '100%' }}
              >
                <TileLayer
                  url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                  subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                  maxZoom={20}
                />

                <ModalMapBounds
                  points={previewTrip.path_preview || []}
                  fromGeofence={geofences.find(g => g.id === previewTrip.from_geofence_id)}
                  toGeofence={geofences.find(g => g.id === previewTrip.to_geofence_id)}
                />

                {previewTrip.path_preview && previewTrip.path_preview.length > 0 && (
                  <Polyline
                    positions={previewTrip.path_preview.map(p => [parseFloat(p.lat), parseFloat(p.lng)])}
                    pathOptions={{ color: '#2563EB', weight: 5, opacity: 0.85 }}
                  />
                )}

                {previewTrip.start_lat && previewTrip.start_lng && (
                  <Marker position={[parseFloat(previewTrip.start_lat), parseFloat(previewTrip.start_lng)]}>
                    <Popup>
                      <strong>Departure:</strong> {previewTrip.from_geofence_name}<br />
                      Time: {formatLocalTime(previewTrip.departure_time)}
                    </Popup>
                  </Marker>
                )}

                {previewTrip.end_lat && previewTrip.end_lng && (
                  <Marker position={[parseFloat(previewTrip.end_lat), parseFloat(previewTrip.end_lng)]}>
                    <Popup>
                      <strong>Arrival:</strong> {previewTrip.to_geofence_name}<br />
                      Time: {formatLocalTime(previewTrip.arrival_time)}
                    </Popup>
                  </Marker>
                )}

                {geofences.filter(g => g.id === previewTrip.from_geofence_id || g.id === previewTrip.to_geofence_id).map(g => (
                  g.center_lat && g.center_lng && (
                    <Circle
                      key={g.id}
                      center={[parseFloat(g.center_lat), parseFloat(g.center_lng)]}
                      radius={parseFloat(g.radius || 300)}
                      pathOptions={{
                        color: g.id === previewTrip.from_geofence_id ? '#2563EB' : '#10B981',
                        fillColor: g.id === previewTrip.from_geofence_id ? '#2563EB' : '#10B981',
                        fillOpacity: 0.18,
                        weight: 2,
                      }}
                    >
                      <Popup>
                        <strong>{g.name}</strong><br />
                        Radius: {g.radius || 300}m
                      </Popup>
                    </Circle>
                  )
                ))}
              </MapContainer>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ManualTripsReportPage;
