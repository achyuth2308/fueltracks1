import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Truck, User } from 'lucide-react';
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
  const statusColor = isOnline ? (isMoving ? '#16a34a' : '#8ba0b5') : '#6b7280';
  const position = [parseFloat(vehicle.lat), parseFloat(vehicle.lng)];

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
      icon={createTruckIcon(statusColor)}
      ref={markerRef}
      eventHandlers={{
        click: () => onMarkerClick && onMarkerClick(vehicle),
      }}
    >
      <Popup className="premium-popup">
        <div style={{ minWidth: '240px', fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '12px', padding: '2px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #dfd0bf', paddingBottom: '6px', marginBottom: '8px' }}>
            <span style={{ fontWeight: 800, color: '#4d6076', fontSize: '13px' }}>{vehicle.name}</span>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isOnline ? (isMoving ? '#16a34a' : '#8ba0b5') : '#6b7280',
              boxShadow: `0 0 6px ${isOnline ? (isMoving ? '#16a34a' : '#8ba0b5') : '#6b7280'}`
            }} />
          </div>

          {/* Details Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', color: '#4d6076' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6e859b', fontWeight: 600 }}>Vehicle Name</span>
              <span style={{ fontWeight: 700 }}>- {vehicle.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6e859b', fontWeight: 600 }}>Today Distance</span>
              <span style={{ fontWeight: 700 }}>- {vehicle.today_distance || '0 km'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6e859b', fontWeight: 600 }}>Idle</span>
              <span style={{ fontWeight: 700 }}>- {vehicle.idle_duration || '00:00:00'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6e859b', fontWeight: 600 }}>ACC Status</span>
              <span style={{ fontWeight: 700, color: vehicle.current_ignition ? '#16a34a' : '#6b7280' }}>
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
          </div>

          {/* Links Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #dfd0bf', paddingTop: '8px', marginTop: '8px', fontSize: '10px', fontWeight: 700 }}>
            <a href={`/admin/reports`} style={{ color: '#8ba0b5', textDecoration: 'none' }}>Reports</a>
            <a href={`/vehicles/${vehicle.id}`} style={{ color: '#8ba0b5', textDecoration: 'none' }}>Track</a>
            <a href={`/vehicles/${vehicle.id}/history`} style={{ color: '#8ba0b5', textDecoration: 'none' }}>History</a>
            <span style={{ color: '#b8a693', cursor: 'not-allowed' }}>MultiTrack</span>
            <span style={{ color: '#b8a693', cursor: 'not-allowed' }}>Site</span>
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
  const mapCenter = selectedVehicle?.lat && selectedVehicle?.lng
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
        border: '1px solid #dfd0bf',
        borderRadius: '8px',
        padding: '6px 10px',
        boxShadow: '0 2px 10px rgba(139,160,181,0.15)',
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
            color: '#8ba0b5',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            cursor: 'pointer'
          }}
        >
          <option value="osm">OSM</option>
          <option value="google">Google Maps</option>
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
            : "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          }
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
