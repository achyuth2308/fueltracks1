const express = require('express');
const router = express.Router();
const manualFuelController = require('../controllers/manualFuelController');
const { authenticate } = require('../../../middleware/auth');

router.use(authenticate);

// Fuel configuration
router.get('/config/:vehicleId', (req, res, next) => manualFuelController.getConfig(req, res, next));
router.post('/config/:vehicleId', (req, res, next) => manualFuelController.saveConfig(req, res, next));

// Fuel live state, overview & chart analytics
router.get('/state/:vehicleId', (req, res, next) => manualFuelController.getState(req, res, next));
router.get('/chart/:vehicleId', (req, res, next) => manualFuelController.getChartData(req, res, next));
router.get('/overview', (req, res, next) => manualFuelController.getOverview(req, res, next));

// Driver manual entries & history
router.post('/entry/:vehicleId', (req, res, next) => manualFuelController.submitEntry(req, res, next));
router.get('/entries/:vehicleId', (req, res, next) => manualFuelController.getEntries(req, res, next));

module.exports = router;
