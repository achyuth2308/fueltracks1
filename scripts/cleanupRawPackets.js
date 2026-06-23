// ============================================================
// CLEANUP RAW PACKETS
// Runs via cron to delete raw_packets older than 7 days
// Run using: node scripts/cleanupRawPackets.js
// ============================================================

const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'fueltracks1',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
});

async function runCleanup() {
  console.log(`[CLEANUP] Starting cleanup for raw_packets table...`);
  
  let client;
  try {
    client = await pool.connect();
    
    // Delete rows older than 7 days
    const result = await client.query(`
      DELETE FROM raw_packets 
      WHERE received_at < NOW() - INTERVAL '7 days'
    `);
    
    console.log(`[CLEANUP] ✓ Successfully deleted ${result.rowCount} old raw packets.`);
  } catch (err) {
    console.error('[CLEANUP] Cleanup failed:', err.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

runCleanup();
