import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Truck, Navigation, Play, User, Phone } from 'lucide-react';
import { formatSpeed } from '../../utils/formatUtils';
import { formatLocalTime } from '../../utils/dateUtils';

// Helper component to center/fly map to a selected coordinate
const ChangeMapView = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.setView([lat, lng], 14, {
        animate: true,
        duration: 1.5,
      });
    }
  }, [lat, lng, map]);
  return null;
};

// Helper component to auto-fit map bounds to all vehicles
const FitBoundsToVehicles = ({ vehicles, selectedVehicle }) => {
  const map = useMap();
  useEffect(() => {
    if (selectedVehicle) return; // let ChangeMapView handle it

    const validVehicles = vehicles.filter(v => v.lat && v.lng);
    if (validVehicles.length > 0) {
      const bounds = L.latLngBounds(validVehicles.map(v => [parseFloat(v.lat), parseFloat(v.lng)]));
      // Give it a small timeout to ensure map container has its final dimensions
      setTimeout(() => {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: true, duration: 1 });
      }, 100);
    }
  }, [vehicles, selectedVehicle, map]);
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
      background-color: #ffffff;
      border: 2px solid ${statusColor};
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
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

const VehicleMarker = ({ vehicle, isSelected, onMarkerClick }) => {
  const markerRef = useRef(null);

  const isOnline = !!vehicle.is_online;
  const isMoving = isOnline && (vehicle.current_speed || 0) > 0;
  const statusColor = isOnline ? (isMoving ? '#16a34a' : '#f97316') : '#6b7280';
  const position = [parseFloat(vehicle.lat), parseFloat(vehicle.lng)];

  useEffect(() => {
    if (isSelected && markerRef.current) {
      // Small timeout to allow map to pan before opening popup, preventing glitches
      setTimeout(() => {
        markerRef.current?.openPopup();
      }, 200);
    }
  }, [isSelected]);

  return (
    <Marker
      position={position}
      icon={createTruckIcon(statusColor)}
      ref={markerRef}
      eventHandlers={{
        click: () => onMarkerClick && onMarkerClick(vehicle),
      }}
    >
      <Popup className="premium-popup">
        <div className="w-56 font-sans">
          {/* Header */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-2 mb-2">
            <div>
              <h4 className="font-bold text-slate-800 text-sm">{vehicle.name}</h4>
              <span className="text-[10px] text-slate-500 font-mono">{vehicle.plate}</span>
            </div>
            <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500 pulse-green' : 'bg-slate-400'}`} />
          </div>

          {/* Details Rows */}
          <div className="space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Status</span>
              <span className={`font-semibold ${isOnline ? 'text-green-600' : 'text-slate-500'}`}>
                {isOnline ? (isMoving ? 'Moving' : 'Stopped') : 'Offline'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Current Speed</span>
              <span className="font-bold text-slate-800">{formatSpeed(vehicle.current_speed)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Fuel Level</span>
              <span className="font-bold text-slate-800">{vehicle.current_fuel !== undefined && vehicle.current_fuel !== null ? `${Number(vehicle.current_fuel).toFixed(1)}%` : '0%'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Ignition</span>
              <span className={`font-semibold ${vehicle.current_ignition ? 'text-green-600' : 'text-slate-500'}`}>
                {vehicle.current_ignition ? 'ON' : 'OFF'}
              </span>
            </div>
            {vehicle.driver_name && (
              <div className="border-t border-slate-200 pt-1.5 mt-1.5 flex items-center space-x-1.5 text-[11px]">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-600 truncate">{vehicle.driver_name}</span>
              </div>
            )}
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
  // Default map center for India
  const defaultCenter = [20.5937, 78.9629];
  const mapCenter = selectedVehicle?.lat && selectedVehicle?.lng
    ? [parseFloat(selectedVehicle.lat), parseFloat(selectedVehicle.lng)]
    : vehicles.length > 0 && vehicles[0].lat && vehicles[0].lng
      ? [parseFloat(vehicles[0].lat), parseFloat(vehicles[0].lng)]
      : defaultCenter;

  return (
    <div className="w-full h-full relative border border-slate-200 rounded-xl overflow-hidden shadow-sm" style={{ zIndex: 1 }}>
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
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Auto-fit map to all vehicles */}
        <FitBoundsToVehicles vehicles={vehicles} selectedVehicle={selectedVehicle} />

        {/* Dynamic Map panning */}
        {selectedVehicle?.lat && selectedVehicle?.lng && (
          <ChangeMapView
            lat={parseFloat(selectedVehicle.lat)}
            lng={parseFloat(selectedVehicle.lng)}
          />
        )}

        {/* Vehicle Markers */}
        {vehicles
          .filter(v => v.lat && v.lng)
          .map((vehicle) => (
            <VehicleMarker
              key={vehicle.id}
              vehicle={vehicle}
              isSelected={selectedVehicle?.id === vehicle.id}
              onMarkerClick={onMarkerClick}
            />
          ))}
      </MapContainer>
    </div>
  );
};

export default FleetMap;
