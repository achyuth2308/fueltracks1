// ============================================================
// AUDIT CONTROLLER — FuelTracks
// Read-only endpoints for querying audit_logs table
// ============================================================

const db = require('../config/db');

const AuditController = {
  /**
   * GET /api/audit
   * Query audit logs with filters and pagination
   */
  async getLogs(req, res, next) {
    try {
      const {
        auditType,
        entityType,
        action,
        startDate,
        endDate,
        search,
        page = 1,
        limit = 50,
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      const conditions = [];
      const params = [];
      let paramIndex = 1;

      // Superadmin sees all; dealers see their org and child orgs
      if (req.user.role !== 'superadmin') {
        conditions.push(`(org_id = $${paramIndex} OR org_id IN (SELECT id FROM organizations WHERE parent_id = $${paramIndex}))`);
        params.push(req.user.orgId);
        paramIndex++;
      }

      if (auditType && auditType !== 'all') {
        conditions.push(`audit_type = $${paramIndex++}`);
        params.push(auditType);
      }

      if (entityType && entityType !== 'all') {
        conditions.push(`entity_type = $${paramIndex++}`);
        params.push(entityType);
      }

      if (action && action !== 'all') {
        conditions.push(`action = $${paramIndex++}`);
        params.push(action);
      }

      if (startDate) {
        conditions.push(`created_at >= $${paramIndex++}`);
        params.push(new Date(startDate));
      }

      if (endDate) {
        let end = new Date(endDate);
        if (endDate.length === 10) {
          end = new Date(endDate + 'T23:59:59.999Z');
        }
        conditions.push(`created_at <= $${paramIndex++}`);
        params.push(end);
      }

      if (search) {
        conditions.push(
          `(entity_name ILIKE $${paramIndex} OR performed_by_name ILIKE $${paramIndex} OR performed_by_email ILIKE $${paramIndex} OR action ILIKE $${paramIndex})`
        );
        params.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count query
      const countResult = await db.query(
        `SELECT COUNT(*) FROM audit_logs ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      // Data query
      const dataResult = await db.query(
        `SELECT * FROM audit_logs ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...params, parseInt(limit), offset]
      );

      res.status(200).json({
        success: true,
        data: dataResult.rows,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/audit/:id
   * Get a single audit log entry with full detail
   */
  async getLogById(req, res, next) {
    try {
      const { id } = req.params;
      const result = await db.query(
        'SELECT * FROM audit_logs WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Audit log not found.',
          code: 'NOT_FOUND',
        });
      }

      const log = result.rows[0];

      // Access control: non-superadmin can only see their org's logs
      if (req.user.role !== 'superadmin' && log.org_id !== req.user.orgId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied.',
          code: 'FORBIDDEN',
        });
      }

      res.status(200).json({ success: true, data: log });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/audit/stats
   * Get summary counts for the audit dashboard cards
   */
  async getStats(req, res, next) {
    try {
      const isSuperadmin = req.user.role === 'superadmin';
      const params = isSuperadmin ? [] : [req.user.orgId];

      // Build WHERE and FILTER clauses statically — orgId passed as bind variable, never interpolated
      const whereClause   = isSuperadmin ? '' : 'WHERE (org_id = $1 OR org_id IN (SELECT id FROM organizations WHERE parent_id = $1))';
      const filterClause  = isSuperadmin ? '' : 'AND (org_id = $1 OR org_id IN (SELECT id FROM organizations WHERE parent_id = $1))';

      const result = await db.query(`
        SELECT
          COUNT(*) as total_logs,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours' ${filterClause}) as today_events,
          COUNT(*) FILTER (WHERE action = 'LOGIN_FAILED' ${filterClause}) as failed_logins,
          COUNT(*) FILTER (WHERE audit_type = 'organization' ${filterClause}) as org_changes,
          COUNT(*) FILTER (WHERE audit_type = 'vehicle' ${filterClause}) as vehicle_changes,
          COUNT(*) FILTER (WHERE audit_type = 'user' ${filterClause}) as user_changes
        FROM audit_logs
        ${whereClause}
      `, params);

      res.status(200).json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = AuditController;
