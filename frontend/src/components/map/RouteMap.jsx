import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import { formatSpeed } from '../../utils/formatUtils';
import { formatLocalTime } from '../../utils/dateUtils';

const FitBoundsToRoute = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (points && points.length > 0) {
      const bounds = points.map(p => [parseFloat(p.lat), parseFloat(p.lng)]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [points, map]);

  return null;
};

// Map speed to a gradient color
// Green (Slow, < 30) -> Yellow (Moderate, 30-65) -> Red (High, > 65)
const getSpeedColor = (speed) => {
  if (speed > 65) return '#ef4444'; // red-500
  if (speed > 30) return '#f59e0b'; // amber-500
  return '#22c55e'; // green-500
};

const RouteMap = ({ points = [], vehicleName = 'Vehicle' }) => {
  // Default map center for Karmanghat, Hyderabad (FuelTracks Office)
  const defaultCenter = [17.3411, 78.5317];
  const center = points.length > 0 
    ? [parseFloat(points[0].lat), parseFloat(points[0].lng)] 
    : defaultCenter;

  // Split points into segments of two adjacent points to draw speed gradients
  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (p1.lat && p1.lng && p2.lat && p2.lng) {
      segments.push({
        positions: [
          [parseFloat(p1.lat), parseFloat(p1.lng)],
          [parseFloat(p2.lat), parseFloat(p2.lng)]
        ],
        color: getSpeedColor(p2.speed),
        speed: p2.speed
      });
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {points.length === 0 ? (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(241, 245, 249, 0.7)', backdropFilter: 'blur(4px)'
        }}>
          <p style={{ color: '#64748b', fontSize: '14px', fontWeight: 600 }}>No route data for the selected range.</p>
        </div>
      ) : null}

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

        {points.length > 0 && <FitBoundsToRoute points={points} />}

        {/* Speed Gradient Segments */}
        {segments.map((seg, idx) => (
          <Polyline
            key={idx}
            positions={seg.positions}
            color={seg.color}
            weight={5}
            opacity={0.85}
          />
        ))}

        {/* Small Markers for individual GPS points */}
        {points
          .filter((p, idx) => idx % Math.max(1, Math.floor(points.length / 50)) === 0) // Limit markers to max 50 points to prevent lag
          .map((point, idx) => {
            const pos = [parseFloat(point.lat), parseFloat(point.lng)];
            const color = getSpeedColor(point.speed);

            return (
              <CircleMarker
                key={idx}
                center={pos}
                radius={5}
                fillColor={color}
                color="#0f172a"
                weight={1.5}
                fillOpacity={0.9}
              >
                <Popup className="premium-popup">
                  <div style={{ minWidth: '220px', fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '12px', padding: '2px' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '6px', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 800, color: '#374151', fontSize: '13px' }}>Point Details</span>
                      <span style={{
                        width: '8px', height: '8px', borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`
                      }} />
                    </div>

                    {/* Details Rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', color: '#475569' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748B', fontWeight: 600 }}>Vehicle Name</span>
                        <span style={{ fontWeight: 700 }}>- {vehicleName}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748B', fontWeight: 600 }}>Speed</span>
                        <span style={{ fontWeight: 700, color: color }}>- {formatSpeed(point.speed)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748B', fontWeight: 600 }}>ACC Status</span>
                        <span style={{ fontWeight: 700, color: point.ignition ? '#10B981' : '#64748B' }}>
                          - {point.ignition ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748B', fontWeight: 600 }}>Odometer</span>
                        <span style={{ fontWeight: 700 }}>- {point.odometer ? `${Math.round(point.odometer)} km` : '-'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748B', fontWeight: 600 }}>Loc Time</span>
                        <span style={{ fontWeight: 700 }}>- {formatLocalTime(point.device_time)}</span>
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
