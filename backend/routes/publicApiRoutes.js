// ============================================================
// PUBLIC API ROUTES — FuelTracks v2
// Third-party client integration endpoints
// Base path: /api/v1
// Auth: X-API-Key header
//
// CHANGELOG:
//  v2 — Civil Supply integration:
//       POST /api/v1/location/history  (new)
//       GET  /api/v1/vehicles          (new)
// ============================================================

const express = require('express');
const router  = express.Router();

const { authenticateApiKey } = require('../middleware/apiKeyAuth');
const {
  getLiveLocation,
  postLiveLocation,
  getHistory,
  postHistory,
  getVehicleList,
} = require('../controllers/publicApiController');

// Apply API key auth to ALL routes in this router
router.use(authenticateApiKey);

// ──────────────────────────────────────────────────────────────
// VEHICLE DIRECTORY
// ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/vehicles
 * Returns a list of all vehicles the API key is scoped to see.
 * Response: { success, count, vehicles: [{ vehicleRegistrationNumber, imei, name }] }
 */
router.get('/vehicles', getVehicleList);

// ──────────────────────────────────────────────────────────────
// LIVE LOCATION
// ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/location/live
 * Returns the latest known GPS position for all vehicles in your org/group.
 * Optional: ?imei=<device_imei>  (filter to a single vehicle)
 */
router.get('/location/live', getLiveLocation);

/**
 * POST /api/v1/location/live
 * Client sends vehicle identifiers in the request body.
 *
 * By IMEI (single):
 *   { "imei": "869925070566102" }
 *
 * By IMEI (batch, max 100):
 *   { "imeis": ["869925070566102", "867440068994847"] }
 *
 * By Registration Number (Civil Supply legacy format):
 *   { "user_id": "srsl", "vehicle_id": "WB11E1543" }
 *
 * By Registration Number (canonical format):
 *   { "vehicleRegistrationNumber": "WB11E1543" }
 *
 * By Registration Number (batch):
 *   { "plates": ["WB11E1543", "KA01AB1234"] }
 */
router.post('/location/live', postLiveLocation);

// ──────────────────────────────────────────────────────────────
// HISTORY
// ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/location/history
 * Returns paginated GPS history for a specific vehicle.
 * Required: ?imei=<device_imei>&start=YYYY-MM-DD&end=YYYY-MM-DD
 * Optional: ?page=1&limit=500
 */
router.get('/location/history', getHistory);

/**
 * POST /api/v1/location/history  [NEW in v2]
 * Same as GET history but parameters are passed in the JSON body.
 * Supports lookup by IMEI or vehicle registration number.
 *
 * By IMEI:
 *   { "imei": "869925070566102", "start": "2026-08-25", "end": "2026-08-26" }
 *
 * By Registration Number (Civil Supply format):
 *   { "user_id": "srsl", "vehicle_id": "WB11E1543", "start": "2026-08-25", "end": "2026-08-26" }
 *
 * By Registration Number (canonical):
 *   { "vehicleRegistrationNumber": "WB11E1543", "start": "2026-08-25", "end": "2026-08-26" }
 *
 * Optional: "page" (default 1), "limit" (default 500, max 1000)
 */
router.post('/location/history', postHistory);


module.exports = router;
