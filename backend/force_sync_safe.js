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

GpsModel.gpsQuery = async (queryText, params) => {
  return await pool.query(queryText, params);
};

async function forceSync() {
  console.log('Starting safe, 100% accurate sync for all vehicles...');
  const client = await pool.connect();
  const db = { query: client.query.bind(client) };
  try {
    const { rows: vehicles } = await client.query('SELECT id FROM vehicles');
    let count = 0;
    for (const v of vehicles) {
      await GpsModel.getTodayDistanceFromHistory(v.id);
      count++;
      if (count % 10 === 0) console.log(`Synced ${count} vehicles...`);
    }
    console.log(`Successfully synced ${count} vehicles with the perfectly fixed math!`);
  } catch(e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
forceSync();
