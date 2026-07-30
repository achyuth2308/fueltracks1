// ============================================================
// ALERTS API CLIENT
// All calls to /api/alerts endpoints
// ============================================================

import axiosInstance from './axios';

const alertsApi = {
  /**
   * Get paginated alerts for the current user's org
   * @param {object} params - { page, limit, alertType }
   */
  getAlerts(params = {}) {
    return axiosInstance.get('/api/alerts', { params }).then(r => r.data);
  },

  /**
   * Mark a single alert as read
   * @param {string} alertId
   */
  markAlertRead(alertId) {
    return axiosInstance.put(`/api/alerts/${alertId}/read`).then(r => r.data);
  },

  /**
   * Mark all alerts as read
   */
  markAllRead() {
    return axiosInstance.put('/api/alerts/read-all').then(r => r.data);
  },

  /**
   * Get the current user's alert notification preferences
   */
  getPreferences() {
    return axiosInstance.get('/api/alerts/preferences').then(r => r.data);
  },

  /**
   * Save the current user's alert notification preferences
   * @param {object} preferences - { overspeed: true, ignition_on: false, ... }
   */
  updatePreferences(preferences) {
    return axiosInstance.put('/api/alerts/preferences', { preferences }).then(r => r.data);
  },

  /**
   * Register an FCM device token
   * @param {string} fcmToken
   * @param {object} deviceInfo
   */
  registerFcmToken(fcmToken, deviceInfo = {}) {
    return axiosInstance.post('/api/alerts/fcm-token', { fcmToken, deviceInfo }).then(r => r.data);
  },

  /**
   * Remove an FCM device token (on logout)
   * @param {string} fcmToken
   */
  removeFcmToken(fcmToken) {
    return axiosInstance.delete('/api/alerts/fcm-token', { data: { fcmToken } }).then(r => r.data);
  },
};

export default alertsApi;
