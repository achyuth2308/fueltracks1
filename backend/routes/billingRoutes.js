// ============================================================
// BILLING ROUTES (CUSTOMER)
// ============================================================

const express = require('express');
const BillingController = require('../controllers/billingController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/renewal-plans', BillingController.getRenewalPlans);
router.get('/vehicle-price/:vehicleId', BillingController.getVehiclePrice);
router.post('/renewal/verify', BillingController.verifyRenewal);

module.exports = router;
