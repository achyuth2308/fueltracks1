import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Download, Search, Loader2, Filter,
  FileSpreadsheet, FileText, Truck, Calendar, Shield,
  RotateCcw, MapPin, Clock, Navigation, CheckCircle2,
  AlertCircle, Eye, X, Gauge, Maximize2, RefreshCw, Radio
} from 'lucide-react';
import { MapContainer, TileLayer, Circle, Polygon, Polyline, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axiosInstance from '../../api/axios';
import * as vehicleApi from '../../api/vehicleApi';
import CustomDatePicker from '../../components/ui/CustomDatePicker';
import { exportToExcel, exportToPDF, exportToCSV } from '../../utils/exportUtils';
import { formatLocalTime, formatLocalDate } from '../../utils/dateUtils';
import { formatRadius, isPointInPolygon } from '../../utils/geofenceUtils';

// Haversine distance in meters
function getHaversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function checkInsideGeofence(lat, lng, geo) {
  if (!geo || lat == null || lng == null) return false;
  if (geo.type === 'circle') {
    const cLat = Number(geo.center_lat);
    const cLng = Number(geo.center_lng);
    const radius = Number(geo.radius) || 200;
    if (isNaN(cLat) || isNaN(cLng)) return false;
    return getHaversineDistanceMeters(lat, lng, cLat, cLng) <= radius;
  }
  // Polygon
  let coords = geo.coordinates;
  if (typeof coords === 'string') {
    try { coords = JSON.parse(coords); } catch (_) { coords = []; }
  }
  return isPointInPolygon(lat, lng, coords || []);
}

function formatDurationHuman(seconds) {
  const s = Math.round(seconds || 0);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

// Leaflet map bounds fitter for loop trajectory
const LoopMapBoundsFitter = ({ pathCoords, baseGeo }) => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const allPoints = [];
    if (Array.isArray(pathCoords) && pathCoords.length > 0) {
      pathCoords.forEach((p) => allPoints.push([p.lat, p.lng]));
    }
    if (baseGeo?.center_lat && baseGeo?.center_lng) {
      allPoints.push([Number(baseGeo.center_lat), Number(baseGeo.center_lng)]);
    }
    if (allPoints.length >= 2) {
      try {
        const bounds = L.latLngBounds(allPoints);
        map.fitBounds(bounds, { padding: [50, 50], animate: false });
      } catch (_) {}
    }
  }, [map, pathCoords, baseGeo]);
  return null;
};

const GeofenceRoundTripReportPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const qVehicleId = searchParams.get('vehicleId');
  const qGeofenceId = searchParams.get('geofenceId') || searchParams.get('fromId');

  const [vehicles, setVehicles] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Filters
  const [selectedVehicleId, setSelectedVehicleId] = useState(qVehicleId || '');
  const [selectedGeofenceId, setSelectedGeofenceId] = useState(qGeofenceId || '');

  // Default: Today 00:00 to 23:59
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0);
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59);

  const formatDateForPicker = (d) => {
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    const hr = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yr}-${mo}-${da}T${hr}:${mi}`;
  };

  const [startDate, setStartDate] = useState(formatDateForPicker(startOfDay));
  const [endDate, setEndDate] = useState(formatDateForPicker(endOfDay));

  // Table & Results
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportRows, setReportRows] = useState([]);
  const [reportSummary, setReportSummary] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [previewLoop, setPreviewLoop] = useState(null);

  // Initial Data Fetch
  useEffect(() => {
    let mounted = true;
    const fetchDropdowns = async () => {
      try {
        setLoadingInitial(true);
        const [vRes, gRes] = await Promise.all([
          vehicleApi.getVehicles({ t: Date.now() }),
          axiosInstance.get('/api/admin/geofences').catch(() => axiosInstance.get('/api/geofences')),
        ]);
        if (mounted) {
          const vList = vRes?.success && Array.isArray(vRes.data)
            ? vRes.data
            : Array.isArray(vRes)
            ? vRes
            : Array.isArray(vRes?.vehicles)
            ? vRes.vehicles
            : [];
          setVehicles(vList);

          const rawG = gRes?.data?.data || gRes?.data || [];
          const list = Array.isArray(rawG) ? rawG : [];
          setGeofences(list);
          if (!selectedGeofenceId && list.length >= 1) {
            setSelectedGeofenceId(list[0].id);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch dropdowns:', err);
      } finally {
        if (mounted) setLoadingInitial(false);
      }
    };
    fetchDropdowns();
    return () => { mounted = false; };
  }, []);

  // Compute report directly in frontend if backend process hasn't been rebooted
  const computeClientSideRoundTripReport = async () => {
    const targetVehicles = selectedVehicleId
      ? vehicles.filter((v) => String(v.id) === String(selectedVehicleId))
      : vehicles;

    const baseGeo = geofences.find((g) => String(g.id) === String(selectedGeofenceId));
    if (!baseGeo) {
      throw new Error('Please select a Base Geofence (Hub A).');
    }

    const calculatedLoops = [];
    let grandDistanceM = 0;
    let grandDurationSec = 0;
    let completedLoopCount = 0;
    let inFieldCount = 0;

    for (const v of targetVehicles) {
      try {
        const histRes = await axiosInstance.get(`/api/vehicles/${v.id}/history`, {
          params: {
            start: new Date(startDate).toISOString(),
            end: new Date(endDate).toISOString(),
          },
        });

        const points = histRes.data?.data || [];
        if (!Array.isArray(points) || points.length < 2) continue;

        let inLoop = false;
        let lastInsidePoint = null;
        let departPoint = null;
        let loopDistanceM = 0;
        let maxSpeedKmh = 0;
        let pathCoords = [];

        for (let i = 0; i < points.length; i++) {
          const p = points[i];
          const inside = checkInsideGeofence(p.lat, p.lng, baseGeo);

          if (inside) {
            if (inLoop && departPoint) {
              // Vehicle returned back inside base geofence -> Loop completed!
              const returnPoint = p;
              const durationSec = Math.max(0, (new Date(returnPoint.device_time || returnPoint.time) - new Date(departPoint.device_time || departPoint.time)) / 1000);
              const distKm = Number((loopDistanceM / 1000).toFixed(2));
              const avgSpeed = durationSec > 0 ? Number((distKm / (durationSec / 3600)).toFixed(1)) : 0;

              calculatedLoops.push({
                vehicle_id: v.id,
                vehicle_name: v.name || v.plate || 'Vehicle',
                plate: v.plate || '-',
                org_name: v.org_name || '-',
                base_geofence_id: baseGeo.id,
                base_geofence_name: baseGeo.name,
                departure_time: departPoint.device_time || departPoint.time,
                return_time: returnPoint.device_time || returnPoint.time,
                field_duration_seconds: Math.round(durationSec),
                field_duration_formatted: formatDurationHuman(durationSec),
                distance_km: distKm,
                avg_speed_kmh: avgSpeed,
                max_speed_kmh: Math.round(maxSpeedKmh),
                status: 'completed',
                status_label: 'Loop Completed',
                path_preview: pathCoords,
              });

              grandDistanceM += loopDistanceM;
              grandDurationSec += durationSec;
              completedLoopCount++;
            }

            inLoop = false;
            departPoint = null;
            loopDistanceM = 0;
            maxSpeedKmh = 0;
            pathCoords = [];
            lastInsidePoint = p;
          } else {
            // Outside Base Geofence
            if (!inLoop && lastInsidePoint) {
              inLoop = true;
              departPoint = lastInsidePoint;
              loopDistanceM = 0;
              maxSpeedKmh = p.speed || 0;
              pathCoords = [
                { lat: departPoint.lat, lng: departPoint.lng },
                { lat: p.lat, lng: p.lng }
              ];
            }

            if (inLoop) {
              if (i > 0) {
                const prev = points[i - 1];
                const seg = getHaversineDistanceMeters(prev.lat, prev.lng, p.lat, p.lng);
                if (seg < 5000) loopDistanceM += seg;
              }
              if (p.speed > maxSpeedKmh) maxSpeedKmh = p.speed;
              if (pathCoords.length < 80) pathCoords.push({ lat: p.lat, lng: p.lng });
            }
          }
        }

        // If interval ended while still outside in field
        if (inLoop && departPoint) {
          inFieldCount++;
          const lastPoint = points[points.length - 1];
          const durationSec = Math.max(0, (new Date(lastPoint.device_time || lastPoint.time) - new Date(departPoint.device_time || departPoint.time)) / 1000);
          const distKm = Number((loopDistanceM / 1000).toFixed(2));
          const avgSpeed = durationSec > 0 ? Number((distKm / (durationSec / 3600)).toFixed(1)) : 0;

          calculatedLoops.push({
            vehicle_id: v.id,
            vehicle_name: v.name || v.plate || 'Vehicle',
            plate: v.plate || '-',
            org_name: v.org_name || '-',
            base_geofence_id: baseGeo.id,
            base_geofence_name: baseGeo.name,
            departure_time: departPoint.device_time || departPoint.time,
            return_time: null,
            field_duration_seconds: Math.round(durationSec),
            field_duration_formatted: `${formatDurationHuman(durationSec)} (Active)`,
            distance_km: distKm,
            avg_speed_kmh: avgSpeed,
            max_speed_kmh: Math.round(maxSpeedKmh),
            status: 'in_field',
            status_label: 'In Field (Active Loop)',
            path_preview: pathCoords,
          });

          grandDistanceM += loopDistanceM;
          grandDurationSec += durationSec;
        }
      } catch (err) {
        console.warn(`History computation error for vehicle ${v.id}:`, err);
      }
    }

    calculatedLoops.sort((a, b) => new Date(b.departure_time) - new Date(a.departure_time));

    const avgField = (completedLoopCount + inFieldCount) > 0
      ? Math.round(grandDurationSec / (completedLoopCount + inFieldCount))
      : 0;

    return {
      rows: calculatedLoops,
      summary: {
        total_loops: calculatedLoops.length,
        completed_loops: completedLoopCount,
        total_distance_km: Number((grandDistanceM / 1000).toFixed(2)),
        avg_field_seconds: avgField,
        avg_field_formatted: formatDurationHuman(avgField),
        currently_in_field: inFieldCount,
      },
    };
  };

  // Main Fetch Report
  const handleFetchReport = async (e) => {
    if (e) e.preventDefault();
    if (!startDate || !endDate) {
      setError('Please select both Start and End date/time.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const params = {
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      };
      if (selectedVehicleId) params.vehicleId = selectedVehicleId;
      if (selectedGeofenceId) params.geofenceId = selectedGeofenceId;

      const res = await axiosInstance.get('/api/reports/geofence-round-trip', { params });
      if (res.data?.success) {
        setReportRows(res.data.data || []);
        setReportSummary(res.data.summary || null);
      } else {
        throw new Error(res.data?.message || 'Server returned invalid report format');
      }
    } catch (apiErr) {
      console.warn('API /geofence-round-trip endpoint failed, running fallback client engine:', apiErr?.message);
      try {
        const fallback = await computeClientSideRoundTripReport();
        setReportRows(fallback.rows);
        setReportSummary(fallback.summary);
      } catch (fbErr) {
        setError(fbErr?.message || 'Failed to generate Round-Trip loop report. Please check selected dates and geofences.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch on initial load once dropdowns ready
  useEffect(() => {
    if (!loadingInitial && geofences.length >= 1) {
      handleFetchReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingInitial]);

  // Filtered rows for UI
  const filteredRows = useMemo(() => {
    return reportRows.filter((r) => {
      if (statusFilter === 'COMPLETED' && r.status !== 'completed') return false;
      if (statusFilter === 'IN_FIELD' && r.status !== 'in_field') return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        r.vehicle_name?.toLowerCase().includes(q) ||
        r.plate?.toLowerCase().includes(q) ||
        r.base_geofence_name?.toLowerCase().includes(q)
      );
    });
  }, [reportRows, searchQuery, statusFilter]);

  // Export handlers
  const handleExport = (type) => {
    if (!reportRows || reportRows.length === 0) return;
    const headers = [
      'S.No',
      'Vehicle Name',
      'Plate Number',
      'Base Hub (A)',
      'Departure Time',
      'Duration in Field',
      'Return Time',
      'Loop Distance (km)',
      'Avg Speed (km/h)',
      'Max Speed (km/h)',
      'Status',
    ];

    const data = filteredRows.map((r, idx) => [
      idx + 1,
      r.vehicle_name,
      r.plate,
      r.base_geofence_name,
      r.departure_time ? `${formatLocalDate(r.departure_time)} ${formatLocalTime(r.departure_time)}` : '-',
      r.field_duration_formatted || '-',
      r.return_time ? `${formatLocalDate(r.return_time)} ${formatLocalTime(r.return_time)}` : 'In Field (Active)',
      `${r.distance_km || 0} km`,
      `${r.avg_speed_kmh || 0} km/h`,
      `${r.max_speed_kmh || 0} km/h`,
      r.status_label || r.status,
    ]);

    const title = 'Round-Trip Geofence Loop Report (A ➔ Field ➔ A)';
    if (type === 'excel') exportToExcel(title, headers, data);
    else if (type === 'pdf') exportToPDF(title, headers, data);
    else if (type === 'csv') exportToCSV(title, headers, data);
  };

  const selectedBaseGeo = useMemo(
    () => geofences.find((g) => String(g.id) === String(selectedGeofenceId)),
    [geofences, selectedGeofenceId]
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/admin/reports')}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                title="Back to Reports"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl border border-purple-100">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900">
                    Round-Trip Loop Report
                  </h1>
                  <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                    A ➔ Field ➔ A Loop
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Track departure from Base Hub (A), time spent operating in the field, loop distance, and return timestamp at Base
                </p>
              </div>
            </div>

            {/* Export Toolbar */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExport('excel')}
                disabled={filteredRows.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Excel</span>
              </button>
              <button
                onClick={() => handleExport('csv')}
                disabled={filteredRows.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-300 transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>CSV</span>
              </button>
              <button
                onClick={() => handleExport('pdf')}
                disabled={filteredRows.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors disabled:opacity-50"
              >
                <FileText className="w-4 h-4" />
                <span>PDF</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* KPI / Summary Cards */}
        {reportSummary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs font-medium text-slate-500">Total Loop Trips</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {reportSummary.total_loops}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">departures recorded</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs font-medium text-slate-500">Completed Loops</div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">
                {reportSummary.completed_loops}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">returned safely to base</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs font-medium text-slate-500">Total Field Distance</div>
              <div className="text-2xl font-bold text-slate-800 mt-1">
                {reportSummary.total_distance_km} <span className="text-sm font-normal text-slate-500">km</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">distance outside base</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs font-medium text-slate-500">Avg Field Duration</div>
              <div className="text-2xl font-bold text-purple-600 mt-1">
                {reportSummary.avg_field_formatted || '0s'}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">time spent outside</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs font-medium text-slate-500">Currently in Field</div>
              <div className="text-2xl font-bold text-amber-600 mt-1">
                {reportSummary.currently_in_field}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">active field missions</div>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <form onSubmit={handleFetchReport} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
            {/* Vehicle Selector */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-slate-400" />
                Select Vehicle
              </label>
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="w-full h-9 px-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              >
                <option value="">-- All Assigned Vehicles --</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name || 'Vehicle'}
                  </option>
                ))}
              </select>
            </div>

            {/* Base Geofence (Hub A) */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-purple-600" />
                Base Hub (A)
              </label>
              <select
                value={selectedGeofenceId}
                onChange={(e) => setSelectedGeofenceId(e.target.value)}
                className="w-full h-9 px-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              >
                <option value="">-- Select Base Hub A --</option>
                {geofences.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Pickers */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Start Date & Time
              </label>
              <CustomDatePicker
                value={startDate}
                onChange={(val) => setStartDate(val)}
                className="h-9 text-xs"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                End Date & Time
              </label>
              <CustomDatePicker
                value={endDate}
                onChange={(val) => setEndDate(val)}
                className="h-9 text-xs"
              />
            </div>

            {/* Submit Button */}
            <div className="lg:col-span-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-9 inline-flex items-center justify-center gap-1.5 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span>Fetch Report</span>
              </button>
            </div>
          </form>

          {/* Quick Filters and Search */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Filter Status:
              </span>
              {[
                { key: 'ALL', label: 'All Loops' },
                { key: 'COMPLETED', label: 'Completed (Returned)' },
                { key: 'IN_FIELD', label: 'Active in Field' },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                    statusFilter === f.key
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search vehicle or base..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Report Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-800">
                Loop Trips ({filteredRows.length})
              </h2>
              {selectedBaseGeo && (
                <span className="text-xs text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-purple-600" />
                  Base: <span className="font-semibold text-slate-700">{selectedBaseGeo.name}</span>
                </span>
              )}
            </div>
            <span className="text-xs text-slate-500">
              Showing range from {startDate.replace('T', ' ')} to {endDate.replace('T', ' ')}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold tracking-wider uppercase text-[11px]">
                  <th className="py-3 px-3 w-12 text-center">S.No</th>
                  <th className="py-3 px-3">Vehicle Details</th>
                  <th className="py-3 px-3">Base Hub (A)</th>
                  <th className="py-3 px-3">Departed Base</th>
                  <th className="py-3 px-3 text-purple-700">Time in Field</th>
                  <th className="py-3 px-3">Returned to Base</th>
                  <th className="py-3 px-3 text-right">Loop Distance</th>
                  <th className="py-3 px-3 text-right">Avg Speed</th>
                  <th className="py-3 px-3 text-right">Max Speed</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center w-16">Map</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center">
                      <div className="inline-flex flex-col items-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                        <span className="text-xs font-medium text-slate-500">
                          Computing round-trip loop trajectories...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      <div className="inline-flex flex-col items-center gap-2">
                        <RotateCcw className="w-8 h-8 text-slate-300" />
                        <span className="text-xs font-medium">
                          No round-trip field loops recorded for the selected vehicles and timeframe.
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Ensure the vehicle has exited and returned to the selected base geofence.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r, idx) => (
                    <tr key={`${r.vehicle_id}-${r.departure_time}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 text-center font-medium text-slate-400">
                        {idx + 1}
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{r.vehicle_name}</div>
                      </td>

                      <td className="py-3 px-3 font-semibold text-slate-800">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                          <span>{r.base_geofence_name}</span>
                        </div>
                      </td>

                      {/* Departed Base */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {r.departure_time ? (
                          <>
                            <div className="font-semibold text-slate-800">
                              {formatLocalTime(r.departure_time)}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {formatLocalDate(r.departure_time)}
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Duration in Field */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-bold text-purple-700">
                          {r.field_duration_formatted || '-'}
                        </div>
                      </td>

                      {/* Returned to Base */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {r.return_time ? (
                          <>
                            <div className="font-semibold text-emerald-700">
                              {formatLocalTime(r.return_time)}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {formatLocalDate(r.return_time)}
                            </div>
                          </>
                        ) : (
                          <span className="text-amber-600 font-medium italic">Active in Field</span>
                        )}
                      </td>

                      {/* Distance */}
                      <td className="py-3 px-3 text-right font-bold text-slate-800 whitespace-nowrap">
                        {r.distance_km} <span className="font-normal text-slate-500">km</span>
                      </td>

                      {/* Avg Speed */}
                      <td className="py-3 px-3 text-right text-slate-600 whitespace-nowrap">
                        {r.avg_speed_kmh} <span className="text-[11px] text-slate-400">km/h</span>
                      </td>

                      {/* Max Speed */}
                      <td className="py-3 px-3 text-right text-slate-600 whitespace-nowrap">
                        {r.max_speed_kmh} <span className="text-[11px] text-slate-400">km/h</span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {r.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Loop Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Radio className="w-3.5 h-3.5 animate-pulse" />
                            In Field (Active)
                          </span>
                        )}
                      </td>

                      {/* Map preview */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => setPreviewLoop(r)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-purple-600 hover:text-purple-800 transition-colors"
                          title="View Loop Trajectory on Map"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Map Preview Modal */}
      {previewLoop && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Loop Trajectory: {previewLoop.vehicle_name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Base: <span className="font-semibold text-slate-700">{previewLoop.base_geofence_name}</span> | Loop Distance: <span className="font-semibold text-slate-700">{previewLoop.distance_km} km</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewLoop(null)}
                className="p-1.5 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-200 bg-white border-b border-slate-200 text-xs">
              <div className="p-3">
                <span className="text-slate-400 block text-[11px]">Departure from Base</span>
                <span className="font-semibold text-slate-800">
                  {previewLoop.departure_time ? `${formatLocalDate(previewLoop.departure_time)} ${formatLocalTime(previewLoop.departure_time)}` : '-'}
                </span>
              </div>
              <div className="p-3">
                <span className="text-slate-400 block text-[11px]">Field Duration</span>
                <span className="font-bold text-purple-700 text-sm block">
                  {previewLoop.field_duration_formatted}
                </span>
              </div>
              <div className="p-3">
                <span className="text-slate-400 block text-[11px]">Return to Base</span>
                <span className="font-semibold text-slate-800">
                  {previewLoop.return_time ? `${formatLocalDate(previewLoop.return_time)} ${formatLocalTime(previewLoop.return_time)}` : 'Active in Field'}
                </span>
              </div>
              <div className="p-3">
                <span className="text-slate-400 block text-[11px]">Speed Metrics</span>
                <span className="text-slate-700 block">
                  Avg: <span className="font-semibold">{previewLoop.avg_speed_kmh} km/h</span> | Max: <span className="font-semibold">{previewLoop.max_speed_kmh} km/h</span>
                </span>
              </div>
            </div>

            <div className="flex-1 w-full relative min-h-[420px]">
              <MapContainer
                center={[20.5937, 78.9629]}
                zoom={6}
                scrollWheelZoom={true}
                className="w-full h-full"
                style={{ height: '420px', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap contributors'
                />

                <LoopMapBoundsFitter
                  pathCoords={previewLoop.path_preview}
                  baseGeo={selectedBaseGeo}
                />

                {/* Base Geofence */}
                {selectedBaseGeo && selectedBaseGeo.type === 'circle' && (
                  <Circle
                    center={[Number(selectedBaseGeo.center_lat), Number(selectedBaseGeo.center_lng)]}
                    radius={Number(selectedBaseGeo.radius) || 200}
                    pathOptions={{ color: '#7C3AED', fillColor: '#A78BFA', fillOpacity: 0.25, weight: 2 }}
                  >
                    <Tooltip permanent direction="top" offset={[0, -10]}>
                      Base Hub: {selectedBaseGeo.name}
                    </Tooltip>
                  </Circle>
                )}

                {/* Polyline */}
                {Array.isArray(previewLoop.path_preview) && previewLoop.path_preview.length > 1 && (
                  <Polyline
                    positions={previewLoop.path_preview.map((p) => [p.lat, p.lng])}
                    pathOptions={{ color: '#7C3AED', weight: 4, opacity: 0.85 }}
                  />
                )}
              </MapContainer>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Purple circle: Base Hub (A) | Purple line: Field Loop Trajectory
              </span>
              <button
                onClick={() => setPreviewLoop(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-lg transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeofenceRoundTripReportPage;
