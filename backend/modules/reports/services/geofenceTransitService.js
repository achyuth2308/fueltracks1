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

// Fast Bounding Box calculation for polygon
function getPolygonBBox(pts) {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  return { minLat, maxLat, minLng, maxLng };
}

// Check if a point is inside a geofence object with fast bounding-box rejection
function isInsideGeofence(lat, lng, geofence) {
  if (!geofence || lat == null || lng == null) return false;

  if (geofence.type === 'circle') {
    const cLat = Number(geofence.center_lat);
    const cLng = Number(geofence.center_lng);
    const radius = Number(geofence.radius) || 200;
    if (isNaN(cLat) || isNaN(cLng)) return false;
    
    // Fast degree bounding box check (1 deg lat ~ 111,000m)
    // Avoids expensive trigonometric calls (Math.sin, Math.cos, Math.atan2) for 99% of points
    const degLat = radius / 111000;
    const degLng = radius / (111000 * (Math.cos(cLat * Math.PI / 180) || 1));
    if (Math.abs(lat - cLat) > degLat || Math.abs(lng - cLng) > degLng) {
      return false;
    }

    const dist = getHaversineMeters(lat, lng, cLat, cLng);
    return dist <= radius;
  }

  // Polygon
  const pts = geofence._normalizedCoords || normalizeGeofenceCoords(geofence.coordinates);
  geofence._normalizedCoords = pts;
  if (!geofence._bbox && pts.length >= 3) {
    geofence._bbox = getPolygonBBox(pts);
  }

  // Fast bounding-box rejection avoids heavy ray-casting for 99% of points
  if (geofence._bbox) {
    const b = geofence._bbox;
    if (lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng) {
      return false;
    }
  }

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
    let geofencesQuery = 'SELECT * FROM geofences WHERE is_active = true';
    let gParams = [];
    if (orgId) {
      geofencesQuery += ' AND (org_id = $1 OR org_id IN (SELECT id FROM organizations WHERE parent_id = $1))';
      gParams.push(orgId);
    }
    const gRes = await db.query(geofencesQuery, gParams);
    let geofencesToTest = gRes.rows;

    // Also fetch any specifically requested geofences if they were not in the above list
    if (fromGeofenceId && !geofencesToTest.some(g => g.id === fromGeofenceId)) {
      const fRes = await db.query('SELECT * FROM geofences WHERE id = $1', [fromGeofenceId]);
      if (fRes.rows[0]) geofencesToTest.push(fRes.rows[0]);
    }
    if (toGeofenceId && !geofencesToTest.some(g => g.id === toGeofenceId)) {
      const tRes = await db.query('SELECT * FROM geofences WHERE id = $1', [toGeofenceId]);
      if (tRes.rows[0]) geofencesToTest.push(tRes.rows[0]);
    }

    // Pre-cache normalized coordinates
    geofencesToTest.forEach(g => {
      g._normalizedCoords = normalizeGeofenceCoords(g.coordinates);
    });

    const geofenceMap = {};
    geofencesToTest.forEach(g => { geofenceMap[g.id] = g; });

    const selectedFrom = fromGeofenceId ? geofenceMap[fromGeofenceId] : null;
    const selectedTo = toGeofenceId ? geofenceMap[toGeofenceId] : null;

    // Batch query assigned geofences for all target vehicles in 1 single round-trip (avoids N queries in loop)
    const assignedRes = await db.query(`
      SELECT vg.vehicle_id, g.* FROM geofences g
      JOIN vehicle_geofences vg ON g.id = vg.geofence_id
      WHERE vg.vehicle_id = ANY($1::uuid[]) AND g.is_active = true
    `, [vehicleIds]);
    const vehicleGeofencesMap = {};
    assignedRes.rows.forEach(g => {
      if (!g._normalizedCoords) {
        g._normalizedCoords = normalizeGeofenceCoords(g.coordinates);
      }
      geofenceMap[g.id] = g;
      if (!vehicleGeofencesMap[g.vehicle_id]) vehicleGeofencesMap[g.vehicle_id] = [];
      vehicleGeofencesMap[g.vehicle_id].push(g);
    });

    const allReportRows = [];

    // 4. Process each vehicle's GPS trajectory
    for (const vId of vehicleIds) {
      const vInfo = vehicleMap[vId] || {};

      // Fetch chronological points with indexed lookup and safe limit (prevents excessive RAM/CPU)
      const ptsRes = await db.query(`
        SELECT lat, lng, speed, odometer, fuel, device_time
        FROM gps_points
        WHERE vehicle_id = $1
          AND device_time BETWEEN $2 AND $3
          AND lat IS NOT NULL AND lng IS NOT NULL
        ORDER BY device_time ASC
        LIMIT 15000
      `, [vId, startDate, endDate]);

      const points = ptsRes.rows;
      if (points.length < 2) continue;

      const assignedList = vehicleGeofencesMap[vId] || [];
      // Include all vehicle-assigned geofences plus any newly created active geofences so historical transitions are always found
      const activeGeofences = [...assignedList];
      for (const g of geofencesToTest) {
        if (!activeGeofences.some(existing => existing.id === g.id)) {
          activeGeofences.push(g);
        }
      }
      activeGeofences.forEach(g => {
        if (!g._normalizedCoords) {
          g._normalizedCoords = normalizeGeofenceCoords(g.coordinates);
        }
        geofenceMap[g.id] = g;
      });

      // Ensure explicitly filtered geofences are included in activeGeofences if available
      if (selectedFrom && !activeGeofences.some(g => g.id === selectedFrom.id)) {
        activeGeofences.push(selectedFrom);
      }
      if (selectedTo && !activeGeofences.some(g => g.id === selectedTo.id)) {
        activeGeofences.push(selectedTo);
      }

      const vehicleTrips = this.detectGeofenceTransitions({
        vehicle: vInfo,
        points,
        geofences: activeGeofences,
        fromGeofence: selectedFrom,
        toGeofence: selectedTo,
        mode,
      });

      allReportRows.push(...vehicleTrips);
    }

    // Sort descending by departure time
    return allReportRows.sort((a, b) => new Date(b.departure_time) - new Date(a.departure_time));
  }

  /**
   * Unified State-Machine to detect transitions between geofences
   * Supports:
   *  - Single-way between distinct geofences (A -> B, A -> C, B -> C, etc.)
   *  - Round trip loop / same location (A -> A, B -> B, C -> C)
   *  - Two-way shuttles (A <-> B)
   *  - All combinations with flexible From/To filters
   */
  detectGeofenceTransitions({ vehicle, points, geofences, fromGeofence, toGeofence, mode }) {
    const results = [];
    const n = points.length;
    if (n < 2 || geofences.length === 0) return results;

    // Identify which geofence each point is in (null if in transit)
    const pointGeoMap = new Array(n);
    for (let i = 0; i < n; i++) {
      const p = points[i];
      let insideId = null;
      for (const g of geofences) {
        if (isInsideGeofence(p.lat, p.lng, g)) {
          insideId = g.id;
          break;
        }
      }
      pointGeoMap[i] = insideId;
    }

    const geofenceLookup = {};
    geofences.forEach(g => { geofenceLookup[g.id] = g; });

    let currentOriginG = null;
    let departPoint = null;
    let accumulatedDistanceM = 0;
    let maxSpeed = 0;
    let inTransit = false;
    let previewPoints = [];

    for (let i = 0; i < n; i++) {
      const p = points[i];
      const gId = pointGeoMap[i];

      if (gId) {
        const currentG = geofenceLookup[gId];

        if (inTransit && currentOriginG) {
          const destG = currentG;
          const isSameGeofence = currentOriginG.id === destG.id;
          const arrivePoint = p;
          const durationSec = (new Date(arrivePoint.device_time) - new Date(departPoint.device_time)) / 1000;
          const distKm = Number((accumulatedDistanceM / 1000).toFixed(2));

          // Minimum thresholds to filter minor GPS drift:
          // Transit between different geofences: >= 30s and >= 0.05 km
          // Same geofence loop: >= 60s and >= 0.10 km
          const validMovement = isSameGeofence
            ? (durationSec >= 60 && distKm >= 0.1)
            : (durationSec >= 30 && distKm >= 0.05);

          if (validMovement) {
            let shouldInclude = false;
            let tripType = isSameGeofence ? 'same_location' : 'single_way';
            let tripLabel = isSameGeofence
              ? `${currentOriginG.name} → ${currentOriginG.name} (Loop)`
              : `${currentOriginG.name} → ${destG.name}`;

            if (fromGeofence && toGeofence) {
              if (currentOriginG.id === fromGeofence.id && destG.id === toGeofence.id) {
                shouldInclude = true;
                if (mode === 'two_way') {
                  tripType = 'outbound';
                  tripLabel = `Outbound (${fromGeofence.name} → ${toGeofence.name})`;
                }
              } else if (mode === 'two_way' && currentOriginG.id === toGeofence.id && destG.id === fromGeofence.id) {
                shouldInclude = true;
                tripType = 'inbound';
                tripLabel = `Inbound (${toGeofence.name} → ${fromGeofence.name})`;
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
              // No specific filter -> Include ALL transitions and loops
              shouldInclude = true;
            }

            if (shouldInclude) {
              const avgSpeed = durationSec > 0 ? Number(((distKm / (durationSec / 3600))).toFixed(1)) : 0;
              const startFuel = parseFloat(departPoint.fuel);
              const endFuel = parseFloat(arrivePoint.fuel);
              let fuelConsumed = null;
              if (!isNaN(startFuel) && !isNaN(endFuel) && startFuel > endFuel) {
                fuelConsumed = Number((startFuel - endFuel).toFixed(1));
              }

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
                to_geofence_color: destG.color || (isSameGeofence ? '#3B82F6' : '#10B981'),
                arrival_time: arrivePoint.device_time,
                duration_seconds: Math.round(durationSec),
                duration_formatted: formatDuration(durationSec),
                distance_km: distKm,
                avg_speed_kmh: avgSpeed,
                max_speed_kmh: Math.round(maxSpeed),
                fuel_consumed: fuelConsumed,
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

        // Anchor updates to current geofence
        currentOriginG = currentG;
        departPoint = p;
      } else {
        // Point is outside all geofences -> in transit
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

  /**
   * Generates Single Place (Entry/Exit Activity) Report
   * S.No, Vehicle Name, Geofence Name, Entry Timestamp, Exit Timestamp, Duration, Entry Count, Exit Count
   */
  async getSinglePlaceActivityReport(filters, startDate, endDate) {
    const {
      vehicleId,
      groupId,
      orgId,
      role,
      userId,
      geofenceId,
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
      const allRes = await db.query('SELECT id FROM vehicles WHERE is_active = true LIMIT 100');
      vehicleIds = allRes.rows.map(r => r.id);
    }

    if (vehicleIds.length === 0) {
      return { summary: { total_entries: 0, total_exits: 0, currently_inside: 0, total_stay_seconds: 0, total_stay_formatted: '0s' }, rows: [] };
    }

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

    // 3. Fetch Geofence(s) to track
    let targetGeofences = [];
    if (geofenceId) {
      const gRes = await db.query('SELECT * FROM geofences WHERE id = $1', [geofenceId]);
      targetGeofences = gRes.rows;
    } else if (orgId) {
      const gRes = await db.query('SELECT * FROM geofences WHERE org_id = $1 AND is_active = true', [orgId]);
      targetGeofences = gRes.rows;
    } else {
      const gRes = await db.query('SELECT * FROM geofences WHERE is_active = true LIMIT 50');
      targetGeofences = gRes.rows;
    }

    targetGeofences.forEach(g => {
      g._normalizedCoords = normalizeGeofenceCoords(g.coordinates);
    });

    if (targetGeofences.length === 0) {
      return { summary: { total_entries: 0, total_exits: 0, currently_inside: 0, total_stay_seconds: 0, total_stay_formatted: '0s' }, rows: [] };
    }

    const allSessions = [];
    let totalEntries = 0;
    let totalExits = 0;
    let currentlyInside = 0;
    let totalStaySeconds = 0;

    // 4. For each vehicle, inspect its GPS points against each target geofence
    for (const vId of vehicleIds) {
      const vInfo = vehicleMap[vId] || {};

      const ptsRes = await db.query(`
        SELECT lat, lng, speed, device_time
        FROM gps_points
        WHERE vehicle_id = $1
          AND device_time BETWEEN $2 AND $3
          AND lat IS NOT NULL AND lng IS NOT NULL
        ORDER BY device_time ASC
      `, [vId, startDate, endDate]);

      const points = ptsRes.rows;
      if (points.length === 0) continue;

      for (const g of targetGeofences) {
        let inside = false;
        let entryPoint = null;

        for (let i = 0; i < points.length; i++) {
          const p = points[i];
          const isPointIn = isInsideGeofence(p.lat, p.lng, g);

          if (!inside && isPointIn) {
            // Entry transition
            inside = true;
            entryPoint = p;
            totalEntries++;
          } else if (inside && !isPointIn) {
            // Exit transition
            inside = false;
            totalExits++;
            const exitPoint = p;
            const durationSec = Math.max(0, (new Date(exitPoint.device_time) - new Date(entryPoint.device_time)) / 1000);
            totalStaySeconds += durationSec;

            allSessions.push({
              vehicle_id: vInfo.id,
              vehicle_name: vInfo.name || vInfo.plate || 'Vehicle',
              plate: vInfo.plate || '-',
              org_name: vInfo.org_name || '-',
              geofence_id: g.id,
              geofence_name: g.name,
              geofence_type: g.type,
              entry_time: entryPoint.device_time,
              exit_time: exitPoint.device_time,
              duration_seconds: Math.round(durationSec),
              duration_formatted: formatDuration(durationSec),
              status: 'exited',
              status_label: 'Exited',
              entry_lat: entryPoint.lat,
              entry_lng: entryPoint.lng,
              exit_lat: exitPoint.lat,
              exit_lng: exitPoint.lng,
            });

            entryPoint = null;
          }
        }

        // If vehicle was inside and did not exit before endDate
        if (inside && entryPoint) {
          currentlyInside++;
          const lastPoint = points[points.length - 1];
          const durationSec = Math.max(0, (new Date(lastPoint.device_time) - new Date(entryPoint.device_time)) / 1000);
          totalStaySeconds += durationSec;

          allSessions.push({
            vehicle_id: vInfo.id,
            vehicle_name: vInfo.name || vInfo.plate || 'Vehicle',
            plate: vInfo.plate || '-',
            org_name: vInfo.org_name || '-',
            geofence_id: g.id,
            geofence_name: g.name,
            geofence_type: g.type,
            entry_time: entryPoint.device_time,
            exit_time: null,
            duration_seconds: Math.round(durationSec),
            duration_formatted: `${formatDuration(durationSec)} (Ongoing)`,
            status: 'inside',
            status_label: 'Currently Inside',
            entry_lat: entryPoint.lat,
            entry_lng: entryPoint.lng,
            exit_lat: null,
            exit_lng: null,
          });
        }
      }
    }

    // Sort descending by entry time
    allSessions.sort((a, b) => new Date(b.entry_time) - new Date(a.entry_time));

    return {
      summary: {
        total_entries: totalEntries,
        total_exits: totalExits,
        currently_inside: currentlyInside,
        total_stay_seconds: Math.round(totalStaySeconds),
        total_stay_formatted: formatDuration(totalStaySeconds),
      },
      rows: allSessions,
    };
  }

  /**
   * Generates One-Way Geofence Transit Report (A -> B):
   * Tracks exit from A, transit duration & road distance to B, arrival at B,
   * stay/stoppage duration inside B, and final exit from B.
   */
  async getOneWayActivityReport(filters, startDate, endDate) {
    const {
      vehicleId,
      groupId,
      orgId,
      role,
      userId,
      fromGeofenceId,
      toGeofenceId,
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

    if (vehicleIds.length === 0) {
      return {
        summary: {
          total_trips: 0,
          total_distance_km: 0,
          avg_travel_seconds: 0,
          avg_travel_formatted: '0s',
          avg_stay_seconds: 0,
          avg_stay_formatted: '0s',
          currently_inside_b: 0,
          in_transit: 0,
        },
        rows: [],
      };
    }

    // 2. Fetch Vehicle Details
    const placeholders = vehicleIds.map((_, i) => `$${i + 1}`).join(',');
    const vRes = await db.query(`
      SELECT v.id, v.name, v.plate, o.name as org_name
      FROM vehicles v
      LEFT JOIN organizations o ON v.org_id = o.id
      WHERE v.id IN (${placeholders})
    `, vehicleIds);
    const vehicleMap = {};
    vRes.rows.forEach(r => { vehicleMap[r.id] = r; });

    // 3. Fetch Geofence A (Origin) and Geofence B (Destination)
    let originGeofence = null;
    let destinationGeofence = null;

    if (fromGeofenceId && toGeofenceId) {
      const gRes = await db.query(
        'SELECT * FROM geofences WHERE id IN ($1, $2)',
        [fromGeofenceId, toGeofenceId]
      );
      gRes.rows.forEach(g => {
        g._normalizedCoords = normalizeGeofenceCoords(g.coordinates);
        if (g.id === fromGeofenceId) originGeofence = g;
        if (g.id === toGeofenceId) destinationGeofence = g;
      });
    }

    const allTrips = [];
    let grandDistanceM = 0;
    let grandTravelSec = 0;
    let grandStaySec = 0;
    let completedTripCount = 0;
    let stayCount = 0;
    let currentlyInsideBCount = 0;
    let inTransitCount = 0;

    // 4. Process GPS trajectory for each vehicle
    for (const vId of vehicleIds) {
      const vInfo = vehicleMap[vId] || {};

      // If specific geofences were not provided in filter, try resolving from vehicle assignments
      let geoA = originGeofence;
      let geoB = destinationGeofence;

      if (!geoA || !geoB) {
        const assignedRes = await db.query(`
          SELECT g.* FROM geofences g
          JOIN vehicle_geofences vg ON g.id = vg.geofence_id
          WHERE vg.vehicle_id = $1 AND g.is_active = true
          ORDER BY vg.assigned_at ASC
        `, [vId]);

        if (assignedRes.rows.length >= 2) {
          assignedRes.rows.forEach(g => {
            g._normalizedCoords = normalizeGeofenceCoords(g.coordinates);
          });
          if (!geoA) geoA = assignedRes.rows[0];
          if (!geoB) geoB = assignedRes.rows[1];
        }
      }

      if (!geoA || !geoB || geoA.id === geoB.id) continue;

      const ptsRes = await db.query(`
        SELECT lat, lng, speed, device_time
        FROM gps_points
        WHERE vehicle_id = $1
          AND device_time BETWEEN $2 AND $3
          AND lat IS NOT NULL AND lng IS NOT NULL
        ORDER BY device_time ASC
      `, [vId, startDate, endDate]);

      const points = ptsRes.rows;
      if (points.length < 2) continue;

      // Scan state machine:
      // Statuses: 'IDLE' -> 'IN_TRANSIT' -> 'INSIDE_B'
      let state = 'IDLE';
      let lastInsideAPoint = null;
      let departPointA = null;
      let arrivePointB = null;
      let lastInsideBPoint = null;
      let transitDistanceM = 0;
      let maxSpeedKmh = 0;
      let pathCoords = [];

      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const insideA = isInsideGeofence(p.lat, p.lng, geoA);
        const insideB = isInsideGeofence(p.lat, p.lng, geoB);

        if (insideA) {
          lastInsideAPoint = p;
          // If vehicle returns to A while in transit without reaching B, reset transit
          if (state === 'IN_TRANSIT') {
            state = 'IDLE';
            transitDistanceM = 0;
            maxSpeedKmh = 0;
            pathCoords = [];
          }
        }

        if (state === 'IDLE') {
          if (!insideA && lastInsideAPoint) {
            // Crossed out of Geofence A -> Start of one-way transit
            state = 'IN_TRANSIT';
            departPointA = lastInsideAPoint;
            transitDistanceM = 0;
            maxSpeedKmh = p.speed || 0;
            pathCoords = [
              { lat: departPointA.lat, lng: departPointA.lng },
              { lat: p.lat, lng: p.lng }
            ];
          }
        } else if (state === 'IN_TRANSIT') {
          if (i > 0) {
            const prev = points[i - 1];
            const segDist = getHaversineMeters(prev.lat, prev.lng, p.lat, p.lng);
            if (segDist < 5000) transitDistanceM += segDist;
          }
          if (p.speed > maxSpeedKmh) maxSpeedKmh = p.speed;
          if (pathCoords.length < 60) pathCoords.push({ lat: p.lat, lng: p.lng });

          if (insideB) {
            // Reached Destination Geofence B!
            state = 'INSIDE_B';
            arrivePointB = p;
            lastInsideBPoint = p;
          }
        } else if (state === 'INSIDE_B') {
          if (insideB) {
            lastInsideBPoint = p;
          } else {
            // Crossed out of Geofence B -> Trip completely finished!
            const exitPointB = lastInsideBPoint || p;
            const travelDurationSec = Math.max(0, (new Date(arrivePointB.device_time) - new Date(departPointA.device_time)) / 1000);
            const stayDurationSec = Math.max(0, (new Date(exitPointB.device_time) - new Date(arrivePointB.device_time)) / 1000);
            const distKm = Number((transitDistanceM / 1000).toFixed(2));
            const avgSpeed = travelDurationSec > 0 ? Number((distKm / (travelDurationSec / 3600)).toFixed(1)) : 0;

            allTrips.push({
              vehicle_id: vInfo.id,
              vehicle_name: vInfo.name || vInfo.plate || 'Vehicle',
              plate: vInfo.plate || '-',
              org_name: vInfo.org_name || '-',
              from_geofence_id: geoA.id,
              from_geofence_name: geoA.name,
              to_geofence_id: geoB.id,
              to_geofence_name: geoB.name,
              route_name: `${geoA.name} ➔ ${geoB.name}`,
              departure_time_a: departPointA.device_time,
              travel_duration_seconds: Math.round(travelDurationSec),
              travel_duration_formatted: formatDuration(travelDurationSec),
              arrival_time_b: arrivePointB.device_time,
              stay_duration_seconds: Math.round(stayDurationSec),
              stay_duration_formatted: formatDuration(stayDurationSec),
              exit_time_b: exitPointB.device_time,
              distance_km: distKm,
              avg_speed_kmh: avgSpeed,
              max_speed_kmh: Math.round(maxSpeedKmh),
              status: 'completed',
              status_label: 'Completed (Exited B)',
              path_preview: pathCoords,
            });

            grandDistanceM += transitDistanceM;
            grandTravelSec += travelDurationSec;
            grandStaySec += stayDurationSec;
            completedTripCount++;
            stayCount++;

            // Reset state
            state = 'IDLE';
            departPointA = null;
            arrivePointB = null;
            lastInsideBPoint = null;
            transitDistanceM = 0;
            maxSpeedKmh = 0;
            pathCoords = [];
          }
        }
      }

      // Handle ongoing state if interval ended while vehicle was inside B or in transit
      if (state === 'INSIDE_B' && arrivePointB && departPointA) {
        currentlyInsideBCount++;
        const lastPoint = points[points.length - 1];
        const travelDurationSec = Math.max(0, (new Date(arrivePointB.device_time) - new Date(departPointA.device_time)) / 1000);
        const stayDurationSec = Math.max(0, (new Date(lastPoint.device_time) - new Date(arrivePointB.device_time)) / 1000);
        const distKm = Number((transitDistanceM / 1000).toFixed(2));
        const avgSpeed = travelDurationSec > 0 ? Number((distKm / (travelDurationSec / 3600)).toFixed(1)) : 0;

        allTrips.push({
          vehicle_id: vInfo.id,
          vehicle_name: vInfo.name || vInfo.plate || 'Vehicle',
          plate: vInfo.plate || '-',
          org_name: vInfo.org_name || '-',
          from_geofence_id: geoA.id,
          from_geofence_name: geoA.name,
          to_geofence_id: geoB.id,
          to_geofence_name: geoB.name,
          route_name: `${geoA.name} ➔ ${geoB.name}`,
          departure_time_a: departPointA.device_time,
          travel_duration_seconds: Math.round(travelDurationSec),
          travel_duration_formatted: formatDuration(travelDurationSec),
          arrival_time_b: arrivePointB.device_time,
          stay_duration_seconds: Math.round(stayDurationSec),
          stay_duration_formatted: `${formatDuration(stayDurationSec)} (Inside)`,
          exit_time_b: null,
          distance_km: distKm,
          avg_speed_kmh: avgSpeed,
          max_speed_kmh: Math.round(maxSpeedKmh),
          status: 'inside_destination',
          status_label: 'Inside Destination (B)',
          path_preview: pathCoords,
        });

        grandDistanceM += transitDistanceM;
        grandTravelSec += travelDurationSec;
        grandStaySec += stayDurationSec;
        completedTripCount++;
        stayCount++;
      } else if (state === 'IN_TRANSIT' && departPointA) {
        inTransitCount++;
        const lastPoint = points[points.length - 1];
        const travelDurationSec = Math.max(0, (new Date(lastPoint.device_time) - new Date(departPointA.device_time)) / 1000);
        const distKm = Number((transitDistanceM / 1000).toFixed(2));
        const avgSpeed = travelDurationSec > 0 ? Number((distKm / (travelDurationSec / 3600)).toFixed(1)) : 0;

        allTrips.push({
          vehicle_id: vInfo.id,
          vehicle_name: vInfo.name || vInfo.plate || 'Vehicle',
          plate: vInfo.plate || '-',
          org_name: vInfo.org_name || '-',
          from_geofence_id: geoA.id,
          from_geofence_name: geoA.name,
          to_geofence_id: geoB.id,
          to_geofence_name: geoB.name,
          route_name: `${geoA.name} ➔ ${geoB.name}`,
          departure_time_a: departPointA.device_time,
          travel_duration_seconds: Math.round(travelDurationSec),
          travel_duration_formatted: `${formatDuration(travelDurationSec)} (En Route)`,
          arrival_time_b: null,
          stay_duration_seconds: 0,
          stay_duration_formatted: '-',
          exit_time_b: null,
          distance_km: distKm,
          avg_speed_kmh: avgSpeed,
          max_speed_kmh: Math.round(maxSpeedKmh),
          status: 'in_transit',
          status_label: 'In Transit to B',
          path_preview: pathCoords,
        });
      }
    }

    // Sort descending by departure time from Geofence A
    allTrips.sort((a, b) => new Date(b.departure_time_a) - new Date(a.departure_time_a));

    const avgTravel = completedTripCount > 0 ? Math.round(grandTravelSec / completedTripCount) : 0;
    const avgStay = stayCount > 0 ? Math.round(grandStaySec / stayCount) : 0;

    return {
      summary: {
        total_trips: allTrips.length,
        completed_trips: completedTripCount,
        total_distance_km: Number((grandDistanceM / 1000).toFixed(2)),
        avg_travel_seconds: avgTravel,
        avg_travel_formatted: formatDuration(avgTravel),
        avg_stay_seconds: avgStay,
        avg_stay_formatted: formatDuration(avgStay),
        currently_inside_b: currentlyInsideBCount,
        in_transit: inTransitCount,
      },
      rows: allTrips,
    };
  }

  /**
   * Generates Two-Way Geofence Transit Report (A <-> B):
   * Tracks Outbound Leg (A -> B), Halt at B, Inbound Leg (B -> A), and Return at A.
   */
  async getTwoWayActivityReport(filters, startDate, endDate) {
    const {
      vehicleId,
      groupId,
      orgId,
      role,
      userId,
      fromGeofenceId,
      toGeofenceId,
    } = filters;

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

    if (vehicleIds.length === 0) {
      return {
        summary: {
          total_cycles: 0,
          completed_cycles: 0,
          total_distance_km: 0,
          avg_outbound_seconds: 0,
          avg_outbound_formatted: '0s',
          avg_inbound_seconds: 0,
          avg_inbound_formatted: '0s',
          avg_halt_seconds: 0,
          avg_halt_formatted: '0s',
          currently_at_b: 0,
        },
        rows: [],
      };
    }

    const placeholders = vehicleIds.map((_, i) => `$${i + 1}`).join(',');
    const vRes = await db.query(`
      SELECT v.id, v.name, v.plate, o.name as org_name
      FROM vehicles v
      LEFT JOIN organizations o ON v.org_id = o.id
      WHERE v.id IN (${placeholders})
    `, vehicleIds);
    const vehicleMap = {};
    vRes.rows.forEach(r => { vehicleMap[r.id] = r; });

    let originGeofence = null;
    let destinationGeofence = null;

    if (fromGeofenceId && toGeofenceId) {
      const gRes = await db.query(
        'SELECT * FROM geofences WHERE id IN ($1, $2)',
        [fromGeofenceId, toGeofenceId]
      );
      gRes.rows.forEach(g => {
        g._normalizedCoords = normalizeGeofenceCoords(g.coordinates);
        if (g.id === fromGeofenceId) originGeofence = g;
        if (g.id === toGeofenceId) destinationGeofence = g;
      });
    }

    const allCycles = [];
    let grandDistanceM = 0;
    let grandOutboundSec = 0;
    let grandInboundSec = 0;
    let grandHaltSec = 0;
    let completedCycleCount = 0;
    let outboundCount = 0;
    let inboundCount = 0;
    let haltCount = 0;
    let currentlyAtBCount = 0;

    for (const vId of vehicleIds) {
      const vInfo = vehicleMap[vId] || {};

      let geoA = originGeofence;
      let geoB = destinationGeofence;

      if (!geoA || !geoB) {
        const assignedRes = await db.query(`
          SELECT g.* FROM geofences g
          JOIN vehicle_geofences vg ON g.id = vg.geofence_id
          WHERE vg.vehicle_id = $1 AND g.is_active = true
          ORDER BY vg.assigned_at ASC
        `, [vId]);

        if (assignedRes.rows.length >= 2) {
          assignedRes.rows.forEach(g => {
            g._normalizedCoords = normalizeGeofenceCoords(g.coordinates);
          });
          if (!geoA) geoA = assignedRes.rows[0];
          if (!geoB) geoB = assignedRes.rows[1];
        }
      }

      if (!geoA || !geoB || geoA.id === geoB.id) continue;

      const ptsRes = await db.query(`
        SELECT lat, lng, speed, device_time
        FROM gps_points
        WHERE vehicle_id = $1
          AND device_time BETWEEN $2 AND $3
          AND lat IS NOT NULL AND lng IS NOT NULL
        ORDER BY device_time ASC
      `, [vId, startDate, endDate]);

      const points = ptsRes.rows;
      if (points.length < 2) continue;

      // Cycle State Machine:
      // 'IDLE' -> 'OUTBOUND_TRANSIT' -> 'AT_DESTINATION_B' -> 'INBOUND_TRANSIT' -> 'COMPLETED'
      let cycleState = 'IDLE';
      let lastInsideAPoint = null;
      let departPointA = null;
      let arrivePointB = null;
      let departPointB = null;
      let lastInsideBPoint = null;
      let outboundDistanceM = 0;
      let inboundDistanceM = 0;
      let maxSpeedKmh = 0;
      let pathCoords = [];

      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const insideA = isInsideGeofence(p.lat, p.lng, geoA);
        const insideB = isInsideGeofence(p.lat, p.lng, geoB);

        if (insideA) {
          lastInsideAPoint = p;
        }

        if (cycleState === 'IDLE') {
          if (!insideA && lastInsideAPoint) {
            cycleState = 'OUTBOUND_TRANSIT';
            departPointA = lastInsideAPoint;
            outboundDistanceM = 0;
            inboundDistanceM = 0;
            maxSpeedKmh = p.speed || 0;
            pathCoords = [{ lat: departPointA.lat, lng: departPointA.lng }, { lat: p.lat, lng: p.lng }];
          }
        } else if (cycleState === 'OUTBOUND_TRANSIT') {
          if (insideA) {
            // Returned to A without reaching B -> reset
            cycleState = 'IDLE';
            departPointA = null;
            pathCoords = [];
          } else {
            if (i > 0) {
              const prev = points[i - 1];
              const seg = getHaversineMeters(prev.lat, prev.lng, p.lat, p.lng);
              if (seg < 5000) outboundDistanceM += seg;
            }
            if (p.speed > maxSpeedKmh) maxSpeedKmh = p.speed;
            if (pathCoords.length < 50) pathCoords.push({ lat: p.lat, lng: p.lng });

            if (insideB) {
              // Reached B!
              cycleState = 'AT_DESTINATION_B';
              arrivePointB = p;
              lastInsideBPoint = p;
            }
          }
        } else if (cycleState === 'AT_DESTINATION_B') {
          if (insideB) {
            lastInsideBPoint = p;
          } else {
            // Left B heading back towards A!
            cycleState = 'INBOUND_TRANSIT';
            departPointB = lastInsideBPoint || p;
            if (pathCoords.length < 75) pathCoords.push({ lat: departPointB.lat, lng: departPointB.lng });
          }
        } else if (cycleState === 'INBOUND_TRANSIT') {
          if (i > 0) {
            const prev = points[i - 1];
            const seg = getHaversineMeters(prev.lat, prev.lng, p.lat, p.lng);
            if (seg < 5000) inboundDistanceM += seg;
          }
          if (p.speed > maxSpeedKmh) maxSpeedKmh = p.speed;
          if (pathCoords.length < 100) pathCoords.push({ lat: p.lat, lng: p.lng });

          if (insideA) {
            // Returned back inside A -> Full Two-Way Cycle Completed!
            const returnPointA = p;
            const outboundSec = Math.max(0, (new Date(arrivePointB.device_time) - new Date(departPointA.device_time)) / 1000);
            const haltSec = Math.max(0, (new Date(departPointB.device_time) - new Date(arrivePointB.device_time)) / 1000);
            const inboundSec = Math.max(0, (new Date(returnPointA.device_time) - new Date(departPointB.device_time)) / 1000);
            const totalTurnaroundSec = Math.max(0, (new Date(returnPointA.device_time) - new Date(departPointA.device_time)) / 1000);

            const outDistKm = Number((outboundDistanceM / 1000).toFixed(2));
            const inDistKm = Number((inboundDistanceM / 1000).toFixed(2));
            const totalDistKm = Number(((outboundDistanceM + inboundDistanceM) / 1000).toFixed(2));

            allCycles.push({
              vehicle_id: vInfo.id,
              vehicle_name: vInfo.name || vInfo.plate || 'Vehicle',
              plate: vInfo.plate || '-',
              org_name: vInfo.org_name || '-',
              from_geofence_id: geoA.id,
              from_geofence_name: geoA.name,
              to_geofence_id: geoB.id,
              to_geofence_name: geoB.name,
              route_name: `${geoA.name} ⇄ ${geoB.name}`,
              departure_time_a: departPointA.device_time,
              outbound_duration_seconds: Math.round(outboundSec),
              outbound_duration_formatted: formatDuration(outboundSec),
              arrival_time_b: arrivePointB.device_time,
              halt_duration_seconds: Math.round(haltSec),
              halt_duration_formatted: formatDuration(haltSec),
              departure_time_b: departPointB.device_time,
              inbound_duration_seconds: Math.round(inboundSec),
              inbound_duration_formatted: formatDuration(inboundSec),
              return_time_a: returnPointA.device_time,
              cycle_turnaround_seconds: Math.round(totalTurnaroundSec),
              cycle_turnaround_formatted: formatDuration(totalTurnaroundSec),
              outbound_distance_km: outDistKm,
              inbound_distance_km: inDistKm,
              total_distance_km: totalDistKm,
              max_speed_kmh: Math.round(maxSpeedKmh),
              status: 'completed',
              status_label: 'Cycle Completed at A',
              path_preview: pathCoords,
            });

            grandDistanceM += (outboundDistanceM + inboundDistanceM);
            grandOutboundSec += outboundSec;
            grandInboundSec += inboundSec;
            grandHaltSec += haltSec;
            completedCycleCount++;
            outboundCount++;
            inboundCount++;
            haltCount++;

            // Reset
            cycleState = 'IDLE';
            departPointA = null;
            arrivePointB = null;
            departPointB = null;
            lastInsideBPoint = null;
            outboundDistanceM = 0;
            inboundDistanceM = 0;
            pathCoords = [];
          }
        }
      }

      // Handle ongoing two-way state at boundary end
      if (cycleState === 'AT_DESTINATION_B' && arrivePointB && departPointA) {
        currentlyAtBCount++;
        const lastPoint = points[points.length - 1];
        const outboundSec = Math.max(0, (new Date(arrivePointB.device_time) - new Date(departPointA.device_time)) / 1000);
        const haltSec = Math.max(0, (new Date(lastPoint.device_time) - new Date(arrivePointB.device_time)) / 1000);
        const outDistKm = Number((outboundDistanceM / 1000).toFixed(2));

        allCycles.push({
          vehicle_id: vInfo.id,
          vehicle_name: vInfo.name || vInfo.plate || 'Vehicle',
          plate: vInfo.plate || '-',
          org_name: vInfo.org_name || '-',
          from_geofence_id: geoA.id,
          from_geofence_name: geoA.name,
          to_geofence_id: geoB.id,
          to_geofence_name: geoB.name,
          route_name: `${geoA.name} ⇄ ${geoB.name}`,
          departure_time_a: departPointA.device_time,
          outbound_duration_seconds: Math.round(outboundSec),
          outbound_duration_formatted: formatDuration(outboundSec),
          arrival_time_b: arrivePointB.device_time,
          halt_duration_seconds: Math.round(haltSec),
          halt_duration_formatted: `${formatDuration(haltSec)} (Inside B)`,
          departure_time_b: null,
          inbound_duration_seconds: 0,
          inbound_duration_formatted: '-',
          return_time_a: null,
          cycle_turnaround_seconds: Math.round(outboundSec + haltSec),
          cycle_turnaround_formatted: `${formatDuration(outboundSec + haltSec)} (Ongoing)`,
          outbound_distance_km: outDistKm,
          inbound_distance_km: 0,
          total_distance_km: outDistKm,
          max_speed_kmh: Math.round(maxSpeedKmh),
          status: 'halted_at_b',
          status_label: 'Halted at Destination (B)',
          path_preview: pathCoords,
        });

        grandDistanceM += outboundDistanceM;
        grandOutboundSec += outboundSec;
        grandHaltSec += haltSec;
        outboundCount++;
        haltCount++;
      } else if (cycleState === 'INBOUND_TRANSIT' && departPointB && arrivePointB && departPointA) {
        const lastPoint = points[points.length - 1];
        const outboundSec = Math.max(0, (new Date(arrivePointB.device_time) - new Date(departPointA.device_time)) / 1000);
        const haltSec = Math.max(0, (new Date(departPointB.device_time) - new Date(arrivePointB.device_time)) / 1000);
        const inboundSec = Math.max(0, (new Date(lastPoint.device_time) - new Date(departPointB.device_time)) / 1000);
        const totalTurnaroundSec = Math.max(0, (new Date(lastPoint.device_time) - new Date(departPointA.device_time)) / 1000);

        const outDistKm = Number((outboundDistanceM / 1000).toFixed(2));
        const inDistKm = Number((inboundDistanceM / 1000).toFixed(2));
        const totalDistKm = Number(((outboundDistanceM + inboundDistanceM) / 1000).toFixed(2));

        allCycles.push({
          vehicle_id: vInfo.id,
          vehicle_name: vInfo.name || vInfo.plate || 'Vehicle',
          plate: vInfo.plate || '-',
          org_name: vInfo.org_name || '-',
          from_geofence_id: geoA.id,
          from_geofence_name: geoA.name,
          to_geofence_id: geoB.id,
          to_geofence_name: geoB.name,
          route_name: `${geoA.name} ⇄ ${geoB.name}`,
          departure_time_a: departPointA.device_time,
          outbound_duration_seconds: Math.round(outboundSec),
          outbound_duration_formatted: formatDuration(outboundSec),
          arrival_time_b: arrivePointB.device_time,
          halt_duration_seconds: Math.round(haltSec),
          halt_duration_formatted: formatDuration(haltSec),
          departure_time_b: departPointB.device_time,
          inbound_duration_seconds: Math.round(inboundSec),
          inbound_duration_formatted: `${formatDuration(inboundSec)} (Returning)`,
          return_time_a: null,
          cycle_turnaround_seconds: Math.round(totalTurnaroundSec),
          cycle_turnaround_formatted: `${formatDuration(totalTurnaroundSec)} (En Route)`,
          outbound_distance_km: outDistKm,
          inbound_distance_km: inDistKm,
          total_distance_km: totalDistKm,
          max_speed_kmh: Math.round(maxSpeedKmh),
          status: 'inbound_returning',
          status_label: 'Inbound Returning to A',
          path_preview: pathCoords,
        });

        grandDistanceM += (outboundDistanceM + inboundDistanceM);
        grandOutboundSec += outboundSec;
        grandInboundSec += inboundSec;
        grandHaltSec += haltSec;
        outboundCount++;
        inboundCount++;
        haltCount++;
      }
    }

    allCycles.sort((a, b) => new Date(b.departure_time_a) - new Date(a.departure_time_a));

    const avgOutbound = outboundCount > 0 ? Math.round(grandOutboundSec / outboundCount) : 0;
    const avgInbound = inboundCount > 0 ? Math.round(grandInboundSec / inboundCount) : 0;
    const avgHalt = haltCount > 0 ? Math.round(grandHaltSec / haltCount) : 0;

    return {
      summary: {
        total_cycles: allCycles.length,
        completed_cycles: completedCycleCount,
        total_distance_km: Number((grandDistanceM / 1000).toFixed(2)),
        avg_outbound_seconds: avgOutbound,
        avg_outbound_formatted: formatDuration(avgOutbound),
        avg_inbound_seconds: avgInbound,
        avg_inbound_formatted: formatDuration(avgInbound),
        avg_halt_seconds: avgHalt,
        avg_halt_formatted: formatDuration(avgHalt),
        currently_at_b: currentlyAtBCount,
      },
      rows: allCycles,
    };
  }

  /**
   * Generates Round-Trip Loop Report (Same Location Return A -> Field -> A):
   * Tracks exit from Base A, duration & distance spent in field, and arrival back at Base A.
   */
  async getRoundTripActivityReport(filters, startDate, endDate) {
    const {
      vehicleId,
      groupId,
      orgId,
      role,
      userId,
      geofenceId,
      fromGeofenceId,
    } = filters;

    const targetGeofenceId = geofenceId || fromGeofenceId;

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

    if (vehicleIds.length === 0) {
      return {
        summary: {
          total_loops: 0,
          completed_loops: 0,
          total_distance_km: 0,
          avg_field_seconds: 0,
          avg_field_formatted: '0s',
          currently_in_field: 0,
        },
        rows: [],
      };
    }

    const placeholders = vehicleIds.map((_, i) => `$${i + 1}`).join(',');
    const vRes = await db.query(`
      SELECT v.id, v.name, v.plate, o.name as org_name
      FROM vehicles v
      LEFT JOIN organizations o ON v.org_id = o.id
      WHERE v.id IN (${placeholders})
    `, vehicleIds);
    const vehicleMap = {};
    vRes.rows.forEach(r => { vehicleMap[r.id] = r; });

    let baseGeofence = null;
    if (targetGeofenceId) {
      const gRes = await db.query('SELECT * FROM geofences WHERE id = $1', [targetGeofenceId]);
      if (gRes.rows.length > 0) {
        baseGeofence = gRes.rows[0];
        baseGeofence._normalizedCoords = normalizeGeofenceCoords(baseGeofence.coordinates);
      }
    }

    const allLoops = [];
    let grandDistanceM = 0;
    let grandDurationSec = 0;
    let completedLoopCount = 0;
    let inFieldCount = 0;

    for (const vId of vehicleIds) {
      const vInfo = vehicleMap[vId] || {};

      let geoBase = baseGeofence;
      if (!geoBase) {
        const assignedRes = await db.query(`
          SELECT g.* FROM geofences g
          JOIN vehicle_geofences vg ON g.id = vg.geofence_id
          WHERE vg.vehicle_id = $1 AND g.is_active = true
          ORDER BY vg.assigned_at ASC
          LIMIT 1
        `, [vId]);
        if (assignedRes.rows.length > 0) {
          geoBase = assignedRes.rows[0];
          geoBase._normalizedCoords = normalizeGeofenceCoords(geoBase.coordinates);
        }
      }

      if (!geoBase) continue;

      const ptsRes = await db.query(`
        SELECT lat, lng, speed, device_time
        FROM gps_points
        WHERE vehicle_id = $1
          AND device_time BETWEEN $2 AND $3
          AND lat IS NOT NULL AND lng IS NOT NULL
        ORDER BY device_time ASC
      `, [vId, startDate, endDate]);

      const points = ptsRes.rows;
      if (points.length < 2) continue;

      let inLoop = false;
      let lastInsidePoint = null;
      let departPoint = null;
      let loopDistanceM = 0;
      let maxSpeedKmh = 0;
      let pathCoords = [];

      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const isInside = isInsideGeofence(p.lat, p.lng, geoBase);

        if (isInside) {
          if (inLoop && departPoint) {
            // Re-entered Base Hub A -> Loop Complete!
            const returnPoint = p;
            const durationSec = Math.max(0, (new Date(returnPoint.device_time) - new Date(departPoint.device_time)) / 1000);
            const distKm = Number((loopDistanceM / 1000).toFixed(2));

            // Filter out minor boundary fluctuations (must be > 60s and > 0.1km)
            if (durationSec >= 60 && distKm >= 0.1) {
              const avgSpeed = durationSec > 0 ? Number((distKm / (durationSec / 3600)).toFixed(1)) : 0;

              allLoops.push({
                vehicle_id: vInfo.id,
                vehicle_name: vInfo.name || vInfo.plate || 'Vehicle',
                plate: vInfo.plate || '-',
                org_name: vInfo.org_name || '-',
                base_geofence_id: geoBase.id,
                base_geofence_name: geoBase.name,
                departure_time: departPoint.device_time,
                return_time: returnPoint.device_time,
                field_duration_seconds: Math.round(durationSec),
                field_duration_formatted: formatDuration(durationSec),
                distance_km: distKm,
                avg_speed_kmh: avgSpeed,
                max_speed_kmh: Math.round(maxSpeedKmh),
                status: 'completed',
                status_label: 'Loop Completed',
                path_preview: pathCoords,
              });

              grandDistanceM += loopDistanceM;
              grandDurationSec += durationSec;
              completedLoopCount++;
            }

            inLoop = false;
            departPoint = null;
            loopDistanceM = 0;
            maxSpeedKmh = 0;
            pathCoords = [];
          }
          lastInsidePoint = p;
        } else {
          // Outside Base Geofence
          if (!inLoop && lastInsidePoint) {
            inLoop = true;
            departPoint = lastInsidePoint;
            loopDistanceM = 0;
            maxSpeedKmh = p.speed || 0;
            pathCoords = [{ lat: departPoint.lat, lng: departPoint.lng }, { lat: p.lat, lng: p.lng }];
          }

          if (inLoop) {
            if (i > 0) {
              const prev = points[i - 1];
              const seg = getHaversineMeters(prev.lat, prev.lng, p.lat, p.lng);
              if (seg < 5000) loopDistanceM += seg;
            }
            if (p.speed > maxSpeedKmh) maxSpeedKmh = p.speed;
            if (pathCoords.length < 80) pathCoords.push({ lat: p.lat, lng: p.lng });
          }
        }
      }

      // If interval ended while still outside in field
      if (inLoop && departPoint) {
        inFieldCount++;
        const lastPoint = points[points.length - 1];
        const durationSec = Math.max(0, (new Date(lastPoint.device_time) - new Date(departPoint.device_time)) / 1000);
        const distKm = Number((loopDistanceM / 1000).toFixed(2));
        const avgSpeed = durationSec > 0 ? Number((distKm / (durationSec / 3600)).toFixed(1)) : 0;

        allLoops.push({
          vehicle_id: vInfo.id,
          vehicle_name: vInfo.name || vInfo.plate || 'Vehicle',
          plate: vInfo.plate || '-',
          org_name: vInfo.org_name || '-',
          base_geofence_id: geoBase.id,
          base_geofence_name: geoBase.name,
          departure_time: departPoint.device_time,
          return_time: null,
          field_duration_seconds: Math.round(durationSec),
          field_duration_formatted: `${formatDuration(durationSec)} (Active)`,
          distance_km: distKm,
          avg_speed_kmh: avgSpeed,
          max_speed_kmh: Math.round(maxSpeedKmh),
          status: 'in_field',
          status_label: 'In Field (Active Loop)',
          path_preview: pathCoords,
        });

        grandDistanceM += loopDistanceM;
        grandDurationSec += durationSec;
      }
    }

    allLoops.sort((a, b) => new Date(b.departure_time) - new Date(a.departure_time));

    const avgField = (completedLoopCount + inFieldCount) > 0
      ? Math.round(grandDurationSec / (completedLoopCount + inFieldCount))
      : 0;

    return {
      summary: {
        total_loops: allLoops.length,
        completed_loops: completedLoopCount,
        total_distance_km: Number((grandDistanceM / 1000).toFixed(2)),
        avg_field_seconds: avgField,
        avg_field_formatted: formatDuration(avgField),
        currently_in_field: inFieldCount,
      },
      rows: allLoops,
    };
  }
}

module.exports = new GeofenceTransitService();
