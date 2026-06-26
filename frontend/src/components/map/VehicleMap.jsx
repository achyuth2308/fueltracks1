import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useSocket } from '../../hooks/useSocket';

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

const getVehicleType = (vehicle) => {
  if (!vehicle) return 'lorry';
  const model = (vehicle.model || '').toLowerCase();
  const name = (vehicle.name || '').toLowerCase();
  
  if (model.includes('car') || name.includes('car')) return 'car';
  if (model.includes('bike') || name.includes('bike') || model.includes('motorcycle') || model.includes('twowheeler')) return 'bike';
  if (model.includes('bus') || name.includes('bus')) return 'bus';
  if (model.includes('van') || name.includes('van')) return 'van';
  return 'lorry';
};

const getTopDownSvg = (type) => {
  if (type === 'car') {
    return `<img src="/long-car.png" style="width:28px;height:28px;object-fit:contain;" />`;
  } else if (type === 'bike') {
    return `<img src="/racing-motorbike.png" style="width:28px;height:28px;object-fit:contain;" />`;
  }
  // Default Lorry / Truck / Bus / Van
  return `<img src="/big-cargo-truck.png" style="width:28px;height:28px;object-fit:contain;" />`;
};

// Custom vehicle marker generator
const createVehicleIcon = (vehicle, statusColor, direction) => {
  const type = getVehicleType(vehicle);
  const svg = getTopDownSvg(type);

  const svgHtml = `
    <div style="
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      background-color: #ffffff;
      border: 3px solid ${statusColor};
      border-radius: 50%;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2), inset 0 0 6px ${statusColor};
      color: ${statusColor};
    ">
      ${svg}
    </div>
  `;

  return L.divIcon({
    html: svgHtml,
    className: 'custom-leaflet-live-icon',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
};

const VehicleMap = ({ vehicle, vehicleId, initialLat, initialLng, initialIgnition, initialSpeed }) => {
  const { socket, joinVehicleRoom, leaveVehicleRoom } = useSocket();
  const [coords, setCoords] = useState([]);
  const [ignition, setIgnition] = useState(initialIgnition);
  const [speed, setSpeed] = useState(initialSpeed || 0);
  const [direction, setDirection] = useState(vehicle?.current_direction || 0);
  const isOnline = vehicle?.is_online !== false;

  // Track coordinates history (max 10 points for the tail)
  useEffect(() => {
    if (initialLat && initialLng) {
      const position = [parseFloat(initialLat), parseFloat(initialLng)];
      setCoords([position]);
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
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

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
            icon={createVehicleIcon(vehicle, statusColor, direction)}
          />
        )}
      </MapContainer>
    </div>
  );
};

export default VehicleMap;
