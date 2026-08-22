import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import { useSocket } from '../../hooks/useSocket';

const { BaseLayer } = LayersControl;

const FitBoundsToTrail = ({ coords }) => {
  const map = useMap();
  const prevCoordsLength = useRef(0);

  useEffect(() => {
    if (coords && coords.length > 0 && coords.length !== prevCoordsLength.current) {
      prevCoordsLength.current = coords.length;
      // Fly to the latest coordinate
      const latest = coords[coords.length - 1];
      map.setView(latest, 15, { animate: true, duration: 1 });
    }
  }, [coords, map]);

  return null;
};

// Auto-resize map when container dimensions change (e.g., sidebar removed)
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

import { createPinIcon } from '../../utils/markerUtils';

const VehicleMap = ({ vehicle, vehicleId, initialLat, initialLng, initialIgnition, initialSpeed }) => {
  const { socket, joinVehicleRoom, leaveVehicleRoom } = useSocket();
  const [coords, setCoords] = useState([]);
  const [ignition, setIgnition] = useState(initialIgnition);
  const [speed, setSpeed] = useState(initialSpeed || 0);
  const [direction, setDirection] = useState(vehicle?.current_direction || 0);
  const isOnline = vehicle?.is_online !== false;

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
    if (!vehicleId) return;

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
  }, [socket, vehicleId]);

  const defaultCenter = [20.5937, 78.9629];
  const center = coords.length > 0 ? coords[coords.length - 1] : defaultCenter;
  
  // Calculate status color matching dashboard logic
  const isMoving = speed > 0;
  const statusColor = isOnline ? (isMoving ? '#10b981' : (ignition ? '#f59e0b' : '#ef4444')) : '#64748b';

  return (
    <div className="w-full h-full border border-slate-200 rounded-xl overflow-hidden shadow-sm relative">
      <MapContainer
        center={center}
        zoom={15}
        className="w-full h-full"
        zoomControl={false}
      >
        <ResizeMap />
        <LayersControl position="topleft">
          <BaseLayer checked name="Modern Light">
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </BaseLayer>
          <BaseLayer name="Google Maps">
            <TileLayer
              attribution='&copy; Google Maps'
              url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            />
          </BaseLayer>
          <BaseLayer name="Google Satellite">
            <TileLayer
              attribution='&copy; Google Maps'
              url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
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
      </MapContainer>
    </div>
  );
};

export default VehicleMap;
