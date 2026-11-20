const db = require('./config/db');
const Redis = require('ioredis');

async function startSimulator() {
  const vehicleId = '4a273348-7ec2-4e47-a42f-417a4ed2e666';
  const imei = '861329086544187';

  try {
    // 1. Ensure metadata has dynamic tankSize (385), sensorNo, and expectedMileage
    await db.query(`
      UPDATE vehicles
      SET metadata = jsonb_set(
        jsonb_set(
          jsonb_set(COALESCE(metadata, '{}'::jsonb), '{tankSize}', '"385"'),
          '{sensorNo}', '"FS-1476"'
        ),
        '{expectedMileage}', '"4.02"'
      )
      WHERE id = $1
    `, [vehicleId]);
    console.log('[SIMULATOR] Vehicle 1476 metadata updated with tankSize=385, sensorNo=FS-1476, expectedMileage=4.02');

    // 2. Initial state
    let speed = 45;
    let fuel = 147.0;
    const tankSize = 385;
    let lat = 17.4399;
    let lng = 78.3756;
    let odo = 15420;
    let todayDist = 24.5;

    // Connect Redis if possible
    let redis = null;
    try {
      redis = new Redis({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: process.env.REDIS_PORT || 6379,
        retryStrategy: () => 2000,
        maxRetriesPerRequest: 1
      });
      redis.on('error', (e) => {});
    } catch (_) {}

    const sendTelemetry = async () => {
      // Dynamic live speed around 45 km/h and fuel around 147 Ltr
      speed = Math.max(30, Math.min(65, Math.round(speed + (Math.random() * 4 - 2))));
      fuel = Math.max(140, Math.min(155, Math.round((fuel + (Math.random() * 0.2 - 0.1)) * 10) / 10));
      lat += (Math.random() - 0.5) * 0.0001;
      lng += (Math.random() - 0.5) * 0.0001;
      todayDist = Math.round((todayDist + 0.01) * 100) / 100;
      odo = Math.round(odo + 1);

      const now = new Date();

      // Upsert vehicle_latest_state
      await db.query(`
        INSERT INTO vehicle_latest_state (
          vehicle_id, lat, lng, speed, fuel, ignition, voltage,
          battery, satellites, gsm_signal, direction, odometer, today_distance,
          is_online, is_immobilized, last_seen, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, TRUE, 26.4,
          95, 12, 28, 45, $6, $7,
          TRUE, FALSE, $8, $8
        )
        ON CONFLICT (vehicle_id) DO UPDATE SET
          lat = EXCLUDED.lat,
          lng = EXCLUDED.lng,
          speed = EXCLUDED.speed,
          fuel = EXCLUDED.fuel,
          ignition = EXCLUDED.ignition,
          voltage = EXCLUDED.voltage,
          battery = EXCLUDED.battery,
          satellites = EXCLUDED.satellites,
          gsm_signal = EXCLUDED.gsm_signal,
          direction = EXCLUDED.direction,
          odometer = EXCLUDED.odometer,
          today_distance = EXCLUDED.today_distance,
          is_online = TRUE,
          last_seen = EXCLUDED.last_seen,
          updated_at = EXCLUDED.updated_at
      `, [vehicleId, lat, lng, speed, fuel, odo, todayDist, now]);

      console.log(`[SIMULATOR] Sent 1476 packet: Speed=${speed} km/h, Fuel=${fuel} Ltr (${Math.round(fuel / tankSize * 100)}%), Lat=${lat.toFixed(4)}, Lng=${lng.toFixed(4)}`);

      // Publish to Redis tracking channel for live WebSocket broadcast
      // Convert liters to raw ADC (0-4095) for the locationSubscriber auto-calibrate formula
      const rawAdc = Math.round((fuel / tankSize) * 4095);
      if (redis) {
        try {
          const packet = {
            imei,
            lat,
            lng,
            speed,
            ignition: true,
            fuel: rawAdc,
            voltage: 26.4,
            odometer: odo,
            todayDistance: todayDist,
            satellites: 12,
            gsmSignal: 28,
            battery: 95,
            deviceTime: now.toISOString(),
            isLive: true,
            packetType: '$10',
            isHeartbeat: false
          };
          await redis.publish('tracking', JSON.stringify(packet));
        } catch (_) {}
      }
    };

    // Send immediately once
    await sendTelemetry();

    // Repeat every 3 seconds
    setInterval(sendTelemetry, 3000);
  } catch (err) {
    console.error('[SIMULATOR ERROR]:', err);
  }
}

startSimulator();
