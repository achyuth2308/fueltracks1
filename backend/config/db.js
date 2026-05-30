// ============================================================
// POSTGRESQL CONNECTION POOL
// Max 20 connections, fast fail on unreachable
// ============================================================

const { Pool, types } = require('pg');
const env = require('./env');

// Parse PostgreSQL NUMERIC/DECIMAL column types (OID 1700) as floats in JavaScript
types.setTypeParser(1700, (val) => val === null ? null : parseFloat(val));

const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASS,
  max: 20,                        // Max 20 connections
  idleTimeoutMillis: 30000,       // Close idle connections after 30s
  connectionTimeoutMillis: 5000,  // Fail fast if DB unreachable
});

pool.on('connect', () => {
  console.log('[DB] New client connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

/**
 * Execute a SQL query
 * @param {string} text - SQL query string with $1, $2 placeholders
 * @param {Array} params - Query parameters
 * @returns {object} Query result
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
 * Get a client for transactions
 */
async function getClient() {
  return pool.connect();
}

module.exports = { query, getClient, pool };
