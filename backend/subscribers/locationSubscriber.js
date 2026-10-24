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
const { gpsQuery } = require('../config/db'); // GPS writes use a separate isolated pool
const env = require('../config/env');
const webhookService = require('../services/webhookService'); // Civil Supply webhook push
const sclenPushService = require('../services/sclenPushService'); // SCLEN Push
let subscriber = null;

// Bounded global queue for distance recomputes (concurrency 2, max 1000)
const distQueue = [];
const distQueueSet = new Set();
let distQueueRunning = 0;
let distQueueDrops = 0;
const MAX_DIST_CONCURRENCY = 2;
const MAX_DIST_QUEUE_LEN = 1000;

setInterval(() => {
  console.log(`[DIST_QUEUE] Length: ${distQueue.length}, Running: ${distQueueRunning}, Drops (last min): ${distQueueDrops}`);
  distQueueDrops = 0;
}, 60000);

function queueDistanceRecompute(vehicleId, imei) {
  // Dedupe: don't add if already in queue
  if (distQueueSet.has(vehicleId)) return;
  
  if (distQueue.length >= MAX_DIST_QUEUE_LEN) {
    distQueueDrops++;
    console.warn(`[SUBSCRIBER] distQueue full, dropping ${imei}`);
    return;
  }
  distQueue.push({ vehicleId, imei });
  distQueueSet.add(vehicleId);
  processDistQueue();
}

async function processDistQueue() {
  if (distQueueRunning >= MAX_DIST_CONCURRENCY || distQueue.length === 0) return;
  distQueueRunning++;
  const { vehicleId, imei } = distQueue.shift();
  distQueueSet.delete(vehicleId);
  try {
    await GpsModel.getTodayDistanceFromHistory(vehicleId);
  } catch (err) {
    console.warn(`[SUBSCRIBER] distQueue failed for ${imei}:`, err.message);
  } finally {
    distQueueRunning--;
    processDistQueue();
  }
}


// ============================================================
// IMMEDIATE GPS WRITER
// Writes GPS points immediately to PostgreSQL for real-time accuracy.
// ============================================================

/**
 * Inserts a GPS point immediately to Postgres.
 */
async function queueGpsPoint(point) {
  try {
    // Use the dedicated GPS pool — never blocks the API/login pool
    await gpsQuery(`
      INSERT INTO gps_points
        (vehicle_id, lat, lng, speed, direction, odometer, fuel, ignition,
         satellites, gsm_signal, battery, voltage, is_live, device_time)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (vehicle_id, device_time) DO NOTHING
    `, [
      point.vehicleId,
      point.lat,
      point.lng,
      point.speed != null ? Math.round(point.speed) : null,
      point.direction != null ? Math.round(point.direction) : null,
      point.odometer != null ? Math.round(point.odometer) : null,
      point.fuel ?? null,
      point.ignition ?? null,
      point.satellites != null ? Math.round(point.satellites) : null,
      point.gsmSignal != null ? Math.round(point.gsmSignal) : null,
      point.battery != null ? Math.round(point.battery) : null,
      point.voltage ?? null,
      point.isLive ?? true,
      point.deviceTime
    ]);
  } catch (err) {
    console.error(`[GPS-INSERT] Immediate insert error for vehicle ${point.vehicleId}:`, err.message);
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
    console.log('[SUBSCRIBER] Location subscriber connected to Redis (immediate writes)');
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
          parsedJson: data.parsedJson || data,
          parsed: isParsed,
          error: errorMsg
        });
        
        if (io) {
          const vehicle = await VehicleModel.findByImei(data.imei);
          if (vehicle) {
            io.to(`vehicle:${vehicle.id}`).emit('raw:update', {
              id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              vehicleId: vehicle.id,
              received_at: new Date().toISOString(),
              device_time: data.deviceTime,
              odometer: data.odometer,
              parsed: isParsed,
              packet_type: data.packetType || 'DATA',
              raw_hex: data.rawHex || actualRaw,
              raw: actualRaw,
              error: errorMsg,
              parsed_data: data.parsedJson || data
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

      // 1b. Compute raw Engine ON state based on admin-configured preference
      const engineOnPref = vehicle.metadata?.engineOn || 'Ignition';
      const batteryThresh = parseFloat(vehicle.metadata?.batteryVoltage) || 13.2;
      const isMoving = speed != null && parseFloat(speed) > 5.0;
      let rawIgnition = ignition;

      if (isMoving) {
        // GPS speed > 5 km/h confirms the vehicle is actively driving; ignition cannot be OFF
        rawIgnition = true;
      } else if (engineOnPref === 'Voltage+Ignition') {
        // If voltage is null/unavailable (e.g. PN02 boot packet with 0xFF bytes),
        // fall back to ignition signal alone rather than blocking it
        if (voltage != null && !isNaN(voltage)) {
          rawIgnition = ignition === true && voltage >= batteryThresh;
        } else {
          rawIgnition = ignition === true;
        }
      } else if (engineOnPref === 'Voltage') {
        if (voltage != null && !isNaN(voltage)) {
          rawIgnition = voltage >= batteryThresh;
        } else {
          rawIgnition = ignition === true; // Fallback when voltage unavailable
        }
      } else if (engineOnPref === 'Digital Input 1') {
        rawIgnition = data.din1 === true;
      } else {
        rawIgnition = ignition === true;
      }

      // 1c. Ignition Debounce / Hysteresis Filter (3-Minute Window)
      // Absorbs electrical dips (e.g. borewell pump engagement, starter surge, wire vibration)
      // where engine drops to OFF for < 3 minutes before recovering to ON,
      // or momentary electrical spikes where engine blips ON for < 3 minutes while parked.
      const currentPacketTimeMs = new Date(deviceTime).getTime() || Date.now();
      const stableIgnKey = `vehicle:stable_ignition:${vehicleId}`;
      const pendingIgnKey = `vehicle:pending_ignition:${vehicleId}`;
      const pendingSinceKey = `vehicle:pending_ignition_since:${vehicleId}`;

      const stableIgnStr = await redis.get(stableIgnKey);
      let finalIgnition = rawIgnition;

      if (isMoving) {
        // Physical movement > 5 km/h immediately confirms Engine is ON (0 delay when moving)
        finalIgnition = true;
        await redis.set(stableIgnKey, '1', 'EX', 86400 * 7);
        await redis.del(pendingIgnKey);
        await redis.del(pendingSinceKey);
      } else if (stableIgnStr === null) {
        // Initial setup for this vehicle — initialize stable state
        finalIgnition = rawIgnition;
        await redis.set(stableIgnKey, rawIgnition ? '1' : '0', 'EX', 86400 * 7);
        await redis.del(pendingIgnKey);
        await redis.del(pendingSinceKey);
      } else {
        const isStableOn = stableIgnStr === '1';

        if (rawIgnition === isStableOn) {
          // Packet matches current stable state — any temporary pending glitch is cancelled!
          finalIgnition = isStableOn;
          await redis.del(pendingIgnKey);
          await redis.del(pendingSinceKey);
        } else {
          // Packet differs from stable state (e.g. currently ON, but packet says OFF; or currently OFF, but packet says ON)
          const pendingTarget = rawIgnition ? '1' : '0';
          const currentPending = await redis.get(pendingIgnKey);
          const pendingSinceStr = await redis.get(pendingSinceKey);

          if (currentPending !== pendingTarget || !pendingSinceStr) {
            // New pending transition started — record start of candidate state change
            await redis.set(pendingIgnKey, pendingTarget, 'EX', 600);
            await redis.set(pendingSinceKey, String(currentPacketTimeMs), 'EX', 600);
            // Retain previous stable state during the 3-minute grace window!
            finalIgnition = isStableOn;
          } else {
            // Candidate transition in progress — check if it has persisted continuously for 3 minutes
            const pendingSinceMs = parseInt(pendingSinceStr, 10);
            const elapsedMs = currentPacketTimeMs - pendingSinceMs;
            const DEBOUNCE_WINDOW_MS = 3 * 60 * 1000; // 3 minutes

            if (elapsedMs >= DEBOUNCE_WINDOW_MS) {
              // Transition CONFIRMED! Engine has remained in new state continuously for 3 minutes
              finalIgnition = rawIgnition;
              await redis.set(stableIgnKey, pendingTarget, 'EX', 86400 * 7);
              await redis.del(pendingIgnKey);
              await redis.del(pendingSinceKey);
            } else {
              // Still inside 3-minute grace window — absorb glitch and keep stable state!
              finalIgnition = isStableOn;
            }
          }
        }
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
          await GpsModel.updateLatestState({ vehicleId, ignition: finalIgnition, voltage, battery: battery != null ? Math.round(battery) : null });
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

      // ── STATUS SINCE TRACKING ───────────────────────────────────────────
      // Compute the current vehicle status using the same rules as the Flutter app:
      //   'moving'  → speed > 2 km/h
      //   'idle'    → speed <= 2 km/h AND ignition ON
      //   'parked'  → speed <= 2 km/h AND ignition OFF
      const evalSpeedForStatus = (speed || 0);
      let currentStatusKey;
      if (evalSpeedForStatus > 2) {
        currentStatusKey = 'moving';
      } else if (finalIgnition === true) {
        currentStatusKey = 'idle';
      } else {
        currentStatusKey = 'parked';
      }

      // Detect transitions and persist statusSince in the Redis cache
      const prevStatusKey = prevState ? prevState.statusKey : null;
      let statusSince = prevState ? prevState.statusSince : null;
      if (prevStatusKey !== currentStatusKey || !statusSince) {
        // Status changed — record the exact deviceTime when the new state began
        statusSince = deviceTime;
      }

      // 2c. Compute Fuel in Liters (Auto, Manual, or Direct Calibration)
      let finalFuelLiters = fuel; // Default to raw if no calibration exists
      if (vehicle.metadata) {
        const fuelCal = vehicle.metadata.fuelCalibration || {};
        const tank1Cal = fuelCal.tanks?.[1] || fuelCal;
        const capacity = parseFloat(tank1Cal.tankSize || vehicle.metadata.tankSize);
        const calType = vehicle.metadata.fuelConfig?.calibrateType || tank1Cal.calibrateType || 'Auto';

        if (calType === 'Direct') {
          // Direct Mode: Sensor transmits actual volume or percentage directly
          const mult = parseFloat(tank1Cal.directMultiplier ?? 1.0);
          const offset = parseFloat(tank1Cal.directOffset ?? 0.0);
          const unit = tank1Cal.directUnit || 'Litres';
          const validMult = !isNaN(mult) ? mult : 1.0;
          const validOffset = !isNaN(offset) ? offset : 0.0;
          const rawScaled = (fuel * validMult) + validOffset;

          if (unit === 'Percentage' && capacity > 0) {
            finalFuelLiters = Math.max(0, Math.min(capacity, (rawScaled / 100) * capacity));
          } else {
            finalFuelLiters = Math.max(0, capacity > 0 ? Math.min(capacity, rawScaled) : rawScaled);
          }
        } else if (calType === 'Manual' && Array.isArray(tank1Cal.calibrationPoints) && tank1Cal.calibrationPoints.length >= 2) {
          // Manual Mode: Piecewise Linear Interpolation across user-calibrated points
          const rawFuel = fuel;
          const altVolt = voltage != null && !isNaN(voltage) ? parseFloat(voltage) : null;

          const points = tank1Cal.calibrationPoints
            .map(p => {
              const l = parseFloat(p.litres);
              const adc = parseFloat(p.adcValue);
              const v = parseFloat(p.volt);
              const f = parseFloat(p.frequency);
              return {
                litres: l,
                adcValue: !isNaN(adc) ? adc : (!isNaN(f) && f > 0 ? f : v),
                volt: !isNaN(v) ? v : 0,
                frequency: !isNaN(f) ? f : 0
              };
            })
            .filter(p => !isNaN(p.litres) && !isNaN(p.adcValue))
            .sort((a, b) => a.adcValue - b.adcValue);

          if (points.length >= 2) {
            // Check if sensor is calibrated in low voltage (< 36V) and incoming voltage matches
            const isVoltageSensor = points.some(p => p.volt > 0) && points.every(p => p.adcValue <= 36.0);
            const inputVal = (isVoltageSensor && altVolt != null && altVolt > 0 && altVolt <= 36.0) ? altVolt : rawFuel;

            if (inputVal <= points[0].adcValue) {
              finalFuelLiters = points[0].litres;
            } else if (inputVal >= points[points.length - 1].adcValue) {
              finalFuelLiters = points[points.length - 1].litres;
            } else {
              for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                if (inputVal >= p1.adcValue && inputVal <= p2.adcValue) {
                  const range = p2.adcValue - p1.adcValue;
                  const ratio = range !== 0 ? (inputVal - p1.adcValue) / range : 0;
                  finalFuelLiters = Math.round((p1.litres + ratio * (p2.litres - p1.litres)) * 100) / 100;
                  break;
                }
              }
            }
          }
        } else {
          // Auto Mode: Dynamic geometry-aware calculation (Rectangle vs Cylinder Horizontal vs Vertical)
          const emptyAdcRaw = parseFloat(tank1Cal.minAdc ?? vehicle.metadata.fuelEmptyAdc);
          const fullAdcRaw = parseFloat(tank1Cal.maxAdc ?? vehicle.metadata.fuelFullAdc);
          const emptyAdc = !isNaN(emptyAdcRaw) ? emptyAdcRaw : 0;
          const fullAdc = !isNaN(fullAdcRaw) ? fullAdcRaw : 4095;
          const shape = tank1Cal.fuelTankShape || vehicle.metadata.fuelTankShape || 'Rectangle';
          const position = tank1Cal.fuelTankPosition || vehicle.metadata.fuelTankPosition || 'Horizontal';

          if (capacity > 0 && fullAdc !== emptyAdc) {
            // Liquid depth fraction: 0.0 (empty) to 1.0 (full)
            let heightFraction = (fuel - emptyAdc) / (fullAdc - emptyAdc);
            if (heightFraction < 0) heightFraction = 0;
            if (heightFraction > 1) heightFraction = 1;

            if (shape === 'Cylinder' && position === 'Horizontal') {
              // Real-world horizontal cylinder geometry: volume varies by circular segment area
              const f = heightFraction;
              if (f <= 0) {
                finalFuelLiters = 0;
              } else if (f >= 1) {
                finalFuelLiters = capacity;
              } else {
                const term1 = Math.acos(1 - 2 * f);
                const term2 = (1 - 2 * f) * Math.sqrt(4 * f * (1 - f));
                const volumeFraction = (term1 - term2) / Math.PI;
                finalFuelLiters = Math.round(capacity * volumeFraction * 100) / 100;
              }
            } else {
              // Rectangle or Vertical Cylinder (uniform cross section along height)
              finalFuelLiters = Math.round(capacity * heightFraction * 100) / 100;
            }
          }
        }
      }

      // 2d. Fuel Alerts (Theft & Refill)
      if (isLive && prevState && prevState.fuel !== undefined && finalFuelLiters !== undefined) {
        const prevFuel = parseFloat(prevState.fuel);
        const currFuel = parseFloat(finalFuelLiters);
        const capacity = parseFloat(vehicle.metadata?.tankSize) || 100;
        
        // Threshold: 5% of tank or 10L, min 5L, max 30L jump
        const threshold = Math.max(5, Math.min(30, capacity * 0.05)); 
        const diff = currFuel - prevFuel;
        
        // We only trigger alert if there was a real jump AND the engine is OFF (for theft) or ON/OFF (for refill).
        // Actually, fuel sloshing while moving can cause false alerts. Usually fuel alerts are suppressed while moving.
        const isSloshing = speed > 5;
        
        if (!isSloshing) {
          if (diff <= -threshold) {
            redis.publish('alerts', JSON.stringify({
              imei: vehicle.imei, alertType: 'fuel_theft',
              alertText: `Fuel dropped rapidly by ${Math.abs(diff).toFixed(1)}L. Possible theft or leak.`,
              lat, lng, deviceTime
            }));
          } else if (diff >= threshold) {
            redis.publish('alerts', JSON.stringify({
              imei: vehicle.imei, alertType: 'fuel_refill',
              alertText: `Fuel refilled by ${diff.toFixed(1)}L.`,
              lat, lng, deviceTime
            }));
          }
        }
      }

      // 3. Cache updated state in Redis (fast — always per-packet)
      // Only cache LIVE packets so historical/buffered dumps don't overwrite the true current state
      if (isLive) {
        // State preservation: Never erase last-known GPS coordinates or voltage from Redis cache
        // when a vehicle enters a tunnel, shed, or stationary GPS-blind spot.
        const cachedLat = lat || (prevState && prevState.lat) || null;
        const cachedLng = lng || (prevState && prevState.lng) || null;
        const cachedVoltage = voltage || (prevState && prevState.voltage) || null;

        const updatedPayload = {
          ...data,
          lat: cachedLat,
          lng: cachedLng,
          voltage: cachedVoltage,
          ignition: finalIgnition,
          odometer: finalOdometer,
          parkedSince,
          fuel: finalFuelLiters,
          statusKey: currentStatusKey,
          statusSince
        };
        await redis.set(
          `vehicle:state:${imei}`,
          JSON.stringify(updatedPayload),
          'EX', 86400 // 24 hours — must outlive the 5-min safety park arming window
        );
      }

      // 4. Queue GPS point for batched DB write (skipped for heartbeats)
      //
      // GPS VALIDITY RULES (fixes Indian Ocean + Africa/Niger bugs):
      // - Bug A: BSTPL firmware sends lat=0 when GPS fix is lost → Indian Ocean
      // - Bug B: BSTPL firmware drops leading zero from longitude ("0831" instead of "08331")
      //          → parser gets degrees=8 instead of 83 → Niger/Africa
      //
      // PERMANENT FIX: Hard India bounding box. All vehicles use Indian SIM cards.
      // ANY coordinate outside India bounding box is guaranteed firmware garbage.
      // India bbox with generous buffer: lat 6–38°N, lng 65–100°E
      const fLat = parseFloat(lat);
      const fLng = parseFloat(lng);
      const isWithinIndia = fLat >= 6.0 && fLat <= 38.0 && fLng >= 65.0 && fLng <= 100.0;
      const hasValidGps = lat && lng && fLat !== 0 && fLng !== 0 && isWithinIndia;

      if (!data.isHeartbeat && hasValidGps) {
        await queueGpsPoint({
          vehicleId, lat, lng, speed, direction, odometer: finalOdometer, fuel: finalFuelLiters,
          ignition: finalIgnition, satellites, gsmSignal, battery,
          voltage, isLive, deviceTime
        });
      } else if (!data.isHeartbeat && !hasValidGps) {
        console.warn(`[GPS-REJECT] IMEI ${imei}: Coordinates (${fLat},${fLng}) outside India bbox or zero — firmware glitch, dropped from DB.`);
      }

      // 5. Update denormalized latest-state table (per-packet, needed for dashboard accuracy)
      // If the device lost GPS fix and sends a 0 coordinate, don't overwrite the last known valid location!
      // ONLY update latest state if the packet is LIVE, to prevent historical jumps.
      let todayDistanceKm = 0;
      if (isLive) {
        // Only write lat/lng to latest state if it's within India — same bbox guard as GPS history
        const validLat = hasValidGps ? fLat : null;
        const validLng = hasValidGps ? fLng : null;

        const updateResult = await GpsModel.updateLatestState({
          vehicleId,
          lat: validLat,
          lng: validLng,
          speed: speed != null ? Math.round(speed) : null,
          direction: direction != null ? Math.round(direction) : null,
          fuel: finalFuelLiters,
          ignition: finalIgnition,
          voltage,
          odometer: finalOdometer != null ? Math.round(finalOdometer) : null,
          satellites: satellites != null ? Math.round(satellites) : null,
          gsmSignal: gsmSignal != null ? Math.round(gsmSignal) : null,
          battery: battery != null ? Math.round(battery) : null
        });

        // 5a. today_distance: use incremental value from updateLatestState for the
        //     live dashboard. Only run the expensive full-history recompute at most
        //     ONCE per 60 seconds per vehicle (throttled via Redis TTL key).
        //     This avoids the "thundering herd" where 4000+ vehicles each trigger a
        //     full gps_points table scan simultaneously after a deployment restart.
        todayDistanceKm = updateResult ?? 0;

        const throttleKey = `dist:throttle:${vehicleId}`;
        const alreadyQueued = await redis.exists(throttleKey);
        if (!alreadyQueued) {
          // Arm the throttle — expires in 60s so next full recompute fires then
          await redis.set(throttleKey, '1', 'EX', 60);
          // Run the heavy full-history recompute in the background via queue
          queueDistanceRecompute(vehicleId, imei);
        }
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

        // Detect if device was asleep (no packets for > 5 mins)
        // If it was asleep, it was likely parked, so we shouldn't falsely accumulate Idling time during the sleep gap.
        const prevDeviceTimeMs = prevState && prevState.deviceTime ? new Date(prevState.deviceTime).getTime() : 0;
        const currentDeviceTimeMs = new Date(deviceTime).getTime();
        const timeSinceLastPacketMs = currentDeviceTimeMs - prevDeviceTimeMs;
        const wasAsleep = timeSinceLastPacketMs > (5 * 60 * 1000); // 5 minutes gap


        // For Heartbeat packets, inherit lat, lng, and speed from prevState
        const evalLat = data.isHeartbeat ? (prevState ? parseFloat(prevState.lat) : null) : lat;
        const evalLng = data.isHeartbeat ? (prevState ? parseFloat(prevState.lng) : null) : lng;
        const evalSpeed = data.isHeartbeat ? (prevState ? parseFloat(prevState.speed) : 0) : (speed || 0);

        // Check A: Ignition ON transition (confirmed after debouncing)
        if (finalIgnition === true && prevState && prevState.ignition === false) {
          const igKey = `vehicle:ignition_on_fired:${vehicleId}`;
          const alreadyFired = await redis.get(igKey);
          
          let wasParkedLongEnough = false;
          if (prevState.parkedSince) {
            const parkedDurationMs = currentDeviceTimeMs - new Date(prevState.parkedSince).getTime();
            if (parkedDurationMs >= 3 * 60 * 1000) { // Off for at least 3 minutes
              wasParkedLongEnough = true;
            }
          }

          if (!alreadyFired && (wasParkedLongEnough || wasAsleep)) {
            alertsToTrigger.push({
              type: 'ignition_on',
              text: `Engine ON Alert: ${vehicle.name} (${vehicle.plate}) engine turned ON.`,
              deviceTime: new Date(currentDeviceTimeMs).toISOString()
            });
            await redis.set(igKey, '1', 'EX', 1800); // Lock for 30 minutes to ensure it doesn't fire again on this trip
            await redis.del(`vehicle:ignition_off_fired:${vehicleId}`);
          }
        }

        // Check A1: Ignition OFF transition (confirmed after 3-minute debounce)
        if (finalIgnition === false && prevState && prevState.ignition === true) {
          const igOffKey = `vehicle:ignition_off_fired:${vehicleId}`;
          const alreadyFired = await redis.get(igOffKey);
          if (!alreadyFired) {
            alertsToTrigger.push({
              type: 'ignition_off',
              text: `Engine OFF Alert: ${vehicle.name} (${vehicle.plate}) engine turned OFF.`,
              deviceTime: new Date(currentDeviceTimeMs).toISOString()
            });
            await redis.set(igOffKey, '1', 'EX', 1800);
            await redis.del(`vehicle:ignition_on_fired:${vehicleId}`);
          }
        }

        // Check A2: Safety Parking Alarm (Theft / Unauthorized Ignition or Movement)
        // Arms immediately whenever Safety Parking is toggled ON for this vehicle.
        if (vehicle.metadata?.safetyPark === 'YES') {
          const isBreached = rawIgnition === true || finalIgnition === true || evalSpeed > 1;

          if (isBreached) {
            // Mark vehicle as actively breached in Redis
            const breachKey = `vehicle:safety_park_breach:${vehicleId}`;
            await redis.set(breachKey, '1', 'EX', 86400);

            // Throttle database alerts to once every 60s so user is notified without flooding DB
            const spKey = `vehicle:safety_park_fired:${vehicleId}`;
            const alreadyFired = await redis.get(spKey);
            if (!alreadyFired) {
              const hasIgn = rawIgnition === true || finalIgnition === true;
              const movementType = (hasIgn && evalSpeed > 1)
                ? `Engine ON & Moving at ${Math.round(evalSpeed)} km/h`
                : (hasIgn ? 'Engine turned ON' : `Moving at ${Math.round(evalSpeed)} km/h`);

              alertsToTrigger.push({
                type: 'safety_park',
                speed: evalSpeed,
                text: `🚨 THEFT ALARM: ${vehicle.name} (${vehicle.plate}) — ${movementType} while Safety Parking was ACTIVE! Check immediately!`,
                deviceTime: new Date(currentDeviceTimeMs).toISOString()
              });
              await redis.set(spKey, '1', 'EX', 60); // Retrigger every 60s if condition persists
            }
          }
        }

        // Check B: Trip started (Automated trip started notification removed as requested)
        // Only Manual Trips (Check G) will now trigger trip_started / trip_ended alerts.

        // Check C: Stoppage & Moving Tracking based on SPEED
        // Stoppage alert fires when speed hits 0 (debounced).
        // Moving alert fires when speed reaches >= 10 km/h, reporting the duration it was stopped.
        const stoppageStartKey = `vehicle:stoppage_start:${vehicleId}`;
        const stoppageAlertFiredKey = `vehicle:stoppage_fired:${vehicleId}`;
        
        if (evalSpeed === 0) {
          const existingStart = await redis.get(stoppageStartKey);
          let startMs = currentDeviceTimeMs;
          if (!existingStart || wasAsleep) {
            await redis.set(stoppageStartKey, startMs); // Track stoppage start time for Moving alert
          }
          // Note: Long Stoppage Alert has been removed. Inactivity is now handled by Parking Alert (engine OFF) and Idle Alert (engine ON).
        } else if (evalSpeed > 10) {
          const stoppageStartStr = await redis.get(stoppageStartKey);
          if (stoppageStartStr) {
            const startMs = parseInt(stoppageStartStr, 10);
            const durationMin = Math.round((currentDeviceTimeMs - startMs) / 60000);
            
            // Stoppage threshold before moving alert: Default 1 hr (60 mins), configurable by customer (minimum stoppage of 5 mins)
            const movingStoppageLimitMin = Math.max(5, parseFloat(vehicle.metadata?.movingDurationAlert || vehicle.metadata?.movingStoppageDuration) || 60);
            
            if (durationMin >= movingStoppageLimitMin) {
              const formatOpts = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute:'2-digit', hour12: true };
              const startFmt = new Date(startMs).toLocaleTimeString('en-US', formatOpts);
              const endFmt = new Date(currentDeviceTimeMs).toLocaleTimeString('en-US', formatOpts);
              
              const durationText = durationMin >= 60
                ? `${Math.floor(durationMin / 60)} hr${durationMin >= 120 ? 's' : ''}${durationMin % 60 > 0 ? ` ${durationMin % 60} mins` : ''}`
                : `${durationMin} mins`;

              alertsToTrigger.push({ 
                type: 'moving', 
                text: `Moving Alert: ${vehicle.name} (${vehicle.plate}) has started moving after ${durationText} of stoppage (from ${startFmt} to ${endFmt}).` 
              });
            }
            // Clear the tracking key since the vehicle is now moving > 10 km/h
            await redis.del(stoppageStartKey);
            await redis.del(stoppageAlertFiredKey);
          }
        }

        // Check C2: Parking Alert
        // Default threshold: 60 minutes (1 hr). Configurable by customer per vehicle metadata.
        if (finalIgnition === false && evalSpeed === 0 && prevState?.parkedSince) {
          if (wasAsleep) {
            // If device was asleep, reset the parkedSince timer to avoid false jumps
            await redis.set(`vehicle:state:${imei}`, JSON.stringify({ ...JSON.parse(await redis.get(`vehicle:state:${imei}`) || '{}'), parkedSince: deviceTime }));
          } else {
            const parkedStartMs = new Date(prevState.parkedSince).getTime();
            const parkingDurationMin = (currentDeviceTimeMs - parkedStartMs) / 60000;
            const parkAlertFiredKey = `vehicle:parking_alert_fired:${vehicleId}`;
            const parkDurationLimitMin = parseFloat(vehicle.metadata?.parkingDurationAlert || vehicle.metadata?.parkDurationAlert) || 60; // Default 1 hr (60 mins)
            
            if (parkingDurationMin >= parkDurationLimitMin) {
              const alreadyFired = await redis.get(parkAlertFiredKey);
              if (!alreadyFired) {
                const formatOpts = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true };
                const startFmt = new Date(parkedStartMs).toLocaleTimeString('en-US', formatOpts);
                const durationText = parkingDurationMin >= 60
                  ? `${Math.floor(parkingDurationMin / 60)} hr${parkingDurationMin >= 120 ? 's' : ''}${Math.round(parkingDurationMin % 60) > 0 ? ` ${Math.round(parkingDurationMin % 60)} mins` : ''}`
                  : `${Math.round(parkingDurationMin)} mins`;

                alertsToTrigger.push({
                  type: 'parking',
                  text: `Parking Alert: ${vehicle.name} (${vehicle.plate}) has been parked since ${startFmt} (${durationText}).`,
                  deviceTime: new Date(parkedStartMs).toISOString()
                });
                await redis.set(parkAlertFiredKey, '1', 'EX', 86400); // Fire once per parking session (24h max)
              }
            }
          }
        } else if (finalIgnition === true || evalSpeed > 0) {
          // Vehicle is moving or ignition turned on — reset the parking alert so it can fire again next time
          await redis.del(`vehicle:parking_alert_fired:${vehicleId}`);
        }

        // Check D: Excessive idle (ignition ON, speed 0) using custom duration limit
        // Default threshold: 60 minutes (1 hr). Configurable by customer per vehicle metadata.
        if (finalIgnition === true && evalSpeed === 0) {
          const idleDurationLimitMin = parseFloat(vehicle.metadata?.idleDurationAlert) || 60; // Default 1 hr (60 mins)
          const idleKey = `vehicle:idle_start:${vehicleId}`;
          const alertFiredKey = `vehicle:idle_alert_fired:${vehicleId}`;

          let idleStart = await redis.get(idleKey);
          if (!idleStart || wasAsleep) {
            // If it was asleep, it wasn't actively idling. Reset the idle start time!
            await redis.set(idleKey, currentDeviceTimeMs);
          } else {
            const idleStartMs = parseInt(idleStart, 10);
            const idleDurationMin = (currentDeviceTimeMs - idleStartMs) / 60000;
            if (idleDurationMin >= idleDurationLimitMin) {
              const alreadyFired = await redis.get(alertFiredKey);
              if (!alreadyFired) {
                const formatOpts = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true };
                const startFmt = new Date(idleStartMs).toLocaleTimeString('en-US', formatOpts);
                const durationText = idleDurationMin >= 60
                  ? `${Math.floor(idleDurationMin / 60)} hr${idleDurationMin >= 120 ? 's' : ''}${Math.round(idleDurationMin % 60) > 0 ? ` ${Math.round(idleDurationMin % 60)} mins` : ''}`
                  : `${Math.round(idleDurationMin)} mins`;

                alertsToTrigger.push({
                  type: 'excessive_idle',
                  text: `Idling Alert: ${vehicle.name} (${vehicle.plate}) has been idling since ${startFmt} (${durationText}).`,
                  deviceTime: new Date(idleStartMs).toISOString()
                });
                await redis.set(alertFiredKey, '1', 'EX', 86400); // Lock until vehicle stops idling
              }
            }
          }
        } else {
          await redis.del(`vehicle:idle_start:${vehicleId}`);
          await redis.del(`vehicle:idle_alert_fired:${vehicleId}`);
        }

        // Check F: Overspeeding
        // 1. When speed > threshold, trigger ONCE immediately with the exact start time.
        // 2. Observe for 10 minutes. If overspeeding continues, trigger continuous overspeed alert reporting duration since start time.
        // 3. When speed drops <= threshold, reset state so it is ready for the next overspeed event.
        const speedLimit = parseFloat(vehicle.metadata?.overSpeedLimit) || 60;
        
        if (evalSpeed > speedLimit) {
          const overspeedStartKey = `vehicle:overspeed_start:${vehicleId}`;
          const overspeedInitialFiredKey = `vehicle:overspeed_initial_fired:${vehicleId}`;
          const overspeedSustainedKey = `vehicle:overspeed_sustained_step:${vehicleId}`;

          const startStr = await redis.get(overspeedStartKey);
          const formatOpts = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true };

          if (!startStr) {
            // First overspeed packet: trigger immediately once and record start time
            await redis.set(overspeedStartKey, currentDeviceTimeMs, 'EX', 86400);
            await redis.set(overspeedInitialFiredKey, '1', 'EX', 86400);

            const startFmt = new Date(currentDeviceTimeMs).toLocaleTimeString('en-US', formatOpts);
            alertsToTrigger.push({
              type: 'overspeed',
              speed: evalSpeed,
              text: `Overspeed Alert: ${vehicle.name} (${vehicle.plate}) started overspeeding at ${Math.round(evalSpeed)} km/h (speed limit: ${speedLimit} km/h) at ${startFmt}.`,
              deviceTime: new Date(currentDeviceTimeMs).toISOString()
            });
          } else {
            // Vehicle continues overspeeding: observe for 10 minutes intervals
            const startMs = parseInt(startStr, 10);
            const overspeedDurationMin = Math.floor((currentDeviceTimeMs - startMs) / 60000);

            if (overspeedDurationMin >= 10) {
              const currentStep = Math.floor(overspeedDurationMin / 10);
              const lastStep = parseInt(await redis.get(overspeedSustainedKey) || '0', 10);

              if (currentStep > lastStep) {
                const startFmt = new Date(startMs).toLocaleTimeString('en-US', formatOpts);
                alertsToTrigger.push({
                  type: 'overspeed',
                  speed: evalSpeed,
                  text: `Continuous Overspeed Alert: ${vehicle.name} (${vehicle.plate}) has been overspeeding continuously since ${startFmt} (${overspeedDurationMin} mins at ${Math.round(evalSpeed)} km/h, speed limit: ${speedLimit} km/h).`,
                  deviceTime: new Date(startMs).toISOString()
                });
                await redis.set(overspeedSustainedKey, currentStep, 'EX', 86400);
              }
            }
          }
        } else {
          // Speed dropped <= limit: clear overspeed tracking session
          await redis.del(`vehicle:overspeed_start:${vehicleId}`);
          await redis.del(`vehicle:overspeed_initial_fired:${vehicleId}`);
          await redis.del(`vehicle:overspeed_sustained_step:${vehicleId}`);
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
                if (geofence.alert_on_enter !== false) {
                  alertsToTrigger.push({ type: 'geofence', text: `Geofence In Alert: Entered geofence "${geofence.name}".` });
                }
                await redis.set(geoStateKey, 'inside');
              } else if (!isInsideNow && wasInside) {
                if (geofence.alert_on_exit !== false) {
                  alertsToTrigger.push({ type: 'geofence', text: `Geofence Out Alert: Exited geofence "${geofence.name}".` });
                }
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
            speed: triggered.speed,
            lat: evalLat,
            lng: evalLng,
            deviceTime: triggered.deviceTime || deviceTime || new Date().toISOString()
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

        const emitLat = hasValidGps ? lat : (prevState ? prevState.lat : null);
        const emitLng = hasValidGps ? lng : (prevState ? prevState.lng : null);

        const payload = {
          vehicleId, imei, name: vehicle.name, plate: vehicle.plate,
          lat: emitLat, lng: emitLng, speed, direction, fuel, ignition: finalIgnition, voltage,
          odometer: displayedOdometer,
          satellites, gsmSignal, battery, deviceTime, isOnline: true,
          // today_distance included so the mobile app can display live covered distance
          today_distance: todayDistanceKm ?? 0,
          // statusSince: the exact timestamp when the vehicle entered its current status
          // (Moving/Idle/Parked). Flutter uses this to show accurate duration like
          // "Moving Since 10:25 AM (3h 15m)" instead of resetting to now() every packet.
          statusSince
        };
        io.to(`vehicle:${vehicleId}`).emit('location:update', payload);
        io.to(`org:${orgId}`).emit('fleet:update', payload);

        // 8. Webhook push (Civil Supply / third-party clients)
        // Fire-and-forget: NEVER awaited, NEVER blocks this pipeline.
        // webhookService internally catches all errors — safe in production.
        if (hasValidGps) {
          webhookService.dispatch(vehicle, {
            lat, lng, speed, direction, voltage, battery, satellites,
            ignition: finalIgnition, deviceTime
          });
          sclenPushService.pushToCoromandel(vehicle, {
            lat, lng, deviceTime
          });
        }
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
  if (subscriber) {
    await subscriber.quit();
    subscriber = null;
  }
}

module.exports = { start, stop };
