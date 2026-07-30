// ============================================================
// ALERTS CONTROLLER
// REST handlers for user-facing alert history, preferences, and FCM tokens
// ============================================================

const GpsModel = require('../models/gpsModel');

// ── Alert History ─────────────────────────────────────────────────────────────

/**
 * GET /api/alerts
 * Returns paginated alerts for the calling user's organisation
 */
async function getAlerts(req, res, next) {
  try {
    const { orgId } = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const alertType = req.query.alertType || null;

    const result = await GpsModel.getAlertsForOrg(orgId, { page, limit, alertType });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/alerts/:id/read
 * Mark a single alert as read
 */
async function markAlertRead(req, res, next) {
  try {
    const { orgId } = req.user;
    const alertId = req.params.id;

    const updated = await GpsModel.markAlertRead(alertId, orgId);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Alert not found or access denied.' });
    }
    res.json({ success: true, message: 'Alert marked as read.' });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/alerts/read-all
 * Mark all org alerts as read
 */
async function markAllRead(req, res, next) {
  try {
    const { orgId } = req.user;
    const count = await GpsModel.markAllAlertsRead(orgId);
    res.json({ success: true, message: `${count} alert(s) marked as read.`, count });
  } catch (err) {
    next(err);
  }
}

// ── Alert Preferences ─────────────────────────────────────────────────────────

/**
 * GET /api/alerts/preferences
 * Return the calling user's alert preference toggles
 */
async function getPreferences(req, res, next) {
  try {
    const { userId } = req.user;
    const preferences = await GpsModel.getUserAlertPreferences(userId);
    res.json({ success: true, preferences });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/alerts/preferences
 * Upsert the calling user's alert preference toggles
 * Body: { preferences: { overspeed: true, ignition_on: false, ... } }
 */
async function updatePreferences(req, res, next) {
  try {
    const { userId } = req.user;
    const { preferences } = req.body;

    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ success: false, error: 'preferences object is required.' });
    }

    // Sanitize — only allow boolean values
    const sanitized = {};
    for (const [key, val] of Object.entries(preferences)) {
      if (typeof val === 'boolean') sanitized[key] = val;
    }

    const saved = await GpsModel.upsertUserAlertPreferences(userId, sanitized);
    res.json({ success: true, preferences: saved });
  } catch (err) {
    next(err);
  }
}

// ── FCM Token Management ──────────────────────────────────────────────────────

/**
 * POST /api/alerts/fcm-token
 * Register or update an FCM device token for the calling user
 * Body: { fcmToken: "...", deviceInfo: { platform: "android", ... } }
 */
async function registerFcmToken(req, res, next) {
  try {
    const { userId } = req.user;
    const { fcmToken, deviceInfo = {} } = req.body;

    if (!fcmToken || typeof fcmToken !== 'string') {
      return res.status(400).json({ success: false, error: 'fcmToken is required.' });
    }

    await GpsModel.registerFcmToken(userId, fcmToken, deviceInfo);
    res.json({ success: true, message: 'FCM token registered.' });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/alerts/fcm-token
 * Remove an FCM token (user logged out or token refreshed)
 * Body: { fcmToken: "..." }
 */
async function removeFcmToken(req, res, next) {
  try {
    const { userId } = req.user;
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ success: false, error: 'fcmToken is required.' });
    }

    await GpsModel.removeFcmToken(userId, fcmToken);
    res.json({ success: true, message: 'FCM token removed.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAlerts,
  markAlertRead,
  markAllRead,
  getPreferences,
  updatePreferences,
  registerFcmToken,
  removeFcmToken,
};
