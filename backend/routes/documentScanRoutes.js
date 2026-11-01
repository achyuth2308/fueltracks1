// ============================================================
// DOCUMENT SCANNER ROUTES (API v1)
// Production Endpoints:
//  - POST /api/v1/document-scans
//  - GET /api/v1/document-scans/:id
//  - GET /api/v1/document-scans/:id/file
// ============================================================

const express = require('express');
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const redisConfig = require('../config/redis');
const env = require('../config/env');
const { authenticate } = require('../middleware/auth');
const { preUploadGuard, handleDocumentUpload } = require('../middleware/documentUpload');
const DocumentScanController = require('../controllers/documentScanController');

const router = express.Router();

// 1. Feature Flag Guard for all scanner endpoints
router.use((req, res, next) => {
  if (!env.DOCUMENT_SCANNER_ENABLED && process.env.DOCUMENT_SCANNER_ENABLED !== 'true') {
    return res.status(404).json({
      success: false,
      code: 'MODULE_DISABLED',
      error: 'Document scanner module is disabled.'
    });
  }
  next();
});

// 2. JWT Authentication on all scanner routes
router.use(authenticate);

// 3. Distributed Redis Rate Limiter with Fail-Closed Circuit for Scanner
let scanRateLimiter;
try {
  scanRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // 30 requests per org
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `scan_limit_${req.user?.orgId || req.ip}`,
    store: new RedisStore({
      sendCommand: (...args) => redisConfig.redis.call(...args),
      prefix: 'rl_doc_scan:'
    }),
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        code: 'SCAN_RATE_LIMIT_EXCEEDED',
        error: 'Scan upload rate limit exceeded for your organization (max 30 per 15 minutes).'
      });
    }
  });
} catch (err) {
  // If Redis fails, fail closed for scanner endpoints only
  scanRateLimiter = (req, res) => {
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
  scanRateLimiter,
  preUploadGuard,
  handleDocumentUpload,
  DocumentScanController.createScan
);

router.get('/:id', DocumentScanController.getScanStatus);
router.get('/:id/file', DocumentScanController.downloadScanFile);

module.exports = router;
