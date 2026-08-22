// ============================================================
// FCM SERVICE - Firebase Cloud Messaging push notifications
// Requires FIREBASE_SERVICE_ACCOUNT_JSON in .env (JSON string)
// ============================================================

const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');

let messaging = null;

/**
 * Initialize Firebase Admin SDK (lazy init, only if configured)
 */
function getFcmMessaging() {
  if (messaging) return messaging;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    // FCM not configured — silent no-op mode
    return null;
  }

  try {
    if (getApps().length === 0) {
      // Strip surrounding quotes if the environment variable was loaded with them intact
      let cleanJson = serviceAccountJson.trim();
      if ((cleanJson.startsWith("'") && cleanJson.endsWith("'")) || (cleanJson.startsWith('"') && cleanJson.endsWith('"'))) {
        cleanJson = cleanJson.slice(1, -1);
      }
      
      const serviceAccount = JSON.parse(cleanJson);
      
      // Fix double-escaped newlines common when loading JSON from .env files
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }

      initializeApp({
        credential: cert(serviceAccount),
      });
      console.log('[FCM] Firebase Admin SDK initialized');
    }
    messaging = getMessaging();
    return messaging;
  } catch (err) {
    console.error('[FCM] Failed to initialize Firebase Admin SDK:', err.message);
    return null;
  }
}

/**
 * Send a push notification to multiple FCM tokens
 * @param {string[]} tokens - Array of FCM device tokens
 * @param {object} payload  - { title, body, data }
 * @returns {object}         - { success, sent, failed }
 */
async function sendMulticast(tokens, { title, body, data = {} }) {
  if (!tokens || tokens.length === 0) return { success: true, sent: 0, failed: 0 };

  const msg = getFcmMessaging();
  if (!msg) {
    return { success: true, sent: 0, failed: 0, skipped: true };
  }

  try {
    const message = {
      tokens,
      notification: { title, body },
      data: Object.assign(
        { title, body },
        Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)])
        )
      ),
      android: { 
        priority: 'high',
        notification: {
          channelId: 'fueltracks_alerts_v3',
          sound: 'observation_haki',
          icon: 'ic_notification',
          color: '#4F6BFF'
        }
      },
      apns: {
        payload: {
          aps: { alert: { title, body }, sound: 'observation_haki.mp3', badge: 1 },
        },
      },
    };

    const response = await msg.sendEachForMulticast(message);
    const sent = response.successCount;
    const failed = response.failureCount;

    if (failed > 0) {
      const staleTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errCode = resp.error?.code || resp.error?.message || '';
          // NotRegistered = app uninstalled / token expired after reinstall
          // InvalidRegistration = malformed or revoked token
          if (errCode.includes('registration-token-not-registered') ||
              errCode.includes('NotRegistered') ||
              errCode.includes('InvalidRegistration')) {
            staleTokens.push(tokens[idx]);
          } else {
            console.warn(`[FCM] Token [${idx}] failed:`, resp.error?.message);
          }
        }
      });

      // Auto-purge stale tokens so they stop generating errors on every alert
      if (staleTokens.length > 0) {
        console.log(`[FCM] Purging ${staleTokens.length} stale/expired FCM token(s) from DB`);
        try {
          const db = require('../config/db');
          await db.query(
            `DELETE FROM user_fcm_tokens WHERE fcm_token = ANY($1::text[])`,
            [staleTokens]
          );
        } catch (dbErr) {
          console.error('[FCM] Failed to purge stale tokens:', dbErr.message);
        }
      }
    }

    return { success: true, sent, failed };
  } catch (err) {
    console.error('[FCM] sendMulticast error:', err.message);
    return { success: false, sent: 0, failed: tokens.length, error: err.message };
  }
}

/**
 * Send a push notification to a single FCM token
 */
async function sendToToken(token, { title, body, data = {} }) {
  return sendMulticast([token], { title, body, data });
}

module.exports = { sendMulticast, sendToToken };
