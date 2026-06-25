import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { formatSpeed } from '../../utils/formatUtils';
import { formatLocalTime } from '../../utils/dateUtils';
import { Eye, EyeOff } from 'lucide-react';

const FitBoundsToRoute = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (points && points.length > 0) {
      const validPoints = points.filter(p =>
        p.lat != null && p.lng != null &&
        !isNaN(parseFloat(p.lat)) && !isNaN(parseFloat(p.lng)) &&
        Math.abs(parseFloat(p.lat)) > 5.0 && Math.abs(parseFloat(p.lng)) > 5.0
      );
      if (validPoints.length > 0) {
        const bounds = validPoints.map(p => [parseFloat(p.lat), parseFloat(p.lng)]);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 17 });
      }
    }
  }, [points, map]);

  return null;
};


// Recenter Map dynamically if follow mode is active
const RecenterMap = ({ activePoint, follow }) => {
  const map = useMap();
  useEffect(() => {
    if (follow && activePoint && activePoint.lat && activePoint.lng) {
      const lat = parseFloat(activePoint.lat);
      const lng = parseFloat(activePoint.lng);
      if (Math.abs(lat) > 5.0 && Math.abs(lng) > 5.0) {
        map.panTo([lat, lng], { animate: true, duration: 0.5 });
      }
    }
  }, [activePoint, follow, map]);
  return null;
};

// Map speed to a gradient color
const getSpeedColor = (speed) => {
  if (speed > 65) return '#ef4444'; // red-500
  if (speed > 30) return '#f59e0b'; // amber-500
  return '#22c55e'; // green-500
};

const RouteMap = ({ points = [], activePoint = null, vehicleName = 'Vehicle', vehicleLastKnownPosition = null }) => {
  const [follow, setFollow] = useState(true);

  // Always start at India (Hyderabad). FitBoundsToRoute will zoom to actual points.
  const defaultCenter = [17.3411, 78.5317];
  const center = defaultCenter;


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

  // Calculate continuous route positions list
  const routePositions = points
    .filter(p => p.lat != null && p.lng != null && !isNaN(parseFloat(p.lat)) && !isNaN(parseFloat(p.lng)) && Math.abs(parseFloat(p.lat)) > 5.0 && Math.abs(parseFloat(p.lng)) > 5.0)
    .map(p => [parseFloat(p.lat), parseFloat(p.lng)]);

  const routeSegments = splitIntoSegments(routePositions);

  // Sliced positions up to current playback index
  const currentIndex = points.findIndex(
    p => activePoint && p.device_time === activePoint.device_time
  );

  const pastPositions = routePositions.slice(0, (currentIndex === -1 ? 0 : currentIndex) + 1);
  const pastSegments = splitIntoSegments(pastPositions);

  // Create custom rotated navigation arrow/car icon
  const createVehicleIcon = (direction = 0) => {
    return L.divIcon({
      html: `
        <div style="
          width: 38px;
          height: 38px;
          background: #0ea5e9;
          border: 3px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 4px 12px rgba(14, 165, 233, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          transform: rotate(${direction}deg);
          transition: transform 0.2s linear;
        ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
          </svg>
        </div>
      `,
      className: 'custom-vehicle-playback-marker',
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Following Vehicle toggle - only show when route is plotted */}
      {points.length > 0 && (
        <button
          onClick={() => setFollow(!follow)}
          style={{
            position: 'absolute',
            top: '24px',
            left: '24px',
            zIndex: 1000,
            background: follow ? '#0ea5e9' : '#ffffff',
            color: follow ? '#ffffff' : '#475569',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '8px 14px',
            fontSize: '12px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            transition: 'all 0.2s ease-in-out'
          }}
        >
          {follow ? <Eye size={15} /> : <EyeOff size={15} />}
          {follow ? 'Following Vehicle' : 'Free Map'}
        </button>
      )}

      <MapContainer
        center={center}
        zoom={13}
        className="w-full h-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBoundsToRoute points={points} />
        {points.length > 0 && <RecenterMap activePoint={activePoint} follow={follow} />}


        {/* Dotted / Dashed Route Path */}
        {routeSegments.map((seg, idx) => seg.length > 1 && (
          <Polyline
            key={`route-${idx}`}
            positions={seg}
            color="#475569"
            weight={2.5}
            dashArray="6, 8"
            opacity={0.7}
            lineCap="round"
            lineJoin="round"
          />
        ))}

        {/* Solid Traveled Path (up to playback point) */}
        {pastSegments.map((seg, idx) => seg.length > 1 && (
          <Polyline
            key={`past-${idx}`}
            positions={seg}
            color="#0EA5E9"
            weight={4}
            opacity={0.8}
            lineCap="round"
            lineJoin="round"
          />
        ))}

        {/* Start Point Marker */}
        {points.length > 0 && (() => {
          const startPoint = points[0];
          const pos = [parseFloat(startPoint.lat), parseFloat(startPoint.lng)];
          return (
            <CircleMarker
              center={pos}
              radius={8}
              fillColor="#22c55e"
              color="#ffffff"
              weight={2.5}
              fillOpacity={1}
            >
              <Popup className="premium-popup">
                <div style={{ minWidth: '180px', fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '12px', padding: '2px' }}>
                  <div style={{ fontWeight: 800, color: '#22c55e', fontSize: '13px', borderBottom: '1px solid #E2E8F0', paddingBottom: '4px', marginBottom: '6px' }}>Start Location</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#475569' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B', fontWeight: 600 }}>Time</span>
                      <span>{formatLocalTime(startPoint.device_time)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B', fontWeight: 600 }}>Odometer</span>
                      <span>{startPoint.odometer ? `${Math.round(startPoint.odometer)} km` : '-'}</span>
                    </div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })()}

        {/* End Point Marker */}
        {points.length > 1 && (() => {
          const endPoint = points[points.length - 1];
          const pos = [parseFloat(endPoint.lat), parseFloat(endPoint.lng)];
          return (
            <CircleMarker
              center={pos}
              radius={8}
              fillColor="#ef4444"
              color="#ffffff"
              weight={2.5}
              fillOpacity={1}
            >
              <Popup className="premium-popup">
                <div style={{ minWidth: '180px', fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '12px', padding: '2px' }}>
                  <div style={{ fontWeight: 800, color: '#ef4444', fontSize: '13px', borderBottom: '1px solid #E2E8F0', paddingBottom: '4px', marginBottom: '6px' }}>End / Latest Location</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#475569' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B', fontWeight: 600 }}>Time</span>
                      <span>{formatLocalTime(endPoint.device_time)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B', fontWeight: 600 }}>Speed</span>
                      <span>{formatSpeed(endPoint.speed)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B', fontWeight: 600 }}>Odometer</span>
                      <span>{endPoint.odometer ? `${Math.round(endPoint.odometer)} km` : '-'}</span>
                    </div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })()}

        {/* Active Animated Playback Marker */}
        {activePoint && activePoint.lat && activePoint.lng && Math.abs(parseFloat(activePoint.lat)) > 5.0 && Math.abs(parseFloat(activePoint.lng)) > 5.0 && (
          <Marker
            position={[parseFloat(activePoint.lat), parseFloat(activePoint.lng)]}
            icon={createVehicleIcon(activePoint.direction || 0)}
            zIndexOffset={1000}
          >
            <Popup className="premium-popup">
              <div style={{ minWidth: '200px', fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '12px', padding: '2px' }}>
                <div style={{ fontWeight: 800, color: '#0ea5e9', fontSize: '13px', borderBottom: '1px solid #E2E8F0', paddingBottom: '4px', marginBottom: '6px' }}>Current Position</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#475569' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B', fontWeight: 600 }}>Time</span>
                    <span>{formatLocalTime(activePoint.device_time)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B', fontWeight: 600 }}>Speed</span>
                    <span style={{ fontWeight: 700, color: getSpeedColor(activePoint.speed) }}>{formatSpeed(activePoint.speed)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B', fontWeight: 600 }}>Odometer</span>
                    <span>{activePoint.odometer ? `${Math.round(activePoint.odometer)} km` : '-'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B', fontWeight: 600 }}>Ignition</span>
                    <span style={{ fontWeight: 700, color: activePoint.ignition ? '#10B981' : '#64748B' }}>{activePoint.ignition ? 'ON' : 'OFF'}</span>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Small Markers for individual GPS points */}
        {points
          .filter((p, idx) => idx > 0 && idx < points.length - 1 && idx % Math.max(1, Math.floor(points.length / 50)) === 0)
          .map((point, idx) => {
            const pos = [parseFloat(point.lat), parseFloat(point.lng)];
            const color = getSpeedColor(point.speed);

            return (
              <CircleMarker
                key={idx}
                center={pos}
                radius={4}
                fillColor="#1e293b"
                color="#0f172a"
                opacity={0.8}
                weight={1.5}
                fillOpacity={0.9}
              >
                <Popup className="premium-popup">
                  <div style={{ minWidth: '220px', fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '12px', padding: '2px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '6px', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 800, color: '#374151', fontSize: '13px' }}>Point Details</span>
                      <span style={{
                        width: '8px', height: '8px', borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`
                      }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', color: '#475569' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748B', fontWeight: 600 }}>Vehicle Name</span>
                        <span style={{ fontWeight: 700 }}>{vehicleName}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748B', fontWeight: 600 }}>Speed</span>
                        <span style={{ fontWeight: 700, color: color }}>{formatSpeed(point.speed)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748B', fontWeight: 600 }}>ACC Status</span>
                        <span style={{ fontWeight: 700, color: point.ignition ? '#10B981' : '#64748B' }}>
                          {point.ignition ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748B', fontWeight: 600 }}>Odometer</span>
                        <span style={{ fontWeight: 700 }}>{point.odometer ? `${Math.round(point.odometer)} km` : '-'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748B', fontWeight: 600 }}>Loc Time</span>
                        <span style={{ fontWeight: 700 }}>{formatLocalTime(point.device_time)}</span>
                      </div>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
      </MapContainer>
    </div>
  );
};

export default RouteMap;
