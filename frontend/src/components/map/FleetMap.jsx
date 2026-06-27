import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { MapContainer, TileLayer, Marker, Tooltip, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Truck, User } from 'lucide-react';
import { formatSpeed } from '../../utils/formatUtils';
import { formatLocalTime } from '../../utils/dateUtils';
import LocationDisplay from '../ui/LocationDisplay';

import { getVehicleRoute } from '../../api/vehicleApi';

const getExpiryWarning = (expireDateStr) => {
  if (!expireDateStr) return null;
  const exp = new Date(expireDateStr);
  const now = new Date();
  const diffTime = exp.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { type: 'expired', text: `Licence Expired` };
  } else if (diffDays <= 4) {
    return { type: 'expiring', text: `Licence Expiring in ${diffDays}d` };
  }
  return null;
};

// ── Live Route Plotting & Following for Selected Vehicle ─────────────
const VehicleRouteAndFit = ({ selectedVehicle, showRoute = false, followSelected = false }) => {
  const map = useMap();
  const [routePoints, setRoutePoints] = useState([]);

  // Haversine distance in km
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const splitIntoSegments = (positions, maxDistKm = 50) => {
    const segs = [];
    let cur = [];
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      if (cur.length > 0) {
        const prev = cur[cur.length - 1];
        if (getDistance(prev[0], prev[1], p[0], p[1]) > maxDistKm) {
          segs.push(cur);
          cur = [p];
          continue;
        }
      }
      cur.push(p);
    }
    if (cur.length > 0) segs.push(cur);
    return segs;
  };

  // 1. Fetch today's route line
  useEffect(() => {
    if (!showRoute || !selectedVehicle?.id) {
      setRoutePoints([]);
      return;
    }

    const fetchRoute = async () => {
      setRoutePoints([]);
      try {
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0).toISOString();
        const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();
        const res = await getVehicleRoute(selectedVehicle.id, { startDate: start, endDate: end });

        if (res.success && res.data.length > 0) {
          const validPoints = res.data.filter(p => {
            const la = parseFloat(p.lat);
            const lo = parseFloat(p.lng);
            return !isNaN(la) && !isNaN(lo) && la > 6.5 && la < 37.5 && lo > 68.0 && lo < 98.0;
          });
          setRoutePoints(validPoints);
        } else {
          setRoutePoints([]);
        }
      } catch (err) {
        console.error('Failed to fetch route:', err);
      }
    };

    fetchRoute();
  }, [selectedVehicle?.id]);

  // Zoom in when a new vehicle is selected
  useEffect(() => {
    if (!selectedVehicle?.id) return;
    const lat = parseFloat(selectedVehicle.lat);
    const lng = parseFloat(selectedVehicle.lng);
    if (!isNaN(lat) && !isNaN(lng) && lat > 6.5 && lat < 37.5 && lng > 68.0 && lng < 98.0) {
      map.setView([lat, lng], 16, { animate: true, duration: 1.2 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicle?.id]);


  // 2. Zoom out when no vehicle selected
  useEffect(() => {
    if (!followSelected) return;
    if (!selectedVehicle) {
      map.setView([22.5937, 78.9629], 5, { animate: true, duration: 1.5 });
    }
  }, [selectedVehicle, map, followSelected]);

  // 3. Smoothly pan to follow vehicle as it moves in real time
  useEffect(() => {
    if (!followSelected || !selectedVehicle?.id) return;
    const lat = parseFloat(selectedVehicle.lat);
    const lng = parseFloat(selectedVehicle.lng);
    if (!isNaN(lat) && !isNaN(lng) && lat > 6.5 && lat < 37.5 && lng > 68.0 && lng < 98.0) {
      map.panTo([lat, lng], { animate: true, duration: 0.8 });
    }
  }, [selectedVehicle?.lat, selectedVehicle?.lng, map]);

  if (routePoints.length === 0) return null;


  const positions = routePoints.map(p => [parseFloat(p.lat), parseFloat(p.lng)]);
  const segments = splitIntoSegments(positions);

  return (
    <>
      {segments.map((seg, idx) => seg.length > 1 && (
        <React.Fragment key={idx}>
          <Polyline positions={seg} color="#0EA5E9" weight={4} opacity={0.7} />
          <Polyline positions={seg} color="#38BDF8" weight={2} opacity={1} />
        </React.Fragment>
      ))}
    </>
  );
};

const getVehicleType = (vehicle) => {
  const model = (vehicle.model || '').toLowerCase().trim();
  const name = (vehicle.name || '').toLowerCase();

  // ── Priority 1: Exact model field match (stored directly from onboarding dropdown) ──
  if (model === 'scooty' || model === 'scooter' || model === 'moped') return 'bike';
  if (model === 'motorcycle' || model === 'bike') return 'bike';
  if (model === 'car') return 'car';
  if (model === 'bus' || model === 'ambulance') return 'bus';
  if (model === 'van' || model === 'pickup') return 'van';
  if (model === 'truck' || model === 'lorry' || model === 'tanker' ||
      model === 'tractor' || model === 'jcb' || model === 'crane' || model === 'borewell') return 'lorry';

  // ── Priority 2: Keyword search (fallback for older/manual entries) ──
  if (model.includes('scooty') || model.includes('scooter') || model.includes('moped')) return 'bike';
  if (model.includes('bike') || model.includes('motorcycle') || name.includes('bike')) return 'bike';
  if (model.includes('car')) return 'car'; // only on model field — avoid false match from vehicle names
  if (model.includes('bus') || name.includes('bus')) return 'bus';
  if (model.includes('van') || name.includes('van')) return 'van';
  return 'lorry';
};

const getTopDownSvg = (type) => {
  if (type === 'car') {
    return `<img src="/long-car.png" style="width:24px;height:24px;object-fit:contain;" />`;
  } else if (type === 'bike') {
    return `<img src="/racing-motorbike.png" style="width:24px;height:24px;object-fit:contain;" />`;
  } else if (type === 'bus') {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="4" y="1" width="16" height="22" rx="2" fill="currentColor" fill-opacity="0.2"/>
              <rect x="5" y="3" width="14" height="4" fill="currentColor"/>
              <rect x="5" y="19" width="14" height="2" fill="currentColor"/>
            </svg>`;
  } else if (type === 'van') {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="4" y="2" width="16" height="20" rx="3" fill="currentColor" fill-opacity="0.2"/>
              <rect x="5" y="7" width="14" height="5" fill="currentColor"/>
            </svg>`;
  }

  // Default Lorry / Truck
  return `<img src="/big-cargo-truck.png" style="width:24px;height:24px;object-fit:contain;" />`;
};

// ── Status helpers ──────────────────────────────────────────────
const getVehicleStatus = (vehicle) => {
  if (!vehicle.is_online) return 'offline';
  if ((vehicle.current_speed || 0) > 0) return 'running';
  if (vehicle.current_ignition) return 'idle';
  return 'parked';
};

const STATUS_CONFIG = {
  running: { color: '#16a34a', label: 'Running',  pulse: true  },
  idle:    { color: '#f59e0b', label: 'Idle',     pulse: false },
  parked:  { color: '#f97316', label: 'Parked',   pulse: false },
  offline: { color: '#ef4444', label: 'Offline',  pulse: false },
};

// ── Pin icon builder ─────────────────────────────────────────────
// Creates a teardrop/pin shaped SVG marker with:
//   • solid status color fill
//   • small vehicle-type glyph inside
//   • white border ring
//   • directional arrow for moving vehicles
//   • pulse ring animation for running vehicles
const createPinIcon = (vehicle, noGps = false, clusterRank = 0) => {
  const status  = getVehicleStatus(vehicle);
  const cfg     = STATUS_CONFIG[status];
  const color   = cfg.color;
  const type    = getVehicleType(vehicle);
  const speed   = Math.round(vehicle.current_speed || 0);

  // Small glyph inside pin (16×16 viewport)
  const glyphMap = {
    bike:  `<path d="M3 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0M13 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0M8 5l2 4H5L8 5zM8 9h8" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
    car:   `<rect x="2" y="6" width="12" height="7" rx="2" fill="white" fill-opacity="0.9"/><rect x="4" y="4" width="8" height="4" rx="1" fill="white" fill-opacity="0.7"/><circle cx="4.5" cy="13.5" r="1.5" fill="white"/><circle cx="11.5" cy="13.5" r="1.5" fill="white"/>`,
    bus:   `<rect x="2" y="3" width="12" height="11" rx="1.5" fill="white" fill-opacity="0.9"/><rect x="3" y="4" width="5" height="4" rx="0.5" fill="${color}"/><rect x="9" y="4" width="4" height="4" rx="0.5" fill="${color}"/>`,
    van:   `<rect x="1" y="5" width="14" height="9" rx="2" fill="white" fill-opacity="0.9"/><rect x="9" y="3" width="5" height="4" rx="1" fill="white" fill-opacity="0.7"/>`,
    lorry: `<rect x="1" y="6" width="10" height="8" rx="1" fill="white" fill-opacity="0.9"/><rect x="11" y="8" width="5" height="6" rx="1" fill="white" fill-opacity="0.7"/><circle cx="3.5" cy="14.5" r="1.5" fill="white"/><circle cx="9.5" cy="14.5" r="1.5" fill="white"/>`,
  };
  const glyph = glyphMap[type] || glyphMap.lorry;

  const pulseRing = cfg.pulse && !noGps ? `
    <circle cx="18" cy="15" r="16" fill="none" stroke="${color}" stroke-width="2" opacity="0.4">
      <animate attributeName="r" from="16" to="26" dur="1.5s" repeatCount="indefinite"/>
      <animate attributeName="opacity" from="0.5" to="0" dur="1.5s" repeatCount="indefinite"/>
    </circle>` : '';

  const dashStyle = noGps ? 'stroke-dasharray:3,2;' : '';
  const stemHeight = clusterRank * 24;
  const totalHeight = 44 + stemHeight;

  const svgHtml = `
    <div style="position:relative;width:36px;height:${totalHeight}px;display:flex;flex-direction:column;align-items:center;">
      <div class="pin-interactive" style="position:relative;width:36px;height:44px;">
        ${pulseRing ? `<svg style="position:absolute;top:-5px;left:-5px;width:46px;height:46px;overflow:visible;z-index:0;">${pulseRing}</svg>` : ''}
        <svg width="36" height="44" viewBox="0 0 36 44" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35));position:relative;z-index:1;">
          <!-- Teardrop pin shape -->
          <path d="M18 2 C9.163 2 2 9.163 2 18 C2 29.5 18 42 18 42 C18 42 34 29.5 34 18 C34 9.163 26.837 2 18 2 Z"
            fill="${color}" stroke="white" stroke-width="2" style="${dashStyle}"/>
          <!-- Inner white circle -->
          <circle cx="18" cy="17" r="11" fill="white" fill-opacity="${noGps ? '0.4' : '0.2'}"/>
          <!-- Vehicle glyph (16x16 centered at 18,17) -->
          <g transform="translate(10,9)">
            <svg width="16" height="16" viewBox="0 0 16 16">${glyph}</svg>
          </g>
          ${status === 'running' && speed > 0 ? `<text x="18" y="39" text-anchor="middle" font-size="6" font-family="sans-serif" font-weight="bold" fill="white" dy="-1">${speed}</text>` : ''}
        </svg>
      </div>
      ${clusterRank > 0 ? `<div class="pin-interactive" style="width:2px;height:${stemHeight}px;background-color:${color};margin-top:-2px;z-index:0;box-shadow: 1px 0 2px rgba(0,0,0,0.2);"></div>` : ''}
    </div>`;

  return L.divIcon({
    html: svgHtml,
    className: 'custom-marker-icon',
    iconSize:   [36, totalHeight],
    iconAnchor: [18, totalHeight - 2],     // tip of the pin/stem
    popupAnchor:[0, -totalHeight],
  });
};

const VehicleMarker = ({ vehicle, isSelected, onMarkerClick, zIndexOffset = 0 }) => {
  const markerRef = useRef(null);
  const navigate = useNavigate();

  const status  = getVehicleStatus(vehicle);
  const cfg     = STATUS_CONFIG[status];
  const noGps   = !!vehicle._noGps;
  const position = [parseFloat(vehicle.lat), parseFloat(vehicle.lng)];
  const warning  = getExpiryWarning(vehicle.licence_expire_date);
  const clusterRank = vehicle._clusterRank || 0;

  return (
    <Marker
      position={position}
      icon={createPinIcon(vehicle, noGps, clusterRank)}
      ref={markerRef}
      zIndexOffset={zIndexOffset}
      eventHandlers={{ 
        mouseover: (e) => e.target.openPopup(),
        click: () => onMarkerClick && onMarkerClick(vehicle) 
      }}
    >
      <Popup
        className="premium-popup"
        closeButton={false}
      >
        <div style={{ minWidth: '240px', fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '12px', padding: '2px' }}>
          {/* No GPS notice */}
          {noGps && (
            <div style={{ marginBottom: '8px', padding: '6px 8px', borderRadius: '6px', background: '#F3F4F6', border: '1px solid #D1D5DB', color: '#6B7280', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              📍 No GPS location yet — placeholder position
            </div>
          )}

          {/* Expiry Warning */}
          {warning && (
            <div style={{ marginBottom: '8px', padding: '6px 8px', borderRadius: '6px', background: warning.type === 'expired' ? '#FEF2F2' : '#FFFBEB', border: `1px solid ${warning.type === 'expired' ? '#FECACA' : '#FDE68A'}`, color: warning.type === 'expired' ? '#EF4444' : '#F59E0B', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              ⚠️ {warning.text}
            </div>
          )}

          {/* Stats list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
            {[
              { label: 'Vehicle Name', value: vehicle.name },
              { label: 'Today Distance', value: `${Math.round(vehicle.today_distance || 0)} km` },
              { label: 'Speed',    value: `${Math.round(vehicle.current_speed || 0)} km/h` },
              { label: 'ACC Status', value: vehicle.current_ignition ? 'ON' : 'OFF' },
              { label: 'Loc Time', value: formatLocalTime(vehicle.last_seen) },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 4px' }}>
                <span style={{ fontSize: '11px', color: '#6b7280' }}>{item.label}</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#111827' }}>- {item.value}</span>
              </div>
            ))}
          </div>

          {/* Links */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e5e7eb', paddingTop: '10px', paddingBottom: '4px', marginTop: '8px', fontSize: '10px', fontWeight: 700 }}>
            <span onClick={() => navigate('/admin/reports')} style={{ color: '#f97316', cursor: 'pointer' }}>Reports</span>
            <span onClick={() => navigate(`/vehicles/${vehicle.id}`)} style={{ color: '#f97316', cursor: 'pointer' }}>Track</span>
            <span onClick={() => navigate(`/vehicles/${vehicle.id}/history`)} style={{ color: '#f97316', cursor: 'pointer' }}>History</span>
          </div>
        </div>
      </Popup>
    </Marker>
  );
};

// ── Dynamic Vehicle Markers Layer ──────────────────────────────────────
const VehicleMarkersLayer = ({ vehicles, allSelected, onMarkerClick }) => {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on('zoomend', onZoom);
    return () => { map.off('zoomend', onZoom); };
  }, [map]);

  // ── Step 1: resolve / validate every vehicle's coordinates ──────────
  const resolved = vehicles.map((vehicle, idx) => {
    let finalLat = parseFloat(vehicle.lat);
    let finalLng = parseFloat(vehicle.lng);
    const hasValidCoords = !isNaN(finalLat) && !isNaN(finalLng)
      && finalLat !== 0 && finalLng !== 0
      && finalLat > 6  && finalLat < 38
      && finalLng > 68 && finalLng < 98;

    if (!hasValidCoords) {
      finalLat = 17.3411 + (idx * 0.003);
      finalLng = 78.5317 + (idx * 0.003);
    }
    return { vehicle, finalLat, finalLng, hasValidCoords, origIdx: idx, _clusterRank: 0 };
  });

  // ── Step 2: Screen-space visual height spread ──────────────────────
  const PIXEL_THRESHOLD = 30; // 30px visual overlap grouping
  const visited = new Set();

  resolved.forEach((item, i) => {
    if (visited.has(i)) return;
    const itemPoint = map.latLngToLayerPoint([item.finalLat, item.finalLng]);
    const cluster = [i];

    resolved.forEach((other, j) => {
      if (j === i || visited.has(j)) return;
      const otherPoint = map.latLngToLayerPoint([other.finalLat, other.finalLng]);
      const dx = itemPoint.x - otherPoint.x;
      const dy = itemPoint.y - otherPoint.y;
      if (dx * dx + dy * dy < PIXEL_THRESHOLD * PIXEL_THRESHOLD) {
        cluster.push(j);
      }
    });

    if (cluster.length > 1) {
      cluster.forEach((ci, rank) => {
        visited.add(ci);
        resolved[ci]._clusterRank = rank; // rank > 0 makes the pin taller
      });
    } else {
      visited.add(i);
    }
  });

  // ── Step 3: Render Markers ──────────────────────────────────────────
  return resolved.map(({ vehicle, finalLat, finalLng, hasValidCoords, _clusterRank }) => {
    const safeVehicle = {
      ...vehicle,
      lat: finalLat,
      lng: finalLng,
      _noGps: !hasValidCoords,
      _clusterRank: _clusterRank
    };
    // Displaced pins get a higher z-index so they always appear above
    const zOffset = (_clusterRank || 0) * 200;

    return (
      <VehicleMarker
        key={safeVehicle.id}
        vehicle={safeVehicle}
        isSelected={allSelected.some(sv => sv.id === safeVehicle.id)}
        onMarkerClick={onMarkerClick}
        zIndexOffset={zOffset}
      />
    );
  });
};

// Auto-resize map when container dimensions change
const ResizeMap = () => {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
};

const FleetMap = ({ 
  vehicles = [], 
  selectedVehicle = null, 
  selectedVehicles = null, 
  onMarkerClick,
  showRoute = false,
  followSelected = false
}) => {
  // Support both singular (CustomerDashboard) and plural (TrackingPage) prop patterns
  // selectedVehicles (array) takes priority; fall back to singular selectedVehicle
  const effectiveSelected = selectedVehicles != null
    ? (Array.isArray(selectedVehicles) ? selectedVehicles[0] || null : selectedVehicles)
    : selectedVehicle;

  const allSelected = selectedVehicles != null
    ? (Array.isArray(selectedVehicles) ? selectedVehicles : [selectedVehicles])
    : (selectedVehicle ? [selectedVehicle] : []);
  const [mapType, setMapType] = useState('osm'); // 'osm' or 'google'

  // Default map center for Karmanghat, Hyderabad (FuelTracks Office)
  const defaultCenter = [17.3411, 78.5317];
  const mapCenter = effectiveSelected && effectiveSelected.lat && effectiveSelected.lng
    ? [parseFloat(effectiveSelected.lat), parseFloat(effectiveSelected.lng)]
    : vehicles.length > 0 && vehicles[0].lat && vehicles[0].lng
      ? [parseFloat(vehicles[0].lat), parseFloat(vehicles[0].lng)]
      : defaultCenter;

  return (
    <div className="w-full h-full relative border border-slate-200 rounded-xl overflow-hidden shadow-sm" style={{ zIndex: 1 }}>
      {/* Map type selector overlay */}
      <div style={{
        position: 'absolute',
        top: '12px',
        left: '12px',
        zIndex: 1000,
        background: '#ffffff',
        border: '1px solid #bae6fd',
        borderRadius: '8px',
        padding: '6px 10px',
        boxShadow: '0 2px 10px rgba(249,115,22,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#4d6076' }}>Map Type:</span>
        <select
          value={mapType}
          onChange={(e) => setMapType(e.target.value)}
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#f97316',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            cursor: 'pointer'
          }}
        >
          <option value="osm">OSM</option>
          <option value="google">Google Maps</option>
          <option value="satellite">Satellite View</option>
        </select>
      </div>

      <MapContainer
        center={mapCenter}
        zoom={5}
        className="w-full h-full"
        zoomControl={false}
        zoomAnimation={true}
        fadeAnimation={true}
        markerZoomAnimation={true}
      >
        <ResizeMap />

        {/* Dynamic Tile Layer based on mapType */}
        <TileLayer
          attribution={mapType === 'osm' ? '&copy; OpenStreetMap contributors' : '&copy; Google Maps'}
          url={mapType === 'osm'
            ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            : mapType === 'satellite'
              ? "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
              : "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          }
        />

        {/* Handle map zooming and vehicle route plotting */}
        <VehicleRouteAndFit 
          selectedVehicle={effectiveSelected} 
          showRoute={showRoute}
          followSelected={followSelected}
        />

        {/* Vehicle Markers — Dynamic screen-space clustering */}
        <VehicleMarkersLayer
          vehicles={vehicles}
          allSelected={allSelected}
          onMarkerClick={onMarkerClick}
        />
      </MapContainer>

      <style dangerouslySetInnerHTML={{
        __html: `
          .premium-popup .leaflet-popup-content-wrapper {
            border: none !important;
            border-top: 10px solid #2E4867 !important;
            border-radius: 12px !important;
            box-shadow: 0 4px 16px rgba(0,0,0,0.2) !important;
            padding: 0 !important;
          }
          .premium-popup .leaflet-popup-content {
            margin: 14px 18px !important;
          }
          /* Optionally hide the tip */
          .premium-popup .leaflet-popup-tip-container {
            display: none !important;
          }
          
          /* Prevent Leaflet's rectangular bounding box from blocking hover events for overlapping markers */
          .custom-marker-icon {
            pointer-events: none !important;
            background: transparent !important;
            border: none !important;
          }
          .custom-marker-icon .pin-interactive {
            pointer-events: auto !important;
            cursor: pointer;
          }
        `
      }} />
    </div>
  );
};

export default FleetMap;
