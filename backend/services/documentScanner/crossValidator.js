// ============================================================
// DOCUMENT SCANNER CROSS-VALIDATION SERVICE
// Cross-checks extracted data:
//  - Text vs QR payload consistency
//  - Checks IMEI against existing vehicles/devices (read-only, indexed)
//  - Flags 'duplicate_imei' warning if assigned to another vehicle
//  - Scoped strictly by org_id (tenant isolation)
// ============================================================

const { getScannerPool } = require('../../config/db');

class CrossValidator {
  async crossValidate({ fields, qrPayload = null, orgId = null }) {
    const warnings = [];
    const pool = getScannerPool();

    // 1. Cross-validate with QR payload
    if (qrPayload) {
      if (qrPayload.certificate_number && fields['certificate_number']?.value) {
        if (qrPayload.certificate_number !== fields['certificate_number'].value) {
          warnings.push(`QR_CERTIFICATE_MISMATCH: QR payload holds ${qrPayload.certificate_number} but extracted text is ${fields['certificate_number'].value}`);
        }
      }
      if (qrPayload.imei && fields['imei_number']?.value) {
        if (qrPayload.imei !== fields['imei_number'].value) {
          warnings.push(`QR_IMEI_MISMATCH: QR payload IMEI ${qrPayload.imei} differs from extracted text ${fields['imei_number'].value}`);
        }
      }
      if (qrPayload.vehicle_no && fields['vehicle_registration_no']?.value) {
        const cleanQrVeh = qrPayload.vehicle_no.replace(/\s+/g, '');
        const cleanExtVeh = fields['vehicle_registration_no'].value.replace(/\s+/g, '');
        if (cleanQrVeh !== cleanExtVeh) {
          warnings.push(`QR_VEHICLE_MISMATCH: QR vehicle ${cleanQrVeh} differs from extracted vehicle ${cleanExtVeh}`);
        }
      }
    }

    // 2. Duplicate check against existing vehicles/devices in database
    const extractedImei = fields['imei_number']?.value;
    const extractedPlate = fields['vehicle_registration_no']?.value;

    if (extractedImei && orgId && pool) {
      try {
        const client = await pool.connect();
        try {
          // Indexed lookup on vehicles(imei) scoped by org_id
          const vehRes = await client.query(`
            SELECT id, plate, imei FROM vehicles 
            WHERE org_id = $1 AND imei = $2
            LIMIT 1
          `, [orgId, extractedImei]);

          if (vehRes.rows.length > 0) {
            const existingVeh = vehRes.rows[0];
            const cleanExistingPlate = (existingVeh.plate || '').replace(/\s+/g, '').toUpperCase();
            const cleanNewPlate = (extractedPlate || '').replace(/\s+/g, '').toUpperCase();

            if (cleanNewPlate && cleanExistingPlate && cleanExistingPlate !== cleanNewPlate) {
              warnings.push(`DUPLICATE_IMEI: IMEI ${extractedImei} is already registered on vehicle ${existingVeh.plate} in your organization.`);
            }
          }
        } finally {
          client.release();
        }
      } catch (err) {
        // Non-blocking lookup: if DB check fails, log warning but do not abort scan
        console.warn('[CROSS-VALIDATE] Warning: Failed to query existing vehicle records:', err.message);
      }
    }

    return warnings;
  }
}

module.exports = new CrossValidator();
