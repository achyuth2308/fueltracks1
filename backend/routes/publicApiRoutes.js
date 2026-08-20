// ============================================================
// PUBLIC API ROUTES — FuelTracks v1
// Third-party client integration endpoints
// Base path: /api/v1
// Auth: X-API-Key header
// ============================================================

const express = require('express');
const router = express.Router();

const { authenticateApiKey } = require('../middleware/apiKeyAuth');
const { getLiveLocation, postLiveLocation, getHistory } = require('../controllers/publicApiController');

// Apply API key auth to ALL routes in this router
router.use(authenticateApiKey);

/**
 * GET /api/v1/location/live
 * Returns the latest known GPS position for all vehicles in your org.
 * Optional: ?imei=<device_imei>  (filter to a single vehicle)
 */
router.get('/location/live', getLiveLocation);

/**
 * POST /api/v1/location/live
 * Client sends IMEI(s) in the request body to look up live GPS position.
 *
 * Single vehicle:
 *   Body: { "imei": "869925070566102" }
 *
 * Multiple vehicles (batch, max 100):
 *   Body: { "imeis": ["869925070566102", "867440068994847"] }
 */
router.post('/location/live', postLiveLocation);

/**
 * GET /api/v1/location/history
 * Returns paginated GPS history for a specific vehicle.
 * Required: ?imei=<device_imei>&start=YYYY-MM-DD&end=YYYY-MM-DD
 * Optional: ?page=1&limit=500
 */
router.get('/location/history', getHistory);


module.exports = router;
