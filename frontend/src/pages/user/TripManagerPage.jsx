import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, Circle, Marker, Tooltip, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  Truck, Route as RouteIcon, MapPin, Clock, Gauge, Navigation,
  ChevronRight, Plus, Trash2, RefreshCw, AlertCircle, CheckCircle,
  Share2, ArrowLeft, Fuel, Activity, Radio, Shield, Layers, ZoomIn, ZoomOut, Maximize2,
  Repeat, RotateCcw, ArrowRightLeft, ArrowRight, ExternalLink, BarChart3, TrendingUp,
  Loader2
} from 'lucide-react';
import * as vehicleApi from '../../api/vehicleApi';
import axiosInstance from '../../api/axios';
import { getAddressFromCoordinates } from '../../utils/geocodeUtils';
import { formatLocalTime, formatLocalDate, getRelativeTime } from '../../utils/dateUtils';
import { formatSpeed } from '../../utils/formatUtils';

// ── Leaflet Custom Icons ──────────────────────────────────────────────────────────
const createStopIcon = (number) => {
  return L.divIcon({
    className: 'custom-stop-marker',
    html: `
      <div style="
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: #D97706;
        border: 2px solid #FFFFFF;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #FFFFFF;
        font-weight: 800;
        font-size: 11px;
      ">${number}</div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
};

const createVehiclePinIcon = (isMoving, heading = 0) => {
  return L.divIcon({
    className: 'custom-vehicle-marker',
    html: `
      <div style="
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: ${isMoving ? '#16A34A' : '#475569'};
        border: 3px solid #FFFFFF;
        box-shadow: 0 4px 10px rgba(0,0,0,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        transform: rotate(${heading || 0}deg);
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 19 21 12 17 5 21 12 2"/>
        </svg>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
  });
};

const createGeofenceCenterIcon = (name) => {
  return L.divIcon({
    className: 'custom-geofence-center',
    html: `
      <div style="
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #2563EB;
        border: 2px solid #FFFFFF;
        box-shadow: 0 0 4px rgba(37,99,235,0.6);
      "></div>
    `,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
};

const createTransitPinIcon = (label, color = '#10B981') => {
  return L.divIcon({
    className: 'custom-transit-pin',
    html: `
      <div style="
        background: ${color};
        color: #FFFFFF;
        font-weight: 800;
        font-size: 11px;
        padding: 4px 8px;
        border-radius: 12px;
        border: 2px solid #FFFFFF;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 4px;
      ">
        <span>${label}</span>
      </div>
    `,
    iconSize: [110, 24],
    iconAnchor: [55, 12],
  });
};

// ── Map Auto Fit Bounds Helper ────────────────────────────────────────────────────
const MapBoundsController = ({ routePoints, stops, geofences, focusedCoord }) => {
  const map = useMap();

  useEffect(() => {
    if (focusedCoord && focusedCoord.lat && focusedCoord.lng) {
      map.flyTo([focusedCoord.lat, focusedCoord.lng], 16, { duration: 1.2 });
      return;
    }

    const allCoords = [];
    if (routePoints && routePoints.length > 0) {
      routePoints.forEach(p => {
        if (p.lat && p.lng) allCoords.push([parseFloat(p.lat), parseFloat(p.lng)]);
      });
    }
    if (stops && stops.length > 0) {
      stops.forEach(s => {
        if (s.lat && s.lng) allCoords.push([parseFloat(s.lat), parseFloat(s.lng)]);
      });
    }
    if (geofences && geofences.length > 0) {
      geofences.forEach(g => {
        if (g.center_lat && g.center_lng) allCoords.push([parseFloat(g.center_lat), parseFloat(g.center_lng)]);
      });
    }

    if (allCoords.length > 0) {
      const bounds = L.latLngBounds(allCoords);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [routePoints, stops, geofences, focusedCoord, map]);

  return null;
};

// ── Format Duration (HH:MM:SS) ───────────────────────────────────────────────────
const formatDurationHms = (seconds) => {
  if (!seconds || seconds <= 0) return '00:00:00';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// ── Format Time for Timeline (e.g. 9:13:10 AM) ───────────────────────────────────
const formatTimeAmPm = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
};

// ── Calculate Area in km² from radius in meters ───────────────────────────────────
const calculateCircleAreaKm2 = (radiusMeters) => {
  if (!radiusMeters) return '0.00';
  const radiusKm = radiusMeters / 1000;
  return (Math.PI * radiusKm * radiusKm).toFixed(2);
};

// ── Local Date String Helper (YYYY-MM-DD) ─────────────────────────────────────────
const getLocalDateString = (d = new Date()) => {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${da}`;
};

export default function TripManagerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlVehicleId = searchParams.get('vehicleId');
  const urlType = searchParams.get('type');

  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState(urlVehicleId || '');
  const urlTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(urlTab === 'geofences' ? 'geofences' : 'trip');
  const [mapLayer, setMapLayer] = useState('google'); // 'google', 'satellite', 'osm'

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'geofences' || tabParam === 'trip' || tabParam === 'geofence_reports') {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Date selection: today by default in local time
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString());

  const [loading, setLoading] = useState(false);
  const [tripLegs, setTripLegs] = useState([]);
  const [stoppages, setStoppages] = useState([]);
  const [routeHistory, setRouteHistory] = useState([]);
  const [dayActivity, setDayActivity] = useState(null);
  const [geofences, setGeofences] = useState([]);
  const [addresses, setAddresses] = useState({}); // key: lat,lng -> address
  const [focusedCoord, setFocusedCoord] = useState(null);

  // ── Trip View Type: Total Trip, Automated Trips, Manual Trips ──
  const [tripType, setTripType] = useState(() => {
    if (urlType === 'total' || urlType === 'automated' || urlType === 'manual') return urlType;
    return 'automated';
  });

  // Keep tripType in sync when URL query changes (e.g., via sidebar navigation)
  useEffect(() => {
    const t = searchParams.get('type');
    if (t && (t === 'total' || t === 'automated' || t === 'manual')) {
      setTripType(t);
    }
  }, [searchParams]);

  const [fromGeofenceFilter, setFromGeofenceFilter] = useState('');
  const [toGeofenceFilter, setToGeofenceFilter] = useState('');
  const [manualTrips, setManualTrips] = useState([]);
  const [loadingManualTrips, setLoadingManualTrips] = useState(false);
  const [selectedManualTrip, setSelectedManualTrip] = useState(null);
  const [dailyTripSummary, setDailyTripSummary] = useState(null);
  const [loadingDailyTrip, setLoadingDailyTrip] = useState(false);

  // Set Geofence Modal state
  const [geofenceModalOpen, setGeofenceModalOpen] = useState(false);
  const [geofenceForm, setGeofenceForm] = useState({
    name: '',
    lat: null,
    lng: null,
    radius: 300,
    alert_on_enter: true,
    alert_on_exit: true,
    additionalVehicleIds: [],
  });
  const [savingGeofence, setSavingGeofence] = useState(false);

  // Assign Geofence to Other Vehicles Modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assigningGeofence, setAssigningGeofence] = useState(null);
  const [targetVehicleIds, setTargetVehicleIds] = useState([]);
  const [savingAssignment, setSavingAssignment] = useState(false);

  // Import / Attach Existing Geofence Modal state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [availableGeofences, setAvailableGeofences] = useState([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [linkingGeofenceId, setLinkingGeofenceId] = useState(null);

  // Load Vehicles
  useEffect(() => {
    vehicleApi.getVehicles().then(res => {
      const vList = Array.isArray(res) ? res : (res?.data || []);
      setVehicles(vList);
      if (vList.length > 0 && !selectedVehicleId) {
        setSelectedVehicleId(vList[0].id);
      }
    }).catch(err => {
      console.error('Failed to load vehicles:', err);
    });
  }, []);

  const selectedVehicle = useMemo(() => {
    return vehicles.find(v => v.id === selectedVehicleId) || null;
  }, [vehicles, selectedVehicleId]);

  // Load Geofences for current vehicle
  const loadGeofences = useCallback(async () => {
    if (!selectedVehicleId) return;
    try {
      const res = await axiosInstance.get(`/api/vehicles/${selectedVehicleId}/geofences`);
      if (res.data?.success && Array.isArray(res.data.data)) {
        setGeofences(res.data.data);
      } else {
        setGeofences([]);
      }
    } catch (err) {
      console.error('Failed to load vehicle geofences:', err);
      setGeofences([]);
    }
  }, [selectedVehicleId]);

  // Load Trips & Route History
  const loadTripData = useCallback(async () => {
    if (!selectedVehicleId) return;
    setLoading(true);

    // Convert selectedDate (YYYY-MM-DD) to full 24h day in local time
    const [y, m, d] = selectedDate.split('-').map(Number);
    const startObj = new Date(y, m - 1, d, 0, 0, 0, 0);
    const endObj = new Date(y, m - 1, d, 23, 59, 59, 999);
    const start = startObj.toISOString();
    const end = endObj.toISOString();

    try {
      const [legsRes, stopsRes, routeRes, activityRes] = await Promise.all([
        axiosInstance.get(`/api/reports/trip?vehicleId=${selectedVehicleId}&startDate=${start}&endDate=${end}`).catch(() => ({ data: { data: [] } })),
        axiosInstance.get(`/api/reports/stoppages?vehicleId=${selectedVehicleId}&startDate=${start}&endDate=${end}`).catch(() => ({ data: { data: [] } })),
        axiosInstance.get(`/api/reports/route-history?vehicleId=${selectedVehicleId}&startDate=${start}&endDate=${end}`).catch(() => ({ data: { data: [] } })),
        axiosInstance.get(`/api/reports/activity?vehicleId=${selectedVehicleId}&startDate=${start}&endDate=${end}`).catch(() => ({ data: { data: null } })),
      ]);

      const legs = Array.isArray(legsRes.data?.data) ? legsRes.data.data : [];
      const stops = Array.isArray(stopsRes.data?.data) ? stopsRes.data.data : [];
      const route = Array.isArray(routeRes.data?.data) ? routeRes.data.data : [];

      setTripLegs(legs);
      setStoppages(stops);
      setRouteHistory(route);
      setDayActivity(activityRes.data?.data || null);

      // Trigger address lookups for stops
      stops.forEach(s => {
        if (s.lat && s.lng) {
          const key = `${parseFloat(s.lat).toFixed(4)},${parseFloat(s.lng).toFixed(4)}`;
          if (!addresses[key]) {
            getAddressFromCoordinates(s.lat, s.lng).then(addr => {
              setAddresses(prev => ({ ...prev, [key]: addr }));
            });
          }
        }
      });
    } catch (err) {
      console.error('Error loading trip data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedVehicleId, selectedDate, addresses]);

  // Load Manual Geofence-Based Trips
  const loadManualTrips = useCallback(async () => {
    if (!selectedVehicleId) return;
    setLoadingManualTrips(true);
    const [y, m, d] = selectedDate.split('-').map(Number);
    const startObj = new Date(y, m - 1, d, 0, 0, 0, 0);
    const endObj = new Date(y, m - 1, d, 23, 59, 59, 999);
    const start = startObj.toISOString();
    const end = endObj.toISOString();

    try {
      const params = new URLSearchParams();
      params.append('vehicleId', selectedVehicleId);
      params.append('startDate', start);
      params.append('endDate', end);
      if (fromGeofenceFilter) params.append('fromGeofenceId', fromGeofenceFilter);
      if (toGeofenceFilter) params.append('toGeofenceId', toGeofenceFilter);

      const res = await axiosInstance.get(`/api/reports/geofence-transit?${params.toString()}`);
      if (res.data?.success && Array.isArray(res.data.data)) {
        setManualTrips(res.data.data);
      } else {
        setManualTrips([]);
      }
    } catch (err) {
      console.error('Failed to load manual trips:', err);
      setManualTrips([]);
    } finally {
      setLoadingManualTrips(false);
    }
  }, [selectedVehicleId, selectedDate, fromGeofenceFilter, toGeofenceFilter]);

  // Load Daily Full-Day Trip Summary
  const loadDailyTripSummary = useCallback(async () => {
    if (!selectedVehicleId) return;
    setLoadingDailyTrip(true);
    const [y, m, d] = selectedDate.split('-').map(Number);
    const startObj = new Date(y, m - 1, d, 0, 0, 0, 0);
    const endObj = new Date(y, m - 1, d, 23, 59, 59, 999);
    const start = startObj.toISOString();
    const end = endObj.toISOString();

    try {
      const res = await axiosInstance.get(`/api/reports/daily-trip?vehicleId=${selectedVehicleId}&startDate=${start}&endDate=${end}`);
      if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
        setDailyTripSummary(res.data.data[0]);
      } else {
        setDailyTripSummary(null);
      }
    } catch (err) {
      console.error('Failed to load daily trip summary:', err);
      setDailyTripSummary(null);
    } finally {
      setLoadingDailyTrip(false);
    }
  }, [selectedVehicleId, selectedDate]);

  // Quick pairs permutation (A -> B, A -> C, B -> C, A -> A, etc.)
  const quickGeofencePairs = useMemo(() => {
    if (!geofences || geofences.length === 0) return [];
    const pairs = [];
    for (let i = 0; i < geofences.length; i++) {
      for (let j = 0; j < geofences.length; j++) {
        if (i !== j) {
          pairs.push({
            label: `${geofences[i].name} → ${geofences[j].name}`,
            fromId: geofences[i].id,
            toId: geofences[j].id,
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

  useEffect(() => {
    if (selectedVehicleId) {
      loadTripData();
      loadGeofences();
      if (tripType === 'manual') loadManualTrips();
      if (tripType === 'total') loadDailyTripSummary();
    }
  }, [selectedVehicleId, selectedDate, tripType, loadTripData, loadGeofences, loadManualTrips, loadDailyTripSummary]);

  useEffect(() => {
    if (tripType === 'manual' && selectedVehicleId) {
      loadManualTrips();
    }
  }, [fromGeofenceFilter, toGeofenceFilter, tripType, loadManualTrips]);

  // Interleave stoppages and driving legs chronologically (matching clean mobile app timeline)
  const timelineEvents = useMemo(() => {
    const rawEvents = [];

    stoppages.forEach(s => {
      // Only include actual stops / parkings (duration >= 60s and not Moving)
      if (s.duration_seconds >= 60 && s.status !== 'Moving') {
        rawEvents.push({
          type: 'stop',
          data: { ...s },
          start_time: new Date(s.start_time).getTime(),
          end_time: new Date(s.end_time).getTime(),
          time: new Date(s.start_time).getTime(),
        });
      }
    });

    tripLegs.forEach(l => {
      rawEvents.push({
        type: 'driving',
        data: { ...l },
        start_time: new Date(l.start_time).getTime(),
        end_time: new Date(l.end_time).getTime(),
        time: new Date(l.start_time).getTime(),
      });
    });

    // 1. Sort all events chronologically (earliest first)
    rawEvents.sort((a, b) => a.start_time - b.start_time);

    // 2. Merge consecutive stops AND merge consecutive driving legs (no multiple driving legs at one place)
    const mergedEvents = [];
    for (const ev of rawEvents) {
      const prev = mergedEvents[mergedEvents.length - 1];
      if (prev && prev.type === 'stop' && ev.type === 'stop') {
        const newEndTime = Math.max(prev.end_time, ev.end_time);
        prev.end_time = newEndTime;
        prev.data = {
          ...prev.data,
          end_time: new Date(newEndTime).toISOString(),
          duration_seconds: Math.round((newEndTime - prev.start_time) / 1000),
        };
      } else if (prev && prev.type === 'driving' && ev.type === 'driving') {
        // Merge consecutive driving legs separated only by brief traffic pauses into a single driving leg
        const newEndTime = Math.max(prev.end_time, ev.end_time);
        prev.end_time = newEndTime;
        const totalDurSec = Math.round((newEndTime - prev.start_time) / 1000);
        const prevDist = parseFloat(prev.data?.distance) || 0;
        const evDist = parseFloat(ev.data?.distance) || 0;
        const totalDist = Math.round((prevDist + evDist) * 100) / 100;
        const maxSpd = Math.max(parseFloat(prev.data?.max_speed) || 0, parseFloat(ev.data?.max_speed) || 0);
        const avgSpd = totalDurSec > 0 ? Math.round((totalDist / (totalDurSec / 3600)) * 10) / 10 : 0;
        prev.data = {
          ...prev.data,
          end_time: new Date(newEndTime).toISOString(),
          end_lat: ev.data?.end_lat || prev.data?.end_lat,
          end_lng: ev.data?.end_lng || prev.data?.end_lng,
          duration_seconds: totalDurSec,
          distance: totalDist,
          max_speed: maxSpd,
          avg_speed: avgSpd,
        };
      } else {
        mergedEvents.push({ ...ev });
      }
    }

    // 3. Align boundaries between adjacent Stop and Driving legs to match mobile app continuous journey
    for (let i = 0; i < mergedEvents.length; i++) {
      const cur = mergedEvents[i];
      const next = mergedEvents[i + 1];

      if (cur.type === 'stop' && next && next.type === 'driving') {
        // Driving leg starts immediately when the previous stop ends
        next.start_time = cur.end_time;
        next.data.start_time = new Date(next.start_time).toISOString();
        const durSec = Math.max(0, Math.round((next.end_time - next.start_time) / 1000));
        next.data.duration_seconds = durSec;
        if (durSec > 0 && next.data.distance > 0) {
          next.data.avg_speed = Math.round((next.data.distance / (durSec / 3600)) * 10) / 10;
        }
      } else if (cur.type === 'driving' && next && next.type === 'stop') {
        // Driving leg ends immediately when the subsequent stop begins
        cur.end_time = Math.max(cur.start_time, next.start_time);
        cur.data.end_time = new Date(cur.end_time).toISOString();
        const durSec = Math.max(0, Math.round((cur.end_time - cur.start_time) / 1000));
        cur.data.duration_seconds = durSec;
        if (durSec > 0 && cur.data.distance > 0) {
          cur.data.avg_speed = Math.round((cur.data.distance / (durSec / 3600)) * 10) / 10;
        }
      }
    }

    // 4. Assign sequential stop numbering (Stop 1, Stop 2...) in chronological order
    let stopCounter = 1;
    mergedEvents.forEach(ev => {
      if (ev.type === 'stop') {
        ev.index = stopCounter++;
      }
    });

    return mergedEvents;
  }, [stoppages, tripLegs]);

  // Calculate Trip Summary from merged timeline & activity metrics
  const tripSummary = useMemo(() => {
    let totalDistKm = 0;
    let totalDrivingSec = 0;
    let totalStopSec = 0;
    let stopCount = 0;

    timelineEvents.forEach(ev => {
      if (ev.type === 'driving') {
        totalDistKm += (parseFloat(ev.data.distance) || 0);
        totalDrivingSec += (parseFloat(ev.data.duration_seconds) || 0);
      } else if (ev.type === 'stop') {
        stopCount++;
        totalStopSec += (parseFloat(ev.data.duration_seconds) || 0);
      }
    });

    const travelled = dayActivity?.distance_travelled != null
      ? parseFloat(dayActivity.distance_travelled).toFixed(2)
      : totalDistKm.toFixed(2);

    const drivingDuration = dayActivity?.running_seconds
      ? formatDurationHms(dayActivity.running_seconds)
      : formatDurationHms(totalDrivingSec);

    const stopDuration = dayActivity?.stopped_seconds
      ? formatDurationHms(dayActivity.stopped_seconds)
      : formatDurationHms(totalStopSec);

    return {
      travelledKm: travelled,
      drivingDuration: drivingDuration,
      stopCount: stopCount,
      stopDuration: stopDuration,
      lowNetworkTime: '0 Time',
    };
  }, [timelineEvents, dayActivity]);

  // Open "Set Geofence" dialog pre-filled with stop location
  const handleOpenSetGeofence = (stopItem) => {
    const lat = parseFloat(stopItem.lat);
    const lng = parseFloat(stopItem.lng);
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const stopAddr = addresses[key] || '';

    setGeofenceForm({
      name: stopAddr ? stopAddr.split(',')[0].trim() : `Stop ${stopItem.index || ''}`,
      lat,
      lng,
      radius: 300,
      alert_on_enter: true,
      alert_on_exit: true,
      address: stopAddr,
      additionalVehicleIds: [],
    });
    setGeofenceModalOpen(true);
  };

  // Submit Geofence Creation
  const handleSaveGeofence = async () => {
    if (!geofenceForm.name.trim()) {
      alert('Please enter a name for the geofence.');
      return;
    }
    if (!geofenceForm.lat || !geofenceForm.lng) {
      alert('Geofence coordinates are missing.');
      return;
    }

    setSavingGeofence(true);
    try {
      const targetVehicleIds = Array.from(new Set([
        selectedVehicleId,
        ...(geofenceForm.additionalVehicleIds || [])
      ])).filter(Boolean);

      const payload = {
        name: geofenceForm.name.trim(),
        type: 'circle',
        center_lat: geofenceForm.lat,
        center_lng: geofenceForm.lng,
        radius: parseInt(geofenceForm.radius, 10) || 300,
        is_active: true,
        alert_on_enter: geofenceForm.alert_on_enter,
        alert_on_exit: geofenceForm.alert_on_exit,
        vehicleIds: targetVehicleIds,
      };

      const res = await axiosInstance.post(`/api/vehicles/${selectedVehicleId}/geofences`, payload);
      if (res.data?.success) {
        setGeofenceModalOpen(false);
        await loadGeofences();
        setActiveTab('geofences');
      } else {
        alert(res.data?.error || 'Failed to save geofence.');
      }
    } catch (err) {
      console.error('Error saving geofence:', err);
      alert(err.response?.data?.error || 'Failed to save geofence.');
    } finally {
      setSavingGeofence(false);
    }
  };

  // Open Assign Geofence to Other Vehicles Modal
  const handleOpenAssignModal = async (geofence) => {
    setAssigningGeofence(geofence);
    setAssignModalOpen(true);
    try {
      const res = await axiosInstance.get(`/api/vehicles/${selectedVehicleId}/geofences/${geofence.id}/vehicles`);
      if (res.data?.success && Array.isArray(res.data.data)) {
        const ids = res.data.data.map(v => v.id);
        setTargetVehicleIds(ids.length > 0 ? ids : [selectedVehicleId]);
      } else {
        setTargetVehicleIds([selectedVehicleId]);
      }
    } catch (err) {
      console.warn('Could not fetch geofence vehicles:', err);
      setTargetVehicleIds([selectedVehicleId]);
    }
  };

  // Save Geofence Assignment to Multiple Vehicles
  const handleSaveAssignment = async () => {
    if (!assigningGeofence) return;
    if (targetVehicleIds.length === 0) {
      alert('Please select at least one vehicle.');
      return;
    }

    setSavingAssignment(true);
    try {
      const res = await axiosInstance.post(`/api/vehicles/${selectedVehicleId}/geofences/link`, {
        geofenceId: assigningGeofence.id,
        vehicleIds: targetVehicleIds,
      });

      if (res.data?.success) {
        setAssignModalOpen(false);
        setAssigningGeofence(null);
        await loadGeofences();
      } else {
        alert(res.data?.error || 'Failed to update geofence assignment.');
      }
    } catch (err) {
      console.error('Error assigning geofence:', err);
      alert(err.response?.data?.error || 'Failed to update geofence assignment.');
    } finally {
      setSavingAssignment(false);
    }
  };

  // Open "Add Existing Geofence" Modal
  const handleOpenImportModal = async () => {
    setImportModalOpen(true);
    setLoadingAvailable(true);
    try {
      const res = await axiosInstance.get(`/api/vehicles/${selectedVehicleId}/available-geofences`);
      if (res.data?.success && Array.isArray(res.data.data)) {
        setAvailableGeofences(res.data.data);
      } else {
        setAvailableGeofences([]);
      }
    } catch (err) {
      console.error('Failed to load available geofences:', err);
      setAvailableGeofences([]);
    } finally {
      setLoadingAvailable(false);
    }
  };

  // Attach an existing geofence to the current vehicle
  const handleLinkExistingGeofence = async (geofenceId) => {
    setLinkingGeofenceId(geofenceId);
    try {
      const res = await axiosInstance.post(`/api/vehicles/${selectedVehicleId}/geofences/link`, {
        geofenceId,
      });
      if (res.data?.success) {
        setAvailableGeofences(prev =>
          prev.map(g => g.id === geofenceId ? { ...g, is_assigned_to_vehicle: true } : g)
        );
        await loadGeofences();
      } else {
        alert(res.data?.error || 'Failed to attach geofence to this vehicle.');
      }
    } catch (err) {
      console.error('Failed to attach geofence:', err);
      alert(err.response?.data?.error || 'Failed to attach geofence.');
    } finally {
      setLinkingGeofenceId(null);
    }
  };

  // Toggle Geofence Active State
  const handleToggleGeofence = async (geofence) => {
    try {
      const newActive = !geofence.is_active;
      // Optimistic update
      setGeofences(prev => prev.map(g => g.id === geofence.id ? { ...g, is_active: newActive } : g));

      await axiosInstance.patch(`/api/vehicles/${selectedVehicleId}/geofences/${geofence.id}/toggle`, {
        is_active: newActive,
      });
    } catch (err) {
      console.error('Failed to toggle geofence active state:', err);
      loadGeofences();
    }
  };

  // Delete Geofence
  const handleDeleteGeofence = async (geofenceId) => {
    if (!window.confirm('Are you sure you want to delete this geofence for this vehicle?')) return;
    try {
      await axiosInstance.delete(`/api/vehicles/${selectedVehicleId}/geofences/${geofenceId}`);
      setGeofences(prev => prev.filter(g => g.id !== geofenceId));
    } catch (err) {
      console.error('Failed to delete geofence:', err);
      alert('Failed to delete geofence.');
    }
  };

  // Live Vehicle status
  const isMoving = selectedVehicle ? (Number(selectedVehicle.current_speed || selectedVehicle.speed) > 2) : false;
  const currentSpeed = selectedVehicle ? Math.round(Number(selectedVehicle.current_speed || selectedVehicle.speed || 0)) : 0;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', width: '100%', overflow: 'hidden', background: '#F8FAFC' }}>
      
      {/* ── Left Sidebar / Panel (Screenshots 2 & 3 layout) ── */}
      <div style={{
        width: '460px',
        minWidth: '420px',
        maxWidth: '500px',
        height: '100%',
        background: '#FFFFFF',
        borderRight: '1px solid #E2E8F0',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '2px 0 8px rgba(0,0,0,0.03)',
        zIndex: 20,
      }}>

        {/* Top Header Bar */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #F1F5F9',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          background: '#FFFFFF',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: '#D1FAE5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#065F46',
              }}>
                <RouteIcon size={18} color="#059669" />
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {selectedVehicle?.plate || selectedVehicle?.name || 'Vehicle'}
                </div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B' }}>
                  Trip Details & Geofences
                </div>
              </div>
            </div>

            {/* Vehicle Selector Dropdown */}
            <select
              value={selectedVehicleId}
              onChange={(e) => {
                setSelectedVehicleId(e.target.value);
                setSearchParams({ vehicleId: e.target.value });
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '12px',
                fontWeight: 700,
                color: '#1E293B',
                background: '#F8FAFC',
                outline: 'none',
                maxWidth: '160px',
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

          {/* Date Selector Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => setSelectedDate(getLocalDateString())}
                style={{
                  padding: '5px 14px',
                  borderRadius: '999px',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: selectedDate === getLocalDateString() ? '#064E3B' : '#E6F4EA',
                  color: selectedDate === getLocalDateString() ? '#FFFFFF' : '#334155',
                  boxShadow: selectedDate === getLocalDateString() ? '0 2px 5px rgba(6,78,59,0.3)' : 'none',
                }}
              >
                Today
              </button>
              <button
                onClick={() => {
                  const y = new Date();
                  y.setDate(y.getDate() - 1);
                  setSelectedDate(getLocalDateString(y));
                }}
                style={{
                  padding: '5px 14px',
                  borderRadius: '999px',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: selectedDate !== getLocalDateString() ? '#064E3B' : '#E6F4EA',
                  color: selectedDate !== getLocalDateString() ? '#FFFFFF' : '#334155',
                  boxShadow: selectedDate !== getLocalDateString() ? '0 2px 5px rgba(6,78,59,0.3)' : 'none',
                }}
              >
                Yesterday
              </button>
            </div>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '11px',
                fontWeight: 600,
                color: '#1E293B',
                background: '#FFFFFF',
              }}
            />
          </div>


          {/* Navigation Sub-Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', marginTop: '4px' }}>
            <button
              onClick={() => setActiveTab('trip')}
              style={{
                flex: 1,
                padding: '8px 0',
                border: 'none',
                background: 'transparent',
                fontSize: '12px',
                fontWeight: 800,
                color: activeTab === 'trip' ? '#047857' : '#64748B',
                borderBottom: activeTab === 'trip' ? '2.5px solid #059669' : '2.5px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <span>Trip Timeline</span>
              {timelineEvents.length > 0 && (
                <span style={{
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: activeTab === 'trip' ? '#D1FAE5' : '#F1F5F9',
                  color: activeTab === 'trip' ? '#065F46' : '#64748B',
                  fontSize: '10px',
                  fontWeight: 800,
                }}>
                  {timelineEvents.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('geofences')}
              style={{
                flex: 1,
                padding: '8px 0',
                border: 'none',
                background: 'transparent',
                fontSize: '12px',
                fontWeight: 800,
                color: activeTab === 'geofences' ? '#047857' : '#64748B',
                borderBottom: activeTab === 'geofences' ? '2.5px solid #059669' : '2.5px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <span>Geofences</span>
              <span style={{
                padding: '1px 6px',
                borderRadius: '10px',
                background: activeTab === 'geofences' ? '#D1FAE5' : '#F1F5F9',
                color: activeTab === 'geofences' ? '#065F46' : '#64748B',
                fontSize: '10px',
                fontWeight: 800,
              }}>
                {geofences.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('geofence_reports')}
              style={{
                flex: 1,
                padding: '8px 0',
                border: 'none',
                background: 'transparent',
                fontSize: '12px',
                fontWeight: 800,
                color: activeTab === 'geofence_reports' ? '#047857' : '#64748B',
                borderBottom: activeTab === 'geofence_reports' ? '2.5px solid #059669' : '2.5px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <span>Trip Reports</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ══ TAB 1: TRIP TIMELINE (Screenshots 2 & 3) ══ */}
          {activeTab === 'trip' && (
            <>
              {/* Top Vehicle Status Card (Screenshot 3) */}
              <div style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                padding: '16px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    background: isMoving ? '#DCFCE7' : '#FEF3C7',
                    border: `3px solid ${isMoving ? '#86EFAC' : '#FDE68A'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {isMoving ? (
                      <Navigation size={22} color="#16A34A" style={{ transform: 'rotate(45deg)' }} />
                    ) : (
                      <Fuel size={20} color="#D97706" />
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: isMoving ? '#15803D' : '#B45309' }}>
                      {isMoving ? 'Moving Active' : 'Stopped / Parked'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <MapPin size={11} color="#EA580C" />
                      <span style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {selectedVehicle?.current_address || 'Current location recorded'}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{
                  background: isMoving ? '#F0FDF4' : '#F8FAFC',
                  border: `1px solid ${isMoving ? '#BBF7D0' : '#E2E8F0'}`,
                  borderRadius: '12px',
                  padding: '8px 14px',
                  textAlign: 'center',
                  flexShrink: 0,
                }}>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: isMoving ? '#15803D' : '#0F172A' }}>
                    {currentSpeed}
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748B' }}>km/h</div>
                </div>
              </div>

              {/* Trip Summary Card (Screenshot 3) */}
              <div style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                padding: '16px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', marginBottom: '14px' }}>
                  Trip Summary
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {/* Travelled */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#2563EB', fontSize: '12px', fontWeight: 700 }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563EB', display: 'inline-block' }} />
                      <span>Travelled</span>
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 900, color: '#0F172A' }}>
                      {tripSummary.travelledKm} KM
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748B' }}>
                      {tripSummary.drivingDuration}
                    </div>
                  </div>

                  {/* Stop */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '1px solid #F1F5F9', paddingLeft: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#D97706', fontSize: '12px', fontWeight: 700 }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#D97706', display: 'inline-block' }} />
                      <span>Stop</span>
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 900, color: '#0F172A' }}>
                      {tripSummary.stopCount} Stop
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748B' }}>
                      {tripSummary.stopDuration}
                    </div>
                  </div>

                  {/* Low Network */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '1px solid #F1F5F9', paddingLeft: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B', fontSize: '12px', fontWeight: 700 }}>
                      <Radio size={12} color="#64748B" />
                      <span>Low Net...</span>
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 900, color: '#0F172A' }}>
                      {tripSummary.lowNetworkTime}
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748B' }}>
                      -
                    </div>
                  </div>
                </div>
              </div>

              {/* Trip Details Section Title */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                  Trip Details
                </div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B' }}>
                  {timelineEvents.length} events recorded
                </div>
              </div>

              {/* Connected Vertical Timeline */}
              {timelineEvents.length === 0 ? (
                <div style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  background: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1px solid #E2E8F0',
                  color: '#94A3B8',
                  fontSize: '13px',
                }}>
                  <Clock size={28} color="#CBD5E1" style={{ margin: '0 auto 8px' }} />
                  <div>No trip activity found for {selectedDate}</div>
                </div>
              ) : (
                <div style={{ position: 'relative', paddingLeft: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Continuous Vertical Timeline Line */}
                  <div style={{
                    position: 'absolute',
                    top: '16px',
                    bottom: '16px',
                    left: '15px',
                    width: '3px',
                    background: '#E2E8F0',
                    zIndex: 1,
                  }} />

                  {timelineEvents.map((ev, idx) => {
                    if (ev.type === 'stop') {
                      const stop = ev.data;
                      const lat = parseFloat(stop.lat);
                      const lng = parseFloat(stop.lng);
                      const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
                      const stopAddr = addresses[key] || 'Fetching location address...';

                      return (
                        <div
                          key={`stop-${idx}`}
                          onClick={() => {
                            if (lat && lng) setFocusedCoord({ lat, lng });
                          }}
                          style={{ position: 'relative', zIndex: 2, cursor: 'pointer' }}
                        >
                          {/* Left Icon Node */}
                          <div style={{
                            position: 'absolute',
                            left: '-32px',
                            top: '2px',
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            background: '#D97706',
                            border: '3px solid #FFFFFF',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <Fuel size={14} color="#FFFFFF" />
                          </div>

                          {/* Stop Content */}
                          <div style={{
                            background: '#FFFFFF',
                            borderRadius: '14px',
                            border: '1px solid #E2E8F0',
                            padding: '14px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                            transition: 'all 0.15s ease',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <div style={{ fontSize: '13px', fontWeight: 800, color: '#D97706' }}>
                                Stop {ev.index} — {formatDurationHms(stop.duration_seconds)}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenSetGeofence({ ...stop, index: ev.index });
                                }}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#2563EB',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                  padding: 0,
                                }}
                              >
                                <span>Set geofence</span>
                                <ChevronRight size={14} />
                              </button>
                            </div>

                            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>
                              {formatTimeAmPm(stop.start_time)} - {formatTimeAmPm(stop.end_time)}
                            </div>

                            <div style={{ fontSize: '12px', color: '#1E293B', marginTop: '6px', lineHeight: 1.4 }}>
                              {stopAddr}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (ev.type === 'driving') {
                      const leg = ev.data;
                      return (
                        <div key={`driving-${idx}`} style={{ position: 'relative', zIndex: 2 }}>
                          {/* Left Icon Node */}
                          <div style={{
                            position: 'absolute',
                            left: '-32px',
                            top: '2px',
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            background: '#2563EB',
                            border: '3px solid #FFFFFF',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <Navigation size={14} color="#FFFFFF" style={{ transform: 'rotate(45deg)' }} />
                          </div>

                          {/* Driving Content */}
                          <div style={{
                            background: '#FFFFFF',
                            borderRadius: '14px',
                            border: '1px solid #E2E8F0',
                            padding: '14px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                          }}>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: '#2563EB', marginBottom: '2px' }}>
                              Driving — {formatDurationHms(leg.duration_seconds)}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, marginBottom: '10px' }}>
                              {formatTimeAmPm(leg.start_time)} - {formatTimeAmPm(leg.end_time)}
                            </div>

                            {/* 2 Mini Subcards (Distance & Average Speed) */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                              <div style={{
                                background: '#F8FAFC',
                                border: '1px solid #F1F5F9',
                                borderRadius: '10px',
                                padding: '10px',
                              }}>
                                <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <RouteIcon size={12} color="#2563EB" />
                                  <span>Distance</span>
                                </div>
                                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                                  {parseFloat(leg.distance || 0).toFixed(1)} km
                                </div>
                              </div>

                              <div style={{
                                background: '#F8FAFC',
                                border: '1px solid #F1F5F9',
                                borderRadius: '10px',
                                padding: '10px',
                              }}>
                                <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Gauge size={12} color="#2563EB" />
                                  <span>Average Speed</span>
                                </div>
                                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                                  {Math.round(leg.avg_speed || leg.max_speed || 0)} kmph
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return null;
                  })}

                  <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600, color: '#94A3B8', padding: '8px 0' }}>
                    Trip Started - {formatLocalDate(selectedDate)}, 12:00 AM
                  </div>
                </div>
              )}
            </>
          )}

          {/* ══ TAB 2: VEHICLE GEOFENCES (Screenshot 4) ══ */}
          {activeTab === 'geofences' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                  Vehicle Geofences
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={loadGeofences}
                    title="Refresh Geofences"
                    style={{
                      background: '#F1F5F9',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '6px',
                      cursor: 'pointer',
                      color: '#475569',
                    }}
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button
                    onClick={handleOpenImportModal}
                    title="Attach existing geofence from another vehicle to this vehicle"
                    style={{
                      background: '#EFF6FF',
                      color: '#2563EB',
                      border: '1px solid #BFDBFE',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Layers size={14} />
                    <span>Add Existing</span>
                  </button>
                  <button
                    onClick={() => {
                      setGeofenceForm({
                        name: '',
                        lat: selectedVehicle?.lat || 17.385,
                        lng: selectedVehicle?.lng || 78.4867,
                        radius: 300,
                        alert_on_enter: true,
                        alert_on_exit: true,
                        additionalVehicleIds: [],
                      });
                      setGeofenceModalOpen(true);
                    }}
                    style={{
                      background: '#2563EB',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Plus size={14} />
                    <span>New Geofence</span>
                  </button>
                </div>
              </div>

              {geofences.length === 0 ? (
                <div style={{
                  padding: '40px 16px',
                  textAlign: 'center',
                  background: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1px solid #E2E8F0',
                  color: '#94A3B8',
                  fontSize: '13px',
                }}>
                  <Shield size={32} color="#CBD5E1" style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontWeight: 700, color: '#475569' }}>No geofences set for this vehicle</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    Click "Set geofence" on any stop in the Trip Timeline or click "+ New Geofence" above.
                  </div>
                </div>
              ) : (
                <>
                  {geofences.length >= 2 && (
                    <div style={{
                      background: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)',
                      border: '1.5px solid #C7D2FE',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <div style={{
                          background: '#4F46E5',
                          color: '#FFFFFF',
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '13px',
                          flexShrink: 0,
                        }}>
                          ⇄
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: '#1E1B4B' }}>
                            Transit Route Configured
                          </div>
                          <div style={{ fontSize: '11px', color: '#4338CA', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {geofences[0].name} ⇄ {geofences[1].name}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/reports/geofence-two-way?vehicleId=${selectedVehicleId}&fromId=${geofences[0].id}&toId=${geofences[1].id}`)}
                          style={{
                            background: '#4F46E5',
                            color: '#FFFFFF',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '0 2px 4px rgba(79, 70, 229, 0.25)',
                          }}
                          title="Run Two-Way Loop & Shuttle Report"
                        >
                          <Repeat size={12} />
                          <span>Two-Way Report</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/reports/geofence-one-way?vehicleId=${selectedVehicleId}&fromId=${geofences[0].id}&toId=${geofences[1].id}`)}
                          style={{
                            background: '#0284C7',
                            color: '#FFFFFF',
                            border: 'none',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
                          }}
                          title="Run One-Way Transit Report"
                        >
                          <ArrowRight size={12} />
                          <span>One-Way</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {geofences.map(g => (
                  <div
                    key={g.id}
                    onClick={() => {
                      if (g.center_lat && g.center_lng) {
                        setFocusedCoord({ lat: parseFloat(g.center_lat), lng: parseFloat(g.center_lng) });
                      }
                    }}
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '14px',
                      border: '1px solid #E2E8F0',
                      padding: '16px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {/* Header Row: Dot + Name + Toggle Switch */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: g.is_active ? '#2563EB' : '#94A3B8',
                        }} />
                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                          {g.name}
                        </span>
                      </div>

                      {/* Active Toggle Switch */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleGeofence(g);
                        }}
                        style={{
                          width: '42px',
                          height: '22px',
                          borderRadius: '12px',
                          background: g.is_active ? '#2563EB' : '#CBD5E1',
                          border: 'none',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'background 0.2s',
                          padding: '2px',
                        }}
                      >
                        <div style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: '#FFFFFF',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          transform: g.is_active ? 'translateX(20px)' : 'translateX(0px)',
                          transition: 'transform 0.2s',
                        }} />
                      </button>
                    </div>

                    {/* Chips Row */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                      <span style={{
                        background: '#F1F5F9',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#475569',
                      }}>
                        ⭕ {g.radius || 300} m radius
                      </span>
                      <span style={{
                        background: '#F1F5F9',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#475569',
                      }}>
                        ⛶ {calculateCircleAreaKm2(g.radius)} km²
                      </span>
                      {g.alert_on_enter !== false && (
                        <span style={{
                          background: '#EFF6FF',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#2563EB',
                        }}>
                          → Entry alert
                        </span>
                      )}
                      {g.alert_on_exit !== false && (
                        <span style={{
                          background: '#EFF6FF',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#2563EB',
                        }}>
                          ← Exit alert
                        </span>
                      )}
                      {Number(g.assigned_vehicles_count) > 1 ? (
                        <span style={{
                          background: '#FEF3C7',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#92400E',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}>
                          🔗 Shared ({g.assigned_vehicles_count} vehicles)
                        </span>
                      ) : (
                        <span style={{
                          background: '#F1F5F9',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#64748B',
                        }}>
                          Vehicle-only
                        </span>
                      )}
                    </div>

                    {/* Footer Row: Created relative time + Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
                      <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>
                        Created {getRelativeTime(g.created_at)}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/reports/geofence-round-trip?vehicleId=${selectedVehicleId}&geofenceId=${g.id}`);
                          }}
                          style={{
                            background: '#ECFDF5',
                            border: '1px solid #A7F3D0',
                            color: '#059669',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                          title="View Round Trip loops starting and ending at this geofence"
                        >
                          <RotateCcw size={11} />
                          <span>Round Trip</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/reports/geofence-single-place?vehicleId=${selectedVehicleId}&geofenceId=${g.id}`);
                          }}
                          style={{
                            background: '#FFFBEB',
                            border: '1px solid #FDE68A',
                            color: '#D97706',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                          title="View Stays and In/Out Activity for this geofence"
                        >
                          <MapPin size={11} />
                          <span>Stays</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAssignModal(g);
                          }}
                          style={{
                            background: '#EFF6FF',
                            border: '1px solid #BFDBFE',
                            color: '#2563EB',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            transition: 'all 0.15s ease',
                          }}
                          title="Apply this geofence to other vehicles of same user"
                        >
                          <Share2 size={11} />
                          <span>Apply</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteGeofence(g.id);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#DC2626',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '4px 6px',
                          }}
                        >
                          <Trash2 size={12} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                </>
              )}
            </div>
          )}

          {/* ══ TAB 3: GEOFENCE TRIP REPORTS ══ */}
          {activeTab === 'geofence_reports' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                    Geofence Trip Analytics
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                    Automated loop, transit corridor, and turnaround reports for {selectedVehicle?.name || 'this vehicle'}
                  </div>
                </div>
              </div>

              {geofences.length === 0 ? (
                <div style={{
                  padding: '36px 16px',
                  textAlign: 'center',
                  background: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1px solid #E2E8F0',
                  color: '#94A3B8',
                  fontSize: '13px',
                }}>
                  <Shield size={32} color="#CBD5E1" style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontWeight: 700, color: '#475569' }}>No geofences assigned to this vehicle yet</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    Assign or draw at least 1 geofence to run Round-Trip / Stay reports, or 2 geofences for Two-Way turnaround reports.
                  </div>
                  <button
                    onClick={() => setActiveTab('geofences')}
                    style={{
                      marginTop: '12px',
                      background: '#2563EB',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Go to Vehicle Geofences
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Report Card 1: Two-Way Shuttle Loops */}
                  <div style={{
                    background: '#FFFFFF',
                    borderRadius: '14px',
                    border: '1.5px solid #E0E7FF',
                    padding: '16px',
                    boxShadow: '0 2px 6px rgba(79, 70, 229, 0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          background: '#EEF2FF',
                          color: '#4F46E5',
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                        }}>
                          <Repeat size={18} />
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                            Two-Way Shuttle Loop Report
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>
                            Tracks complete round-trip cycles between Origin A and Destination B (Turnaround time, Stays, Transit time)
                          </div>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        background: '#EEF2FF',
                        color: '#4F46E5',
                        padding: '3px 8px',
                        borderRadius: '6px',
                      }}>
                        Requires 2 Geofences
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
                      <div style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>
                        {geofences.length >= 2 ? (
                          <span>Route: <strong>{geofences[0].name}</strong> ⇄ <strong>{geofences[1].name}</strong></span>
                        ) : (
                          <span style={{ color: '#94A3B8' }}>Attach 1 more geofence to unlock two-way loop tracking</span>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={geofences.length < 2}
                        onClick={() => {
                          if (geofences.length >= 2) {
                            navigate(`/admin/reports/geofence-two-way?vehicleId=${selectedVehicleId}&fromId=${geofences[0].id}&toId=${geofences[1].id}`);
                          }
                        }}
                        style={{
                          background: geofences.length >= 2 ? '#4F46E5' : '#E2E8F0',
                          color: geofences.length >= 2 ? '#FFFFFF' : '#94A3B8',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '7px 14px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: geofences.length >= 2 ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: geofences.length >= 2 ? '0 2px 6px rgba(79, 70, 229, 0.25)' : 'none',
                        }}
                      >
                        <Repeat size={13} />
                        <span>View Two-Way Report</span>
                      </button>
                    </div>
                  </div>

                  {/* Report Card 2: Round Trip (Departs base & returns) */}
                  <div style={{
                    background: '#FFFFFF',
                    borderRadius: '14px',
                    border: '1.5px solid #D1FAE5',
                    padding: '16px',
                    boxShadow: '0 2px 6px rgba(5, 150, 105, 0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          background: '#ECFDF5',
                          color: '#059669',
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                        }}>
                          <RotateCcw size={18} />
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                            Round-Trip Base Loop Report
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>
                            Tracks departures from a home depot/warehouse and returns to the same base with outside distance & duration
                          </div>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        background: '#ECFDF5',
                        color: '#059669',
                        padding: '3px 8px',
                        borderRadius: '6px',
                      }}>
                        1+ Geofence
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
                      <div style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>
                        Base: <strong>{geofences[0]?.name}</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigate(`/admin/reports/geofence-round-trip?vehicleId=${selectedVehicleId}&geofenceId=${geofences[0]?.id}`);
                        }}
                        style={{
                          background: '#059669',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '7px 14px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)',
                        }}
                      >
                        <RotateCcw size={13} />
                        <span>View Round-Trip Report</span>
                      </button>
                    </div>
                  </div>

                  {/* Report Card 3: One-Way Transit Corridor */}
                  <div style={{
                    background: '#FFFFFF',
                    borderRadius: '14px',
                    border: '1.5px solid #BAE6FD',
                    padding: '16px',
                    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          background: '#F0F9FF',
                          color: '#0284C7',
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                        }}>
                          <ArrowRight size={18} />
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                            One-Way Transit Report
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>
                            Point-to-point legs from Origin to Destination with travel duration, distance, and max speeds
                          </div>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        background: '#F0F9FF',
                        color: '#0284C7',
                        padding: '3px 8px',
                        borderRadius: '6px',
                      }}>
                        Requires 2 Geofences
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
                      <div style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>
                        {geofences.length >= 2 ? (
                          <span>Route: <strong>{geofences[0].name}</strong> → <strong>{geofences[1].name}</strong></span>
                        ) : (
                          <span style={{ color: '#94A3B8' }}>Attach 1 more geofence to unlock one-way transit tracking</span>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={geofences.length < 2}
                        onClick={() => {
                          if (geofences.length >= 2) {
                            navigate(`/admin/reports/geofence-one-way?vehicleId=${selectedVehicleId}&fromId=${geofences[0].id}&toId=${geofences[1].id}`);
                          }
                        }}
                        style={{
                          background: geofences.length >= 2 ? '#0284C7' : '#E2E8F0',
                          color: geofences.length >= 2 ? '#FFFFFF' : '#94A3B8',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '7px 14px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: geofences.length >= 2 ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: geofences.length >= 2 ? '0 2px 6px rgba(2, 132, 199, 0.25)' : 'none',
                        }}
                      >
                        <ArrowRight size={13} />
                        <span>View One-Way Report</span>
                      </button>
                    </div>
                  </div>

                  {/* Report Card 4: Single-Place Stay & In/Out Log */}
                  <div style={{
                    background: '#FFFFFF',
                    borderRadius: '14px',
                    border: '1.5px solid #FDE68A',
                    padding: '16px',
                    boxShadow: '0 2px 6px rgba(217, 119, 6, 0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          background: '#FFFBEB',
                          color: '#D97706',
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                        }}>
                          <MapPin size={18} />
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                            Single Place Stays & In/Out Report
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>
                            Detailed breakdown of all entries, exits, and dwell times inside specific warehouses/locations
                          </div>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        background: '#FFFBEB',
                        color: '#D97706',
                        padding: '3px 8px',
                        borderRadius: '6px',
                      }}>
                        1+ Geofence
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
                      <div style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>
                        Place: <strong>{geofences[0]?.name}</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigate(`/admin/reports/geofence-single-place?vehicleId=${selectedVehicleId}&geofenceId=${geofences[0]?.id}`);
                        }}
                        style={{
                          background: '#D97706',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '7px 14px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 6px rgba(217, 119, 6, 0.25)',
                        }}
                      >
                        <MapPin size={13} />
                        <span>View Place Report</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── Right Side Full Map (All Geofences & Trip on the SAME Map) ── */}
      <div style={{ flex: 1, height: '100%', position: 'relative' }}>
        <MapContainer
          center={[
            selectedVehicle?.lat ? parseFloat(selectedVehicle.lat) : 17.3850,
            selectedVehicle?.lng ? parseFloat(selectedVehicle.lng) : 78.4867
          ]}
          zoom={12}
          style={{ width: '100%', height: '100%' }}
        >
          {/* Map Tile Layer */}
          {mapLayer === 'satellite' ? (
            <TileLayer
              attribution='&copy; Google Maps'
              url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
              maxNativeZoom={20}
              maxZoom={22}
            />
          ) : mapLayer === 'osm' ? (
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          ) : (
            <TileLayer
              attribution='&copy; Google Maps'
              url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
              maxNativeZoom={20}
              maxZoom={22}
            />
          )}

          <MapBoundsController
            routePoints={routeHistory}
            stops={stoppages}
            geofences={geofences}
            focusedCoord={focusedCoord}
          />

          {/* Polyline Route */}
          {tripType !== 'manual' && routeHistory.length > 1 && (
            <Polyline
              positions={routeHistory.map(p => [parseFloat(p.lat), parseFloat(p.lng)])}
              pathOptions={{
                color: '#2563EB',
                weight: 5,
                opacity: 0.85,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          )}

          {/* Manual Trip Route */}
          {tripType === 'manual' && selectedManualTrip?.path_preview?.length > 1 && (
            <Polyline
              positions={selectedManualTrip.path_preview.map(p => [parseFloat(p.lat), parseFloat(p.lng)])}
              pathOptions={{
                color: '#059669',
                weight: 6,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          )}

          {/* Fallback route preview when manual trip doesn't have individual slice */}
          {tripType === 'manual' && (!selectedManualTrip || !selectedManualTrip.path_preview || selectedManualTrip.path_preview.length <= 1) && routeHistory.length > 1 && (
            <Polyline
              positions={routeHistory.map(p => [parseFloat(p.lat), parseFloat(p.lng)])}
              pathOptions={{
                color: '#059669',
                weight: 4,
                opacity: 0.65,
                dashArray: '6, 6',
              }}
            />
          )}

          {/* Manual Trip Start & End Pins */}
          {tripType === 'manual' && selectedManualTrip && selectedManualTrip.start_lat && selectedManualTrip.start_lng && (
            <Marker
              position={[parseFloat(selectedManualTrip.start_lat), parseFloat(selectedManualTrip.start_lng)]}
              icon={createTransitPinIcon(`Start: ${selectedManualTrip.from_geofence_name || 'Geofence'}`, '#2563EB')}
            >
              <Popup>
                <div style={{ padding: '4px', minWidth: '160px' }}>
                  <div style={{ fontWeight: 800, color: '#1D4ED8', fontSize: '13px' }}>
                    Departed: {selectedManualTrip.from_geofence_name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                    Time: {formatLocalTime(selectedManualTrip.departure_time)}
                  </div>
                </div>
              </Popup>
            </Marker>
          )}

          {tripType === 'manual' && selectedManualTrip && selectedManualTrip.end_lat && selectedManualTrip.end_lng && (
            <Marker
              position={[parseFloat(selectedManualTrip.end_lat), parseFloat(selectedManualTrip.end_lng)]}
              icon={createTransitPinIcon(`End: ${selectedManualTrip.to_geofence_name || 'Geofence'}`, '#059669')}
            >
              <Popup>
                <div style={{ padding: '4px', minWidth: '160px' }}>
                  <div style={{ fontWeight: 800, color: '#047857', fontSize: '13px' }}>
                    Arrived: {selectedManualTrip.to_geofence_name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                    Time: {formatLocalTime(selectedManualTrip.arrival_time)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#0F172A', marginTop: '4px', fontWeight: 700 }}>
                    Distance: {selectedManualTrip.distance_km} km | Duration: {selectedManualTrip.duration_formatted}
                  </div>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Stop Pins on Map (Aligned with Timeline Stops 1..N) */}
          {timelineEvents.filter(ev => ev.type === 'stop').map((ev) => {
            const s = ev.data;
            const stopNumber = ev.index;
            if (!s.lat || !s.lng) return null;
            return (
              <Marker
                key={`map-stop-${stopNumber}`}
                position={[parseFloat(s.lat), parseFloat(s.lng)]}
                icon={createStopIcon(stopNumber)}
              >
                <Popup>
                  <div style={{ padding: '4px', minWidth: '180px' }}>
                    <div style={{ fontWeight: 800, color: '#D97706', fontSize: '13px' }}>
                      Stop {stopNumber}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                      Duration: {formatDurationHms(s.duration_seconds)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#1E293B', marginTop: '4px' }}>
                      {addresses[`${parseFloat(s.lat).toFixed(4)},${parseFloat(s.lng).toFixed(4)}`] || 'Location pin'}
                    </div>
                    <button
                      onClick={() => handleOpenSetGeofence({ ...s, index: stopNumber })}
                      style={{
                        marginTop: '8px',
                        background: '#2563EB',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        width: '100%',
                      }}
                    >
                      Set Geofence
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* ALL VEHICLE GEOFENCES RENDERED ON THE SAME MAP */}
          {geofences.map(g => {
            if (!g.center_lat || !g.center_lng) return null;
            const lat = parseFloat(g.center_lat);
            const lng = parseFloat(g.center_lng);
            const rad = parseFloat(g.radius) || 300;

            return (
              <React.Fragment key={`map-geofence-${g.id}`}>
                {/* Circle Boundary */}
                <Circle
                  center={[lat, lng]}
                  radius={rad}
                  eventHandlers={{
                    click: () => setFocusedCoord({ lat, lng })
                  }}
                  pathOptions={{
                    color: g.is_active ? '#2563EB' : '#94A3B8',
                    fillColor: g.is_active ? '#3B82F6' : '#94A3B8',
                    fillOpacity: g.is_active ? 0.3 : 0.1,
                    weight: 3,
                    dashArray: g.is_active ? undefined : '5, 5',
                  }}
                />

                {/* Center marker with permanent label */}
                <Marker
                  position={[lat, lng]}
                  icon={createGeofenceCenterIcon(g.name)}
                  eventHandlers={{
                    click: () => setFocusedCoord({ lat, lng })
                  }}
                >
                  <Tooltip permanent direction="top" offset={[0, -10]}>
                    <div style={{ fontWeight: 800, fontSize: '11px', color: '#1E293B', cursor: 'pointer' }}>
                      {g.name} ({rad}m)
                    </div>
                  </Tooltip>
                </Marker>
              </React.Fragment>
            );
          })}

          {/* Current Live Vehicle Position Marker */}
          {selectedVehicle?.lat && selectedVehicle?.lng && (
            <Marker
              position={[parseFloat(selectedVehicle.lat), parseFloat(selectedVehicle.lng)]}
              icon={createVehiclePinIcon(isMoving, selectedVehicle.current_direction || 0)}
            >
              <Popup>
                <div style={{ padding: '4px', minWidth: '160px' }}>
                  <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '13px' }}>
                    {selectedVehicle.plate || selectedVehicle.name}
                  </div>
                  <div style={{ fontSize: '11px', color: isMoving ? '#16A34A' : '#64748B', fontWeight: 700, marginTop: '2px' }}>
                    {isMoving ? `Moving at ${currentSpeed} km/h` : 'Stopped / Parked'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                    Last seen: {formatLocalTime(selectedVehicle.last_seen)}
                  </div>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {/* Floating Map Layer Switcher Controls */}
        <div style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          zIndex: 1000,
          background: '#FFFFFF',
          borderRadius: '10px',
          padding: '4px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          gap: '4px',
          border: '1px solid #E2E8F0',
        }}>
          <button
            onClick={() => setMapLayer('google')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              background: mapLayer === 'google' ? '#064E3B' : 'transparent',
              color: mapLayer === 'google' ? '#FFFFFF' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            Google Map
          </button>
          <button
            onClick={() => setMapLayer('satellite')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              background: mapLayer === 'satellite' ? '#064E3B' : 'transparent',
              color: mapLayer === 'satellite' ? '#FFFFFF' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            Satellite
          </button>
          <button
            onClick={() => setMapLayer('osm')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              background: mapLayer === 'osm' ? '#064E3B' : 'transparent',
              color: mapLayer === 'osm' ? '#FFFFFF' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            OSM
          </button>
        </div>
      </div>

      {/* ── Set Geofence Modal ── */}
      {geofenceModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px',
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            maxWidth: '460px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #E2E8F0',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid #F1F5F9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: '#EFF6FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Shield size={18} color="#2563EB" />
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                    Set Geofence
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>
                    Vehicle: {selectedVehicle?.plate || selectedVehicle?.name}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setGeofenceModalOpen(false)}
                style={{
                  background: '#F1F5F9',
                  border: 'none',
                  borderRadius: '8px',
                  width: '28px',
                  height: '28px',
                  cursor: 'pointer',
                  color: '#64748B',
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>
                  Geofence Name *
                </label>
                <input
                  type="text"
                  value={geofenceForm.name}
                  onChange={(e) => setGeofenceForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Warehouse, Customer Yard, Stop Location"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    color: '#0F172A',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Coordinates & Address Preview */}
              <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '10px', border: '1px solid #F1F5F9' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={12} color="#EA580C" /> Location
                </div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#1E293B', marginTop: '4px', lineHeight: 1.4 }}>
                  {geofenceForm.address || (geofenceForm.lat ? `${Number(geofenceForm.lat).toFixed(4)}, ${Number(geofenceForm.lng).toFixed(4)}` : 'Location selected')}
                </div>
              </div>

              {/* Radius Options */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '8px' }}>
                  Geofence Radius
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[50, 100, 200, 300, 500, 1000].map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setGeofenceForm(prev => ({ ...prev, radius: r }))}
                      style={{
                        padding: '8px 0',
                        borderRadius: '8px',
                        border: geofenceForm.radius === r ? '2px solid #2563EB' : '1px solid #E2E8F0',
                        background: geofenceForm.radius === r ? '#EFF6FF' : '#FFFFFF',
                        color: geofenceForm.radius === r ? '#2563EB' : '#475569',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {r >= 1000 ? `${r / 1000} km` : `${r} m`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Alert Options Checkboxes */}
              <div style={{ display: 'flex', gap: '20px', paddingTop: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: '#1E293B', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={geofenceForm.alert_on_enter}
                    onChange={(e) => setGeofenceForm(prev => ({ ...prev, alert_on_enter: e.target.checked }))}
                    style={{ width: '16px', height: '16px', accentColor: '#2563EB' }}
                  />
                  <span>Entry alert</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: '#1E293B', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={geofenceForm.alert_on_exit}
                    onChange={(e) => setGeofenceForm(prev => ({ ...prev, alert_on_exit: e.target.checked }))}
                    style={{ width: '16px', height: '16px', accentColor: '#2563EB' }}
                  />
                  <span>Exit alert</span>
                </label>
              </div>

              {/* Optional: Apply to other vehicles of same user */}
              {vehicles.filter(v => v.id !== selectedVehicleId).length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                      Also apply to other vehicles (optional)
                    </label>
                    {geofenceForm.additionalVehicleIds?.length > 0 && (
                      <span style={{ fontSize: '11px', color: '#2563EB', fontWeight: 700 }}>
                        {geofenceForm.additionalVehicleIds.length} other vehicle(s) selected
                      </span>
                    )}
                  </div>
                  <div style={{
                    maxHeight: '120px',
                    overflowY: 'auto',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '6px 8px',
                    background: '#F8FAFC',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}>
                    {vehicles.filter(v => v.id !== selectedVehicleId).map(v => {
                      const isChecked = geofenceForm.additionalVehicleIds?.includes(v.id);
                      return (
                        <label
                          key={v.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '5px 8px',
                            borderRadius: '6px',
                            background: isChecked ? '#EFF6FF' : '#FFFFFF',
                            border: isChecked ? '1px solid #BFDBFE' : '1px solid #F1F5F9',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked || false}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setGeofenceForm(prev => {
                                const current = prev.additionalVehicleIds || [];
                                return {
                                  ...prev,
                                  additionalVehicleIds: checked
                                    ? [...current, v.id]
                                    : current.filter(id => id !== v.id),
                                };
                              });
                            }}
                            style={{ accentColor: '#2563EB' }}
                          />
                          <span style={{ fontWeight: 700, color: '#0F172A' }}>{v.plate || v.name}</span>
                          <span style={{ fontSize: '11px', color: '#64748B' }}>({v.model || v.vehicle_type || 'Vehicle'})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #F1F5F9',
              background: '#F8FAFC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
            }}>
              <button
                onClick={() => setGeofenceModalOpen(false)}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGeofence}
                disabled={savingGeofence}
                style={{
                  padding: '9px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#2563EB',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: savingGeofence ? 'not-allowed' : 'pointer',
                  opacity: savingGeofence ? 0.7 : 1,
                }}
              >
                {savingGeofence ? 'Saving...' : 'Save Geofence'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign Geofence to Other Vehicles Modal ── */}
      {assignModalOpen && assigningGeofence && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid #F1F5F9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#FFFFFF',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: '#EFF6FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Share2 size={18} color="#2563EB" />
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                    Apply Geofence to Vehicles
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>
                    Geofence: <strong style={{ color: '#2563EB' }}>{assigningGeofence.name}</strong> ({assigningGeofence.radius || 300}m radius)
                  </div>
                </div>
              </div>
              <button
                onClick={() => setAssignModalOpen(false)}
                style={{
                  background: '#F1F5F9',
                  border: 'none',
                  borderRadius: '8px',
                  width: '28px',
                  height: '28px',
                  cursor: 'pointer',
                  color: '#64748B',
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                  Select which vehicles should use this geofence:
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setTargetVehicleIds(vehicles.map(v => v.id))}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563EB',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Select All
                  </button>
                  <span style={{ color: '#CBD5E1' }}>|</span>
                  <button
                    type="button"
                    onClick={() => setTargetVehicleIds([selectedVehicleId])}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748B',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Only Current
                  </button>
                </div>
              </div>

              {/* Vehicle Checklist */}
              <div style={{
                maxHeight: '260px',
                overflowY: 'auto',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                padding: '8px',
                background: '#F8FAFC',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}>
                {vehicles.map(v => {
                  const isChecked = targetVehicleIds.includes(v.id);
                  const isCurrent = v.id === selectedVehicleId;
                  const isMoving = Number(v.current_speed || v.speed || 0) > 2;

                  return (
                    <label
                      key={v.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: isChecked ? '#EFF6FF' : '#FFFFFF',
                        border: isChecked ? '1.5px solid #3B82F6' : '1px solid #E2E8F0',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setTargetVehicleIds(prev =>
                              checked ? [...prev, v.id] : prev.filter(id => id !== v.id)
                            );
                          }}
                          style={{ width: '16px', height: '16px', accentColor: '#2563EB' }}
                        />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
                              {v.plate || v.name}
                            </span>
                            {isCurrent && (
                              <span style={{
                                background: '#DBEAFE',
                                color: '#1E40AF',
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: '1px 6px',
                                borderRadius: '4px',
                              }}>
                                Current
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>
                            {v.model || v.vehicle_type || 'Vehicle'} • IMEI: {v.imei || v.device_id || 'N/A'}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          background: isMoving ? '#10B981' : '#94A3B8',
                        }} />
                        <span style={{ fontSize: '11px', fontWeight: 600, color: isMoving ? '#10B981' : '#64748B' }}>
                          {isMoving ? 'Moving' : 'Parked'}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div style={{
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '11px',
                color: '#166534',
                lineHeight: 1.4,
              }}>
                ✓ <strong>Multi-Vehicle Geofencing:</strong> This geofence will be linked across all selected vehicles. All entry/exit alerts and reports will monitor each assigned vehicle automatically.
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #F1F5F9',
              background: '#F8FAFC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B' }}>
                {targetVehicleIds.length} vehicle(s) selected
              </span>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#475569',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAssignment}
                  disabled={savingAssignment}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#2563EB',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: savingAssignment ? 'not-allowed' : 'pointer',
                    opacity: savingAssignment ? 0.7 : 1,
                  }}
                >
                  {savingAssignment ? 'Saving...' : `Apply to Selected (${targetVehicleIds.length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Existing Geofence to Current Vehicle Modal ── */}
      {importModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '540px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid #F1F5F9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#FFFFFF',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: '#EFF6FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Layers size={18} color="#2563EB" />
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                    Add Existing Geofence
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>
                    Target Vehicle: <strong style={{ color: '#2563EB' }}>{selectedVehicle?.plate || selectedVehicle?.name}</strong>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setImportModalOpen(false)}
                style={{
                  background: '#F1F5F9',
                  border: 'none',
                  borderRadius: '8px',
                  width: '28px',
                  height: '28px',
                  cursor: 'pointer',
                  color: '#64748B',
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '420px', overflowY: 'auto' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>
                Select any geofence previously created across your fleet to instantly attach it to <strong>{selectedVehicle?.plate || selectedVehicle?.name}</strong>:
              </div>

              {loadingAvailable ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px', display: 'block' }} />
                  Loading available geofences...
                </div>
              ) : availableGeofences.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', background: '#F8FAFC', borderRadius: '12px', color: '#94A3B8', fontSize: '13px' }}>
                  No geofences found in your account yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {availableGeofences.map(g => {
                    const isAlreadyOnVehicle = g.is_assigned_to_vehicle;
                    const isLinking = linkingGeofenceId === g.id;

                    return (
                      <div
                        key={g.id}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '12px',
                          border: isAlreadyOnVehicle ? '1px solid #E2E8F0' : '1px solid #CBD5E1',
                          background: isAlreadyOnVehicle ? '#F8FAFC' : '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{g.name}</span>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B' }}>
                              ({g.radius || 300}m radius)
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                            Created {getRelativeTime(g.created_at)}
                            {g.alert_on_enter !== false && ' • Entry alert'}
                            {g.alert_on_exit !== false && ' • Exit alert'}
                          </div>
                        </div>

                        <div>
                          {isAlreadyOnVehicle ? (
                            <span style={{
                              background: '#DCFCE7',
                              color: '#15803D',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}>
                              ✓ Attached
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleLinkExistingGeofence(g.id)}
                              disabled={isLinking}
                              style={{
                                background: '#2563EB',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '6px 12px',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: isLinking ? 'not-allowed' : 'pointer',
                                opacity: isLinking ? 0.7 : 1,
                              }}
                            >
                              {isLinking ? 'Attaching...' : '+ Attach'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #F1F5F9',
              background: '#F8FAFC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
            }}>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
