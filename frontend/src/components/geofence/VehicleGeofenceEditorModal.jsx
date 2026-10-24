import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Shield, Search, Navigation, ArrowRight, Repeat, ArrowLeftRight,
  ChevronDown, ChevronUp, Truck, Smartphone, AlertCircle, MapPin
} from 'lucide-react';
import { MapContainer, TileLayer, Circle, Polygon, Polyline, Marker, useMapEvents, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  normalizeCoordinates,
  calculatePolygonAreaM2,
  calculateCircleAreaM2,
  calculateHaversineDistanceMeters,
  formatRadius,
  formatArea,
  getPolygonCentroid,
  GEOFENCE_COLOR_PALETTE
} from '../../utils/geofenceUtils';

// Helper to create numbered Leaflet DivIcon for polygon vertices
const createVertexIcon = (number, color) => {
  return L.divIcon({
    className: 'custom-vertex-marker',
    html: `
      <div style="
        width: 22px;
        height: 22px;
        background: ${color};
        color: #ffffff;
        border: 2px solid #ffffff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 800;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: pointer;
      ">${number}</div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
};

// Helper to parse coordinates from raw text, strings, or Google Maps URLs
export const parseCoordinatesInput = (str) => {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  const gmapsMatch = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (gmapsMatch) {
    const lat = parseFloat(gmapsMatch[1]);
    const lng = parseFloat(gmapsMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  const match = trimmed.match(/(-?\d{1,3}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)/);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }
  return null;
};

// Sleek, compact Google-Maps style teardrop pin for Location A & B (NO wide colliding text)
const createSleekPin = (letter, color, isActive) => {
  return L.divIcon({
    className: 'sleek-pin-marker',
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 42px;
        cursor: pointer;
        filter: drop-shadow(0 4px 8px rgba(0,0,0,0.35));
        transition: transform 0.2s ease;
        ${isActive ? 'transform: scale(1.15);' : ''}
      ">
        <svg width="34" height="42" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 0C7.61116 0 0 7.61116 0 17C0 27.5 17 42 17 42C17 42 34 27.5 34 17C34 7.61116 26.3888 0 17 0Z" fill="${color}" stroke="#FFFFFF" stroke-width="2.5"/>
          <circle cx="17" cy="17" r="11" fill="#FFFFFF"/>
        </svg>
        <span style="
          position: absolute;
          top: 8px;
          color: ${color};
          font-size: 13px;
          font-weight: 900;
          font-family: system-ui, sans-serif;
        ">${letter}</span>
      </div>
    `,
    iconSize: [34, 42],
    iconAnchor: [17, 42],
    tooltipAnchor: [0, -42],
  });
};

const MapClickInterceptor = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    },
  });
  return null;
};

const MapController = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center && center.lat && center.lng) {
      map.flyTo([center.lat, center.lng], map.getZoom(), { animate: true, duration: 0.5 });
    }
  }, [center, map]);
  return null;
};

const ResizeMapOnMount = () => {
  const map = useMap();
  useEffect(() => {
    const invalidate = () => {
      try {
        map.invalidateSize();
      } catch (_) {}
    };
    invalidate();
    const t1 = setTimeout(invalidate, 100);
    const t2 = setTimeout(invalidate, 300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [map]);
  return null;
};

const VehicleGeofenceEditorModal = ({
  isOpen,
  onClose,
  vehicle,
  geofenceToEdit = null,
  onSave
}) => {
  if (!isOpen) return null;

  // Default coordinate: vehicle location or Hyderabad center
  const defaultLat = geofenceToEdit?.center_lat || vehicle?.lat || 17.385044;
  const defaultLng = geofenceToEdit?.center_lng || vehicle?.lng || 78.486671;

  // Editor mode: 'pair' (From -> To trip) | 'single' (1 Place)
  const [editorMode, setEditorMode] = useState(geofenceToEdit ? 'single' : 'pair');
  const [transitDirection, setTransitDirection] = useState('single_way'); // 'single_way' | 'two_way'
  const [activeTarget, setActiveTarget] = useState('A'); // 'A' (Start) or 'B' (End)
  const [showAdvancedCoords, setShowAdvancedCoords] = useState(false);

  // --- Location A (Start / Origin) ---
  const [nameA, setNameA] = useState(vehicle?.name ? `${vehicle.name} - Start` : 'Start Depot');
  const [centerLatA, setCenterLatA] = useState(String(defaultLat));
  const [centerLngA, setCenterLngA] = useState(String(defaultLng));
  const [radiusA, setRadiusA] = useState(250);
  const colorA = '#10B981'; // Vibrant Emerald Green

  // --- Location B (End / Destination) ---
  // Default offset: ~2 km away
  const [nameB, setNameB] = useState(vehicle?.name ? `${vehicle.name} - Delivery` : 'Delivery Point');
  const [centerLatB, setCenterLatB] = useState(String((Number(defaultLat) + 0.016).toFixed(6)));
  const [centerLngB, setCenterLngB] = useState(String((Number(defaultLng) + 0.016).toFixed(6)));
  const [radiusB, setRadiusB] = useState(250);
  const colorB = '#EF4444'; // Clean Crimson Red

  // --- Single Geofence State ---
  const [shape, setShape] = useState(geofenceToEdit?.type || 'circle');
  const [name, setName] = useState(geofenceToEdit?.name || (vehicle?.name ? `${vehicle.name} - Safe Zone` : 'Office / Depot'));
  const [color, setColor] = useState(geofenceToEdit?.color || '#3B82F6');
  const [centerLat, setCenterLat] = useState(String(defaultLat));
  const [centerLng, setCenterLng] = useState(String(defaultLng));
  const [radius, setRadius] = useState(Number(geofenceToEdit?.radius) || 250);
  const [polygonPoints, setPolygonPoints] = useState(() => {
    if (geofenceToEdit?.type === 'polygon' && geofenceToEdit?.coordinates) {
      return normalizeCoordinates(geofenceToEdit.coordinates);
    }
    return [];
  });

  // Alerts
  const [alertOnEnter, setAlertOnEnter] = useState(geofenceToEdit?.alert_on_enter !== false);
  const [alertOnExit, setAlertOnExit] = useState(geofenceToEdit?.alert_on_exit !== false);

  // Map view & search
  const [mapCenter, setMapCenter] = useState({ lat: Number(defaultLat), lng: Number(defaultLng) });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debounced search with instant GPS coordinates detection
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }

    // 1. Instant raw GPS coordinates check (e.g. "17.385044, 78.486671" or Google Maps link)
    const parsedCoords = parseCoordinatesInput(trimmed);
    if (parsedCoords) {
      setSearchResults([
        {
          is_coordinates: true,
          lat: String(parsedCoords.lat),
          lon: String(parsedCoords.lng),
          display_name: `Exact Coordinates (${parsedCoords.lat.toFixed(6)}, ${parsedCoords.lng.toFixed(6)})`,
        },
      ]);
      return;
    }

    // 2. Place name search (Nominatim OpenStreetMap)
    const timer = setTimeout(async () => {
      if (trimmed.length > 2) {
        setIsSearching(true);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
              trimmed
            )}&limit=5&countrycodes=in`
          );
          const data = await res.json();
          setSearchResults(data || []);
        } catch (_) {
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectAddress = (item) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon || item.lng);
    if (!isNaN(lat) && !isNaN(lng)) {
      setMapCenter({ lat, lng });
      if (editorMode === 'pair') {
        if (activeTarget === 'A') {
          setCenterLatA(lat.toFixed(6));
          setCenterLngA(lng.toFixed(6));
        } else {
          setCenterLatB(lat.toFixed(6));
          setCenterLngB(lng.toFixed(6));
        }
      } else {
        if (shape === 'circle') {
          setCenterLat(lat.toFixed(6));
          setCenterLng(lng.toFixed(6));
        } else {
          setPolygonPoints((prev) => [...prev, { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) }]);
        }
      }
    }
    setSearchQuery(item.is_coordinates ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : item.display_name.split(',')[0]);
    setSearchResults([]);
  };

  // Live coordinate manual change with instant map synchronization
  const handleCoordinateChange = (field, value, target = activeTarget) => {
    if (editorMode === 'pair') {
      if (target === 'A') {
        if (field === 'lat') setCenterLatA(value);
        if (field === 'lng') setCenterLngA(value);
        const pLat = field === 'lat' ? parseFloat(value) : parseFloat(centerLatA);
        const pLng = field === 'lng' ? parseFloat(value) : parseFloat(centerLngA);
        if (!isNaN(pLat) && !isNaN(pLng) && pLat >= -90 && pLat <= 90 && pLng >= -180 && pLng <= 180) {
          setMapCenter({ lat: pLat, lng: pLng });
        }
      } else {
        if (field === 'lat') setCenterLatB(value);
        if (field === 'lng') setCenterLngB(value);
        const pLat = field === 'lat' ? parseFloat(value) : parseFloat(centerLatB);
        const pLng = field === 'lng' ? parseFloat(value) : parseFloat(centerLngB);
        if (!isNaN(pLat) && !isNaN(pLng) && pLat >= -90 && pLat <= 90 && pLng >= -180 && pLng <= 180) {
          setMapCenter({ lat: pLat, lng: pLng });
        }
      }
    } else {
      if (field === 'lat') setCenterLat(value);
      if (field === 'lng') setCenterLng(value);
      const pLat = field === 'lat' ? parseFloat(value) : parseFloat(centerLat);
      const pLng = field === 'lng' ? parseFloat(value) : parseFloat(centerLng);
      if (!isNaN(pLat) && !isNaN(pLng) && pLat >= -90 && pLat <= 90 && pLng >= -180 && pLng <= 180) {
        setMapCenter({ lat: pLat, lng: pLng });
      }
    }
  };

  // Place at Vehicle's current location
  const handleUseVehicleLocation = () => {
    if (!vehicle?.lat || !vehicle?.lng) {
      setFormError('Vehicle location is currently not available.');
      return;
    }
    const lat = Number(vehicle.lat);
    const lng = Number(vehicle.lng);
    setMapCenter({ lat, lng });

    if (editorMode === 'pair') {
      if (activeTarget === 'A') {
        setCenterLatA(lat.toFixed(6));
        setCenterLngA(lng.toFixed(6));
      } else {
        setCenterLatB(lat.toFixed(6));
        setCenterLngB(lng.toFixed(6));
      }
    } else {
      setCenterLat(lat.toFixed(6));
      setCenterLng(lng.toFixed(6));
    }
    setFormError('');
  };

  // Place at user's phone / device location
  const handleUseMyCurrentLocation = () => {
    if (!navigator.geolocation) {
      setFormError('Location not supported on this phone/browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setMapCenter({ lat, lng });

        if (editorMode === 'pair') {
          if (activeTarget === 'A') {
            setCenterLatA(String(lat));
            setCenterLngA(String(lng));
          } else {
            setCenterLatB(String(lat));
            setCenterLngB(String(lng));
          }
        } else {
          setCenterLat(String(lat));
          setCenterLng(String(lng));
        }
        setFormError('');
      },
      (err) => {
        setFormError(`Could not find location: ${err.message}. Please allow location access.`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Tap anywhere on the map
  const handleMapClick = (latlng) => {
    const lat = Number(latlng.lat.toFixed(6));
    const lng = Number(latlng.lng.toFixed(6));

    if (editorMode === 'pair') {
      if (activeTarget === 'A') {
        setCenterLatA(String(lat));
        setCenterLngA(String(lng));
      } else {
        setCenterLatB(String(lat));
        setCenterLngB(String(lng));
      }
    } else {
      if (shape === 'circle') {
        setCenterLat(String(lat));
        setCenterLng(String(lng));
      } else {
        setPolygonPoints((prev) => [...prev, { lat, lng }]);
      }
    }
    setFormError('');
  };

  const handleSwapAB = () => {
    const tempName = nameA;
    const tempLat = centerLatA;
    const tempLng = centerLngA;
    const tempRad = radiusA;

    setNameA(nameB);
    setCenterLatA(centerLatB);
    setCenterLngA(centerLngB);
    setRadiusA(radiusB);

    setNameB(tempName);
    setCenterLatB(tempLat);
    setCenterLngB(tempLng);
    setRadiusB(tempRad);
  };

  const parsedLatA = parseFloat(centerLatA) || defaultLat;
  const parsedLngA = parseFloat(centerLngA) || defaultLng;
  const parsedLatB = parseFloat(centerLatB) || (Number(defaultLat) + 0.016);
  const parsedLngB = parseFloat(centerLngB) || (Number(defaultLng) + 0.016);

  const corridorDistance = useMemo(() => {
    return calculateHaversineDistanceMeters(parsedLatA, parsedLngA, parsedLatB, parsedLngB);
  }, [parsedLatA, parsedLngA, parsedLatB, parsedLngB]);

  const midpointAB = useMemo(() => {
    return [(parsedLatA + parsedLatB) / 2, (parsedLngA + parsedLngB) / 2];
  }, [parsedLatA, parsedLngA, parsedLatB, parsedLngB]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (editorMode === 'pair') {
      if (!nameA.trim() || !nameB.trim()) {
        setFormError('Please give names for both Start Location and End Location.');
        return;
      }

      setIsSubmitting(true);
      try {
        await onSave({
          isPair: true,
          transitDirection,
          fromGeofence: {
            name: nameA.trim(),
            type: 'circle',
            center_lat: parsedLatA,
            center_lng: parsedLngA,
            radius: Number(radiusA),
            coordinates: [{ lat: parsedLatA, lng: parsedLngA }],
            color: colorA,
            alert_on_enter: alertOnEnter,
            alert_on_exit: alertOnExit,
            is_active: true,
          },
          toGeofence: {
            name: nameB.trim(),
            type: 'circle',
            center_lat: parsedLatB,
            center_lng: parsedLngB,
            radius: Number(radiusB),
            coordinates: [{ lat: parsedLatB, lng: parsedLngB }],
            color: colorB,
            alert_on_enter: alertOnEnter,
            alert_on_exit: alertOnExit,
            is_active: true,
          },
        });
        onClose();
      } catch (err) {
        setFormError(err.message || 'Failed to save geofence pair.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Single mode
    if (!name.trim()) {
      setFormError('Please enter a name for this geofence.');
      return;
    }

    if (shape === 'polygon' && polygonPoints.length < 3) {
      setFormError('A polygon geofence requires at least 3 boundary points. Click on the map to add points.');
      return;
    }

    const cLat = parseFloat(centerLat) || defaultLat;
    const cLng = parseFloat(centerLng) || defaultLng;
    const centroid = shape === 'polygon' ? getPolygonCentroid(polygonPoints) : { lat: cLat, lng: cLng };

    setIsSubmitting(true);
    try {
      await onSave({
        id: geofenceToEdit?.id,
        name: name.trim(),
        type: shape,
        center_lat: centroid.lat,
        center_lng: centroid.lng,
        radius: shape === 'circle' ? Number(radius) : null,
        coordinates: shape === 'circle' ? [{ lat: cLat, lng: cLng }] : polygonPoints,
        color,
        alert_on_enter: alertOnEnter,
        alert_on_exit: alertOnExit,
        is_active: geofenceToEdit?.is_active !== undefined ? geofenceToEdit.is_active : true,
      });
      onClose();
    } catch (err) {
      setFormError(err.message || 'Failed to save geofence.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100050,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '1160px',
          height: 'min(92vh, 800px)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Top Header */}
        <div
          style={{
            flexShrink: 0,
            padding: '14px 24px',
            background: '#0F172A',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #1E293B',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)',
              }}
            >
              <Shield size={22} color="#FFFFFF" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                  {geofenceToEdit ? 'Edit Geofence' : 'Vehicle Geofence Setup'}
                </h2>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '3px 9px',
                    borderRadius: '20px',
                    background: editorMode === 'pair' ? '#0284C730' : '#10B98130',
                    color: editorMode === 'pair' ? '#38BDF8' : '#34D399',
                    border: `1px solid ${editorMode === 'pair' ? '#0284C760' : '#10B98160'}`,
                  }}
                >
                  {editorMode === 'pair' ? '2 Places Trip' : 'Single Zone'}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Vehicle:</span>
                <span style={{ color: '#F8FAFC', fontWeight: 700 }}>
                  {vehicle?.name || vehicle?.plate || 'Active Vehicle'}
                </span>
                <span>({vehicle?.plate || '—'})</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: '#1E293B',
              border: '1px solid #334155',
              color: '#94A3B8',
              borderRadius: '10px',
              padding: '7px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {formError && (
            <div
              style={{
                flexShrink: 0,
                margin: '10px 16px 0 16px',
                padding: '10px 14px',
                borderRadius: '10px',
                background: '#FEF2F2',
                border: '1px solid #FCA5A5',
                color: '#DC2626',
                fontSize: '13px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={18} className="shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '410px 1fr',
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            {/* Left Controls: Seamless, Non-Overlapping Route Card */}
            <div
              style={{
                height: '100%',
                minHeight: 0,
                padding: '16px 18px',
                borderRight: '1px solid #E2E8F0',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                background: '#F8FAFC',
                boxSizing: 'border-box',
              }}
            >
              {/* Type Switcher: Clean Pill Segment */}
              {!geofenceToEdit && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', background: '#E2E8F0', padding: '4px', borderRadius: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setEditorMode('pair')}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: editorMode === 'pair' ? 800 : 600,
                      background: editorMode === 'pair' ? '#0284C7' : 'transparent',
                      color: editorMode === 'pair' ? '#FFFFFF' : '#475569',
                      boxShadow: editorMode === 'pair' ? '0 2px 6px rgba(2,132,199,0.3)' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>🏁</span>
                    <span>2 Places (Trip)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode('single')}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: editorMode === 'single' ? 800 : 600,
                      background: editorMode === 'single' ? '#FFFFFF' : 'transparent',
                      color: editorMode === 'single' ? '#0F172A' : '#475569',
                      boxShadow: editorMode === 'single' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>📍</span>
                    <span>1 Place Only</span>
                  </button>
                </div>
              )}

              {/* DUAL LOCATIONS - UNIFIED ROUTE CARD (Uber / Google Maps style) */}
              {editorMode === 'pair' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Connected Route Timeline Card */}
                  <div
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '16px',
                      border: '1px solid #E2E8F0',
                      padding: '16px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    {/* START LOCATION (A) */}
                    <div
                      onClick={() => {
                        setActiveTarget('A');
                        setMapCenter({ lat: parsedLatA, lng: parsedLngA });
                      }}
                      style={{
                        padding: '12px',
                        borderRadius: '12px',
                        border: activeTarget === 'A' ? '2px solid #10B981' : '1px solid #E2E8F0',
                        background: activeTarget === 'A' ? '#F0FDF4' : '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#10B981', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '11px' }}>A</span>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>Start Location (From)</span>
                        </div>
                        {activeTarget === 'A' && (
                          <span style={{ fontSize: '10px', fontWeight: 800, background: '#10B981', color: '#FFF', padding: '2px 6px', borderRadius: '4px' }}>EDITING</span>
                        )}
                      </div>

                      <input
                        type="text"
                        value={nameA}
                        onChange={(e) => setNameA(e.target.value)}
                        placeholder="e.g. Warehouse, Depot Gate"
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: '1px solid #CBD5E1',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: '#0F172A',
                          boxSizing: 'border-box',
                          background: '#FFFFFF',
                          marginBottom: '8px',
                        }}
                      />

                      {/* Fence Size selection for A */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Fence Size:</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {[
                            { label: 'Small (100m)', r: 100 },
                            { label: 'Med (250m)', r: 250 },
                            { label: 'Big (1km)', r: 1000 },
                          ].map((opt) => (
                            <button
                              key={opt.r}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRadiusA(opt.r);
                              }}
                              style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                border: radiusA === opt.r ? '1.5px solid #10B981' : '1px solid #E2E8F0',
                                background: radiusA === opt.r ? '#ECFDF5' : '#FFFFFF',
                                color: radiusA === opt.r ? '#047857' : '#64748B',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Fast Snap for A */}
                      {activeTarget === 'A' && (
                        <div style={{ display: 'flex', gap: '6px', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #E2E8F0' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUseVehicleLocation();
                            }}
                            style={{
                              flex: 1,
                              padding: '5px 8px',
                              borderRadius: '6px',
                              border: '1px solid #BAE6FD',
                              background: '#F0F9FF',
                              color: '#0369A1',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                            }}
                          >
                            <Truck size={12} />
                            <span>At Truck GPS</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUseMyCurrentLocation();
                            }}
                            style={{
                              flex: 1,
                              padding: '5px 8px',
                              borderRadius: '6px',
                              border: '1px solid #A7F3D0',
                              background: '#ECFDF5',
                              color: '#065F46',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                            }}
                          >
                            <Smartphone size={12} />
                            <span>Where I Am</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* CONNECTING CORRIDOR / DISTANCE INDICATOR & SWAP BUTTON */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '13px' }}>🛣️</span>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A' }}>
                          Trip Distance: {formatRadius(corridorDistance)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setTransitDirection(transitDirection === 'single_way' ? 'two_way' : 'single_way')}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            background: '#F8FAFC',
                            color: '#334155',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {transitDirection === 'single_way' ? 'One-Way' : 'Round-Trip'}
                        </button>

                        <button
                          type="button"
                          onClick={handleSwapAB}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            background: '#F8FAFC',
                            color: '#0284C7',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                          title="Swap Start and End places"
                        >
                          <ArrowLeftRight size={11} />
                          <span>Swap</span>
                        </button>
                      </div>
                    </div>

                    {/* DESTINATION LOCATION (B) */}
                    <div
                      onClick={() => {
                        setActiveTarget('B');
                        setMapCenter({ lat: parsedLatB, lng: parsedLngB });
                      }}
                      style={{
                        padding: '12px',
                        borderRadius: '12px',
                        border: activeTarget === 'B' ? '2px solid #EF4444' : '1px solid #E2E8F0',
                        background: activeTarget === 'B' ? '#FEF2F2' : '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#EF4444', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '11px' }}>B</span>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: '#B91C1C', textTransform: 'uppercase' }}>End Destination (To)</span>
                        </div>
                        {activeTarget === 'B' && (
                          <span style={{ fontSize: '10px', fontWeight: 800, background: '#EF4444', color: '#FFF', padding: '2px 6px', borderRadius: '4px' }}>EDITING</span>
                        )}
                      </div>

                      <input
                        type="text"
                        value={nameB}
                        onChange={(e) => setNameB(e.target.value)}
                        placeholder="e.g. Client Site, Delivery Store"
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: '1px solid #CBD5E1',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: '#0F172A',
                          boxSizing: 'border-box',
                          background: '#FFFFFF',
                          marginBottom: '8px',
                        }}
                      />

                      {/* Fence Size selection for B */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Fence Size:</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {[
                            { label: 'Small (100m)', r: 100 },
                            { label: 'Med (250m)', r: 250 },
                            { label: 'Big (1km)', r: 1000 },
                          ].map((opt) => (
                            <button
                              key={opt.r}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRadiusB(opt.r);
                              }}
                              style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                border: radiusB === opt.r ? '1.5px solid #EF4444' : '1px solid #E2E8F0',
                                background: radiusB === opt.r ? '#FEF2F2' : '#FFFFFF',
                                color: radiusB === opt.r ? '#B91C1C' : '#64748B',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Hidden Collapsible GPS Coordinates (Zero Clutter) */}
                  <div style={{ padding: '0 4px' }}>
                    <button
                      type="button"
                      onClick={() => setShowAdvancedCoords(!showAdvancedCoords)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748B',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: 0,
                      }}
                    >
                      {showAdvancedCoords ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      <span>{showAdvancedCoords ? 'Hide Lat/Long Numbers' : '⚙️ Advanced Coordinates (Optional)'}</span>
                    </button>

                    {showAdvancedCoords && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '6px', background: '#FFFFFF', padding: '8px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <div>
                          <span style={{ fontSize: '10px', color: '#64748B' }}>Latitude</span>
                          <input
                            type="text"
                            value={activeTarget === 'A' ? centerLatA : centerLatB}
                            onChange={(e) => handleCoordinateChange('lat', e.target.value, activeTarget)}
                            placeholder="e.g. 17.385044"
                            style={{ width: '100%', padding: '4px 6px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '11px', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <span style={{ fontSize: '10px', color: '#64748B' }}>Longitude</span>
                          <input
                            type="text"
                            value={activeTarget === 'A' ? centerLngA : centerLngB}
                            onChange={(e) => handleCoordinateChange('lng', e.target.value, activeTarget)}
                            placeholder="e.g. 78.486671"
                            style={{ width: '100%', padding: '4px 6px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '11px', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* SINGLE GEOFENCE CLEAN CARD */
                <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Place Name:
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Hyderabad Depot, Main Yard"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#0F172A',
                        boxSizing: 'border-box',
                        background: '#FFFFFF',
                      }}
                      required
                    />
                  </div>

                  {/* Shape Selector: Circle vs Polygon */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Boundary Shape:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setShape('circle')}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: shape === 'circle' ? `2px solid ${color}` : '1px solid #CBD5E1',
                          background: shape === 'circle' ? '#F0F9FF' : '#FFFFFF',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          fontSize: '12px',
                          fontWeight: 800,
                          color: shape === 'circle' ? '#0369A1' : '#475569',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span>⭕ Circle (Radius)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShape('polygon')}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: shape === 'polygon' ? `2px solid ${color}` : '1px solid #CBD5E1',
                          background: shape === 'polygon' ? '#F0F9FF' : '#FFFFFF',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          fontSize: '12px',
                          fontWeight: 800,
                          color: shape === 'polygon' ? '#0369A1' : '#475569',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span>⬡ Custom Polygon</span>
                      </button>
                    </div>
                  </div>

                  {shape === 'polygon' ? (
                    /* POLYGON BOUNDARY CONTROLS */
                    <div style={{ background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase' }}>
                          Boundary Points:
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: polygonPoints.length >= 3 ? '#059669' : '#DC2626', background: '#FFFFFF', padding: '2px 8px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                          {polygonPoints.length} point{polygonPoints.length === 1 ? '' : 's'} {polygonPoints.length >= 3 ? '✅' : '(Need 3+)'}
                        </span>
                      </div>

                      <div style={{ fontSize: '11px', color: '#64748B', lineHeight: '1.4' }}>
                        💡 Click anywhere on the map to add boundary corners around your yard or facility.
                      </div>

                      {polygonPoints.length >= 3 && (
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369A1', background: '#E0F2FE', padding: '6px 10px', borderRadius: '6px' }}>
                          📐 Enclosed Area: <b>{formatArea(calculatePolygonAreaM2(polygonPoints))}</b>
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '4px' }}>
                        <button
                          type="button"
                          disabled={polygonPoints.length === 0}
                          onClick={() => setPolygonPoints(prev => prev.slice(0, -1))}
                          style={{
                            padding: '7px 8px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            background: '#FFFFFF',
                            color: '#475569',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: polygonPoints.length === 0 ? 'not-allowed' : 'pointer',
                            opacity: polygonPoints.length === 0 ? 0.5 : 1,
                          }}
                        >
                          ↩ Undo Point
                        </button>
                        <button
                          type="button"
                          disabled={polygonPoints.length === 0}
                          onClick={() => setPolygonPoints([])}
                          style={{
                            padding: '7px 8px',
                            borderRadius: '6px',
                            border: '1px solid #FCA5A5',
                            background: '#FEF2F2',
                            color: '#DC2626',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: polygonPoints.length === 0 ? 'not-allowed' : 'pointer',
                            opacity: polygonPoints.length === 0 ? 0.5 : 1,
                          }}
                        >
                          🗑️ Clear All
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* CIRCLE RADIUS CONTROLS */
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase' }}>
                          Size of Safe Area:
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: color, background: '#F1F5F9', padding: '2px 8px', borderRadius: '6px' }}>
                          {formatRadius(radius)}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                        {[
                          { label: 'Small', sub: '100m Gate', r: 100 },
                          { label: 'Medium', sub: '250m Yard', r: 250 },
                          { label: 'Large', sub: '1km Area', r: 1000 },
                        ].map((opt) => (
                          <button
                            key={opt.r}
                            type="button"
                            onClick={() => setRadius(opt.r)}
                            style={{
                              padding: '8px 4px',
                              borderRadius: '8px',
                              border: radius === opt.r ? `2px solid ${color}` : '1px solid #CBD5E1',
                              background: radius === opt.r ? '#F0F9FF' : '#FFFFFF',
                              cursor: 'pointer',
                              textAlign: 'center',
                            }}
                          >
                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A' }}>{opt.label}</div>
                            <div style={{ fontSize: '10px', color: '#64748B' }}>{opt.sub}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <span style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Fast Position:
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={handleUseVehicleLocation}
                        style={{
                          padding: '8px 6px',
                          borderRadius: '8px',
                          border: '1px solid #BAE6FD',
                          background: '#F0F9FF',
                          color: '#0369A1',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                        }}
                      >
                        <Truck size={14} />
                        <span>Truck Spot</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleUseMyCurrentLocation}
                        style={{
                          padding: '8px 6px',
                          borderRadius: '8px',
                          border: '1px solid #A7F3D0',
                          background: '#ECFDF5',
                          color: '#065F46',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                        }}
                      >
                        <Smartphone size={14} />
                        <span>Where I Am</span>
                      </button>
                    </div>
                  </div>

                  {/* Collapsible Lat/Lng for Single mode */}
                  <div style={{ paddingTop: '4px' }}>
                    <button
                      type="button"
                      onClick={() => setShowAdvancedCoords(!showAdvancedCoords)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748B',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: 0,
                      }}
                    >
                      {showAdvancedCoords ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      <span>{showAdvancedCoords ? 'Hide Lat/Long Numbers' : '⚙️ Advanced Coordinates (Optional)'}</span>
                    </button>

                    {showAdvancedCoords && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '6px', background: '#F8FAFC', padding: '8px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <div>
                          <span style={{ fontSize: '10px', color: '#64748B' }}>Latitude</span>
                          <input
                            type="text"
                            value={centerLat}
                            onChange={(e) => handleCoordinateChange('lat', e.target.value)}
                            placeholder="e.g. 17.385044"
                            style={{ width: '100%', padding: '4px 6px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '11px', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <span style={{ fontSize: '10px', color: '#64748B' }}>Longitude</span>
                          <input
                            type="text"
                            value={centerLng}
                            onChange={(e) => handleCoordinateChange('lng', e.target.value)}
                            placeholder="e.g. 78.486671"
                            style={{ width: '100%', padding: '4px 6px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '11px', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Alert Notification Switches */}
              <div style={{ background: '#FFFFFF', padding: '12px 14px', borderRadius: '12px', border: '1px solid #E2E8F0', marginTop: 'auto' }}>
                <span style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Alert Notifications:
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '12px', color: '#1E293B', fontWeight: 600 }}>
                    <span>🔔 Notify when vehicle ENTERS</span>
                    <input
                      type="checkbox"
                      checked={alertOnEnter}
                      onChange={(e) => setAlertOnEnter(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: '#10B981', cursor: 'pointer' }}
                    />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '12px', color: '#1E293B', fontWeight: 600 }}>
                    <span>🚨 Notify when vehicle LEAVES</span>
                    <input
                      type="checkbox"
                      checked={alertOnExit}
                      onChange={(e) => setAlertOnExit(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: '#EF4444', cursor: 'pointer' }}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Right Map Column */}
            <div
              style={{
                position: 'relative',
                height: '100%',
                minHeight: 0,
                flex: 1,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Floating Top Search Bar */}
              <div
                style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  right: '12px',
                  zIndex: 1000,
                  display: 'flex',
                  gap: '8px',
                }}
              >
                <div style={{ position: 'relative', flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: 'rgba(255,255,255,0.98)',
                      backdropFilter: 'blur(8px)',
                      borderRadius: '12px',
                      padding: '0 12px',
                      border: '1.5px solid #CBD5E1',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                      height: '42px',
                    }}
                  >
                    <Search size={16} color="#64748B" style={{ marginRight: '8px' }} />
                    <input
                      type="text"
                      placeholder={
                        editorMode === 'pair'
                          ? `Search place, city, or paste Lat, Lng for ${activeTarget === 'A' ? 'Start (A)' : 'Destination (B)'}...`
                          : "Search place, city, or paste Lat, Lng coordinates..."
                      }
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && searchResults.length > 0) {
                          e.preventDefault();
                          handleSelectAddress(searchResults[0]);
                        }
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        outline: 'none',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#0F172A',
                        width: '100%',
                      }}
                    />
                    {isSearching && <span style={{ fontSize: '11px', color: '#94A3B8' }}>Searching...</span>}
                  </div>

                  {searchResults.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '48px',
                        left: 0,
                        right: 0,
                        background: '#FFFFFF',
                        borderRadius: '12px',
                        border: '1px solid #CBD5E1',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        zIndex: 1001,
                      }}
                    >
                      {searchResults.map((r, i) => (
                        <div
                          key={i}
                          onClick={() => handleSelectAddress(r)}
                          style={{
                            padding: '10px 14px',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: r.is_coordinates ? '#047857' : '#1E293B',
                            background: r.is_coordinates ? '#F0FDF4' : '#FFFFFF',
                            cursor: 'pointer',
                            borderBottom: i < searchResults.length - 1 ? '1px solid #F1F5F9' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = r.is_coordinates ? '#DCFCE7' : '#F0F9FF')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = r.is_coordinates ? '#F0FDF4' : '#FFFFFF')}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>{r.is_coordinates ? '🎯' : '📍'}</span>
                            <span>{r.display_name}</span>
                          </div>
                          {r.is_coordinates && (
                            <span style={{ fontSize: '10px', fontWeight: 800, background: '#10B981', color: '#FFFFFF', padding: '2px 8px', borderRadius: '4px' }}>
                              EXACT GPS JUMP
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick Vehicle Center button */}
                {vehicle?.lat && (
                  <button
                    type="button"
                    onClick={handleUseVehicleLocation}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: '#0F172A',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '0 14px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
                      whiteSpace: 'nowrap',
                      height: '42px',
                    }}
                  >
                    <Truck size={14} color="#38BDF8" />
                    <span>See Vehicle</span>
                  </button>
                )}
              </div>

              {/* Single, Slim Non-Intrusive Map Hint Pill */}
              <div
                style={{
                  position: 'absolute',
                  top: '62px',
                  left: '12px',
                  zIndex: 999,
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(6px)',
                  color: '#FFFFFF',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  pointerEvents: 'none',
                }}
              >
                <span>👆</span>
                <span>
                  {editorMode === 'pair'
                    ? `Tap map to position: ${activeTarget === 'A' ? '🟢 Start (A)' : '🔴 Finish (B)'}`
                    : 'Tap map to position safe zone'}
                </span>
              </div>

              {/* Leaflet Map */}
              <MapContainer
                center={[Number(defaultLat), Number(defaultLng)]}
                zoom={14}
                style={{ width: '100%', height: '100%' }}
              >
                <ResizeMapOnMount />
                <MapController center={mapCenter} />
                <MapClickInterceptor onMapClick={handleMapClick} />

                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Vehicle Live Marker with BOTTOM tooltip so it NEVER collides with pin */}
                {vehicle?.lat && vehicle?.lng && (
                  <Marker
                    position={[Number(vehicle.lat), Number(vehicle.lng)]}
                    icon={L.divIcon({
                      className: 'vehicle-marker',
                      html: `
                        <div style="
                          width: 32px;
                          height: 32px;
                          background: #0284C7;
                          border: 2.5px solid #FFFFFF;
                          border-radius: 50%;
                          display: flex;
                          align-items: center;
                          justify-content: center;
                          box-shadow: 0 0 12px rgba(2, 132, 199, 0.7);
                          font-size: 15px;
                          cursor: pointer;
                        ">🚚</div>
                      `,
                      iconSize: [32, 32],
                      iconAnchor: [16, 16],
                    })}
                  >
                    <Tooltip permanent direction="bottom" offset={[0, 16]}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284C7' }}>
                        🚚 Vehicle (Live)
                      </span>
                    </Tooltip>
                  </Marker>
                )}

                {/* DUAL LOCATIONS MAP RENDER */}
                {editorMode === 'pair' ? (
                  <>
                    {/* Location A Marker & Circle */}
                    <Marker
                      position={[parsedLatA, parsedLngA]}
                      icon={createSleekPin('A', colorA, activeTarget === 'A')}
                      eventHandlers={{
                        click: () => setActiveTarget('A'),
                      }}
                    >
                      <Tooltip permanent direction="top" offset={[0, -42]}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#047857' }}>
                          🟢 Start: {nameA}
                        </span>
                      </Tooltip>
                    </Marker>
                    <Circle
                      center={[parsedLatA, parsedLngA]}
                      radius={radiusA}
                      pathOptions={{
                        color: colorA,
                        fillColor: colorA,
                        fillOpacity: activeTarget === 'A' ? 0.35 : 0.2,
                        weight: activeTarget === 'A' ? 3.5 : 2,
                      }}
                    />

                    {/* Location B Marker & Circle */}
                    <Marker
                      position={[parsedLatB, parsedLngB]}
                      icon={createSleekPin('B', colorB, activeTarget === 'B')}
                      eventHandlers={{
                        click: () => setActiveTarget('B'),
                      }}
                    >
                      <Tooltip permanent direction="top" offset={[0, -42]}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#B91C1C' }}>
                          🔴 Destination: {nameB}
                        </span>
                      </Tooltip>
                    </Marker>
                    <Circle
                      center={[parsedLatB, parsedLngB]}
                      radius={radiusB}
                      pathOptions={{
                        color: colorB,
                        fillColor: colorB,
                        fillOpacity: activeTarget === 'B' ? 0.35 : 0.2,
                        weight: activeTarget === 'B' ? 3.5 : 2,
                      }}
                    />

                    {/* Connecting Corridor Line */}
                    <Polyline
                      positions={[
                        [parsedLatA, parsedLngA],
                        [parsedLatB, parsedLngB]
                      ]}
                      pathOptions={{
                        color: '#0284C7',
                        dashArray: '8, 8',
                        weight: 3.5,
                        opacity: 0.85
                      }}
                    />

                    {/* Midpoint Distance Badge */}
                    {midpointAB && (
                      <Marker position={midpointAB} opacity={0}>
                        <Tooltip permanent direction="center">
                          <div style={{ background: '#0F172A', color: '#FFFFFF', padding: '3px 8px', borderRadius: '14px', fontSize: '11px', fontWeight: 800, whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: '1.5px solid #FFFFFF' }}>
                            🛣️ {formatRadius(corridorDistance)}
                          </div>
                        </Tooltip>
                      </Marker>
                    )}
                  </>
                ) : (
                  /* SINGLE GEOFENCE MAP RENDER */
                  <>
                    {shape === 'polygon' ? (
                      <>
                        {/* Numbered Vertex Badges */}
                        {polygonPoints.map((pt, idx) => (
                          <Marker
                            key={`vertex-${idx}`}
                            position={[pt.lat, pt.lng]}
                            icon={createVertexIcon(idx + 1, color)}
                          />
                        ))}

                        {/* Completed Polygon */}
                        {polygonPoints.length >= 3 && (
                          <Polygon
                            positions={polygonPoints.map((p) => [p.lat, p.lng])}
                            pathOptions={{
                              color: color,
                              fillColor: color,
                              fillOpacity: 0.25,
                              weight: 3,
                            }}
                          >
                            <Tooltip permanent direction="center">
                              <span style={{ fontSize: '11px', fontWeight: 800, color: color }}>
                                {name || 'Yard'} ({formatArea(calculatePolygonAreaM2(polygonPoints))})
                              </span>
                            </Tooltip>
                          </Polygon>
                        )}

                        {/* Connecting line while drafting first 2 points */}
                        {polygonPoints.length === 2 && (
                          <Polyline
                            positions={polygonPoints.map((p) => [p.lat, p.lng])}
                            pathOptions={{ color: color, weight: 3, dashArray: '6, 6' }}
                          />
                        )}
                      </>
                    ) : (
                      <>
                        <Marker
                          position={[parseFloat(centerLat) || defaultLat, parseFloat(centerLng) || defaultLng]}
                          icon={createSleekPin('📍', color, true)}
                        >
                          <Tooltip permanent direction="top" offset={[0, -42]}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: color }}>
                              {name}
                            </span>
                          </Tooltip>
                        </Marker>
                        <Circle
                          center={[parseFloat(centerLat) || defaultLat, parseFloat(centerLng) || defaultLng]}
                          radius={radius}
                          pathOptions={{
                            color: color,
                            fillColor: color,
                            fillOpacity: 0.25,
                            weight: 3,
                          }}
                        />
                      </>
                    )}
                  </>
                )}
              </MapContainer>
            </div>
          </div>

          {/* Bottom Actions Bar */}
          <div
            style={{
              flexShrink: 0,
              padding: '12px 24px',
              borderTop: '1px solid #E2E8F0',
              background: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              zIndex: 20,
            }}
          >
            <div style={{ fontSize: '13px', color: '#334155', fontWeight: 600 }}>
              {editorMode === 'pair' ? (
                <span>
                  🟢 <b>{nameA}</b> ➔ 🔴 <b>{nameB}</b> • <b>{formatRadius(corridorDistance)}</b> direct
                </span>
              ) : shape === 'polygon' ? (
                <span>
                  ⬡ Yard Polygon: <b>{name || 'Custom Yard'}</b> ({polygonPoints.length} points • {formatArea(calculatePolygonAreaM2(polygonPoints))})
                </span>
              ) : (
                <span>📍 Safe Zone: <b>{name}</b> ({formatRadius(radius)})</span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#F1F5F9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: '9px 24px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.7 : 1,
                  boxShadow: '0 4px 14px rgba(2,132,199,0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {isSubmitting ? 'Saving...' : '✅ Done - Save Geofence'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VehicleGeofenceEditorModal;
