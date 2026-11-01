const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  computeVersionToken,
  previewFitmentMerge,
  checkLuhn
} = require('../services/documentScanner/fitmentMergeService');

describe('FitmentMergeService Pure Unit Tests (Phase 1B)', () => {
  it('1. Computes deterministic version token even with all-NULL vehicle fields', () => {
    const emptyVehicle = {
      plate: null,
      imei: null,
      model: null,
      gps_sim_no: null,
      metadata: null
    };
    const token1 = computeVersionToken(emptyVehicle);
    const token2 = computeVersionToken({ ...emptyVehicle });

    assert.ok(token1, 'Token should be non-empty');
    assert.equal(typeof token1, 'string');
    assert.equal(token1.length, 32, 'MD5 token is 32 hex chars');
    assert.equal(token1, token2, 'Deterministic token for identical null states');
  });

  it('2. Telemetry metadata updates (e.g. odometerSnapshot) do NOT alter version token', () => {
    const baseVehicle = {
      plate: 'KA01AB1234',
      imei: '860123456789012',
      model: 'VT05S',
      gps_sim_no: '9876543210',
      metadata: {
        chassisNo: 'CHASSIS999',
        engineNo: 'ENG888',
        fitment: {
          certificate_no: 'FT-GPS-2026-0001'
        }
      }
    };
    const tokenBefore = computeVersionToken(baseVehicle);

    // Simulate concurrent live telemetry write that mutates vehicle metadata
    const vehicleWithTelemetry = {
      ...baseVehicle,
      metadata: {
        ...baseVehicle.metadata,
        odometerSnapshot: 45290.5,
        speedAlert: true,
        lastIgnitionState: 'ON',
        batteryLevel: 98
      }
    };
    const tokenAfter = computeVersionToken(vehicleWithTelemetry);

    assert.equal(tokenBefore, tokenAfter, 'Version token must remain identical when telemetry keys change');
  });

  it('3. ICCID (19-20 digits) is NEVER written to gps_sim_no; saved to fitment.sim_number with warning', () => {
    const existingVehicle = {
      id: 'v-uuid-1',
      plate: 'TN33AY2490',
      imei: '860123456789012',
      model: 'VL02',
      gps_sim_no: null,
      metadata: {}
    };

    const extracted = {
      imei_number: '860123456789012',
      sim_number: '89918640000000000010', // 20-digit ICCID
      chassis_no: 'ME4JF083G8102341'
    };

    const preview = previewFitmentMerge(existingVehicle, extracted);

    assert.equal(preview.patch.gps_sim_no, null, 'gps_sim_no MUST NOT receive ICCID');
    assert.equal(preview.patch.metadata_patch.fitment.sim_number, '89918640000000000010');
    assert.equal(preview.patch.metadata_patch.fitment.is_iccid, true);
    assert.ok(
      preview.warnings.some(w => w.includes('ICCID_NOT_WRITTEN_TO_SIM_NO')),
      'Should report ICCID_NOT_WRITTEN_TO_SIM_NO warning'
    );
  });

  it('4. 10-15 digit MSISDN SIM is written to gps_sim_no if null (fill-only)', () => {
    const existingVehicle = {
      id: 'v-uuid-2',
      plate: 'TN33AY2490',
      imei: '860123456789012',
      model: 'VL02',
      gps_sim_no: null,
      metadata: {}
    };

    const extracted = {
      imei_number: '860123456789012',
      sim_number: '9840123456', // 10-digit phone
    };

    const preview = previewFitmentMerge(existingVehicle, extracted);

    assert.equal(preview.patch.gps_sim_no, '9840123456', 'gps_sim_no filled when previously null');
    assert.equal(preview.patch.metadata_patch.fitment.sim_number, '9840123456');
  });

  it('5. Fill-only: existing model, gps_sim_no, chassisNo and engineNo are NOT overwritten without overwrite_fields', () => {
    const existingVehicle = {
      id: 'v-uuid-3',
      plate: 'AP09AB9999',
      imei: '860123456789012',
      model: 'ORIGINAL_MODEL',
      gps_sim_no: '9999999999',
      metadata: {
        chassisNo: 'ORIGINAL_CHASSIS',
        engineNo: 'ORIGINAL_ENGINE'
      }
    };

    const extracted = {
      imei_number: '860123456789012',
      model: 'NEW_MODEL',
      sim_number: '8888888888',
      chassis_no: 'NEW_CHASSIS',
      engine_no: 'NEW_ENGINE'
    };

    // Default: overwrite_fields is empty
    const preview = previewFitmentMerge(existingVehicle, extracted, {}, []);

    assert.equal(preview.patch.model, 'ORIGINAL_MODEL', 'model must not be overwritten');
    assert.equal(preview.patch.gps_sim_no, '9999999999', 'gps_sim_no must not be overwritten');
    assert.equal(preview.patch.metadata_patch.chassisNo, 'ORIGINAL_CHASSIS', 'chassisNo must not be overwritten');
    assert.equal(preview.patch.metadata_patch.engineNo, 'ORIGINAL_ENGINE', 'engineNo must not be overwritten');

    // With explicit overwrite_fields
    const previewWithOverwrite = previewFitmentMerge(existingVehicle, extracted, {}, ['model', 'chassisNo']);
    assert.equal(previewWithOverwrite.patch.model, 'NEW_MODEL', 'model can be overwritten when explicitly requested');
    assert.equal(previewWithOverwrite.patch.metadata_patch.chassisNo, 'NEW_CHASSIS');
    assert.equal(previewWithOverwrite.patch.gps_sim_no, '9999999999', 'gps_sim_no remains unchanged');
  });

  it('6. Certificate ownerName and ownerAddress are NEVER written to vehicle top-level metadata', () => {
    const existingVehicle = {
      id: 'v-uuid-4',
      plate: 'KA04CD5678',
      imei: '860123456789012',
      metadata: {}
    };

    const extracted = {
      imei_number: '860123456789012',
      customer_name: 'Fleet Logistics Pvt Ltd',
      customer_address: 'Plot 44, Peenya Industrial Area, Bangalore'
    };

    const preview = previewFitmentMerge(existingVehicle, extracted);

    assert.equal(preview.patch.metadata_patch.ownerName, undefined, 'ownerName must not be at top level');
    assert.equal(preview.patch.metadata_patch.ownerAddress, undefined, 'ownerAddress must not be at top level');
    assert.equal(preview.patch.metadata_patch.fitment.customer_name, 'Fleet Logistics Pvt Ltd');
    assert.equal(preview.patch.metadata_patch.fitment.customer_address, 'Plot 44, Peenya Industrial Area, Bangalore');
  });

  it('7. Luhn check: invalid IMEI generates a warning but does NOT reject confirmation', () => {
    const existingVehicle = {
      id: 'v-uuid-5',
      plate: 'DL01EF1111',
      imei: '860123456789010' // Intentionally bad check digit
    };

    const extracted = {
      imei_number: '860123456789010'
    };

    const preview = previewFitmentMerge(existingVehicle, extracted);

    assert.ok(
      preview.warnings.some(w => w.includes('INVALID_IMEI_LUHN')),
      'Luhn failure should be flagged as a warning'
    );
    assert.ok(preview.patch, 'Merge patch should still be generated successfully');
  });

  it('8. Missing IMEI throws IMEI_NOT_VERIFIABLE error', () => {
    const existingVehicle = {
      id: 'v-uuid-6',
      plate: 'DL01EF1111',
      imei: null
    };

    const extracted = {
      plate: 'DL01EF1111'
      // No IMEI
    };

    assert.throws(
      () => previewFitmentMerge(existingVehicle, extracted),
      (err) => {
        assert.equal(err.code, 'IMEI_NOT_VERIFIABLE');
        return true;
      }
    );
  });
});

