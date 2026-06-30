import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { formatSpeed } from '../../utils/formatUtils';
import { formatLocalTime } from '../../utils/dateUtils';
import { Eye, EyeOff, MapPin } from 'lucide-react';
import LocationDisplay from '../ui/LocationDisplay';

// Validate coordinate is within India's geographic bounding box
const isValidCoord = (lat, lng) => {
  const la = parseFloat(lat);
  const lo = parseFloat(lng);
  return !isNaN(la) && !isNaN(lo) &&
    la > 6.5 && la < 37.5 &&
    lo > 68.0 && lo < 98.0;
};

const FitBoundsToRoute = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (points && points.length > 0) {
      const validPoints = points.filter(p => p.lat != null && p.lng != null && isValidCoord(p.lat, p.lng));
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
      if (isValidCoord(activePoint.lat, activePoint.lng)) {
        map.panTo([parseFloat(activePoint.lat), parseFloat(activePoint.lng)], { animate: true, duration: 0.5 });
      }
    }
  }, [activePoint, follow, map]);
  return null;
};

// Fix Leaflet resize bug when flex container changes size
const MapResizer = () => {
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

  // Calculate continuous route positions list (only valid India coordinates)
  const routePositions = points
    .filter(p => p.lat != null && p.lng != null && isValidCoord(p.lat, p.lng))
    .map(p => [parseFloat(p.lat), parseFloat(p.lng)]);

  const routeSegments = splitIntoSegments(routePositions);

  // Sliced positions up to current playback index
  const currentIndex = points.findIndex(
    p => activePoint && p.device_time === activePoint.device_time
  );

  const pastPositions = routePositions.slice(0, (currentIndex === -1 ? 0 : currentIndex) + 1);
  const pastSegments = splitIntoSegments(pastPositions);

  // Create custom rotated navigation arrow/car icon
  const createVehicleIcon = (direction = 0, speed = 0) => {
    if (speed < 1) {
      // Vehicle is stopped - show a simple dot like the history points
      return L.divIcon({
        html: `
          <div style="
            width: 16px;
            height: 16px;
            background: #1e293b;
            border: 2px solid #ffffff;
            border-radius: 50%;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          "></div>
        `,
        className: 'custom-vehicle-stop-marker',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
    }

    // Vehicle is moving - show directional arrow
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
        <MapResizer />


        {/* Premium Modern Route Path */}
        {routeSegments.map((seg, idx) => seg.length > 1 && (
          <React.Fragment key={`route-group-${idx}`}>
            {/* Soft shadow effect underneath the line */}
            <Polyline
              positions={seg}
              color="#0f172a"
              weight={6}
              opacity={0.15}
              lineCap="round"
              lineJoin="round"
            />
            {/* Crisp modern blue primary line */}
            <Polyline
              positions={seg}
              color="#3B82F6"
              weight={4}
              opacity={0.9}
              lineCap="round"
              lineJoin="round"
            />
          </React.Fragment>
        ))}

        {/* Premium Directional Markers (Every 2 mins, interactive with popup card) */}
        {(() => {
          const arrowMarkers = [];
          let lastArrowTime = null;
          
          points.forEach((p, idx) => {
            if (!p.lat || !p.lng || idx === 0 || idx === points.length - 1) return;
            
            const ptTime = new Date(p.device_time).getTime();
            // 2 minutes = 120000 ms
            if (!lastArrowTime || ptTime - lastArrowTime >= 120000) {
              lastArrowTime = ptTime;

              let heading = p.course || 0;
              if (!p.course && idx > 0) {
                const prev = points[idx - 1];
                const lat1 = prev.lat * Math.PI / 180;
                const lat2 = p.lat * Math.PI / 180;
                const dLon = (p.lng - prev.lng) * Math.PI / 180;
                const y = Math.sin(dLon) * Math.cos(lat2);
                const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
                heading = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
              }

              // Premium, elegant modern directional pin (Blue circle with white arrow)
              const arrowHtml = `<div style="background: #3B82F6; border: 2px solid #FFFFFF; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${heading}deg);">
                  <path d="M5 15l7-7 7 7"/>
                </svg>
              </div>`;

              arrowMarkers.push(
                <Marker 
                  key={`arrow-${idx}`} 
                  position={[parseFloat(p.lat), parseFloat(p.lng)]} 
                  icon={L.divIcon({ html: arrowHtml, className: '', iconSize: [16, 16], iconAnchor: [8, 8] })}
                  interactive={true} 
                >
                  <Popup className="premium-popup modern-hover-card">
                    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '11.5px', padding: '6px', minWidth: '190px', background: '#FFFFFF' }}>
                      <div style={{ fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '8px', fontSize: '12.5px' }}>Route Point Details</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', color: '#334155', marginBottom: '8px' }}>
                        <tbody>
                          <tr>
                            <td style={{ paddingBottom: '4px', fontWeight: 600 }}>LocTime</td>
                            <td style={{ paddingBottom: '4px', textAlign: 'right', fontWeight: 700, color: '#3B82F6' }}>{formatLocalTime(p.device_time)}</td>
                          </tr>
                          <tr>
                            <td style={{ paddingBottom: '4px', fontWeight: 600 }}>Speed</td>
                            <td style={{ paddingBottom: '4px', textAlign: 'right', fontWeight: 700, color: '#3B82F6' }}>{Math.round(p.speed || 0)} km/h</td>
                          </tr>
                          <tr>
                            <td style={{ paddingBottom: '4px', fontWeight: 600 }}>DistCov</td>
                            <td style={{ paddingBottom: '4px', textAlign: 'right', fontWeight: 700, color: '#3B82F6' }}>{p.cDist !== undefined && p.cDist !== null ? Math.round(p.cDist) : '0'} km</td>
                          </tr>
                          <tr>
                            <td style={{ paddingBottom: '4px', fontWeight: 600 }}>Fuel</td>
                            <td style={{ paddingBottom: '4px', textAlign: 'right', fontWeight: 700, color: '#3B82F6' }}>{p.fuel !== undefined && p.fuel !== null ? Number(p.fuel).toFixed(2) : '0.00'} L</td>
                          </tr>
                          <tr>
                            <td style={{ paddingBottom: '0px', fontWeight: 600 }}>Odometer</td>
                            <td style={{ paddingBottom: '0px', textAlign: 'right', fontWeight: 700, color: '#3B82F6' }}>{p.odometer ? Math.round(p.odometer) : '-'} km</td>
                          </tr>
                        </tbody>
                      </table>
                      <div style={{ textAlign: 'center', color: '#64748B', fontSize: '10.5px', background: '#f8fafc', padding: '4px', borderRadius: '4px' }}>
                        <LocationDisplay lat={p.lat} lng={p.lng} />
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            }
          });
          return arrowMarkers;
        })()}

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
                    <LocationDisplay lat={startPoint.lat} lng={startPoint.lng} />
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
                    <LocationDisplay lat={endPoint.lat} lng={endPoint.lng} />
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })()}

        {/* Active Animated Playback Marker */}
        {activePoint && activePoint.lat && activePoint.lng && isValidCoord(activePoint.lat, activePoint.lng) && (() => {
          const ActiveHoverMarker = () => {
            const markerRef = useRef(null);
            useEffect(() => {
              if (markerRef.current) {
                // Auto-open popup on render/update to keep it "hovering" permanently
                markerRef.current.openPopup();
              }
            });

            return (
              <Marker
                position={[parseFloat(activePoint.lat), parseFloat(activePoint.lng)]}
                icon={createVehicleIcon(activePoint.direction || 0, activePoint.speed || 0)}
                zIndexOffset={1000}
                ref={markerRef}
              >
                <Popup className="premium-popup modern-hover-card" autoPan={false}>
                  <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '11.5px', padding: '6px', minWidth: '190px', background: '#FFFFFF' }}>
                    <div style={{ fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '8px', fontSize: '12.5px' }}>Current Position</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', color: '#334155', marginBottom: '8px' }}>
                      <tbody>
                        <tr>
                          <td style={{ paddingBottom: '4px', fontWeight: 600 }}>LocTime</td>
                          <td style={{ paddingBottom: '4px', textAlign: 'right', fontWeight: 700, color: '#3B82F6' }}>{formatLocalTime(activePoint.device_time)}</td>
                        </tr>
                        <tr>
                          <td style={{ paddingBottom: '4px', fontWeight: 600 }}>Speed</td>
                          <td style={{ paddingBottom: '4px', textAlign: 'right', fontWeight: 700, color: '#3B82F6' }}>{Math.round(activePoint.speed || 0)} km/h</td>
                        </tr>
                        <tr>
                          <td style={{ paddingBottom: '4px', fontWeight: 600 }}>DistCov</td>
                          <td style={{ paddingBottom: '4px', textAlign: 'right', fontWeight: 700, color: '#3B82F6' }}>{activePoint.cDist !== undefined && activePoint.cDist !== null ? Math.round(activePoint.cDist) : '0'} km</td>
                        </tr>
                        <tr>
                          <td style={{ paddingBottom: '4px', fontWeight: 600 }}>Fuel</td>
                          <td style={{ paddingBottom: '4px', textAlign: 'right', fontWeight: 700, color: '#3B82F6' }}>{activePoint.fuel !== undefined && activePoint.fuel !== null ? Number(activePoint.fuel).toFixed(2) : '0.00'} L</td>
                        </tr>
                        <tr>
                          <td style={{ paddingBottom: '0px', fontWeight: 600 }}>Odometer</td>
                          <td style={{ paddingBottom: '0px', textAlign: 'right', fontWeight: 700, color: '#3B82F6' }}>{activePoint.odometer ? Math.round(activePoint.odometer) : '-'} km</td>
                        </tr>
                      </tbody>
                    </table>
                    <div style={{ textAlign: 'center', color: '#64748B', fontSize: '10.5px', background: '#f8fafc', padding: '4px', borderRadius: '4px' }}>
                      <LocationDisplay lat={activePoint.lat} lng={activePoint.lng} />
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          };
          return <ActiveHoverMarker />;
        })()}


      </MapContainer>
    </div>
  );
};

export default RouteMap;
