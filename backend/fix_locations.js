const db = require('./config/db');

async function fixLocations() {
  try {
    console.log('Starting DB fix...');

    // Delete all invalid historical points
    const delRes = await db.query(`
      DELETE FROM gps_points 
      WHERE lat < 5 OR lat IS NULL OR lng < 5 OR lng IS NULL
    `);
    console.log(`[CLEANUP] Deleted ${delRes.rowCount} invalid historical points.`);

    // Force update all invalid latest states to Hyderabad office with slight random offsets
    const fixRes = await db.query(`
      UPDATE vehicle_latest_state 
      SET lat = 17.3411 + (random() * 0.02 - 0.01), 
          lng = 78.5317 + (random() * 0.02 - 0.01)
      WHERE lat < 5 OR lat IS NULL OR lng < 5 OR lng IS NULL
    `);
    
    console.log(`[FIXED] Force updated ${fixRes.rowCount} vehicles to the default office location.`);
    
  } catch (err) {
    console.error('Error fixing database:', err.message);
  } finally {
    db.pool.end();
  }
}

fixLocations();
