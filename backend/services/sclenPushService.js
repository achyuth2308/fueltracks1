// ============================================================
// SCLEN (Coromandel) CONTINUOUS PUSH SERVICE
// Automatically pushes live location data for all Sathyadeva
// vehicles to Coromandel's endpoint.
// ============================================================

const axios = require('axios');
const db = require('../config/db');
const { getAddress } = require('../utils/geocodeUtils');

const COROMANDEL_ENDPOINT = 'http://115.112.241.148:7003/api/GET_INFORMATION_BY_RTO';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatSclenDate(utcDate) {
  if (!utcDate) return null;
  const d = new Date(utcDate);
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(d.getTime() + istOffset);
  
  const day = String(ist.getUTCDate()).padStart(2, '0');
  const month = MONTHS[ist.getUTCMonth()];
  const year = ist.getUTCFullYear();
  
  const hh = String(ist.getUTCHours()).padStart(2, '0');
  const mm = String(ist.getUTCMinutes()).padStart(2, '0');
  const ss = String(ist.getUTCSeconds()).padStart(2, '0');
  
  return `${day} ${month} ${year} ${hh}:${mm}:${ss}`;
}

// In-memory cache for organization checks (to avoid DB hits on every single GPS packet)
const orgCache = new Map();

async function isSathyadevaVehicle(vehicleId, orgId) {
  if (orgCache.has(vehicleId)) {
    return orgCache.get(vehicleId);
  }

  try {
    // Check if the organization name or any of the vehicle's groups contain 'sathyadeva'
    const result = await db.query(
      `SELECT 1
       FROM vehicles v
       JOIN organizations o ON v.org_id = o.id
       LEFT JOIN vehicle_groups vg ON vg.vehicle_id = v.id
       LEFT JOIN groups g ON g.id = vg.group_id
       WHERE v.id = $1
         AND (o.name ILIKE '%sathyadeva%' OR g.name ILIKE '%sathyadeva%')
       LIMIT 1`,
      [vehicleId]
    );
    
    const isSathyadeva = result.rows.length > 0;
    
    // Cache the result for 5 minutes
    orgCache.set(vehicleId, isSathyadeva);
    setTimeout(() => {
      orgCache.delete(vehicleId);
    }, 5 * 60 * 1000);
    
    return isSathyadeva;
  } catch (err) {
    console.error('[SCLEN PUSH] Error checking vehicle org:', err.message);
    return false;
  }
}

/**
 * Dispatches live GPS data to Coromandel's endpoint.
 * Called automatically by locationSubscriber.js
 */
async function pushToCoromandel(vehicle, point) {
  try {
    // 1. Only push if it has valid coordinates
    if (!point.lat || !point.lng) return;

    // 2. Check if the vehicle belongs to Sathyadeva
    const isTargetOrg = await isSathyadevaVehicle(vehicle.id, vehicle.org_id);
    if (!isTargetOrg) return;

    // 3. Get Reverse Geocode Address
    const address = await getAddress(point.lat, point.lng);
    const regNo = vehicle.plate || vehicle.name;

    // 4. Construct Payload (combining identifiers and location data)
    const payload = {
      user_id: "srsl",
      vehicle_id: regNo,
      VEHICLES: [
        {
          VEHICLE_LOCATION: address || "UNKNOWN LOCATION",
          VEHICLE_GPS_DATETIME: formatSclenDate(point.deviceTime),
          VEHICLE_LAT: String(point.lat),
          VEHICLE_LONG: String(point.lng)
        }
      ]
    };

    // 5. Fire-and-forget push to Coromandel
    axios.post(COROMANDEL_ENDPOINT, payload, { timeout: 5000 })
      .then(response => {
        console.log(`[SCLEN PUSH] ✅ Successfully pushed location for ${regNo}`);
      })
      .catch(error => {
        console.error(`[SCLEN PUSH] ❌ Failed to push for ${regNo}:`, error.message);
      });

  } catch (err) {
    console.error('[SCLEN PUSH] Unexpected error:', err.message);
  }
}

module.exports = { pushToCoromandel };
