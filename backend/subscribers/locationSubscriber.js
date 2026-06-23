// ============================================================
// LOCATION SUBSCRIBER
// Subscribes to Redis 'tracking' channel
// Writes GPS points to database, performs alerts checks, and emits live updates over Socket.io
// ============================================================

const { redis, createSubscriber } = require('../config/redis');
const VehicleModel = require('../models/vehicleModel');
const GpsModel = require('../models/gpsModel');
const GeofenceModel = require('../models/geofenceModel');
const RouteModel = require('../models/routeModel');

let subscriber = null;

// Haversine formula to compute distance in meters
function getHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Point in polygon ray-casting algorithm
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
  
  const l2 = (b.lat - a.lat)**2 + (b.lng - a.lng)**2;
  let t = ((p.lat - a.lat) * (b.lat - a.lat) + (p.lng - a.lng) * (b.lng - a.lng)) / l2;
  t = Math.max(0, Math.min(1, t));
  
  const projectionLat = a.lat + t * (b.lat - a.lat);
  const projectionLng = a.lng + t * (b.lng - a.lng);
  
  return getHaversineDistance(p.lat, p.lng, projectionLat, projectionLng);
}

function getMinDistanceToRoute(lat, lng, routeCoords) {
  let minDistance = Infinity;
  for (let i = 0; i < routeCoords.length - 1; i++) {
    const p1 = routeCoords[i];
    const p2 = routeCoords[i+1];
    const dist = getDistanceToSegment({lat, lng}, p1, p2);
    if (dist < minDistance) minDistance = dist;
  }
  return minDistance;
}

/**
 * Start listening to Redis tracking updates
 * @param {object} io - Socket.io server instance
 */
async function start(io) {
  subscriber = createSubscriber();

  subscriber.on('connect', () => {
    console.log('[SUBSCRIBER] Location subscriber connected to Redis');
  });

  // Subscribe to 'tracking' channel
  await subscriber.subscribe('tracking');

  subscriber.on('message', async (channel, message) => {
    if (channel !== 'tracking') return;

    try {
      const data = JSON.parse(message);
      const { imei, lat, lng, speed, fuel, ignition, voltage, direction,
              odometer, satellites, gsmSignal, battery, deviceTime, isLive } = data;

      // 1. Resolve IMEI to Vehicle ID and Org ID
      const vehicle = await VehicleModel.findByImei(imei);
      if (!vehicle) {
        // Log raw packets if unregistered device tries to connect
        await GpsModel.saveRawPacket(imei, message, false, 'Unregistered IMEI');
        return;
      }

      const vehicleId = vehicle.id;
      const orgId = vehicle.org_id;

      // 2. Fetch the vehicle's last cached state from Redis BEFORE we process new packet
      const prevStateRaw = await redis.get(`vehicle:state:${imei}`);
      let prevState = null;
      if (prevStateRaw) {
        try { prevState = JSON.parse(prevStateRaw); } catch(e) {}
      }

      // 3. Save packet to GPS history
      await GpsModel.savePoint({
        vehicleId, lat, lng, speed, direction, odometer, fuel, ignition,
        satellites, gsmSignal, battery, voltage, isLive, deviceTime
      });

      // 4. Update denormalized latest state table
      await GpsModel.updateLatestState({
        vehicleId, lat, lng, speed, direction, fuel, ignition, voltage,
        odometer, satellites, gsmSignal
      });

      // 5. Perform Alert Checks
      if (isLive) {
        const alertsToTrigger = [];

        // Check A: Vehicle Started (Ignition transitioned from OFF/undefined to ON)
        if (ignition === true && (!prevState || prevState.ignition === false)) {
          alertsToTrigger.push({
            type: 'ignition_on',
            text: 'Ignition ON Alert: Vehicle started.'
          });
        }

        // Check B: Trip Started (Transition from stopped/parked to moving)
        if (ignition === true && speed > 0 && (!prevState || prevState.speed === 0 || prevState.ignition === false)) {
          alertsToTrigger.push({
            type: 'trip_started',
            text: 'Trip Started Alert: Vehicle has begun moving.'
          });
        }

        // Check C: Vehicle Stoppage (Ignition transitioned from ON to OFF)
        if (ignition === false && prevState && prevState.ignition === true) {
          alertsToTrigger.push({
            type: 'stoppage',
            text: 'Vehicle Stoppage Alert: Vehicle has stopped and ignition turned OFF.'
          });
        }

        // Check D: Too Much Idle (Ignition ON, Speed 0)
        if (ignition === true && speed === 0) {
          const idleKey = `vehicle:idle_start:${vehicleId}`;
          const alertFiredKey = `vehicle:idle_alert_fired:${vehicleId}`;
          
          let idleStart = await redis.get(idleKey);
          if (!idleStart) {
            await redis.set(idleKey, Date.now());
          } else {
            const idleDurationMs = Date.now() - parseInt(idleStart);
            // Alert after 30 seconds of idling in development/test
            if (idleDurationMs > 30000) {
              const alreadyFired = await redis.get(alertFiredKey);
              if (!alreadyFired) {
                alertsToTrigger.push({
                  type: 'excessive_idle',
                  text: `Excessive Idle Alert: Vehicle is idling for more than 30 seconds.`
                });
                await redis.set(alertFiredKey, '1', 'EX', 300); // Lock for 5 mins
              }
            }
          }
        } else {
          // Clear idle states if vehicle is moving or turned off
          await redis.del(`vehicle:idle_start:${vehicleId}`);
          await redis.del(`vehicle:idle_alert_fired:${vehicleId}`);
        }

        // Check E: Geofence Checks
        try {
          const geofences = await GeofenceModel.findGeofencesForVehicle(vehicleId);
          for (const geofence of geofences) {
            let isInsideNow = false;
            
            if (geofence.type === 'circle') {
              const dist = getHaversineDistance(lat, lng, parseFloat(geofence.center_lat), parseFloat(geofence.center_lng));
              isInsideNow = dist <= parseFloat(geofence.radius);
            } else if (geofence.type === 'polygon' && Array.isArray(geofence.coordinates)) {
              isInsideNow = isPointInPolygon(lat, lng, geofence.coordinates);
            }

            const geoStateKey = `vehicle:geofence:${geofence.id}:${vehicleId}`;
            const wasInsideRaw = await redis.get(geoStateKey);
            const wasInside = wasInsideRaw === 'inside';

            if (isInsideNow && !wasInside) {
              alertsToTrigger.push({
                type: 'geofence',
                text: `Geofence In Alert: Entered geofence "${geofence.name}".`
              });
              await redis.set(geoStateKey, 'inside');
            } else if (!isInsideNow && wasInside) {
              alertsToTrigger.push({
                type: 'geofence',
                text: `Geofence Out Alert: Exited geofence "${geofence.name}".`
              });
              await redis.set(geoStateKey, 'outside');
            }
          }
        } catch (geoErr) {
          console.error('[SUBSCRIBER] Geofence calculation error:', geoErr.message);
        }

        // Check F: Route Deviation Checks - REMOVED PER USER REQUEST
        // try {
        //   const route = await RouteModel.findRouteForVehicle(vehicleId);
        //   if (route && Array.isArray(route.coordinates) && route.coordinates.length > 1) {
        //     const distance = getMinDistanceToRoute(lat, lng, route.coordinates);
        //     const tolerance = parseInt(route.tolerance) || 100;
        //
        //     if (distance > tolerance) {
        //       const deviationFiredKey = `vehicle:deviation_alert_fired:${vehicleId}`;
        //       const alreadyFired = await redis.get(deviationFiredKey);
        //       
        //       if (!alreadyFired) {
        //         alertsToTrigger.push({
        //           type: 'route_deviation',
        //           text: `Route Deviation Alert: Vehicle has deviated from route "${route.name}" by ${Math.round(distance)}m (tolerance: ${tolerance}m).`
        //         });
        //         await redis.set(deviationFiredKey, '1', 'EX', 120); // Limit to once every 2 minutes
        //       }
        //     }
        //   }
        // } catch (routeErr) {
        //   console.error('[SUBSCRIBER] Route deviation calculation error:', routeErr.message);
        // }

        // Publish all triggered alerts to Redis channel
        for (const triggered of alertsToTrigger) {
          const alertPayload = {
            imei,
            alertType: triggered.type,
            alertText: triggered.text,
            lat,
            lng,
            deviceTime: deviceTime || new Date().toISOString()
          };
          await redis.publish('alerts', JSON.stringify(alertPayload));
        }
      }

      // 6. Emit real-time events over socket.io (only for live packets)
      if (isLive) {
        const payload = {
          vehicleId, imei, name: vehicle.name, plate: vehicle.plate,
          lat, lng, speed, direction, fuel, ignition, voltage, odometer,
          satellites, gsmSignal, battery, deviceTime, isOnline: true
        };

        io.to(`vehicle:${vehicleId}`).emit('location:update', payload);
        io.to(`org:${orgId}`).emit('fleet:update', payload);
      }

      // Raw packets are now handled by the 'raw_logs' channel, preventing duplicates

    } catch (err) {
      console.error('[SUBSCRIBER] Error processing location packet:', err.message);
    }
  });
}

/**
 * Stop subscriber connection
 */
async function stop() {
  if (subscriber) {
    await subscriber.quit();
    subscriber = null;
  }
}

module.exports = { start, stop };
