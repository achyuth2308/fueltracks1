const db = require('./config/db');

async function main() {
  try {
    const imeis = ['888888888888889', '888888888888888'];
    
    // Find actual vehicle UUIDs from vehicles table using IMEI
    const vCheck = await db.query(`SELECT id FROM vehicles WHERE imei = ANY($1)`, [imeis]);
    const vehicleUuids = vCheck.rows.map(v => v.id);

    console.log('Vehicle UUIDs found:', vehicleUuids);

    // Delete from vehicle_groups for linked vehicles
    if (vehicleUuids.length > 0) {
      const vgRes = await db.query(`DELETE FROM vehicle_groups WHERE vehicle_id = ANY($1)`, [vehicleUuids]);
      console.log(`Deleted ${vgRes.rowCount} vehicle_groups entries`);
      
      const vRes = await db.query(`DELETE FROM vehicles WHERE id = ANY($1) RETURNING id, name, imei`, [vehicleUuids]);
      console.log('Deleted vehicles:', vRes.rows);
    }

    // Also delete vehicles by IMEI directly
    const vRes2 = await db.query(`DELETE FROM vehicles WHERE imei = ANY($1) RETURNING id, name, imei`, [imeis]);
    console.log('Deleted vehicles by IMEI:', vRes2.rows);

    // Delete the devices themselves
    const delRes = await db.query(`DELETE FROM devices WHERE device_id = ANY($1) RETURNING id, device_id`, [imeis]);
    console.log('Deleted devices:', delRes.rows);

    console.log('\nDone! All 3 devices and their linked vehicles have been removed.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
