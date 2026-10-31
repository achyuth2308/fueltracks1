// ============================================================
// WHATSAPP WEBHOOK CONTROLLER
// Meta Graph API Webhook endpoint: challenge echo & event ingestion
// Handles status callbacks (delivered/read/failed) and inbound STOP/START
// ============================================================

'use strict';

const crypto = require('crypto');
const db = require('../config/db');
const env = require('../config/env');
const { normalizePhone, maskPhone } = require('../utils/phone');

/**
 * Verify Meta HMAC-SHA256 signature against raw request body.
 * Securely rejects if appSecret is missing (never bypasses).
 */
function verifySignature(req, appSecret = null) {
  const secret = appSecret || env.WHATSAPP_APP_SECRET || process.env.WHATSAPP_APP_SECRET;

  // Security Rule: If app secret is not configured, REJECT, do NOT skip!
  if (!secret) {
    return false;
  }

  const signatureHeader = req.headers ? req.headers['x-hub-signature-256'] : null;
  if (!signatureHeader) return false;

  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') return false;
  const signatureHex = parts[1];

  const rawBody = req.rawBody || (req.body ? Buffer.from(JSON.stringify(req.body)) : Buffer.from(''));
  const hmac = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  try {
    const signatureBuffer = Buffer.from(signatureHex, 'hex');
    const hmacBuffer = Buffer.from(hmac, 'hex');
    if (signatureBuffer.length !== hmacBuffer.length) return false;
    return crypto.timingSafeEqual(signatureBuffer, hmacBuffer);
  } catch (_) {
    return false;
  }
}

const WhatsAppWebhookController = {
  /**
   * GET /api/webhooks/whatsapp — Meta challenge verification
   * Timing-safe verification of hub.verify_token
   */
  verify(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const expectedToken = env.WHATSAPP_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode === 'subscribe' && token && expectedToken) {
      const tokenBuf = Buffer.from(String(token), 'utf8');
      const expectedBuf = Buffer.from(String(expectedToken), 'utf8');

      if (tokenBuf.length === expectedBuf.length && crypto.timingSafeEqual(tokenBuf, expectedBuf)) {
        console.log('[WHATSAPP-WEBHOOK] Meta subscription verified successfully');
        return res.status(200).send(challenge);
      }
    }

    console.warn('[WHATSAPP-WEBHOOK] Verification failed. Token mismatch, wrong length, or invalid mode.');
    return res.status(403).send('Forbidden');
  },

  /**
   * POST /api/webhooks/whatsapp — Meta status updates and incoming messages
   */
  async handleEvent(req, res) {
    if (!verifySignature(req)) {
      console.error('[WHATSAPP-WEBHOOK] Invalid or missing X-Hub-Signature-256 header.');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Always acknowledge 200 immediately to Meta
    res.status(200).send('EVENT_RECEIVED');

    const body = req.body;
    if (!body || (body.object !== 'whatsapp_business_account' && body.object !== 'whatsapp')) {
      return;
    }

    try {
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const value = change.value || {};

          // 1. Process Delivery & Read Status Callbacks (Monotonic: never regress 'read' -> 'delivered')
          if (Array.isArray(value.statuses)) {
            for (const statusItem of value.statuses) {
              const { id: wamid, status, timestamp, errors } = statusItem;
              if (!wamid) continue;

              const statusDate = timestamp ? new Date(parseInt(timestamp, 10) * 1000) : new Date();

              if (status === 'delivered') {
                // Do not regress if already 'read'
                await db.query(
                  `UPDATE whatsapp_messages
                   SET status = CASE WHEN status = 'read' THEN 'read' ELSE 'delivered' END,
                       delivered_at = COALESCE(delivered_at, $1),
                       updated_at = NOW()
                   WHERE wamid = $2`,
                  [statusDate, wamid]
                );
              } else if (status === 'read') {
                await db.query(
                  `UPDATE whatsapp_messages
                   SET status = 'read',
                       read_at = COALESCE(read_at, $1),
                       delivered_at = COALESCE(delivered_at, $1),
                       updated_at = NOW()
                   WHERE wamid = $2`,
                  [statusDate, wamid]
                );
              } else if (status === 'sent') {
                await db.query(
                  `UPDATE whatsapp_messages
                   SET status = CASE WHEN status IN ('delivered', 'read') THEN status ELSE 'sent' END,
                       sent_at = COALESCE(sent_at, $1),
                       updated_at = NOW()
                   WHERE wamid = $2`,
                  [statusDate, wamid]
                );
              } else if (status === 'failed') {
                const err = errors?.[0] || {};
                console.warn(`[WHATSAPP-WEBHOOK] Message ${wamid} marked failed: [${err.code}] ${err.title || err.message}`);
                await db.query(
                  `UPDATE whatsapp_messages
                   SET status = 'failed', error_code = $1, error_message = $2, updated_at = NOW()
                   WHERE wamid = $3`,
                  [String(err.code || 'UNKNOWN'), err.title || err.message || 'Delivery failed', wamid]
                );
              }
            }
          }

          // 2. Process Inbound Messages (STOP / START opt-in/opt-out handling)
          if (Array.isArray(value.messages)) {
            for (const msg of value.messages) {
              if (msg.type !== 'text') continue;

              const rawSender = msg.from;
              const senderNormalized = normalizePhone(rawSender);
              if (!senderNormalized) continue;

              // Clean text of extra spaces, newlines, emojis
              const rawText = (msg.text?.body || '').trim();
              const text = rawText.toUpperCase().replace(/[^\w\s]/g, '').trim();
              const masked = maskPhone(senderNormalized);

              const STOP_KEYWORDS = ['STOP', 'UNSUBSCRIBE', 'BAND', 'CANCEL', 'QUIT', 'OPTOUT', 'OPT OUT'];
              const START_KEYWORDS = ['START', 'SUBSCRIBE', 'UNBAND', 'OPTIN', 'OPT IN', 'YES'];

              if (STOP_KEYWORDS.includes(text)) {
                console.log(`[WHATSAPP-WEBHOOK] Received opt-out command "${text}" from ${masked}`);
                await db.query(
                  `UPDATE whatsapp_recipients
                   SET opt_in = false, opt_out_at = NOW(), updated_at = NOW()
                   WHERE phone_e164 = $1`,
                  [senderNormalized]
                );
              } else if (START_KEYWORDS.includes(text)) {
                console.log(`[WHATSAPP-WEBHOOK] Received opt-in command "${text}" from ${masked}`);
                await db.query(
                  `UPDATE whatsapp_recipients
                   SET opt_in = true, opt_in_at = NOW(), opt_in_source = 'inbound_reply', opt_out_at = NULL, updated_at = NOW()
                   WHERE phone_e164 = $1`,
                  [senderNormalized]
                );
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('[WHATSAPP-WEBHOOK] Error handling event:', err.message);
    }
  }
};

module.exports = {
  WhatsAppWebhookController,
  verifySignature
};
