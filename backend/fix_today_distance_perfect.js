const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'fueltracks',
});

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; // Distance in km
}

async function fixDistancesPerfectly() {
  console.log('Starting perfect JS-based recalculation to match History Page exactly...');
  const client = await pool.connect();
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const startStr = startOfDay.toISOString();

    const { rows: vehicles } = await client.query(`SELECT id FROM vehicles`);
    let updatedCount = 0;

    for (const v of vehicles) {
      const { rows: points } = await client.query(`
        SELECT lat, lng, speed, ignition, device_time
        FROM gps_points 
        WHERE vehicle_id = $1 
          AND device_time >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date
          AND lat > 6.5 AND lat < 37.5 AND lng > 68.0 AND lng < 98.0
        ORDER BY device_time ASC
      `, [v.id]);

      if (points.length === 0) continue;

      const driftFiltered = [];
      let lastValid = null;

      for (const p of points) {
        p.speed = parseFloat(p.speed) || 0;
        p.lat = parseFloat(p.lat);
        p.lng = parseFloat(p.lng);

        if (!lastValid) {
          driftFiltered.push(p);
          lastValid = p;
          continue;
        }
        
        const isMoving = p.speed > 3 || p.ignition;
        const wasMoving = lastValid.speed > 3 || lastValid.ignition;

        if (isMoving || wasMoving) {
          driftFiltered.push(p);
          lastValid = p;
        }
      }

      let cumulativeDist = 0;
      for (let i = 1; i < driftFiltered.length; i++) {
        const p1 = driftFiltered[i - 1];
        const p2 = driftFiltered[i];
        const segDist = calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng);
        if (segDist > 0.01 && segDist < 5) {
          cumulativeDist += segDist;
        }
      }

      const totalDist = parseFloat(cumulativeDist.toFixed(3));

      await client.query(`
        UPDATE vehicle_latest_state 
        SET today_distance = $1 
        WHERE vehicle_id = $2
      `, [totalDist, v.id]);
      
      updatedCount++;
    }

    console.log(`Successfully perfectly synced ${updatedCount} vehicles with History Page logic!`);
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

fixDistancesPerfectly();
