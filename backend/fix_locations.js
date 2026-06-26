const db = require('./config/db');

async function fixLocations() {
  try {
    console.log('Starting DB fix...');
    const res = await db.query(`SELECT vehicle_id FROM vehicle_latest_state WHERE lat = 0 AND lng = 0`);
    console.log('Vehicles currently at 0,0:', res.rows.length);
    
    for (const row of res.rows) {
      const vid = row.vehicle_id;
      // Get the last valid point for this vehicle
      const valid = await db.query(`
        SELECT lat, lng
        FROM gps_points 
        WHERE vehicle_id = $1 AND lat != 0 AND lng != 0
        ORDER BY device_time DESC LIMIT 1
      `, [vid]);
      
      if (valid.rows.length > 0) {
        const { lat, lng } = valid.rows[0];
        await db.query(`
          UPDATE vehicle_latest_state 
          SET lat = $1, lng = $2 
          WHERE vehicle_id = $3
        `, [lat, lng, vid]);
        console.log(`[OK] Restored vehicle ${vid} to last valid coordinates: ${lat}, ${lng}`);
      } else {
        console.log(`[WARN] No valid historical coordinates found for vehicle ${vid}`);
      }
    }

    // Delete all 0,0 points from gps history to keep data clean
    const delRes = await db.query(`DELETE FROM gps_points WHERE lat = 0 AND lng = 0`);
    console.log(`[CLEANUP] Deleted ${delRes.rowCount} invalid 0,0 points from historical data.`);

  } catch (err) {
    console.error('Error fixing database:', err.message);
  } finally {
    db.pool.end();
  }
}

fixLocations();
