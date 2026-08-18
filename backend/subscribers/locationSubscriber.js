// ============================================================
// LOCATION SUBSCRIBER
// Subscribes to Redis 'tracking' channel
// Writes GPS points to database in batches, performs alert checks,
// and emits live updates over Socket.io
// ============================================================

const { redis, createSubscriber } = require('../config/redis');
const VehicleModel = require('../models/vehicleModel');
const GpsModel = require('../models/gpsModel');
const GeofenceModel = require('../models/geofenceModel');
const RouteModel = require('../models/routeModel');
const db = require('../config/db');
const env = require('../config/env');

let subscriber = null;

// ============================================================
// BATCHED GPS WRITER
// Accumulates GPS points and flushes to Postgres in bulk using
// unnest() — dramatically reduces write throughput pressure at scale.
// ============================================================

const FLUSH_INTERVAL_MS = env.WRITER_BATCH_MS;   // default 500ms
const FLUSH_BATCH_SIZE = env.WRITER_BATCH_SIZE;  // default 100 rows

/** @type {Array<object>} In-memory accumulator for pending GPS rows */
let gpsBatch = [];
/** @type {NodeJS.Timeout|null} Pending flush timer handle */
let gpsBatchTimer = null;

/**
 * Flush all pending GPS points to Postgres in a single batch INSERT.
 * Uses Postgres unnest() to avoid per-row round-trips.
 * Thread-safe: drains the array atomically before querying.
 */
async function flushGpsBatch() {
  if (gpsBatch.length === 0) return;

  // Drain atomically — any points arriving during the async query go into the next batch
  const batch = gpsBatch.splice(0, gpsBatch.length);

  try {
    // Extract each column into its own array for unnest()
    const vehicleIds = batch.map(p => p.vehicleId);
    const lats = batch.map(p => p.lat);
    const lngs = batch.map(p => p.lng);
    const speeds = batch.map(p => p.speed != null ? Math.round(p.speed) : null);
    const directions = batch.map(p => p.direction != null ? Math.round(p.direction) : null);
    const odometers = batch.map(p => p.odometer != null ? Math.round(p.odometer) : null);
    const fuels = batch.map(p => p.fuel ?? null);
    const ignitions = batch.map(p => p.ignition ?? null);
    const satellites = batch.map(p => p.satellites != null ? Math.round(p.satellites) : null);
    const gsmSignals = batch.map(p => p.gsmSignal != null ? Math.round(p.gsmSignal) : null);
    const batteries = batch.map(p => p.battery != null ? Math.round(p.battery) : null);
    const voltages = batch.map(p => p.voltage ?? null);
    const isLives = batch.map(p => p.isLive ?? true);
    const deviceTimes = batch.map(p => p.deviceTime);

    await db.query(`
      INSERT INTO gps_points
        (vehicle_id, lat, lng, speed, direction, odometer, fuel, ignition,
         satellites, gsm_signal, battery, voltage, is_live, device_time)
      SELECT
        unnest($1::uuid[]),
        unnest($2::numeric[]),
        unnest($3::numeric[]),
        unnest($4::smallint[]),
        unnest($5::smallint[]),
        unnest($6::integer[]),
        unnest($7::numeric[]),
        unnest($8::boolean[]),
        unnest($9::smallint[]),
        unnest($10::smallint[]),
        unnest($11::smallint[]),
        unnest($12::numeric[]),
        unnest($13::boolean[]),
        unnest($14::timestamp[])
      ON CONFLICT (vehicle_id, device_time) DO NOTHING
    `, [vehicleIds, lats, lngs, speeds, directions, odometers, fuels,
      ignitions, satellites, gsmSignals, batteries, voltages, isLives, deviceTimes]);

    if (batch.length >= 10) {
      // Only log large batches to avoid noise at low traffic
      console.log(`[BATCH] Flushed ${batch.length} GPS points to Postgres`);
    }
  } catch (err) {
    console.error(`[BATCH] GPS batch flush error (${batch.length} rows dropped):`, err.message);
  }
}

/**
 * Queue a GPS point for the next batch flush.
 * Triggers an immediate flush if the batch is full.
 */
async function queueGpsPoint(point) {
  gpsBatch.push(point);

  if (gpsBatch.length >= FLUSH_BATCH_SIZE) {
    // Batch is full — flush immediately, cancel the timer
    if (gpsBatchTimer) {
      clearTimeout(gpsBatchTimer);
      gpsBatchTimer = null;
    }
    await flushGpsBatch();
  } else if (!gpsBatchTimer) {
    // Schedule a timed flush so low-traffic points don't get stranded
    gpsBatchTimer = setTimeout(async () => {
      gpsBatchTimer = null;
      await flushGpsBatch();
    }, FLUSH_INTERVAL_MS);
  }
}

// ============================================================
// GEO HELPERS
// ============================================================

/** Haversine formula — returns distance in metres */
function getHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Ray-casting point-in-polygon */
function isPointInPolygon(lat, lng, polygon) {
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

function getDistanceToSegment(p, a, b) {
  const dAB = getHaversineDistance(a.lat, a.lng, b.lat, b.lng);
  if (dAB === 0) return getHaversineDistance(p.lat, p.lng, a.lat, a.lng);
  const l2 = (b.lat - a.lat) ** 2 + (b.lng - a.lng) ** 2;
  let t = ((p.lat - a.lat) * (b.lat - a.lat) + (p.lng - a.lng) * (b.lng - a.lng)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projectionLat = a.lat + t * (b.lat - a.lat);
  const projectionLng = a.lng + t * (b.lng - a.lng);
  return getHaversineDistance(p.lat, p.lng, projectionLat, projectionLng);
}

function getMinDistanceToRoute(lat, lng, routeCoords) {
  let minDistance = Infinity;
  for (let i = 0; i < routeCoords.length - 1; i++) {
    const dist = getDistanceToSegment({ lat, lng }, routeCoords[i], routeCoords[i + 1]);
    if (dist < minDistance) minDistance = dist;
  }
  return minDistance;
}

// ============================================================
// SUBSCRIBER
// ============================================================

/**
 * Start listening to Redis tracking updates
 * @param {object} io - Socket.io server instance
 */
async function start(io) {
  subscriber = createSubscriber();

  subscriber.on('connect', () => {
    console.log(`[SUBSCRIBER] Location subscriber connected to Redis (batch flush every ${FLUSH_INTERVAL_MS}ms or ${FLUSH_BATCH_SIZE} rows)`);
  });

  // Subscribe to 'tracking' and 'raw_logs'
  await subscriber.subscribe('tracking');
  await subscriber.subscribe('raw_logs');

  subscriber.on('message', async (channel, message) => {
    // ── raw_logs channel: persist raw packet to DB ──────────────────────────
    if (channel === 'raw_logs') {
      try {
        const data = JSON.parse(message);
        const actualRaw = data.rawHex || data.rawString || data.raw || message;
        const isParsed = data.parsed !== false;
        const errorMsg = data.error || null;
        await GpsModel.saveRawPacketWithMetadata({
          imei: data.imei,
          raw: actualRaw,
          packetType: data.packetType,
          deviceTime: data.deviceTime,
          odometer: data.odometer,
          rawHex: data.rawHex || actualRaw,
          parsedJson: data.parsedJson,
          parsed: isParsed,
          error: errorMsg
        });
        
        if (io) {
          const vehicle = await VehicleModel.findByImei(data.imei);
          if (vehicle) {
            io.to(`vehicle:${vehicle.id}`).emit('raw:update', {
              id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              received_at: new Date().toISOString(),
              device_time: data.deviceTime,
              odometer: data.odometer,
              parsed: isParsed,
              packet_type: data.packetType || 'DATA',
              raw_hex: data.rawHex || actualRaw,
              raw: actualRaw,
              error: errorMsg
            });
          }
        }
      } catch (err) {
        console.error('[SUBSCRIBER] Error processing raw log:', err.message);
      }
      return;
    }

    if (channel !== 'tracking') return;

    // ── tracking channel: main location processing path ─────────────────────
    try {
      const data = JSON.parse(message);
      const { imei, lat, lng, speed, fuel, ignition, voltage, direction,
        odometer, satellites, gsmSignal, battery, deviceTime, isLive } = data;

      // 1. Resolve IMEI → Vehicle ID + Org ID
      const vehicle = await VehicleModel.findByImei(imei);
      if (!vehicle) {
        // Unknown IMEI — log raw packet and bail
        await GpsModel.saveRawPacket(imei, message, false, 'Unregistered IMEI');
        return;
      }

      const vehicleId = vehicle.id;
      const orgId = vehicle.org_id;

      // 1b. Compute final Engine ON state based on admin-configured preference
      const engineOnPref = vehicle.metadata?.engineOn || 'Ignition';
      const batteryThresh = parseFloat(vehicle.metadata?.batteryVoltage) || 13.2;
      let finalIgnition = ignition;

      if (engineOnPref === 'Voltage+Ignition') {
        finalIgnition = ignition === true && voltage >= batteryThresh;
      } else if (engineOnPref === 'Voltage') {
        finalIgnition = voltage >= batteryThresh;
      } else if (engineOnPref === 'Digital Input 1') {
        finalIgnition = data.din1 === true;
      } else {
        finalIgnition = ignition === true;
      }

      // 2. Fetch previous state from Redis BEFORE processing new packet (for transition alerts)
      const prevStateRaw = await redis.get(`vehicle:state:${imei}`);
      let prevState = null;
      if (prevStateRaw) {
        try { prevState = JSON.parse(prevStateRaw); } catch (e) { }
      }

      // ============================================================
      // 2a. VALIDATE DEVICE TIMESTAMP & GPS JUMPS
      // ============================================================
      if (!data.isHeartbeat) {
        const serverTimeMs = Date.now();
        const deviceTimeMs = new Date(deviceTime).getTime();
        const prevDeviceTimeMs = prevState && prevState.deviceTime ? new Date(prevState.deviceTime).getTime() : null;
        
        let isValidPoint = true;
        let rejectReason = '';

        // 1. Check for wildly invalid timestamps (e.g., 2017 on startup)
        if (deviceTimeMs < serverTimeMs - (30 * 24 * 60 * 60 * 1000)) {
          isValidPoint = false;
          rejectReason = `Timestamp too old (>30 days behind server): ${new Date(deviceTime).toISOString()}`;
        } else if (deviceTimeMs > serverTimeMs + (15 * 60 * 1000)) {
          isValidPoint = false;
          rejectReason = `Timestamp in future (>15m ahead of server): ${new Date(deviceTime).toISOString()}`;
        } 
        // 2. Rollback check for Live points (allow 2 min slack for unordered network delivery)
        else if (isLive && prevDeviceTimeMs && deviceTimeMs < prevDeviceTimeMs - (2 * 60 * 1000)) {
          isValidPoint = false;
          rejectReason = `Timestamp rollback on live stream: ${new Date(deviceTime).toISOString()} < ${new Date(prevState.deviceTime).toISOString()}`;
        }

        // 3. Impossible Jump Check
        if (isValidPoint && prevState && prevState.lat && prevState.lng && lat && lng) {
          const distMeters = getHaversineDistance(parseFloat(prevState.lat), parseFloat(prevState.lng), parseFloat(lat), parseFloat(lng));
          // If moved > 100m, verify if the speed required to cover it is physically possible
          if (distMeters > 100 && prevDeviceTimeMs && deviceTimeMs > prevDeviceTimeMs) {
            const timeDiffHours = (deviceTimeMs - prevDeviceTimeMs) / (1000 * 60 * 60);
            const impliedSpeedKmph = (distMeters / 1000) / timeDiffHours;
            
            // Reject if > 250 km/h (impossible for a commercial vehicle)
            if (impliedSpeedKmph > 250 && timeDiffHours < 1) {
              isValidPoint = false;
              rejectReason = `Impossible GPS jump: ${Math.round(impliedSpeedKmph)} km/h over ${Math.round(distMeters)}m`;
            }
          }
        }

        if (!isValidPoint) {
          console.warn(`[GPS-REJECT] IMEI ${imei}: ${rejectReason}. Dropped from live tracking & DB.`);
          // Keep device online in DB even if GPS is drifting or resetting
          await GpsModel.updateLatestState({ vehicleId, ignition: finalIgnition, voltage });
          return;
        }
      }

      // 2b. Compute final Odometer based on deviceOdo flag
      let finalOdometer = odometer != null ? parseFloat(odometer) : null;
      if (vehicle.metadata?.deviceOdo !== 'YES' && lat && lng) {
        const prevOdo = prevState && prevState.odometer ? parseFloat(prevState.odometer) : 0;
        let distanceMeters = 0;
        
        // ONLY accumulate software distance if this is a live packet.
        // Historical buffered packets will NOT add massive jumps to the live odometer.
        if (isLive && prevState && prevState.lat && prevState.lng) {
          distanceMeters = getHaversineDistance(parseFloat(prevState.lat), parseFloat(prevState.lng), parseFloat(lat), parseFloat(lng));
          
          // Accumulate distance if it's > 5m (filter drift) and < 50km (filter massive spikes)
          if (distanceMeters > 5 && distanceMeters < 50000) {
            finalOdometer = prevOdo + (distanceMeters / 1000); // km
          } else {
            finalOdometer = prevOdo;
          }
        } else if (!isLive) {
          // IMPORTANT: Do NOT assign the current LIVE odometer to a historical buffered packet!
          // This causes massive odometer rollbacks/jumps in the history table.
          finalOdometer = null;
        } else {
          finalOdometer = prevOdo;
        }
      }

      let parkedSince = null;
      if (finalIgnition === false && (speed || 0) === 0) {
        if (prevState && prevState.parkedSince) {
          parkedSince = prevState.parkedSince;
        } else {
          parkedSince = deviceTime;
        }
      }

      // 3. Cache updated state in Redis (fast — always per-packet)
      // Only cache LIVE packets so historical/buffered dumps don't overwrite the true current state
      if (isLive) {
        const updatedPayload = { ...data, ignition: finalIgnition, odometer: finalOdometer, parkedSince };
        await redis.set(
          `vehicle:state:${imei}`,
          JSON.stringify(updatedPayload),
          'EX', 86400 // 24 hours — must outlive the 5-min safety park arming window
        );
      }

      // 4. Queue GPS point for batched DB write (skipped for heartbeats)
      if (!data.isHeartbeat) {
        await queueGpsPoint({
          vehicleId, lat, lng, speed, direction, odometer: finalOdometer, fuel,
          ignition: finalIgnition, satellites, gsmSignal, battery,
          voltage, isLive, deviceTime
        });
      }

      // 5. Update denormalized latest-state table (per-packet, needed for dashboard accuracy)
      // If the device lost GPS fix and sends 0,0, don't overwrite the last known valid location!
      // ONLY update latest state if the packet is LIVE, to prevent historical jumps.
      if (isLive) {
        const validLat = (lat === 0 || lat === 0.0 || !lat) ? null : lat;
        const validLng = (lng === 0 || lng === 0.0 || !lng) ? null : lng;
        
        await GpsModel.updateLatestState({
          vehicleId, 
          lat: validLat, 
          lng: validLng, 
          speed: speed != null ? Math.round(speed) : null, 
          direction: direction != null ? Math.round(direction) : null, 
          fuel, 
          ignition: finalIgnition, 
          voltage,
          odometer: finalOdometer != null ? Math.round(finalOdometer) : null, 
          satellites: satellites != null ? Math.round(satellites) : null, 
          gsmSignal: gsmSignal != null ? Math.round(gsmSignal) : null
        });
      }

      // 5b. Active Trip Distance Accumulation
      // If this vehicle has an in-progress user-defined trip, accumulate distance in Redis.
      if (isLive && lat && lng && prevState && prevState.lat && prevState.lng) {
        try {
          const activeTripId = await redis.get(`vehicle:active_trip:${vehicleId}`);
          if (activeTripId) {
            const distKm = getHaversineDistance(
              parseFloat(prevState.lat), parseFloat(prevState.lng),
              parseFloat(lat), parseFloat(lng)
            ) / 1000;
            // Same jitter/teleport filters used everywhere else
            if (distKm > 0.01 && distKm < 5) {
              await redis.incrbyfloat(`trip:dist:${activeTripId}`, distKm);
              await redis.incr(`trip:pts:${activeTripId}`);
              const curMax = parseFloat(await redis.get(`trip:maxspd:${activeTripId}`) || '0');
              if ((speed || 0) > curMax) {
                await redis.set(`trip:maxspd:${activeTripId}`, String(speed || 0));
              }
              await redis.incrbyfloat(`trip:spdsum:${activeTripId}`, speed || 0);
            }
          }
        } catch (tripErr) {
          // Non-critical — don't let trip accumulation crash the main location pipeline
          console.error('[SUBSCRIBER] Trip accumulation error:', tripErr.message);
        }
      }

      // 6. Perform alert checks (only for live packets that are recent)
      // Prevents historical bursts from spamming state transitions (Ignition ON/OFF)
      const isRecent = (Date.now() - new Date(deviceTime).getTime()) < 15 * 60 * 1000;
      if (isLive && isRecent) {
        const alertsToTrigger = [];

        // For Heartbeat packets, inherit lat, lng, and speed from prevState
        const evalLat = data.isHeartbeat ? (prevState ? parseFloat(prevState.lat) : null) : lat;
        const evalLng = data.isHeartbeat ? (prevState ? parseFloat(prevState.lng) : null) : lng;
        const evalSpeed = data.isHeartbeat ? (prevState ? parseFloat(prevState.speed) : 0) : (speed || 0);

        // Check A: Ignition ON transition
        if (finalIgnition === true && prevState && prevState.ignition === false) {
          alertsToTrigger.push({ type: 'ignition_on', text: 'Ignition ON Alert: Vehicle started.' });
        }

        // Check A2: Safety Park Alarm (Unauthorized Movement / Ignition)
        // Arms after vehicle has been parked (ignition OFF, speed 0) for > 5 minutes.
        if (vehicle.metadata?.safetyPark === 'YES' && prevState && prevState.ignition === false && (prevState.speed || 0) === 0 && prevState.parkedSince) {
          const parkedDurationMs = new Date(deviceTime).getTime() - new Date(prevState.parkedSince).getTime();
          if (parkedDurationMs >= 5 * 60 * 1000) { // Armed after 5+ minutes parked
            if (finalIgnition === true || evalSpeed > 0) {
              // Debounce: only fire once every 30 minutes so we don't spam the user
              const spKey = `vehicle:safety_park_fired:${vehicleId}`;
              const alreadyFired = await redis.get(spKey);
              if (!alreadyFired) {
                const movementType = finalIgnition === true ? 'Ignition turned ON' : `Moving at ${Math.round(evalSpeed)} km/h`;
                alertsToTrigger.push({
                  type: 'safety_park',
                  text: `Vehicle Theft Alarm: ${vehicle.name} (${vehicle.plate}) — ${movementType} detected while vehicle was parked. Check immediately!`
                });
                await redis.set(spKey, '1', 'EX', 1800); // Lock for 30 minutes
              }
            }
          }
        }

        // Check B: Trip started (Automated trip started notification removed as requested)
        // Only Manual Trips (Check G) will now trigger trip_started / trip_ended alerts.

        // Check C: Ignition OFF transition
        if (finalIgnition === false && prevState && prevState.ignition === true) {
          alertsToTrigger.push({ type: 'stoppage', text: 'Vehicle Stoppage Alert: Vehicle has stopped and ignition turned OFF.' });
        }

        // Check D: Excessive idle (ignition ON, speed 0) using custom duration limit
        if (finalIgnition === true && evalSpeed === 0) {
          const idleDurationLimitMin = parseFloat(vehicle.metadata?.idleDurationAlert) || 10;
          const idleKey = `vehicle:idle_start:${vehicleId}`;
          const alertFiredKey = `vehicle:idle_alert_fired:${vehicleId}`;

          let idleStart = await redis.get(idleKey);
          if (!idleStart) {
            await redis.set(idleKey, Date.now());
          } else {
            const idleDurationMin = (Date.now() - parseInt(idleStart)) / 60000;
            if (idleDurationMin >= idleDurationLimitMin) {
              const alreadyFired = await redis.get(alertFiredKey);
              if (!alreadyFired) {
                alertsToTrigger.push({
                  type: 'excessive_idle',
                  text: `Excessive Idle Alert: Vehicle has been idling for more than ${idleDurationLimitMin} minutes.`
                });
                await redis.set(alertFiredKey, '1', 'EX', 3600); // Lock for 1 hour to prevent spamming
              }
            }
          }
        } else {
          await redis.del(`vehicle:idle_start:${vehicleId}`);
          await redis.del(`vehicle:idle_alert_fired:${vehicleId}`);
        }

        // Check F: Overspeeding (configurable duration, default 3 mins)
        const speedLimit = parseFloat(vehicle.metadata?.overSpeedLimit) || 60;
        const overspeedDurationLimitMin = parseFloat(vehicle.metadata?.overspeedDurationAlert) || 3;
        
        if (evalSpeed > speedLimit) {
          const overspeedKey = `vehicle:overspeed_start:${vehicleId}`;
          const overspeedFiredKey = `vehicle:overspeed_alert_fired:${vehicleId}`;

          let overspeedStart = await redis.get(overspeedKey);
          if (!overspeedStart) {
            await redis.set(overspeedKey, Date.now());
          } else {
            const overspeedDurationMin = (Date.now() - parseInt(overspeedStart)) / 60000;
            if (overspeedDurationMin >= overspeedDurationLimitMin) {
              const alreadyFired = await redis.get(overspeedFiredKey);
              if (!alreadyFired) {
                alertsToTrigger.push({
                  type: 'overspeed',
                  text: `Overspeed Alert: Vehicle has been overspeeding (> ${speedLimit} km/h) for more than ${overspeedDurationLimitMin} minutes.`
                });
                await redis.set(overspeedFiredKey, '1', 'EX', 300); // Lock for 5 mins so they aren't spammed continuously
              }
            }
          }
        } else {
          await redis.del(`vehicle:overspeed_start:${vehicleId}`);
          await redis.del(`vehicle:overspeed_alert_fired:${vehicleId}`);
        }

        // Check E: Geofence checks
        if (evalLat != null && evalLng != null) {
          try {
            const geofences = await GeofenceModel.findGeofencesForVehicle(vehicleId);
            for (const geofence of geofences) {
              let isInsideNow = false;

              if (geofence.type === 'circle') {
                const dist = getHaversineDistance(evalLat, evalLng, parseFloat(geofence.center_lat), parseFloat(geofence.center_lng));
                isInsideNow = dist <= parseFloat(geofence.radius);
              } else if (geofence.type === 'polygon' && Array.isArray(geofence.coordinates)) {
                isInsideNow = isPointInPolygon(evalLat, evalLng, geofence.coordinates);
              }

              const geoStateKey = `vehicle:geofence:${geofence.id}:${vehicleId}`;
              const wasInsideRaw = await redis.get(geoStateKey);
              const wasInside = wasInsideRaw === 'inside';

              if (isInsideNow && !wasInside) {
                alertsToTrigger.push({ type: 'geofence', text: `Geofence In Alert: Entered geofence "${geofence.name}".` });
                await redis.set(geoStateKey, 'inside');
              } else if (!isInsideNow && wasInside) {
                alertsToTrigger.push({ type: 'geofence', text: `Geofence Out Alert: Exited geofence "${geofence.name}".` });
                await redis.set(geoStateKey, 'outside');
              }
            }
          } catch (geoErr) {
            console.error('[SUBSCRIBER] Geofence calculation error:', geoErr.message);
          }
        }

        // Check G: Route deviation, Trip Started, Trip Ended
        // Only runs if the vehicle has an active route assigned.
        try {
          const assignedRoute = await RouteModel.findRouteForVehicle(vehicleId);
          if (assignedRoute && Array.isArray(assignedRoute.coordinates) && assignedRoute.coordinates.length >= 2) {
            const tripKey = `vehicle:on_trip:${vehicleId}`;
            const currentTripRouteId = await redis.get(tripKey);

            // ── Trip Started: ignition ON, moving, not already on a tracked trip ──
            if (finalIgnition === true && evalSpeed > 0 && !currentTripRouteId) {
              alertsToTrigger.push({
                type: 'trip_started',
                text: `Trip Started: Vehicle has started a trip on route "${assignedRoute.name}".`
              });
              await redis.set(tripKey, String(assignedRoute.id), 'EX', 86400); // 24h max trip
            }

            // ── Trip Ended: ignition OFF and was on a trip ──
            if (finalIgnition === false && currentTripRouteId) {
              alertsToTrigger.push({
                type: 'trip_ended',
                text: `Trip Ended: Vehicle has completed/stopped the trip on route "${assignedRoute.name}".`
              });
              await redis.del(tripKey);
              await redis.del(`vehicle:route_deviation_fired:${vehicleId}`);
            }

            // ── Route Deviation: moving on a trip but off-route ──
            if (currentTripRouteId && evalLat != null && evalLng != null && evalSpeed > 0) {
              const distanceFromRoute = getMinDistanceToRoute(evalLat, evalLng, assignedRoute.coordinates);
              const toleranceMeters = parseFloat(assignedRoute.tolerance) || 100;

              if (distanceFromRoute > toleranceMeters) {
                // Debounce: only fire once every 10 minutes so we don't spam the user
                const deviationFiredKey = `vehicle:route_deviation_fired:${vehicleId}`;
                const alreadyFired = await redis.get(deviationFiredKey);
                if (!alreadyFired) {
                  alertsToTrigger.push({
                    type: 'route_deviation',
                    text: `Route Deviation Alert: Vehicle has deviated ${Math.round(distanceFromRoute)}m from route "${assignedRoute.name}" (allowed: ${toleranceMeters}m).`
                  });
                  await redis.set(deviationFiredKey, '1', 'EX', 600); // Lock for 10 mins
                }
              }
            }
          }
        } catch (routeErr) {
          console.error('[SUBSCRIBER] Route deviation check error:', routeErr.message);
        }

        // Publish all triggered alerts to Redis
        for (const triggered of alertsToTrigger) {
          const alertPayload = {
            imei,
            alertType: triggered.type,
            alertText: triggered.text,
            lat: evalLat,
            lng: evalLng,
            deviceTime: deviceTime || new Date().toISOString()
          };
          await redis.publish('alerts', JSON.stringify(alertPayload));
        }
      }

      // 7. Emit real-time events over Socket.io (only for live packets)
      if (isLive) {
        let displayedOdometer = finalOdometer;
        const baseline = parseFloat(vehicle.metadata?.odometerReading) || 0;
        const snapshot = parseFloat(vehicle.metadata?.odometerSnapshot) || 0;
        if (baseline > 0) {
          displayedOdometer = baseline + Math.max(0, (finalOdometer || 0) - snapshot);
        }

        const payload = {
          vehicleId, imei, name: vehicle.name, plate: vehicle.plate,
          lat, lng, speed, direction, fuel, ignition: finalIgnition, voltage,
          odometer: displayedOdometer,
          satellites, gsmSignal, battery, deviceTime, isOnline: true
        };
        io.to(`vehicle:${vehicleId}`).emit('location:update', payload);
        io.to(`org:${orgId}`).emit('fleet:update', payload);
      }

    } catch (err) {
      console.error('[SUBSCRIBER] Error processing location packet:', err.message);
    }
  });
}

/**
 * Stop subscriber — flush any pending batch before closing
 */
async function stop() {
  // Cancel pending timer and flush remaining points first
  if (gpsBatchTimer) {
    clearTimeout(gpsBatchTimer);
    gpsBatchTimer = null;
  }
  if (gpsBatch.length > 0) {
    console.log(`[SUBSCRIBER] Flushing ${gpsBatch.length} pending GPS points before shutdown...`);
    await flushGpsBatch();
  }

  if (subscriber) {
    await subscriber.quit();
    subscriber = null;
  }
}

module.exports = { start, stop };
