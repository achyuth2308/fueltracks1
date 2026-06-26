import React, { useState, useEffect, useRef } from 'react';

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

const VehicleRouteAndFit = ({ selectedVehicle }) => {
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

  // 1. Fetch route history only when the selected vehicle ID changes
  useEffect(() => {
    if (!selectedVehicle?.id) {
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
    if (!selectedVehicle) {
      map.setView([22.5937, 78.9629], 5, { animate: true, duration: 1.5 });
    }
  }, [selectedVehicle, map]);

  // 3. Smoothly pan to follow vehicle as it moves in real time
  useEffect(() => {
    if (!selectedVehicle?.id) return;
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
  const model = (vehicle.model || '').toLowerCase();
  const name = (vehicle.name || '').toLowerCase();

  if (model.includes('car') || name.includes('car')) return 'car';
  if (model.includes('bike') || name.includes('bike') || model.includes('motorcycle')) return 'bike';
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

// Custom SVG marker generator
const createVehicleIcon = (vehicle, statusColor) => {
  const type = getVehicleType(vehicle);
  const svg = getTopDownSvg(type);
  const direction = vehicle.current_direction || vehicle.direction || 0;

  const svgHtml = `
    <div style="
      display: flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      background-color: #ffffff;
      border: 2px solid ${statusColor};
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
      color: ${statusColor};
      transform: rotate(${direction}deg);
      transition: transform 0.5s linear;
    ">
      ${svg}
    </div>
  `;

  return L.divIcon({
    html: svgHtml,
    className: 'custom-leaflet-animated-icon',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -19],
  });
};

const VehicleMarker = ({ vehicle, isSelected, onMarkerClick, onMultiTrackClick }) => {
  const markerRef = useRef(null);

  const isOnline = !!vehicle.is_online;
  const isMoving = isOnline && (vehicle.current_speed || 0) > 0;
  // User requested RED for offline (#ef4444)
  const statusColor = isOnline ? (isMoving ? '#16a34a' : '#f97316') : '#ef4444';
  const position = [parseFloat(vehicle.lat), parseFloat(vehicle.lng)];
  const warning = getExpiryWarning(vehicle.licence_expire_date);

  useEffect(() => {
    if (isSelected && markerRef.current) {
      setTimeout(() => {
        markerRef.current?.openPopup();
      }, 200);
    }
  }, [isSelected]);

  return (
    <Marker
      position={position}
      icon={createVehicleIcon(vehicle, statusColor)}
      ref={markerRef}
      title={warning ? `${vehicle.name} - ${warning.text}` : vehicle.name}
      eventHandlers={{
        click: () => onMarkerClick && onMarkerClick(vehicle),
      }}
    >
      <Tooltip
        direction="bottom"
        offset={[0, 15]}
        opacity={1}
        permanent
        className="premium-tooltip"
      >
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
          {vehicle.name} <span style={{ color: statusColor }}>({Math.round(vehicle.current_speed || 0)} km/h)</span>
        </div>
      </Tooltip>

      <Popup className="premium-popup">
        <div style={{ minWidth: '240px', fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '12px', padding: '2px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #bae6fd', paddingBottom: '6px', marginBottom: '8px' }}>
            <span style={{ fontWeight: 800, color: '#4d6076', fontSize: '13px' }}>{vehicle.name}</span>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: statusColor,
              boxShadow: `0 0 6px ${statusColor}`
            }} />
          </div>

          {/* Expiry Warning in Popup */}
          {warning && (
            <div style={{
              marginBottom: '8px', padding: '6px 8px', borderRadius: '6px',
              background: warning.type === 'expired' ? '#FEF2F2' : '#FFFBEB',
              border: `1px solid ${warning.type === 'expired' ? '#FECACA' : '#FDE68A'}`,
              color: warning.type === 'expired' ? '#EF4444' : '#F59E0B',
              fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              {warning.text}
            </div>
          )}

          {/* Details Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', color: '#4d6076' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6e859b', fontWeight: 600 }}>Vehicle Name</span>
              <span style={{ fontWeight: 700 }}>- {vehicle.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6e859b', fontWeight: 600 }}>Today Distance</span>
              <span style={{ fontWeight: 700 }}>- {vehicle.today_distance ? `${vehicle.today_distance} km` : '0 km'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6e859b', fontWeight: 600 }}>ACC Status</span>
              <span style={{ fontWeight: 700, color: vehicle.current_ignition ? '#16a34a' : '#ef4444' }}>
                - {vehicle.current_ignition ? 'ON' : 'OFF'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6e859b', fontWeight: 600 }}>Loc Time</span>
              <span style={{ fontWeight: 700 }}>- {formatLocalTime(vehicle.last_seen)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6e859b', fontWeight: 600 }}>Comm Time</span>
              <span style={{ fontWeight: 700 }}>- {formatLocalTime(vehicle.last_seen)}</span>
            </div>
            <LocationDisplay lat={vehicle.lat} lng={vehicle.lng} />
          </div>

          {/* Links Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #bae6fd', paddingTop: '8px', marginTop: '8px', fontSize: '10px', fontWeight: 700 }}>
            <a href={`/admin/reports`} style={{ color: '#f97316', textDecoration: 'none' }}>Reports</a>
            <a href={`/vehicles/${vehicle.id}`} style={{ color: '#f97316', textDecoration: 'none' }}>Track</a>
            <a href={`/vehicles/${vehicle.id}/history`} style={{ color: '#f97316', textDecoration: 'none' }}>History</a>

          </div>
        </div>
      </Popup>
    </Marker>
  );
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

const FleetMap = ({ vehicles = [], selectedVehicle = null, onMarkerClick }) => {
  const [mapType, setMapType] = useState('osm'); // 'osm' or 'google'

  // Default map center for Karmanghat, Hyderabad (FuelTracks Office)
  const defaultCenter = [17.3411, 78.5317];
  const mapCenter = selectedVehicle && selectedVehicle.lat && selectedVehicle.lng
    ? [parseFloat(selectedVehicle.lat), parseFloat(selectedVehicle.lng)]
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
        <VehicleRouteAndFit selectedVehicle={selectedVehicle} />

        {/* Vehicle Markers */}
        {vehicles
          .filter(v => v.lat != null && v.lng != null && !isNaN(parseFloat(v.lat)) && !isNaN(parseFloat(v.lng)))
          .map((vehicle) => {
            let finalLat = parseFloat(vehicle.lat);
            let finalLng = parseFloat(vehicle.lng);

            // HARD FAILSAFE: Absolutely NEVER allow a coordinate outside India.
            // India bounding box: Lat 8 to 38, Lng 68 to 98
            if (finalLat < 8 || finalLat > 38 || finalLng < 68 || finalLng > 98) {
              // Add tiny offset so markers don't permanently hide each other
              finalLat = 17.3411 + (Math.random() * 0.01 - 0.005);
              finalLng = 78.5317 + (Math.random() * 0.01 - 0.005);
            }

            const safeVehicle = { ...vehicle, lat: finalLat, lng: finalLng };

            return (
              <VehicleMarker
                key={safeVehicle.id}
                vehicle={safeVehicle}
                isSelected={selectedVehicle?.id === safeVehicle.id}
                onMarkerClick={onMarkerClick}
                onMultiTrackClick={null}
              />
            );
          })}
      </MapContainer>
    </div>
  );
};

export default FleetMap;
