import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, Circle, Marker, Tooltip, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  Truck, Route as RouteIcon, MapPin, Clock, Gauge, Navigation,
  ChevronRight, Plus, Trash2, RefreshCw, AlertCircle, CheckCircle,
  Share2, ArrowLeft, Fuel, Activity, Radio, Shield, Layers, ZoomIn, ZoomOut, Maximize2
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

export default function TripManagerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlVehicleId = searchParams.get('vehicleId');

  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState(urlVehicleId || '');
  const [activeTab, setActiveTab] = useState('trip'); // 'trip' or 'geofences'
  const [mapLayer, setMapLayer] = useState('google'); // 'google', 'satellite', 'osm'

  // Date selection: today by default
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });

  const [loading, setLoading] = useState(false);
  const [tripLegs, setTripLegs] = useState([]);
  const [stoppages, setStoppages] = useState([]);
  const [routeHistory, setRouteHistory] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [addresses, setAddresses] = useState({}); // key: lat,lng -> address
  const [focusedCoord, setFocusedCoord] = useState(null);

  // Set Geofence Modal state
  const [geofenceModalOpen, setGeofenceModalOpen] = useState(false);
  const [geofenceForm, setGeofenceForm] = useState({
    name: '',
    lat: null,
    lng: null,
    radius: 300,
    alert_on_enter: true,
    alert_on_exit: true,
  });
  const [savingGeofence, setSavingGeofence] = useState(false);

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

    const start = new Date(`${selectedDate}T00:00:00.000Z`).toISOString();
    const end = new Date(`${selectedDate}T23:59:59.999Z`).toISOString();

    try {
      const [legsRes, stopsRes, routeRes] = await Promise.all([
        axiosInstance.get(`/api/reports/trip?vehicleId=${selectedVehicleId}&startDate=${start}&endDate=${end}`).catch(() => ({ data: { data: [] } })),
        axiosInstance.get(`/api/reports/stoppages?vehicleId=${selectedVehicleId}&startDate=${start}&endDate=${end}`).catch(() => ({ data: { data: [] } })),
        axiosInstance.get(`/api/reports/route-history?vehicleId=${selectedVehicleId}&startDate=${start}&endDate=${end}`).catch(() => ({ data: { data: [] } })),
      ]);

      const legs = Array.isArray(legsRes.data?.data) ? legsRes.data.data : [];
      const stops = Array.isArray(stopsRes.data?.data) ? stopsRes.data.data : [];
      const route = Array.isArray(routeRes.data?.data) ? routeRes.data.data : [];

      setTripLegs(legs);
      setStoppages(stops);
      setRouteHistory(route);

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

  useEffect(() => {
    if (selectedVehicleId) {
      loadTripData();
      loadGeofences();
    }
  }, [selectedVehicleId, selectedDate]);

  // Interleave stoppages and driving legs chronologically
  const timelineEvents = useMemo(() => {
    const events = [];

    let stopCounter = 1;
    stoppages.forEach(s => {
      // Only include actual stops / parkings (duration >= 60s and not Moving)
      if (s.duration_seconds >= 60 && s.status !== 'Moving') {
        events.push({
          type: 'stop',
          index: stopCounter++,
          data: s,
          time: new Date(s.start_time).getTime(),
        });
      }
    });

    tripLegs.forEach(l => {
      events.push({
        type: 'driving',
        data: l,
        time: new Date(l.start_time).getTime(),
      });
    });

    events.sort((a, b) => a.time - b.time);
    return events;
  }, [stoppages, tripLegs]);

  // Calculate Trip Summary
  const tripSummary = useMemo(() => {
    let totalDistKm = 0;
    let totalDrivingSec = 0;
    let totalStopSec = 0;
    let stopCount = 0;

    tripLegs.forEach(l => {
      totalDistKm += (parseFloat(l.distance) || 0);
      totalDrivingSec += (parseFloat(l.duration_seconds) || 0);
    });

    stoppages.forEach(s => {
      if (s.duration_seconds >= 60 && s.status !== 'Moving') {
        stopCount++;
        totalStopSec += (parseFloat(s.duration_seconds) || 0);
      }
    });

    return {
      travelledKm: totalDistKm.toFixed(2),
      drivingDuration: formatDurationHms(totalDrivingSec),
      stopCount: stopCount,
      stopDuration: formatDurationHms(totalStopSec),
      lowNetworkTime: '0 Time',
    };
  }, [tripLegs, stoppages]);

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
      const payload = {
        name: geofenceForm.name.trim(),
        type: 'circle',
        center_lat: geofenceForm.lat,
        center_lng: geofenceForm.lng,
        radius: parseInt(geofenceForm.radius, 10) || 300,
        is_active: true,
        alert_on_enter: geofenceForm.alert_on_enter,
        alert_on_exit: geofenceForm.alert_on_exit,
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
                background: '#F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#1E293B',
              }}>
                <RouteIcon size={18} color="#2563EB" />
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
                onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: selectedDate === new Date().toISOString().slice(0, 10) ? '#2563EB' : '#F1F5F9',
                  color: selectedDate === new Date().toISOString().slice(0, 10) ? '#FFFFFF' : '#475569',
                }}
              >
                Today
              </button>
              <button
                onClick={() => {
                  const y = new Date();
                  y.setDate(y.getDate() - 1);
                  setSelectedDate(y.toISOString().slice(0, 10));
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: selectedDate !== new Date().toISOString().slice(0, 10) ? '#2563EB' : '#F1F5F9',
                  color: selectedDate !== new Date().toISOString().slice(0, 10) ? '#FFFFFF' : '#475569',
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
                color: activeTab === 'trip' ? '#2563EB' : '#64748B',
                borderBottom: activeTab === 'trip' ? '2px solid #2563EB' : '2px solid transparent',
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
                  background: activeTab === 'trip' ? '#EFF6FF' : '#F1F5F9',
                  color: activeTab === 'trip' ? '#2563EB' : '#64748B',
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
                color: activeTab === 'geofences' ? '#2563EB' : '#64748B',
                borderBottom: activeTab === 'geofences' ? '2px solid #2563EB' : '2px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <span>Vehicle Geofences</span>
              <span style={{
                padding: '1px 6px',
                borderRadius: '10px',
                background: activeTab === 'geofences' ? '#EFF6FF' : '#F1F5F9',
                color: activeTab === 'geofences' ? '#2563EB' : '#64748B',
                fontSize: '10px',
                fontWeight: 800,
              }}>
                {geofences.length}
              </span>
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
                    onClick={() => {
                      setGeofenceForm({
                        name: '',
                        lat: selectedVehicle?.lat || 17.385,
                        lng: selectedVehicle?.lng || 78.4867,
                        radius: 300,
                        alert_on_enter: true,
                        alert_on_exit: true,
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
                geofences.map(g => (
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
                    </div>

                    {/* Footer Row: Created relative time + Delete */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
                      <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>
                        Created {getRelativeTime(g.created_at)}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGeofence(g.id);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#DC2626',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Trash2 size={13} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))
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
          {routeHistory.length > 1 && (
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

          {/* Stop Pins on Map */}
          {stoppages.filter(s => s.status !== 'Moving' && s.duration_seconds >= 60).map((s, idx) => {
            if (!s.lat || !s.lng) return null;
            return (
              <Marker
                key={`map-stop-${idx}`}
                position={[parseFloat(s.lat), parseFloat(s.lng)]}
                icon={createStopIcon(idx + 1)}
              >
                <Popup>
                  <div style={{ padding: '4px', minWidth: '180px' }}>
                    <div style={{ fontWeight: 800, color: '#D97706', fontSize: '13px' }}>
                      Stop {idx + 1}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                      Duration: {formatDurationHms(s.duration_seconds)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#1E293B', marginTop: '4px' }}>
                      {addresses[`${parseFloat(s.lat).toFixed(4)},${parseFloat(s.lng).toFixed(4)}`] || 'Location pin'}
                    </div>
                    <button
                      onClick={() => handleOpenSetGeofence({ ...s, index: idx + 1 })}
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
              background: mapLayer === 'google' ? '#2563EB' : 'transparent',
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
              background: mapLayer === 'satellite' ? '#2563EB' : 'transparent',
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
              background: mapLayer === 'osm' ? '#2563EB' : 'transparent',
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

    </div>
  );
}
