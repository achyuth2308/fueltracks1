import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Shield, Search, Truck, Smartphone, AlertCircle, MapPin, Undo2, Trash2,
  FolderOpen, CheckSquare, Square, Check, ArrowRight, ArrowLeftRight, Repeat, RotateCcw
} from 'lucide-react';
import { MapContainer, TileLayer, Circle, Polygon, Polyline, Marker, useMapEvents, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axiosInstance from '../../api/axios';
import { getVehicles } from '../../api/vehicleApi';
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

// Sleek Pin with Letter (A, B, or pin emoji)
const createSleekPin = (letter, color, isActive = false) => {
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

const TripMapFitter = ({ isTrip, latA, lngA, latB, lngB, transitDirection }) => {
  const map = useMap();
  useEffect(() => {
    if (!map || !isTrip) return;
    if (transitDirection === 'round_trip') {
      if (latA && lngA) {
        map.setView([latA, lngA], 14);
      }
      return;
    }
    if (latA && lngA && latB && lngB) {
      try {
        const bounds = L.latLngBounds([
          [latA, lngA],
          [latB, lngB],
        ]);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
      } catch (_) {}
    }
  }, [map, isTrip, latA, lngA, latB, lngB, transitDirection]);
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

  // Setup Mode: 'single' (1 Place) | 'trip' (Two-Way, Round-Trip, or One-Way)
  const [setupMode, setSetupMode] = useState(geofenceToEdit ? 'single' : 'trip');

  // Trip Transit Options:
  // 'two_way' (A ⇄ B Outbound & Return)
  // 'round_trip' (A ➔ Outside ➔ A Base Loop)
  // 'one_way' (A ➔ B Single-Way)
  const [transitDirection, setTransitDirection] = useState('two_way');

  // Target Location being clicked/edited on the map: 'A' or 'B'
  const [activeTarget, setActiveTarget] = useState('A');

  // --- Location A (Origin / Base) ---
  const [nameA, setNameA] = useState(vehicle?.name ? `${vehicle.name} - Depot A` : 'Depot / Yard (A)');
  const [centerLatA, setCenterLatA] = useState(String(defaultLat));
  const [centerLngA, setCenterLngA] = useState(String(defaultLng));
  const [radiusA, setRadiusA] = useState(250);
  const colorA = '#10B981'; // Emerald Green

  // --- Location B (Destination / Site) ---
  const [nameB, setNameB] = useState(vehicle?.name ? `${vehicle.name} - Site B` : 'Client Site / Hub (B)');
  const [centerLatB, setCenterLatB] = useState(String((Number(defaultLat) + 0.016).toFixed(6)));
  const [centerLngB, setCenterLngB] = useState(String((Number(defaultLng) + 0.016).toFixed(6)));
  const [radiusB, setRadiusB] = useState(250);
  const colorB = '#0284C7'; // Sky Blue

  // --- Single Geofence State ---
  const [shape, setShape] = useState(geofenceToEdit?.type || 'circle');
  const [name, setName] = useState(
    geofenceToEdit?.name || (vehicle?.name ? `${vehicle.name} - Safe Zone` : 'Depot / Yard')
  );
  const [color, setColor] = useState(geofenceToEdit?.color || '#0284C7');
  const [centerLat, setCenterLat] = useState(String(defaultLat));
  const [centerLng, setCenterLng] = useState(String(defaultLng));
  const [radius, setRadius] = useState(Number(geofenceToEdit?.radius) || 250);
  const [showAdvancedCoords, setShowAdvancedCoords] = useState(false);

  const [polygonPoints, setPolygonPoints] = useState(() => {
    if (geofenceToEdit?.type === 'polygon' && geofenceToEdit?.coordinates) {
      return normalizeCoordinates(geofenceToEdit.coordinates);
    }
    return [];
  });

  // Alerts
  const [alertOnEnter, setAlertOnEnter] = useState(geofenceToEdit?.alert_on_enter !== false);
  const [alertOnExit, setAlertOnExit] = useState(geofenceToEdit?.alert_on_exit !== false);

  // Multi-vehicle assignment
  const [fleetVehicles, setFleetVehicles] = useState([]);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState(vehicle?.id ? [vehicle.id] : []);

  // Saved / Prior Geofences from other vehicles or organization
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [selectedSavedPlaceId, setSelectedSavedPlaceId] = useState('');
  const [selectedSavedPlaceIdA, setSelectedSavedPlaceIdA] = useState('');
  const [selectedSavedPlaceIdB, setSelectedSavedPlaceIdB] = useState('');

  // Map view & search
  const [mapCenter, setMapCenter] = useState({ lat: Number(defaultLat), lng: Number(defaultLng) });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch all fleet vehicles and prior geofences on mount
  useEffect(() => {
    const fetchFleetData = async () => {
      try {
        const [vehRes, geoRes] = await Promise.all([
          getVehicles().catch(() => ({ success: false, data: [] })),
          axiosInstance.get('/api/admin/geofences').catch(() => ({ data: { data: [] } })),
        ]);

        if (vehRes.success && Array.isArray(vehRes.data)) {
          setFleetVehicles(vehRes.data);
        }
        if (geoRes.data?.data && Array.isArray(geoRes.data.data)) {
          setSavedPlaces(geoRes.data.data);
        }

        if (geofenceToEdit?.id) {
          try {
            const assignedRes = await axiosInstance.get(`/api/admin/geofences/${geofenceToEdit.id}/vehicles`);
            if (assignedRes.data?.success && Array.isArray(assignedRes.data.data)) {
              const ids = assignedRes.data.data.map((v) => v.id);
              if (vehicle?.id && !ids.includes(vehicle.id)) ids.push(vehicle.id);
              setSelectedVehicleIds(ids);
            }
          } catch (_) {}
        }
      } catch (err) {
        console.warn('Failed to load fleet data:', err);
      }
    };

    fetchFleetData();
  }, [geofenceToEdit?.id, vehicle?.id]);

  // Handler to pick Location A (From / Origin) from saved geofences
  const handleSelectFromSavedPlace = (placeId) => {
    setSelectedSavedPlaceIdA(placeId);
    if (!placeId) return;
    const place = savedPlaces.find((p) => String(p.id) === String(placeId));
    if (!place) return;
    setNameA(place.name || '');
    const lat = place.center_lat || defaultLat;
    const lng = place.center_lng || defaultLng;
    setCenterLatA(String(lat));
    setCenterLngA(String(lng));
    setRadiusA(Number(place.radius) || 250);
    setActiveTarget('A');
    setMapCenter({ lat: Number(lat), lng: Number(lng) });
  };

  // Handler to pick Location B (To / Destination) from saved geofences
  const handleSelectToSavedPlace = (placeId) => {
    setSelectedSavedPlaceIdB(placeId);
    if (!placeId) return;
    const place = savedPlaces.find((p) => String(p.id) === String(placeId));
    if (!place) return;
    setNameB(place.name || '');
    const lat = place.center_lat || defaultLat;
    const lng = place.center_lng || defaultLng;
    setCenterLatB(String(lat));
    setCenterLngB(String(lng));
    setRadiusB(Number(place.radius) || 250);
    setActiveTarget('B');
    setMapCenter({ lat: Number(lat), lng: Number(lng) });
  };

  // Handler to populate form from an existing saved geofence (Single Mode)
  const handleLoadSavedPlace = (place) => {
    if (!place) return;
    if (setupMode === 'trip') {
      if (activeTarget === 'A') {
        handleSelectFromSavedPlace(place.id);
      } else {
        handleSelectToSavedPlace(place.id);
      }
    } else {
      setName(place.name || '');
      setShape(place.type || 'circle');
      if (place.color) setColor(place.color);
      if (place.alert_on_enter !== undefined) setAlertOnEnter(place.alert_on_enter);
      if (place.alert_on_exit !== undefined) setAlertOnExit(place.alert_on_exit);

      if (place.type === 'polygon' && place.coordinates) {
        const pts = normalizeCoordinates(place.coordinates);
        setPolygonPoints(pts);
        if (pts.length > 0) {
          setMapCenter({ lat: pts[0].lat, lng: pts[0].lng });
        }
      } else {
        const lat = place.center_lat || defaultLat;
        const lng = place.center_lng || defaultLng;
        setCenterLat(String(lat));
        setCenterLng(String(lng));
        setRadius(Number(place.radius) || 250);
        setMapCenter({ lat: Number(lat), lng: Number(lng) });
      }
    }
    setSelectedSavedPlaceId(String(place.id));
  };

  // Toggle "Select All Vehicles"
  const handleToggleSelectAllVehicles = () => {
    if (selectedVehicleIds.length === fleetVehicles.length) {
      setSelectedVehicleIds(vehicle?.id ? [vehicle.id] : []);
    } else {
      setSelectedVehicleIds(fleetVehicles.map((v) => v.id));
    }
  };

  // Swap Location A and Location B
  const handleSwapAB = () => {
    const tempName = nameA;
    const tempLat = centerLatA;
    const tempLng = centerLngA;
    const tempRad = radiusA;
    const tempSavedId = selectedSavedPlaceIdA;

    setNameA(nameB);
    setCenterLatA(centerLatB);
    setCenterLngA(centerLngB);
    setRadiusA(radiusB);
    setSelectedSavedPlaceIdA(selectedSavedPlaceIdB);

    setNameB(tempName);
    setCenterLatB(tempLat);
    setCenterLngB(tempLng);
    setRadiusB(tempRad);
    setSelectedSavedPlaceIdB(tempSavedId);
  };

  // Parsed Coordinates
  const parsedLatA = parseFloat(centerLatA) || defaultLat;
  const parsedLngA = parseFloat(centerLngA) || defaultLng;
  const parsedLatB = parseFloat(centerLatB) || Number(defaultLat) + 0.016;
  const parsedLngB = parseFloat(centerLngB) || Number(defaultLng) + 0.016;

  // Direct distance between Location A and Location B
  const tripDistanceMeters = useMemo(() => {
    return calculateHaversineDistanceMeters(parsedLatA, parsedLngA, parsedLatB, parsedLngB);
  }, [parsedLatA, parsedLngA, parsedLatB, parsedLngB]);

  // Debounced search with instant GPS coordinates detection
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }

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
      if (setupMode === 'trip') {
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

  const handleCoordinateChange = (field, value, target = activeTarget) => {
    if (setupMode === 'trip') {
      if (target === 'A') {
        if (field === 'lat') setCenterLatA(value);
        if (field === 'lng') setCenterLngA(value);
      } else {
        if (field === 'lat') setCenterLatB(value);
        if (field === 'lng') setCenterLngB(value);
      }
    } else {
      if (field === 'lat') setCenterLat(value);
      if (field === 'lng') setCenterLng(value);
    }
    const pLat = parseFloat(value);
    if (!isNaN(pLat) && pLat >= -90 && pLat <= 90) {
      setMapCenter((prev) => ({ ...prev, [field]: pLat }));
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

    if (setupMode === 'trip') {
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
    setFormError('');
  };

  // Place at user's phone / device location
  const handleUseMyCurrentLocation = () => {
    if (!navigator.geolocation) {
      setFormError('Location not supported on this device/browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setMapCenter({ lat, lng });

        if (setupMode === 'trip') {
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
      },
      (err) => {
        setFormError(`Could not detect location: ${err.message}. Please allow location permission.`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Tap anywhere on the map
  const handleMapClick = (latlng) => {
    const lat = Number(latlng.lat.toFixed(6));
    const lng = Number(latlng.lng.toFixed(6));

    if (setupMode === 'trip') {
      if (transitDirection === 'round_trip' || activeTarget === 'A') {
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

  const parsedCenterLat = parseFloat(centerLat) || defaultLat;
  const parsedCenterLng = parseFloat(centerLng) || defaultLng;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const targetVehicleIds = Array.from(
      new Set([...(vehicle?.id ? [vehicle.id] : []), ...selectedVehicleIds])
    );

    // TRIP MODE (Two-Way, Round-Trip, or One-Way)
    if (setupMode === 'trip') {
      if (!nameA.trim()) {
        setFormError('Please give a name for Location A (Origin / Base).');
        return;
      }
      if (transitDirection !== 'round_trip' && !nameB.trim()) {
        setFormError('Please give a name for Location B (Destination).');
        return;
      }

      setIsSubmitting(true);
      try {
        await onSave({
          isPair: true,
          transitDirection, // 'two_way' | 'round_trip' | 'one_way'
          vehicleIds: targetVehicleIds,
          fromGeofence: {
            id: selectedSavedPlaceIdA || undefined,
            name: nameA.trim(),
            type: 'circle',
            center_lat: parsedLatA,
            center_lng: parsedLngA,
            radius: Number(radiusA),
            coordinates: [{ lat: parsedLatA, lng: parsedLngA }],
            color: colorA,
            alert_on_enter: alertOnEnter,
            alert_on_exit: alertOnExit,
            vehicleIds: targetVehicleIds,
            is_active: true,
          },
          toGeofence:
            transitDirection === 'round_trip'
              ? null
              : {
                  id: selectedSavedPlaceIdB || undefined,
                  name: nameB.trim(),
                  type: 'circle',
                  center_lat: parsedLatB,
                  center_lng: parsedLngB,
                  radius: Number(radiusB),
                  coordinates: [{ lat: parsedLatB, lng: parsedLngB }],
                  color: colorB,
                  alert_on_enter: alertOnEnter,
                  alert_on_exit: alertOnExit,
                  vehicleIds: targetVehicleIds,
                  is_active: true,
                },
        });
        onClose();
      } catch (err) {
        setFormError(err.response?.data?.error || err.message || 'Failed to save trip geofences.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // SINGLE GEOFENCE MODE
    if (!name.trim()) {
      setFormError('Please enter a name for this geofence.');
      return;
    }

    if (shape === 'polygon' && polygonPoints.length < 3) {
      setFormError('A polygon geofence requires at least 3 boundary corners. Tap on the map to add points.');
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
        vehicleIds: targetVehicleIds,
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
          maxWidth: '1200px',
          height: 'min(93vh, 860px)',
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
                  {geofenceToEdit ? 'Edit Geofence' : 'Vehicle Geofence & Transit Setup'}
                </h2>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '3px 9px',
                    borderRadius: '20px',
                    background: setupMode === 'trip' ? '#10B98130' : '#0284C730',
                    color: setupMode === 'trip' ? '#34D399' : '#38BDF8',
                    border: `1px solid ${setupMode === 'trip' ? '#10B98160' : '#0284C760'}`,
                  }}
                >
                  {setupMode === 'trip'
                    ? transitDirection === 'two_way'
                      ? '⇄ Two-Way Trip (A ⇄ B)'
                      : transitDirection === 'round_trip'
                      ? '🔄 Round-Trip Loop (A ➔ A)'
                      : '➔ One-Way Trip (A ➔ B)'
                    : shape === 'polygon'
                    ? '⬡ Custom Polygon'
                    : '⭕ Circular Safe Zone'}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Primary Vehicle:</span>
                <span style={{ color: '#F8FAFC', fontWeight: 700 }}>
                  {vehicle?.name || 'Active Vehicle'}
                </span>
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
              gridTemplateColumns: '430px 1fr',
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            {/* Left Controls Column */}
            <div
              style={{
                height: '100%',
                minHeight: 0,
                padding: '14px 16px',
                borderRight: '1px solid #E2E8F0',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                background: '#F8FAFC',
                boxSizing: 'border-box',
              }}
            >
              {/* PRIMARY SETUP MODE SWITCHER */}
              {!geofenceToEdit && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '4px',
                    background: '#E2E8F0',
                    padding: '3px',
                    borderRadius: '12px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSetupMode('trip')}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: setupMode === 'trip' ? 800 : 600,
                      background: setupMode === 'trip' ? '#FFFFFF' : 'transparent',
                      color: setupMode === 'trip' ? '#0F172A' : '#64748B',
                      boxShadow: setupMode === 'trip' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                    }}
                  >
                    <span>⇄</span>
                    <span>Transit Trip (2 Places)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSetupMode('single')}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: setupMode === 'single' ? 800 : 600,
                      background: setupMode === 'single' ? '#FFFFFF' : 'transparent',
                      color: setupMode === 'single' ? '#0F172A' : '#64748B',
                      boxShadow: setupMode === 'single' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                    }}
                  >
                    <span>📍</span>
                    <span>Single Place Only</span>
                  </button>
                </div>
              )}

              {/* TRANSIT TRIP CONTROLS (TWO-WAY, ROUND-TRIP, ONE-WAY) */}
              {setupMode === 'trip' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Transit Direction Segmented Pills */}
                  <div>
                    <span style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Transit Trip Type:
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => setTransitDirection('two_way')}
                        style={{
                          padding: '7px 4px',
                          borderRadius: '8px',
                          border: transitDirection === 'two_way' ? '2px solid #0284C7' : '1px solid #CBD5E1',
                          background: transitDirection === 'two_way' ? '#F0F9FF' : '#FFFFFF',
                          color: transitDirection === 'two_way' ? '#0284C7' : '#475569',
                          fontWeight: 800,
                          fontSize: '11px',
                          cursor: 'pointer',
                          textAlign: 'center',
                        }}
                      >
                        <div>⇄ Two-Way</div>
                        <div style={{ fontSize: '9px', fontWeight: 600, opacity: 0.8 }}>Outbound & Back</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTransitDirection('round_trip')}
                        style={{
                          padding: '7px 4px',
                          borderRadius: '8px',
                          border: transitDirection === 'round_trip' ? '2px solid #10B981' : '1px solid #CBD5E1',
                          background: transitDirection === 'round_trip' ? '#ECFDF5' : '#FFFFFF',
                          color: transitDirection === 'round_trip' ? '#059669' : '#475569',
                          fontWeight: 800,
                          fontSize: '11px',
                          cursor: 'pointer',
                          textAlign: 'center',
                        }}
                      >
                        <div>🔄 Round-Trip</div>
                        <div style={{ fontSize: '9px', fontWeight: 600, opacity: 0.8 }}>Depot ➔ Field ➔ Depot</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTransitDirection('one_way')}
                        style={{
                          padding: '7px 4px',
                          borderRadius: '8px',
                          border: transitDirection === 'one_way' ? '2px solid #F59E0B' : '1px solid #CBD5E1',
                          background: transitDirection === 'one_way' ? '#FFFBEB' : '#FFFFFF',
                          color: transitDirection === 'one_way' ? '#D97706' : '#475569',
                          fontWeight: 800,
                          fontSize: '11px',
                          cursor: 'pointer',
                          textAlign: 'center',
                        }}
                      >
                        <div>➔ One-Way</div>
                        <div style={{ fontSize: '9px', fontWeight: 600, opacity: 0.8 }}>A to B Only</div>
                      </button>
                    </div>
                  </div>

                  {/* Connected Locations Card */}
                  <div
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '14px',
                      border: '1px solid #E2E8F0',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                    }}
                  >
                    {/* Location A Card (FROM / ORIGIN) */}
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#10B981', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '12px' }}>A</span>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>
                            {transitDirection === 'round_trip' ? 'Base Depot (Start & Return)' : 'FROM: Origin / Start Site (A)'}
                          </span>
                        </div>
                        {activeTarget === 'A' && (
                          <span style={{ fontSize: '9px', fontWeight: 800, background: '#10B981', color: '#FFF', padding: '2px 6px', borderRadius: '4px' }}>SELECTED</span>
                        )}
                      </div>

                      {/* Dropdown to Pick FROM Saved Geofences */}
                      {savedPlaces.length > 0 && (
                        <div style={{ marginBottom: '8px' }} onClick={(e) => e.stopPropagation()}>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, color: '#047857', marginBottom: '3px' }}>
                            📂 SELECT FROM SAVED GEOFENCE:
                          </label>
                          <select
                            value={selectedSavedPlaceIdA}
                            onChange={(e) => handleSelectFromSavedPlace(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '7px 10px',
                              borderRadius: '6px',
                              border: '1.5px solid #A7F3D0',
                              background: '#FFFFFF',
                              fontSize: '12px',
                              fontWeight: 700,
                              color: '#0F172A',
                              cursor: 'pointer',
                              boxSizing: 'border-box',
                            }}
                          >
                            <option value="">-- Choose saved origin site (or type below) --</option>
                            {savedPlaces.map((sp) => (
                              <option key={`a-${sp.id}`} value={sp.id}>
                                {sp.name} ({formatRadius(sp.radius || 250)})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div style={{ marginBottom: '6px' }}>
                        <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>
                          Location Name:
                        </label>
                        <input
                          type="text"
                          value={nameA}
                          onChange={(e) => {
                            setNameA(e.target.value);
                            setSelectedSavedPlaceIdA('');
                          }}
                          placeholder="e.g. Hyderabad Depot, Main Yard"
                          style={{
                            width: '100%',
                            padding: '7px 10px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: '#0F172A',
                            boxSizing: 'border-box',
                            background: '#FFFFFF',
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Radius: <b>{formatRadius(radiusA)}</b></span>
                        <div style={{ display: 'flex', gap: '3px' }}>
                          {[100, 250, 1000].map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRadiusA(r);
                              }}
                              style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                border: radiusA === r ? '1.5px solid #10B981' : '1px solid #E2E8F0',
                                background: radiusA === r ? '#ECFDF5' : '#FFFFFF',
                                color: radiusA === r ? '#047857' : '#64748B',
                                fontSize: '10px',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              {r >= 1000 ? `${r / 1000}km` : `${r}m`}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Intermediate Corridor Distance & Swap (only if not single round_trip) */}
                    {transitDirection !== 'round_trip' && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: '#0F172A' }}>
                          <span>{transitDirection === 'two_way' ? '⇄' : '➔'}</span>
                          <span>Trip Distance: <b>{formatRadius(tripDistanceMeters)}</b></span>
                        </div>
                        <button
                          type="button"
                          onClick={handleSwapAB}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            background: '#F8FAFC',
                            color: '#0284C7',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <ArrowLeftRight size={12} />
                          <span>Swap A ⇄ B</span>
                        </button>
                      </div>
                    )}

                    {/* Location B Card (TO / DESTINATION) */}
                    {transitDirection !== 'round_trip' && (
                      <div
                        onClick={() => {
                          setActiveTarget('B');
                          setMapCenter({ lat: parsedLatB, lng: parsedLngB });
                        }}
                        style={{
                          padding: '12px',
                          borderRadius: '12px',
                          border: activeTarget === 'B' ? '2px solid #0284C7' : '1px solid #E2E8F0',
                          background: activeTarget === 'B' ? '#F0F9FF' : '#FFFFFF',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#0284C7', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '12px' }}>B</span>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#0369A1', textTransform: 'uppercase' }}>
                              {transitDirection === 'two_way' ? 'TO: Destination / Return Hub (B)' : 'TO: Destination End Site (B)'}
                            </span>
                          </div>
                          {activeTarget === 'B' && (
                            <span style={{ fontSize: '9px', fontWeight: 800, background: '#0284C7', color: '#FFF', padding: '2px 6px', borderRadius: '4px' }}>SELECTED</span>
                          )}
                        </div>

                        {/* Dropdown to Pick TO Saved Geofences */}
                        {savedPlaces.length > 0 && (
                          <div style={{ marginBottom: '8px' }} onClick={(e) => e.stopPropagation()}>
                            <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, color: '#0369A1', marginBottom: '3px' }}>
                              📂 SELECT TO SAVED GEOFENCE:
                            </label>
                            <select
                              value={selectedSavedPlaceIdB}
                              onChange={(e) => handleSelectToSavedPlace(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '7px 10px',
                                borderRadius: '6px',
                                border: '1.5px solid #BAE6FD',
                                background: '#FFFFFF',
                                fontSize: '12px',
                                fontWeight: 700,
                                color: '#0F172A',
                                cursor: 'pointer',
                                boxSizing: 'border-box',
                              }}
                            >
                              <option value="">-- Choose saved destination site (or type below) --</option>
                              {savedPlaces.map((sp) => (
                                <option key={`b-${sp.id}`} value={sp.id}>
                                  {sp.name} ({formatRadius(sp.radius || 250)})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div style={{ marginBottom: '6px' }}>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>
                            Location Name:
                          </label>
                          <input
                            type="text"
                            value={nameB}
                            onChange={(e) => {
                              setNameB(e.target.value);
                              setSelectedSavedPlaceIdB('');
                            }}
                            placeholder="e.g. Client Site, Regional Hub"
                            style={{
                              width: '100%',
                              padding: '7px 10px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              fontSize: '12px',
                              fontWeight: 700,
                              color: '#0F172A',
                              boxSizing: 'border-box',
                              background: '#FFFFFF',
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Radius: <b>{formatRadius(radiusB)}</b></span>
                          <div style={{ display: 'flex', gap: '3px' }}>
                            {[100, 250, 1000].map((r) => (
                              <button
                                key={r}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRadiusB(r);
                                }}
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  border: radiusB === r ? '1.5px solid #0284C7' : '1px solid #E2E8F0',
                                  background: radiusB === r ? '#F0F9FF' : '#FFFFFF',
                                  color: radiusB === r ? '#0369A1' : '#64748B',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                {r >= 1000 ? `${r / 1000}km` : `${r}m`}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* SINGLE GEOFENCE MODE CONTROLS */
                <div
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '14px',
                    border: '1px solid #E2E8F0',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                  }}
                >
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Geofence Name:
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Hyderabad Depot, Main Yard"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
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

                  {/* Color Palette */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Boundary Color:
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {GEOFENCE_COLOR_PALETTE.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setColor(c)}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: c,
                            border: color === c ? '2.5px solid #0F172A' : '2px solid #FFFFFF',
                            boxShadow: color === c ? '0 0 0 2px #CBD5E1' : '0 1px 3px rgba(0,0,0,0.2)',
                            cursor: 'pointer',
                            transition: 'transform 0.15s ease',
                            transform: color === c ? 'scale(1.15)' : 'scale(1)',
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {shape === 'polygon' ? (
                    /* POLYGON BOUNDARY CONTROLS */
                    <div style={{ background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase' }}>
                          Polygon Corners:
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: polygonPoints.length >= 3 ? '#059669' : '#DC2626', background: '#FFFFFF', padding: '2px 8px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                          {polygonPoints.length} point{polygonPoints.length === 1 ? '' : 's'} {polygonPoints.length >= 3 ? '✅ Ready' : '(Need 3+)'}
                        </span>
                      </div>

                      <div style={{ fontSize: '11px', color: '#64748B', lineHeight: '1.4' }}>
                        💡 Click anywhere on the map to add boundary corners around your warehouse or depot.
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
                          onClick={() => setPolygonPoints((prev) => prev.slice(0, -1))}
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
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                          }}
                        >
                          <Undo2 size={13} />
                          <span>Undo Point</span>
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
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                          }}
                        >
                          <Trash2 size={13} />
                          <span>Clear All</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* CIRCLE RADIUS CONTROLS */
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase' }}>
                          Radius: {formatRadius(radius)}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '10px' }}>
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
                      <input
                        type="range"
                        min={50}
                        max={5000}
                        step={25}
                        value={radius}
                        onChange={(e) => setRadius(Number(e.target.value))}
                        style={{ width: '100%', accentColor: color, cursor: 'pointer' }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* FAST POSITION SNAP */}
              <div>
                <span style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Fast Center Snap:
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={handleUseVehicleLocation}
                    style={{
                      padding: '7px 6px',
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
                    <Truck size={13} />
                    <span>Truck GPS Spot</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleUseMyCurrentLocation}
                    style={{
                      padding: '7px 6px',
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
                    <Smartphone size={13} />
                    <span>Where I Am</span>
                  </button>
                </div>
              </div>

              {/* USE EXISTING / PREVIOUS GEOFENCE PICKER */}
              {savedPlaces.length > 0 && (
                <div
                  style={{
                    background: '#F0F9FF',
                    border: '1.5px solid #BAE6FD',
                    borderRadius: '10px',
                    padding: '8px 10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#0369A1', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FolderOpen size={12} color="#0284C7" />
                      <span>Copy From Saved Place:</span>
                    </span>
                  </div>
                  <select
                    value={selectedSavedPlaceId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedSavedPlaceId(id);
                      const match = savedPlaces.find((p) => String(p.id) === id);
                      if (match) handleLoadSavedPlace(match);
                    }}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: '1px solid #7DD3FC',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#0F172A',
                      background: '#FFFFFF',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">-- Choose saved warehouse/site --</option>
                    {savedPlaces.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.type === 'circle' ? `${p.radius}m circle` : `${p.coordinates?.length || 0} pts polygon`})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* MULTI-VEHICLE ASSIGNMENT CHECKLIST */}
              {fleetVehicles.length > 0 && (
                <div
                  style={{
                    background: '#FFFFFF',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Truck size={13} color="#0284C7" />
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase' }}>
                        Assign to Vehicles:
                      </span>
                    </div>
                    {fleetVehicles.length > 1 && (
                      <button
                        type="button"
                        onClick={handleToggleSelectAllVehicles}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#0284C7',
                          fontSize: '10px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        {selectedVehicleIds.length === fleetVehicles.length ? 'Reset' : 'Select All Fleet'}
                      </button>
                    )}
                  </div>

                  <div
                    style={{
                      maxHeight: '90px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                      border: '1px solid #F1F5F9',
                      borderRadius: '6px',
                      padding: '3px',
                    }}
                  >
                    {fleetVehicles.map((v) => {
                      const isCurrent = v.id === vehicle?.id;
                      const isChecked = selectedVehicleIds.includes(v.id) || isCurrent;
                      return (
                        <div
                          key={v.id}
                          onClick={() => {
                            if (isCurrent) return;
                            if (selectedVehicleIds.includes(v.id)) {
                              setSelectedVehicleIds((prev) => prev.filter((id) => id !== v.id));
                            } else {
                              setSelectedVehicleIds((prev) => [...prev, v.id]);
                            }
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            background: isChecked ? '#F0F9FF' : 'transparent',
                            cursor: isCurrent ? 'default' : 'pointer',
                            fontSize: '11px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isChecked ? (
                              <CheckSquare size={13} color="#0284C7" />
                            ) : (
                              <Square size={13} color="#94A3B8" />
                            )}
                            <span style={{ fontWeight: isChecked ? 700 : 500, color: isChecked ? '#0369A1' : '#334155' }}>
                              {v.name || 'Vehicle'}
                            </span>
                          </div>
                          {isCurrent && (
                            <span style={{ fontSize: '9px', fontWeight: 800, color: '#059669', background: '#D1FAE5', padding: '1px 5px', borderRadius: '4px' }}>
                              CURRENT
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Alert Notification Switches */}
              <div style={{ background: '#FFFFFF', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E2E8F0', marginTop: 'auto' }}>
                <span style={{ display: 'block', fontSize: '10px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Alert Notifications:
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '11px', color: '#1E293B', fontWeight: 600 }}>
                    <span>🔔 Notify when vehicle ENTERS</span>
                    <input
                      type="checkbox"
                      checked={alertOnEnter}
                      onChange={(e) => setAlertOnEnter(e.target.checked)}
                      style={{ width: '15px', height: '15px', accentColor: '#10B981', cursor: 'pointer' }}
                    />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '11px', color: '#1E293B', fontWeight: 600 }}>
                    <span>🚨 Notify when vehicle LEAVES</span>
                    <input
                      type="checkbox"
                      checked={alertOnExit}
                      onChange={(e) => setAlertOnExit(e.target.checked)}
                      style={{ width: '15px', height: '15px', accentColor: '#EF4444', cursor: 'pointer' }}
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
                        setupMode === 'trip'
                          ? `Search place or GPS for ${activeTarget === 'A' ? 'Location A (Base)' : 'Location B (Destination)'}...`
                          : 'Search place, landmark, city or paste GPS coordinates...'
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
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>{r.is_coordinates ? '🎯' : '📍'}</span>
                            <span>{r.display_name}</span>
                          </div>
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

              {/* Map Interaction Hint */}
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
                  {setupMode === 'trip'
                    ? transitDirection === 'round_trip'
                      ? 'Click on the map to set Base Depot location'
                      : `Click map to position ${activeTarget === 'A' ? '🟢 Start (A)' : '🔵 Destination (B)'}`
                    : shape === 'polygon'
                    ? 'Click on the map to add boundary corners'
                    : 'Click on the map to position center'}
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
                <TripMapFitter
                  isTrip={setupMode === 'trip'}
                  latA={parsedLatA}
                  lngA={parsedLngA}
                  latB={parsedLatB}
                  lngB={parsedLngB}
                  transitDirection={transitDirection}
                />

                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Vehicle Live Marker */}
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

                {/* TRIP MAP RENDERING (Location A and Location B) */}
                {setupMode === 'trip' ? (
                  <>
                    {/* Location A Marker & Circle */}
                    <Marker
                      position={[parsedLatA, parsedLngA]}
                      icon={createSleekPin('A', colorA, activeTarget === 'A')}
                      eventHandlers={{ click: () => setActiveTarget('A') }}
                    >
                      <Tooltip permanent direction="top" offset={[0, -42]}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#047857' }}>
                          🟢 {nameA}
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

                    {/* Location B Marker & Circle (if not single base round-trip) */}
                    {transitDirection !== 'round_trip' && (
                      <>
                        <Marker
                          position={[parsedLatB, parsedLngB]}
                          icon={createSleekPin('B', colorB, activeTarget === 'B')}
                          eventHandlers={{ click: () => setActiveTarget('B') }}
                        >
                          <Tooltip permanent direction="top" offset={[0, -42]}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#0369A1' }}>
                              🔵 {nameB}
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

                        {/* Connecting Line between A and B */}
                        <Polyline
                          positions={[
                            [parsedLatA, parsedLngA],
                            [parsedLatB, parsedLngB],
                          ]}
                          pathOptions={{
                            color: transitDirection === 'two_way' ? '#0284C7' : '#F59E0B',
                            dashArray: '8, 8',
                            weight: 3.5,
                            opacity: 0.85,
                          }}
                        />

                        {/* Midpoint Distance Badge */}
                        <Marker
                          position={[(parsedLatA + parsedLatB) / 2, (parsedLngA + parsedLngB) / 2]}
                          opacity={0}
                        >
                          <Tooltip permanent direction="center">
                            <div style={{ background: '#0F172A', color: '#FFFFFF', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800, whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: '1.5px solid #FFFFFF' }}>
                              {transitDirection === 'two_way' ? '⇄' : '➔'} {formatRadius(tripDistanceMeters)}
                            </div>
                          </Tooltip>
                        </Marker>
                      </>
                    )}
                  </>
                ) : (
                  /* SINGLE GEOFENCE MAP RENDERING */
                  <>
                    {shape === 'polygon' ? (
                      <>
                        {polygonPoints.map((pt, idx) => (
                          <Marker
                            key={`vertex-${idx}`}
                            position={[pt.lat, pt.lng]}
                            icon={createVertexIcon(idx + 1, color)}
                          />
                        ))}
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
                          position={[parsedCenterLat, parsedCenterLng]}
                          icon={createSleekPin('📍', color, true)}
                        >
                          <Tooltip permanent direction="top" offset={[0, -42]}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: color }}>
                              {name}
                            </span>
                          </Tooltip>
                        </Marker>
                        <Circle
                          center={[parsedCenterLat, parsedCenterLng]}
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
              {setupMode === 'trip' ? (
                transitDirection === 'round_trip' ? (
                  <span>
                    🔄 Round-Trip Loop: Base <b>{nameA}</b> • Linked to {selectedVehicleIds.length} vehicle(s)
                  </span>
                ) : (
                  <span>
                    {transitDirection === 'two_way' ? '⇄ Two-Way' : '➔ One-Way'}: <b>{nameA}</b> ➔ <b>{nameB}</b> ({formatRadius(tripDistanceMeters)})
                  </span>
                )
              ) : (
                <span>
                  📍 Geofence: <b>{name}</b> ({shape === 'polygon' ? `${polygonPoints.length} points` : formatRadius(radius)})
                </span>
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
                {isSubmitting
                  ? 'Saving...'
                  : setupMode === 'trip'
                  ? '✅ Save Trip Geofences'
                  : '✅ Save Geofence'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VehicleGeofenceEditorModal;
