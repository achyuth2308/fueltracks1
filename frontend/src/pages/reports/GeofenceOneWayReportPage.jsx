import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Download, Search, Loader2, Filter,
  FileSpreadsheet, FileText, Truck, Calendar, Shield,
  ArrowRight, MapPin, Clock, Navigation, CheckCircle2,
  AlertCircle, Eye, X, Gauge, Maximize2, RefreshCw
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

const GeofenceOneWayReportPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const qVehicleId = searchParams.get('vehicleId');
  const qFromId = searchParams.get('fromId') || searchParams.get('fromGeofenceId');
  const qToId = searchParams.get('toId') || searchParams.get('toGeofenceId');

  const [vehicles, setVehicles] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const allGeofencesRef = useRef([]);
  const isInitialVehicleFetch = useRef(true);

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

  const [tableSearch, setTableSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [summary, setSummary] = useState({
    total_trips: 0,
    completed_trips: 0,
    total_distance_km: 0,
    avg_travel_seconds: 0,
    avg_travel_formatted: '0s',
    avg_stay_seconds: 0,
    avg_stay_formatted: '0s',
    currently_inside_b: 0,
    in_transit: 0,
  });
  const [hasGenerated, setHasGenerated] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Map route preview modal
  const [previewTrip, setPreviewTrip] = useState(null);

  // Load vehicles and geofences list
  useEffect(() => {
    let mounted = true;
    const fetchDropdowns = async () => {
      setLoadingInitial(true);
      try {
        const [vRes, gRes] = await Promise.all([
          vehicleApi.getVehicles({ t: Date.now() }),
          axiosInstance.get('/api/admin/geofences').catch(() => axiosInstance.get('/api/geofences'))
        ]);
        if (mounted) {
          if (vRes?.success && Array.isArray(vRes.data)) {
            setVehicles(vRes.data);
          } else if (Array.isArray(vRes)) {
            setVehicles(vRes);
          }
          const rawG = gRes?.data?.data || gRes?.data || [];
          const list = Array.isArray(rawG) ? rawG : [];
          allGeofencesRef.current = list;

          if (selectedVehicleId) {
            try {
              const vgRes = await axiosInstance.get(`/api/vehicles/${selectedVehicleId}/geofences`);
              const vListG = vgRes.data?.data || [];
              setGeofences(vListG);
              if (vListG.length >= 1) {
                setFromGeofenceId((prev) => vListG.some((g) => String(g.id) === String(prev)) ? prev : vListG[0].id);
              } else {
                setFromGeofenceId('');
              }
              if (vListG.length >= 2) {
                setToGeofenceId((prev) => vListG.some((g) => String(g.id) === String(prev)) ? prev : vListG[1].id);
              } else {
                setToGeofenceId(vListG[0]?.id || '');
              }
            } catch (vErr) {
              console.warn('Failed to load initial vehicle geofences:', vErr);
              setGeofences([]);
              setFromGeofenceId('');
              setToGeofenceId('');
            }
          } else {
            setGeofences(list);
            if (!fromGeofenceId && list.length >= 1) {
              setFromGeofenceId(list[0].id);
            }
            if (!toGeofenceId && list.length >= 2) {
              setToGeofenceId(list[1].id);
            }
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

  // Update geofences whenever user changes selected vehicle
  useEffect(() => {
    if (isInitialVehicleFetch.current) {
      isInitialVehicleFetch.current = false;
      return;
    }
    let active = true;
    const fetchForVehicle = async () => {
      if (selectedVehicleId) {
        try {
          const res = await axiosInstance.get(`/api/vehicles/${selectedVehicleId}/geofences`);
          if (!active) return;
          const assignedList = res.data?.data || [];
          setGeofences(assignedList);
          setFromGeofenceId((prev) => {
            if (assignedList.some((g) => String(g.id) === String(prev))) return prev;
            return assignedList.length >= 1 ? assignedList[0].id : '';
          });
          setToGeofenceId((prev) => {
            if (assignedList.some((g) => String(g.id) === String(prev))) return prev;
            return assignedList.length >= 2 ? assignedList[1].id : (assignedList[0]?.id || '');
          });
        } catch (err) {
          console.warn('Failed to load vehicle geofences:', err);
          if (active) {
            setGeofences([]);
            setFromGeofenceId('');
            setToGeofenceId('');
          }
        }
      } else {
        let orgList = allGeofencesRef.current || [];
        if (orgList.length === 0) {
          try {
            const res = await axiosInstance.get('/api/admin/geofences').catch(() => axiosInstance.get('/api/geofences'));
            orgList = res?.data?.data || res?.data || [];
            allGeofencesRef.current = orgList;
          } catch (_) {}
        }
        if (!active) return;
        setGeofences(orgList);
        setFromGeofenceId((prev) => {
          if (orgList.some((g) => String(g.id) === String(prev))) return prev;
          return orgList.length >= 1 ? orgList[0].id : '';
        });
        setToGeofenceId((prev) => {
          if (orgList.some((g) => String(g.id) === String(prev))) return prev;
          return orgList.length >= 2 ? orgList[1].id : (orgList[0]?.id || '');
        });
      }
    };
    fetchForVehicle();
    return () => { active = false; };
  }, [selectedVehicleId]);

  // Compute report directly in frontend if backend process hasn't been rebooted
  const computeClientSideOneWayReport = async () => {
    const targetVehicles = selectedVehicleId
      ? vehicles.filter((v) => String(v.id) === String(selectedVehicleId))
      : vehicles;

    const geoA = geofences.find((g) => String(g.id) === String(fromGeofenceId));
    const geoB = geofences.find((g) => String(g.id) === String(toGeofenceId));

    if (!geoA || !geoB) {
      throw new Error('Please select both Origin (A) and Destination (B) geofences.');
    }

    const calculatedTrips = [];
    let grandDistanceM = 0;
    let grandTravelSec = 0;
    let grandStaySec = 0;
    let completedCount = 0;
    let stayCount = 0;
    let insideBCount = 0;
    let inTransitCount = 0;

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

        let state = 'IDLE';
        let lastInsideAPoint = null;
        let departPointA = null;
        let arrivePointB = null;
        let lastInsideBPoint = null;
        let transitDistanceM = 0;
        let maxSpeedKmh = 0;
        let pathCoords = [];

        for (let i = 0; i < points.length; i++) {
          const p = points[i];
          const insideA = checkInsideGeofence(p.lat, p.lng, geoA);
          const insideB = checkInsideGeofence(p.lat, p.lng, geoB);

          if (insideA) {
            lastInsideAPoint = p;
            if (state === 'IN_TRANSIT') {
              state = 'IDLE';
              transitDistanceM = 0;
              maxSpeedKmh = 0;
              pathCoords = [];
            }
          }

          if (state === 'IDLE') {
            if (!insideA && lastInsideAPoint) {
              state = 'IN_TRANSIT';
              departPointA = lastInsideAPoint;
              transitDistanceM = 0;
              maxSpeedKmh = p.speed || 0;
              pathCoords = [
                { lat: departPointA.lat, lng: departPointA.lng },
                { lat: p.lat, lng: p.lng }
              ];
            }
          } else if (state === 'IN_TRANSIT') {
            if (i > 0) {
              const prev = points[i - 1];
              const seg = getHaversineDistanceMeters(prev.lat, prev.lng, p.lat, p.lng);
              if (seg < 5000) transitDistanceM += seg;
            }
            if (p.speed > maxSpeedKmh) maxSpeedKmh = p.speed;
            if (pathCoords.length < 60) pathCoords.push({ lat: p.lat, lng: p.lng });

            if (insideB) {
              state = 'INSIDE_B';
              arrivePointB = p;
              lastInsideBPoint = p;
            }
          } else if (state === 'INSIDE_B') {
            if (insideB) {
              lastInsideBPoint = p;
            } else {
              const exitPointB = lastInsideBPoint || p;
              const travelDurationSec = Math.max(0, (new Date(arrivePointB.device_time || arrivePointB.time) - new Date(departPointA.device_time || departPointA.time)) / 1000);
              const stayDurationSec = Math.max(0, (new Date(exitPointB.device_time || exitPointB.time) - new Date(arrivePointB.device_time || arrivePointB.time)) / 1000);
              const distKm = Number((transitDistanceM / 1000).toFixed(2));
              const avgSpeed = travelDurationSec > 0 ? Number((distKm / (travelDurationSec / 3600)).toFixed(1)) : 0;

              calculatedTrips.push({
                vehicle_id: v.id,
                vehicle_name: v.name || v.plate || 'Vehicle',
                plate: v.plate || '-',
                org_name: v.org_name || '-',
                from_geofence_id: geoA.id,
                from_geofence_name: geoA.name,
                to_geofence_id: geoB.id,
                to_geofence_name: geoB.name,
                route_name: `${geoA.name} ➔ ${geoB.name}`,
                departure_time_a: departPointA.device_time || departPointA.time,
                travel_duration_seconds: Math.round(travelDurationSec),
                travel_duration_formatted: formatDurationHuman(travelDurationSec),
                arrival_time_b: arrivePointB.device_time || arrivePointB.time,
                stay_duration_seconds: Math.round(stayDurationSec),
                stay_duration_formatted: formatDurationHuman(stayDurationSec),
                exit_time_b: exitPointB.device_time || exitPointB.time,
                distance_km: distKm,
                avg_speed_kmh: avgSpeed,
                max_speed_kmh: Math.round(maxSpeedKmh),
                status: 'completed',
                status_label: 'Completed (Exited B)',
                path_preview: pathCoords,
              });

              grandDistanceM += transitDistanceM;
              grandTravelSec += travelDurationSec;
              grandStaySec += stayDurationSec;
              completedCount++;
              stayCount++;

              state = 'IDLE';
              departPointA = null;
              arrivePointB = null;
              lastInsideBPoint = null;
              transitDistanceM = 0;
              maxSpeedKmh = 0;
              pathCoords = [];
            }
          }
        }

        // Check active / ongoing at the end of range
        if (state === 'INSIDE_B' && arrivePointB && departPointA) {
          insideBCount++;
          const lastPoint = points[points.length - 1];
          const travelDurationSec = Math.max(0, (new Date(arrivePointB.device_time || arrivePointB.time) - new Date(departPointA.device_time || departPointA.time)) / 1000);
          const stayDurationSec = Math.max(0, (new Date(lastPoint.device_time || lastPoint.time) - new Date(arrivePointB.device_time || arrivePointB.time)) / 1000);
          const distKm = Number((transitDistanceM / 1000).toFixed(2));
          const avgSpeed = travelDurationSec > 0 ? Number((distKm / (travelDurationSec / 3600)).toFixed(1)) : 0;

          calculatedTrips.push({
            vehicle_id: v.id,
            vehicle_name: v.name || v.plate || 'Vehicle',
            plate: v.plate || '-',
            org_name: v.org_name || '-',
            from_geofence_id: geoA.id,
            from_geofence_name: geoA.name,
            to_geofence_id: geoB.id,
            to_geofence_name: geoB.name,
            route_name: `${geoA.name} ➔ ${geoB.name}`,
            departure_time_a: departPointA.device_time || departPointA.time,
            travel_duration_seconds: Math.round(travelDurationSec),
            travel_duration_formatted: formatDurationHuman(travelDurationSec),
            arrival_time_b: arrivePointB.device_time || arrivePointB.time,
            stay_duration_seconds: Math.round(stayDurationSec),
            stay_duration_formatted: `${formatDurationHuman(stayDurationSec)} (Inside)`,
            exit_time_b: null,
            distance_km: distKm,
            avg_speed_kmh: avgSpeed,
            max_speed_kmh: Math.round(maxSpeedKmh),
            status: 'inside_destination',
            status_label: 'Inside Destination (B)',
            path_preview: pathCoords,
          });

          grandDistanceM += transitDistanceM;
          grandTravelSec += travelDurationSec;
          grandStaySec += stayDurationSec;
          completedCount++;
          stayCount++;
        } else if (state === 'IN_TRANSIT' && departPointA) {
          inTransitCount++;
          const lastPoint = points[points.length - 1];
          const travelDurationSec = Math.max(0, (new Date(lastPoint.device_time || lastPoint.time) - new Date(departPointA.device_time || departPointA.time)) / 1000);
          const distKm = Number((transitDistanceM / 1000).toFixed(2));
          const avgSpeed = travelDurationSec > 0 ? Number((distKm / (travelDurationSec / 3600)).toFixed(1)) : 0;

          calculatedTrips.push({
            vehicle_id: v.id,
            vehicle_name: v.name || v.plate || 'Vehicle',
            plate: v.plate || '-',
            org_name: v.org_name || '-',
            from_geofence_id: geoA.id,
            from_geofence_name: geoA.name,
            to_geofence_id: geoB.id,
            to_geofence_name: geoB.name,
            route_name: `${geoA.name} ➔ ${geoB.name}`,
            departure_time_a: departPointA.device_time || departPointA.time,
            travel_duration_seconds: Math.round(travelDurationSec),
            travel_duration_formatted: `${formatDurationHuman(travelDurationSec)} (En Route)`,
            arrival_time_b: null,
            stay_duration_seconds: 0,
            stay_duration_formatted: '-',
            exit_time_b: null,
            distance_km: distKm,
            avg_speed_kmh: avgSpeed,
            max_speed_kmh: Math.round(maxSpeedKmh),
            status: 'in_transit',
            status_label: 'In Transit to B',
            path_preview: pathCoords,
          });
        }
      } catch (_) {}
    }

    calculatedTrips.sort((a, b) => new Date(b.departure_time_a) - new Date(a.departure_time_a));

    const avgTravel = completedCount > 0 ? Math.round(grandTravelSec / completedCount) : 0;
    const avgStay = stayCount > 0 ? Math.round(grandStaySec / stayCount) : 0;

    return {
      summary: {
        total_trips: calculatedTrips.length,
        completed_trips: completedCount,
        total_distance_km: Number((grandDistanceM / 1000).toFixed(2)),
        avg_travel_seconds: avgTravel,
        avg_travel_formatted: formatDurationHuman(avgTravel),
        avg_stay_seconds: avgStay,
        avg_stay_formatted: formatDurationHuman(avgStay),
        currently_inside_b: insideBCount,
        in_transit: inTransitCount,
      },
      rows: calculatedTrips,
    };
  };

  const handleGenerate = async () => {
    if (!startDate || !endDate) {
      setErrorMsg('Please select both start date and end date.');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setErrorMsg('Start date cannot be after end date.');
      return;
    }
    if (!fromGeofenceId || !toGeofenceId) {
      setErrorMsg('Please select Origin (A) and Destination (B) geofences.');
      return;
    }
    if (String(fromGeofenceId) === String(toGeofenceId)) {
      setErrorMsg('Origin (A) and Destination (B) geofences must be different locations.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      let res;
      try {
        res = await axiosInstance.get('/api/reports/geofence-one-way', {
          params: {
            vehicleId: selectedVehicleId || undefined,
            fromGeofenceId,
            toGeofenceId,
            start: new Date(startDate).toISOString(),
            end: new Date(endDate).toISOString(),
          },
        });
      } catch (backendErr) {
        // Fallback to client-side compute
        res = null;
      }

      if (res?.data?.success) {
        setReportData(res.data.data || []);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      } else {
        const clientRes = await computeClientSideOneWayReport();
        setReportData(clientRes.rows || []);
        setSummary(clientRes.summary);
      }
      setHasGenerated(true);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to generate report.');
    } finally {
      setLoading(false);
    }
  };

  // Filtered rows for client search
  const filteredData = useMemo(() => {
    if (!tableSearch.trim()) return reportData;
    const q = tableSearch.toLowerCase();
    return reportData.filter((r) =>
      r.vehicle_name?.toLowerCase().includes(q) ||
      r.plate?.toLowerCase().includes(q) ||
      r.route_name?.toLowerCase().includes(q) ||
      r.from_geofence_name?.toLowerCase().includes(q) ||
      r.to_geofence_name?.toLowerCase().includes(q) ||
      r.status_label?.toLowerCase().includes(q)
    );
  }, [reportData, tableSearch]);

  // Export handlers
  const getExportData = () => {
    return filteredData.map((r, idx) => ({
      'S.No': idx + 1,
      'Vehicle Name': r.vehicle_name,
      'Vehicle Plate': r.plate,
      'Full Route': r.route_name,
      'Origin (A)': r.from_geofence_name,
      'Destination (B)': r.to_geofence_name,
      'Exit from A (Date & Time)': r.departure_time_a ? `${formatLocalDate(r.departure_time_a)} ${formatLocalTime(r.departure_time_a)}` : '-',
      'Duration to Reach B': r.travel_duration_formatted || '-',
      'Arrival at B (Date & Time)': r.arrival_time_b ? `${formatLocalDate(r.arrival_time_b)} ${formatLocalTime(r.arrival_time_b)}` : (r.status === 'in_transit' ? 'En Route' : '-'),
      'Stop / Stay in B': r.stay_duration_formatted || '-',
      'Exit from B (Date & Time)': r.exit_time_b ? `${formatLocalDate(r.exit_time_b)} ${formatLocalTime(r.exit_time_b)}` : (r.status === 'inside_destination' ? 'Currently Inside B' : '-'),
      'Total Distance (km)': r.distance_km,
      'Avg Speed (km/h)': r.avg_speed_kmh,
      'Max Speed (km/h)': r.max_speed_kmh,
      'Trip Status': r.status_label,
    }));
  };

  const handleExportExcel = () => {
    const data = getExportData();
    if (data.length === 0) return alert('No data to export.');
    exportToExcel(data, `OneWay_Geofence_Transit_Report_${startDate.slice(0, 10)}`);
  };

  const handleExportCSV = () => {
    const data = getExportData();
    if (data.length === 0) return alert('No data to export.');
    exportToCSV(data, `OneWay_Geofence_Transit_Report_${startDate.slice(0, 10)}`);
  };

  const handleExportPDF = () => {
    const data = getExportData();
    if (data.length === 0) return alert('No data to export.');
    exportToPDF(
      data,
      `OneWay_Geofence_Transit_Report_${startDate.slice(0, 10)}`,
      `One-Way Geofence Transit Report (${startDate.slice(0, 10)} to ${endDate.slice(0, 10)})`
    );
  };

  const formatCellDate = (dt) => {
    if (!dt) return '-';
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '12px' }}>{formatLocalDate(dt)}</span>
        <span style={{ fontSize: '11px', color: '#64748B' }}>{formatLocalTime(dt)}</span>
      </div>
    );
  };

  const activeOriginGeo = useMemo(() => {
    return geofences.find((g) => String(g.id) === String(fromGeofenceId));
  }, [geofences, fromGeofenceId]);

  const activeDestGeo = useMemo(() => {
    return geofences.find((g) => String(g.id) === String(toGeofenceId));
  }, [geofences, toGeofenceId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '100%', padding: '4px' }}>
      
      {/* Top Navigation Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          background: '#FFFFFF',
          padding: '18px 24px',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            type="button"
            onClick={() => navigate('/admin/reports')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              background: '#F8FAFC',
              cursor: 'pointer',
              color: '#475569',
            }}
            title="Back to Reports"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: '#EFF6FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563EB',
                }}
              >
                <ArrowRight size={16} />
              </div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
                One-Way Geofence Transit Report (A ➔ B)
              </h2>
              <span
                style={{
                  background: '#EFF6FF',
                  color: '#1D4ED8',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '99px',
                }}
              >
                Point A ➔ Point B
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B' }}>
              Accurate departure time from Location A, driving duration & GPS km to Location B, arrival time, and stoppage duration inside Destination B.
            </p>
          </div>
        </div>

        {/* Exports */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={filteredData.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#0F172A',
              fontSize: '12px',
              fontWeight: 700,
              cursor: filteredData.length === 0 ? 'not-allowed' : 'pointer',
              opacity: filteredData.length === 0 ? 0.6 : 1,
            }}
          >
            <FileSpreadsheet size={15} color="#16A34A" />
            <span>Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredData.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#0F172A',
              fontSize: '12px',
              fontWeight: 700,
              cursor: filteredData.length === 0 ? 'not-allowed' : 'pointer',
              opacity: filteredData.length === 0 ? 0.6 : 1,
            }}
          >
            <Download size={15} color="#0284C7" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={filteredData.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#0F172A',
              fontSize: '12px',
              fontWeight: 700,
              cursor: filteredData.length === 0 ? 'not-allowed' : 'pointer',
              opacity: filteredData.length === 0 ? 0.6 : 1,
            }}
          >
            <FileText size={15} color="#DC2626" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '20px 24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
          
          {/* Vehicle Select */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.04em' }}>
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
              <option value="">All Vehicles</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name || 'Vehicle'}
                </option>
              ))}
            </select>
          </div>

          {/* Origin Geofence (A) */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#10B981', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.04em' }}>
              From: Origin Geofence (A)
            </label>
            <select
              value={fromGeofenceId}
              onChange={(e) => setFromGeofenceId(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #10B981',
                fontSize: '13px',
                color: '#0F172A',
                background: '#ECFDF5',
                boxSizing: 'border-box',
                fontWeight: 600,
              }}
            >
              {geofences.length === 0 ? (
                <option value="">
                  {selectedVehicleId ? '-- No Geofences Assigned to This Vehicle --' : '-- No Geofences Found --'}
                </option>
              ) : (
                <>
                  <option value="">-- Choose Origin (A) --</option>
                  {geofences.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.type || 'circle'})
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* Destination Geofence (B) */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#0284C7', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.04em' }}>
              To: Destination Geofence (B)
            </label>
            <select
              value={toGeofenceId}
              onChange={(e) => setToGeofenceId(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #0284C7',
                fontSize: '13px',
                color: '#0F172A',
                background: '#F0F9FF',
                boxSizing: 'border-box',
                fontWeight: 600,
              }}
            >
              {geofences.length === 0 ? (
                <option value="">
                  {selectedVehicleId ? '-- No Geofences Assigned to This Vehicle --' : '-- No Geofences Found --'}
                </option>
              ) : (
                <>
                  <option value="">-- Choose Destination (B) --</option>
                  {geofences.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.type || 'circle'})
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* Start Date & Time */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.04em' }}>
              From Date & Time
            </label>
            <CustomDatePicker
              value={startDate}
              onChange={(val) => setStartDate(val)}
              showTimeSelect={true}
              placeholder="Start Date & Time"
            />
          </div>

          {/* End Date & Time */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.04em' }}>
              To Date & Time
            </label>
            <CustomDatePicker
              value={endDate}
              onChange={(val) => setEndDate(val)}
              showTimeSelect={true}
              placeholder="End Date & Time"
            />
          </div>

          {/* Submit Action */}
          <div>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: '#2563EB',
                color: '#FFFFFF',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 800,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
              }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              <span>{loading ? 'Analyzing GPS Trails...' : 'Generate Report'}</span>
            </button>
          </div>

        </div>

        {errorMsg && (
          <div
            style={{
              marginTop: '14px',
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#DC2626',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      {hasGenerated && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
          
          {/* Card 1: Total Trips */}
          <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Completed Trips
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#0F172A', marginTop: '6px' }}>
              {summary.completed_trips || summary.total_trips || 0}
            </div>
            <div style={{ fontSize: '11px', color: '#2563EB', marginTop: '4px', fontWeight: 600 }}>
              Full Legs ({summary.total_trips || 0} total started)
            </div>
          </div>

          {/* Card 2: Total Distance */}
          <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Distance Traveled
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#16A34A', marginTop: '6px' }}>
              {(summary.total_distance_km || 0).toFixed(1)} <span style={{ fontSize: '14px', color: '#64748B' }}>km</span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
              Road travel between A and B
            </div>
          </div>

          {/* Card 3: Avg Travel Duration */}
          <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Avg Travel Duration (A ➔ B)
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', marginTop: '6px' }}>
              {summary.avg_travel_formatted || '0s'}
            </div>
            <div style={{ fontSize: '11px', color: '#D97706', marginTop: '4px', fontWeight: 600 }}>
              Average driving time
            </div>
          </div>

          {/* Card 4: Avg Stay Duration in B */}
          <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Avg Stop Duration in B
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', marginTop: '6px' }}>
              {summary.avg_stay_formatted || '0s'}
            </div>
            <div style={{ fontSize: '11px', color: '#8B5CF6', marginTop: '4px', fontWeight: 600 }}>
              Halt time at destination
            </div>
          </div>

          {/* Card 5: Currently Inside Destination B */}
          <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Currently Inside B
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: summary.currently_inside_b > 0 ? '#10B981' : '#64748B', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {summary.currently_inside_b || 0}
              {summary.currently_inside_b > 0 && (
                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#10B981', animation: 'pulse 1.5s infinite' }} />
              )}
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
              Parked / Unloading at B
            </div>
          </div>

        </div>
      )}

      {/* Main Table Card */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
        }}
      >
        {/* Table Subheader with Search */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            background: '#F8FAFC',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
              One-Way Trip Log
            </span>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              ({filteredData.length} records)
            </span>
          </div>

          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '9px' }} />
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Search vehicle, route, status..."
              style={{
                width: '100%',
                padding: '7px 12px 7px 32px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '12px',
                background: '#FFFFFF',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div style={{ padding: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <Loader2 size={32} color="#2563EB" className="animate-spin" />
            <span style={{ fontSize: '14px', color: '#64748B', fontWeight: 600 }}>
              Scanning GPS coordinates, road distance and stoppage durations...
            </span>
          </div>
        ) : !hasGenerated ? (
          <div style={{ padding: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <Navigation size={38} color="#94A3B8" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
              Ready to Generate One-Way Transit Report
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748B', textAlign: 'center', maxWidth: '440px' }}>
              Pick your Origin Geofence (A) and Destination Geofence (B), configure the desired date range, and click <b>Generate Report</b>.
            </p>
          </div>
        ) : filteredData.length === 0 ? (
          <div style={{ padding: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <Shield size={38} color="#94A3B8" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
              No One-Way Trips Detected
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748B', textAlign: 'center', maxWidth: '440px' }}>
              No trips departing Geofence A and heading to Geofence B were found in the selected date range.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1100px' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>S.No</th>
                  <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Vehicle Name & Plate</th>
                  <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Full Geofence Route (A ➔ B)</th>
                  <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Exit from A (Date & Time)</th>
                  <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Duration to Reach B</th>
                  <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Arrival at B (Date & Time)</th>
                  <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Stop / Stay in B</th>
                  <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Exit from B (Date & Time)</th>
                  <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Total km</th>
                  <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Speed (Avg / Max)</th>
                  <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Map Route</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: '1px solid #F1F5F9',
                      background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#F0F9FF')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA')}
                  >
                    {/* S.No */}
                    <td style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#64748B' }}>
                      {idx + 1}
                    </td>

                    {/* Vehicle */}
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                        {row.vehicle_name}
                      </span>
                    </td>

                    {/* Geofence Route */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 700, color: '#10B981', fontSize: '12px' }}>
                          {row.from_geofence_name}
                        </span>
                        <ArrowRight size={13} color="#64748B" />
                        <span style={{ fontWeight: 700, color: '#0284C7', fontSize: '12px' }}>
                          {row.to_geofence_name}
                        </span>
                      </div>
                    </td>

                    {/* Exit from A */}
                    <td style={{ padding: '12px 16px' }}>
                      {formatCellDate(row.departure_time_a)}
                    </td>

                    {/* Duration to reach B */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={14} color="#D97706" />
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>
                          {row.travel_duration_formatted}
                        </span>
                      </div>
                    </td>

                    {/* Arrival at B */}
                    <td style={{ padding: '12px 16px' }}>
                      {row.arrival_time_b ? (
                        formatCellDate(row.arrival_time_b)
                      ) : (
                        <span style={{ fontSize: '11px', color: '#D97706', fontWeight: 700, background: '#FEF3C7', padding: '2px 8px', borderRadius: '4px' }}>
                          En Route
                        </span>
                      )}
                    </td>

                    {/* Stop / Stay in B */}
                    <td style={{ padding: '12px 16px' }}>
                      {row.status === 'inside_destination' ? (
                        <span style={{ fontSize: '11px', color: '#16A34A', fontWeight: 700, background: '#DCFCE7', padding: '2px 8px', borderRadius: '4px' }}>
                          {row.stay_duration_formatted}
                        </span>
                      ) : row.status === 'in_transit' ? (
                        <span style={{ color: '#94A3B8' }}>-</span>
                      ) : (
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>
                          {row.stay_duration_formatted}
                        </span>
                      )}
                    </td>

                    {/* Exit from B */}
                    <td style={{ padding: '12px 16px' }}>
                      {row.exit_time_b ? (
                        formatCellDate(row.exit_time_b)
                      ) : row.status === 'inside_destination' ? (
                        <span style={{ fontSize: '11px', color: '#16A34A', fontWeight: 700, background: '#DCFCE7', padding: '2px 8px', borderRadius: '4px' }}>
                          Currently Inside B
                        </span>
                      ) : (
                        <span style={{ color: '#94A3B8' }}>-</span>
                      )}
                    </td>

                    {/* Distance km */}
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#16A34A' }}>
                        {row.distance_km} km
                      </span>
                    </td>

                    {/* Speed */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                        <span style={{ fontWeight: 700, color: '#0F172A' }}>{row.avg_speed_kmh}</span>
                        <span style={{ color: '#94A3B8' }}>/</span>
                        <span style={{ fontWeight: 700, color: '#DC2626' }}>{row.max_speed_kmh}</span>
                        <span style={{ color: '#64748B' }}>km/h</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background:
                            row.status === 'completed'
                              ? '#F0FDF4'
                              : row.status === 'inside_destination'
                              ? '#EFF6FF'
                              : '#FEF3C7',
                          color:
                            row.status === 'completed'
                              ? '#16A34A'
                              : row.status === 'inside_destination'
                              ? '#2563EB'
                              : '#D97706',
                          border: `1px solid ${
                            row.status === 'completed'
                              ? '#BBF7D0'
                              : row.status === 'inside_destination'
                              ? '#BFDBFE'
                              : '#FDE68A'
                          }`,
                        }}
                      >
                        {row.status_label}
                      </span>
                    </td>

                    {/* Action: Map Preview */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setPreviewTrip(row)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          background: '#FFFFFF',
                          color: '#0F172A',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                        title="View route trajectory on map"
                      >
                        <Eye size={13} color="#2563EB" />
                        <span>Map</span>
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Map Trajectory Modal */}
      {previewTrip && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setPreviewTrip(null)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              width: '900px',
              maxWidth: '96vw',
              height: '620px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#F8FAFC',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Navigation size={18} color="#2563EB" />
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                    Route Trajectory: {previewTrip.vehicle_name}
                  </h3>
                </div>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                  {previewTrip.from_geofence_name} ➔ {previewTrip.to_geofence_name} • Distance: <b>{previewTrip.distance_km} km</b> • Travel: <b>{previewTrip.travel_duration_formatted}</b>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewTrip(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748B',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Map */}
            <div style={{ flex: 1, position: 'relative' }}>
              <MapContainer
                center={[17.385, 78.4867]}
                zoom={12}
                style={{ width: '100%', height: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="&copy; OpenStreetMap"
                />

                <RouteMapBoundsFitter
                  pathCoords={previewTrip.path_preview}
                  geoA={activeOriginGeo}
                  geoB={activeDestGeo}
                />

                {/* Origin Geofence A */}
                {activeOriginGeo && activeOriginGeo.type === 'circle' && (
                  <Circle
                    center={[Number(activeOriginGeo.center_lat), Number(activeOriginGeo.center_lng)]}
                    radius={Number(activeOriginGeo.radius) || 200}
                    pathOptions={{ color: '#10B981', fillColor: '#10B981', fillOpacity: 0.25 }}
                  >
                    <Tooltip permanent direction="top" offset={[0, -10]}>
                      <b>(A) Origin: {activeOriginGeo.name}</b>
                    </Tooltip>
                  </Circle>
                )}

                {/* Destination Geofence B */}
                {activeDestGeo && activeDestGeo.type === 'circle' && (
                  <Circle
                    center={[Number(activeDestGeo.center_lat), Number(activeDestGeo.center_lng)]}
                    radius={Number(activeDestGeo.radius) || 200}
                    pathOptions={{ color: '#0284C7', fillColor: '#0284C7', fillOpacity: 0.25 }}
                  >
                    <Tooltip permanent direction="top" offset={[0, -10]}>
                      <b>(B) Destination: {activeDestGeo.name}</b>
                    </Tooltip>
                  </Circle>
                )}

                {/* Polyline Route */}
                {Array.isArray(previewTrip.path_preview) && previewTrip.path_preview.length > 1 && (
                  <Polyline
                    positions={previewTrip.path_preview.map((p) => [p.lat, p.lng])}
                    pathOptions={{ color: '#2563EB', weight: 4, opacity: 0.85 }}
                  />
                )}
              </MapContainer>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid #E2E8F0',
                background: '#F8FAFC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12px',
                color: '#475569',
              }}
            >
              <div>
                Departure from A: <b>{formatLocalDate(previewTrip.departure_time_a)} {formatLocalTime(previewTrip.departure_time_a)}</b>
              </div>
              <div>
                Arrival at B: <b>{previewTrip.arrival_time_b ? `${formatLocalDate(previewTrip.arrival_time_b)} ${formatLocalTime(previewTrip.arrival_time_b)}` : 'En Route'}</b>
              </div>
              <div>
                Stay in B: <b>{previewTrip.stay_duration_formatted}</b>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default GeofenceOneWayReportPage;
