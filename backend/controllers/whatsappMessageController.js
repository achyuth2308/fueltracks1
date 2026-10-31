// ============================================================
// WHATSAPP MESSAGE CONTROLLER
// Outbox log monitoring and manual retry management
// Scoped by tenant hierarchy (superadmin > dealer > customer)
// ============================================================

'use strict';

const db = require('../config/db');
const { maskPhone } = require('../utils/phone');
const { processOutboxBatch } = require('../jobs/whatsappWorker');

/**
 * Helper to enforce tenant access boundaries
 */
async function resolveTenantOrgId(req, targetOrgId) {
  const { role, orgId: userOrgId } = req.user;

  if (role === 'superadmin') {
    return targetOrgId || null;
  }

  if (role === 'dealer') {
    if (!targetOrgId || targetOrgId === userOrgId) return userOrgId;
    const res = await db.query('SELECT id FROM organizations WHERE id = $1 AND parent_id = $2', [targetOrgId, userOrgId]);
    if (res.rows.length === 0) {
      const err = new Error('Access denied to this organization');
      err.status = 403;
      throw err;
    }
    return targetOrgId;
  }

  // Customer role: strictly own org. If targetOrgId provided and does not match, throw 403!
  if (targetOrgId && targetOrgId !== userOrgId) {
    const err = new Error('Access denied to this organization');
    err.status = 403;
    throw err;
  }

  return userOrgId;
}

const WhatsAppMessageController = {
  /**
   * GET /api/whatsapp/messages
   * Paginated log of WhatsApp outbox messages with filters
   */
  async getMessages(req, res, next) {
    try {
      const orgId = await resolveTenantOrgId(req, req.query.orgId);
      const rawPage = parseInt(req.query.page, 10);
      const rawLimit = parseInt(req.query.limit, 10);

      const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
      const limit = isNaN(rawLimit) || rawLimit < 1 ? 20 : Math.min(100, rawLimit);
      const offset = (page - 1) * limit;

      const { status, eventType } = req.query;

      const conditions = [];
      const params = [];
      let idx = 1;

      if (orgId) {
        conditions.push(`m.org_id = $${idx++}`);
        params.push(orgId);
      }
      if (status) {
        conditions.push(`m.status = $${idx++}`);
        params.push(status);
      }
      if (eventType) {
        conditions.push(`m.event_type = $${idx++}`);
        params.push(eventType);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countQuery = `
        SELECT COUNT(m.id)::int as total
        FROM whatsapp_messages m
        ${whereClause}
      `;
      const { rows: countRows } = await db.query(countQuery, params);
      const total = countRows[0]?.total || 0;

      const selectQuery = `
        SELECT m.id, m.org_id, m.recipient_id, m.phone_masked, m.event_type, m.event_ref,
               m.template_name, m.language, m.payload, m.status, m.wamid,
               m.error_code, m.error_message, m.attempts, m.next_attempt_at,
               m.sent_at, m.delivered_at, m.read_at, m.created_at, m.updated_at,
               r.name as recipient_name, o.name as org_name
        FROM whatsapp_messages m
        LEFT JOIN whatsapp_recipients r ON m.recipient_id = r.id
        LEFT JOIN organizations o ON m.org_id = o.id
        ${whereClause}
        ORDER BY m.id DESC
        LIMIT $${idx++} OFFSET $${idx++}
      `;
      params.push(limit, offset);

      const { rows: messages } = await db.query(selectQuery, params);

      res.status(200).json({
        success: true,
        data: messages,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ success: false, error: err.message });
      next(err);
    }
  },

  /**
   * POST /api/whatsapp/messages/:id/retry
   * Manually reset a failed or dead message back to queued
   */
  async retryMessage(req, res, next) {
    try {
      const { id } = req.params;

      const checkQuery = `SELECT id, org_id, status FROM whatsapp_messages WHERE id = $1`;
      const { rows } = await db.query(checkQuery, [id]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Message not found' });
      }

      const msg = rows[0];
      // STRICT IDOR CHECK
      await resolveTenantOrgId(req, msg.org_id);

      const updateQuery = `
        UPDATE whatsapp_messages
        SET status = 'queued',
            attempts = 0,
            next_attempt_at = NOW(),
            error_code = NULL,
            error_message = NULL,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      const { rows: updatedRows } = await db.query(updateQuery, [id]);

      // Fire outbox processor asynchronously
      setImmediate(() => {
        processOutboxBatch().catch(() => {});
      });

      res.status(200).json({
        success: true,
        data: updatedRows[0],
        message: 'Message requeued successfully for dispatch'
      });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ success: false, error: err.message });
      next(err);
    }
  },

  /**
   * GET /api/whatsapp/queue-status
   * Monitoring & health endpoint for outbox state, daily cap hits, and counts
   */
  async getQueueStatus(req, res, next) {
    try {
      const { getQueueStatus } = require('../jobs/whatsappWorker');
      const status = await getQueueStatus();
      res.status(200).json({
        success: true,
        data: status
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = WhatsAppMessageController;
