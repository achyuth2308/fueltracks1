// ============================================================
// PUBLIC API ROUTES — FuelTracks v3
// Third-party client integration endpoints
// Base path: /api/v1
// Auth: X-API-Key header
//
// CHANGELOG:
//  v2 — Civil Supply integration:
//       POST /api/v1/location/history  (new)
//       GET  /api/v1/vehicles          (new)
//  v3 — Cement OMS integration:
//       POST   /api/v1/webhooks        (new) — register push endpoint
//       GET    /api/v1/webhooks        (new) — list registered webhooks
//       DELETE /api/v1/webhooks/:id    (new) — remove a webhook
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
  registerWebhook,
  listWebhooks,
  deleteWebhook,
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

// ──────────────────────────────────────────────────────────────
// WEBHOOK MANAGEMENT  [NEW in v3 — Cement OMS Integration]
// ──────────────────────────────────────────────────────────────

/**
 * POST /api/v1/webhooks
 * Register an endpoint URL to receive real-time GPS push events.
 * Body: { "url": "https://...", "secret": "optional_hmac_secret", "label": "optional_label" }
 * FuelTracks will POST a { event, timestamp, data } payload to this URL on every GPS packet.
 * Max 5 webhooks per org.
 */
router.post('/webhooks', registerWebhook);

/**
 * GET /api/v1/webhooks
 * List all webhook registrations for your organization.
 */
router.get('/webhooks', listWebhooks);

/**
 * DELETE /api/v1/webhooks/:id
 * Remove a registered webhook by its UUID.
 * FuelTracks will immediately stop sending GPS events to that URL.
 */
router.delete('/webhooks/:id', deleteWebhook);


module.exports = router;

