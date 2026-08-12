import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, Marker, useMap, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import { createPinIcon } from '../../utils/markerUtils';
import { formatSpeed } from '../../utils/formatUtils';
import { formatLocalTime } from '../../utils/dateUtils';
import { Eye, EyeOff, MapPin, Route, Loader2 } from 'lucide-react';
import LocationDisplay from '../ui/LocationDisplay';

const { BaseLayer } = LayersControl;

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
        const currentZoom = map.getZoom();
        const targetZoom = currentZoom < 16 ? 16 : currentZoom;
        map.setView([parseFloat(activePoint.lat), parseFloat(activePoint.lng)], targetZoom, { animate: false });
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

const formatDuration = (ms) => {
  if (ms < 0) return '0s';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(' ');
};

const RouteMap = ({ points = [], activePoint = null, vehicle = null, vehicleName = 'Vehicle', vehicleLastKnownPosition = null }) => {
  const [follow, setFollow] = useState(true);
  const [snapToRoads, setSnapToRoads] = useState(false);
  const [snappedSegments, setSnappedSegments] = useState([]);
  const [isSnapping, setIsSnapping] = useState(false);
  const activeMarkerRef = useRef(null);

  useEffect(() => {
    if (activeMarkerRef.current) {
      activeMarkerRef.current.openPopup();
    }
  }, [activePoint]);

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

  /**
   * TEMPORAL GPS PUZZLE ALGORITHM
   * ─────────────────────────────────────────────────────────────────────────
   * Step 1: Sort all received points by device_time (ASC). This places every
   *         buffered/delayed packet in its correct chronological "slot",
   *         just like inserting a puzzle piece into the right position.
   *         The DB already stores by device_time, but buffered dumps from the
   *         device may arrive out-of-order in the API response.
   *
   * Step 2: Walk the sorted points and look for genuine signal gaps:
   *         A "gap" = the vehicle was parked/stopped AND no signal was
   *         received for > GPS_GAP_THRESHOLD_MIN minutes.
   *         At a genuine gap, break the polyline. This prevents the
   *         map from drawing a straight line through buildings across
   *         the gap.
   *
   * Step 3: Reject points that represent physically impossible teleports:
   *         implied speed > MAX_POSSIBLE_KMH (500 km/h). This catches
   *         corrupt GPS coordinates, NOT legitimate highway driving.
   * ─────────────────────────────────────────────────────────────────────────
   */
  const GPS_GAP_THRESHOLD_MIN = 10;   // Break line if signal lost > 10 mins while parked
  const MAX_POSSIBLE_KMH = 500;       // Only reject physically impossible teleports (NOT highway speed)

  const splitIntoSegments = (pts) => {
    if (!pts || pts.length === 0) return [];

    // Step 1: Sort chronologically by device_time (puzzle-piece placement)
    const sorted = [...pts].sort((a, b) =>
      new Date(a.device_time).getTime() - new Date(b.device_time).getTime()
    );

    const segs = [];
    let cur = [];

    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];

      if (cur.length === 0) {
        cur.push(p);
        continue;
      }

      const prev = cur[cur.length - 1];
      const timeDiffMin = (new Date(p.device_time).getTime() - new Date(prev.device_time).getTime()) / 60000;
      const dist = getDistance(prev.lat, prev.lng, p.lat, p.lng);

      // Step 3: Detect physically impossible GPS teleports (corrupt data)
      // Only triggers at speeds that no vehicle can achieve (> 500 km/h)
      if (timeDiffMin > 0 && timeDiffMin < 5) {
        const impliedSpeedKmph = (dist / (timeDiffMin / 60));
        if (impliedSpeedKmph > MAX_POSSIBLE_KMH) {
          // Skip this corrupt point entirely — don't break the line, don't add it
          continue;
        }
      }

      // Step 2: Detect genuine GPS signal gap:
      // If time gap > threshold AND vehicle was stopped/parked before the gap,
      // it means the device truly lost signal (tunnel, parking garage, power off).
      // Break the polyline here so we don't draw a straight line across the gap.
      const vehicleWasStoppedBefore = (prev.speed || 0) <= 5;
      const vehicleIsStoppedAfter  = (p.speed || 0) <= 5;
      const isGenuineSignalGap = timeDiffMin > GPS_GAP_THRESHOLD_MIN && vehicleWasStoppedBefore;

      // Also break for large gaps while moving (e.g. the vehicle drove through a dead zone)
      // but only if the distance is suspiciously large relative to reported speed
      const movingGap = timeDiffMin > GPS_GAP_THRESHOLD_MIN && !vehicleWasStoppedBefore && dist > 2.0;

      if (isGenuineSignalGap || movingGap || timeDiffMin < 0) {
        if (cur.length > 0) segs.push(cur.map(pt => [parseFloat(pt.lat), parseFloat(pt.lng)]));
        cur = [p];
        continue;
      }

      cur.push(p);
    }

    if (cur.length > 0) {
      segs.push(cur.map(pt => [parseFloat(pt.lat), parseFloat(pt.lng)]));
    }

    return segs;
  };

  // Valid points (only valid India coordinates, sorted chronologically, minimal safe filtering)
  const validPoints = React.useMemo(() => {
    const raw = points
      .filter(p => p.lat != null && p.lng != null && isValidCoord(p.lat, p.lng))
      .sort((a, b) => new Date(a.device_time).getTime() - new Date(b.device_time).getTime());

    if (raw.length === 0) return [];

    const filtered = [raw[0]];
    for (let i = 1; i < raw.length; i++) {
      const p = raw[i];
      const prev = filtered[filtered.length - 1];

      const dist = getDistance(prev.lat, prev.lng, p.lat, p.lng);
      const timeDiffMin = (new Date(p.device_time).getTime() - new Date(prev.device_time).getTime()) / 60000;

      // Fix divide by zero for identical timestamps
      const impliedSpeedKmph = timeDiffMin > 0 ? (dist / (timeDiffMin / 60)) : (dist > 0.05 ? Infinity : 0);

      // Only drop physically impossible teleports (> 250 km/h)
      if (impliedSpeedKmph > 250) continue;

      filtered.push(p);
    }

    return filtered;
  }, [points]);

  const routeSegments = React.useMemo(() => splitIntoSegments(validPoints), [validPoints]);

  useEffect(() => {
    let isMounted = true;
    const fetchSnappedRoutes = async () => {
      if (!snapToRoads) {
        setSnappedSegments([]);
        return;
      }
      setIsSnapping(true);

      const newSnapped = [];

      try {
        // Use the shared splitIntoSegments algorithm for OSRM snapping too
        const pointSegments = [];
        let cur = [];
        const sortedValid = [...validPoints].sort((a, b) =>
          new Date(a.device_time).getTime() - new Date(b.device_time).getTime()
        );
        for (let i = 0; i < sortedValid.length; i++) {
          const p = sortedValid[i];
          if (cur.length > 0) {
            const prev = cur[cur.length - 1];
            const dist = getDistance(prev.lat, prev.lng, p.lat, p.lng);
            const timeDiffMin = (new Date(p.device_time).getTime() - new Date(prev.device_time).getTime()) / 60000;
            const vehicleWasStoppedBefore = (prev.speed || 0) <= 5;
            const isGenuineSignalGap = timeDiffMin > 10 && vehicleWasStoppedBefore;
            const movingGap = timeDiffMin > 10 && !vehicleWasStoppedBefore && dist > 2.0;
            if (isGenuineSignalGap || movingGap || timeDiffMin < 0) {
              pointSegments.push(cur);
              cur = [p];
              continue;
            }
          }
          cur.push(p);
        }
        if (cur.length > 0) pointSegments.push(cur);

        for (const segment of pointSegments) {
          if (segment.length < 2) continue;

          // OSRM match API limit is 100 points per request
          const chunkSize = 100;
          let currentSnappedSegment = [];

          // Advance by 99 to ensure a 1-point overlap without exceeding 100 points
          for (let i = 0; i < segment.length; i += chunkSize - 1) {
            const chunk = segment.slice(i, i + chunkSize);
            if (chunk.length < 2) continue;

            // OSRM match expects lng,lat
            const coordsStr = chunk.map(p => `${parseFloat(p.lng)},${parseFloat(p.lat)}`).join(';');
            // Provide Unix timestamps (seconds) for better accuracy
            const timestampsStr = chunk.map(p => Math.floor(new Date(p.device_time).getTime() / 1000)).join(';');
            // 40 metre GPS accuracy radius (gives OSRM more leeway to snap properly)
            const radiusesStr = chunk.map(() => '40').join(';');

            const url = `https://router.project-osrm.org/match/v1/driving/${coordsStr}?geometries=geojson&overview=full&timestamps=${timestampsStr}&radiuses=${radiusesStr}&gaps=ignore`;

            try {
              const response = await fetch(url);
              const data = await response.json();

              if (data.code === 'Ok' && data.matchings && data.matchings.length > 0) {
                // Combine all matchings for this chunk
                for (const matching of data.matchings) {
                  const coords = matching.geometry.coordinates;
                  for (const c of coords) {
                    const latLng = [c[1], c[0]];
                    // Prevent pushing exact consecutive duplicates at overlapping seams
                    if (currentSnappedSegment.length > 0) {
                       const last = currentSnappedSegment[currentSnappedSegment.length - 1];
                       if (last[0] === latLng[0] && last[1] === latLng[1]) continue;
                    }
                    currentSnappedSegment.push(latLng);
                  }
                }
              } else {
                // Fallback to raw points for this chunk
                const fallbackPoints = chunk.map(p => [parseFloat(p.lat), parseFloat(p.lng)]);
                for (const latLng of fallbackPoints) {
                  if (currentSnappedSegment.length > 0) {
                     const last = currentSnappedSegment[currentSnappedSegment.length - 1];
                     if (last[0] === latLng[0] && last[1] === latLng[1]) continue;
                  }
                  currentSnappedSegment.push(latLng);
                }
              }
            } catch {
              // Fallback to raw points on network error
              const fallbackPoints = chunk.map(p => [parseFloat(p.lat), parseFloat(p.lng)]);
              for (const latLng of fallbackPoints) {
                if (currentSnappedSegment.length > 0) {
                   const last = currentSnappedSegment[currentSnappedSegment.length - 1];
                   if (last[0] === latLng[0] && last[1] === latLng[1]) continue;
                }
                currentSnappedSegment.push(latLng);
              }
            }
          }
          if (currentSnappedSegment.length > 0) {
            newSnapped.push(currentSnappedSegment);
          }
        }

        if (isMounted) {
          setSnappedSegments(newSnapped);
        }
      } catch (error) {
        console.error("Failed to snap route:", error);
      } finally {
        if (isMounted) {
          setIsSnapping(false);
        }
      }
    };

    fetchSnappedRoutes();

    return () => { isMounted = false; };
  }, [snapToRoads, validPoints]);

  const stoppages = React.useMemo(() => {
    if (!points || points.length === 0) return [];
    const stops = [];
    let stopStart = null;
    let stopEnd = null;
    let overspeedCount = 0;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (!p.lat || !p.lng || !isValidCoord(p.lat, p.lng)) continue;

      if (p.speed <= 5) {
        if (!stopStart) stopStart = p;
        stopEnd = p;
        overspeedCount = 0; // reset spike counter
      } else {
        if (stopStart && stopEnd) {
          overspeedCount++;
          // Only break the stop if we have 2 consecutive points > 5km/h (filters out 1-point GPS spikes)
          if (overspeedCount >= 2) {
            const startMs = new Date(stopStart.device_time).getTime();
            const endMs = new Date(stopEnd.device_time).getTime();
            const diffMin = (endMs - startMs) / (1000 * 60);
            if (diffMin >= 3) { // Lowered to 3 mins to be extra safe
              stops.push({
                lat: parseFloat(stopStart.lat),
                lng: parseFloat(stopStart.lng),
                startTime: stopStart.device_time,
                endTime: stopEnd.device_time,
                durationMs: endMs - startMs
              });
            }
            stopStart = null;
            stopEnd = null;
            overspeedCount = 0;
          }
        }
      }
    }
    if (stopStart && stopEnd) {
      const startMs = new Date(stopStart.device_time).getTime();
      const endMs = new Date(stopEnd.device_time).getTime();
      const diffMin = (endMs - startMs) / (1000 * 60);
      if (diffMin >= 3) {
        stops.push({
          lat: parseFloat(stopStart.lat),
          lng: parseFloat(stopStart.lng),
          startTime: stopStart.device_time,
          endTime: stopEnd.device_time,
          durationMs: endMs - startMs
        });
      }
    }
    return stops;
  }, [points]);

  const activeStoppage = React.useMemo(() => {
    if (!activePoint || stoppages.length === 0) return null;
    const activeMs = new Date(activePoint.device_time).getTime();
    return stoppages.find(stop => {
      const startMs = new Date(stop.startTime).getTime();
      const endMs = new Date(stop.endTime).getTime();
      return activeMs >= startMs && activeMs <= endMs;
    });
  }, [activePoint, stoppages]);

  // Sliced positions up to current playback index
  const validCurrentIndex = validPoints.findIndex(
    p => activePoint && p.device_time === activePoint.device_time
  );

  const pastPoints = validPoints.slice(0, (validCurrentIndex === -1 ? 0 : validCurrentIndex) + 1);
  const pastSegments = React.useMemo(() => splitIntoSegments(pastPoints), [pastPoints]);

  // Create custom rotated navigation arrow/car icon
  const createVehicleIcon = (direction = 0, speed = 0, ignition = false) => {
    let currentStatus = 'offline';
    if (speed > 2) {
      currentStatus = 'running';
    } else if (ignition) {
      currentStatus = 'idle';
    } else {
      currentStatus = 'parked';
    }

    // Use the shared marker logic for both moving and stopped
    return createPinIcon(
      vehicle || {}, // fallback to empty object if no vehicle provided
      false, // noGps
      0, // clusterRank
      {
        course: direction,
        speed: speed,
        status: currentStatus,
        hideSpeed: true // Don't show speed bubble over the car in history map
      }
    );
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Following Vehicle toggle - only show when route is plotted */}
      {points.length > 0 && (
        <>
          <button
            onClick={() => setFollow(!follow)}
            style={{
              position: 'absolute',
              top: '24px',
              left: '180px',
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

          <button
            onClick={() => setSnapToRoads(!snapToRoads)}
            disabled={isSnapping}
            style={{
              position: 'absolute',
              top: '24px',
              left: '350px',
              zIndex: 1000,
              background: snapToRoads ? '#10B981' : '#ffffff',
              color: snapToRoads ? '#ffffff' : '#475569',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: isSnapping ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              transition: 'all 0.2s ease-in-out',
              opacity: isSnapping ? 0.7 : 1
            }}
          >
            {isSnapping ? (
              <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Route size={15} />
            )}
            {isSnapping ? 'Snapping...' : snapToRoads ? 'Snapped to Roads' : 'Raw GPS'}
          </button>
        </>
      )}



      {/* Active Stoppage Floating Card (Left side overlay) */}
      {activeStoppage && (
        <div style={{
          position: 'absolute',
          top: '70px',
          left: '180px',
          zIndex: 1000,
          background: '#ffffff',
          borderRadius: '8px',
          padding: '16px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          border: '1px solid #e2e8f0',
          width: '260px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{ fontWeight: 800, color: '#ef4444', fontSize: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            Vehicle Stopped
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', color: '#334155', marginBottom: '12px', fontSize: '12px' }}>
            <tbody>
              <tr>
                <td style={{ paddingBottom: '6px', fontWeight: 600 }}>Stopped At</td>
                <td style={{ paddingBottom: '6px', textAlign: 'right', fontWeight: 700 }}>{formatLocalTime(activeStoppage.startTime)}</td>
              </tr>
              <tr>
                <td style={{ paddingBottom: '6px', fontWeight: 600 }}>Started At</td>
                <td style={{ paddingBottom: '6px', textAlign: 'right', fontWeight: 700 }}>{formatLocalTime(activeStoppage.endTime)}</td>
              </tr>
              <tr>
                <td style={{ paddingBottom: '6px', fontWeight: 600 }}>Duration</td>
                <td style={{ paddingBottom: '6px', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>{formatDuration(activeStoppage.durationMs)}</td>
              </tr>
            </tbody>
          </table>
          <div style={{ textAlign: 'center', color: '#64748B', fontSize: '11px', background: '#f8fafc', padding: '8px', borderRadius: '6px', marginBottom: '12px', lineHeight: '1.4' }}>
            <LocationDisplay lat={activeStoppage.lat} lng={activeStoppage.lng} />
          </div>
          <a
            href={`https://maps.google.com/?q=${activeStoppage.lat},${activeStoppage.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'block', textAlign: 'center', background: '#3B82F6', color: '#FFFFFF', padding: '8px 0', borderRadius: '6px', textDecoration: 'none', fontWeight: 600, fontSize: '12px', transition: 'background 0.2s' }}
          >
            View in Google Maps
          </a>
        </div>
      )}

      <MapContainer
        center={center}
        zoom={13}
        className="w-full h-full"
        zoomControl={false}
      >
        <LayersControl position="topleft">
          <BaseLayer checked name="Modern Light">
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </BaseLayer>
          <BaseLayer name="Dark Mode (Premium)">
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
          </BaseLayer>
          <BaseLayer name="Satellite">
            <TileLayer
              attribution='&copy; Esri'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </BaseLayer>
        </LayersControl>

        <FitBoundsToRoute points={points} />
        {points.length > 0 && <RecenterMap activePoint={activePoint} follow={follow} />}
        <MapResizer />


        {/* Premium Modern Route Path (Base Line) */}
        {(snapToRoads && snappedSegments.length > 0 ? snappedSegments : routeSegments).map((seg, idx) => seg.length > 1 && (
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
            {/* Crisp modern primary line (Blue for raw, Emerald for snapped) */}
            <Polyline
              positions={seg}
              color={snapToRoads ? "#10B981" : "#3B82F6"}
              weight={4}
              opacity={0.8}
              lineCap="round"
              lineJoin="round"
            />
          </React.Fragment>
        ))}

        {/* Driven Path Trail Effect (Vibrant Green over the path already traveled) */}
        {!snapToRoads && pastSegments.map((seg, idx) => seg.length > 1 && (
          <Polyline
            key={`past-group-${idx}`}
            positions={seg}
            color="#10B981"
            weight={4}
            opacity={1}
            lineCap="round"
            lineJoin="round"
          />
        ))}

        {/* Premium Directional Markers (Distance-based dynamic spacing) */}
        {(() => {
          if (points.length < 2) return null;
          const arrowMarkers = [];

          // Get total distance to calculate optimal spacing
          const totalDistance = points[points.length - 1].cDist || 0;
          // Target around 12-15 markers across the whole trip so it's never cluttered. 
          // Enforce a minimum physical spacing of 1km so they never pile up when parked.
          const distanceInterval = Math.max(totalDistance / 15, 1.0);

          let lastMarkerDist = null;

          points.forEach((p, idx) => {
            if (!p.lat || !p.lng || idx === 0 || idx === points.length - 1) return;

            const currentDist = p.cDist || 0;

            // Only draw a marker if the vehicle has physically moved the required distance
            if (lastMarkerDist === null || currentDist - lastMarkerDist >= distanceInterval) {
              lastMarkerDist = currentDist;

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

        {/* Stoppage Markers */}
        {stoppages.map((stop, idx) => (
          <Marker
            key={`stop-${idx}`}
            position={[stop.lat, stop.lng]}
            icon={L.divIcon({
              html: `<div style="background: #ef4444; border: 2px solid #FFFFFF; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                <span style="color: white; font-size: 12px; font-weight: bold; line-height: 1;">P</span>
              </div>`,
              className: '',
              iconSize: [22, 22],
              iconAnchor: [11, 11]
            })}
          >
            <Popup className="premium-popup modern-hover-card">
              <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '11.5px', padding: '6px', minWidth: '220px', background: '#FFFFFF' }}>
                <div style={{ fontWeight: 700, color: '#ef4444', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '8px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  Long Stop ({formatDuration(stop.durationMs)})
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', color: '#334155', marginBottom: '8px' }}>
                  <tbody>
                    <tr>
                      <td style={{ paddingBottom: '4px', fontWeight: 600 }}>Stopped At</td>
                      <td style={{ paddingBottom: '4px', textAlign: 'right', fontWeight: 700 }}>{formatLocalTime(stop.startTime)}</td>
                    </tr>
                    <tr>
                      <td style={{ paddingBottom: '4px', fontWeight: 600 }}>Started At</td>
                      <td style={{ paddingBottom: '4px', textAlign: 'right', fontWeight: 700 }}>{formatLocalTime(stop.endTime)}</td>
                    </tr>
                    <tr>
                      <td style={{ paddingBottom: '4px', fontWeight: 600 }}>Duration</td>
                      <td style={{ paddingBottom: '4px', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>{formatDuration(stop.durationMs)}</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ textAlign: 'center', color: '#64748B', fontSize: '10.5px', background: '#f8fafc', padding: '6px', borderRadius: '4px', marginBottom: '6px' }}>
                  <LocationDisplay lat={stop.lat} lng={stop.lng} />
                </div>
                <a
                  href={`https://maps.google.com/?q=${stop.lat},${stop.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'block', textAlign: 'center', background: '#3B82F6', color: '#FFFFFF', padding: '6px 0', borderRadius: '4px', textDecoration: 'none', fontWeight: 600, fontSize: '11px' }}
                >
                  View in Google Maps
                </a>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Active Animated Playback Marker */}
        {(() => {
          if (!activePoint || !activePoint.lat || !activePoint.lng || !isValidCoord(activePoint.lat, activePoint.lng)) return null;

          let heading = activePoint.course || 0;
          if (!activePoint.course && validCurrentIndex > 0) {
            const prev = validPoints[validCurrentIndex - 1];
            if (prev && prev.lat && prev.lng) {
              const lat1 = prev.lat * Math.PI / 180;
              const lat2 = activePoint.lat * Math.PI / 180;
              const dLon = (activePoint.lng - prev.lng) * Math.PI / 180;
              const y = Math.sin(dLon) * Math.cos(lat2);
              const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
              heading = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
            }
          }

          return (
            <Marker
              position={[parseFloat(activePoint.lat), parseFloat(activePoint.lng)]}
              icon={createVehicleIcon(heading, activePoint.speed || 0, activePoint.ignition)}
              zIndexOffset={1000}
              ref={activeMarkerRef}
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
                        <td style={{ paddingBottom: '4px', fontWeight: 600 }}>Voltage</td>
                        <td style={{ paddingBottom: '4px', textAlign: 'right', fontWeight: 700, color: '#3B82F6' }}>{activePoint.voltage !== undefined && activePoint.voltage !== null ? Number(activePoint.voltage).toFixed(1) : '-'} V</td>
                      </tr>
                      <tr>
                        <td style={{ paddingBottom: '0px', fontWeight: 600 }}>Odometer</td>
                        <td style={{ paddingBottom: '0px', textAlign: 'right', fontWeight: 700, color: '#3B82F6' }}>
                          {Math.round((validPoints[0]?.odometer || activePoint.odometer || 0) + (activePoint.cDist || 0))} km
                        </td>
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
        })()}


      </MapContainer>
    </div>
  );
};

export default RouteMap;
