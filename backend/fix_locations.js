const db = require('./config/db');

async function fixLocations() {
  try {
    console.log('Starting DB fix...');
    const res = await db.query(`SELECT vehicle_id FROM vehicle_latest_state WHERE (lat = 0 OR lat IS NULL) AND (lng = 0 OR lng IS NULL)`);
    console.log('Vehicles currently at 0,0 or null:', res.rows.length);
    
    for (const row of res.rows) {
      const vid = row.vehicle_id;
      // Get the last valid point for this vehicle
      const valid = await db.query(`
        SELECT lat, lng
        FROM gps_points 
        WHERE vehicle_id = $1 AND lat != 0 AND lat IS NOT NULL AND lng != 0 AND lng IS NOT NULL
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
        // Fallback to default FuelTracks office location in Hyderabad
        const defaultLat = 17.3411;
        const defaultLng = 78.5317;
        await db.query(`
          UPDATE vehicle_latest_state 
          SET lat = $1, lng = $2 
          WHERE vehicle_id = $3
        `, [defaultLat, defaultLng, vid]);
        console.log(`[FIXED] Vehicle ${vid} had no history. Set to default office location.`);
      }
    }

    // Delete all 0,0 points from gps history to keep data clean
    const delRes = await db.query(`DELETE FROM gps_points WHERE (lat = 0 OR lat IS NULL) AND (lng = 0 OR lng IS NULL)`);
    console.log(`[CLEANUP] Deleted ${delRes.rowCount} invalid 0,0 points from historical data.`);

  } catch (err) {
    console.error('Error fixing database:', err.message);
  } finally {
    db.pool.end();
  }
}

fixLocations();
