// ============================================================
// ALERTS ROUTES
// Mounted at: /api/alerts
// ============================================================

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getAlerts,
  markAlertRead,
  markAllRead,
  getPreferences,
  updatePreferences,
  registerFcmToken,
  removeFcmToken,
  deleteAlert,
  clearAllAlerts,
} = require('../controllers/alertsController');

// All routes require authentication
router.use(authenticate);

// Alert preferences
router.get('/preferences', getPreferences);
router.put('/preferences', updatePreferences);

// FCM device tokens
router.post('/fcm-token', registerFcmToken);
router.delete('/fcm-token', removeFcmToken);

// Alert history (Generic routes must be at the bottom)
router.get('/', getAlerts);
router.delete('/', clearAllAlerts);
router.put('/read-all', markAllRead);
router.put('/:id/read', markAlertRead);
router.delete('/:id', deleteAlert);

module.exports = router;
