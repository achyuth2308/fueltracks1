// ============================================================
// DOCUMENT SCAN CONTROLLER
// REST API handlers for document scan lifecycle:
//  - POST /api/v1/document-scans (Enqueue upload -> 202 Accepted)
//  - GET /api/v1/document-scans/:id (Poll status & extracted fields)
//  - GET /api/v1/document-scans/:id/file (Secure download with org isolation)
// ============================================================

const fs = require('fs');
const crypto = require('crypto');
const { getScannerPool } = require('../config/db');
const scannerService = require('../services/documentScanner/scannerService');

class DocumentScanController {
  async createScan(req, res) {
    const file = req.file;
    const orgId = req.user?.orgId;
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

      const pool = getScannerPool();
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
      // Unlink file on unexpected failure
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
    const orgId = req.user?.orgId;

    try {
      const pool = getScannerPool();
      const result = await pool.query(`
        SELECT 
          id AS job_id,
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
        WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL
      `, [scanId, orgId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          code: 'SCAN_NOT_FOUND',
          error: 'Document scan not found or access denied.'
        });
      }

      const scan = result.rows[0];
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
    }
  }

  async downloadScanFile(req, res) {
    const scanId = req.params.id;
    const orgId = req.user?.orgId;

    try {
      const pool = getScannerPool();
      const result = await pool.query(`
        SELECT file_path, file_name, mime_type, status
        FROM document_scans
        WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL
      `, [scanId, orgId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          code: 'SCAN_NOT_FOUND',
          error: 'Document scan not found.'
        });
      }

      const scan = result.rows[0];
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
    }
  }
}

module.exports = new DocumentScanController();
