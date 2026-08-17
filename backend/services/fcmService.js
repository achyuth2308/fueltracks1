// ============================================================
// FCM SERVICE - Firebase Cloud Messaging push notifications
// Requires FIREBASE_SERVICE_ACCOUNT_JSON in .env (JSON string)
// ============================================================

let admin = null;
let messaging = null;

/**
 * Initialize Firebase Admin SDK (lazy init, only if configured)
 */
function getMessaging() {
  if (messaging) return messaging;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    // FCM not configured — silent no-op mode
    return null;
  }

  try {
    if (!admin) {
      admin = require('firebase-admin');
    }
    if (admin.apps.length === 0) {
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

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('[FCM] Firebase Admin SDK initialized');
    }
    messaging = admin.messaging();
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

  const msg = getMessaging();
  if (!msg) {
    // FCM not configured — skip silently
    return { success: true, sent: 0, failed: 0, skipped: true };
  }

  try {
    const message = {
      tokens,
      data: Object.assign(
        { title, body },
        Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)])
        )
      ),
      android: {
        priority: 'high',
      },
      apns: {
        payload: {
          aps: { 
            alert: { title, body },
            sound: 'default', 
            badge: 1 
          },
        },
      },
    };

    const response = await msg.sendEachForMulticast(message);
    const sent = response.successCount;
    const failed = response.failureCount;

    if (failed > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.warn(`[FCM] Token [${idx}] failed:`, resp.error?.message);
        }
      });
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
