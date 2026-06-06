const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate } = require('../../../middleware/auth'); // Check path

// Apply auth middleware to all report routes
router.use(authenticate);

router.get('/trip', (req, res, next) => reportController.getTripReport(req, res, next));
router.get('/distance', (req, res, next) => reportController.getDailyDistanceReport(req, res, next));
router.get('/activity', (req, res, next) => reportController.getVehicleActivityReport(req, res, next));
router.get('/route-history', (req, res, next) => reportController.getRouteHistoryReport(req, res, next));
router.get('/ignition', (req, res, next) => reportController.getIgnitionReport(req, res, next));
router.get('/dashboard', (req, res, next) => reportController.getDashboardStats(req, res, next));

module.exports = router;
