const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const GpsModel = require('./models/gpsModel');

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'fueltracks',
});

// Override gpsQuery for this script
GpsModel.gpsQuery = async (queryText, params) => {
  return await pool.query(queryText, params);
};

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function debugDistances() {
  const client = await pool.connect();
  // We need to pass the client to gpsQuery because gpsModel relies on a global db.query 
  // but we can just monkey-patch it for testing
  const db = { query: client.query.bind(client) };
  
  // The vehicle in question
  const vehicleId = 22; // AP39TV6379 - let's fetch ID from db just to be sure
  const { rows: vRows } = await client.query(`SELECT id FROM vehicles WHERE name = 'AP39TV6379' LIMIT 1`);
  const vId = vRows[0].id;

  // 1. Simulate History Page API call
  // What does getTodayRange() return?
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  
  console.log(`History API Start: ${start.toISOString()}`);
  console.log(`History API End: ${end.toISOString()}`);

  const paramsHistory = [vId, start.toISOString(), end.toISOString()];
  const historyQuery = `
       SELECT id, lat, lng, speed, direction, odometer, fuel, ignition,
              satellites, gsm_signal, battery, voltage, is_live, device_time, server_time
       FROM gps_points
       WHERE vehicle_id = $1 AND device_time >= $2 AND device_time <= $3
       ORDER BY device_time DESC
  `;
  const resHistory = await client.query(historyQuery, paramsHistory);
  let historyPoints = resHistory.rows.reverse(); // Order ASC
  
  // Apply History Filter
  historyPoints = historyPoints.filter(p => {
    const lat = parseFloat(p.lat);
    const lng = parseFloat(p.lng);
    return !isNaN(lat) && !isNaN(lng) && lat > 6.5 && lat < 37.5 && lng > 68.0 && lng < 98.0;
  });

  const driftFiltered = [];
  let lastValid = null;
  for (const p of historyPoints) {
    if (!lastValid) {
      driftFiltered.push(p);
      lastValid = p;
      continue;
    }
    const isMoving = parseFloat(p.speed) > 3 || p.ignition;
    const wasMoving = parseFloat(lastValid.speed) > 3 || lastValid.ignition;
    if (isMoving || wasMoving) {
      driftFiltered.push(p);
      lastValid = p;
    }
  }

  let historyTotalKm = 0;
  for (let i = 1; i < driftFiltered.length; i++) {
    const p1 = driftFiltered[i - 1];
    const p2 = driftFiltered[i];
    const segDist = calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng);
    if (segDist > 0.01 && segDist < 5) {
      historyTotalKm += segDist;
    }
  }

  console.log(`[FRONTEND HISTORY PAGE] Calculated Distance: ${historyTotalKm.toFixed(3)} km. Total Points fetched: ${resHistory.rowCount}`);
  if (resHistory.rowCount > 0) {
    console.log(`   First Point Time: ${resHistory.rows[resHistory.rows.length - 1].device_time.toISOString()}`);
    console.log(`   Last Point Time:  ${resHistory.rows[0].device_time.toISOString()}`);
  }

  // 2. Simulate Backend background task (getTodayDistanceFromHistory)
  const backendQuery = `
       SELECT lat, lng, speed, ignition, device_time
       FROM gps_points
       WHERE vehicle_id = $1
         AND device_time >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date
         AND lat IS NOT NULL AND lng IS NOT NULL
         AND lat != 0 AND lng != 0
         AND lat > 6.5 AND lat < 37.5
         AND lng > 68.0 AND lng < 98.0
       ORDER BY device_time ASC
  `;
  const resBackend = await client.query(backendQuery, [vId]);
  
  const driftFilteredBackend = [];
  let lastValidB = null;
  for (const p of resBackend.rows) {
    if (!lastValidB) {
      driftFilteredBackend.push(p);
      lastValidB = p;
      continue;
    }
    const isMoving = parseFloat(p.speed) > 3 || p.ignition;
    const wasMoving = parseFloat(lastValidB.speed) > 3 || lastValidB.ignition;
    if (isMoving || wasMoving) {
      driftFilteredBackend.push(p);
      lastValidB = p;
    }
  }

  let backendTotalKm = 0;
  for (let i = 1; i < driftFilteredBackend.length; i++) {
    const p1 = driftFilteredBackend[i - 1];
    const p2 = driftFilteredBackend[i];
    const segDist = calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng);
    if (segDist > 0.01 && segDist < 5) {
      backendTotalKm += segDist;
    }
  }

  console.log(`[BACKEND DASHBOARD TASK] Calculated Distance: ${backendTotalKm.toFixed(3)} km. Total Points fetched: ${resBackend.rowCount}`);
  if (resBackend.rowCount > 0) {
    console.log(`   First Point Time: ${resBackend.rows[0].device_time.toISOString()}`);
    console.log(`   Last Point Time:  ${resBackend.rows[resBackend.rows.length - 1].device_time.toISOString()}`);
  }

  client.release();
  pool.end();
}

debugDistances();
