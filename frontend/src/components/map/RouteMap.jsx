import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import { formatSpeed, formatFuel } from '../../utils/formatUtils';
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

const RouteMap = ({ points = [] }) => {
  const defaultCenter = [20.5937, 78.9629];
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
    <div className="w-full h-full dark-map border border-slate-800 rounded-xl overflow-hidden shadow-2xl relative">
      {points.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm z-10">
          <p className="text-slate-400 text-sm font-semibold">No route data for the selected range.</p>
        </div>
      ) : null}

      <MapContainer
        center={center}
        zoom={13}
        className="w-full h-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CartoDB</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
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
                <Popup>
                  <div className="w-44 font-sans text-xs text-slate-300 space-y-1">
                    <h5 className="font-bold text-slate-100 mb-1">GPS Log Details</h5>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Timestamp:</span>
                      <span>{formatLocalTime(point.device_time)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Speed:</span>
                      <span className="font-bold text-slate-100">{formatSpeed(point.speed)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Fuel level:</span>
                      <span>{formatFuel(point.fuel)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Ignition:</span>
                      <span className={point.ignition ? 'text-green-400' : 'text-slate-400'}>
                        {point.ignition ? 'ON' : 'OFF'}
                      </span>
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
