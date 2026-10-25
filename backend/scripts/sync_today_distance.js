'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../config/db');
const GpsModel = require('../models/gpsModel');

async function syncAll() {
  console.log('[SYNC] Starting today distance recalculation for active vehicles...');
  const res = await db.query(`
    SELECT v.id, v.name, v.imei, vls.today_distance as old_dist
    FROM vehicles v
    JOIN vehicle_latest_state vls ON v.id = vls.vehicle_id
    WHERE v.is_active = TRUE
      AND vls.last_seen >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date
    ORDER BY vls.last_seen DESC
  `);

  console.log(`[SYNC] Found ${res.rows.length} active vehicles today.`);
  let updated = 0;
  for (const v of res.rows) {
    try {
      const newDist = await GpsModel.getTodayDistanceFromHistory(v.id);
      if (Math.abs((parseFloat(v.old_dist) || 0) - newDist) > 0.05) {
        console.log(`[SYNC] Vehicle ${v.name} (${v.imei}): ${v.old_dist ?? 0} km -> ${newDist} km`);
        updated++;
      }
    } catch (e) {
      console.error(`[SYNC] Failed for ${v.name}:`, e.message);
    }
  }
  console.log(`[SYNC] Completed! Updated ${updated} vehicles with corrected distance.`);
  process.exit(0);
}

syncAll().catch(err => {
  console.error('[SYNC] Fatal error:', err);
  process.exit(1);
});
