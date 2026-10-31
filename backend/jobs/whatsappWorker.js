// ============================================================
// WHATSAPP OUTBOX WORKER
// Transactional queue worker claiming rows with SKIP LOCKED
// Retries with exponential backoff, priority claim ordering,
// message expiry, and Meta error categorization.
// Production-hardened:
//  - Never pins DB pool connections across network HTTP I/O
//  - Visibility timeout recovers zombie 'sending' rows on process crash (configurable via env)
//  - Re-verifies opt-in status immediately before dispatch (anti-race)
//  - Enforces daily cost caps per organization in IST days (theft & refill exempt)
//  - Expired messages marked 'expired' and never sent
//  - Prioritizes theft > refill > daily report
//  - In production, pauses worker and logs once/min if credentials missing
// ============================================================

'use strict';

const db = require('../config/db');
const WhatsAppService = require('../services/whatsappService');
const { maskPhone } = require('../utils/phone');

let workerTimer = null;
let isProcessing = false;
let lastTokenAlertTime = 0;
let lastConfigErrorTime = 0;
let lastMaintenanceTime = 0;
let dailyCapCounter = 0;

const DEFAULT_MAX_DAILY_ORG_MESSAGES = parseInt(process.env.WHATSAPP_DEFAULT_MAX_DAILY_MESSAGES, 10) || 1000;

function getVisibilityTimeoutSeconds() {
  if (process.env.WHATSAPP_VISIBILITY_TIMEOUT_SECONDS) {
    return parseInt(process.env.WHATSAPP_VISIBILITY_TIMEOUT_SECONDS, 10);
  }
  const mins = parseInt(process.env.WHATSAPP_VISIBILITY_TIMEOUT_MINUTES, 10) || 5;
  return mins * 60;
}

/**
 * Exponential backoff calculation in seconds: 10s, 30s, 90s, 270s, 810s (capped at 900s)
 */
function getBackoffSeconds(attempts) {
  return Math.min(900, Math.round(10 * Math.pow(3, Math.max(0, attempts - 1))));
}

/**
 * Recover zombie rows stuck in 'sending' state due to an API crash or restart
 */
async function recoverStuckSendingMessages() {
  try {
    const timeoutSec = getVisibilityTimeoutSeconds();
    const res = await db.query(
      `UPDATE whatsapp_messages
       SET status = 'queued',
           next_attempt_at = NOW(),
           updated_at = NOW()
       WHERE status = 'sending'
         AND updated_at < NOW() - ($1 || ' seconds')::interval
       RETURNING id`,
      [String(timeoutSec)]
    );
    if (res.rowCount > 0) {
      console.warn(`[WHATSAPP-WORKER] Visibility timeout (${timeoutSec}s): recovered ${res.rowCount} stuck 'sending' message(s) to 'queued'.`);
    }
    return res.rowCount;
  } catch (err) {
    console.error('[WHATSAPP-WORKER] Failed to recover stuck messages:', err.message);
    return 0;
  }
}

/**
 * Mark messages past their expires_at timestamp as 'expired' so they are never sent
 */
async function markExpiredMessages() {
  try {
    const res = await db.query(
      `UPDATE whatsapp_messages
       SET status = 'expired',
           error_code = 'MESSAGE_EXPIRED',
           error_message = 'Message TTL expired prior to delivery',
           updated_at = NOW()
       WHERE status IN ('queued', 'failed')
         AND expires_at IS NOT NULL
         AND expires_at < NOW()
       RETURNING id`
    );
    if (res.rowCount > 0) {
      console.warn(`[WHATSAPP-WORKER] Marked ${res.rowCount} message(s) as 'expired'.`);
    }
    return res.rowCount;
  } catch (err) {
    console.error('[WHATSAPP-WORKER] Failed to mark expired messages:', err.message);
    return 0;
  }
}

/**
 * Prune historical messages older than retention window (default 90 days)
 */
async function pruneOldMessages(retentionDays = 90) {
  try {
    const res = await db.query(
      `DELETE FROM whatsapp_messages
       WHERE id IN (
         SELECT id FROM whatsapp_messages
         WHERE created_at < NOW() - ($1 || ' days')::interval
           AND status IN ('delivered', 'read', 'dead', 'failed', 'expired')
         LIMIT 1000
       )`,
      [String(retentionDays)]
    );
    return res.rowCount;
  } catch (err) {
    console.error('[WHATSAPP-WORKER] Retention pruning warning:', err.message);
    return 0;
  }
}

/**
 * Queue status helper for /health and management status endpoints
 */
async function getQueueStatus() {
  const env = require('../config/env');
  let state = 'active';
  let reason = null;

  if (!env.WHATSAPP_ENABLED) {
    state = 'disabled';
  } else if (!WhatsAppService.isConfigured()) {
    if (env.NODE_ENV === 'production') {
      state = 'paused';
      reason = 'MISSING_CREDENTIALS';
    } else {
      state = 'mock';
    }
  }

  let counts = {};
  try {
    const res = await db.query(
      `SELECT status, count(*)::int as count FROM whatsapp_messages GROUP BY status`
    );
    res.rows.forEach(r => { counts[r.status] = r.count; });
  } catch (_) {}

  return {
    state,
    reason,
    enabled: env.WHATSAPP_ENABLED,
    isProduction: env.NODE_ENV === 'production',
    dailyCapHits: dailyCapCounter,
    counts
  };
}

/**
 * Process a single batch of queued WhatsApp messages
 */
async function processOutboxBatch() {
  const env = require('../config/env');
  if (!env.WHATSAPP_ENABLED) {
    return;
  }

  // Production check: In production with WHATSAPP_ENABLED=true and missing credentials,
  // do NOT mark messages sent and do NOT run mock mode. Keep them queued/paused and log once/min.
  if (env.NODE_ENV === 'production' && !WhatsAppService.isConfigured()) {
    const now = Date.now();
    if (now - lastConfigErrorTime >= 60000) {
      lastConfigErrorTime = now;
      console.error('[WHATSAPP-WORKER] ERROR: WhatsApp outbox worker paused in production due to missing or invalid Meta credentials. Outbox messages remain queued.');
    }
    return;
  }

  if (isProcessing) return;
  isProcessing = true;

  // 1. Periodic maintenance once every 60s (in test environment, run every batch)
  const nowTs = Date.now();
  if (env.NODE_ENV === 'test' || process.env.NODE_ENV === 'test' || (nowTs - lastMaintenanceTime > 60000)) {
    lastMaintenanceTime = nowTs;
    await markExpiredMessages().catch(() => {});
    await recoverStuckSendingMessages().catch(() => {});
  }

  let messages = [];

  // 2. Claim batch within a SHORT transaction; release client immediately!
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Priority ordering: fuel_theft (1) > fuel_refill (2) > daily_report (3)
    const claimQuery = `
      SELECT m.id, m.org_id, m.recipient_id, m.phone_masked, m.event_type, m.event_ref,
             m.template_name, m.language, m.payload, m.attempts, m.expires_at,
             r.phone_e164, r.opt_in
      FROM whatsapp_messages m
      LEFT JOIN whatsapp_recipients r ON m.recipient_id = r.id
      WHERE m.status IN ('queued', 'failed')
        AND m.next_attempt_at <= NOW()
        AND (m.expires_at IS NULL OR m.expires_at > NOW())
        AND m.attempts < 5
      ORDER BY 
        CASE m.event_type
          WHEN 'fuel_theft' THEN 1
          WHEN 'fuel_refill' THEN 2
          WHEN 'daily_report' THEN 3
          ELSE 4
        END ASC,
        m.id ASC
      LIMIT 20
      FOR UPDATE OF m SKIP LOCKED
    `;

    const { rows } = await client.query(claimQuery);
    messages = rows;

    if (messages.length > 0) {
      const messageIds = messages.map(m => m.id);
      await client.query(
        `UPDATE whatsapp_messages SET status = 'sending', updated_at = NOW() WHERE id = ANY($1::bigint[])`,
        [messageIds]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('[WHATSAPP-WORKER] Claim error:', err.message);
    isProcessing = false;
    return;
  } finally {
    // CRITICAL: DB connection released BEFORE initiating any network calls!
    client.release();
  }

  if (messages.length === 0) {
    isProcessing = false;
    return;
  }

  // 3. Dispatch claimed messages outside of any database transaction
  for (const msg of messages) {
    const masked = msg.phone_masked || maskPhone(msg.phone_e164);

    try {
      // Security Check: Re-verify opt-in right before dispatch (anti-race with inbound STOP)
      if (msg.recipient_id) {
        const recipCheck = await db.query('SELECT opt_in FROM whatsapp_recipients WHERE id = $1', [msg.recipient_id]);
        if (recipCheck.rows.length === 0 || !recipCheck.rows[0].opt_in) {
          console.warn(`[WHATSAPP-WORKER] Skipping message #${msg.id} — recipient ${masked} is opted out.`);
          await db.query(
            `UPDATE whatsapp_messages
             SET status = 'failed', error_code = 'OPTED_OUT', error_message = 'Recipient opted out or not found', updated_at = NOW()
             WHERE id = $1`,
            [msg.id]
          );
          continue;
        }
      } else {
        await db.query(
          `UPDATE whatsapp_messages
            SET status = 'dead', error_code = 'NO_RECIPIENT', error_message = 'No recipient linked to message', updated_at = NOW()
            WHERE id = $1`,
          [msg.id]
        );
        continue;
      }

      // Cost Safety: Check daily org message limit in IST days (Asia/Kolkata).
      // Critical alerts (theft & refill) are strictly EXEMPT from daily cap pausing.
      const isCriticalAlert = (msg.event_type === 'fuel_theft' || msg.event_type === 'fuel_refill');

      if (!isCriticalAlert) {
        const capCheck = await db.query(
          `SELECT
             COUNT(m.id)::int as sent_today,
             COALESCE(s.max_daily_messages, $2)::int as org_limit
           FROM whatsapp_messages m
           LEFT JOIN whatsapp_org_settings s ON s.org_id = $1
           WHERE m.org_id = $1
             AND (m.created_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
             AND m.status IN ('sent', 'delivered', 'read')
           GROUP BY s.max_daily_messages`,
          [msg.org_id, DEFAULT_MAX_DAILY_ORG_MESSAGES]
        );

        let sentToday = 0;
        let effectiveCap = DEFAULT_MAX_DAILY_ORG_MESSAGES;

        if (capCheck.rows.length > 0) {
          sentToday = capCheck.rows[0].sent_today || 0;
          effectiveCap = capCheck.rows[0].org_limit || DEFAULT_MAX_DAILY_ORG_MESSAGES;
        } else {
          const sRes = await db.query('SELECT max_daily_messages FROM whatsapp_org_settings WHERE org_id = $1', [msg.org_id]);
          if (sRes.rows.length > 0 && sRes.rows[0].max_daily_messages != null) {
            effectiveCap = sRes.rows[0].max_daily_messages;
          }
        }

        if (sentToday >= effectiveCap) {
          dailyCapCounter += 1;
          console.error(`[WHATSAPP-WORKER] ERROR: Daily message cap (${sentToday}/${effectiveCap}) reached in IST for org ${msg.org_id}. Non-critical report message #${msg.id} delayed by 1 hour. Total cap hits: ${dailyCapCounter}.`);
          await db.query(
            `UPDATE whatsapp_messages
             SET status = 'failed', error_code = 'DAILY_CAP_REACHED',
                 error_message = 'Organization daily WhatsApp notification limit reached (IST day)',
                 next_attempt_at = NOW() + INTERVAL '1 hour', updated_at = NOW()
             WHERE id = $1`,
            [msg.id]
          );
          continue;
        }
      }

      const destinationPhone = msg.phone_e164;
      if (!destinationPhone) {
        await db.query(
          `UPDATE whatsapp_messages
           SET status = 'dead', error_code = 'NO_PHONE', error_message = 'No phone number available for recipient', updated_at = NOW()
           WHERE id = $1`,
          [msg.id]
        );
        continue;
      }

      const pld = msg.payload || {};
      const bodyParams = pld.bodyParams || [];
      const headerDocument = pld.headerDocument || null;
      const buttons = pld.buttons || null;

      const result = await WhatsAppService.sendTemplate({
        to: destinationPhone,
        name: msg.template_name,
        language: msg.language || 'en',
        bodyParams,
        headerDocument,
        buttons
      });

      if (result.ok) {
        // Fix: increment attempts on successful send
        await db.query(
          `UPDATE whatsapp_messages
           SET status = 'sent',
               attempts = attempts + 1,
               wamid = $1,
               sent_at = NOW(),
               error_code = NULL,
               error_message = NULL,
               updated_at = NOW()
           WHERE id = $2`,
          [result.wamid, msg.id]
        );
      } else {
        const errCode = parseInt(result.error_code, 10) || result.error_code;
        const errMsg = result.error_message || 'Dispatch failed';

        // Meta Error Handling Rules:
        if (errCode === 100 || errCode === 190) {
          const now = Date.now();
          if (now - lastTokenAlertTime > 60000) {
            lastTokenAlertTime = now;
            console.error(`[WHATSAPP-WORKER] ERROR: Meta token invalid or expired (code ${errCode}). Halting attempt burn.`);
          }
          await db.query(
            `UPDATE whatsapp_messages
             SET status = 'failed', error_code = $1, error_message = $2,
                 next_attempt_at = NOW() + INTERVAL '2 minutes', updated_at = NOW()
             WHERE id = $3`,
            [String(errCode), errMsg, msg.id]
          );
          continue;
        }

        if (errCode === 131047 || errCode === 131026) {
          await db.query(
            `UPDATE whatsapp_messages
             SET status = 'failed', error_code = $1, error_message = $2, updated_at = NOW()
             WHERE id = $3`,
            [String(errCode), errMsg, msg.id]
          );
          continue;
        }

        if (errCode === 131030) {
          await db.query(
            `UPDATE whatsapp_messages
             SET status = 'failed', error_code = $1, error_message = $2,
                 next_attempt_at = NOW() + INTERVAL '10 seconds', updated_at = NOW()
             WHERE id = $3`,
            [String(errCode), errMsg, msg.id]
          );
          continue;
        }

        if (errCode === 132000 || errCode === 132001 || errCode === 132015) {
          await db.query(
            `UPDATE whatsapp_messages
             SET status = 'dead', error_code = $1, error_message = $2, updated_at = NOW()
             WHERE id = $3`,
            [String(errCode), errMsg, msg.id]
          );
          continue;
        }

        // Generic error with exponential backoff
        const newAttempts = (msg.attempts || 0) + 1;
        const isDead = newAttempts >= 5;
        const backoffSec = getBackoffSeconds(newAttempts);

        await db.query(
          `UPDATE whatsapp_messages
           SET status = $1,
               attempts = $2,
               error_code = $3,
               error_message = $4,
               next_attempt_at = NOW() + ($5 || ' seconds')::interval,
               updated_at = NOW()
           WHERE id = $6`,
          [
            isDead ? 'dead' : 'failed',
            newAttempts,
            String(errCode),
            errMsg,
            String(backoffSec),
            msg.id
          ]
        );
      }
    } catch (msgErr) {
      console.error(`[WHATSAPP-WORKER] Unexpected error processing message #${msg.id}:`, msgErr.message);
    }
  }

  isProcessing = false;
}

/**
 * Start worker loop
 */
function start(intervalMs = 3000) {
  if (workerTimer) return;
  console.log(`[WHATSAPP-WORKER] Started WhatsApp outbox worker (interval: ${intervalMs}ms)`);
  workerTimer = setInterval(() => {
    processOutboxBatch().catch((err) => {
      console.error('[WHATSAPP-WORKER] Unhandled tick error:', err.message);
    });
  }, intervalMs);

  // Trigger immediate initial run
  processOutboxBatch().catch(() => {});
}

/**
 * Stop worker loop
 */
function stop() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
    console.log('[WHATSAPP-WORKER] Stopped WhatsApp outbox worker');
  }
}

// Standalone execution support
if (require.main === module) {
  start(3000);
  process.on('SIGINT', () => { stop(); process.exit(0); });
  process.on('SIGTERM', () => { stop(); process.exit(0); });
}

module.exports = {
  start,
  stop,
  processOutboxBatch,
  getBackoffSeconds,
  recoverStuckSendingMessages,
  markExpiredMessages,
  pruneOldMessages,
  getQueueStatus
};
