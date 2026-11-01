// ============================================================
// DOCUMENT SCANNER PIPELINE SERVICE
// Production-grade execution pipeline:
//  1. Magic bytes intake & type detection
//  2. PDF text layer extraction (skips OCR if text layer complete)
//  3. Image preprocessing & decompression bomb protection
//  4. QR decoding & payload cross-checking
//  5. Lazy OCR adapter with circuit breaker & timeout
//  6. Document & Template classification
//  7. Field extraction (label-anchored & two-column tables)
//  8. Privacy enforcement (immediate Aadhaar masking & HMAC)
//  9. Fenced atomic transaction commit
// ============================================================

const fs = require('fs');
const path = require('path');
const { getScannerPool } = require('../../config/db');
const env = require('../../config/env');
const templateRegistry = require('./templateRegistry');
const { extractPdfTextLayer } = require('./pdfTextExtractor');
const { validateImageHeader, preprocessForOcr } = require('./imagePreprocessor');
const { decodeQrCode, parseQrPayload } = require('./qrDecoder');
const ocrProvider = require('./ocrProvider');
const fieldExtractor = require('./fieldExtractor');
const crossValidator = require('./crossValidator');
const { validateAadhaar, sanitizeAadhaar, redactPii } = require('./privacyService');

class ScannerService {
  /**
   * Detects document mime type from magic bytes in buffer header
   */
  detectTypeFromMagicBytes(filePath) {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);

    if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
      return 'application/pdf';
    }
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
      return 'image/png';
    }
    if (buf[0] === 0xFF && buf[1] === 0xD8) {
      return 'image/jpeg';
    }
    return null;
  }

  /**
   * Processes a claimed document scan job
   */
  async processScanJob(job, workerId = 'worker-1') {
    const pool = getScannerPool();
    const filePath = job.file_path;
    const orgId = job.org_id;
    const consent = Boolean(job.aadhaar_consent);

    const tempFilesToClean = [];

    try {
      if (!fs.existsSync(filePath)) {
        throw { code: 'FILE_NOT_FOUND', message: `Scan file not found on disk: ${filePath}`, permanent: true };
      }

      // Pre-check: If user declared Aadhaar without consent, fail immediately without processing
      if (job.declared_doc_type === 'aadhaar' && !consent) {
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (_) {}
        throw {
          code: 'AADHAAR_CONSENT_REQUIRED',
          message: 'Processing of Aadhaar documents requires explicit user consent under DPDP Act.',
          permanent: true
        };
      }

      // 1. Detect format by magic bytes
      const detectedMime = this.detectTypeFromMagicBytes(filePath);
      if (!detectedMime) {
        throw { code: 'UNSUPPORTED_DOCUMENT_TYPE', message: 'File format not recognized. Allowed types: PDF, JPG, PNG', permanent: true };
      }

      let text = '';
      let lines = [];
      let sourceUsed = 'pdf_text';
      let qrPayload = null;

      // 2. Processing Path: PDF vs Image
      if (detectedMime === 'application/pdf') {
        const pdfRes = await extractPdfTextLayer(filePath);
        if (!pdfRes.hasTextLayer) {
          // Scanned PDF with no embedded text layer: permanent failure per prompt
          throw {
            code: 'SCANNED_PDF_NOT_SUPPORTED',
            message: 'Scanned PDF without embedded text layer is not supported in v1. Please upload an image (JPG/PNG) or digital PDF.',
            permanent: true
          };
        }
        text = pdfRes.fullText;
        lines = pdfRes.lines;
        sourceUsed = 'pdf_text';
      } else {
        // Image Processing (JPG, PNG)
        validateImageHeader(filePath);

        // QR Code Check
        const qrRes = await decodeQrCode(filePath);
        if (qrRes.found) {
          qrPayload = parseQrPayload(qrRes.data);
        }

        // Image Preprocessing (downscale, contrast)
        const prep = await preprocessForOcr(filePath);
        if (prep.isTemp) tempFilesToClean.push(prep.processedPath);

        // OCR Execution
        text = await ocrProvider.recognize(prep.processedPath);
        sourceUsed = qrPayload ? 'qr' : 'ocr';
        lines = text.split('\n').filter(Boolean).map(l => ({ text: l.trim(), items: [] }));
      }

      // 3. Document and Template Classification
      const classification = templateRegistry.classify(text);
      const docType = classification.documentType;
      const templateId = classification.templateId;

      // 4. Privacy Guard: Aadhaar consent check
      if (docType === 'aadhaar' && !consent) {
        // Delete stored file immediately per DPDP rule
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (_) {}

        throw {
          code: 'AADHAAR_CONSENT_REQUIRED',
          message: 'Processing of Aadhaar documents requires explicit user consent under DPDP Act.',
          permanent: true
        };
      }

      // 5. Field Extraction
      const extraction = fieldExtractor.extractFields({
        lines,
        fullText: text,
        source: sourceUsed,
        templateId
      });

      let aadhaarLast4 = null;
      let aadhaarHmac = null;

      // 6. Aadhaar Field Sanitization
      if (docType === 'aadhaar') {
        const aadhaarM = text.match(/\b([2-9]\d{3}\s?\d{4}\s?\d{4})\b/);
        if (aadhaarM) {
          const valRes = validateAadhaar(aadhaarM[1]);
          if (valRes.valid) {
            const sanitized = sanitizeAadhaar(valRes.clean);
            aadhaarLast4 = sanitized.last4;
            aadhaarHmac = sanitized.hmac;
            extraction.fields['aadhaar_number'] = {
              value: sanitized.masked,
              confidence: 0.98,
              source: sourceUsed,
              validated: true,
              warnings: []
            };
          }
        }
      }

      // 7. Cross-Validation
      const crossWarnings = await crossValidator.crossValidate({
        fields: extraction.fields,
        qrPayload,
        orgId
      });
      const allWarnings = [...(extraction.warnings || []), ...crossWarnings];

      // 8. Overall Confidence & Review Status
      const confThreshold = env.DOCUMENT_SCANNER_CONFIDENCE_THRESHOLD || 0.85;
      let needsReview = false;
      let totalConf = 0;
      let countConf = 0;

      for (const [k, f] of Object.entries(extraction.fields)) {
        if (f.value !== null) {
          totalConf += f.confidence;
          countConf++;
          if (f.confidence < confThreshold || !f.validated) {
            needsReview = true;
          }
        }
      }

      // Priority field presence checks
      if (docType === 'fitment_certificate') {
        if (!extraction.fields['vehicle_registration_no']?.value ||
            !extraction.fields['imei_number']?.value ||
            !extraction.fields['device_name']?.value) {
          needsReview = true;
        }
      }

      if (allWarnings.length > 0 || templateId === 'unknown_template') {
        needsReview = true;
      }

      const overallConfidence = countConf > 0 ? (totalConf / countConf) : 0.5;
      const finalStatus = needsReview ? 'needs_review' : 'done';

      // 9. Fenced Transactional Write
      await this._commitScanResults({
        scanId: job.id,
        workerId,
        status: finalStatus,
        docType,
        templateId,
        sourceUsed,
        overallConfidence,
        needsReview,
        fields: extraction.fields,
        warnings: allWarnings,
        aadhaarLast4,
        aadhaarHmac
      });

      return { success: true, status: finalStatus, docType, templateId };

    } catch (err) {
      const isPermanent = Boolean(err.permanent);
      const errorCode = err.code || 'PROCESSING_ERROR';
      const errorMsg = redactPii(err.message || 'Unknown processing error');

      console.error(`[SCANNER-SERVICE] Job ${job.id} error [${errorCode}]: ${errorMsg}`);

      await this._failScanJob(job.id, workerId, errorCode, errorMsg, isPermanent);
      throw err;
    } finally {
      // Clean up temporary OCR images
      for (const p of tempFilesToClean) {
        try {
          if (fs.existsSync(p)) fs.unlinkSync(p);
        } catch (_) {}
      }
    }
  }

  /**
   * Fenced result write: only updates if worker lock and processing status match
   */
  async _commitScanResults({ scanId, workerId, status, docType, templateId, sourceUsed, overallConfidence, needsReview, fields, warnings, aadhaarLast4, aadhaarHmac }) {
    const pool = getScannerPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Fenced update on document_scans
      const updateRes = await client.query(`
        UPDATE document_scans
        SET status = $1,
            document_type = $2,
            template_id = $3,
            source_used = $4,
            overall_confidence = $5,
            needs_review = $6,
            extracted_data = $7::jsonb,
            warnings = $8::jsonb,
            aadhaar_last4 = $9,
            aadhaar_hmac = $10,
            error_code = NULL,
            error_message = NULL,
            updated_at = NOW()
        WHERE id = $11
          AND status = 'processing'
          AND locked_by = $12
        RETURNING id
      `, [
        status,
        docType,
        templateId,
        sourceUsed,
        overallConfidence,
        needsReview,
        JSON.stringify(fields),
        JSON.stringify(warnings),
        aadhaarLast4,
        aadhaarHmac,
        scanId,
        workerId
      ]);

      if (updateRes.rowCount === 0) {
        throw new Error('FENCE_LOCK_LOST: Scan job lock expired or was claimed by another worker');
      }

      // Delete old field rows if retried
      await client.query('DELETE FROM document_scan_fields WHERE scan_id = $1', [scanId]);

      // Insert per-field records
      for (const [fieldName, field] of Object.entries(fields)) {
        if (field.value !== null) {
          const group = this._determineFieldGroup(fieldName);
          await client.query(`
            INSERT INTO document_scan_fields
              (scan_id, field_group, field_name, extracted_value, normalized_value, confidence, source, validated, warnings)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
          `, [
            scanId,
            group,
            fieldName,
            String(field.value),
            String(field.value),
            field.confidence,
            field.source,
            field.validated,
            JSON.stringify(field.warnings || [])
          ]);
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async _failScanJob(scanId, workerId, errorCode, errorMsg, isPermanent) {
    const pool = getScannerPool();
    const client = await pool.connect();
    try {
      if (isPermanent) {
        await client.query(`
          UPDATE document_scans
          SET status = 'failed',
              error_code = $1,
              error_message = $2,
              updated_at = NOW()
          WHERE id = $3
        `, [errorCode, errorMsg, scanId]);
      } else {
        // Retryable error: backoff
        await client.query(`
          UPDATE document_scans
          SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'queued' END,
              error_code = $1,
              error_message = $2,
              next_attempt_at = NOW() + (POWER(3, LEAST(attempts, 4)) * INTERVAL '10 seconds'),
              updated_at = NOW()
          WHERE id = $3
        `, [errorCode, errorMsg, scanId]);
      }
    } catch (dbErr) {
      console.error('[SCANNER-SERVICE] Failed to update error state:', dbErr.message);
    } finally {
      client.release();
    }
  }

  _determineFieldGroup(fieldName) {
    if (['certificate_number', 'issued_date', 'installation_date', 'expiry_date', 'verification_code'].includes(fieldName)) {
      return 'certificate';
    }
    if (['vehicle_registration_no', 'vehicle_type', 'make_model', 'chassis_number', 'engine_number'].includes(fieldName)) {
      return 'vehicle';
    }
    if (['owner_name', 'customer_phone', 'customer_address'].includes(fieldName)) {
      return 'customer';
    }
    if (['device_name', 'imei_number', 'sim_number', 'serial_number', 'sim_operator', 'seal_number'].includes(fieldName)) {
      return 'device';
    }
    if (['installer_name', 'installer_contact_number'].includes(fieldName)) {
      return 'installer';
    }
    return 'general';
  }
}

module.exports = new ScannerService();
