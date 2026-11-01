// ============================================================
// DOCUMENT SCAN CONTROLLER
// REST API handlers for document scan lifecycle:
//  - POST /api/v1/document-scans (Enqueue upload -> 202 Accepted)
//  - GET /api/v1/document-scans/:id (Poll status & extracted fields)
//  - GET /api/v1/document-scans/:id/file (Secure download with org isolation)
//  - GET /api/v1/document-scans/:id/vehicle-matches (Target vehicle candidates)
//  - POST /api/v1/document-scans/:id/confirm (Transactional merge into vehicles)
// ============================================================

const fs = require('fs');
const crypto = require('crypto');
const { getScannerPool } = require('../config/scannerDb');
const redisConfig = require('../config/redis');
const scannerService = require('../services/documentScanner/scannerService');
const { canAccessOrg } = require('../services/documentScanner/orgScopeService');
const { normalizeRegistrationNo } = require('../services/documentScanner/crossValidator');
const {
  SQL_VERSION_TOKEN_FRAGMENT,
  previewFitmentMerge
} = require('../services/documentScanner/fitmentMergeService');

class DocumentScanController {
  async createScan(req, res) {
    const file = req.file;
    const orgId = req.targetOrgId || req.user?.orgId;
    const userId = req.user?.userId;
    const docTypeHint = req.body?.doc_type_hint || null;
    const consent = req.body?.aadhaar_consent === 'true' || req.body?.aadhaar_consent === true;

    try {
      // 1. Detect mime type by magic bytes
      const detectedMime = scannerService.detectTypeFromMagicBytes(file.path);
      if (!detectedMime) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(400).json({
          success: false,
          code: 'INVALID_FILE_TYPE',
          error: 'File contents do not match supported document formats (PDF, JPG, PNG).'
        });
      }

      // 2. Compute SHA-256 hash for tenant-scoped idempotency
      const fileBytes = fs.readFileSync(file.path);
      const fileHash = crypto.createHash('sha256').update(fileBytes).digest('hex');

      // 3. Aadhaar Consent Check if hint provided
      if (docTypeHint === 'aadhaar' && !consent) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(400).json({
          success: false,
          code: 'AADHAAR_CONSENT_REQUIRED',
          error: 'Explicit user consent (aadhaar_consent: true) is required before processing Aadhaar documents.'
        });
      }

      const pool = getScannerPool('fueltracks-scanner-api');
      const client = await pool.connect();

      try {
        // 4. Idempotency Check: existing active scan with same file_hash for this org
        const dupRes = await client.query(`
          SELECT id, status, created_at FROM document_scans
          WHERE org_id = $1
            AND file_hash = $2
            AND deleted_at IS NULL
            AND status NOT IN ('failed', 'rejected', 'purged')
          LIMIT 1
        `, [orgId, fileHash]);

        if (dupRes.rows.length > 0) {
          // Unlink newly uploaded duplicate file immediately
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
          const existing = dupRes.rows[0];
          return res.status(200).json({
            success: true,
            duplicate: true,
            job_id: existing.id,
            status: existing.status,
            message: 'An identical file has already been uploaded and processed for your organization.'
          });
        }

        // 5. Insert new queued scan record
        const insertRes = await client.query(`
          INSERT INTO document_scans (
            org_id, created_by, status, document_type,
            file_name, file_path, file_hash, file_size, mime_type,
            aadhaar_consent
          ) VALUES ($1, $2, 'queued', $3, $4, $5, $6, $7, $8, $9)
          RETURNING id, status, created_at
        `, [
          orgId,
          userId,
          docTypeHint,
          file.originalname,
          file.path,
          fileHash,
          file.size,
          detectedMime,
          consent
        ]);

        const scan = insertRes.rows[0];

        return res.status(202).json({
          success: true,
          job_id: scan.id,
          status: scan.status,
          created_at: scan.created_at,
          message: 'Document accepted and queued for extraction.'
        });
      } finally {
        client.release();
      }
    } catch (err) {
      if (file && fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch (_) {}
      }
      console.error('[SCAN-CONTROLLER] Upload error:', err.message);
      return res.status(500).json({
        success: false,
        code: 'SCAN_CREATION_FAILED',
        error: 'An internal error occurred while queueing the document scan.'
      });
    }
  }

  async getScanStatus(req, res) {
    const scanId = req.params.id;
    const pool = getScannerPool('fueltracks-scanner-api');
    const client = await pool.connect();

    try {
      const result = await client.query(`
        SELECT 
          id AS job_id,
          org_id,
          status,
          document_type,
          template_id,
          source_used,
          overall_confidence,
          needs_review,
          extracted_data,
          warnings,
          error_code,
          error_message,
          created_at,
          updated_at
        FROM document_scans
        WHERE id = $1 AND deleted_at IS NULL
      `, [scanId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          code: 'SCAN_NOT_FOUND',
          error: 'Document scan not found.'
        });
      }

      const scan = result.rows[0];
      const scope = await canAccessOrg(client, req.user, scan.org_id);
      if (!scope.allowed) {
        return res.status(404).json({
          success: false,
          code: 'SCAN_NOT_FOUND',
          error: 'Document scan not found.'
        });
      }

      delete scan.org_id; // strip internal tenant column from public status payload
      return res.status(200).json({
        success: true,
        data: scan
      });
    } catch (err) {
      console.error('[SCAN-CONTROLLER] Status fetch error:', err.message);
      return res.status(500).json({
        success: false,
        code: 'SCAN_FETCH_FAILED',
        error: 'Failed to retrieve scan status.'
      });
    } finally {
      client.release();
    }
  }

  async downloadScanFile(req, res) {
    const scanId = req.params.id;
    const pool = getScannerPool('fueltracks-scanner-api');
    const client = await pool.connect();

    try {
      const result = await client.query(`
        SELECT file_path, file_name, mime_type, status, org_id
        FROM document_scans
        WHERE id = $1 AND deleted_at IS NULL
      `, [scanId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          code: 'SCAN_NOT_FOUND',
          error: 'Document scan not found.'
        });
      }

      const scan = result.rows[0];
      const scope = await canAccessOrg(client, req.user, scan.org_id);
      if (!scope.allowed) {
        return res.status(404).json({
          success: false,
          code: 'SCAN_NOT_FOUND',
          error: 'Document scan not found.'
        });
      }

      if (scan.status === 'purged' || !fs.existsSync(scan.file_path)) {
        return res.status(410).json({
          success: false,
          code: 'FILE_PURGED',
          error: 'The original document file has been purged per retention policy.'
        });
      }

      res.setHeader('Content-Type', scan.mime_type);
      res.setHeader('Content-Disposition', `inline; filename="${scan.file_name}"`);
      return res.sendFile(scan.file_path);
    } catch (err) {
      console.error('[SCAN-CONTROLLER] Download error:', err.message);
      return res.status(500).json({
        success: false,
        code: 'DOWNLOAD_FAILED',
        error: 'Failed to download scan file.'
      });
    } finally {
      client.release();
    }
  }

  async getVehicleMatches(req, res) {
    const scanId = req.params.id;
    const pool = getScannerPool('fueltracks-scanner-api');
    const client = await pool.connect();

    try {
      // 1. Non-locking read of scan
      const scanRes = await client.query(`
        SELECT id, org_id, status, document_type, extracted_data
        FROM document_scans
        WHERE id = $1 AND deleted_at IS NULL
      `, [scanId]);

      if (scanRes.rows.length === 0) {
        return res.status(404).json({
          success: false,
          code: 'SCAN_NOT_FOUND',
          error: 'Document scan not found.'
        });
      }

      const scan = scanRes.rows[0];

      // 2. Org scope check (404 on failure to prevent information leak)
      const scope = await canAccessOrg(client, req.user, scan.org_id);
      if (!scope.allowed) {
        return res.status(404).json({
          success: false,
          code: 'SCAN_NOT_FOUND',
          error: 'Document scan not found.'
        });
      }

      // 3. Optional plate query parameter override
      let targetPlate = null;
      if (req.query.plate) {
        const norm = normalizeRegistrationNo(req.query.plate);
        if (!norm || !norm.plate) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_PLATE_PARAM',
            error: 'Invalid plate query parameter provided.'
          });
        }
        targetPlate = norm.plate;
      } else {
        targetPlate = scan.extracted_data?.vehicle_registration_no || scan.extracted_data?.registration_no || null;
      }

      const targetImei = scan.extracted_data?.imei_number || scan.extracted_data?.imei || null;

      // 4. Query candidate matching vehicles strictly inside scan.org_id with 2s timeout
      await client.query("SET LOCAL statement_timeout = '2s'");

      const querySql = `
        SELECT 
          v.id,
          v.plate,
          v.imei,
          v.model,
          v.gps_sim_no,
          jsonb_build_object(
            'chassisNo', v.metadata->'chassisNo',
            'engineNo', v.metadata->'engineNo',
            'fitment', v.metadata->'fitment'
          ) AS metadata,
          ${SQL_VERSION_TOKEN_FRAGMENT} AS version_token
        FROM vehicles v
        WHERE v.org_id = $1
          AND v.is_active = TRUE
          AND (
            ($2::text IS NOT NULL AND v.plate = $2)
            OR ($3::text IS NOT NULL AND v.imei = $3)
          )
        LIMIT 10;
      `;

      const matchRes = await client.query(querySql, [scan.org_id, targetPlate, targetImei]);

      return res.status(200).json({
        success: true,
        scan_id: scan.id,
        org_id: scan.org_id,
        search_plate: targetPlate,
        search_imei: targetImei,
        extracted_summary: {
          plate: targetPlate,
          imei: targetImei,
          model: scan.extracted_data?.model || scan.extracted_data?.device_model || null
        },
        matches: matchRes.rows,
        notice: 'Please reload any open vehicle edit page before editing this vehicle'
      });
    } catch (err) {
      console.error('[SCAN-CONTROLLER] Vehicle matches query error:', err.message);
      return res.status(500).json({
        success: false,
        code: 'MATCH_QUERY_FAILED',
        error: 'Failed to retrieve vehicle matches.'
      });
    } finally {
      client.release();
    }
  }

  async confirmScan(req, res) {
    const scanId = req.params.id;
    const { vehicle_id, user_confirmed_data = {}, overwrite_fields = [] } = req.body;

    const pool = getScannerPool('fueltracks-scanner-api');
    const client = await pool.connect();

    try {
      // 1. Non-locking read of scan
      const preScanRes = await client.query(`
        SELECT id, org_id, status, document_type, template_id, extracted_data, user_confirmed_data, vehicle_id
        FROM document_scans
        WHERE id = $1 AND deleted_at IS NULL
      `, [scanId]);

      if (preScanRes.rows.length === 0) {
        return res.status(404).json({
          success: false,
          code: 'SCAN_NOT_FOUND',
          error: 'Document scan not found.'
        });
      }

      const initialScan = preScanRes.rows[0];

      // 2. Org scope check (returns 404 on failure to prevent tenant leak)
      const scope = await canAccessOrg(client, req.user, initialScan.org_id);
      if (!scope.allowed) {
        return res.status(404).json({
          success: false,
          code: 'SCAN_NOT_FOUND',
          error: 'Document scan not found.'
        });
      }

      // 3. Begin Transaction with strict timeouts
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout = '3s'");
      await client.query("SET LOCAL statement_timeout = '10s'");

      // Lock the scan row
      const scanLockRes = await client.query(`
        SELECT id, org_id, status, document_type, template_id, extracted_data, user_confirmed_data, vehicle_id
        FROM document_scans
        WHERE id = $1 AND org_id = $2
        FOR UPDATE
      `, [scanId, initialScan.org_id]);

      if (scanLockRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          code: 'SCAN_NOT_FOUND',
          error: 'Document scan not found.'
        });
      }

      const lockedScan = scanLockRes.rows[0];

      // 4. Idempotency Check: if already confirmed, ignore payload entirely and return stored result
      if (lockedScan.status === 'confirmed') {
        await client.query('COMMIT');
        return res.status(200).json({
          success: true,
          already_confirmed: true,
          scan_id: lockedScan.id,
          vehicle_id: lockedScan.vehicle_id,
          user_confirmed_data: lockedScan.user_confirmed_data,
          message: 'Scan was already confirmed'
        });
      }

      if (!vehicle_id) {
        await client.query('ROLLBACK');
        return res.status(422).json({
          success: false,
          code: 'VEHICLE_ID_REQUIRED',
          error: 'vehicle_id is required for confirmation.'
        });
      }

      // 5. Lock target vehicle strictly matching scan.org_id
      const vehLockRes = await client.query(`
        SELECT id, org_id, plate, imei, model, gps_sim_no, metadata, updated_at
        FROM vehicles
        WHERE id = $1 AND org_id = $2
        FOR UPDATE
      `, [vehicle_id, lockedScan.org_id]);

      if (vehLockRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(422).json({
          success: false,
          code: 'VEHICLE_NOT_FOUND',
          error: 'Target vehicle not found within scan organization.'
        });
      }

      const targetVehicle = vehLockRes.rows[0];
      const lockStartTime = performance.now();

      // 6. Compute pure fitment merge diff and patch
      const mergeResult = previewFitmentMerge(
        targetVehicle,
        lockedScan.extracted_data || {},
        user_confirmed_data || {},
        overwrite_fields || []
      );

      // Store unmasked previous values for changed fields in scan.user_confirmed_data.previous
      const previousChanges = {};
      if (mergeResult.diff.model.changed) previousChanges.model = targetVehicle.model;
      if (mergeResult.diff.gps_sim_no.changed) previousChanges.gps_sim_no = targetVehicle.gps_sim_no;
      if (mergeResult.diff.chassisNo.changed) previousChanges.chassisNo = targetVehicle.metadata?.chassisNo || null;
      if (mergeResult.diff.engineNo.changed) previousChanges.engineNo = targetVehicle.metadata?.engineNo || null;
      if (mergeResult.diff.fitment.changed) previousChanges.fitment = targetVehicle.metadata?.fitment || null;

      const fullUserConfirmed = {
        ...user_confirmed_data,
        previous: previousChanges
      };

      // 7. Update vehicles only if changes exist
      if (mergeResult.has_changes) {
        const topLevelPatch = {};
        if (mergeResult.patch.metadata_patch.chassisNo) {
          topLevelPatch.chassisNo = mergeResult.patch.metadata_patch.chassisNo;
        }
        if (mergeResult.patch.metadata_patch.engineNo) {
          topLevelPatch.engineNo = mergeResult.patch.metadata_patch.engineNo;
        }

        await client.query(`
          UPDATE vehicles
          SET model = $1,
              gps_sim_no = $2,
              metadata = jsonb_set(
                COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
                '{fitment}',
                $4::jsonb
              ),
              updated_at = NOW()
          WHERE id = $5 AND org_id = $6
        `, [
          mergeResult.patch.model,
          mergeResult.patch.gps_sim_no,
          JSON.stringify(topLevelPatch),
          JSON.stringify(mergeResult.patch.metadata_patch.fitment),
          targetVehicle.id,
          lockedScan.org_id
        ]);
      }

      const lockDurationMs = (performance.now() - lockStartTime).toFixed(2);

      // 8. Fetch user details and org name for audit inside same transaction
      let performedByName = req.user.name;
      let performedByEmail = req.user.email;
      if (!performedByName || !performedByEmail) {
        const userRes = await client.query('SELECT name, email FROM users WHERE id = $1', [req.user.userId]);
        if (userRes.rows.length > 0) {
          performedByName = performedByName || userRes.rows[0].name;
          performedByEmail = performedByEmail || userRes.rows[0].email;
        }
      }

      let orgName = scope.org?.name || null;
      if (!orgName) {
        const orgRes = await client.query('SELECT name FROM organizations WHERE id = $1', [lockedScan.org_id]);
        if (orgRes.rows.length > 0) orgName = orgRes.rows[0].name;
      }

      // 9. Prepare masked audit log old_data and new_data
      const maskedOldData = { ...previousChanges };
      if (maskedOldData.fitment) {
        maskedOldData.fitment = { ...maskedOldData.fitment };
        if (maskedOldData.fitment.customer_phone) {
          const ph = String(maskedOldData.fitment.customer_phone);
          maskedOldData.fitment.customer_phone = ph.length > 4 ? `******${ph.slice(-4)}` : ph;
        }
        delete maskedOldData.fitment.customer_address;
      }

      const maskedNewData = {
        model: mergeResult.patch.model,
        gps_sim_no: mergeResult.patch.gps_sim_no,
        chassisNo: mergeResult.patch.metadata_patch.chassisNo,
        engineNo: mergeResult.patch.metadata_patch.engineNo,
        fitment: { ...mergeResult.patch.metadata_patch.fitment },
        audit_metadata: {
          scan_id: lockedScan.id,
          template_id: lockedScan.template_id,
          severity: 'info'
        }
      };
      if (maskedNewData.fitment.customer_phone) {
        const ph = String(maskedNewData.fitment.customer_phone);
        maskedNewData.fitment.customer_phone = ph.length > 4 ? `******${ph.slice(-4)}` : ph;
      }
      delete maskedNewData.fitment.customer_address;

      await client.query(`
        INSERT INTO audit_logs (
          audit_type, entity_type, entity_id, entity_name, action,
          old_data, new_data,
          performed_by_id, performed_by_name, performed_by_email, performed_by_role,
          org_id, org_name, vehicle_id, vehicle_name, ip_address, user_agent, created_at
        ) VALUES (
          'vehicle', 'Vehicle', $1, $2, 'CONFIRMED_FITMENT_SCAN',
          $3, $4,
          $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, NOW()
        )
      `, [
        targetVehicle.id,
        targetVehicle.plate,
        JSON.stringify(maskedOldData),
        JSON.stringify(maskedNewData),
        req.user.userId,
        performedByName || 'Unknown',
        performedByEmail || 'Unknown',
        req.user.role,
        lockedScan.org_id,
        orgName,
        targetVehicle.id,
        targetVehicle.plate,
        req.ip || null,
        req.headers['user-agent'] || null
      ]);

      // 10. Update document_scans status to confirmed (scan.org_id is never changed)
      await client.query(`
        UPDATE document_scans
        SET status = 'confirmed',
            vehicle_id = $1,
            user_confirmed_data = $2,
            updated_at = NOW()
        WHERE id = $3 AND org_id = $4
      `, [
        targetVehicle.id,
        JSON.stringify(fullUserConfirmed),
        lockedScan.id,
        lockedScan.org_id
      ]);

      // 11. Commit Transaction
      await client.query('COMMIT');

      // 12. Post-COMMIT Redis Invalidation (strictly outside transaction)
      try {
        await redisConfig.redis.del('vehicles:all');
        await redisConfig.redis.del(`vehicle:obj:${targetVehicle.id}`);
        if (targetVehicle.imei) {
          await redisConfig.redis.del(`vehicle:imei:${targetVehicle.imei}`);
        }
      } catch (redisErr) {
        console.warn('[CONFIRM-SCAN] Redis cache invalidation warning:', redisErr.message);
      }

      return res.status(200).json({
        success: true,
        scan_id: lockedScan.id,
        vehicle_id: targetVehicle.id,
        target_vehicle: {
          id: targetVehicle.id,
          plate: targetVehicle.plate,
          imei: targetVehicle.imei
        },
        has_changes: mergeResult.has_changes,
        diff: mergeResult.diff,
        warnings: mergeResult.warnings,
        version_token: mergeResult.version_token,
        lock_hold_time_ms: lockDurationMs,
        notice: 'Please reload any open vehicle edit page before editing this vehicle'
      });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      if (err.code === '55P03' || err.code === '57014') {
        return res.status(409).json({
          success: false,
          code: 'LOCKED_RETRY',
          error: 'Vehicle or scan record is currently locked by another operation. Please retry.'
        });
      }
      if (err.code === 'IMEI_NOT_VERIFIABLE') {
        return res.status(422).json({
          success: false,
          code: 'IMEI_NOT_VERIFIABLE',
          error: err.message
        });
      }
      console.error('[CONFIRM-SCAN] Confirm transaction error:', err);
      return res.status(500).json({
        success: false,
        code: 'CONFIRM_FAILED',
        error: 'Failed to confirm document scan.'
      });
    } finally {
      client.release();
    }
  }
}

module.exports = new DocumentScanController();
