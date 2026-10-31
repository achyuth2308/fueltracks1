// ============================================================
// WHATSAPP RECIPIENT CONTROLLER
// Manages opt-in recipients, consent audits, and org settings
// Scoped by tenant hierarchy (superadmin > dealer > customer)
// ============================================================

'use strict';

const db = require('../config/db');
const { normalizePhone, maskPhone } = require('../utils/phone');

/**
 * Helper to enforce tenant access boundaries
 */
async function resolveTenantOrgId(req, targetOrgId) {
  const { role, orgId: userOrgId } = req.user;

  if (role === 'superadmin') {
    return targetOrgId || userOrgId;
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

  // Customer role: strictly own org. If a different targetOrgId is requested, throw 403 Forbidden!
  if (targetOrgId && targetOrgId !== userOrgId) {
    const err = new Error('Access denied to this organization');
    err.status = 403;
    throw err;
  }

  return userOrgId;
}

const WhatsAppRecipientController = {
  /**
   * GET /api/whatsapp/recipients
   * List recipients for the organization and candidate phone suggestions
   */
  async getRecipients(req, res, next) {
    try {
      const orgId = await resolveTenantOrgId(req, req.query.orgId);

      const recipientsQuery = `
        SELECT id, org_id, name, phone_e164, role, opt_in, opt_in_at, opt_in_source,
               opt_out_at, receive_refill, receive_theft, receive_daily_report,
               vehicle_scope, created_at, updated_at
        FROM whatsapp_recipients
        WHERE org_id = $1
        ORDER BY created_at DESC
      `;
      const { rows: recipients } = await db.query(recipientsQuery, [orgId]);

      // Mask phones for UI presentation while preserving e164 in object
      const formatted = recipients.map(r => ({
        ...r,
        phone_masked: maskPhone(r.phone_e164)
      }));

      // Candidate suggestions from org, users, and drivers
      const suggestionsQuery = `
        SELECT DISTINCT phone, source FROM (
          SELECT phone, 'Organization Phone' as source FROM organizations WHERE id = $1 AND phone IS NOT NULL AND phone != ''
          UNION
          SELECT phone, 'User Phone' as source FROM users WHERE org_id = $1 AND phone IS NOT NULL AND phone != ''
          UNION
          SELECT driver_phone as phone, 'Driver Phone' as source FROM vehicles WHERE org_id = $1 AND driver_phone IS NOT NULL AND driver_phone != ''
        ) candidates
        WHERE phone IS NOT NULL
        LIMIT 20
      `;
      const { rows: candidateRows } = await db.query(suggestionsQuery, [orgId]);

      const existingPhones = new Set(recipients.map(r => r.phone_e164));
      const suggestions = candidateRows
        .map(c => {
          const norm = normalizePhone(c.phone);
          return norm ? { raw: c.phone, normalized: norm, masked: maskPhone(norm), source: c.source } : null;
        })
        .filter(s => s && !existingPhones.has(s.normalized));

      res.status(200).json({
        success: true,
        data: formatted,
        suggestions
      });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ success: false, error: err.message });
      next(err);
    }
  },

  /**
   * POST /api/whatsapp/recipients
   * Create recipient. Setting opt_in=true requires explicit consent confirmation.
   */
  async createRecipient(req, res, next) {
    try {
      const {
        name,
        phone,
        role = 'other',
        optIn = false,
        consentConfirmed = false,
        receiveRefill = true,
        receiveTheft = true,
        receiveDailyReport = true,
        vehicleScope = null
      } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, error: 'Recipient name is required' });
      }

      // Input length caps
      if (name.trim().length > 100) {
        return res.status(400).json({ success: false, error: 'Recipient name must not exceed 100 characters' });
      }

      if (vehicleScope && Array.isArray(vehicleScope) && vehicleScope.length > 500) {
        return res.status(400).json({ success: false, error: 'Vehicle scope array cannot exceed 500 vehicles' });
      }

      const normalizedPhone = normalizePhone(phone);
      if (!normalizedPhone) {
        return res.status(400).json({ success: false, error: 'Invalid phone number. Please provide a valid 10-digit mobile or international format.' });
      }

      const orgId = await resolveTenantOrgId(req, req.body.orgId);

      // Explicit consent validation check
      if (optIn && !consentConfirmed) {
        return res.status(400).json({
          success: false,
          error: 'Explicit consent confirmation is required before enabling WhatsApp notifications for this phone number.'
        });
      }

      const isOptIn = Boolean(optIn && consentConfirmed);
      const optInAt = isOptIn ? new Date() : null;
      const optInSource = isOptIn ? 'dashboard' : null;

      const insertQuery = `
        INSERT INTO whatsapp_recipients (
          org_id, name, phone_e164, role, opt_in, opt_in_at, opt_in_source,
          receive_refill, receive_theft, receive_daily_report, vehicle_scope, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;

      const { rows } = await db.query(insertQuery, [
        orgId,
        name.trim(),
        normalizedPhone,
        role,
        isOptIn,
        optInAt,
        optInSource,
        Boolean(receiveRefill),
        Boolean(receiveTheft),
        Boolean(receiveDailyReport),
        vehicleScope ? JSON.stringify(vehicleScope) : null,
        req.user.userId || null
      ]);

      const created = rows[0];
      created.phone_masked = maskPhone(created.phone_e164);

      console.log(`[WHATSAPP] Added recipient ${created.name} (${created.phone_masked}) in org ${orgId} (opt_in: ${isOptIn})`);

      res.status(201).json({
        success: true,
        data: created,
        message: 'WhatsApp recipient added successfully'
      });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ success: false, error: err.message });
      if (err.code === '23505') {
        return res.status(409).json({
          success: false,
          error: 'A WhatsApp recipient with this phone number already exists for this organization.'
        });
      }
      next(err);
    }
  },

  /**
   * PUT /api/whatsapp/recipients/:id
   * Update recipient details & alert preferences
   */
  async updateRecipient(req, res, next) {
    try {
      const { id } = req.params;
      const {
        name,
        role,
        optIn,
        consentConfirmed,
        receiveRefill,
        receiveTheft,
        receiveDailyReport,
        vehicleScope
      } = req.body;

      // Find recipient & check tenant access
      const existing = await db.query('SELECT * FROM whatsapp_recipients WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Recipient not found' });
      }

      const recipient = existing.rows[0];
      // STRICT IDOR CHECK: Ensure actor has access to this recipient's org
      await resolveTenantOrgId(req, recipient.org_id);

      const updates = [];
      const values = [];
      let idx = 1;

      if (name !== undefined) {
        if (!name.trim()) return res.status(400).json({ success: false, error: 'Recipient name cannot be empty' });
        updates.push(`name = $${idx++}`);
        values.push(name.trim());
      }
      if (role !== undefined) {
        updates.push(`role = $${idx++}`);
        values.push(role);
      }
      if (receiveRefill !== undefined) {
        updates.push(`receive_refill = $${idx++}`);
        values.push(Boolean(receiveRefill));
      }
      if (receiveTheft !== undefined) {
        updates.push(`receive_theft = $${idx++}`);
        values.push(Boolean(receiveTheft));
      }
      if (receiveDailyReport !== undefined) {
        updates.push(`receive_daily_report = $${idx++}`);
        values.push(Boolean(receiveDailyReport));
      }
      if (vehicleScope !== undefined) {
        updates.push(`vehicle_scope = $${idx++}`);
        values.push(vehicleScope ? JSON.stringify(vehicleScope) : null);
      }

      // Opt-in / Opt-out transition handling
      if (optIn !== undefined) {
        if (optIn && !recipient.opt_in) {
          if (!consentConfirmed) {
            return res.status(400).json({
              success: false,
              error: 'Explicit consent confirmation is required to activate WhatsApp notifications.'
            });
          }
          updates.push(`opt_in = true, opt_in_at = NOW(), opt_in_source = 'dashboard', opt_out_at = NULL`);
        } else if (!optIn && recipient.opt_in) {
          updates.push(`opt_in = false, opt_out_at = NOW()`);
        }
      }

      updates.push(`updated_at = NOW()`);
      values.push(id);

      const updateQuery = `
        UPDATE whatsapp_recipients
        SET ${updates.join(', ')}
        WHERE id = $${idx}
        RETURNING *
      `;

      const { rows } = await db.query(updateQuery, values);
      const updated = rows[0];
      updated.phone_masked = maskPhone(updated.phone_e164);

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Recipient updated successfully'
      });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ success: false, error: err.message });
      next(err);
    }
  },

  /**
   * DELETE /api/whatsapp/recipients/:id
   */
  async deleteRecipient(req, res, next) {
    try {
      const { id } = req.params;
      const existing = await db.query('SELECT org_id FROM whatsapp_recipients WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Recipient not found' });
      }

      // STRICT IDOR CHECK
      await resolveTenantOrgId(req, existing.rows[0].org_id);

      await db.query('DELETE FROM whatsapp_recipients WHERE id = $1', [id]);
      res.status(200).json({ success: true, message: 'Recipient deleted successfully' });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ success: false, error: err.message });
      next(err);
    }
  },

  /**
   * GET /api/whatsapp/settings
   */
  async getSettings(req, res, next) {
    try {
      const orgId = await resolveTenantOrgId(req, req.query.orgId);

      const resSettings = await db.query('SELECT * FROM whatsapp_org_settings WHERE org_id = $1', [orgId]);
      if (resSettings.rows.length > 0) {
        return res.status(200).json({ success: true, data: resSettings.rows[0] });
      }

      res.status(200).json({
        success: true,
        data: {
          org_id: orgId,
          daily_report_enabled: true,
          daily_report_time: '07:00',
          daily_report_include_pdf: false,
          max_daily_messages: 1000
        }
      });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ success: false, error: err.message });
      next(err);
    }
  },

  /**
   * PUT /api/whatsapp/settings
   */
  async updateSettings(req, res, next) {
    try {
      const orgId = await resolveTenantOrgId(req, req.body.orgId);
      const {
        dailyReportEnabled = true,
        dailyReportTime = '07:00',
        dailyReportIncludePdf = false,
        maxDailyMessages = 1000
      } = req.body;

      const upsertQuery = `
        INSERT INTO whatsapp_org_settings (org_id, daily_report_enabled, daily_report_time, daily_report_include_pdf, max_daily_messages, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (org_id) DO UPDATE
        SET daily_report_enabled = EXCLUDED.daily_report_enabled,
            daily_report_time = EXCLUDED.daily_report_time,
            daily_report_include_pdf = EXCLUDED.daily_report_include_pdf,
            max_daily_messages = EXCLUDED.max_daily_messages,
            updated_at = NOW()
        RETURNING *
      `;

      const { rows } = await db.query(upsertQuery, [
        orgId,
        Boolean(dailyReportEnabled),
        String(dailyReportTime || '07:00').trim(),
        Boolean(dailyReportIncludePdf),
        parseInt(maxDailyMessages, 10) || 1000
      ]);

      res.status(200).json({
        success: true,
        data: rows[0],
        message: 'WhatsApp organization settings saved successfully'
      });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ success: false, error: err.message });
      next(err);
    }
  }
};

module.exports = WhatsAppRecipientController;
