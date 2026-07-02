// ============================================================
// AUDIT ROUTES — FuelTracks
// Read-only audit log endpoints
// ============================================================

const express = require('express');
const AuditController = require('../controllers/auditController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

const router = express.Router();

// All audit routes require authentication and superadmin/dealer roles
router.use(authenticate);
router.use(authorize('superadmin', 'dealer'));

// GET /api/audit/stats — summary counts for dashboard cards
router.get('/stats', AuditController.getStats);

// GET /api/audit — paginated list with filters
router.get('/', AuditController.getLogs);

// GET /api/audit/:id — single entry detail
router.get('/:id', AuditController.getLogById);

module.exports = router;
