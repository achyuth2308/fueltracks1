// ============================================================
// MINING REGISTRATION ROUTES
// ============================================================

const express = require('express');
const router = express.Router();
const MiningRegistrationController = require('../controllers/miningRegistrationController');
const { authenticate } = require('../middleware/auth');

// Google Form & Google Apps Script Webhook (Public webhook receiver)
router.post('/google-form-webhook', MiningRegistrationController.handleGoogleFormWebhook);

// All other registration routes require valid JWT auth
router.use(authenticate);

// Public/User multi-step form submission
router.post(
  '/',
  MiningRegistrationController.uploadMiddleware,
  MiningRegistrationController.submit
);

// Get submissions (scoped by role/tenant)
router.get('/', MiningRegistrationController.getAll);

// Export CSV of submissions (Admin / Dealer)
router.get('/export/csv', MiningRegistrationController.exportCsv);

// Get single submission by ID
router.get('/:id', MiningRegistrationController.getById);

// Update status & notes (Admin / Dealer)
router.patch('/:id/status', MiningRegistrationController.updateStatus);

// Delete submission (Admin)
router.delete('/:id', MiningRegistrationController.deleteRegistration);

module.exports = router;
