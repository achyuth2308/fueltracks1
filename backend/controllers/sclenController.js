const db = require('../config/db');
const { getAddress } = require('../utils/geocodeUtils');

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

async function getInformationByRTO(req, res, next) {
  try {
    const { user_id, vehicle_id } = req.body || {};
    
    if (!vehicle_id) {
      return res.status(200).json({ VEHICLES: [] });
    }
    
    const regNo = vehicle_id.trim().toUpperCase();
    
    // Find vehicle and its latest location
    // SCLEN only tracks Coromandel/Sathyadeva vehicles, but this allows lookup by exact plate
    const result = await db.query(
      `SELECT
         v.id,
         v.plate,
         vls.lat,
         vls.lng,
         vls.last_seen AS device_time
       FROM vehicles v
       JOIN vehicle_latest_state vls ON vls.vehicle_id = v.id
       WHERE UPPER(v.plate) = $1 OR UPPER(v.name) = $1
       LIMIT 1`,
      [regNo]
    );
    
    if (result.rows.length === 0) {
      return res.status(200).json({ VEHICLES: [] });
    }
    
    const row = result.rows[0];
    
    // Reverse geocode
    let address = "UNKNOWN LOCATION";
    if (row.lat && row.lng) {
      try {
        address = await getAddress(row.lat, row.lng);
      } catch (err) {
        console.warn(`[SCLEN API] Reverse geocode failed for ${regNo}:`, err.message);
      }
    }
    
    const responseData = {
      VEHICLES: [
        {
          VEHICLE_LOCATION: address || "UNKNOWN LOCATION",
          VEHICLE_GPS_DATETIME: formatSclenDate(row.device_time),
          VEHICLE_LAT: String(row.lat),
          VEHICLE_LONG: String(row.lng)
        }
      ]
    };
    
    return res.status(200).json(responseData);
    
  } catch (err) {
    console.error('[SCLEN API] Error:', err);
    return res.status(500).json({ VEHICLES: [] });
  }
}

module.exports = { getInformationByRTO };
