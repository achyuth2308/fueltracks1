const { Pool } = require('pg');
require('dotenv').config({ path: 'fueltracks1/.env' });

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'fueltracks',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres'
});

async function main() {
  console.log('--- Setting calibrateType: Direct on THENDRALMANI vehicles ---');

  // TN34A4195 (Single tank 200L)
  const tnMeta = {
    vehicleId: 'TN34A4195',
    deviceModel: 'VOLTY',
    sensorNo: 'FS-TN34-01',
    hasFuel: true,
    fuel_sensor: true,
    licenceNo: 'ADTN34A4195',
    licenceType: 'Advanced',
    tankSize: 200,
    fuelCalibration: {
      tankSize: 200,
      calibrateType: 'Direct',
      directMultiplier: 1.0,
      directOffset: 0.0,
      directUnit: 'Litres',
      updatedAt: '2026-01-01T00:00:00.000Z'
    }
  };

  await pool.query(
    "UPDATE vehicles SET metadata = $1, licence_issued_date = NOW(), licence_expire_date = NOW() + INTERVAL '1 year' WHERE imei = '861329087487006'",
    [JSON.stringify(tnMeta)]
  );

  // Truck Alpha (500L)
  const alphaMeta = {
    vehicleId: 'MH12AB1234',
    deviceModel: 'BSTPL-17',
    sensorNo: 'FS-ALPHA-DUAL',
    hasFuel: true,
    fuel_sensor: true,
    licenceNo: 'ENMH12AB1234',
    licenceType: 'Premium',
    tankSize: 500,
    fuelCalibration: {
      tankSize: 500,
      calibrateType: 'Direct',
      directMultiplier: 1.0,
      directOffset: 0.0,
      directUnit: 'Litres',
      updatedAt: '2026-01-01T00:00:00.000Z',
      tanks: {
        tank1: { capacity: 300, sensorNumber: 'FS-ALPHA-01' },
        tank2: { capacity: 200, sensorNumber: 'FS-ALPHA-02' }
      }
    }
  };

  await pool.query(
    "UPDATE vehicles SET metadata = $1, licence_issued_date = NOW(), licence_expire_date = NOW() + INTERVAL '1 year' WHERE imei = '865006049210215'",
    [JSON.stringify(alphaMeta)]
  );

  // Truck Beta (250L)
  const betaMeta = {
    vehicleId: 'MH12CD5678',
    deviceModel: 'BSTPL-17',
    sensorNo: 'FS-BETA-01',
    hasFuel: true,
    fuel_sensor: true,
    licenceNo: 'ADMH12CD5678',
    licenceType: 'Advanced',
    tankSize: 250,
    fuelCalibration: {
      tankSize: 250,
      calibrateType: 'Direct',
      directMultiplier: 1.0,
      directOffset: 0.0,
      directUnit: 'Litres',
      updatedAt: '2026-01-01T00:00:00.000Z'
    }
  };

  await pool.query(
    "UPDATE vehicles SET metadata = $1, licence_issued_date = NOW(), licence_expire_date = NOW() + INTERVAL '1 year' WHERE imei = '865006049210216'",
    [JSON.stringify(betaMeta)]
  );

  console.log('Updated all 3 vehicles with calibrateType: Direct.');
  await pool.end();
}

main().catch(console.error);
