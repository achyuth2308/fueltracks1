// ============================================================
// API KEY MIDDLEWARE — FuelTracks Third-Party Integration
// Validates X-API-Key header, attaches org context to req
// ============================================================

const crypto = require('crypto');
const db = require('../config/db');

/**
 * Middleware: authenticate third-party requests via API key.
 * Expects header:  X-API-Key: ftkn_<rawKey>
 * On success, sets req.apiOrg = { orgId, orgName }
 */
async function authenticateApiKey(req, res, next) {
  const rawKey = req.headers['x-api-key'];

  if (!rawKey) {
    return res.status(401).json({
      success: false,
      error: 'Missing API key. Pass your key in the X-API-Key header.',
      code: 'MISSING_API_KEY',
    });
  }

  // Hash the incoming key
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  try {
    const result = await db.query(
      `SELECT ak.id, ak.org_id, ak.is_active, o.name as org_name
       FROM api_keys ak
       JOIN organizations o ON o.id = ak.org_id
       WHERE ak.key_hash = $1`,
      [keyHash]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key.',
        code: 'INVALID_API_KEY',
      });
    }

    const apiKey = result.rows[0];

    if (!apiKey.is_active) {
      return res.status(403).json({
        success: false,
        error: 'This API key has been revoked. Contact FuelTracks support.',
        code: 'API_KEY_REVOKED',
      });
    }

    // Update last_used_at asynchronously (don't await — don't block request)
    db.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [apiKey.id]).catch(() => {});

    // Attach org context to request
    req.apiOrg = {
      orgId: apiKey.org_id,
      orgName: apiKey.org_name,
    };

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticateApiKey };
