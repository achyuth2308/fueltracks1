// ============================================================
// JWT AUTHENTICATION MIDDLEWARE
// Verifies Bearer token and attaches user to request
// ============================================================

const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Authenticate requests using JWT
 * Expects: Authorization: Bearer <token>
 * Sets req.user = { userId, role, orgId, orgType }
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. No token provided.',
      code: 'NO_TOKEN',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      orgId: decoded.orgId,
      orgType: decoded.orgType,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired. Please login again.',
        code: 'TOKEN_EXPIRED',
      });
    }
    return res.status(401).json({
      success: false,
      error: 'Invalid token.',
      code: 'INVALID_TOKEN',
    });
  }
}

module.exports = { authenticate };
