// ============================================================
// PUBLIC API ROUTES — FuelTracks v1
// Third-party client integration endpoints
// Base path: /api/v1
// Auth: X-API-Key header
// ============================================================

const express = require('express');
const router = express.Router();

const { authenticateApiKey } = require('../middleware/apiKeyAuth');
const { getLiveLocation, getHistory } = require('../controllers/publicApiController');

// Apply API key auth to ALL routes in this router
router.use(authenticateApiKey);

/**
 * GET /api/v1/location/live
 * Returns the latest known GPS position for all vehicles in your org.
 * Optional: ?imei=<device_imei>  (filter to a single vehicle)
 */
router.get('/location/live', getLiveLocation);

/**
 * GET /api/v1/location/history
 * Returns paginated GPS history for a specific vehicle.
 * Required: ?imei=<device_imei>&start=YYYY-MM-DD&end=YYYY-MM-DD
 * Optional: ?page=1&limit=500
 */
router.get('/location/history', getHistory);

module.exports = router;
