// ============================================================
// BILLING ROUTES (CUSTOMER)
// ============================================================

const express = require('express');
const BillingController = require('../controllers/billingController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/renewal-settings', BillingController.getRenewalSettings);
router.post('/renewal/verify', BillingController.verifyRenewal);

module.exports = router;
