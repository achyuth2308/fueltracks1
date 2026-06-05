// ============================================================
// AUDIT SERVICE — FuelTracks
// Isolated service to log all configuration/business changes.
// NEVER logs GPS packets, tracking data, or location events.
//
// Usage (always wrapped in try/catch by caller):
//   try {
//     await AuditService.log({ ... });
//   } catch (err) {
//     console.error('[AUDIT]', err.message);
//   }
// ============================================================

const db = require('../config/db');

const AuditService = {
  /**
   * Log an audit event.
   * This method MUST NOT throw — callers wrap in try/catch but
   * we double-guard here so business flows are never blocked.
   *
   * @param {Object} params
   * @param {string} params.auditType    - 'organization'|'user'|'group'|'vehicle'|'device'|'license'|'login'|'system'
   * @param {string} params.entityType   - 'Organization'|'User'|'Group'|'Vehicle'|'Device'
   * @param {string} [params.entityId]   - UUID or string ID
   * @param {string} [params.entityName] - human-readable name at event time
   * @param {string} params.action       - 'CREATED'|'UPDATED'|'DELETED'|'LOGIN_SUCCESS'|'LOGIN_FAILED'|'LOGOUT'|'REGISTERED'|'ASSIGNED'|'REMOVED'
   * @param {Object} [params.oldData]    - snapshot before change
   * @param {Object} [params.newData]    - snapshot after change
   * @param {string} [params.performedById]
   * @param {string} [params.performedByName]
   * @param {string} [params.performedByEmail]
   * @param {string} [params.performedByRole]
   * @param {string} [params.orgId]
   * @param {string} [params.orgName]
   * @param {string} [params.groupId]
   * @param {string} [params.groupName]
   * @param {string} [params.vehicleId]
   * @param {string} [params.vehicleName]
   * @param {string} [params.deviceId]
   * @param {string} [params.ipAddress]
   * @param {string} [params.userAgent]
   */
  async log(params) {
    try {
      let {
        auditType,
        entityType,
        entityId = null,
        entityName = null,
        action,
        oldData = null,
        newData = null,
        performedById = null,
        performedByName = null,
        performedByEmail = null,
        performedByRole = null,
        orgId = null,
        orgName = null,
        groupId = null,
        groupName = null,
        vehicleId = null,
        vehicleName = null,
        deviceId = null,
        ipAddress = null,
        userAgent = null,
      } = params;

      // Sanitize old/new data — remove password fields for safety
      const sanitize = (obj) => {
        if (!obj) return null;
        const cleaned = { ...obj };
        delete cleaned.password;
        delete cleaned.password_hash;
        return cleaned;
      };

      // Auto-fetch missing user details
      if (performedById && (!performedByName || !performedByEmail || !performedByRole)) {
        try {
          const userRes = await db.query('SELECT name, email, role FROM users WHERE id = $1', [performedById]);
          if (userRes.rows.length > 0) {
            const u = userRes.rows[0];
            if (!performedByName) performedByName = u.name;
            if (!performedByEmail) performedByEmail = u.email;
            if (!performedByRole) performedByRole = u.role;
          }
        } catch (e) { /* ignore db error */ }
      }

      // Auto-fetch missing org details
      if (orgId && !orgName) {
        try {
          const orgRes = await db.query('SELECT name FROM organizations WHERE id = $1', [orgId]);
          if (orgRes.rows.length > 0) {
            orgName = orgRes.rows[0].name;
          }
        } catch (e) { /* ignore db error */ }
      }

      await db.query(
        `INSERT INTO audit_logs (
          audit_type, entity_type, entity_id, entity_name, action,
          old_data, new_data,
          performed_by_id, performed_by_name, performed_by_email, performed_by_role,
          org_id, org_name, group_id, group_name, vehicle_id, vehicle_name, device_id,
          ip_address, user_agent
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7,
          $8, $9, $10, $11,
          $12, $13, $14, $15, $16, $17, $18,
          $19, $20
        )`,
        [
          auditType,
          entityType,
          entityId,
          entityName,
          action,
          oldData ? JSON.stringify(sanitize(oldData)) : null,
          newData ? JSON.stringify(sanitize(newData)) : null,
          performedById,
          performedByName,
          performedByEmail,
          performedByRole,
          orgId,
          orgName,
          groupId,
          groupName,
          vehicleId,
          vehicleName,
          deviceId,
          ipAddress,
          userAgent,
        ]
      );
    } catch (err) {
      // Audit must NEVER crash the calling business flow
      console.error('[AUDIT SERVICE] Failed to write audit log:', err.message);
    }
  },

  /**
   * Helper to extract client IP from Express request
   */
  getIp(req) {
    return (
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      null
    );
  },

  /**
   * Helper to extract User-Agent from Express request
   */
  getUserAgent(req) {
    return req.headers['user-agent'] || null;
  },
};

module.exports = AuditService;
