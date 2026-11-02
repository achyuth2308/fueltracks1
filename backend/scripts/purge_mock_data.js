const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { pool } = require('../config/db');

async function purgeAllMockData() {
  const client = await pool.connect();
  try {
    console.log('[PURGE] Starting local database mock data purge...');
    await client.query('BEGIN');

    // 1. Delete telemetry & logs
    console.log('[PURGE] Clearing gps_points, raw_packets, trips...');
    await client.query('TRUNCATE TABLE gps_points, raw_packets, trips CASCADE');

    console.log('[PURGE] Clearing alerts & whatsapp_messages...');
    await client.query('TRUNCATE TABLE alerts, whatsapp_messages CASCADE');

    // 2. Delete vehicle states, groups, geofences, routes, vehicles
    console.log('[PURGE] Clearing vehicle latest state, routes, geofences, groups, vehicles...');
    await client.query('TRUNCATE TABLE vehicle_latest_state, vehicle_groups, vehicle_geofences, vehicle_routes, mining_registrations CASCADE');
    await client.query('DELETE FROM vehicles');

    // 3. Delete devices & device inventory
    console.log('[PURGE] Clearing devices & device_inventory...');
    await client.query('DELETE FROM devices');
    await client.query('TRUNCATE TABLE device_inventory CASCADE');

    // 4. Delete document scans & scan fields
    console.log('[PURGE] Clearing document_scans & document_scan_fields...');
    await client.query('TRUNCATE TABLE document_scans, document_scan_fields CASCADE');

    // 5. Delete audit logs & renewal transactions
    console.log('[PURGE] Clearing audit_logs & renewal_transactions...');
    await client.query('TRUNCATE TABLE audit_logs, renewal_transactions CASCADE');

    // 6. Delete test test orgs if any (keep FuelTracks Platform and madhu's org)
    console.log('[PURGE] Cleaning test organizations...');
    await client.query(`
      DELETE FROM organizations 
      WHERE name IN ('Zombie Test Org', 'Prune Test Org', 'LoadTest Fleet Corp')
    `);

    await client.query('COMMIT');
    console.log('[PURGE] Successfully committed mock data purge!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[PURGE] Error during purge, rolled back:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

purgeAllMockData().catch(err => {
  console.error(err);
  process.exit(1);
});

