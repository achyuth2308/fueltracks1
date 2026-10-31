const { spawnSync } = require('child_process');
const db = require('../../backend/config/db');
const { getYesterdayIstWindow } = require('../../backend/jobs/dailyReportJob');

async function testSingle() {
  const { startUtc } = getYesterdayIstWindow();
  const startTime = new Date(startUtc);

  await db.query(`
    INSERT INTO organizations (id, name, type, is_active)
    VALUES ('e0000000-0000-0000-0000-000000000001', 'Scale Single Org', 'customer', true)
    ON CONFLICT (id) DO UPDATE SET is_active = true, type = 'customer'
  `);
  await db.query(`
    INSERT INTO whatsapp_recipients (org_id, name, phone_e164, opt_in, receive_daily_report)
    VALUES ('e0000000-0000-0000-0000-000000000001', 'Scale Single Recip', '+919999999991', true, true)
    ON CONFLICT (org_id, phone_e164) DO UPDATE SET opt_in = true, receive_daily_report = true
  `);
  await db.query(`
    INSERT INTO whatsapp_org_settings (org_id, daily_report_enabled, daily_report_time)
    VALUES ('e0000000-0000-0000-0000-000000000001', true, '00:00')
    ON CONFLICT (org_id) DO UPDATE SET daily_report_time = '00:00', daily_report_enabled = true
  `);
  await db.query(`
    INSERT INTO vehicles (id, org_id, name, plate, imei, is_active)
    VALUES ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Test Veh', 'KA01AA1111', '865000999999991', true)
    ON CONFLICT (id) DO UPDATE SET is_active = true
  `);

  // Two points in yesterday's window
  const pt1 = new Date(startTime.getTime() + 2 * 3600000);
  const pt2 = new Date(startTime.getTime() + 3 * 3600000);

  await db.query(`
    INSERT INTO gps_points (vehicle_id, lat, lng, speed, fuel, ignition, device_time, server_time)
    VALUES 
      ('f0000000-0000-0000-0000-000000000001', 17.44, 78.38, 40, 50, true, $1, $1),
      ('f0000000-0000-0000-0000-000000000001', 17.46, 78.40, 45, 45, true, $2, $2)
  `, [pt1, pt2]);

  console.log('Seeded active vehicle and points in yesterday window. Running dailyReportJob.js:');
  const res = spawnSync('node', ['backend/jobs/dailyReportJob.js'], {
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'test', WHATSAPP_ENABLED: 'true' }
  });
  console.log('STDOUT:\n', res.stdout);
  console.log('STDERR:\n', res.stderr);

  const check = await db.query("SELECT * FROM whatsapp_messages WHERE org_id = 'e0000000-0000-0000-0000-000000000001'");
  console.log('Messages created count:', check.rows.length);

  await db.query("DELETE FROM whatsapp_messages WHERE org_id = 'e0000000-0000-0000-0000-000000000001'");
  await db.query("DELETE FROM gps_points WHERE vehicle_id = 'f0000000-0000-0000-0000-000000000001'");
  await db.query("DELETE FROM vehicles WHERE id = 'f0000000-0000-0000-0000-000000000001'");
  await db.query("DELETE FROM whatsapp_recipients WHERE org_id = 'e0000000-0000-0000-0000-000000000001'");
  await db.query("DELETE FROM organizations WHERE id = 'e0000000-0000-0000-0000-000000000001'");
  await db.pool.end();
}

testSingle().catch(console.error);
