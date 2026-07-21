const db = require('../config/db');

async function insertDummyGps() {
  const vehicleId = '1e8c4c3e-854e-4331-afee-9d8ef2d2558c'; // local DB ID
  
  let lat = 17.385044;
  let lng = 78.486671;
  let odometer = 8000;

  const today = new Date();
  today.setHours(10, 0, 0, 0);

  const points = [];

  const addPoint = (minutesOffset, speed, ignition, latOffset, lngOffset) => {
    const time = new Date(today.getTime() + minutesOffset * 60000);
    lat += latOffset;
    lng += lngOffset;
    if (speed > 0) odometer += (speed / 60); 
    points.push({
      vehicle_id: vehicleId,
      lat,
      lng,
      speed,
      direction: 90,
      odometer: Math.round(odometer),
      fuel: 40,
      ignition,
      voltage: ignition ? 14.1 : 12.5,
      satellites: 10,
      gsm_signal: 25,
      is_live: true,
      device_time: time,
      server_time: new Date()
    });
  };

  // 1. Parked (10:00 to 10:05)
  for (let i = 0; i < 5; i++) addPoint(i, 0, false, 0, 0);

  // 2. Idle (10:05 to 10:10)
  for (let i = 5; i < 10; i++) addPoint(i, 0, true, 0, 0);

  // 3. Movement (10:10 to 10:20) - moving East
  for (let i = 10; i < 20; i++) addPoint(i, 40, true, 0, 0.002);

  // 4. OverSpeed (10:20 to 10:25) - moving North
  for (let i = 20; i < 25; i++) addPoint(i, 75, true, 0.003, 0);

  // 5. Stoppage/Parked (10:25 to 10:30)
  for (let i = 25; i < 30; i++) addPoint(i, 0, false, 0, 0);

  console.log('Generating dummy points...');

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    
    const startOfDay = new Date(today);
    startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23,59,59,999);
    
    await client.query('DELETE FROM gps_points WHERE vehicle_id = $1 AND device_time >= $2 AND device_time <= $3', [vehicleId, startOfDay, endOfDay]);

    const query = `INSERT INTO gps_points (
        vehicle_id, lat, lng, speed, direction, odometer, fuel, ignition, voltage,
        satellites, gsm_signal, is_live, device_time, server_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`;

    for (const p of points) {
      await client.query(query, [
        p.vehicle_id, p.lat, p.lng, p.speed, p.direction, p.odometer, p.fuel,
        p.ignition, p.voltage, p.satellites, p.gsm_signal, p.is_live,
        p.device_time, p.server_time
      ]);
    }
    
    await client.query('COMMIT');
    console.log('Dummy data inserted successfully!');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error inserting dummy data:', e);
  } finally {
    client.release();
    process.exit(0);
  }
}

insertDummyGps();
