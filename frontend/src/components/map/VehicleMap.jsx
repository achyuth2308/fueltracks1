import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Circle, Polygon, Tooltip, useMap, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import { useSocket } from '../../hooks/useSocket';
import { useLocation } from 'react-router-dom';
import axiosInstance from '../../api/axios';
import { normalizeCoordinates } from '../../utils/geofenceUtils';

const { BaseLayer } = LayersControl;

const FitBoundsToTrail = ({ coords }) => {
  const map = useMap();
  const prevCoordsLength = useRef(0);

  useEffect(() => {
    if (coords && coords.length > 0 && coords.length !== prevCoordsLength.current) {
      const isInitial = prevCoordsLength.current === 0;
      prevCoordsLength.current = coords.length;
      const latest = coords[coords.length - 1];
      map.setView(latest, 15, { animate: false });
    }
  }, [coords, map]);

  return null;
};

// Auto-resize map when container dimensions change (e.g., sidebar removed)
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

import { createPinIcon } from '../../utils/markerUtils';
import { useProfile } from '../../modules/profile/hooks/useProfile';
// removed GoogleMutantLayer

const VehicleMap = ({ vehicle, vehicleId, initialLat, initialLng, initialIgnition, initialSpeed }) => {
  const location = useLocation();
  const { socket, connected, joinVehicleRoom, leaveVehicleRoom } = useSocket();
  const [coords, setCoords] = useState([]);
  const [ignition, setIgnition] = useState(initialIgnition);
  const [speed, setSpeed] = useState(initialSpeed || 0);
  const [direction, setDirection] = useState(vehicle?.current_direction || 0);
  const isOnline = vehicle?.is_online !== false;

  const [geofences, setGeofences] = useState([]);
  const [showGeofences, setShowGeofences] = useState(true);

  // Fetch assigned geofences for this vehicle
  useEffect(() => {
    const vId = vehicleId || vehicle?.id;
    if (!vId) return;
    axiosInstance.get(`/api/vehicles/${vId}/geofences`)
      .then((res) => {
        if (res.data?.success && Array.isArray(res.data.data)) {
          setGeofences(res.data.data);
        }
      })
      .catch(() => {});
  }, [vehicleId, vehicle?.id]);

  const { profile } = useProfile();
  const apiKey = profile?.api_key || '';

  // Track coordinates history (max 10 points for the path trail)
  useEffect(() => {
    if (initialLat && initialLng) {
      const lat = parseFloat(initialLat);
      const lng = parseFloat(initialLng);
      // Ensure we don't plot glitchy (0,0) or out-of-India coordinates (e.g. Niger, Africa)
      const isValid = lat !== 0 && lng !== 0 && lat > 6.0 && lat < 38.0 && lng > 65.0 && lng < 100.0;
      if (isValid) {
        setCoords([[lat, lng]]);
      }
    }
  }, [initialLat, initialLng]);

  // Handle live WebSocket tracking streams
  useEffect(() => {
    if (!vehicleId || !connected) return;

    // Join vehicle tracking room
    joinVehicleRoom(vehicleId);

    if (socket) {
      const handleLocationUpdate = (data) => {
        if (data.vehicleId === vehicleId && data.lat && data.lng) {
          const nextPos = [parseFloat(data.lat), parseFloat(data.lng)];
          setCoords((prev) => {
            const nextList = [...prev, nextPos];
            // Keep maximum 10 latest coordinates for the path trail
            if (nextList.length > 10) nextList.shift();
            return nextList;
          });
          setIgnition(!!data.ignition);
          setSpeed(data.speed || 0);
          if (data.direction !== undefined) {
             setDirection(data.direction);
          }
        }
      };

      socket.on('location:update', handleLocationUpdate);

      return () => {
        socket.off('location:update', handleLocationUpdate);
        leaveVehicleRoom(vehicleId);
      };
    }
  }, [socket, connected, vehicleId]);

  const defaultCenter = [20.5937, 78.9629];
  const center = coords.length > 0 ? coords[coords.length - 1] : defaultCenter;
  
  // Calculate status color matching dashboard logic
  const isMoving = ignition && speed > 3;
  const statusColor = isOnline ? (isMoving ? '#10b981' : (ignition ? '#f59e0b' : '#ef4444')) : '#64748b';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '12px',
        isolation: 'isolate',
        contain: 'paint'
      }}
      className="border border-slate-200 shadow-sm"
    >
      <MapContainer
        key={location.pathname}
        center={center}
        zoom={15}
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        zoomControl={false}
      >
        <ResizeMap />
        <LayersControl position="topleft">
          <BaseLayer checked name="OpenStreetMap Standard (OSM)">
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </BaseLayer>
          <BaseLayer name="Google Maps">
            <TileLayer
              attribution='&copy; Google'
              url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
              maxNativeZoom={20}
              maxZoom={22}
            />
          </BaseLayer>
          <BaseLayer name="Google Satellite">
            <TileLayer
              attribution='&copy; Google'
              url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
              maxNativeZoom={20}
              maxZoom={22}
            />
          </BaseLayer>
        </LayersControl>

        {coords.length > 0 && <FitBoundsToTrail coords={coords} />}

        {/* Trail Polyline */}
        {coords.length > 1 && (
          <Polyline
            positions={coords}
            color="#3b82f6"
            weight={4}
            opacity={0.8}
            dashArray="5, 10"
          />
        )}

        {/* Live Truck Marker */}
        {coords.length > 0 && (
          <Marker
            position={coords[coords.length - 1]}
            icon={createPinIcon(vehicle, false, 0, {
              status: isOnline ? (isMoving ? 'running' : (ignition ? 'idle' : 'offline')) : 'offline',
              speed: speed,
              course: direction
            })}
          />
        )}

        {/* Assigned Geofences Overlay */}
        {showGeofences && geofences.map((geo) => {
          const color = geo.color || '#3B82F6';
          if (geo.type === 'circle' && geo.center_lat && geo.center_lng) {
            return (
              <Circle
                key={geo.id}
                center={[parseFloat(geo.center_lat), parseFloat(geo.center_lng)]}
                radius={parseFloat(geo.radius) || 200}
                pathOptions={{
                  color: color,
                  fillColor: color,
                  fillOpacity: 0.18,
                  weight: 2,
                }}
              >
                <Tooltip permanent direction="center">
                  <span style={{ fontSize: '11px', fontWeight: 800, color: color }}>
                    {geo.name}
                  </span>
                </Tooltip>
              </Circle>
            );
          } else if (geo.type === 'polygon' && geo.coordinates) {
            const pts = normalizeCoordinates(geo.coordinates);
            if (pts.length >= 3) {
              return (
                <Polygon
                  key={geo.id}
                  positions={pts.map((p) => [p.lat, p.lng])}
                  pathOptions={{
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.18,
                    weight: 2,
                  }}
                >
                  <Tooltip permanent direction="center">
                    <span style={{ fontSize: '11px', fontWeight: 800, color: color }}>
                      {geo.name}
                    </span>
                  </Tooltip>
                </Polygon>
              );
            }
          }
          return null;
        })}
      </MapContainer>

      {/* Geofences Toggle Button */}
      {geofences.length > 0 && (
        <button
          type="button"
          onClick={() => setShowGeofences(!showGeofences)}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            zIndex: 1000,
            background: showGeofences ? '#0284C7' : '#FFFFFF',
            color: showGeofences ? '#FFFFFF' : '#334155',
            border: '1px solid #CBD5E1',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '11px',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
          title={showGeofences ? "Hide geofences on map" : "Show geofences on map"}
        >
          <span>🛡️ Geofences ({geofences.length})</span>
        </button>
      )}
    </div>
  );
};

export default VehicleMap;
