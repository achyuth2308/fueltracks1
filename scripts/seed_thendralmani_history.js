/**
 * SEED SCRIPT: Rich Historical Telemetry for User THENDRALMANI
 * Populates realistic GPS points, Moving trips, Parked intervals, Idle intervals,
 * Fuel consumption, Refill events, and Theft events for:
 * 1. ca5e9298-cf7a-4fc1-b754-43684bb46ed5 (TN34A4195)
 * 2. d0000000-0000-0000-0000-000000000001 (Truck Alpha)
 * 3. d0000000-0000-0000-0000-000000000002 (Truck Beta)
 *
 * Spanning: Yesterday (00:00 to 23:59) and Today (00:00 to now)
 */

'use strict';

const { Pool } = require('pg');
require('dotenv').config({ path: 'fueltracks1/.env' });

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'fueltracks',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres'
});

const VEHICLES = [
  {
    id: 'ca5e9298-cf7a-4fc1-b754-43684bb46ed5',
    name: 'TN34A4195',
    imei: '861329087487006',
    initialFuel: 120.0,
    baseLat: 17.4354,
    baseLng: 78.4905,
    baseOdo: 450000
  },
  {
    id: 'd0000000-0000-0000-0000-000000000001',
    name: 'Truck Alpha',
    imei: '865006049210215',
    initialFuel: 380.0,
    baseLat: 17.3980,
    baseLng: 78.4720,
    baseOdo: 852000
  },
  {
    id: 'd0000000-0000-0000-0000-000000000002',
    name: 'Truck Beta',
    imei: '865006049210216',
    initialFuel: 190.0,
    baseLat: 17.4120,
    baseLng: 78.5150,
    baseOdo: 924500
  }
];

async function main() {
  console.log('--- Starting Seeding Rich Telemetry for THENDRALMANI ---');

  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 48 * 3600 * 1000);

  for (const v of VEHICLES) {
    const delRes = await pool.query(
      'DELETE FROM gps_points WHERE vehicle_id = $1 AND device_time >= $2',
      [v.id, twoDaysAgo]
    );
    console.log(`Cleared ${delRes.rowCount} recent points for ${v.name}`);
  }

  const startEpoch = new Date();
  startEpoch.setDate(startEpoch.getDate() - 1);
  startEpoch.setHours(6, 0, 0, 0);

  const endTime = new Date();

  for (const veh of VEHICLES) {
    console.log(`Generating comprehensive telemetry schedule for ${veh.name}...`);
    let currentTime = new Date(startEpoch.getTime());
    let currentFuel = veh.initialFuel;
    let currentOdo = veh.baseOdo;
    let currentLat = veh.baseLat;
    let currentLng = veh.baseLng;

    const points = [];

    const stages = [
      { type: 'Parked', durationMin: 90, speed: 0, ignition: false },
      { type: 'Idle', durationMin: 15, speed: 0, ignition: true, fuelDrop: 1.0 },
      { type: 'Moving', durationMin: 120, speed: 45, ignition: true, km: 65, fuelDrop: 18 },
      { type: 'Parked', durationMin: 60, speed: 0, ignition: false },
      { type: 'Refill', durationMin: 30, speed: 0, ignition: false, refillLiters: (veh.name.includes('Alpha') ? 75 : 45) },
      { type: 'Moving', durationMin: 130, speed: 52, ignition: true, km: 80, fuelDrop: 22 },
      { type: 'Idle', durationMin: 20, speed: 0, ignition: true, fuelDrop: 1.5 },
      { type: 'Parked', durationMin: 60, speed: 0, ignition: false },
      { type: 'Moving', durationMin: 140, speed: 42, ignition: true, km: 70, fuelDrop: 19 },
      { type: 'Theft', durationMin: 120, speed: 0, ignition: false, theftLiters: 15 },
      { type: 'Parked', durationMin: 240, speed: 0, ignition: false },
      { type: 'Idle', durationMin: 20, speed: 0, ignition: true, fuelDrop: 1.2 },
      { type: 'Moving', durationMin: 110, speed: 48, ignition: true, km: 60, fuelDrop: 16 },
      { type: 'Parked', durationMin: 90, speed: 0, ignition: false },
      { type: 'Moving', durationMin: 90, speed: 40, ignition: true, km: 45, fuelDrop: 12 },
      { type: 'Idle', durationMin: 15, speed: 0, ignition: true, fuelDrop: 1.0 },
      { type: 'Parked', durationMin: 45, speed: 0, ignition: false }
    ];

    let angle = 0;

    for (const stage of stages) {
      if (currentTime >= endTime) break;

      const stepSec = (stage.type === 'Moving') ? 30 : 60;
      const totalSteps = Math.max(2, Math.floor((stage.durationMin * 60) / stepSec));

      if (stage.type === 'Refill') {
        const halfStep = Math.floor(totalSteps / 2);
        for (let s = 0; s < totalSteps; s++) {
          if (currentTime >= endTime) break;
          if (s === halfStep) {
            currentFuel += stage.refillLiters;
          }
          points.push({
            vehicle_id: veh.id,
            device_time: new Date(currentTime),
            server_time: new Date(currentTime),
            lat: currentLat,
            lng: currentLng,
            speed: 0,
            direction: 90,
            ignition: false,
            odometer: Math.round(currentOdo),
            fuel: parseFloat(currentFuel.toFixed(2)),
            voltage: 24.2,
            satellites: 12,
            is_valid: true,
            is_live: true
          });
          currentTime = new Date(currentTime.getTime() + stepSec * 1000);
        }
      } else if (stage.type === 'Theft') {
        const halfStep = Math.floor(totalSteps / 2);
        for (let s = 0; s < totalSteps; s++) {
          if (currentTime >= endTime) break;
          if (s === halfStep) {
            currentFuel = Math.max(10, currentFuel - stage.theftLiters);
          }
          points.push({
            vehicle_id: veh.id,
            device_time: new Date(currentTime),
            server_time: new Date(currentTime),
            lat: currentLat,
            lng: currentLng,
            speed: 0,
            direction: 90,
            ignition: false,
            odometer: Math.round(currentOdo),
            fuel: parseFloat(currentFuel.toFixed(2)),
            voltage: 24.0,
            satellites: 12,
            is_valid: true,
            is_live: true
          });
          currentTime = new Date(currentTime.getTime() + stepSec * 1000);
        }
      } else if (stage.type === 'Parked') {
        for (let s = 0; s < totalSteps; s++) {
          if (currentTime >= endTime) break;
          points.push({
            vehicle_id: veh.id,
            device_time: new Date(currentTime),
            server_time: new Date(currentTime),
            lat: currentLat,
            lng: currentLng,
            speed: 0,
            direction: 0,
            ignition: false,
            odometer: Math.round(currentOdo),
            fuel: parseFloat(currentFuel.toFixed(2)),
            voltage: 24.0,
            satellites: 10,
            is_valid: true,
            is_live: true
          });
          currentTime = new Date(currentTime.getTime() + stepSec * 1000);
        }
      } else if (stage.type === 'Idle') {
        const dropPerStep = (stage.fuelDrop || 1.0) / totalSteps;
        for (let s = 0; s < totalSteps; s++) {
          if (currentTime >= endTime) break;
          currentFuel = Math.max(5, currentFuel - dropPerStep);
          points.push({
            vehicle_id: veh.id,
            device_time: new Date(currentTime),
            server_time: new Date(currentTime),
            lat: currentLat,
            lng: currentLng,
            speed: 0,
            direction: 0,
            ignition: true,
            odometer: Math.round(currentOdo),
            fuel: parseFloat(currentFuel.toFixed(2)),
            voltage: 24.6,
            satellites: 12,
            is_valid: true,
            is_live: true
          });
          currentTime = new Date(currentTime.getTime() + stepSec * 1000);
        }
      } else if (stage.type === 'Moving') {
        const dropPerStep = (stage.fuelDrop || 20.0) / totalSteps;
        const odoIncPerStep = ((stage.km * 1000) / totalSteps);
        const radius = 0.08;

        for (let s = 0; s < totalSteps; s++) {
          if (currentTime >= endTime) break;
          angle += 0.05;
          currentLat = veh.baseLat + Math.sin(angle) * radius;
          currentLng = veh.baseLng + Math.cos(angle) * radius;
          currentOdo += odoIncPerStep;
          currentFuel = Math.max(5, currentFuel - dropPerStep);
          const spd = Math.round(stage.speed + (Math.random() - 0.5) * 8);

          points.push({
            vehicle_id: veh.id,
            device_time: new Date(currentTime),
            server_time: new Date(currentTime),
            lat: parseFloat(currentLat.toFixed(6)),
            lng: parseFloat(currentLng.toFixed(6)),
            speed: Math.max(20, spd),
            direction: Math.round((angle * (180 / Math.PI)) % 360),
            ignition: true,
            odometer: Math.round(currentOdo),
            fuel: parseFloat(currentFuel.toFixed(2)),
            voltage: 24.8,
            satellites: 14,
            is_valid: true,
            is_live: true
          });
          currentTime = new Date(currentTime.getTime() + stepSec * 1000);
        }
      }
    }

    console.log(`Generated ${points.length} GPS telemetry records for ${veh.name}. Inserting in batches...`);

    const batchSize = 500;
    for (let i = 0; i < points.length; i += batchSize) {
      const chunk = points.slice(i, i + batchSize);
      const values = [];
      const placeholders = chunk.map((p, idx) => {
        const o = idx * 13;
        values.push(
          p.vehicle_id, p.device_time, p.server_time,
          p.lat, p.lng, p.speed, p.direction, p.ignition, p.odometer, p.fuel,
          p.voltage, p.satellites, p.is_valid
        );
        return `($${o+1}, $${o+2}, $${o+3}, $${o+4}, $${o+5}, $${o+6}, $${o+7}, $${o+8}, $${o+9}, $${o+10}, $${o+11}, $${o+12}, $${o+13})`;
      }).join(',');

      await pool.query(`
        INSERT INTO gps_points (
          vehicle_id, device_time, server_time,
          lat, lng, speed, direction, ignition, odometer, fuel,
          voltage, satellites, is_valid
        ) VALUES ${placeholders}
      `, values);
    }

    if (points.length > 0) {
      const lastP = points[points.length - 1];
      await pool.query(`
        INSERT INTO vehicle_latest_state (
          vehicle_id, lat, lng, speed, direction, ignition, odometer, fuel, updated_at, is_online, last_seen
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $9)
        ON CONFLICT (vehicle_id) DO UPDATE SET
          lat = EXCLUDED.lat,
          lng = EXCLUDED.lng,
          speed = EXCLUDED.speed,
          direction = EXCLUDED.direction,
          ignition = EXCLUDED.ignition,
          odometer = EXCLUDED.odometer,
          fuel = EXCLUDED.fuel,
          updated_at = EXCLUDED.updated_at,
          is_online = true,
          last_seen = EXCLUDED.last_seen
      `, [lastP.vehicle_id, lastP.lat, lastP.lng, lastP.speed, lastP.direction, lastP.ignition, lastP.odometer, lastP.fuel, lastP.device_time]);
    }
  }

  console.log('--- Successfully seeded rich historical telemetry for THENDRALMANI vehicles! ---');
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
