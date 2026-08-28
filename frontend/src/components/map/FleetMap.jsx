import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { MapContainer, TileLayer, Marker, Tooltip, Polyline, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import { Truck, User } from 'lucide-react';
import { formatSpeed, getBatteryStatus } from '../../utils/formatUtils';
import { formatLocalTime, getNoDataDuration } from '../../utils/dateUtils';
import LocationDisplay from '../ui/LocationDisplay';
import { useProfile } from '../../modules/profile/hooks/useProfile';



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
const VehicleRouteAndFit = ({ selectedVehicle, selectedVehicles = [], vehicles = [], showRoute = false, followSelected = false }) => {
  const map = useMap();
  const [routePoints, setRoutePoints] = useState([]);
  const [liveTrail, setLiveTrail] = useState([]);
  const hasFitInitially = useRef(false);
  const prevVehicleIdRef = useRef(selectedVehicle?.id);

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
  }, [selectedVehicle?.id, selectedVehicles, showRoute]);

  // 1. Zoom to selected vehicle
  useEffect(() => {
    const targetVehicle = selectedVehicle || (selectedVehicles && selectedVehicles[0]);
    if (!targetVehicle?.id) return;

    let lat = parseFloat(targetVehicle.lat);
    let lng = parseFloat(targetVehicle.lng);
    const hasValidCoords = !isNaN(lat) && !isNaN(lng) && lat > 6.5 && lat < 37.5 && lng > 68.0 && lng < 98.0;

    if (!hasValidCoords && vehicles && vehicles.length > 0) {
      const idx = vehicles.findIndex(v => v.id === targetVehicle.id);
      lat = 17.3411 + (Math.max(0, idx) * 0.003);
      lng = 78.5317 + (Math.max(0, idx) * 0.003);
    }

    if (!isNaN(lat) && !isNaN(lng)) {
      map.setView([lat, lng], 16, { animate: true, duration: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicle?.id, selectedVehicles?.[0]?.id]);


  // 2. Zoom out/Fit Bounds when no vehicle selected
  useEffect(() => {
    const targetVehicle = selectedVehicle || (selectedVehicles && selectedVehicles[0]);
    if (targetVehicle) {
      hasFitInitially.current = false;
      return;
    }

    if (!hasFitInitially.current) {
      // Don't trigger fit bounds or fallback if vehicles haven't loaded yet
      if (!vehicles || vehicles.length === 0) {
        return;
      }

      const validCoords = vehicles
        .filter(v => v.lat && v.lng)
        .map(v => [parseFloat(v.lat), parseFloat(v.lng)])
        .filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]) && coord[0] !== 0 && coord[1] !== 0);

      if (validCoords.length > 0) {
        const bounds = L.latLngBounds(validCoords);
        setTimeout(() => {
          map.invalidateSize();
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: false });
        }, 100);
        hasFitInitially.current = true;
      } else {
        // Fallback only if we have vehicles but none have valid coords
        setTimeout(() => {
          map.setView([22.5937, 78.9629], 5, { animate: false });
        }, 100);
        hasFitInitially.current = true;
      }
    }
  }, [selectedVehicle, selectedVehicles, vehicles, map, followSelected]);

  // 3. Smoothly pan to follow vehicle as it moves in real time
  useEffect(() => {
    const targetId = selectedVehicle?.id || (selectedVehicles && selectedVehicles[0]?.id);
    if (!followSelected || !targetId) return;

    // ALways fetch the freshest coordinate from the vehicles array
    const latestTarget = vehicles?.find(v => v.id === targetId);
    if (!latestTarget) return;

    let lat = parseFloat(latestTarget.lat);
    let lng = parseFloat(latestTarget.lng);
    const hasValidCoords = !isNaN(lat) && !isNaN(lng) && lat > 6.5 && lat < 37.5 && lng > 68.0 && lng < 98.0;

    if (!hasValidCoords && vehicles && vehicles.length > 0) {
      const idx = vehicles.findIndex(v => v.id === targetId);
      lat = 17.3411 + (Math.max(0, idx) * 0.003);
      lng = 78.5317 + (Math.max(0, idx) * 0.003);
    }

    if (!isNaN(lat) && !isNaN(lng)) {
      // Smoothly pan camera to vehicle's new position - matching the exact behavior of VehicleMap.jsx
      map.setView([lat, lng], map.getZoom(), { animate: true, duration: 1.0 });
      
      const isNewVehicle = prevVehicleIdRef.current !== targetId;
      prevVehicleIdRef.current = targetId;

      // Append the live point to the route trail so it follows the vehicle
      setRoutePoints(prev => {
        const base = isNewVehicle ? [] : prev;
        const last = base[base.length - 1];
        if (!last || last.lat !== lat || last.lng !== lng) {
          return [...base, { lat, lng }];
        }
        return base;
      });

      // Keep a trail of the last 10 points for the dashed line
      setLiveTrail(prev => {
        const base = isNewVehicle ? [] : prev;
        const nextList = [...base, [lat, lng]];
        if (nextList.length > 10) nextList.shift();
        return nextList;
      });
    }
  }, [selectedVehicle, selectedVehicles, map, followSelected, vehicles]);

  const positions = routePoints.length > 0 ? routePoints.map(p => [parseFloat(p.lat), parseFloat(p.lng)]) : [];
  const segments = splitIntoSegments(positions);

  return (
    <>
      {segments.map((seg, idx) => seg.length > 1 && (
        <React.Fragment key={idx}>
          <Polyline positions={seg} color="#0EA5E9" weight={4} opacity={0.7} />
          <Polyline positions={seg} color="#38BDF8" weight={2} opacity={1} />
        </React.Fragment>
      ))}
      
      {/* Live Trail Polyline (like VehicleMap) */}
      {liveTrail.length > 1 && (
        <Polyline
          positions={liveTrail}
          color="#3b82f6"
          weight={4}
          opacity={0.8}
          dashArray="5, 10"
        />
      )}
    </>
  );
};

import { getVehicleType, getVehicleStatus, STATUS_CONFIG, createPinIcon, createTeardropIcon } from '../../utils/markerUtils';

const VehicleMarker = ({ vehicle, isSelected, onMarkerClick, zIndexOffset = 0 }) => {
  const markerRef = useRef(null);
  const navigate = useNavigate();
  const map = useMap();

  useEffect(() => {
    if (isSelected && markerRef.current) {
      try {
        map.closePopup(); // Forcefully close any stuck popups
        markerRef.current.openPopup();
      } catch (e) {
        console.error("Popup open error:", e);
      }
    } else if (!isSelected && markerRef.current) {
      markerRef.current.closePopup();
    }
  }, [isSelected, map]);

  const status = getVehicleStatus(vehicle);
  const cfg = STATUS_CONFIG[status];
  const noGps = !!vehicle._noGps;
  const position = [parseFloat(vehicle.lat), parseFloat(vehicle.lng)];
  const warning = getExpiryWarning(vehicle.licence_expire_date);
  const clusterRank = vehicle._clusterRank || 0;

  return (
    <Marker
      position={position}
      icon={createPinIcon(vehicle, noGps, clusterRank, {
        speed: Math.round(vehicle.current_speed || 0),
        course: vehicle.current_direction || vehicle.direction || vehicle.course || vehicle.heading || 0,
        status: status
      })}
      ref={markerRef}
      zIndexOffset={zIndexOffset}
      eventHandlers={{
        click: () => {
          if (onMarkerClick) onMarkerClick(vehicle);
          if (markerRef.current) markerRef.current.openPopup();
        }
      }}
    >
      <Popup
        className="premium-popup"
        closeButton={false}
        offset={[0, -5]}
        autoPan={false}
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
          {/* Stats list */}
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: '12px', rowGap: '6px', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: '#6b7280' }}>Vehicle Name</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#111827', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{vehicle.name}</span>

            <span style={{ fontSize: '11px', color: '#6b7280' }}>Today Distance</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#111827', textAlign: 'right' }}>{Math.round(vehicle.today_distance || 0)} kms</span>

            {getNoDataDuration(vehicle.last_seen) && status === 'offline' && (
              <>
                <span style={{ fontSize: '11px', color: '#6b7280' }}>No Data</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', textAlign: 'right' }}>{getNoDataDuration(vehicle.last_seen)}</span>

                <span style={{ fontSize: '11px', color: '#6b7280' }}>Reason</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', textAlign: 'right' }}>Device Offline</span>
              </>
            )}

            <span style={{ fontSize: '11px', color: '#6b7280' }}>ACC Status</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: vehicle.current_ignition ? '#16a34a' : '#ef4444', textAlign: 'right' }}>{vehicle.current_ignition ? 'ON' : 'OFF'}</span>

            <span style={{ fontSize: '11px', color: '#6b7280' }}>Vehicle Battery</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: getBatteryStatus(vehicle.current_voltage || vehicle.metadata?.batteryVoltage, vehicle.current_ignition).color, textAlign: 'right', whiteSpace: 'nowrap' }}>
              {getBatteryStatus(vehicle.current_voltage || vehicle.metadata?.batteryVoltage, vehicle.current_ignition).value} ({getBatteryStatus(vehicle.current_voltage || vehicle.metadata?.batteryVoltage, vehicle.current_ignition).status})
            </span>

            <span style={{ fontSize: '11px', color: '#6b7280' }}>Loc Time</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#111827', textAlign: 'right' }}>{formatLocalTime(vehicle.last_seen)}</span>

            <span style={{ fontSize: '11px', color: '#6b7280' }}>Comm Time</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#111827', textAlign: 'right' }}>{formatLocalTime(vehicle.last_seen)}</span>
          </div>

          {/* Links */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e5e7eb', paddingTop: '10px', paddingBottom: '4px', marginTop: '8px', fontSize: '10px', fontWeight: 700 }}>
            <a href="/admin/reports" style={{ color: '#f97316', textDecoration: 'none', cursor: 'pointer' }}>Reports</a>
            <a href={`/vehicles/${vehicle.id}`} style={{ color: '#f97316', textDecoration: 'none', cursor: 'pointer' }}>Track</a>
            <a href={`/vehicles/${vehicle.id}/history`} style={{ color: '#f97316', textDecoration: 'none', cursor: 'pointer' }}>History</a>
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
      && finalLat > 6 && finalLat < 38
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
    const isSelected = allSelected.some(sv => sv.id === safeVehicle.id);
    // Displaced pins get a higher z-index so they always appear above. Selected pins get massive boost.
    const zOffset = ((_clusterRank || 0) * 200) + (isSelected ? 10000 : 0);

    return (
      <VehicleMarker
        key={safeVehicle.id}
        vehicle={safeVehicle}
        isSelected={isSelected}
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
      if (map && map.getContainer()) {
        try {
          map.invalidateSize();
        } catch (e) {
          console.warn('Map resize adjustment failed:', e.message);
        }
      }
    });
    const container = map.getContainer();
    if (container) {
      observer.observe(container);
    }
    return () => {
      observer.disconnect();
    };
  }, [map]);
  return null;
};

const FleetMap = ({
  vehicles = [],
  selectedVehicle = null,
  selectedVehicles = null,
  onMarkerClick,
  showRoute = false,
  followSelected = false,
  nearbyRadius = null,
  isNearbyActive = false
}) => {
  const location = useLocation();
  // Support both singular (CustomerDashboard) and plural (TrackingPage) prop patterns
  // selectedVehicles (array) takes priority; fall back to singular selectedVehicle
  const effectiveSelected = selectedVehicles != null
    ? (Array.isArray(selectedVehicles) ? selectedVehicles[0] || null : selectedVehicles)
    : selectedVehicle;

  const allSelected = selectedVehicles != null
    ? (Array.isArray(selectedVehicles) ? selectedVehicles : [selectedVehicles])
    : (selectedVehicle ? [selectedVehicle] : []);
    
  const { profile } = useProfile();
  const apiKey = profile?.api_key || '';

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
        top: '64px',
        right: '12px',
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
        key={location.pathname}
        center={mapCenter}
        zoom={10}
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
              ? `https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}${apiKey ? '&key=' + apiKey : ''}`
              : `https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}${apiKey ? '&key=' + apiKey : ''}`
          }
        />

        {/* Radius Circle for Nearby Mode */}
        {isNearbyActive && effectiveSelected && effectiveSelected.lat && effectiveSelected.lng && (
          <Circle
            center={[effectiveSelected.lat, effectiveSelected.lng]}
            radius={nearbyRadius * 1000} // Radius is expected in meters for Circle
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.1,
              weight: 2,
              dashArray: '5, 5'
            }}
          />
        )}

        {/* Handle map zooming and vehicle route plotting */}
        <VehicleRouteAndFit
          selectedVehicle={effectiveSelected}
          vehicles={vehicles}
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
          @keyframes pulse-ring {
            0% { transform: translate(-50%, -50%) scale(0.85); opacity: 0.5; }
            80%, 100% { transform: translate(-50%, -50%) scale(1.4); opacity: 0; }
          }
        `
      }} />
    </div>
  );
};

export default FleetMap;
