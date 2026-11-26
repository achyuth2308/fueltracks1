export const LICENSE_TIER_PREFIXES = {
  'Standard': 'BC',
  'Standard Pro': 'ST',
  'Advanced': 'AD',
  'Premium': 'EN',
  // Backward compatibility aliases
  'Basic': 'BC',
  'Starter': 'ST'
};

/**
 * Returns the license tier ('Standard' | 'Standard Pro' | 'Advanced' | 'Premium' | 'Other') for a vehicle.
 * Seamlessly maps existing production data (BC / Basic -> Standard, ST / Starter -> Standard Pro).
 */
export const getVehicleLicenseTier = (v) => {
  if (!v) return 'Other';
  const meta = v.metadata || {};

  // 1. Explicit licenceType check (case-insensitive)
  const explicitType = (meta.licenceType || v.licenceType || v.licence_type || '').trim().toLowerCase();
  if (
    explicitType === 'standard pro' ||
    explicitType === 'starter' ||
    explicitType.includes('starter') ||
    explicitType.includes('standard pro')
  ) {
    return 'Standard Pro';
  }
  if (
    explicitType === 'standard' ||
    explicitType === 'basic' ||
    explicitType.includes('basic') ||
    explicitType.includes('standard')
  ) {
    return 'Standard';
  }
  if (explicitType === 'advanced' || explicitType.includes('advanced')) {
    return 'Advanced';
  }
  if (explicitType === 'premium' || explicitType.includes('premium') || explicitType.includes('enterprise')) {
    return 'Premium';
  }

  // 2. Licence ID prefix check:
  // BC = Standard (formerly Basic)
  // ST = Standard Pro (formerly Starter)
  // AD = Advanced
  // EN / PR = Premium
  const licId = String(v.licenceId || meta.licenceId || v.licence_no || meta.licenceNo || '').trim().toUpperCase();
  if (licId.startsWith('ST')) return 'Standard Pro';
  if (licId.startsWith('BC')) return 'Standard';
  if (licId.startsWith('AD')) return 'Advanced';
  if (licId.startsWith('EN') || licId.startsWith('PR')) return 'Premium';

  return 'Other';
};

/**
 * Normalizes any tier query / filter parameter ('Basic', 'Standard', 'Starter', 'Standard Pro', etc.)
 * to canonical display name.
 */
export const normalizeTierName = (tier) => {
  if (!tier || tier === 'all') return 'all';
  const t = String(tier).trim().toLowerCase();
  if (t === 'starter' || t === 'standard pro' || t === 'standardpro' || t === 'standard_pro') {
    return 'Standard Pro';
  }
  if (t === 'basic' || t === 'standard') {
    return 'Standard';
  }
  if (t === 'advanced') {
    return 'Advanced';
  }
  if (t === 'premium' || t === 'enterprise') {
    return 'Premium';
  }
  return tier;
};

/**
 * Checks whether an individual vehicle has fuel monitoring hardware/capability configured.
 */
/**
 * Checks whether an individual vehicle has an actual physical hardware fuel sensor installed.
 * Strictly separates physical hardware sensors from software-estimated Non-Sensor Fuel.
 */
export const hasVehicleFuelCapability = (v) => {
  if (!v) return false;
  const meta = v.metadata || {};

  // 1. Explicit boolean flag if configured on vehicle
  if (v.fuel_sensor === false || v.has_fuel_sensor === false || meta.fuel_sensor === false || meta.has_fuel_sensor === false) {
    return false;
  }
  if (v.fuel_sensor === true || v.has_fuel_sensor === true || meta.fuel_sensor === true || meta.has_fuel_sensor === true) {
    return true;
  }

  // 2. Physical hardware sensor number (e.g. 'FS-1476')
  if (meta.sensorNo && String(meta.sensorNo).trim() !== '' && String(meta.sensorNo).trim() !== '0') {
    return true;
  }

  // 3. Physical hardware calibration table (multipoint rod/capacitive calibration)
  const fuelCal = meta.fuelCalibration || meta.fuel || {};
  if (fuelCal && typeof fuelCal === 'object' && Object.keys(fuelCal).length > 0) {
    if (fuelCal.tanks || fuelCal.calibration || fuelCal.calibrationPoints) {
      return true;
    }
  }

  // 4. Physical tank size configured in device hardware metadata (only if not a non-sensor manual vehicle)
  const metaTank = parseFloat(meta.tankSize || meta.tank_size || meta.tankCapacity || 0);
  if (!isNaN(metaTank) && metaTank > 0 && !v.manual_tank_capacity) {
    return true;
  }

  // 5. Tier based detection for physical hardware (Advanced AD / Premium EN)
  const tier = getVehicleLicenseTier(v);
  if ((tier === 'Advanced' || tier === 'Premium') && !v.manual_tank_capacity) {
    return true;
  }

  return false;
};

export const hasPhysicalFuelSensor = hasVehicleFuelCapability;

/**
 * Checks whether a fleet of vehicles has ANY vehicle with fuel capability.
 */
export const hasAnyFuelVehicle = (vehicles) => {
  if (!Array.isArray(vehicles) || vehicles.length === 0) return false;
  return vehicles.some(v => hasVehicleFuelCapability(v));
};
