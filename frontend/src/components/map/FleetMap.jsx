import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { MapContainer, TileLayer, Marker, Tooltip, Polyline, Popup, useMap, Circle, LayerGroup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import L from 'leaflet';
import { Truck, User } from 'lucide-react';
import { formatSpeed, formatVoltage, formatDirection, formatOdometer, formatFuel, getBatteryStatus } from '../../utils/formatUtils';
import { formatLocalTime, getNoDataDuration } from '../../utils/dateUtils';
import LocationDisplay from '../ui/LocationDisplay';
import { useProfile } from '../../modules/profile/hooks/useProfile';



import { getVehicleRoute } from '../../api/vehicleApi';

const getExpiryWarning = (expireDateStr) => {
  if (!expireDateStr) return null;
  const exp = new Date(expireDateStr);
  const now = new Date();
  const diffTime = exp.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { type: 'expired', text: `Licence Expired` };
  } else if (diffDays <= 4) {
    return { type: 'expiring', text: `Licence Expiring in ${diffDays}d` };
  }
  return null;
};

const formatCardDateTime = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[d.getMonth()];
  const year = String(d.getFullYear()).slice(-2);
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}-${month}-${year} ${hours}:${mins}`;
};

// ── Live Route Plotting & Following for Selected Vehicle ─────────────
const VehicleRouteAndFit = ({ selectedVehicle, selectedVehicles = [], vehicles = [], showRoute = false, followSelected = false, onRouteFetched, isMultiMode = false }) => {
  const map = useMap();
  const [routePoints, setRoutePoints] = useState([]);
  const [liveTrail, setLiveTrail] = useState([]);
  const hasFitInitially = useRef(false);
  const prevVehicleIdRef = useRef(selectedVehicle?.id);
  const userDraggedMapRef = useRef(false);

  // Detect user map dragging so manual panning is allowed without live updates overriding it
  useEffect(() => {
    if (!map) return;
    const handleDragStart = () => {
      userDraggedMapRef.current = true;
    };
    map.on('dragstart', handleDragStart);
    return () => {
      map.off('dragstart', handleDragStart);
    };
  }, [map]);

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

  // 1. Fetch today's route line
  useEffect(() => {
    const targetVehicleId = selectedVehicle?.id || (selectedVehicles && selectedVehicles[0]?.id);

    if (!showRoute || !targetVehicleId || isMultiMode) {
      setRoutePoints([]);
      setLiveTrail([]);
      return;
    }

    const fetchRoute = async () => {
      setRoutePoints([]);
      try {
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0).toISOString();
        const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();
        const res = await getVehicleRoute(targetVehicleId, { startDate: start, endDate: end });

        if (res.success && res.data.length > 0) {
          const validPoints = res.data.filter(p => {
            const la = parseFloat(p.lat);
            const lo = parseFloat(p.lng);
            return !isNaN(la) && !isNaN(lo) && la > 6.5 && la < 37.5 && lo > 68.0 && lo < 98.0;
          });
          setRoutePoints(validPoints);
          if (onRouteFetched) onRouteFetched(validPoints);
        } else {
          setRoutePoints([]);
          if (onRouteFetched) onRouteFetched([]);
        }
      } catch (err) {
        console.error('Failed to fetch route:', err);
      }
    };

    fetchRoute();
  }, [selectedVehicle?.id, selectedVehicles?.[0]?.id, showRoute]);

  // 1. Zoom to selected vehicle instantly without dragging across the screen
  useEffect(() => {
    const targetVehicle = selectedVehicle || (selectedVehicles && selectedVehicles[0]);
    if (!targetVehicle?.id) return;

    userDraggedMapRef.current = false;

    let lat = parseFloat(targetVehicle.lat);
    let lng = parseFloat(targetVehicle.lng);
    const hasValidCoords = !isNaN(lat) && !isNaN(lng) && lat > 6.5 && lat < 37.5 && lng > 68.0 && lng < 98.0;

    if (hasValidCoords) {
      map.setView([lat, lng], 18, { animate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicle?.id, selectedVehicles?.[0]?.id]);


  // 2. Zoom out/Fit Bounds when no vehicle selected
  useEffect(() => {
    let t1 = null;
    let t2 = null;

    const targetVehicle = selectedVehicle || (selectedVehicles && selectedVehicles[0]);
    if (targetVehicle) {
      hasFitInitially.current = false;
      return;
    }

    if (!hasFitInitially.current) {
      // Don't trigger fit bounds or fallback if vehicles haven't loaded yet
      if (!vehicles || vehicles.length === 0) {
        return;
      }

      const validCoords = vehicles
        .filter(v => v.lat && v.lng)
        .map(v => [parseFloat(v.lat), parseFloat(v.lng)])
        .filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]) && coord[0] !== 0 && coord[1] !== 0);

      if (validCoords.length > 0) {
        const bounds = L.latLngBounds(validCoords);
        t1 = setTimeout(() => {
          if (map && map.getContainer()) {
            try {
              map.invalidateSize();
              map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: false });
            } catch (e) {
              console.warn('Map fitBounds failed:', e.message);
            }
          }
        }, 100);
        hasFitInitially.current = true;
      } else {
        // Fallback: Default to Hyderabad city area at zoom 13 if no vehicle coords
        t2 = setTimeout(() => {
          if (map && map.getContainer()) {
            try {
              map.setView([17.3850, 78.4867], 13, { animate: false });
            } catch (e) {
              console.warn('Map fallback setView failed:', e.message);
            }
          }
        }, 100);
        hasFitInitially.current = true;
      }
    }

    return () => {
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
  }, [selectedVehicle?.id, selectedVehicles?.[0]?.id, vehicles?.length, map, followSelected]);

  // 3. Pan to follow vehicle as it moves in real time (unless user manually dragged the map away)
  useEffect(() => {
    const targetId = selectedVehicle?.id || (selectedVehicles && selectedVehicles[0]?.id);
    if (!followSelected || !targetId) return;

    // ALways fetch the freshest coordinate from the vehicles array
    const latestTarget = vehicles?.find(v => v.id === targetId);
    if (!latestTarget) return;

    let lat = parseFloat(latestTarget.lat);
    let lng = parseFloat(latestTarget.lng);
    const hasValidCoords = !isNaN(lat) && !isNaN(lng) && lat > 6.5 && lat < 37.5 && lng > 68.0 && lng < 98.0;

    let timeoutId;

    if (hasValidCoords) {
      const isNewVehicle = prevVehicleIdRef.current !== targetId;
      prevVehicleIdRef.current = targetId;

      // Only pan if it's an update to the SAME vehicle and the user hasn't manually moved the map
      if (!isNewVehicle && !userDraggedMapRef.current) {
        map.panTo([lat, lng], { animate: true, duration: 0.8 });
      }

      // Delay drawing the permanent trail by the exact duration of the marker animation (800ms).
      // While it's delayed, the VehicleMarker draws a temporary animated "pouring" line.
      const delay = isNewVehicle ? 0 : 800;

      timeoutId = setTimeout(() => {
        // Append the live point to the route trail
        setRoutePoints(prev => {
          const base = isNewVehicle ? [] : prev;
          const last = base[base.length - 1];
          if (!last || last.lat !== lat || last.lng !== lng) {
            return [...base, { lat, lng }];
          }
          return base;
        });

        // Keep a trail of the last 10 points for the dashed line
        setLiveTrail(prev => {
          const base = isNewVehicle ? [] : prev;
          const nextList = [...base, [lat, lng]];
          if (nextList.length > 10) nextList.shift();
          return nextList;
        });
      }, delay);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [selectedVehicle?.id, selectedVehicles?.[0]?.id, vehicles, map, followSelected]);

  const positions = routePoints.length > 0 ? routePoints.map(p => [parseFloat(p.lat), parseFloat(p.lng)]) : [];
  const segments = splitIntoSegments(positions);
  const startPoint = positions[0] || null;

  const startFlagIcon = L.divIcon({
    html: `<div style="
      display:flex;align-items:center;gap:4px;
      background:#16a34a;color:#fff;
      font-size:10px;font-weight:800;
      padding:3px 7px 3px 5px;
      border-radius:6px;
      border:2px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,0.35);
      white-space:nowrap;
      line-height:1.2;
      font-family:system-ui,sans-serif;
    ">
      <span style="font-size:13px;line-height:1;">🚩</span>
      <span>Start</span>
    </div>
    <div style="
      width:2px;height:8px;
      background:#16a34a;
      margin-left:10px;
      box-shadow:0 1px 3px rgba(0,0,0,0.2);
    "></div>`,
    className: '',
    iconSize: [60, 36],
    iconAnchor: [2, 36],
    popupAnchor: [30, -36],
  });

  if (isMultiMode || !showRoute) return null;

  return (
    <>
      {segments.map((seg, idx) => seg.length > 1 && (
        <React.Fragment key={idx}>
          <Polyline positions={seg} color="#0EA5E9" weight={4} opacity={0.7} />
          <Polyline positions={seg} color="#38BDF8" weight={2} opacity={1} />
        </React.Fragment>
      ))}

      {/* Start Flag at first route point */}
      {startPoint && (
        <Marker position={startPoint} icon={startFlagIcon} zIndexOffset={5000}>
          <Tooltip permanent={false} direction="top" offset={[28, -36]}>
            <span style={{ fontSize: '11px', fontWeight: 700 }}>Trip Start</span>
          </Tooltip>
        </Marker>
      )}

      {/* Live Trail Polyline (like VehicleMap) */}
      {liveTrail.length > 1 && (
        <Polyline
          positions={liveTrail}
          color="#3b82f6"
          weight={4}
          opacity={0.8}
          dashArray="5, 10"
        />
      )}
    </>
  );
};


import { getVehicleType, getVehicleStatus, STATUS_CONFIG, createPinIcon, createTeardropIcon } from '../../utils/markerUtils';

const VehicleMarker = ({ vehicle, isSelected, onMarkerClick, zIndexOffset = 0, liveRouteMetrics = {}, isMultiMode = false }) => {
  const markerRef = useRef(null);
  const navigate = useNavigate();
  const map = useMap();

  // ── Smooth position animation (Rapido-style) ─────────────────────────
  const animFrameRef = useRef(null);
  const prevLatLngRef = useRef(null);
  const isMountedRef = useRef(false);

  const status = getVehicleStatus(vehicle);
  const cfg = STATUS_CONFIG[status];
  const noGps = !!vehicle._noGps;
  const newLat = parseFloat(vehicle.lat);
  const newLng = parseFloat(vehicle.lng);
  const warning = getExpiryWarning(vehicle.licence_expire_date);
  // Paywall: hide expired vehicle marker completely from live map
  if (warning && warning.type === 'expired') {
    return null;
  }
  const clusterRank = vehicle._clusterRank || 0;
  const speed = (status === 'offline' || status === 'unreachable' || !vehicle.is_online) ? 0 : Math.round(vehicle.current_speed || 0);
  const course = vehicle.current_direction || vehicle.direction || vehicle.course || vehicle.heading || 0;

  // ── KEY FIX: freeze the position prop at MOUNT TIME ──────────────────
  // react-leaflet watches position prop and calls marker.setLatLng() immediately
  // when it changes, which TELEPORTS the marker and breaks smooth animation.
  // By freezing this ref, only our rAF interpolation moves the marker.
  const initialPositionRef = useRef([newLat, newLng]);

  // Animate marker from old position to new position using rAF interpolation
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const targetLat = newLat;
    const targetLng = newLng;

    // First mount — place instantly, no animation
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      prevLatLngRef.current = { lat: targetLat, lng: targetLng };
      marker.setLatLng([targetLat, targetLng]);
      return;
    }

    const prev = prevLatLngRef.current;
    if (!prev) {
      prevLatLngRef.current = { lat: targetLat, lng: targetLng };
      return;
    }

    // No change — skip animation
    if (prev.lat === targetLat && prev.lng === targetLng) return;

    // Cancel any running animation
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    const currentLatLng = marker.getLatLng();
    const fromLat = currentLatLng ? currentLatLng.lat : prev.lat;
    const fromLng = currentLatLng ? currentLatLng.lng : prev.lng;

    // Use a brisk 800ms duration so the marker swiftly keeps up with the trail
    const DURATION = 800;
    const startTime = performance.now();

    let pouringLine = null;

    const animate = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / DURATION, 1);
      // Linear or slight ease-out is better for continuous GPS updates so it doesn't stop/start abruptly
      const ease = t;

      const lat = fromLat + (targetLat - fromLat) * ease;
      const lng = fromLng + (targetLng - fromLng) * ease;

      if (marker && marker.setLatLng) {
        marker.setLatLng([lat, lng]);
      }

      // Draw the "pouring" trail behind the vehicle while it animates
      if (map && !isMultiMode) {
        if (!pouringLine) {
          // Inner bright line
          pouringLine = L.polyline([[fromLat, fromLng], [lat, lng]], { color: "#38BDF8", weight: 3, opacity: 1 }).addTo(map);
        } else {
          pouringLine.setLatLngs([[fromLat, fromLng], [lat, lng]]);
        }
      }

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        animFrameRef.current = null;
        prevLatLngRef.current = { lat: targetLat, lng: targetLng };
        // Clean up the temporary pouring line (the permanent route line takes over now)
        if (pouringLine) {
          pouringLine.remove();
          pouringLine = null;
        }
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
    prevLatLngRef.current = { lat: targetLat, lng: targetLng };

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (pouringLine) {
        pouringLine.remove();
        pouringLine = null;
      }
    };
  }, [newLat, newLng]);

  // Open/close popup on selection
  useEffect(() => {
    if (isSelected && markerRef.current) {
      try {
        map.closePopup();
        markerRef.current.openPopup();
      } catch (e) {
        console.error("Popup open error:", e);
      }
    } else if (!isSelected && markerRef.current) {
      markerRef.current.closePopup();
    }
  }, [isSelected, map]);

  // Memoize the initial icon so react-leaflet never destroys the DOM node during position updates
  const initialIcon = useMemo(() => {
    return createPinIcon(vehicle, noGps, clusterRank, { speed, course, status });
  }, []); // Only run once on mount

  // Manually update the icon HTML when properties change
  useEffect(() => {
    if (markerRef.current && markerRef.current._icon) {
      const newIcon = createPinIcon(vehicle, noGps, clusterRank, { speed, course, status });
      markerRef.current._icon.innerHTML = newIcon.options.html;
    }
  }, [speed, course, status, noGps, clusterRank, vehicle]);

  return (
    <Marker
      position={initialPositionRef.current}  // ← frozen at mount; rAF handles all movement
      icon={initialIcon}
      ref={markerRef}
      zIndexOffset={zIndexOffset}
      eventHandlers={{
        click: () => {
          if (onMarkerClick) onMarkerClick(vehicle);
          if (markerRef.current) markerRef.current.openPopup();
        }
      }}
    >
      <Popup
        className="legacy-style-popup"
        closeButton={true}
        offset={[0, -5]}
        autoPan={false}
      >
        <div style={{ minWidth: '240px', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: '11px', padding: '2px 0' }}>
          {/* No GPS notice */}
          {noGps && (
            <div style={{ marginBottom: '6px', padding: '4px 8px', borderRadius: '6px', background: '#F3F4F6', border: '1px solid #D1D5DB', color: '#6B7280', fontSize: '11px', fontWeight: 600 }}>
              📍 No GPS location yet — placeholder position
            </div>
          )}

          {/* Expiry Warning */}
          {warning && (
            <div style={{ marginBottom: '6px', padding: '4px 8px', borderRadius: '6px', background: warning.type === 'expired' ? '#FEF2F2' : '#FFFBEB', border: `1px solid ${warning.type === 'expired' ? '#FECACA' : '#FDE68A'}`, color: warning.type === 'expired' ? '#EF4444' : '#F59E0B', fontSize: '11px', fontWeight: 700 }}>
              ⚠️ {warning.text}
            </div>
          )}

          {/* Table Grid matching Screenshot */}
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', lineHeight: '1.6' }}>
            <tbody>
              <tr>
                <td style={{ color: '#4b5563', fontWeight: 600, padding: '2px 0', width: '105px' }}>Vehicle Name</td>
                <td style={{ color: '#111827', fontWeight: 700, padding: '2px 0' }}>- {vehicle.name}</td>
              </tr>
              <tr>
                <td style={{ color: '#4b5563', fontWeight: 600, padding: '2px 0' }}>Today Distance</td>
                <td style={{ color: '#111827', fontWeight: 700, padding: '2px 0' }}>
                  - {liveRouteMetrics[vehicle.id]?.cDist !== undefined ? Number(liveRouteMetrics[vehicle.id].cDist).toFixed(2) : (Number(vehicle.today_distance) || 0).toFixed(2)} kms
                </td>
              </tr>
              {getNoDataDuration(vehicle.last_seen) && (status === 'offline' || status === 'nodata') ? (
                <>
                  <tr>
                    <td style={{ color: '#4b5563', fontWeight: 600, padding: '2px 0' }}>No Data</td>
                    <td style={{ color: '#ef4444', fontWeight: 700, padding: '2px 0' }}>- {getNoDataDuration(vehicle.last_seen)}</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#4b5563', fontWeight: 600, padding: '2px 0' }}>Reason</td>
                    <td style={{ color: '#ef4444', fontWeight: 700, padding: '2px 0' }}>- No Data Received</td>
                  </tr>
                </>
              ) : (!vehicle.last_seen || status === 'unreachable' || status === 'unavailable') ? (
                <>
                  <tr>
                    <td style={{ color: '#4b5563', fontWeight: 600, padding: '2px 0' }}>Status</td>
                    <td style={{ color: '#94a3b8', fontWeight: 700, padding: '2px 0' }}>- Unreachable</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#4b5563', fontWeight: 600, padding: '2px 0' }}>Reason</td>
                    <td style={{ color: '#94a3b8', fontWeight: 700, padding: '2px 0' }}>- Never Communicated</td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td style={{ color: '#4b5563', fontWeight: 600, padding: '2px 0' }}>Moving</td>
                  <td style={{ color: status === 'running' ? '#10b981' : status === 'idle' ? '#f59e0b' : '#64748b', fontWeight: 700, padding: '2px 0' }}>
                    - {status === 'running' ? 'Running' : status === 'idle' ? 'Idle' : 'Parked'}
                  </td>
                </tr>
              )}
              <tr>
                <td style={{ color: '#4b5563', fontWeight: 600, padding: '2px 0' }}>ACC Status</td>
                <td style={{ color: vehicle.current_ignition ? '#16a34a' : '#ef4444', fontWeight: 700, padding: '2px 0' }}>
                  - {vehicle.current_ignition ? 'ON' : 'OFF'}
                </td>
              </tr>
              <tr>
                <td style={{ color: '#4b5563', fontWeight: 600, padding: '2px 0' }}>Loc Time</td>
                <td style={{ color: '#111827', fontWeight: 700, padding: '2px 0' }}>- {formatCardDateTime(vehicle.last_seen)}</td>
              </tr>
              <tr>
                <td style={{ color: '#4b5563', fontWeight: 600, padding: '2px 0' }}>Comm Time</td>
                <td style={{ color: '#111827', fontWeight: 700, padding: '2px 0' }}>- {formatCardDateTime(vehicle.last_seen)}</td>
              </tr>
            </tbody>
          </table>

          {/* Action Links */}
          <div style={{ display: 'flex', gap: '14px', borderTop: '1px solid #f1f5f9', paddingTop: '8px', marginTop: '6px', fontSize: '11px', fontWeight: 700 }}>
            <a
              href="/reports"
              onClick={(e) => { e.preventDefault(); navigate('/reports'); }}
              style={{ color: '#0284c7', textDecoration: 'none', cursor: 'pointer' }}
            >
              Reports
            </a>
            <a
              href={`/tracking?vehicle=${vehicle.id}`}
              onClick={(e) => { e.preventDefault(); navigate(`/tracking?vehicle=${vehicle.id}`); }}
              style={{ color: '#0284c7', textDecoration: 'none', cursor: 'pointer' }}
            >
              Track
            </a>
            <a
              href={`/vehicles/${vehicle.id}/history`}
              onClick={(e) => { e.preventDefault(); navigate(`/vehicles/${vehicle.id}/history`); }}
              style={{ color: '#0284c7', textDecoration: 'none', cursor: 'pointer' }}
            >
              History
            </a>
            <a
              href={`/vehicles/${vehicle.id}`}
              onClick={(e) => { e.preventDefault(); navigate(`/vehicles/${vehicle.id}`); }}
              style={{ color: '#0284c7', textDecoration: 'none', cursor: 'pointer' }}
            >
              Details
            </a>
          </div>
        </div>
      </Popup>
    </Marker>
  );
};

// ── Dynamic Vehicle Markers Layer ──────────────────────────────────────

const VehicleMarkersLayer = ({ vehicles, allSelected, onMarkerClick, liveRouteMetrics = {}, isMultiMode = false }) => {
  const map = useMap();

  // Step 1: resolve / validate every vehicle's coordinates
  const resolved = vehicles.filter(v => {
    const w = getExpiryWarning(v.licence_expire_date);
    return !(w && w.type === 'expired');
  }).map((vehicle, idx) => {
    let finalLat = parseFloat(vehicle.lat);
    let finalLng = parseFloat(vehicle.lng);
    const hasValidCoords = !isNaN(finalLat) && !isNaN(finalLng)
      && finalLat !== 0 && finalLng !== 0
      && finalLat > 6 && finalLat < 38
      && finalLng > 68 && finalLng < 98;

    return { vehicle, finalLat, finalLng, hasValidCoords };
  }).filter(v => v.hasValidCoords);

  // Step 2: Render individual markers directly without clustering (using LayerGroup for stable context)
  return (
    <LayerGroup>
      {resolved.map(({ vehicle, finalLat, finalLng, hasValidCoords }) => {
        const safeVehicle = {
          ...vehicle,
          lat: finalLat,
          lng: finalLng,
          _noGps: !hasValidCoords
        };
        const isSelected = allSelected.some(sv => sv.id === safeVehicle.id);
        const zOffset = isSelected ? 10000 : 0;

        return (
          <VehicleMarker
            key={safeVehicle.id}
            vehicle={safeVehicle}
            isSelected={isSelected}
            onMarkerClick={onMarkerClick}
            zIndexOffset={zOffset}
            liveRouteMetrics={liveRouteMetrics}
            isMultiMode={isMultiMode}
          />
        );
      })}
    </LayerGroup>
  );
};

// Auto-resize map when container dimensions change
const ResizeMap = () => {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (map && map.getContainer()) {
        try {
          map.invalidateSize();
        } catch (e) {
          console.warn('Map resize adjustment failed:', e.message);
        }
      }
    });
    const container = map.getContainer();
    if (container) {
      observer.observe(container);
    }
    return () => {
      observer.disconnect();
    };
  }, [map]);
  return null;
};

const FleetMap = ({
  vehicles = [],
  selectedVehicle = null,
  selectedVehicles = null,
  onMarkerClick,
  isMultiMode = false,
  showRoute = false,
  followSelected = false,
  nearbyRadius = null,
  isNearbyActive = false,
  liveRouteMetrics = {},
  onRouteFetched
}) => {
  const location = useLocation();
  // Support both singular (CustomerDashboard) and plural (TrackingPage) prop patterns
  // selectedVehicles (array) takes priority; fall back to singular selectedVehicle
  const effectiveSelected = selectedVehicles != null
    ? (Array.isArray(selectedVehicles) ? selectedVehicles[0] || null : selectedVehicles)
    : selectedVehicle;

  const allSelected = selectedVehicles != null
    ? (Array.isArray(selectedVehicles) ? selectedVehicles : [selectedVehicles])
    : (selectedVehicle ? [selectedVehicle] : []);

  const { profile } = useProfile();
  const apiKey = profile?.api_key || '';

  const [mapType, setMapType] = useState('osm'); // 'osm' or 'google'



  // Default map center for Hyderabad city (Miyapur / Kukatpally)
  const defaultCenter = [17.3850, 78.4867];
  const mapCenter = effectiveSelected && effectiveSelected.lat && effectiveSelected.lng
    ? [parseFloat(effectiveSelected.lat), parseFloat(effectiveSelected.lng)]
    : vehicles.length > 0 && vehicles[0].lat && vehicles[0].lng
      ? [parseFloat(vehicles[0].lat), parseFloat(vehicles[0].lng)]
      : defaultCenter;

  return (
    <div className="w-full h-full relative border border-slate-200 rounded-xl overflow-hidden shadow-sm" style={{ zIndex: 1 }}>
      {/* Map type selector overlay */}
      <div style={{
        position: 'absolute',
        top: '64px',
        right: '12px',
        zIndex: 1000,
        background: '#ffffff',
        border: '1px solid #bae6fd',
        borderRadius: '8px',
        padding: '4px 8px',
        boxShadow: '0 2px 10px rgba(249,115,22,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#4d6076' }}>Map:</span>
        <select
          value={mapType}
          onChange={(e) => setMapType(e.target.value)}
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#f97316',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            cursor: 'pointer'
          }}
        >
          <option value="osm">OSM</option>
          <option value="google">Google</option>
          <option value="satellite">Satellite</option>
        </select>
      </div>

      <MapContainer
        key={location.pathname}
        center={mapCenter}
        zoom={13}
        className="w-full h-full"
        zoomControl={false}
        zoomAnimation={false}
        fadeAnimation={false}
        markerZoomAnimation={false}
      >
        <ResizeMap />

        {/* Dynamic Tile Layer based on mapType */}
        {mapType === 'osm' ? (
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        ) : mapType === 'satellite' ? (
          <TileLayer
            attribution='&copy; Google'
            url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
            maxNativeZoom={20}
            maxZoom={22}
          />
        ) : (
          <TileLayer
            attribution='&copy; Google'
            url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            maxNativeZoom={20}
            maxZoom={22}
          />
        )}

        {/* Radius Circle for Nearby Mode */}
        {isNearbyActive && effectiveSelected && effectiveSelected.lat && effectiveSelected.lng && (
          <Circle
            center={[effectiveSelected.lat, effectiveSelected.lng]}
            radius={nearbyRadius * 1000} // Radius is expected in meters for Circle
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.1,
              weight: 2,
              dashArray: '5, 5'
            }}
          />
        )}

        {/* Handle map zooming and vehicle route plotting */}
        <VehicleRouteAndFit
          selectedVehicle={effectiveSelected}
          vehicles={vehicles}
          showRoute={!isMultiMode && (showRoute || !!effectiveSelected)}
          followSelected={!isMultiMode && followSelected}
          onRouteFetched={onRouteFetched}
          isMultiMode={isMultiMode}
        />

        {/* Vehicle Markers — Dynamic screen-space clustering */}
        <VehicleMarkersLayer
          vehicles={vehicles}
          allSelected={allSelected}
          onMarkerClick={onMarkerClick}
          liveRouteMetrics={liveRouteMetrics}
          isMultiMode={isMultiMode}
        />
      </MapContainer>

      <style dangerouslySetInnerHTML={{
        __html: `
          .legacy-style-popup .leaflet-popup-content-wrapper {
            background: #ffffff !important;
            border: 1px solid #e2e8f0 !important;
            border-top: none !important;
            border-radius: 12px !important;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
            padding: 0 !important;
          }
          .legacy-style-popup .leaflet-popup-content {
            margin: 12px 14px !important;
          }
          .legacy-style-popup .leaflet-popup-close-button {
            top: 6px !important;
            right: 8px !important;
            color: #64748b !important;
            font-size: 16px !important;
          }
          .legacy-style-popup .leaflet-popup-tip-container {
            display: block !important;
          }
          
          /* Prevent Leaflet's rectangular bounding box from blocking hover events for overlapping markers */
          .custom-marker-icon {
            pointer-events: none !important;
            background: transparent !important;
            border: none !important;
          }
          .custom-marker-icon .pin-interactive {
            pointer-events: auto !important;
            cursor: pointer;
          }
          @keyframes pulse-ring {
            0% { transform: translate(-50%, -50%) scale(0.85); opacity: 0.5; }
            80%, 100% { transform: translate(-50%, -50%) scale(1.4); opacity: 0; }
          }
        `
      }} />
    </div>
  );
};

export default FleetMap;
