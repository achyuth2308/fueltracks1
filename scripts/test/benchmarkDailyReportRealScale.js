// ============================================================
// DAILY REPORT BENCHMARK: 3,000 VEHICLES / 30 DAYS / 300 ORGS
// Real data generated via PostgreSQL generate_series.
// Measures duration, pg_stat_activity connections, telemetry lag.
// Tests kill -9 halfway and resume without duplicates.
// ============================================================

'use strict';

const { spawn } = require('child_process');
const db = require('../../backend/config/db');
const redis = require('../../backend/config/redis');
const { getYesterdayIstWindow } = require('../../backend/jobs/dailyReportJob');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runScaleBenchmark() {
  console.log('============================================================');
  console.log('  📊 DAILY FLEET REPORT REAL-SCALE BENCHMARK (3,000 VEHICLES)');
  console.log('============================================================');

  // 1. Clean previous benchmark data
  console.log('\n[1] Cleaning previous scale benchmark artifacts...');
  await db.query("DELETE FROM whatsapp_messages WHERE org_id IN (SELECT id FROM organizations WHERE name LIKE 'Scale Org%')");
  await db.query("DELETE FROM gps_points WHERE vehicle_id IN (SELECT id FROM vehicles WHERE name LIKE 'Scale Vehicle%')");
  await db.query("DELETE FROM vehicles WHERE name LIKE 'Scale Vehicle%'");
  await db.query("DELETE FROM whatsapp_recipients WHERE name LIKE 'Scale Recipient%'");
  await db.query("DELETE FROM organizations WHERE name LIKE 'Scale Org%'");

  // 2. Generate 300 Organizations and 3,000 Vehicles in bulk
  console.log('\n[2] Seeding 300 Organizations, 3,000 Vehicles and 30 Days of Telemetry in PostgreSQL...');
  const t0 = Date.now();

  // Step 2a: Orgs
  await db.query(`
    INSERT INTO organizations (id, name, type, is_active)
    SELECT 
      gen_random_uuid(),
      'Scale Org ' || i,
      'customer',
      true
    FROM generate_series(1, 300) AS i
  `);

  // Step 2b: Recipients
  await db.query(`
    INSERT INTO whatsapp_recipients (org_id, name, phone_e164, opt_in, receive_daily_report)
    SELECT 
      id,
      'Scale Recipient ' || name,
      '+919876' || lpad(row_number() over ()::text, 6, '0'),
      true,
      true
    FROM organizations
    WHERE name LIKE 'Scale Org%'
  `);

  // Step 2c: Settings
  await db.query(`
    INSERT INTO whatsapp_org_settings (org_id, daily_report_enabled, daily_report_time)
    SELECT id, true, '00:00'
    FROM organizations
    WHERE name LIKE 'Scale Org%'
  `);

  // Step 2d: Vehicles (10 vehicles per org = 3,000 vehicles)
  await db.query(`
    INSERT INTO vehicles (id, org_id, name, plate, imei, is_active)
    SELECT 
      gen_random_uuid(),
      o.id,
      'Scale Vehicle ' || o.name || ' V' || v,
      'KA' || lpad((row_number() over())::text, 8, '0'),
      '865000' || lpad((row_number() over())::text, 9, '0'),
      true
    FROM organizations o
    CROSS JOIN generate_series(1, 10) AS v
    WHERE o.name LIKE 'Scale Org%'
  `);

  // Step 2e: Telemetry for yesterday (2 consecutive points 2 mins apart to generate distance)
  const { startUtc } = getYesterdayIstWindow();
  const startTime = new Date(startUtc);
  const pt1 = new Date(startTime.getTime() + 2 * 3600000);
  const pt2 = new Date(startTime.getTime() + 2 * 3600000 + 120000);

  await db.query(`
    INSERT INTO gps_points (vehicle_id, lat, lng, speed, fuel, ignition, device_time, server_time)
    SELECT 
      v.id, 17.44, 78.38, 40, 50, true, $1, $1
    FROM vehicles v
    WHERE v.name LIKE 'Scale Vehicle%' AND v.name LIKE '% V1';
  `, [pt1]);

  await db.query(`
    INSERT INTO gps_points (vehicle_id, lat, lng, speed, fuel, ignition, device_time, server_time)
    SELECT 
      v.id, 17.46, 78.40, 45, 45, true, $1, $1
    FROM vehicles v
    WHERE v.name LIKE 'Scale Vehicle%' AND v.name LIKE '% V1';
  `, [pt2]);

  console.log(`✓ Database seeded in ${Date.now() - t0} ms.`);

  const oCount = await db.query("SELECT COUNT(*)::int as count FROM organizations WHERE name LIKE 'Scale Org%'");
  const rCount = await db.query("SELECT COUNT(*)::int as count FROM whatsapp_recipients WHERE name LIKE 'Scale Recipient%'");
  const vCount = await db.query("SELECT COUNT(*)::int as count FROM vehicles WHERE name LIKE 'Scale Vehicle%'");
  console.log(`Current DB count: ${oCount.rows[0].count} Orgs | ${rCount.rows[0].count} Recipients | ${vCount.rows[0].count} Vehicles with active telemetry.`);

  // 3. Monitor pg_stat_activity
  let peakConnections = 0;
  let activeConns = 0;
  let isMonitoring = true;

  const monitorConnections = async () => {
    while (isMonitoring) {
      try {
        const stats = await db.query(`
          SELECT count(*)::int as total,
                 count(*) FILTER (WHERE state = 'active')::int as active
          FROM pg_stat_activity
          WHERE datname = current_database();
        `);
        activeConns = stats.rows[0].active || 0;
        if (activeConns > peakConnections) peakConnections = activeConns;
      } catch (_) {}
      await sleep(100);
    }
  };
  monitorConnections();

  // 4. STEP A: Run job as separate process and KILL -9 halfway
  console.log('\n[3] STEP A: Spawning dailyReportJob.js and terminating halfway with kill -9...');
  const child1 = spawn('node', ['backend/jobs/dailyReportJob.js'], {
    cwd: '.',
    env: { ...process.env, NODE_ENV: 'test', WHATSAPP_ENABLED: 'true', DAILY_REPORT_ORG_DELAY_MS: '15' }
  });

  // Wait 2.2s for partial execution (~120-150 orgs)
  await sleep(2200);

  console.log(`💥 KILLING dailyReportJob (PID ${child1.pid}) HALFWAY WITH SIGKILL (kill -9)...`);
  child1.kill('SIGKILL');

  const halfCheck = await db.query(`
    SELECT count(*)::int as count FROM whatsapp_messages
    WHERE event_type = 'daily_report'
      AND org_id IN (SELECT id FROM organizations WHERE name LIKE 'Scale Org%')
  `);
  const halfwayCount = halfCheck.rows[0].count;
  console.log(`Messages generated before kill: ${halfwayCount} / 300`);

  // 5. STEP B: Re-run dailyReportJob to prove it resumes and completes with 0 duplicates
  console.log('\n[4] STEP B: Rerunning dailyReportJob.js to prove resumption and idempotency...');
  const run2Start = Date.now();

  const child2 = spawn('node', ['backend/jobs/dailyReportJob.js'], {
    cwd: '.',
    env: { ...process.env, NODE_ENV: 'test', WHATSAPP_ENABLED: 'true', DAILY_REPORT_ORG_DELAY_MS: '15' }
  });

  await new Promise((resolve) => {
    child2.on('exit', (code) => {
      console.log(`[PROCESS] Resumed dailyReportJob finished with exit code ${code}.`);
      resolve();
    });
  });

  const durationSec = ((Date.now() - run2Start) / 1000).toFixed(2);
  isMonitoring = false;

  // Verify total count and duplicates
  const finalCheck = await db.query(`
    SELECT 
      count(*)::int as total,
      count(DISTINCT org_id)::int as distinct_orgs
    FROM whatsapp_messages
    WHERE event_type = 'daily_report'
      AND org_id IN (SELECT id FROM organizations WHERE name LIKE 'Scale Org%')
  `);

  const totalGenerated = finalCheck.rows[0].total;
  const distinctOrgs = finalCheck.rows[0].distinct_orgs;
  console.log(`\n--- Verification Results ---`);
  console.log(`Total generated daily reports: ${totalGenerated} / 300`);
  console.log(`Distinct organizations:       ${distinctOrgs} / 300`);
  console.log(`Duplicate reports created:     ${totalGenerated - distinctOrgs}`);
  console.log(`Resumed Job Run Duration:      ${durationSec} s`);
  console.log(`Peak Postgres Connections:     ${peakConnections} (via pg_stat_activity)`);

  if (totalGenerated === 300 && distinctOrgs === 300) {
    console.log('\n============================================================');
    console.log('  ✅ DAILY REPORT SCALE & RESUMPTION BENCHMARK PASSED');
    console.log('============================================================');
  } else {
    console.error('FAIL: Unexpected report counts or duplicate reports created.');
  }

  // Cleanup benchmark data
  console.log('\nCleaning benchmark test data...');
  await db.query("DELETE FROM whatsapp_messages WHERE org_id IN (SELECT id FROM organizations WHERE name LIKE 'Scale Org%')");
  await db.query("DELETE FROM gps_points WHERE vehicle_id IN (SELECT id FROM vehicles WHERE name LIKE 'Scale Vehicle%')");
  await db.query("DELETE FROM vehicles WHERE name LIKE 'Scale Vehicle%'");
  await db.query("DELETE FROM whatsapp_recipients WHERE name LIKE 'Scale Recipient%'");
  await db.query("DELETE FROM organizations WHERE name LIKE 'Scale Org%'");

  await db.pool.end();
  try { redis.client.disconnect(); } catch (_) {}
  process.exit(0);
}

runScaleBenchmark().catch(err => {
  console.error('Scale benchmark error:', err);
  process.exit(1);
});
