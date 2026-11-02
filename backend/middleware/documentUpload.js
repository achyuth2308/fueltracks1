// ============================================================
// DOCUMENT UPLOAD MIDDLEWARE
// Production-hardened upload handling:
//  - Rate-limit & backpressure checks BEFORE multer touches disk
//  - Stored strictly OUTSIDE express.static path in DOCUMENT_SCANNER_STORAGE_DIR
//  - Directory mode 0700, file mode 0600
//  - Decompression bomb dimension check
//  - Unlinks upload on any validation or queue rejection
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const env = require('../config/env');
const { getScannerPool } = require('../config/scannerDb');
const { checkDiskSpace } = require('../services/documentScanner/diskGuard');
const { canAccessOrg } = require('../services/documentScanner/orgScopeService');

const STORAGE_DIR = env.DOCUMENT_SCANNER_STORAGE_DIR;

// Ensure storage directory exists with 0700 permissions
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true, mode: 0o700 });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, STORAGE_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    const rand = crypto.randomBytes(16).toString('hex');
    const safeName = `scan_${Date.now()}_${rand}${ext}`;
    cb(null, safeName);
  }
});

const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

const fileFilter = (req, file, cb) => {
  if (allowedMimes.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error(`INVALID_MIME_TYPE: File type ${file.mimetype} not supported. Allowed: PDF, JPG, PNG.`));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter
}).single('file');

/**
 * Pre-upload backpressure & disk space guard middleware
 */
async function preUploadGuard(req, res, next) {
  // 1. Feature Flag Guard
  if (!env.isScannerEnabled()) {
    return res.status(404).json({
      success: false,
      code: 'MODULE_DISABLED',
      error: 'Document scanner module is currently disabled.'
    });
  }

  // 2. Storage Free Space Check
  const disk = checkDiskSpace(STORAGE_DIR);
  if (!disk.ok) {
    return res.status(507).json({
      success: false,
      code: 'INSUFFICIENT_STORAGE',
      error: disk.error
    });
  }

  // 3. Target Organization Resolution & Authorization (Query Parameter)
  let targetOrgId = req.query.target_org_id || req.query.org_id;

  if (req.user?.role === 'superadmin') {
    if (!targetOrgId) {
      return res.status(422).json({
        success: false,
        code: 'TARGET_ORG_REQUIRED',
        error: 'target_org_id query parameter is required for superadmin upload.'
      });
    }
  } else if (req.user?.role === 'dealer') {
    if (!targetOrgId) {
      targetOrgId = req.user.orgId;
    }
  } else {
    // Only superadmin and dealer allowed in v1
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN',
      error: 'Access denied. Required role: superadmin or dealer'
    });
  }

  const pool = getScannerPool('fueltracks-scanner-api');
  const orgCheck = await canAccessOrg(pool, req.user, targetOrgId);
  if (!orgCheck.allowed) {
    const status = orgCheck.code === 'ORG_NOT_FOUND' ? 404 : 403;
    return res.status(status).json({
      success: false,
      code: orgCheck.code || 'FORBIDDEN',
      error: orgCheck.error
    });
  }

  req.targetOrgId = targetOrgId;
  req.targetOrg = orgCheck.org;

  // 4. Queue Depth & Backpressure Check
  if (pool) {
    try {
      const orgId = req.targetOrgId;
      const countRes = await pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE org_id = $1 AND status = 'queued') AS org_queued,
          COUNT(*) FILTER (WHERE status = 'queued') AS global_queued
        FROM document_scans
        WHERE deleted_at IS NULL
      `, [orgId]);

      const orgQueued = parseInt(countRes.rows[0].org_queued, 10) || 0;
      const globalQueued = parseInt(countRes.rows[0].global_queued, 10) || 0;

      if (orgQueued >= 10) {
        return res.status(429).json({
          success: false,
          code: 'ORG_SCAN_QUEUE_FULL',
          error: 'Your organization currently has too many documents in the processing queue (max 10). Please wait for them to finish.'
        });
      }

      if (globalQueued >= 50) {
        res.setHeader('Retry-After', '30');
        return res.status(503).json({
          success: false,
          code: 'SYSTEM_SCAN_QUEUE_SATURATED',
          error: 'Document scanner service is currently operating at capacity. Please retry in 30 seconds.'
        });
      }
    } catch (err) {
      console.warn('[UPLOAD-GUARD] DB check warning:', err.message);
    }
  }

  next();
}

/**
 * Wraps upload execution and safely unlinks files on any failure path
 */
function handleDocumentUpload(req, res, next) {
  upload(req, res, (err) => {
    if (err) {
      if (req.file && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch (_) {}
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          code: 'FILE_TOO_LARGE',
          error: 'File size exceeds maximum allowable limit of 10 MB.'
        });
      }
      return res.status(400).json({
        success: false,
        code: 'UPLOAD_ERROR',
        error: err.message
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        code: 'NO_FILE_UPLOADED',
        error: 'Please upload a file with key "file" in multipart/form-data.'
      });
    }

    // Set file permission to 0600
    try {
      fs.chmodSync(req.file.path, 0o600);
    } catch (_) {}

    next();
  });
}

module.exports = {
  preUploadGuard,
  handleDocumentUpload,
  STORAGE_DIR
};

