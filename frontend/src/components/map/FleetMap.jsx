import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Truck, Navigation, Play, User, Phone } from 'lucide-react';
import { formatSpeed } from '../../utils/formatUtils';
import { formatLocalTime } from '../../utils/dateUtils';

// Helper component to center/fly map to a selected coordinate
const ChangeMapView = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 13, {
        animate: true,
        duration: 1.5,
      });
    }
  }, [center, map]);
  return null;
};

// Custom SVG truck marker generator
const createTruckIcon = (statusColor) => {
  const svgHtml = `
    <div style="
      display: flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      background-color: #1e293b;
      border: 2px solid ${statusColor};
      border-radius: 50%;
      box-shadow: 0 0 10px ${statusColor}77, inset 0 0 4px ${statusColor};
      color: ${statusColor};
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-truck">
        <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
        <path d="M19 18h2a1 1 0 0 0 1-1v-5.14a1 1 0 0 0-.293-.707l-3.86-3.86A1 1 0 0 0 17.14 7H14"/>
        <circle cx="7.5" cy="18.5" r="2.5"/>
        <circle cx="16.5" cy="18.5" r="2.5"/>
      </svg>
    </div>
  `;

  return L.divIcon({
    html: svgHtml,
    className: 'custom-leaflet-truck-icon',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -19],
  });
};

const FleetMap = ({ vehicles = [], selectedVehicle = null, onMarkerClick }) => {
  // Default map center (India coords or first vehicle)
  const defaultCenter = [20.5937, 78.9629];
  const mapCenter = selectedVehicle?.lat && selectedVehicle?.lng
    ? [parseFloat(selectedVehicle.lat), parseFloat(selectedVehicle.lng)]
    : vehicles.length > 0 && vehicles[0].lat && vehicles[0].lng
      ? [parseFloat(vehicles[0].lat), parseFloat(vehicles[0].lng)]
      : defaultCenter;

  return (
    <div className="w-full h-full relative dark-map border border-slate-800/80 rounded-xl overflow-hidden shadow-2xl">
      <MapContainer
        center={mapCenter}
        zoom={5}
        className="w-full h-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CartoDB</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* Dynamic Map panning */}
        {selectedVehicle?.lat && selectedVehicle?.lng && (
          <ChangeMapView center={[parseFloat(selectedVehicle.lat), parseFloat(selectedVehicle.lng)]} />
        )}

        {/* Vehicle Markers */}
        {vehicles
          .filter(v => v.lat && v.lng)
          .map((vehicle) => {
            const isOnline = !!vehicle.is_online;
            const isMoving = isOnline && (vehicle.current_speed || 0) > 0;
            
            // Color mapping: green (moving), red (idle/stopped), gray (offline)
            const statusColor = isOnline 
              ? isMoving ? '#22c55e' : '#ef4444' 
              : '#94a3b8';

            const position = [parseFloat(vehicle.lat), parseFloat(vehicle.lng)];

            return (
              <Marker
                key={vehicle.id}
                position={position}
                icon={createTruckIcon(statusColor)}
                eventHandlers={{
                  click: () => onMarkerClick && onMarkerClick(vehicle),
                }}
              >
                <Popup className="premium-popup">
                  <div className="w-56 font-sans">
                    {/* Header */}
                    <div className="flex justify-between items-start border-b border-slate-700/60 pb-2 mb-2">
                      <div>
                        <h4 className="font-bold text-slate-100 text-sm">{vehicle.name}</h4>
                        <span className="text-[10px] text-slate-400 font-mono">{vehicle.plate}</span>
                      </div>
                      <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500 pulse-green' : 'bg-slate-500'}`} />
                    </div>

                    {/* Details Rows */}
                    <div className="space-y-1.5 text-xs text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Status</span>
                        <span className={`font-semibold ${isOnline ? 'text-green-400' : 'text-slate-400'}`}>
                          {isOnline ? (isMoving ? 'Moving' : 'Stopped') : 'Offline'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Current Speed</span>
                        <span className="font-bold text-slate-100">{formatSpeed(vehicle.current_speed)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Fuel Level</span>
                        <span className="font-bold text-slate-100">{vehicle.current_fuel !== undefined && vehicle.current_fuel !== null ? `${Number(vehicle.current_fuel).toFixed(1)}%` : '0%'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Ignition</span>
                        <span className={`font-semibold ${vehicle.current_ignition ? 'text-green-400' : 'text-slate-400'}`}>
                          {vehicle.current_ignition ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      {vehicle.driver_name && (
                        <div className="border-t border-slate-700/40 pt-1.5 mt-1.5 flex items-center space-x-1.5 text-[11px]">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-300 truncate">{vehicle.driver_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
      </MapContainer>
    </div>
  );
};

export default FleetMap;
