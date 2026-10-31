// ============================================================
// FUEL EVENT AGGREGATOR
// Debounces multi-packet fuel refills into confirmed sessions
// and manages theft cooldown.
// Redis session key: refill:session:<vehicleId> (TTL 30 min)
// Redis theft cooldown: theft:cooldown:<vehicleId> (TTL 10 min)
// ============================================================

'use strict';

const { redis } = require('../config/redis');

const SESSION_TTL_SEC = 1800; // 30 minutes
const THEFT_COOLDOWN_SEC = 600; // 10 minutes

// Hot-path in-memory set to eliminate 99.9% of redundant Redis GETs
const activeSessionVehicles = new Set();

const FuelEventAggregator = {
  /**
   * Evaluates incoming live packet for finalized fuel refill.
   *
   * @param {Object} vehicle - Vehicle DB record
   * @param {number} currFuel - Current packet fuel liters
   * @param {number} prevFuel - Previous packet fuel liters
   * @param {number} speed - Current speed in km/h
   * @param {boolean} ignition - Current ignition state
   * @param {number} lat - Current latitude
   * @param {number} lng - Current longitude
   * @param {string|number|Date} deviceTime - Packet device time
   * @returns {Promise<Object|null>} Finalized refill alert data if finalized, else null
   */
  async processRefillPacket(vehicle, currFuel, prevFuel, speed, ignition, lat, lng, deviceTime) {
    if (!vehicle || currFuel == null || isNaN(currFuel) || prevFuel == null || isNaN(prevFuel)) {
      return null;
    }

    // Ignore sensor disconnect / zero-reading glitches
    if (currFuel <= 0) {
      return null;
    }

    const vehicleId = vehicle.id;
    const capacity = parseFloat(vehicle.metadata?.tankSize) || 100;
    const fuelCfg = vehicle.metadata?.fuelConfig || {};

    const configuredMinFilling = parseFloat(fuelCfg.minFilling);
    const refillThreshold = (!isNaN(configuredMinFilling) && configuredMinFilling > 0)
      ? configuredMinFilling
      : Math.max(5, Math.min(30, capacity * 0.05));

    // Refill session start threshold: small initial rise (e.g. 2L or 30% of threshold)
    const startDelta = Math.max(1.5, Math.min(3, refillThreshold * 0.3));
    // Settle tolerance: change < ~1% of tank capacity
    const settleTolerance = Math.max(0.8, capacity * 0.01);
    // Settle duration: default 5 minutes
    const settleMinutes = parseFloat(fuelCfg.refillSettleMinutes) || 5;

    const isStationary = speed <= 5 || ignition === false;
    const rise = currFuel - prevFuel;
    // Hot-path bypass: if not in an active session and not starting one, skip Redis entirely
    if (!activeSessionVehicles.has(vehicleId) && (!isStationary || rise < startDelta)) {
      return null;
    }
    const sessionKey = `refill:session:${vehicleId}`;

    try {
      const existingSessionStr = await redis.get(sessionKey);
      let session = existingSessionStr ? JSON.parse(existingSessionStr) : null;
      const nowTs = new Date(deviceTime || Date.now()).getTime();

      // Case 1: No active refill session yet
      if (!session) {
        const rise = currFuel - prevFuel;
        if (isStationary && rise >= startDelta) {
          session = {
            vehicleId,
            imei: vehicle.imei,
            startLevel: Math.round(prevFuel * 10) / 10,
            currentLevel: Math.round(currFuel * 10) / 10,
            peakLevel: Math.round(currFuel * 10) / 10,
            startTime: deviceTime,
            lastChangeTime: nowTs,
            lat,
            lng
          };
          await redis.set(sessionKey, JSON.stringify(session), 'EX', SESSION_TTL_SEC); activeSessionVehicles.add(vehicleId);
        }
        return null;
      }

      // Guard: Ignore out-of-order packets older than current session change time
      if (nowTs < session.lastChangeTime) {
        return null;
      }

      // Guard: Clock jump forward > 24 hours -> discard stale session
      const elapsedMinutes = (nowTs - session.lastChangeTime) / (1000 * 60);
      if (elapsedMinutes > 1440) {
        await redis.del(sessionKey); activeSessionVehicles.delete(vehicleId);
        return null;
      }

      // Guard: Sensor spike detection
      // If current fuel dropped back down to near startLevel, it was a momentary sensor spike
      if (currFuel <= session.startLevel + settleTolerance) {
        await redis.del(sessionKey); activeSessionVehicles.delete(vehicleId);
        return null;
      }

      // Case 2: Active refill session exists
      const isMovingNow = speed > 5;
      const riseSincePeak = currFuel - session.peakLevel;

      if (riseSincePeak > settleTolerance) {
        // Still adding fuel -> update peak and lastChangeTime
        session.peakLevel = Math.round(currFuel * 10) / 10;
        session.currentLevel = Math.round(currFuel * 10) / 10;
        session.lastChangeTime = nowTs;
        if (lat && lng) {
          session.lat = lat;
          session.lng = lng;
        }
        await redis.set(sessionKey, JSON.stringify(session), 'EX', SESSION_TTL_SEC); activeSessionVehicles.add(vehicleId);
        return null;
      }

      // Check whether session should finalize:
      // Condition A: Vehicle started moving (refill completed and drive off)
      // Condition B: Fuel level has been stable for settleMinutes
      const isSettled = elapsedMinutes >= settleMinutes;

      if (isMovingNow || isSettled) {
        // Delete session from Redis
        await redis.del(sessionKey); activeSessionVehicles.delete(vehicleId);

        // Effective added litres must reflect actual maintained fuel level, not transient peaks
        const confirmedLevel = Math.min(session.peakLevel, Math.round(currFuel * 10) / 10);
        const totalAdded = Math.round((confirmedLevel - session.startLevel) * 10) / 10;

        // If total added meets threshold, publish ONE finalized alert
        if (totalAdded >= refillThreshold) {
          const finalAlert = {
            imei: vehicle.imei,
            alertType: 'fuel_refill_final',
            alertText: `Fuel refill confirmed for ${vehicle.plate || vehicle.name}: added ${totalAdded}L (${session.startLevel}L to ${confirmedLevel}L).`,
            lat: session.lat || lat,
            lng: session.lng || lng,
            deviceTime: deviceTime,
            alertPayload: {
              startLevel: session.startLevel,
              endLevel: confirmedLevel,
              addedLitres: totalAdded,
              startTime: session.startTime,
              endTime: deviceTime,
              reason: isMovingNow ? 'vehicle_moved' : 'settle_timeout'
            }
          };

          await redis.publish('alerts', JSON.stringify(finalAlert));
          console.log(`[FUEL-AGGREGATOR] Published finalized refill for ${vehicle.plate || vehicle.imei}: +${totalAdded}L`);
          return finalAlert;
        }
      } else {
        // Stable but not yet reached settle duration; update currentLevel and keep session alive
        session.currentLevel = Math.round(currFuel * 10) / 10;
        await redis.set(sessionKey, JSON.stringify(session), 'EX', SESSION_TTL_SEC); activeSessionVehicles.add(vehicleId);
      }
    } catch (err) {
      console.warn('[FUEL-AGGREGATOR] Refill aggregation warning:', err.message);
    }

    return null;
  },

  /**
   * Check whether theft alert should be rate-limited for WhatsApp dispatch
   */
  async acquireTheftCooldown(vehicleId) {
    try {
      const key = `theft:cooldown:${vehicleId}`;
      const res = await redis.set(key, '1', 'EX', THEFT_COOLDOWN_SEC, 'NX');
      return res === 'OK'; // true if first alert in 10 mins, false if cooling down
    } catch (err) {
      return true; // fail-open
    }
  }
};

module.exports = FuelEventAggregator;

