import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Download, Search, Loader2, Filter,
  FileSpreadsheet, FileText, Truck, Calendar, Shield,
  ArrowRight, Repeat, MapPin, Clock, Navigation, CheckCircle2,
  AlertCircle, Eye, X, Gauge, Maximize2, RefreshCw, Milestone, RotateCw
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

// Leaflet map fitter for route modal
const RouteMapBoundsFitter = ({ pathCoords, geoA, geoB }) => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const allPoints = [];
    if (Array.isArray(pathCoords) && pathCoords.length > 0) {
      pathCoords.forEach((p) => allPoints.push([p.lat, p.lng]));
    }
    if (geoA?.center_lat && geoA?.center_lng) {
      allPoints.push([Number(geoA.center_lat), Number(geoA.center_lng)]);
    }
    if (geoB?.center_lat && geoB?.center_lng) {
      allPoints.push([Number(geoB.center_lat), Number(geoB.center_lng)]);
    }
    if (allPoints.length >= 2) {
      try {
        const bounds = L.latLngBounds(allPoints);
        map.fitBounds(bounds, { padding: [50, 50], animate: false });
      } catch (_) {}
    }
  }, [map, pathCoords, geoA, geoB]);
  return null;
};

const GeofenceTwoWayReportPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const qVehicleId = searchParams.get('vehicleId');
  const qFromId = searchParams.get('fromId') || searchParams.get('fromGeofenceId');
  const qToId = searchParams.get('toId') || searchParams.get('toGeofenceId');

  const [vehicles, setVehicles] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Filters
  const [selectedVehicleId, setSelectedVehicleId] = useState(qVehicleId || '');
  const [fromGeofenceId, setFromGeofenceId] = useState(qFromId || '');
  const [toGeofenceId, setToGeofenceId] = useState(qToId || '');

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

  // Route Map Preview Modal State
  const [previewCycle, setPreviewCycle] = useState(null);

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
          if (!fromGeofenceId && list.length >= 1) {
            setFromGeofenceId(list[0].id);
          }
          if (!toGeofenceId && list.length >= 2) {
            setToGeofenceId(list[1].id);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch filter rosters:', err);
      } finally {
        if (mounted) setLoadingInitial(false);
      }
    };
    fetchDropdowns();
    return () => { mounted = false; };
  }, []);

  // Compute report directly in frontend if backend process hasn't been rebooted
  const computeClientSideTwoWayReport = async () => {
    const targetVehicles = selectedVehicleId
      ? vehicles.filter((v) => String(v.id) === String(selectedVehicleId))
      : vehicles;

    const geoA = geofences.find((g) => String(g.id) === String(fromGeofenceId));
    const geoB = geofences.find((g) => String(g.id) === String(toGeofenceId));

    if (!geoA || !geoB) {
      throw new Error('Please select both Origin (A) and Destination (B) geofences.');
    }

    const calculatedCycles = [];
    let grandDistanceM = 0;
    let grandOutboundSec = 0;
    let grandInboundSec = 0;
    let grandHaltSec = 0;
    let completedCount = 0;
    let outboundCount = 0;
    let inboundCount = 0;
    let haltCount = 0;
    let currentlyAtBCount = 0;

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

        let cycleState = 'IDLE';
        let lastInsideAPoint = null;
        let departPointA = null;
        let arrivePointB = null;
        let departPointB = null;
        let lastInsideBPoint = null;
        let outboundDistanceM = 0;
        let inboundDistanceM = 0;
        let maxSpeedKmh = 0;
        let pathCoords = [];

        for (let i = 0; i < points.length; i++) {
          const p = points[i];
          const insideA = checkInsideGeofence(p.lat, p.lng, geoA);
          const insideB = checkInsideGeofence(p.lat, p.lng, geoB);

          if (insideA) {
            lastInsideAPoint = p;
          }

          if (cycleState === 'IDLE') {
            if (!insideA && lastInsideAPoint) {
              cycleState = 'OUTBOUND_TRANSIT';
              departPointA = lastInsideAPoint;
              outboundDistanceM = 0;
              inboundDistanceM = 0;
              maxSpeedKmh = p.speed || 0;
              pathCoords = [
                { lat: departPointA.lat, lng: departPointA.lng },
                { lat: p.lat, lng: p.lng }
              ];
            }
          } else if (cycleState === 'OUTBOUND_TRANSIT') {
            if (insideA) {
              cycleState = 'IDLE';
              departPointA = null;
              pathCoords = [];
            } else {
              if (i > 0) {
                const prev = points[i - 1];
                const seg = getHaversineDistanceMeters(prev.lat, prev.lng, p.lat, p.lng);
                if (seg < 5000) outboundDistanceM += seg;
              }
              if (p.speed > maxSpeedKmh) maxSpeedKmh = p.speed;
              if (pathCoords.length < 50) pathCoords.push({ lat: p.lat, lng: p.lng });

              if (insideB) {
                cycleState = 'AT_DESTINATION_B';
                arrivePointB = p;
                lastInsideBPoint = p;
              }
            }
          } else if (cycleState === 'AT_DESTINATION_B') {
            if (insideB) {
              lastInsideBPoint = p;
            } else {
              cycleState = 'INBOUND_TRANSIT';
              departPointB = lastInsideBPoint || p;
              if (pathCoords.length < 75) pathCoords.push({ lat: departPointB.lat, lng: departPointB.lng });
            }
          } else if (cycleState === 'INBOUND_TRANSIT') {
            if (i > 0) {
              const prev = points[i - 1];
              const seg = getHaversineDistanceMeters(prev.lat, prev.lng, p.lat, p.lng);
              if (seg < 5000) inboundDistanceM += seg;
            }
            if (p.speed > maxSpeedKmh) maxSpeedKmh = p.speed;
            if (pathCoords.length < 100) pathCoords.push({ lat: p.lat, lng: p.lng });

            if (insideA) {
              const returnPointA = p;
              const outboundSec = Math.max(0, (new Date(arrivePointB.device_time || arrivePointB.time) - new Date(departPointA.device_time || departPointA.time)) / 1000);
              const haltSec = Math.max(0, (new Date(departPointB.device_time || departPointB.time) - new Date(arrivePointB.device_time || arrivePointB.time)) / 1000);
              const inboundSec = Math.max(0, (new Date(returnPointA.device_time || returnPointA.time) - new Date(departPointB.device_time || departPointB.time)) / 1000);
              const totalTurnaroundSec = Math.max(0, (new Date(returnPointA.device_time || returnPointA.time) - new Date(departPointA.device_time || departPointA.time)) / 1000);

              const outDistKm = Number((outboundDistanceM / 1000).toFixed(2));
              const inDistKm = Number((inboundDistanceM / 1000).toFixed(2));
              const totalDistKm = Number(((outboundDistanceM + inboundDistanceM) / 1000).toFixed(2));

              calculatedCycles.push({
                vehicle_id: v.id,
                vehicle_name: v.name || v.plate || 'Vehicle',
                plate: v.plate || '-',
                org_name: v.org_name || '-',
                from_geofence_id: geoA.id,
                from_geofence_name: geoA.name,
                to_geofence_id: geoB.id,
                to_geofence_name: geoB.name,
                route_name: `${geoA.name} ⇄ ${geoB.name}`,
                departure_time_a: departPointA.device_time || departPointA.time,
                outbound_duration_seconds: Math.round(outboundSec),
                outbound_duration_formatted: formatDurationHuman(outboundSec),
                arrival_time_b: arrivePointB.device_time || arrivePointB.time,
                halt_in_b_seconds: Math.round(haltSec),
                halt_in_b_formatted: formatDurationHuman(haltSec),
                departure_time_b: departPointB.device_time || departPointB.time,
                inbound_duration_seconds: Math.round(inboundSec),
                inbound_duration_formatted: formatDurationHuman(inboundSec),
                return_arrival_time_a: returnPointA.device_time || returnPointA.time,
                total_turnaround_seconds: Math.round(totalTurnaroundSec),
                total_turnaround_formatted: formatDurationHuman(totalTurnaroundSec),
                outbound_distance_km: outDistKm,
                inbound_distance_km: inDistKm,
                total_distance_km: totalDistKm,
                max_speed_kmh: Math.round(maxSpeedKmh),
                status: 'completed',
                status_label: 'Full Cycle Completed',
                path_preview: pathCoords,
              });

              grandDistanceM += (outboundDistanceM + inboundDistanceM);
              grandOutboundSec += outboundSec;
              grandInboundSec += inboundSec;
              grandHaltSec += haltSec;
              completedCount++;
              outboundCount++;
              inboundCount++;
              haltCount++;

              cycleState = 'IDLE';
              departPointA = null;
              arrivePointB = null;
              departPointB = null;
              lastInsideBPoint = null;
              outboundDistanceM = 0;
              inboundDistanceM = 0;
              maxSpeedKmh = 0;
              pathCoords = [];
            }
          }
        }

        // Check active cycles at end of range
        if (cycleState === 'AT_DESTINATION_B' && arrivePointB && departPointA) {
          currentlyAtBCount++;
          const lastPoint = points[points.length - 1];
          const outboundSec = Math.max(0, (new Date(arrivePointB.device_time || arrivePointB.time) - new Date(departPointA.device_time || departPointA.time)) / 1000);
          const haltSec = Math.max(0, (new Date(lastPoint.device_time || lastPoint.time) - new Date(arrivePointB.device_time || arrivePointB.time)) / 1000);
          const outDistKm = Number((outboundDistanceM / 1000).toFixed(2));

          calculatedCycles.push({
            vehicle_id: v.id,
            vehicle_name: v.name || v.plate || 'Vehicle',
            plate: v.plate || '-',
            org_name: v.org_name || '-',
            from_geofence_id: geoA.id,
            from_geofence_name: geoA.name,
            to_geofence_id: geoB.id,
            to_geofence_name: geoB.name,
            route_name: `${geoA.name} ⇄ ${geoB.name}`,
            departure_time_a: departPointA.device_time || departPointA.time,
            outbound_duration_seconds: Math.round(outboundSec),
            outbound_duration_formatted: formatDurationHuman(outboundSec),
            arrival_time_b: arrivePointB.device_time || arrivePointB.time,
            halt_in_b_seconds: Math.round(haltSec),
            halt_in_b_formatted: `${formatDurationHuman(haltSec)} (Parked)`,
            departure_time_b: null,
            inbound_duration_seconds: null,
            inbound_duration_formatted: '-',
            return_arrival_time_a: null,
            total_turnaround_seconds: null,
            total_turnaround_formatted: 'Pending Return',
            outbound_distance_km: outDistKm,
            inbound_distance_km: 0,
            total_distance_km: outDistKm,
            max_speed_kmh: Math.round(maxSpeedKmh),
            status: 'at_destination_b',
            status_label: `Currently At ${geoB.name}`,
            path_preview: pathCoords,
          });

          grandDistanceM += outboundDistanceM;
          grandOutboundSec += outboundSec;
          outboundCount++;
        } else if (cycleState === 'INBOUND_TRANSIT' && departPointA && arrivePointB && departPointB) {
          const lastPoint = points[points.length - 1];
          const outboundSec = Math.max(0, (new Date(arrivePointB.device_time || arrivePointB.time) - new Date(departPointA.device_time || departPointA.time)) / 1000);
          const haltSec = Math.max(0, (new Date(departPointB.device_time || departPointB.time) - new Date(arrivePointB.device_time || arrivePointB.time)) / 1000);
          const inboundSec = Math.max(0, (new Date(lastPoint.device_time || lastPoint.time) - new Date(departPointB.device_time || departPointB.time)) / 1000);

          const outDistKm = Number((outboundDistanceM / 1000).toFixed(2));
          const inDistKm = Number((inboundDistanceM / 1000).toFixed(2));
          const totalDistKm = Number(((outboundDistanceM + inboundDistanceM) / 1000).toFixed(2));

          calculatedCycles.push({
            vehicle_id: v.id,
            vehicle_name: v.name || v.plate || 'Vehicle',
            plate: v.plate || '-',
            org_name: v.org_name || '-',
            from_geofence_id: geoA.id,
            from_geofence_name: geoA.name,
            to_geofence_id: geoB.id,
            to_geofence_name: geoB.name,
            route_name: `${geoA.name} ⇄ ${geoB.name}`,
            departure_time_a: departPointA.device_time || departPointA.time,
            outbound_duration_seconds: Math.round(outboundSec),
            outbound_duration_formatted: formatDurationHuman(outboundSec),
            arrival_time_b: arrivePointB.device_time || arrivePointB.time,
            halt_in_b_seconds: Math.round(haltSec),
            halt_in_b_formatted: formatDurationHuman(haltSec),
            departure_time_b: departPointB.device_time || departPointB.time,
            inbound_duration_seconds: Math.round(inboundSec),
            inbound_duration_formatted: `${formatDurationHuman(inboundSec)} (En Route)`,
            return_arrival_time_a: null,
            total_turnaround_seconds: null,
            total_turnaround_formatted: 'Inbound Return',
            outbound_distance_km: outDistKm,
            inbound_distance_km: inDistKm,
            total_distance_km: totalDistKm,
            max_speed_kmh: Math.round(maxSpeedKmh),
            status: 'inbound_transit',
            status_label: `Returning (${geoB.name} ➔ ${geoA.name})`,
            path_preview: pathCoords,
          });

          grandDistanceM += (outboundDistanceM + inboundDistanceM);
          grandOutboundSec += outboundSec;
          grandHaltSec += haltSec;
          outboundCount++;
          haltCount++;
        }
      } catch (err) {
        console.warn(`History computation error for vehicle ${v.id}:`, err);
      }
    }

    calculatedCycles.sort((a, b) => new Date(b.departure_time_a) - new Date(a.departure_time_a));

    const avgOut = outboundCount > 0 ? Math.round(grandOutboundSec / outboundCount) : 0;
    const avgIn = inboundCount > 0 ? Math.round(grandInboundSec / inboundCount) : 0;
    const avgHalt = haltCount > 0 ? Math.round(grandHaltSec / haltCount) : 0;

    return {
      rows: calculatedCycles,
      summary: {
        total_cycles: calculatedCycles.length,
        completed_cycles: completedCount,
        total_distance_km: Number((grandDistanceM / 1000).toFixed(2)),
        avg_outbound_seconds: avgOut,
        avg_outbound_formatted: formatDurationHuman(avgOut),
        avg_inbound_seconds: avgIn,
        avg_inbound_formatted: formatDurationHuman(avgIn),
        avg_halt_seconds: avgHalt,
        avg_halt_formatted: formatDurationHuman(avgHalt),
        currently_at_b: currentlyAtBCount,
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
      if (fromGeofenceId) params.fromGeofenceId = fromGeofenceId;
      if (toGeofenceId) params.toGeofenceId = toGeofenceId;

      const res = await axiosInstance.get('/api/reports/geofence-two-way', { params });
      if (res.data?.success) {
        setReportRows(res.data.data || []);
        setReportSummary(res.data.summary || null);
      } else {
        throw new Error(res.data?.message || 'Server returned invalid report format');
      }
    } catch (apiErr) {
      console.warn('API /geofence-two-way endpoint failed, running fallback client engine:', apiErr?.message);
      try {
        const fallback = await computeClientSideTwoWayReport();
        setReportRows(fallback.rows);
        setReportSummary(fallback.summary);
      } catch (fbErr) {
        setError(fbErr?.message || 'Failed to generate Two-Way trip report. Please check selected dates and geofences.');
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
      if (statusFilter === 'AT_B' && r.status !== 'at_destination_b') return false;
      if (statusFilter === 'IN_TRANSIT' && r.status !== 'outbound_transit' && r.status !== 'inbound_transit') return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        r.vehicle_name?.toLowerCase().includes(q) ||
        r.plate?.toLowerCase().includes(q) ||
        r.route_name?.toLowerCase().includes(q) ||
        r.from_geofence_name?.toLowerCase().includes(q) ||
        r.to_geofence_name?.toLowerCase().includes(q)
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
      'Full Route',
      'Departure from A',
      'Outbound Duration',
      'Arrival at B',
      'Halt in B',
      'Departure from B',
      'Inbound Duration',
      'Return Arrival at A',
      'Total Turnaround Time',
      'Total Round km',
      'Status',
    ];

    const data = filteredRows.map((r, idx) => [
      idx + 1,
      r.vehicle_name,
      r.plate,
      r.route_name,
      r.departure_time_a ? `${formatLocalDate(r.departure_time_a)} ${formatLocalTime(r.departure_time_a)}` : '-',
      r.outbound_duration_formatted || '-',
      r.arrival_time_b ? `${formatLocalDate(r.arrival_time_b)} ${formatLocalTime(r.arrival_time_b)}` : '-',
      r.halt_in_b_formatted || '-',
      r.departure_time_b ? `${formatLocalDate(r.departure_time_b)} ${formatLocalTime(r.departure_time_b)}` : '-',
      r.inbound_duration_formatted || '-',
      r.return_arrival_time_a ? `${formatLocalDate(r.return_arrival_time_a)} ${formatLocalTime(r.return_arrival_time_a)}` : '-',
      r.total_turnaround_formatted || '-',
      `${r.total_distance_km || 0} km`,
      r.status_label || r.status,
    ]);

    const title = 'Two-Way Geofence Trip Report (A ⇄ B)';
    if (type === 'excel') exportToExcel(title, headers, data);
    else if (type === 'pdf') exportToPDF(title, headers, data);
    else if (type === 'csv') exportToCSV(title, headers, data);
  };

  const getStatusBadge = (status, label) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {label || 'Cycle Completed'}
          </span>
        );
      case 'at_destination_b':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            {label || 'At Destination (B)'}
          </span>
        );
      case 'inbound_transit':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <RotateCw className="w-3.5 h-3.5" />
            {label || 'Returning to A'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Navigation className="w-3.5 h-3.5" />
            {label || status}
          </span>
        );
    }
  };

  const selectedGeoA = useMemo(
    () => geofences.find((g) => String(g.id) === String(fromGeofenceId)),
    [geofences, fromGeofenceId]
  );
  const selectedGeoB = useMemo(
    () => geofences.find((g) => String(g.id) === String(toGeofenceId)),
    [geofences, toGeofenceId]
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
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                <Repeat className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900">
                    Two-Way Geofence Trip Report
                  </h1>
                  <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    A ⇄ B Round Cycle
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Detailed turnaround analytics for shuttle loops: Outbound Leg (A ➔ B), Halt & Unloading in B, and Inbound Leg (B ➔ A)
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs font-medium text-slate-500">Completed Cycles</div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">
                {reportSummary.completed_cycles}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                of {reportSummary.total_cycles} total registered
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs font-medium text-slate-500">Total Distance</div>
              <div className="text-2xl font-bold text-slate-800 mt-1">
                {reportSummary.total_distance_km} <span className="text-sm font-normal text-slate-500">km</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">combined out & in</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs font-medium text-slate-500">Avg Outbound (A ➔ B)</div>
              <div className="text-2xl font-bold text-blue-600 mt-1">
                {reportSummary.avg_outbound_formatted || '0s'}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">one-way transit time</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs font-medium text-slate-500">Avg Inbound (B ➔ A)</div>
              <div className="text-2xl font-bold text-indigo-600 mt-1">
                {reportSummary.avg_inbound_formatted || '0s'}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">return transit time</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs font-medium text-slate-500">Avg Halt in B</div>
              <div className="text-2xl font-bold text-amber-600 mt-1">
                {reportSummary.avg_halt_formatted || '0s'}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">unloading / stay in B</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs font-medium text-slate-500">Currently At B</div>
              <div className="text-2xl font-bold text-purple-600 mt-1">
                {reportSummary.currently_at_b}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">vehicles docked at dest</div>
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
                className="w-full h-9 px-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              >
                <option value="">-- All Assigned Vehicles --</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name || 'Vehicle'}
                  </option>
                ))}
              </select>
            </div>

            {/* Origin Geofence (A) */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                Hub A (Origin)
              </label>
              <select
                value={fromGeofenceId}
                onChange={(e) => setFromGeofenceId(e.target.value)}
                className="w-full h-9 px-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              >
                <option value="">-- Select Origin A --</option>
                {geofences.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Destination Geofence (B) */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                Hub B (Destination)
              </label>
              <select
                value={toGeofenceId}
                onChange={(e) => setToGeofenceId(e.target.value)}
                className="w-full h-9 px-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              >
                <option value="">-- Select Destination B --</option>
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
            <div className="lg:col-span-1">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-9 inline-flex items-center justify-center gap-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span>Fetch</span>
              </button>
            </div>
          </form>

          {/* Quick Filter Badges and Search Input */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Filter Status:
              </span>
              {[
                { key: 'ALL', label: 'All Trips' },
                { key: 'COMPLETED', label: 'Completed (Full Cycle)' },
                { key: 'AT_B', label: 'Docked at B' },
                { key: 'IN_TRANSIT', label: 'In Transit' },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                    statusFilter === f.key
                      ? 'bg-emerald-600 text-white shadow-xs'
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
                placeholder="Search vehicle or route..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                Cycle Records ({filteredRows.length})
              </h2>
              {selectedGeoA && selectedGeoB && (
                <span className="text-xs text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                  <span className="font-semibold text-slate-700">{selectedGeoA.name}</span>
                  <Repeat className="w-3 h-3 text-emerald-600" />
                  <span className="font-semibold text-slate-700">{selectedGeoB.name}</span>
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
                  <th className="py-3 px-3">Route (A ⇄ B)</th>
                  <th className="py-3 px-3 text-slate-700">Departed A</th>
                  <th className="py-3 px-3 text-blue-700">Outbound Time</th>
                  <th className="py-3 px-3 text-slate-700">Arrived B</th>
                  <th className="py-3 px-3 text-amber-700">Halt in B</th>
                  <th className="py-3 px-3 text-slate-700">Exited B</th>
                  <th className="py-3 px-3 text-indigo-700">Inbound Time</th>
                  <th className="py-3 px-3 text-slate-700">Return to A</th>
                  <th className="py-3 px-3 text-right">Round km</th>
                  <th className="py-3 px-3 text-center">Turnaround</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center w-16">Map</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={14} className="py-12 text-center">
                      <div className="inline-flex flex-col items-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                        <span className="text-xs font-medium text-slate-500">
                          Computing two-way trip cycle trajectories...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="py-12 text-center text-slate-400">
                      <div className="inline-flex flex-col items-center gap-2">
                        <Repeat className="w-8 h-8 text-slate-300" />
                        <span className="text-xs font-medium">
                          No two-way transit cycles recorded for the selected vehicles and timeframe.
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Try expanding your date range or selecting another geofence pair.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r, idx) => (
                    <tr key={`${r.vehicle_id}-${r.departure_time_a}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 text-center font-medium text-slate-400">
                        {idx + 1}
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{r.vehicle_name}</div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <span className="truncate max-w-[90px]">{r.from_geofence_name}</span>
                          <Repeat className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                          <span className="truncate max-w-[90px]">{r.to_geofence_name}</span>
                        </div>
                      </td>

                      {/* Departure from A */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {r.departure_time_a ? (
                          <>
                            <div className="font-semibold text-slate-800">
                              {formatLocalTime(r.departure_time_a)}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {formatLocalDate(r.departure_time_a)}
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Outbound Duration (A -> B) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-bold text-blue-700">
                          {r.outbound_duration_formatted || '-'}
                        </div>
                        {r.outbound_distance_km > 0 && (
                          <div className="text-[11px] text-slate-400">
                            {r.outbound_distance_km} km
                          </div>
                        )}
                      </td>

                      {/* Arrival at B */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {r.arrival_time_b ? (
                          <>
                            <div className="font-semibold text-slate-800">
                              {formatLocalTime(r.arrival_time_b)}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {formatLocalDate(r.arrival_time_b)}
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Halt Duration in B */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-bold text-amber-700">
                          {r.halt_in_b_formatted || '-'}
                        </div>
                      </td>

                      {/* Departure from B */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {r.departure_time_b ? (
                          <>
                            <div className="font-semibold text-slate-800">
                              {formatLocalTime(r.departure_time_b)}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {formatLocalDate(r.departure_time_b)}
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Inbound Duration (B -> A) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-bold text-indigo-700">
                          {r.inbound_duration_formatted || '-'}
                        </div>
                        {r.inbound_distance_km > 0 && (
                          <div className="text-[11px] text-slate-400">
                            {r.inbound_distance_km} km
                          </div>
                        )}
                      </td>

                      {/* Return Arrival at A */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {r.return_arrival_time_a ? (
                          <>
                            <div className="font-semibold text-emerald-700">
                              {formatLocalTime(r.return_arrival_time_a)}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {formatLocalDate(r.return_arrival_time_a)}
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-400 italic">Pending</span>
                        )}
                      </td>

                      {/* Total Distance (km) */}
                      <td className="py-3 px-3 text-right font-bold text-slate-800 whitespace-nowrap">
                        {r.total_distance_km} <span className="font-normal text-slate-500">km</span>
                      </td>

                      {/* Total Turnaround */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="font-bold text-slate-900">
                          {r.total_turnaround_formatted || '-'}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {getStatusBadge(r.status, r.status_label)}
                      </td>

                      {/* Map preview */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => setPreviewCycle(r)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-emerald-600 hover:text-emerald-800 transition-colors"
                          title="View Route Trajectory on Map"
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
      {previewCycle && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                  <Repeat className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Two-Way Cycle Preview: {previewCycle.vehicle_name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Route: <span className="font-semibold text-slate-700">{previewCycle.route_name}</span> | Distance: <span className="font-semibold text-slate-700">{previewCycle.total_distance_km} km</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewCycle(null)}
                className="p-1.5 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-200 bg-white border-b border-slate-200 text-xs">
              <div className="p-3">
                <span className="text-slate-400 block text-[11px]">Departure from A</span>
                <span className="font-semibold text-slate-800">
                  {previewCycle.departure_time_a ? `${formatLocalDate(previewCycle.departure_time_a)} ${formatLocalTime(previewCycle.departure_time_a)}` : '-'}
                </span>
                <span className="text-[11px] text-blue-600 block mt-0.5">
                  Outbound: {previewCycle.outbound_duration_formatted}
                </span>
              </div>
              <div className="p-3">
                <span className="text-slate-400 block text-[11px]">Arrival & Halt at B</span>
                <span className="font-semibold text-slate-800">
                  {previewCycle.arrival_time_b ? `${formatLocalDate(previewCycle.arrival_time_b)} ${formatLocalTime(previewCycle.arrival_time_b)}` : '-'}
                </span>
                <span className="text-[11px] text-amber-600 block mt-0.5">
                  Halt in B: {previewCycle.halt_in_b_formatted}
                </span>
              </div>
              <div className="p-3">
                <span className="text-slate-400 block text-[11px]">Inbound Leg & Return to A</span>
                <span className="font-semibold text-slate-800">
                  {previewCycle.return_arrival_time_a ? `${formatLocalDate(previewCycle.return_arrival_time_a)} ${formatLocalTime(previewCycle.return_arrival_time_a)}` : 'In Transit'}
                </span>
                <span className="text-[11px] text-indigo-600 block mt-0.5">
                  Inbound: {previewCycle.inbound_duration_formatted}
                </span>
              </div>
              <div className="p-3">
                <span className="text-slate-400 block text-[11px]">Total Turnaround</span>
                <span className="font-bold text-emerald-700 text-sm block">
                  {previewCycle.total_turnaround_formatted}
                </span>
                <span className="text-[11px] text-slate-500">
                  Total km: {previewCycle.total_distance_km} km
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

                <RouteMapBoundsFitter
                  pathCoords={previewCycle.path_preview}
                  geoA={selectedGeoA}
                  geoB={selectedGeoB}
                />

                {/* Geofence A */}
                {selectedGeoA && selectedGeoA.type === 'circle' && (
                  <Circle
                    center={[Number(selectedGeoA.center_lat), Number(selectedGeoA.center_lng)]}
                    radius={Number(selectedGeoA.radius) || 200}
                    pathOptions={{ color: '#059669', fillColor: '#10B981', fillOpacity: 0.25, weight: 2 }}
                  >
                    <Tooltip permanent direction="top" offset={[0, -10]}>
                      Hub A: {selectedGeoA.name} (Origin)
                    </Tooltip>
                  </Circle>
                )}

                {/* Geofence B */}
                {selectedGeoB && selectedGeoB.type === 'circle' && (
                  <Circle
                    center={[Number(selectedGeoB.center_lat), Number(selectedGeoB.center_lng)]}
                    radius={Number(selectedGeoB.radius) || 200}
                    pathOptions={{ color: '#E11D48', fillColor: '#F43F5E', fillOpacity: 0.25, weight: 2 }}
                  >
                    <Tooltip permanent direction="top" offset={[0, -10]}>
                      Hub B: {selectedGeoB.name} (Destination)
                    </Tooltip>
                  </Circle>
                )}

                {/* Route Polyline */}
                {Array.isArray(previewCycle.path_preview) && previewCycle.path_preview.length > 1 && (
                  <Polyline
                    positions={previewCycle.path_preview.map((p) => [p.lat, p.lng])}
                    pathOptions={{ color: '#2563EB', weight: 4, opacity: 0.85 }}
                  />
                )}
              </MapContainer>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Green circle: Hub A (Origin) | Red circle: Hub B (Destination) | Blue line: GPS Trajectory
              </span>
              <button
                onClick={() => setPreviewCycle(null)}
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

export default GeofenceTwoWayReportPage;
