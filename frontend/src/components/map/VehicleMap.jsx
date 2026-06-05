import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useSocket } from '../../hooks/useSocket';
import { Truck } from 'lucide-react';

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

// SVG truck icon generator
const createLiveTruckIcon = (ignition) => {
  const color = ignition ? '#22c55e' : '#ef4444'; // green if ignition is ON, else red
  const svgHtml = `
    <div style="
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      background-color: #0f172a;
      border: 3px solid ${color};
      border-radius: 50%;
      box-shadow: 0 0 15px ${color}, inset 0 0 6px ${color};
      color: ${color};
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="animate-pulse">
        <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
        <path d="M19 18h2a1 1 0 0 0 1-1v-5.14a1 1 0 0 0-.293-.707l-3.86-3.86A1 1 0 0 0 17.14 7H14"/>
        <circle cx="7.5" cy="18.5" r="2.5"/>
        <circle cx="16.5" cy="18.5" r="2.5"/>
      </svg>
    </div>
  `;

  return L.divIcon({
    html: svgHtml,
    className: 'custom-leaflet-live-icon',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
};

const VehicleMap = ({ vehicleId, initialLat, initialLng, initialIgnition }) => {
  const { socket, joinVehicleRoom, leaveVehicleRoom } = useSocket();
  const [coords, setCoords] = useState([]);
  const [ignition, setIgnition] = useState(initialIgnition);

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
            icon={createLiveTruckIcon(ignition)}
          />
        )}
      </MapContainer>
    </div>
  );
};

export default VehicleMap;
