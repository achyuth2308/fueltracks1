'use strict';

const db = require('../../../config/db');
const GeofenceModel = require('../../../models/geofenceModel');

// Haversine formula in metres
function getHaversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Ray-casting algorithm for point in polygon
function isPointInPolygon(lat, lng, polygon) {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;
    const intersect = ((yi > lng) !== (yj > lng))
      && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Helper to normalize polygon coordinates
function normalizeGeofenceCoords(rawCoords) {
  if (!rawCoords) return [];
  let data = rawCoords;
  if (typeof rawCoords === 'string') {
    try { data = JSON.parse(rawCoords); } catch (_) { return []; }
  }
  if (!Array.isArray(data)) return [];

  const points = [];
  for (const item of data) {
    if (!item) continue;
    let lat = null, lng = null;
    if (Array.isArray(item) && item.length >= 2) {
      const v0 = Number(item[0]);
      const v1 = Number(item[1]);
      if (Math.abs(v0) > 90 && Math.abs(v1) <= 90) {
        lng = v0; lat = v1;
      } else if (v0 > 60 && v1 < 40) {
        lng = v0; lat = v1;
      } else {
        lat = v0; lng = v1;
      }
    } else if (typeof item === 'object') {
      const rLat = item.lat ?? item.latitude;
      const rLng = item.lng ?? item.lon ?? item.longitude;
      if (rLat != null && rLng != null) {
        lat = Number(rLat);
        lng = Number(rLng);
      }
    }
    if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
      points.push({ lat, lng });
    }
  }
  return points;
}

// Check if a point is inside a geofence object
function isInsideGeofence(lat, lng, geofence) {
  if (!geofence || lat == null || lng == null) return false;

  if (geofence.type === 'circle') {
    const cLat = Number(geofence.center_lat);
    const cLng = Number(geofence.center_lng);
    const radius = Number(geofence.radius) || 200;
    if (isNaN(cLat) || isNaN(cLng)) return false;
    const dist = getHaversineMeters(lat, lng, cLat, cLng);
    return dist <= radius;
  }

  // Polygon
  const pts = geofence._normalizedCoords || normalizeGeofenceCoords(geofence.coordinates);
  geofence._normalizedCoords = pts;
  return isPointInPolygon(lat, lng, pts);
}

// Formats duration in seconds to human-readable string
function formatDuration(seconds) {
  const s = Math.round(seconds || 0);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

class GeofenceTransitService {
  /**
   * Generates Geofence Transit Report for:
   * 1) single_way (A -> B)
   * 2) two_way (A <-> B: Outbound A->B, Inbound B->A)
   * 3) same_location (A -> Field -> A)
   */
  async getTransitReport(filters, startDate, endDate) {
    const {
      vehicleId,
      groupId,
      orgId,
      role,
      userId,
      fromGeofenceId,
      toGeofenceId,
      mode = 'all', // 'single_way' | 'two_way' | 'same_location' | 'all'
    } = filters;

    // 1. Resolve target vehicle(s)
    let vehicleIds = [];
    if (role === 'customer' && userId) {
      const res = await db.query(`
        SELECT vg.vehicle_id 
        FROM vehicle_groups vg
        JOIN user_groups ug ON vg.group_id = ug.group_id
        JOIN vehicles v ON vg.vehicle_id = v.id
        WHERE ug.user_id = $1 AND v.is_active = true
      `, [userId]);
      const allowed = res.rows.map(r => r.vehicle_id);
      if (vehicleId) vehicleIds = allowed.filter(id => id === vehicleId);
      else vehicleIds = allowed;
    } else if (vehicleId) {
      vehicleIds = [vehicleId];
    } else if (groupId) {
      const gRes = await db.query('SELECT vehicle_id FROM vehicle_groups WHERE group_id = $1', [groupId]);
      vehicleIds = gRes.rows.map(r => r.vehicle_id);
    } else if (orgId) {
      const vRes = await db.query(`
        SELECT id FROM vehicles 
        WHERE (org_id = $1 OR org_id IN (SELECT id FROM organizations WHERE parent_id = $1))
          AND is_active = true
      `, [orgId]);
      vehicleIds = vRes.rows.map(r => r.id);
    } else {
      const allRes = await db.query('SELECT id FROM vehicles WHERE is_active = true LIMIT 50');
      vehicleIds = allRes.rows.map(r => r.id);
    }

    if (vehicleIds.length === 0) return [];

    // 2. Fetch Vehicle Details
    const placeholders = vehicleIds.map((_, i) => `$${i + 1}`).join(',');
    const vQuery = `
      SELECT v.id, v.name, v.plate, o.name as org_name
      FROM vehicles v
      LEFT JOIN organizations o ON v.org_id = o.id
      WHERE v.id IN (${placeholders})
    `;
    const vRes = await db.query(vQuery, vehicleIds);
    const vehicleMap = {};
    vRes.rows.forEach(r => { vehicleMap[r.id] = r; });

    // 3. Fetch Geofences
    let geofencesToTest = [];
    if (fromGeofenceId && toGeofenceId) {
      const gRes = await db.query(
        'SELECT * FROM geofences WHERE id IN ($1, $2)',
        [fromGeofenceId, toGeofenceId]
      );
      geofencesToTest = gRes.rows;
    } else if (fromGeofenceId) {
      const gRes = await db.query('SELECT * FROM geofences WHERE id = $1', [fromGeofenceId]);
      geofencesToTest = gRes.rows;
    } else {
      // Load geofences associated with vehicles or org
      const gRes = await db.query('SELECT * FROM geofences WHERE is_active = true LIMIT 100');
      geofencesToTest = gRes.rows;
    }

    // Pre-cache normalized coordinates
    geofencesToTest.forEach(g => {
      g._normalizedCoords = normalizeGeofenceCoords(g.coordinates);
    });

    const geofenceMap = {};
    geofencesToTest.forEach(g => { geofenceMap[g.id] = g; });

    const selectedFrom = fromGeofenceId ? geofenceMap[fromGeofenceId] : null;
    const selectedTo = toGeofenceId ? geofenceMap[toGeofenceId] : null;

    const allReportRows = [];

    // 4. Process each vehicle's GPS trajectory
    for (const vId of vehicleIds) {
      const vInfo = vehicleMap[vId] || {};

      // Fetch chronological points
      const ptsRes = await db.query(`
        SELECT lat, lng, speed, odometer, device_time
        FROM gps_points
        WHERE vehicle_id = $1
          AND device_time BETWEEN $2 AND $3
          AND lat IS NOT NULL AND lng IS NOT NULL
        ORDER BY device_time ASC
      `, [vId, startDate, endDate]);

      const points = ptsRes.rows;
      if (points.length < 2) continue;

      // Determine geofence set to evaluate for this vehicle
      let targetFrom = selectedFrom;
      let targetTo = selectedTo;

      // If specific geofences weren't selected, find all geofences assigned to this vehicle
      let activeGeofences = geofencesToTest;
      if (!targetFrom && !targetTo) {
        const assignedRes = await db.query(`
          SELECT g.* FROM geofences g
          JOIN vehicle_geofences vg ON g.id = vg.geofence_id
          WHERE vg.vehicle_id = $1 AND g.is_active = true
        `, [vId]);
        if (assignedRes.rows.length > 0) {
          activeGeofences = assignedRes.rows;
          activeGeofences.forEach(g => {
            g._normalizedCoords = normalizeGeofenceCoords(g.coordinates);
            geofenceMap[g.id] = g;
          });
        }
      }

      const vehicleTrips = this.detectGeofenceTransitions({
        vehicle: vInfo,
        points,
        geofences: activeGeofences,
        fromGeofence: targetFrom,
        toGeofence: targetTo,
        mode,
      });

      allReportRows.push(...vehicleTrips);
    }

    // Sort descending by departure time
    return allReportRows.sort((a, b) => new Date(b.departure_time) - new Date(a.departure_time));
  }

  /**
   * Core State-Machine to detect transitions between geofences
   */
  detectGeofenceTransitions({ vehicle, points, geofences, fromGeofence, toGeofence, mode }) {
    const results = [];
    const n = points.length;
    if (n < 2 || geofences.length === 0) return results;

    const isSameLocationMode = mode === 'same_location' || (fromGeofence && toGeofence && fromGeofence.id === toGeofence.id);

    // Identify which geofence each point is in (null if in transit)
    const pointGeoMap = new Array(n);
    for (let i = 0; i < n; i++) {
      const p = points[i];
      let insideId = null;

      if (fromGeofence && isInsideGeofence(p.lat, p.lng, fromGeofence)) {
        insideId = fromGeofence.id;
      } else if (toGeofence && isInsideGeofence(p.lat, p.lng, toGeofence)) {
        insideId = toGeofence.id;
      } else if (!fromGeofence && !toGeofence) {
        for (const g of geofences) {
          if (isInsideGeofence(p.lat, p.lng, g)) {
            insideId = g.id;
            break;
          }
        }
      }
      pointGeoMap[i] = insideId;
    }

    // ─────────────────────────────────────────────────────────────
    // CASE A: SAME LOCATION LOOP (Origin == Destination == G)
    // Departure: Last point inside G before leaving
    // Arrival: First point re-entering G
    // ─────────────────────────────────────────────────────────────
    if (isSameLocationMode) {
      const targetG = fromGeofence || toGeofence || geofences[0];
      if (!targetG) return results;

      let inLoop = false;
      let departPoint = null;
      let departIndex = -1;
      let accumulatedDistanceM = 0;
      let maxSpeed = 0;
      let previewPoints = [];

      for (let i = 0; i < n; i++) {
        const p = points[i];
        const isInside = pointGeoMap[i] === targetG.id;

        if (isInside) {
          if (inLoop) {
            // Re-entered the same geofence -> Loop completed!
            const arrivePoint = p;
            const durationSec = (new Date(arrivePoint.device_time) - new Date(departPoint.device_time)) / 1000;
            const distKm = Number((accumulatedDistanceM / 1000).toFixed(2));

            // Filter out minor boundary fluctuations (must be > 60s and > 0.1 km)
            if (durationSec >= 60 && distKm >= 0.1) {
              const avgSpeed = durationSec > 0 ? Number(((distKm / (durationSec / 3600))).toFixed(1)) : 0;

              results.push({
                vehicle_id: vehicle.id,
                vehicle_name: vehicle.name,
                plate: vehicle.plate,
                org_name: vehicle.org_name,
                trip_type: 'same_location',
                trip_label: 'Same Location Loop',
                from_geofence_id: targetG.id,
                from_geofence_name: targetG.name,
                from_geofence_color: targetG.color || '#3B82F6',
                departure_time: departPoint.device_time,
                to_geofence_id: targetG.id,
                to_geofence_name: targetG.name,
                to_geofence_color: targetG.color || '#3B82F6',
                arrival_time: arrivePoint.device_time,
                duration_seconds: Math.round(durationSec),
                duration_formatted: formatDuration(durationSec),
                distance_km: distKm,
                avg_speed_kmh: avgSpeed,
                max_speed_kmh: Math.round(maxSpeed),
                start_lat: departPoint.lat,
                start_lng: departPoint.lng,
                end_lat: arrivePoint.lat,
                end_lng: arrivePoint.lng,
                path_preview: previewPoints.slice(0, 50),
              });
            }

            inLoop = false;
            accumulatedDistanceM = 0;
            maxSpeed = 0;
            previewPoints = [];
          }

          departPoint = p;
          departIndex = i;
        } else {
          // Outside geofence
          if (departPoint && !inLoop) {
            inLoop = true;
            accumulatedDistanceM = 0;
            maxSpeed = p.speed || 0;
            previewPoints = [{ lat: departPoint.lat, lng: departPoint.lng }];
          }

          if (inLoop && i > 0) {
            const prev = points[i - 1];
            const segDist = getHaversineMeters(prev.lat, prev.lng, p.lat, p.lng);
            if (segDist < 5000) accumulatedDistanceM += segDist;
            if (p.speed > maxSpeed) maxSpeed = p.speed;
            if (previewPoints.length < 50 && i % Math.max(1, Math.floor(n / 100)) === 0) {
              previewPoints.push({ lat: p.lat, lng: p.lng });
            }
          }
        }
      }

      return results;
    }

    // ─────────────────────────────────────────────────────────────
    // CASE B: SINGLE-WAY (A -> B) & TWO-WAY (A <-> B)
    // ─────────────────────────────────────────────────────────────
    let currentOriginG = null;
    let departPoint = null;
    let accumulatedDistanceM = 0;
    let maxSpeed = 0;
    let inTransit = false;
    let previewPoints = [];

    const geofenceLookup = {};
    geofences.forEach(g => { geofenceLookup[g.id] = g; });

    for (let i = 0; i < n; i++) {
      const p = points[i];
      const gId = pointGeoMap[i];

      if (gId) {
        const currentG = geofenceLookup[gId];

        if (inTransit && currentOriginG && currentG.id !== currentOriginG.id) {
          // Arrived at a different geofence!
          const destG = currentG;

          // Check if this transition matches the requested mode/pair
          let shouldInclude = false;
          let tripType = 'single_way';
          let tripLabel = 'Single-Way';

          if (fromGeofence && toGeofence) {
            if (currentOriginG.id === fromGeofence.id && destG.id === toGeofence.id) {
              shouldInclude = true;
              tripType = (mode === 'two_way') ? 'outbound' : 'single_way';
              tripLabel = (mode === 'two_way') ? 'Outbound Leg (A → B)' : 'Single-Way (A → B)';
            } else if (mode === 'two_way' && currentOriginG.id === toGeofence.id && destG.id === fromGeofence.id) {
              shouldInclude = true;
              tripType = 'inbound';
              tripLabel = 'Inbound Leg (B → A)';
            }
          } else if (fromGeofence) {
            if (currentOriginG.id === fromGeofence.id) {
              shouldInclude = true;
            }
          } else if (toGeofence) {
            if (destG.id === toGeofence.id) {
              shouldInclude = true;
            }
          } else {
            // General multi-way between any active geofences
            shouldInclude = true;
            tripLabel = `${currentOriginG.name} → ${destG.name}`;
          }

          if (shouldInclude) {
            const arrivePoint = p;
            const durationSec = (new Date(arrivePoint.device_time) - new Date(departPoint.device_time)) / 1000;
            const distKm = Number((accumulatedDistanceM / 1000).toFixed(2));

            if (durationSec >= 30 && distKm >= 0.05) {
              const avgSpeed = durationSec > 0 ? Number(((distKm / (durationSec / 3600))).toFixed(1)) : 0;

              results.push({
                vehicle_id: vehicle.id,
                vehicle_name: vehicle.name,
                plate: vehicle.plate,
                org_name: vehicle.org_name,
                trip_type: tripType,
                trip_label: tripLabel,
                from_geofence_id: currentOriginG.id,
                from_geofence_name: currentOriginG.name,
                from_geofence_color: currentOriginG.color || '#3B82F6',
                departure_time: departPoint.device_time,
                to_geofence_id: destG.id,
                to_geofence_name: destG.name,
                to_geofence_color: destG.color || '#10B981',
                arrival_time: arrivePoint.device_time,
                duration_seconds: Math.round(durationSec),
                duration_formatted: formatDuration(durationSec),
                distance_km: distKm,
                avg_speed_kmh: avgSpeed,
                max_speed_kmh: Math.round(maxSpeed),
                start_lat: departPoint.lat,
                start_lng: departPoint.lng,
                end_lat: arrivePoint.lat,
                end_lng: arrivePoint.lng,
                path_preview: previewPoints.slice(0, 50),
              });
            }
          }

          inTransit = false;
          accumulatedDistanceM = 0;
          maxSpeed = 0;
          previewPoints = [];
        }

        // Update origin geofence anchor
        currentOriginG = currentG;
        departPoint = p;
      } else {
        // Point is outside all geofences -> In Transit!
        if (currentOriginG && !inTransit) {
          inTransit = true;
          accumulatedDistanceM = 0;
          maxSpeed = p.speed || 0;
          previewPoints = [{ lat: departPoint.lat, lng: departPoint.lng }];
        }

        if (inTransit && i > 0) {
          const prev = points[i - 1];
          const segDist = getHaversineMeters(prev.lat, prev.lng, p.lat, p.lng);
          if (segDist < 5000) accumulatedDistanceM += segDist;
          if (p.speed > maxSpeed) maxSpeed = p.speed;
          if (previewPoints.length < 50 && i % Math.max(1, Math.floor(n / 100)) === 0) {
            previewPoints.push({ lat: p.lat, lng: p.lng });
          }
        }
      }
    }

    return results;
  }
}

module.exports = new GeofenceTransitService();
