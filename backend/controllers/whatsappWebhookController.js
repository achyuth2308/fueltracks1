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
const WhatsAppService = require('../services/whatsappService');

/**
 * Verify Meta HMAC-SHA256 signature against raw request body.
 * Securely rejects if appSecret is missing (never bypasses).
 */
function verifySignature(req, appSecret = null) {
  const secret = appSecret || env.WHATSAPP_APP_SECRET || process.env.WHATSAPP_APP_SECRET;

  // In non-production, if app secret is not yet set, allow webhooks for development/testing
  if (!secret) {
    if (env.NODE_ENV !== 'production') {
      console.warn('[WHATSAPP-WEBHOOK] WHATSAPP_APP_SECRET not set; allowing webhook event in development mode.');
      return true;
    }
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

          // 2. Process Inbound Messages (Quick Reply credentials, STOP / START opt-in/opt-out)
          if (Array.isArray(value.messages)) {
            for (const msg of value.messages) {
              const rawSender = msg.from;
              const senderNormalized = normalizePhone(rawSender);
              if (!senderNormalized) continue;
              const masked = maskPhone(senderNormalized);

              // Check if customer clicked the Quick Reply "Get my account details" button
              let isGetCredentials = false;
              let payloadUserId = null;

              if (msg.type === 'button') {
                const btnPayload = msg.button?.payload || '';
                const btnText = (msg.button?.text || '').toLowerCase();
                if (btnPayload.startsWith('GET_CREDS_')) {
                  isGetCredentials = true;
                  payloadUserId = btnPayload.replace('GET_CREDS_', '').trim();
                } else if (btnText.includes('account details') || btnText.includes('credentials')) {
                  isGetCredentials = true;
                }
              } else if (msg.type === 'interactive') {
                const replyId = msg.interactive?.button_reply?.id || '';
                const replyTitle = (msg.interactive?.button_reply?.title || '').toLowerCase();
                if (replyId.startsWith('GET_CREDS_')) {
                  isGetCredentials = true;
                  payloadUserId = replyId.replace('GET_CREDS_', '').trim();
                } else if (replyTitle.includes('account details') || replyTitle.includes('credentials')) {
                  isGetCredentials = true;
                }
              } else if (msg.type === 'text') {
                const rawText = (msg.text?.body || '').trim().toLowerCase();
                if (rawText.includes('get my account details') || rawText.includes('account details') || rawText.includes('login details')) {
                  isGetCredentials = true;
                }
              }

              if (isGetCredentials) {
                try {
                  let users = [];
                  if (payloadUserId) {
                    const uRes = await db.query(
                      'SELECT id, name, username, temp_password, phone FROM users WHERE id = $1',
                      [payloadUserId]
                    );
                    if (uRes.rows.length > 0) users = uRes.rows;
                  }
                  if (users.length === 0) {
                    // Match by last 10 subscriber digits of phone number, stripping spaces/dashes
                    const last10 = senderNormalized.slice(-10);
                    const uRes = await db.query(
                      `SELECT id, name, username, temp_password, phone FROM users
                       WHERE regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') LIKE $1
                       ORDER BY created_at DESC`,
                      [`%${last10}`]
                    );
                    users = uRes.rows;
                  }

                  if (users.length > 0) {
                    const custName = users[0].name || 'Customer';
                    let credsBody = '';
                    for (const u of users) {
                      const custUser = u.username || u.email || '—';
                      const custPass = u.temp_password || '223344';
                      credsBody += `👤 *User ID:* ${custUser}\n🔑 *Password:* ${custPass}\n\n`;
                    }

                    const replyText =
`Hello ${custName},

Here are your FuelTracks login credentials:

${credsBody.trim()}

*Access FuelTracks:*
🌐 *Web Portal:* https://app.fueltracks.in
📱 *Android App:* https://play.google.com/store/apps/details?id=com.fueltracks.customer
🍏 *iOS App:* https://apps.apple.com/in/app/fueltracks-vehicle-tracking/id6814368846

After logging in, please update your password.
For assistance, contact FuelTracks Support.`;

                    await WhatsAppService.sendTextMessage({
                      to: senderNormalized,
                      text: replyText
                    });
                    console.log(`[WHATSAPP-WEBHOOK] Dispatched login credentials to ${masked} for ${users.length} account(s)`);
                  } else {
                    console.warn(`[WHATSAPP-WEBHOOK] Get credentials request from ${masked} but no matching user found.`);
                  }
                } catch (credErr) {
                  console.error('[WHATSAPP-WEBHOOK] Failed to dispatch credentials reply:', credErr.message);
                }
                continue;
              }

              if (msg.type !== 'text') continue;

              // Clean text of extra spaces, newlines, emojis for STOP/START
              const rawText = (msg.text?.body || '').trim();
              const text = rawText.toUpperCase().replace(/[^\w\s]/g, '').trim();

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
