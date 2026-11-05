// ============================================================
// DOCUMENT SCANNER ROUTES (API v1)
// Production Endpoints:
//  - POST /api/v1/document-scans (Upload)
//  - GET /api/v1/document-scans/:id (Poll status & extracted data)
//  - GET /api/v1/document-scans/:id/file (Download file)
//  - GET /api/v1/document-scans/:id/vehicle-matches (Vehicle match candidates)
//  - POST /api/v1/document-scans/:id/confirm (Confirm & merge into vehicles)
// ============================================================

const express = require('express');
const rateLimit = require('express-rate-limit');
let RedisStore;
try {
  RedisStore = require('rate-limit-redis').RedisStore;
} catch (e) {
  // rate-limit-redis is optional; fallback to default in-memory store if missing
}
const redisConfig = require('../config/redis');
const env = require('../config/env');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { notFoundHandler } = require('../middleware/error');
const { preUploadGuard, handleDocumentUpload } = require('../middleware/documentUpload');
const DocumentScanController = require('../controllers/documentScanController');

const router = express.Router();

// 1. Feature Flag Guard for all scanner endpoints (returns 404 NOT_FOUND as if unmounted)
router.use((req, res, next) => {
  if (!env.isScannerEnabled()) {
    return notFoundHandler(req, res);
  }
  next();
});

// 2. JWT Authentication on all scanner routes
router.use(authenticate);

// 3. Strict RBAC Guard: Superadmin and Dealer ONLY in v1 (matches PUT /vehicles/:id)
router.use(authorize('superadmin', 'dealer'));

// 4. Distributed Redis Rate Limiter for Uploads (Configurable, default 30 per 15m)
const uploadLimit = parseInt(process.env.SCANNER_UPLOAD_RATE_LIMIT || '30', 10);
let scanUploadRateLimiter;
try {
  scanUploadRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: uploadLimit,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { keyGeneratorIpFallback: false, default: false },
    keyGenerator: (req) => `scan_upload_${req.user?.userId || req.ip}`,
    store: (RedisStore && redisConfig.redis) ? new RedisStore({
      sendCommand: (...args) => redisConfig.redis.call(...args),
      prefix: 'rl_doc_upload:'
    }) : undefined,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        code: 'SCAN_RATE_LIMIT_EXCEEDED',
        error: `Scan upload rate limit exceeded (max ${uploadLimit} per 15 minutes).`
      });
    }
  });
} catch (err) {
  scanUploadRateLimiter = (req, res) => {
    res.status(503).json({
      success: false,
      code: 'RATE_LIMITER_UNAVAILABLE',
      error: 'Scanner rate limiting service is unavailable. Please retry later.'
    });
  };
}

// 5. Distributed Redis Rate Limiter for Confirmations (Default 60 per 15m per user)
const confirmLimit = parseInt(process.env.SCANNER_CONFIRM_RATE_LIMIT || '60', 10);
let scanConfirmRateLimiter;
try {
  scanConfirmRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: confirmLimit,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { keyGeneratorIpFallback: false, default: false },
    keyGenerator: (req) => `scan_confirm_${req.user?.userId || req.ip}`,
    store: (RedisStore && redisConfig.redis) ? new RedisStore({
      sendCommand: (...args) => redisConfig.redis.call(...args),
      prefix: 'rl_doc_confirm:'
    }) : undefined,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        code: 'CONFIRM_RATE_LIMIT_EXCEEDED',
        error: `Scan confirmation rate limit exceeded (max ${confirmLimit} per 15 minutes).`
      });
    }
  });
} catch (err) {
  scanConfirmRateLimiter = (req, res) => {
    res.status(503).json({
      success: false,
      code: 'RATE_LIMITER_UNAVAILABLE',
      error: 'Scanner rate limiting service is unavailable. Please retry later.'
    });
  };
}

// ── Endpoints ──────────────────────────────────────────────
router.post(
  '/',
  scanUploadRateLimiter,
  preUploadGuard,
  handleDocumentUpload,
  DocumentScanController.createScan
);

router.get('/:id', DocumentScanController.getScanStatus);
router.get('/:id/file', DocumentScanController.downloadScanFile);
router.get('/:id/vehicle-matches', DocumentScanController.getVehicleMatches);
router.post('/:id/confirm', scanConfirmRateLimiter, DocumentScanController.confirmScan);

module.exports = router;
