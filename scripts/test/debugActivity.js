const db = require('../../backend/config/db');
const reportRepository = require('../../backend/modules/reports/repositories/reportRepository');
const { getYesterdayIstWindow } = require('../../backend/jobs/dailyReportJob');

async function testQuery() {
  const { startUtc, endUtc } = getYesterdayIstWindow();
  const startTime = new Date(startUtc);

  await db.query(`
    INSERT INTO organizations (id, name, type, is_active)
    VALUES ('e0000000-0000-0000-0000-000000000001', 'Scale Single Org', 'customer', true)
    ON CONFLICT (id) DO UPDATE SET is_active = true, type = 'customer'
  `);
  await db.query(`
    INSERT INTO vehicles (id, org_id, name, plate, imei, is_active)
    VALUES ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Test Veh', 'KA01AA1111', '865000999999991', true)
    ON CONFLICT (id) DO UPDATE SET is_active = true
  `);

  const pt1 = new Date(startTime.getTime() + 2 * 3600000);
  const pt2 = new Date(startTime.getTime() + 3 * 3600000);

  await db.query(`
    INSERT INTO gps_points (vehicle_id, lat, lng, speed, fuel, ignition, device_time, server_time)
    VALUES 
      ('f0000000-0000-0000-0000-000000000001', 17.44, 78.38, 40, 50, true, $1, $1),
      ('f0000000-0000-0000-0000-000000000001', 17.46, 78.40, 45, 45, true, $2, $2)
  `, [pt1, pt2]);

  const act = await reportRepository.getConsolidatedActivity('e0000000-0000-0000-0000-000000000001', 'superadmin', null, startUtc, endUtc);
  console.log('Activity result:', act);

  await db.query("DELETE FROM gps_points WHERE vehicle_id = 'f0000000-0000-0000-0000-000000000001'");
  await db.query("DELETE FROM vehicles WHERE id = 'f0000000-0000-0000-0000-000000000001'");
  await db.query("DELETE FROM organizations WHERE id = 'e0000000-0000-0000-0000-000000000001'");
  await db.pool.end();
}

testQuery().catch(console.error);
