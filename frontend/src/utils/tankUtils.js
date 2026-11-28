/**
 * tankUtils.js
 * Utility helpers for resolving multi-tank and single-tank telemetry & metadata.
 */

export function getVehicleTanksInfo(vehicle) {
  if (!vehicle) {
    return {
      hasTwoTanks: false,
      tankCount: 1,
      totalFuel: 0,
      totalCapacity: 0,
      totalPercentage: 0,
      tanks: []
    };
  }

  let meta = vehicle.metadata;
  if (typeof meta === 'string') {
    try { meta = JSON.parse(meta); } catch (_) { meta = {}; }
  }
  meta = meta || {};

  const fuelCal = meta.fuelCalibration || {};
  const fuelConfig = meta.fuelConfig || {};
  const tanksConfig = fuelCal.tanks || {};
  const tanksTelem = vehicle.tanks || vehicle.tanksTelemetry || {};

  const configuredNoOfTanks = Number(
    fuelConfig.noOfTank ||
    fuelCal.noOfTank ||
    meta.numberOfTanks ||
    meta.numTank ||
    meta.noOfTank ||
    1
  );

  const configKeys = typeof tanksConfig === 'object' && tanksConfig !== null ? Object.keys(tanksConfig) : [];
  const telemKeys = typeof tanksTelem === 'object' && tanksTelem !== null ? Object.keys(tanksTelem) : [];

  const isMultiTank = configuredNoOfTanks >= 2 || configKeys.length >= 2 || telemKeys.length >= 2;

  if (!isMultiTank) {
    const rawFuel = vehicle.current_fuel !== undefined && vehicle.current_fuel !== null
      ? Number(vehicle.current_fuel)
      : (vehicle.fuel !== undefined && vehicle.fuel !== null ? Number(vehicle.fuel) : 0);
    const cap = Number(vehicle.tank_capacity || meta.tankSize || fuelCal.tankSize || fuelConfig.tankSize || 0);
    const cleanFuel = Math.max(0, Math.round(rawFuel * 10) / 10);
    const cleanCap = Math.round(cap);
    const pct = cleanCap > 0 ? Math.min(100, Math.round((cleanFuel / cleanCap) * 100)) : 0;

    return {
      hasTwoTanks: false,
      tankCount: 1,
      totalFuel: cleanFuel,
      totalCapacity: cleanCap,
      totalPercentage: pct,
      tank1: {
        tankIndex: 1,
        name: 'Tank 1',
        capacity: cleanCap,
        litres: cleanFuel,
        percentage: pct
      },
      tank2: null,
      tanks: [
        {
          tankIndex: 1,
          name: 'Tank 1',
          capacity: cleanCap,
          litres: cleanFuel,
          percentage: pct
        }
      ]
    };
  }

  // 2+ Tanks Detected
  const t1Cfg = tanksConfig['1'] || tanksConfig[1] || {};
  const t2Cfg = tanksConfig['2'] || tanksConfig[2] || {};
  const t1Telem = tanksTelem['1'] || tanksTelem[1] || {};
  const t2Telem = tanksTelem['2'] || tanksTelem[2] || {};

  const t1Cap = Number(t1Telem.capacity || t1Cfg.tankSize || t1Cfg.capacity || meta.tankSize || 0);
  const t2Cap = Number(t2Telem.capacity || t2Cfg.tankSize || t2Cfg.capacity || 0);
  const totalCapacity = (t1Cap + t2Cap) || Number(vehicle.tank_capacity || 0);

  const rawTotal = vehicle.current_fuel !== undefined && vehicle.current_fuel !== null
    ? Number(vehicle.current_fuel)
    : (vehicle.fuel !== undefined && vehicle.fuel !== null ? Number(vehicle.fuel) : 0);

  let t1Litres = null;
  if (t1Telem.litres !== undefined && t1Telem.litres !== null) {
    t1Litres = Number(t1Telem.litres);
  } else if (vehicle.tank1_fuel !== undefined && vehicle.tank1_fuel !== null) {
    t1Litres = Number(vehicle.tank1_fuel);
  } else if (vehicle.fuel1 !== undefined && vehicle.fuel1 !== null) {
    t1Litres = Number(vehicle.fuel1);
  } else if (vehicle.fuel_1 !== undefined && vehicle.fuel_1 !== null) {
    t1Litres = Number(vehicle.fuel_1);
  }

  let t2Litres = null;
  if (t2Telem.litres !== undefined && t2Telem.litres !== null) {
    t2Litres = Number(t2Telem.litres);
  } else if (vehicle.tank2_fuel !== undefined && vehicle.tank2_fuel !== null) {
    t2Litres = Number(vehicle.tank2_fuel);
  } else if (vehicle.fuel2 !== undefined && vehicle.fuel2 !== null) {
    t2Litres = Number(vehicle.fuel2);
  } else if (vehicle.fuel_2 !== undefined && vehicle.fuel_2 !== null) {
    t2Litres = Number(vehicle.fuel_2);
  }

  // If specific individual readings are not provided, distribute proportionally based on capacities
  if ((t1Litres === null || isNaN(t1Litres)) && (t2Litres === null || isNaN(t2Litres)) && rawTotal > 0) {
    if (t1Cap > 0 && t2Cap > 0) {
      const sumCap = t1Cap + t2Cap;
      t1Litres = (rawTotal * (t1Cap / sumCap));
      t2Litres = (rawTotal * (t2Cap / sumCap));
    } else {
      t1Litres = rawTotal / 2;
      t2Litres = rawTotal / 2;
    }
  } else {
    t1Litres = t1Litres !== null && !isNaN(t1Litres) ? t1Litres : 0;
    t2Litres = t2Litres !== null && !isNaN(t2Litres) ? t2Litres : 0;
  }

  const cleanT1 = Math.max(0, Math.round(Number(t1Litres) * 10) / 10);
  const cleanT2 = Math.max(0, Math.round(Number(t2Litres) * 10) / 10);
  const cleanTotal = Math.round((cleanT1 + cleanT2) * 10) / 10 || Math.max(0, Math.round(rawTotal * 10) / 10);

  const t1Percent = t1Cap > 0 ? Math.min(100, Math.round((cleanT1 / t1Cap) * 100)) : 0;
  const t2Percent = t2Cap > 0 ? Math.min(100, Math.round((cleanT2 / t2Cap) * 100)) : 0;
  const totalPercent = totalCapacity > 0 ? Math.min(100, Math.round((cleanTotal / totalCapacity) * 100)) : 0;

  return {
    hasTwoTanks: true,
    tankCount: 2,
    totalFuel: cleanTotal,
    totalCapacity: Math.round(totalCapacity),
    totalPercentage: totalPercent,
    tank1: {
      tankIndex: 1,
      name: 'Tank 1',
      capacity: Math.round(t1Cap),
      litres: cleanT1,
      percentage: t1Percent
    },
    tank2: {
      tankIndex: 2,
      name: 'Tank 2',
      capacity: Math.round(t2Cap),
      litres: cleanT2,
      percentage: t2Percent
    },
    tanks: [
      {
        tankIndex: 1,
        name: 'Tank 1',
        capacity: Math.round(t1Cap),
        litres: cleanT1,
        percentage: t1Percent
      },
      {
        tankIndex: 2,
        name: 'Tank 2',
        capacity: Math.round(t2Cap),
        litres: cleanT2,
        percentage: t2Percent
      }
    ]
  };
}
