// ============================================================
// BILLING ROUTES (CUSTOMER)
// ============================================================

const express = require('express');
const BillingController = require('../controllers/billingController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const AdminController = require('../controllers/adminController');
const { authorize } = require('../middleware/rbac');


router.use(authenticate);

router.get('/renewal-plans', BillingController.getRenewalPlans);
router.get('/vehicle-price/:vehicleId', BillingController.getVehiclePrice);
router.post('/renewal/verify', BillingController.verifyRenewal);
router.post('/set-vehicle-amount', authorize('superadmin', 'dealer'), AdminController.setVehicleBillingAmount);

module.exports = router;

