// ============================================================
// PACKET VALIDATOR
// Validates parsed BSTPL-17 packets before processing
// ============================================================

/**
 * Validate a parsed normal ($10) packet
 * Returns { valid: boolean, reason: string }
 */
function validateNormalPacket(parsed) {
  // We no longer reject on 'V' (Invalid) because the device is still connected and online.
  // publisher.js handles replacing 0,0 coordinates with the last known cached location.
  if (parsed.gpsValid && !['A', 'V'].includes(parsed.gpsValid)) {
    return { valid: false, reason: `Unknown GPS fix status: ${parsed.gpsValid}` };
  }

  // IMEI / Device ID must be present (alphanumeric 4-20 chars)
  if (!parsed.imei || !/^[A-Za-z0-9]{4,20}$/.test(parsed.imei)) {
    return { valid: false, reason: `Invalid IMEI: ${parsed.imei}` };
  }

  // Lat/Lng must be present
  if (parsed.lat === null || parsed.lng === null) {
    return { valid: false, reason: 'Lat/Lng conversion failed' };
  }

  // Lat must be between -90 and 90
  if (parsed.lat < -90 || parsed.lat > 90) {
    return { valid: false, reason: `Latitude out of range: ${parsed.lat}` };
  }

  // Lng must be between -180 and 180
  if (parsed.lng < -180 || parsed.lng > 180) {
    return { valid: false, reason: `Longitude out of range: ${parsed.lng}` };
  }

  // Device time must be parseable
  if (!parsed.deviceTime || isNaN(new Date(parsed.deviceTime).getTime())) {
    return { valid: false, reason: 'Invalid device time' };
  }

  return { valid: true, reason: null };
}

/**
 * Validate a parsed alert ($11 / BSTPL17IS) packet
 */
function validateAlertPacket(parsed) {
  if (!parsed.imei || !/^[A-Za-z0-9]{4,20}$/.test(parsed.imei)) {
    return { valid: false, reason: `Invalid IMEI: ${parsed.imei}` };
  }

  if (!parsed.alertText) {
    return { valid: false, reason: 'Missing alert text' };
  }

  return { valid: true, reason: null };
}

/**
 * Validate a parsed AIS140 Emergency ($EPB) packet
 */
function validateAis140EmergencyPacket(parsed) {
  if (!parsed.imei || !/^\d{15}$/.test(parsed.imei)) {
    return { valid: false, reason: `Invalid IMEI: ${parsed.imei}` };
  }

  if (parsed.lat === null || parsed.lng === null) {
    return { valid: false, reason: 'Lat/Lng conversion failed' };
  }

  if (parsed.lat < -90 || parsed.lat > 90 || parsed.lng < -180 || parsed.lng > 180) {
    return { valid: false, reason: 'Lat/Lng out of range' };
  }

  if (!parsed.alertText) {
    return { valid: false, reason: 'Missing emergency alert text' };
  }

  return { valid: true, reason: null };
}

module.exports = { validateNormalPacket, validateAlertPacket, validateAis140EmergencyPacket };
