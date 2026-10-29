import React, { useState, useEffect, useMemo, useRef } from 'react';
import CustomDatePicker from '../../components/ui/CustomDatePicker';
import { formatLocalTime, getTodayReportRange } from '../../utils/dateUtils';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Download, Search, Loader2, Map, Filter, FileText,
  FileSpreadsheet, Truck, Calendar, Route, Navigation, Shield,
  Repeat, RotateCcw, ArrowRight, Eye, X, Gauge, Clock, ChevronDown
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
  const [geofences, setGeofences] = useState([]);
  const [loadingGeofences, setLoadingGeofences] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

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
    vehicleApi.getVehicles({ t: Date.now() })
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
    setLoadingGeofences(true);
    axiosInstance.get(`/api/vehicles/${filters.vehicleId}/geofences`)
      .then(res => {
        const gList = Array.isArray(res.data?.data) ? res.data.data : [];
        setGeofences(gList);
      })
      .catch(err => {
        console.error('Failed to load vehicle geofences:', err);
        setGeofences([]);
      })
      .finally(() => setLoadingGeofences(false));
  }, [filters.vehicleId]);

  // Generate Report
  const handleGenerate = async (overrideFilters = null) => {
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
      setErrorMsg(err.response?.data?.error || err.message || 'Failed to generate report. Please check server.');
    } finally {
      setLoading(false);
    }
  };

  // Auto generate on vehicle change or initial load
  useEffect(() => {
    if (filters.vehicleId) {
      handleGenerate();
    }
  }, [filters.vehicleId]);

  // Quick Pair Selection (A -> B, A -> C, B -> C, A -> A, etc.)
  const handleQuickPair = (fromId, toId) => {
    const newFilters = { ...filters, fromGeofenceId: fromId || '', toGeofenceId: toId || '' };
    setFilters(newFilters);
    handleGenerate(newFilters);
  };

  // Quick Date Range Preset Selection (Historical data)
  const handlePresetClick = (days) => {
    const now = new Date();
    let start, end;
    if (days === 0) {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (days === 1) {
      const y = new Date(now.getTime() - 24 * 3600 * 1000);
      start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0);
      end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59);
    } else {
      start = new Date(now.getTime() - days * 24 * 3600 * 1000);
      end = now;
    }
    const newFilters = {
      ...filters,
      startDate: start.toISOString(),
      endDate: end.toISOString()
    };
    setFilters(newFilters);
    handleGenerate(newFilters);
  };

  // Generate permutation pairs for quick badges
  const quickPairs = useMemo(() => {
    if (!geofences || geofences.length === 0) return [];
    const pairs = [];
    // Between distinct geofences (A -> B, A -> C, B -> C, etc.)
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
    // Loops (A -> A, B -> B, C -> C)
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
    'Destination Geofence', 'Arrival Time', 'Trip Type', 'Duration',
    'Distance (km)', 'Max Speed (km/h)', 'Avg Speed (km/h)', 'Fuel (L)'
  ];

  const getExportData = () => {
    return data.map((row, idx) => ({
      'S.No': idx + 1,
      'Vehicle': row.vehicle_name || row.plate || '-',
      'Trip Pair': `${row.from_geofence_name || 'Start'} → ${row.to_geofence_name || 'End'}`,
      'Origin Geofence': row.from_geofence_name || 'Start',
      'Departure Time': row.departure_time ? formatLocalTime(row.departure_time) : '-',
      'Destination Geofence': row.to_geofence_name || 'End',
      'Arrival Time': row.arrival_time ? formatLocalTime(row.arrival_time) : '-',
      'Trip Type': row.trip_type === 'same_location' ? 'Round Loop' : 'Point-to-Point',
      'Duration': formatDuration(row.duration_seconds),
      'Distance (km)': row.distance_km || 0,
      'Max Speed (km/h)': row.max_speed_kmh || 0,
      'Avg Speed (km/h)': row.avg_speed_kmh || 0,
      'Fuel (L)': row.fuel_consumed != null ? `${row.fuel_consumed} L` : '-',
    }));
  };

  return (
    <div style={{ padding: '24px', background: '#F8FAFC', minHeight: '100vh', fontFamily: "'Inter', sans-serif", color: '#0F172A' }}>
      
      {/* ── Top Header Bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => navigate('/trips')}
              style={{
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '7px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#475569',
              }}
              title="Back to Trips"
            >
              <ArrowLeft size={16} />
            </button>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Navigation size={22} color="#2563EB" />
              Manual Trips (Geofence-Based Report)
            </h1>
          </div>
          <p style={{ margin: '4px 0 0 36px', fontSize: '13px', color: '#64748B' }}>
            Calculates trips between defined vehicle geofences (A → B, A → C, B → C, and A → A loops) with accurate departures, arrivals, distance, and transit time.
          </p>
        </div>

        {/* ── Export Buttons ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => exportToExcel(getExportData(), 'Manual_Geofence_Trips_Report')}
              disabled={data.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                background: data.length === 0 ? '#E2E8F0' : '#10B981',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: data.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              <FileSpreadsheet size={14} />
              Excel
            </button>
            <button
              onClick={() => exportToPDF(['Vehicle', 'Trip Pair', 'Departure Time', 'Arrival Time', 'Duration', 'Distance (km)', 'Avg Speed (km/h)'], getExportData(), 'Manual_Geofence_Trips_Report')}
              disabled={data.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                background: data.length === 0 ? '#E2E8F0' : '#EF4444',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: data.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              <FileText size={14} />
              PDF
            </button>
            <button
              onClick={() => exportToCSV(getExportData(), 'Manual_Geofence_Trips_Report')}
              disabled={data.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                background: data.length === 0 ? '#E2E8F0' : '#0284C7',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: data.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              <Download size={14} />
              CSV
            </button>
          </div>
        </div>

      {/* ── Filters Card ── */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '14px',
        border: '1px solid #E2E8F0',
        padding: '16px',
        marginBottom: '16px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          
          {/* Vehicle Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Truck size={16} color="#2563EB" />
            </div>
            <select
              value={filters.vehicleId}
              onChange={e => setFilters({ ...filters, vehicleId: e.target.value, fromGeofenceId: '', toGeofenceId: '' })}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                outline: 'none',
                background: '#FFFFFF',
                color: '#0F172A',
                fontSize: '13px',
                fontWeight: 700,
                minWidth: '200px',
                cursor: 'pointer',
              }}
            >
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.plate || v.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ width: '1px', height: '32px', background: '#E2E8F0' }} />

          {/* Date Pickers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={16} color="#2563EB" />
            </div>
            <CustomDatePicker
              showTime
              value={filters.startDate}
              onChange={e => setFilters({ ...filters, startDate: e.target.value })}
              style={{ width: '220px' }}
            />
            <span style={{ color: '#94A3B8', fontWeight: 800 }}>→</span>
            <CustomDatePicker
              showTime
              value={filters.endDate}
              onChange={e => setFilters({ ...filters, endDate: e.target.value })}
              style={{ width: '220px' }}
            />

            {/* Quick Historical Presets */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {[
                { label: 'Today', days: 0 },
                { label: 'Yesterday', days: 1 },
                { label: '7 Days', days: 7 },
                { label: '30 Days', days: 30 }
              ].map(p => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handlePresetClick(p.days)}
                  style={{
                    padding: '5px 9px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    background: '#F8FAFC',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#334155',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#EFF6FF';
                    e.currentTarget.style.borderColor = '#2563EB';
                    e.currentTarget.style.color = '#2563EB';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#F8FAFC';
                    e.currentTarget.style.borderColor = '#CBD5E1';
                    e.currentTarget.style.color = '#334155';
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ width: '1px', height: '32px', background: '#E2E8F0' }} />

          {/* From Geofence Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>From:</span>
            <select
              value={filters.fromGeofenceId}
              onChange={e => setFilters({ ...filters, fromGeofenceId: e.target.value })}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                outline: 'none',
                background: '#FFFFFF',
                color: '#0F172A',
                fontSize: '12px',
                fontWeight: 700,
                minWidth: '160px',
                cursor: 'pointer',
              }}
            >
              <option value="">All Geofences (Origin)</option>
              {geofences.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* To Geofence Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>To:</span>
            <select
              value={filters.toGeofenceId}
              onChange={e => setFilters({ ...filters, toGeofenceId: e.target.value })}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                outline: 'none',
                background: '#FFFFFF',
                color: '#0F172A',
                fontSize: '12px',
                fontWeight: 700,
                minWidth: '160px',
                cursor: 'pointer',
              }}
            >
              <option value="">All Geofences (Destination)</option>
              {geofences.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Generate Button */}
          <button
            onClick={() => handleGenerate()}
            disabled={loading}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              background: '#2563EB',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              marginLeft: 'auto',
              boxShadow: '0 2px 6px rgba(37,99,235,0.3)',
            }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Generate
          </button>
        </div>

        {/* ── Quick Geofence Pairs Chips Row (e.g. A -> B, A -> C, B -> C, A -> A) ── */}
        {geofences.length > 0 && (
          <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Quick Pair Filters:
            </span>
            
            <button
              onClick={() => handleQuickPair('', '')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                border: '1px solid #CBD5E1',
                background: (!filters.fromGeofenceId && !filters.toGeofenceId) ? '#2563EB' : '#FFFFFF',
                color: (!filters.fromGeofenceId && !filters.toGeofenceId) ? '#FFFFFF' : '#475569',
              }}
            >
              All Pairs
            </button>

            {quickPairs.slice(0, 8).map((pair, idx) => {
              const isSelected = filters.fromGeofenceId === pair.fromId && filters.toGeofenceId === pair.toId;
              return (
                <button
                  key={idx}
                  onClick={() => handleQuickPair(pair.fromId, pair.toId)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: isSelected ? '1px solid #2563EB' : '1px solid #E2E8F0',
                    background: isSelected ? '#EFF6FF' : '#F8FAFC',
                    color: isSelected ? '#2563EB' : '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {pair.isLoop ? <RotateCcw size={10} color="#059669" /> : <ArrowRight size={10} color="#2563EB" />}
                  <span>{pair.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Error Banner ── */}
      {errorMsg && (
        <div style={{
          background: '#FEF2F2',
          border: '1px solid #FCA5A5',
          color: '#991B1B',
          padding: '12px 16px',
          borderRadius: '10px',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </span>
          <button
            onClick={() => setErrorMsg(null)}
            style={{ background: 'none', border: 'none', color: '#991B1B', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── KPI Summary Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
        <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Trips</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>{summary.tripsCount}</div>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Route size={20} color="#2563EB" />
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Distance</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>{summary.totalDistance} <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>km</span></div>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Navigation size={20} color="#10B981" />
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#9333EA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Transit Time</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>{summary.totalDurationFormatted}</div>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={20} color="#9333EA" />
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#EA580C', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Speed</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>{summary.avgSpeed} <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>km/h</span></div>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Gauge size={20} color="#EA580C" />
          </div>
        </div>
      </div>

      {/* ── Table Results ── */}
      <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC' }}>
          <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Manual Trip Records</span>
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: '#EFF6FF', color: '#2563EB' }}>
              {data.length} trips
            </span>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1000px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0' }}>
                {columns.map(c => (
                  <th key={c} style={{ padding: '12px 14px', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {c}
                  </th>
                ))}
                <th style={{ padding: '12px 14px', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>
                  Map
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length + 1} style={{ padding: '60px', textAlign: 'center', color: '#64748B', fontSize: '14px' }}>
                    <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 10px', color: '#2563EB' }} />
                    Analyzing geofence transit data...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} style={{ padding: '60px', textAlign: 'center', color: '#94A3B8', fontSize: '14px' }}>
                    <Shield size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                    No geofence-based trips detected for the selected vehicle and date range.
                    {geofences.length === 0 && (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#64748B' }}>
                        This vehicle currently has 0 geofences assigned. Create or assign geofences to track trips.
                      </div>
                    )}
                  </td>
                </tr>
              ) : data.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                  <td style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: '#64748B' }}>{idx + 1}</td>
                  <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{row.vehicle_name || row.plate}</td>
                  
                  {/* Trip Pair */}
                  <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 800, color: '#2563EB' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: '#EFF6FF',
                        border: '1px solid #BFDBFE',
                        color: '#1D4ED8',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}>
                        {row.from_geofence_name || 'Origin'}
                      </span>
                      <ArrowRight size={12} color="#94A3B8" />
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: row.trip_type === 'same_location' ? '#EFF6FF' : '#ECFDF5',
                        border: row.trip_type === 'same_location' ? '1px solid #BFDBFE' : '1px solid #A7F3D0',
                        color: row.trip_type === 'same_location' ? '#1D4ED8' : '#047857',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}>
                        {row.to_geofence_name || 'Dest'}
                      </span>
                    </div>
                  </td>

                  <td style={{ padding: '12px 14px', fontSize: '12px', color: '#475569', fontWeight: 600 }}>{row.from_geofence_name}</td>
                  <td style={{ padding: '12px 14px', fontSize: '12px', color: '#1E293B', fontWeight: 600 }}>{formatLocalTime(row.departure_time)}</td>
                  <td style={{ padding: '12px 14px', fontSize: '12px', color: '#475569', fontWeight: 600 }}>{row.to_geofence_name}</td>
                  <td style={{ padding: '12px 14px', fontSize: '12px', color: '#1E293B', fontWeight: 600 }}>{formatLocalTime(row.arrival_time)}</td>
                  
                  {/* Trip Type Badge */}
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: row.trip_type === 'same_location' ? '#ECFDF5' : '#F0F9FF',
                      color: row.trip_type === 'same_location' ? '#059669' : '#0284C7',
                    }}>
                      {row.trip_type === 'same_location' ? 'Round Loop' : 'Point-to-Point'}
                    </span>
                  </td>

                  <td style={{ padding: '12px 14px', fontSize: '12px', color: '#0F172A', fontWeight: 700 }}>
                    {formatDuration(row.duration_seconds)}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
                    {row.distance_km || 0} km
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '12px', color: '#DC2626', fontWeight: 700 }}>
                    {row.max_speed_kmh || 0}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '12px', color: '#059669', fontWeight: 700 }}>
                    {row.avg_speed_kmh || 0}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '12px', color: '#475569' }}>
                    {row.fuel_consumed != null ? `${row.fuel_consumed} L` : '-'}
                  </td>

                  {/* View Map Action */}
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <button
                      onClick={() => setPreviewTrip(row)}
                      style={{
                        padding: '6px 10px',
                        background: '#EFF6FF',
                        border: '1px solid #BFDBFE',
                        borderRadius: '6px',
                        color: '#2563EB',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Eye size={12} />
                      <span>Map</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Map Preview Modal ── */}
      {previewTrip && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            width: '900px',
            maxWidth: '100%',
            height: '620px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#F8FAFC',
            }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Navigation size={18} color="#2563EB" />
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
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#475569',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Map */}
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

                {/* Path Polyline */}
                {previewTrip.path_preview && previewTrip.path_preview.length > 0 && (
                  <Polyline
                    positions={previewTrip.path_preview.map(p => [parseFloat(p.lat), parseFloat(p.lng)])}
                    pathOptions={{ color: '#2563EB', weight: 5, opacity: 0.85 }}
                  />
                )}

                {/* Departure Marker */}
                {previewTrip.start_lat && previewTrip.start_lng && (
                  <Marker position={[parseFloat(previewTrip.start_lat), parseFloat(previewTrip.start_lng)]}>
                    <Popup>
                      <strong>Departure:</strong> {previewTrip.from_geofence_name}<br />
                      Time: {formatLocalTime(previewTrip.departure_time)}
                    </Popup>
                  </Marker>
                )}

                {/* Arrival Marker */}
                {previewTrip.end_lat && previewTrip.end_lng && (
                  <Marker position={[parseFloat(previewTrip.end_lat), parseFloat(previewTrip.end_lng)]}>
                    <Popup>
                      <strong>Arrival:</strong> {previewTrip.to_geofence_name}<br />
                      Time: {formatLocalTime(previewTrip.arrival_time)}
                    </Popup>
                  </Marker>
                )}

                {/* Geofence Circles */}
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
