import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Download, Search, Loader2, Filter,
  FileSpreadsheet, FileText, Truck, Calendar, Shield,
  ArrowRight, Repeat, RotateCcw, Compass, MapPin,
  Clock, Navigation, Eye, X, CheckCircle2, ChevronRight
} from 'lucide-react';
import { MapContainer, TileLayer, Circle, Polygon, Polyline, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axiosInstance from '../../api/axios';
import * as vehicleApi from '../../api/vehicleApi';
import { exportToExcel, exportToPDF, exportToCSV } from '../../utils/exportUtils';
import { formatLocalTime, formatLocalDate } from '../../utils/dateUtils';
import { normalizeCoordinates, formatDistance, formatRadius } from '../../utils/geofenceUtils';

// Auto-fitter for transit trajectory map modal
const MapBoundsFitter = ({ pathCoords, fromG, toG }) => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const allLatLngs = [];
    if (pathCoords && pathCoords.length > 0) {
      pathCoords.forEach(p => allLatLngs.push([p.lat, p.lng]));
    }
    if (fromG?.center_lat && fromG?.center_lng) {
      allLatLngs.push([Number(fromG.center_lat), Number(fromG.center_lng)]);
    }
    if (toG?.center_lat && toG?.center_lng) {
      allLatLngs.push([Number(toG.center_lat), Number(toG.center_lng)]);
    }
    if (allLatLngs.length >= 2) {
      try {
        const bounds = L.latLngBounds(allLatLngs);
        map.fitBounds(bounds, { padding: [40, 40], animate: false });
      } catch (_) {}
    }
  }, [map, pathCoords, fromG, toG]);
  return null;
};

const GeofenceTransitReportPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const qVehicleId = searchParams.get('vehicleId');
  const qMode = searchParams.get('mode');

  // Mode: 'single_way' | 'two_way' | 'same_location'
  const [mode, setMode] = useState(() => {
    if (qMode && ['single_way', 'two_way', 'same_location'].includes(qMode)) return qMode;
    return 'single_way';
  });

  const [vehicles, setVehicles] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);

  // Filters
  const [selectedVehicleId, setSelectedVehicleId] = useState(qVehicleId || '');
  const [fromGeofenceId, setFromGeofenceId] = useState('');
  const [toGeofenceId, setToGeofenceId] = useState('');

  // Defaults: Today from 00:00 to 23:59
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

  const [startDate, setStartDate] = useState(startOfDay.toISOString().slice(0, 16));
  const [endDate, setEndDate] = useState(endOfDay.toISOString().slice(0, 16));

  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Map preview modal
  const [previewTrip, setPreviewTrip] = useState(null);

  // Load initial vehicle and geofence rosters
  useEffect(() => {
    const initData = async () => {
      setLoadingVehicles(true);
      try {
        const [vRes, gRes] = await Promise.all([
          vehicleApi.getVehicles({ t: Date.now() }),
          axiosInstance.get('/api/admin/geofences')
        ]);

        if (vRes?.success) {
          setVehicles(vRes.data || []);
        }
        if (gRes?.data?.success) {
          const gList = gRes.data.data || [];
          setGeofences(gList);
          if (gList.length >= 2) {
            setFromGeofenceId(gList[0].id);
            setToGeofenceId(gList[1].id);
          } else if (gList.length === 1) {
            setFromGeofenceId(gList[0].id);
            setToGeofenceId(gList[0].id);
          }
        }
      } catch (err) {
        console.error('Error initializing report prerequisites:', err);
      } finally {
        setLoadingVehicles(false);
      }
    };
    initData();
  }, []);

  // When mode changes to same_location, synchronize toGeofenceId to fromGeofenceId
  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (newMode === 'same_location') {
      setToGeofenceId(fromGeofenceId);
    }
  };

  const handleFromGeofenceChange = (id) => {
    setFromGeofenceId(id);
    if (mode === 'same_location') {
      setToGeofenceId(id);
    }
  };

  const handleGenerate = async () => {
    if (!startDate || !endDate) {
      setErrorMsg('Please select both start and end date/time.');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    setHasGenerated(true);

    try {
      const params = new URLSearchParams();
      params.append('startDate', new Date(startDate).toISOString());
      params.append('endDate', new Date(endDate).toISOString());
      params.append('mode', mode);

      if (selectedVehicleId) params.append('vehicleId', selectedVehicleId);
      if (fromGeofenceId) params.append('fromGeofenceId', fromGeofenceId);
      if (toGeofenceId && mode !== 'same_location') params.append('toGeofenceId', toGeofenceId);

      const res = await axiosInstance.get(`/api/reports/geofence-transit?${params.toString()}`);
      if (res.data?.success) {
        setReportData(res.data.data || []);
      } else {
        setErrorMsg(res.data?.error || 'Failed to fetch geofence transit report.');
      }
    } catch (err) {
      console.error('Transit report query error:', err);
      setErrorMsg(err.response?.data?.error || 'Failed to generate report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // KPI calculations
  const totalTrips = reportData.length;
  const totalDistanceKm = reportData.reduce((acc, row) => acc + (row.distance_km || 0), 0);
  const totalDurationSec = reportData.reduce((acc, row) => acc + (row.duration_seconds || 0), 0);
  const avgSpeed = totalDurationSec > 0 ? (totalDistanceKm / (totalDurationSec / 3600)).toFixed(1) : 0;

  const formatSec = (seconds) => {
    const s = Math.round(seconds || 0);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const exportColumns = [
    'Vehicle Name',
    'Plate',
    'Trip Type',
    'From Geofence',
    'Departure Date & Time',
    'To Geofence',
    'Arrival Date & Time',
    'Duration',
    'Distance (km)',
    'Avg Speed (km/h)',
    'Max Speed (km/h)',
  ];

  const getExportData = () => {
    return reportData.map(row => ({
      'Vehicle Name': row.vehicle_name || '-',
      'Plate': row.plate || '-',
      'Trip Type': row.trip_label || row.trip_type,
      'From Geofence': row.from_geofence_name || '-',
      'Departure Date & Time': formatLocalTime(row.departure_time),
      'To Geofence': row.to_geofence_name || '-',
      'Arrival Date & Time': formatLocalTime(row.arrival_time),
      'Duration': row.duration_formatted || formatSec(row.duration_seconds),
      'Distance (km)': row.distance_km || 0,
      'Avg Speed (km/h)': row.avg_speed_kmh || 0,
      'Max Speed (km/h)': row.max_speed_kmh || 0,
    }));
  };

  return (
    <div style={{ padding: '24px', background: '#F8FAFC', minHeight: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      
      {/* Top Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={() => navigate('/admin/reports/trip')}
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              padding: '8px',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <ArrowLeft size={18} color="#475569" />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
                Geofence Transit & Corridor Analytics
              </h1>
              <span style={{ fontSize: '11px', fontWeight: 700, background: '#E0F2FE', color: '#0284C7', padding: '3px 8px', borderRadius: '99px' }}>
                Origin-Destination Reports
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '2px 0 0 0' }}>
              Analyze vehicle departure times, transit durations, arrival timestamps, and distance between geofences.
            </p>
          </div>
        </div>

        {/* Export Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => exportToCSV(getExportData(), 'geofence_transit_report')}
            disabled={reportData.length === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: '#FFFFFF', border: '1px solid #CBD5E1', padding: '8px 12px',
              borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#334155',
              cursor: reportData.length === 0 ? 'not-allowed' : 'pointer', opacity: reportData.length === 0 ? 0.6 : 1,
            }}
          >
            <FileText size={14} color="#64748B" />
            <span>CSV</span>
          </button>

          <button
            onClick={() => exportToExcel(getExportData(), 'geofence_transit_report', 'Transit Report')}
            disabled={reportData.length === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: '#FFFFFF', border: '1px solid #CBD5E1', padding: '8px 12px',
              borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#16A34A',
              cursor: reportData.length === 0 ? 'not-allowed' : 'pointer', opacity: reportData.length === 0 ? 0.6 : 1,
            }}
          >
            <FileSpreadsheet size={14} color="#16A34A" />
            <span>Excel</span>
          </button>

          <button
            onClick={() => exportToPDF(exportColumns, getExportData(), 'geofence_transit_report', 'Geofence Transit Report')}
            disabled={reportData.length === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: '#FFFFFF', border: '1px solid #CBD5E1', padding: '8px 12px',
              borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#DC2626',
              cursor: reportData.length === 0 ? 'not-allowed' : 'pointer', opacity: reportData.length === 0 ? 0.6 : 1,
            }}
          >
            <Download size={14} color="#DC2626" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* 3 Trip Mode Selector Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
        
        {/* Mode 1: Single Way */}
        <div
          onClick={() => handleModeChange('single_way')}
          style={{
            background: mode === 'single_way' ? '#FFFFFF' : '#F1F5F9',
            border: mode === 'single_way' ? '2px solid #0284C7' : '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '14px 16px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: mode === 'single_way' ? '0 4px 12px rgba(2, 132, 199, 0.15)' : 'none',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: mode === 'single_way' ? '#E0F2FE' : '#E2E8F0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: mode === 'single_way' ? '#0284C7' : '#64748B'
          }}>
            <ArrowRight size={18} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: mode === 'single_way' ? '#0284C7' : '#0F172A' }}>
              1. Single-Way Geofence
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
              Point A $\rightarrow$ Point B one-way transit timing & kilometers.
            </div>
          </div>
        </div>

        {/* Mode 2: Two-Way / Multi-Way */}
        <div
          onClick={() => handleModeChange('two_way')}
          style={{
            background: mode === 'two_way' ? '#FFFFFF' : '#F1F5F9',
            border: mode === 'two_way' ? '2px solid #10B981' : '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '14px 16px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: mode === 'two_way' ? '0 4px 12px rgba(16, 185, 129, 0.15)' : 'none',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: mode === 'two_way' ? '#D1FAE5' : '#E2E8F0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: mode === 'two_way' ? '#059669' : '#64748B'
          }}>
            <Repeat size={18} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: mode === 'two_way' ? '#059669' : '#0F172A' }}>
              2. Two-Way / Multi-Way
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
              Point A $\leftrightarrow$ Point B (Outbound $A \rightarrow B$, Inbound $B \rightarrow A$).
            </div>
          </div>
        </div>

        {/* Mode 3: Same Location Loop */}
        <div
          onClick={() => handleModeChange('same_location')}
          style={{
            background: mode === 'same_location' ? '#FFFFFF' : '#F1F5F9',
            border: mode === 'same_location' ? '2px solid #8B5CF6' : '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '14px 16px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: mode === 'same_location' ? '0 4px 12px rgba(139, 92, 246, 0.15)' : 'none',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: mode === 'same_location' ? '#EDE9FE' : '#E2E8F0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: mode === 'same_location' ? '#7C3AED' : '#64748B'
          }}>
            <RotateCcw size={18} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: mode === 'same_location' ? '#7C3AED' : '#0F172A' }}>
              3. Same Location (Loop Return)
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
              Leaves Geofence A, travels in field, and returns back to Geofence A.
            </div>
          </div>
        </div>

      </div>

      {/* Main Filter Control Card */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
          
          {/* Vehicle Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
              Select Vehicle
            </label>
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '13px',
                color: '#0F172A',
                background: '#F8FAFC',
                boxSizing: 'border-box',
              }}
            >
              <option value="">All Fleet Vehicles</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name || 'Vehicle'}
                </option>
              ))}
            </select>
          </div>

          {/* From Geofence */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
              From Geofence (Origin)
            </label>
            <select
              value={fromGeofenceId}
              onChange={(e) => handleFromGeofenceChange(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '13px',
                color: '#0F172A',
                background: '#F8FAFC',
                boxSizing: 'border-box',
              }}
            >
              <option value="">Any Origin Geofence</option>
              {geofences.map((g) => (
                <option key={g.id} value={g.id}>
                  📍 {g.name} ({g.type})
                </option>
              ))}
            </select>
          </div>

          {/* To Geofence */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
              To Geofence (Destination)
            </label>
            <select
              value={toGeofenceId}
              onChange={(e) => setToGeofenceId(e.target.value)}
              disabled={mode === 'same_location'}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '13px',
                color: mode === 'same_location' ? '#94A3B8' : '#0F172A',
                background: mode === 'same_location' ? '#F1F5F9' : '#F8FAFC',
                boxSizing: 'border-box',
                cursor: mode === 'same_location' ? 'not-allowed' : 'pointer',
              }}
            >
              {mode === 'same_location' ? (
                <option value={fromGeofenceId}>Same as Origin (Loop)</option>
              ) : (
                <>
                  <option value="">Any Destination Geofence</option>
                  {geofences.map((g) => (
                    <option key={g.id} value={g.id}>
                      🎯 {g.name} ({g.type})
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
              Start Date & Time
            </label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '13px',
                color: '#0F172A',
                background: '#F8FAFC',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* End Date */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
              End Date & Time
            </label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '13px',
                color: '#0F172A',
                background: '#F8FAFC',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Generate Button */}
          <div>
            <button
              onClick={handleGenerate}
              disabled={loading}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: '#0284C7',
                color: '#FFFFFF',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
              }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              <span>{loading ? 'Processing Trajectory...' : 'Generate Report'}</span>
            </button>
          </div>

        </div>

        {errorMsg && (
          <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: '13px' }}>
            {errorMsg}
          </div>
        )}
      </div>

      {/* KPI Summary Cards */}
      {hasGenerated && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
          
          <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Total Trips Detected</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>{totalTrips}</div>
            <div style={{ fontSize: '11px', color: '#0284C7', marginTop: '2px', fontWeight: 600 }}>Matched geofence transits</div>
          </div>

          <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Total Distance</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>{totalDistanceKm.toFixed(1)} km</div>
            <div style={{ fontSize: '11px', color: '#16A34A', marginTop: '2px', fontWeight: 600 }}>Active corridor travel</div>
          </div>

          <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Total Driving Duration</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>{formatSec(totalDurationSec)}</div>
            <div style={{ fontSize: '11px', color: '#D97706', marginTop: '2px', fontWeight: 600 }}>Time spent between zones</div>
          </div>

          <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Average Transit Speed</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>{avgSpeed} km/h</div>
            <div style={{ fontSize: '11px', color: '#8B5CF6', marginTop: '2px', fontWeight: 600 }}>Across all trip legs</div>
          </div>

        </div>
      )}

      {/* Results Table Card */}
      <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', overflow: 'hidden', flex: 1 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '12px' }}>
            <Loader2 size={32} color="#0284C7" className="animate-spin" />
            <span style={{ fontSize: '14px', color: '#64748B', fontWeight: 500 }}>
              Scanning GPS points and computing geofence transitions...
            </span>
          </div>
        ) : !hasGenerated ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '10px' }}>
            <Compass size={36} color="#94A3B8" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1E293B' }}>Configure Geofence Transit Criteria</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748B', maxWidth: '420px', textAlign: 'center' }}>
              Select your trip mode (Single-Way, Two-Way, or Same Location), pick origin & destination geofences, and click <b>Generate Report</b>.
            </p>
          </div>
        ) : reportData.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '10px' }}>
            <Shield size={36} color="#94A3B8" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1E293B' }}>No Geofence Transitions Detected</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748B', maxWidth: '420px', textAlign: 'center' }}>
              No trips matching this mode were found in the selected date range. Ensure vehicles have active GPS points entering and exiting these geofences.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  {['Vehicle', 'Trip Type', 'Origin Geofence & Departure', 'Destination Geofence & Arrival', 'Duration', 'Distance', 'Avg / Max Speed', 'Action'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportData.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.15s' }} className="hover:bg-slate-50">
                    
                    {/* Vehicle */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>{row.vehicle_name}</div>
                    </td>

                    {/* Trip Type Badge */}
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 10px',
                          borderRadius: '99px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: row.trip_type === 'outbound' ? '#ECFDF5' : row.trip_type === 'inbound' ? '#FEF3C7' : row.trip_type === 'same_location' ? '#F5F3FF' : '#EFF6FF',
                          color: row.trip_type === 'outbound' ? '#059669' : row.trip_type === 'inbound' ? '#D97706' : row.trip_type === 'same_location' ? '#7C3AED' : '#0284C7',
                          border: `1px solid ${row.trip_type === 'outbound' ? '#A7F3D0' : row.trip_type === 'inbound' ? '#FDE68A' : row.trip_type === 'same_location' ? '#DDD6FE' : '#BFDBFE'}`,
                        }}
                      >
                        {row.trip_label || row.trip_type}
                      </span>
                    </td>

                    {/* Origin & Departure */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: row.from_geofence_color || '#3B82F6' }} />
                        <span style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>{row.from_geofence_name}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={11} />
                        <span>{formatLocalTime(row.departure_time)}</span>
                      </div>
                    </td>

                    {/* Destination & Arrival */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: row.to_geofence_color || '#10B981' }} />
                        <span style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>{row.to_geofence_name}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={11} color="#16A34A" />
                        <span>{formatLocalTime(row.arrival_time)}</span>
                      </div>
                    </td>

                    {/* Duration */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                        {row.duration_formatted}
                      </span>
                    </td>

                    {/* Distance */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontWeight: 800, fontSize: '13px', color: '#0284C7' }}>
                        {row.distance_km} km
                      </span>
                    </td>

                    {/* Speeds */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Avg: {row.avg_speed_kmh} km/h</div>
                      <div style={{ fontSize: '11px', color: '#94A3B8' }}>Max: {row.max_speed_kmh} km/h</div>
                    </td>

                    {/* Action */}
                    <td style={{ padding: '14px 16px' }}>
                      <button
                        onClick={() => setPreviewTrip(row)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid #E2E8F0',
                          background: '#FFFFFF',
                          color: '#0284C7',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <Eye size={13} />
                        <span>View Path</span>
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Interactive Path Preview Modal */}
      {previewTrip && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100050,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '850px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '85vh',
            }}
          >
            {/* Header */}
            <div style={{ padding: '16px 20px', background: '#0F172A', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                  Trip Path: {previewTrip.from_geofence_name} $\rightarrow$ {previewTrip.to_geofence_name}
                </h3>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
                  {previewTrip.vehicle_name} • {previewTrip.distance_km} km in {previewTrip.duration_formatted}
                </div>
              </div>
              <button
                onClick={() => setPreviewTrip(null)}
                style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Map Body */}
            <div style={{ height: '450px', width: '100%', position: 'relative' }}>
              <MapContainer
                center={[previewTrip.start_lat, previewTrip.start_lng]}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapBoundsFitter
                  pathCoords={previewTrip.path_preview}
                  fromG={{ center_lat: previewTrip.start_lat, center_lng: previewTrip.start_lng }}
                  toG={{ center_lat: previewTrip.end_lat, center_lng: previewTrip.end_lng }}
                />

                {/* Start Marker */}
                <Marker position={[previewTrip.start_lat, previewTrip.start_lng]}>
                  <Tooltip permanent direction="top" offset={[0, -10]}>
                    <span style={{ fontSize: '11px', fontWeight: 700 }}>From: {previewTrip.from_geofence_name}</span>
                  </Tooltip>
                </Marker>

                {/* End Marker */}
                <Marker position={[previewTrip.end_lat, previewTrip.end_lng]}>
                  <Tooltip permanent direction="top" offset={[0, -10]}>
                    <span style={{ fontSize: '11px', fontWeight: 700 }}>To: {previewTrip.to_geofence_name}</span>
                  </Tooltip>
                </Marker>

                {/* Trajectory Polyline */}
                {previewTrip.path_preview && previewTrip.path_preview.length >= 2 && (
                  <Polyline
                    positions={previewTrip.path_preview.map(p => [p.lat, p.lng])}
                    pathOptions={{ color: '#0284C7', weight: 4, opacity: 0.8 }}
                  />
                )}
              </MapContainer>
            </div>

            {/* Footer Summary */}
            <div style={{ padding: '14px 20px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '20px', fontSize: '12px', color: '#334155' }}>
                <span>Departed: <b>{formatLocalTime(previewTrip.departure_time)}</b></span>
                <span>Arrived: <b>{formatLocalTime(previewTrip.arrival_time)}</b></span>
                <span>Avg Speed: <b>{previewTrip.avg_speed_kmh} km/h</b></span>
              </div>
              <button
                onClick={() => setPreviewTrip(null)}
                style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default GeofenceTransitReportPage;
