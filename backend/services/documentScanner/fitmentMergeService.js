// ============================================================
// FITMENT MERGE SERVICE (PURE, SIDE-EFFECT-FREE LOGIC)
// Phase 1B: Merges verified certificate fitment data into vehicle models
// Enforces strict safety rules:
//  - Version token hashing via MD5(jsonb_build_array)
//  - Fill-only semantics on model, gps_sim_no, chassisNo, engineNo
//  - ICCID (16-20 digits) goes ONLY to fitment.sim_number, NEVER to gps_sim_no
//  - Luhn failures on IMEI/ICCID trigger warnings, never 400 errors
//  - No top-level ownerName or ownerAddress from certificates
// ============================================================

const crypto = require('crypto');
const { validateImei, validateVehiclePlate, validatePhone } = require('./crossValidator');

/**
 * SQL fragment to generate deterministic version token.
 * Uses jsonb_build_array to be resilient to NULL values and separators.
 */
const SQL_VERSION_TOKEN_FRAGMENT = `md5(jsonb_build_array(v.plate, v.imei, v.model, v.gps_sim_no, v.metadata->'fitment', v.metadata->'chassisNo', v.metadata->'engineNo')::text)`;

/**
 * Compute the deterministic MD5 version token in JavaScript matching SQL jsonb_build_array::text
 */
function computeVersionToken(vehicle) {
  const metadata = vehicle?.metadata || {};
  const array = [
    vehicle?.plate !== undefined ? vehicle.plate : null,
    vehicle?.imei !== undefined ? vehicle.imei : null,
    vehicle?.model !== undefined ? vehicle.model : null,
    vehicle?.gps_sim_no !== undefined ? vehicle.gps_sim_no : null,
    metadata.fitment !== undefined ? metadata.fitment : null,
    metadata.chassisNo !== undefined ? metadata.chassisNo : null,
    metadata.engineNo !== undefined ? metadata.engineNo : null,
  ];
  const jsonStr = JSON.stringify(array);
  return crypto.createHash('md5').update(jsonStr).digest('hex');
}

/**
 * Luhn checksum validator for IMEI and ICCID
 */
function checkLuhn(val) {
  if (!val || typeof val !== 'string') return false;
  const digits = val.replace(/\D/g, '');
  if (!digits) return false;

  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

/**
 * Pure function to build the merge patch and dry-run diff
 *
 * @param {Object} existingVehicle - The vehicle record from database
 * @param {Object} extractedData - Raw OCR/extraction fields
 * @param {Object} userConfirmedData - Optional user overrides from confirmation request
 * @param {Array<string>} overwriteFields - Explicit fields allowed to overwrite existing non-empty values
 * @returns {Object} { has_changes, patch, diff, warnings, target_vehicle, version_token }
 */
function previewFitmentMerge(existingVehicle, extractedData = {}, userConfirmedData = {}, overwriteFields = []) {
  if (!existingVehicle) {
    throw new Error('existingVehicle is required for fitment merge preview');
  }

  const warnings = [];
  const mergedInput = { ...extractedData, ...userConfirmedData };

  // 1. Mandatory IMEI validation
  const imeiRaw = mergedInput.imei_number || mergedInput.imei || existingVehicle.imei;
  if (!imeiRaw) {
    const err = new Error('IMEI_NOT_VERIFIABLE: Missing device IMEI in fitment certificate');
    err.code = 'IMEI_NOT_VERIFIABLE';
    throw err;
  }

  const imeiClean = String(imeiRaw).replace(/\D/g, '');
  if (!/^\d{15}$/.test(imeiClean)) {
    const err = new Error('IMEI_NOT_VERIFIABLE: IMEI must be exactly 15 digits');
    err.code = 'IMEI_NOT_VERIFIABLE';
    throw err;
  }

  if (!checkLuhn(imeiClean)) {
    warnings.push('INVALID_IMEI_LUHN: IMEI failed Luhn checksum check');
  }

  // 2. Registration Plate validation
  const plateRaw = mergedInput.vehicle_registration_no || mergedInput.registration_no || mergedInput.plate || existingVehicle.plate;
  const plateClean = plateRaw ? String(plateRaw).toUpperCase().replace(/[^A-Z0-9]/g, '') : '';

  // 3. SIM Handling (10-15 digits vs 16-20 digit ICCID)
  const simRaw = mergedInput.sim_number || mergedInput.gps_sim_no || mergedInput.iccid;
  let simClean = null;
  let isIccid = false;

  if (simRaw) {
    const digitsOnly = String(simRaw).replace(/\D/g, '');
    if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
      simClean = digitsOnly;
    } else if (digitsOnly.length >= 16 && digitsOnly.length <= 20) {
      isIccid = true;
      simClean = digitsOnly;
      warnings.push('ICCID_NOT_WRITTEN_TO_SIM_NO: SIM value is 16-20 digit ICCID and was stored under fitment.sim_number only');
      if (!checkLuhn(digitsOnly)) {
        warnings.push('INVALID_ICCID_LUHN: ICCID failed Luhn checksum check');
      }
    } else {
      warnings.push(`INVALID_SIM_FORMAT: SIM value length ${digitsOnly.length} is neither MSISDN (10-15) nor ICCID (16-20)`);
    }
  }

  // 4. Model handling (fill-only unless in overwriteFields)
  const inputModel = mergedInput.model || mergedInput.device_model || null;
  const existingModel = existingVehicle.model || null;
  const allowModelOverwrite = overwriteFields.includes('model');
  const shouldUpdateModel = inputModel && (!existingModel || allowModelOverwrite);
  const targetModel = shouldUpdateModel ? inputModel : existingModel;

  // 5. GPS SIM No handling (fill-only unless in overwriteFields, NEVER if ICCID)
  const existingSim = existingVehicle.gps_sim_no || null;
  const allowSimOverwrite = overwriteFields.includes('gps_sim_no');
  const canUpdateSimNo = simClean && !isIccid;
  const shouldUpdateSimNo = canUpdateSimNo && (!existingSim || allowSimOverwrite);
  const targetSimNo = shouldUpdateSimNo ? simClean : existingSim;

  // 6. Metadata top-level fields (chassisNo, engineNo ONLY)
  const existingMetadata = existingVehicle.metadata || {};
  const allowChassisOverwrite = overwriteFields.includes('chassisNo');
  const allowEngineOverwrite = overwriteFields.includes('engineNo');

  const inputChassis = mergedInput.chassis_no || mergedInput.chassisNo || null;
  const existingChassis = existingMetadata.chassisNo || null;
  const shouldUpdateChassis = inputChassis && (!existingChassis || allowChassisOverwrite);
  const targetChassis = shouldUpdateChassis ? inputChassis : existingChassis;

  const inputEngine = mergedInput.engine_no || mergedInput.engineNo || null;
  const existingEngine = existingMetadata.engineNo || null;
  const shouldUpdateEngine = inputEngine && (!existingEngine || allowEngineOverwrite);
  const targetEngine = shouldUpdateEngine ? inputEngine : existingEngine;

  // 7. Structured fitment payload (nested under metadata.fitment)
  const existingFitment = existingMetadata.fitment || {};
  const newFitment = {
    ...existingFitment,
    certificate_no: mergedInput.certificate_no || existingFitment.certificate_no || null,
    fitment_date: mergedInput.fitment_date || existingFitment.fitment_date || null,
    vendor: mergedInput.vendor || existingFitment.vendor || null,
    installer_name: mergedInput.installer_name || existingFitment.installer_name || null,
    installer_dealer: mergedInput.installer_dealer || existingFitment.installer_dealer || null,
    technician_name: mergedInput.technician_name || existingFitment.technician_name || null,
    device_model: mergedInput.device_model || mergedInput.model || existingFitment.device_model || null,
    device_serial: mergedInput.device_serial || existingFitment.device_serial || null,
    vltd_manufacturer: mergedInput.manufacturer_name || mergedInput.vltd_manufacturer || existingFitment.vltd_manufacturer || null,
    sim_number: simClean || existingFitment.sim_number || null,
    is_iccid: isIccid || existingFitment.is_iccid || false,
    customer_name: mergedInput.customer_name || existingFitment.customer_name || null,
    customer_phone: mergedInput.customer_phone || existingFitment.customer_phone || null,
    customer_address: mergedInput.customer_address || existingFitment.customer_address || null,
    updated_at: new Date().toISOString()
  };

  // Determine if changes exist compared to existing state
  const hasModelChange = targetModel !== existingModel;
  const hasSimChange = targetSimNo !== existingSim;
  const hasChassisChange = targetChassis !== existingChassis;
  const hasEngineChange = targetEngine !== existingEngine;
  const hasFitmentChange = JSON.stringify(existingFitment) !== JSON.stringify(newFitment);

  const hasChanges = hasModelChange || hasSimChange || hasChassisChange || hasEngineChange || hasFitmentChange;

  return {
    has_changes: hasChanges,
    target_vehicle: {
      id: existingVehicle.id,
      plate: existingVehicle.plate,
      imei: existingVehicle.imei,
    },
    version_token: computeVersionToken(existingVehicle),
    patch: {
      model: targetModel,
      gps_sim_no: targetSimNo,
      metadata_patch: {
        ...(targetChassis ? { chassisNo: targetChassis } : {}),
        ...(targetEngine ? { engineNo: targetEngine } : {}),
        fitment: newFitment
      }
    },
    diff: {
      model: { old: existingModel, new: targetModel, changed: hasModelChange },
      gps_sim_no: { old: existingSim, new: targetSimNo, changed: hasSimChange },
      chassisNo: { old: existingChassis, new: targetChassis, changed: hasChassisChange },
      engineNo: { old: existingEngine, new: targetEngine, changed: hasEngineChange },
      fitment: { changed: hasFitmentChange }
    },
    warnings
  };
}

module.exports = {
  SQL_VERSION_TOKEN_FRAGMENT,
  computeVersionToken,
  checkLuhn,
  previewFitmentMerge
};

