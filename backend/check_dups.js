const db = require('./config/db');

async function check() {
  try {
    const res = await db.query(`
      SELECT d.device_id, COUNT(*) 
      FROM devices d 
      LEFT JOIN vehicles v ON d.device_id = v.imei 
      LEFT JOIN vehicle_latest_state vls ON v.id = vls.vehicle_id 
      GROUP BY d.device_id 
      HAVING COUNT(*) > 1
    `);
    console.log('Duplicates in devices GET query:', res.rows);

    const devicesRes = await db.query(`SELECT device_id, COUNT(*) FROM devices GROUP BY device_id HAVING COUNT(*) > 1`);
    console.log('Duplicates in devices table:', devicesRes.rows);

    const vehiclesRes = await db.query(`SELECT imei, COUNT(*) FROM vehicles GROUP BY imei HAVING COUNT(*) > 1`);
    console.log('Duplicates in vehicles table:', vehiclesRes.rows);

    const vlsRes = await db.query(`SELECT vehicle_id, COUNT(*) FROM vehicle_latest_state GROUP BY vehicle_id HAVING COUNT(*) > 1`);
    console.log('Duplicates in vehicle_latest_state table:', vlsRes.rows);

    // Let's also check if the UI is causing duplicates in getDevices because of organizations join
    const orgsRes = await db.query(`
      SELECT d.device_id, COUNT(*) 
      FROM devices d 
      LEFT JOIN organizations o ON d.org_id = o.id
      GROUP BY d.device_id 
      HAVING COUNT(*) > 1
    `);
    console.log('Duplicates from organizations JOIN:', orgsRes.rows);
    
    // Check if the exact IMEI in the screenshot has multiple rows in any table
    const targetImei = '861329086656742';
    const rowDev = await db.query('SELECT * FROM devices WHERE device_id = $1', [targetImei]);
    console.log('Target device in devices:', rowDev.rows.length);
    const rowVeh = await db.query('SELECT * FROM vehicles WHERE imei = $1', [targetImei]);
    console.log('Target device in vehicles:', rowVeh.rows.length);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
