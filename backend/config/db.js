// ============================================================
// POSTGRESQL CONNECTION POOL
// TWO isolated pools:
//   - API pool  (max 15): serves HTTP routes, auth, admin queries
//   - GPS pool  (max 10): serves the location subscriber ONLY
//                         so GPS writes NEVER starve login/API
// Total: 25 connections — safe headroom below Postgres max_connections=50
// ============================================================

const { Pool, types } = require('pg');
const env = require('./env');

// Parse PostgreSQL NUMERIC/DECIMAL column types (OID 1700) as floats in JavaScript
types.setTypeParser(1700, (val) => val === null ? null : parseFloat(val));

// Parse PostgreSQL TIMESTAMP WITHOUT TIME ZONE (OID 1114) as UTC
types.setTypeParser(1114, (val) => val === null ? null : new Date(val + 'Z'));

// ── API Pool (for HTTP routes, auth, admin) ────────────────────────────────
const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASS,
  max: 15,                          // Hard cap — never more than 15 for API
  idleTimeoutMillis: 30000,         // Release idle connections after 30s
  connectionTimeoutMillis: 3000,    // Fail fast (3s) — don't hold login hostage
});

pool.on('connect', () => {
  console.log('[DB] New API client connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected API pool error:', err.message);
});

// ── GPS Subscriber Pool (for location subscriber ONLY) ────────────────────
// Isolated so a GPS write backlog can never prevent logins.
const gpsPool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASS,
  max: 10,                          // 10 connections for GPS writes
  idleTimeoutMillis: 60000,         // GPS connections can stay longer
  connectionTimeoutMillis: 5000,    // GPS writes can wait up to 5s
});

gpsPool.on('connect', () => {
  console.log('[DB] New GPS subscriber client connected to PostgreSQL');
});

gpsPool.on('error', (err) => {
  console.error('[DB] Unexpected GPS pool error:', err.message);
});

/**
 * Execute a SQL query on the API pool (default)
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 500) {
      console.warn(`[DB] Slow query (${duration}ms): ${text.substring(0, 100)}`);
    }
    return result;
  } catch (err) {
    console.error(`[DB] Query error: ${err.message}`);
    console.error(`[DB] Query: ${text.substring(0, 200)}`);
    throw err;
  }
}

/**
 * Execute a SQL query on the GPS subscriber pool
 * Use this in locationSubscriber.js for all GPS writes
 */
async function gpsQuery(text, params) {
  const start = Date.now();
  try {
    const result = await gpsPool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 500) {
      console.warn(`[DB] Slow GPS query (${duration}ms): ${text.substring(0, 100)}`);
    }
    return result;
  } catch (err) {
    console.error(`[DB] GPS query error: ${err.message}`);
    console.error(`[DB] GPS query: ${text.substring(0, 200)}`);
    throw err;
  }
}

/**
 * Get a client from the API pool for transactions
 */
async function getClient() {
  return pool.connect();
}

module.exports = { query, gpsQuery, getClient, pool, gpsPool };
