// ============================================================
// ROLE-BASED ACCESS CONTROL (RBAC) MIDDLEWARE
// Restricts endpoints to specific roles
// ============================================================

/**
 * Authorize specific roles
 * Usage: authorize('superadmin', 'dealer')
 * Must be used AFTER authenticate middleware
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.',
        code: 'NOT_AUTHENTICATED',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}`,
        code: 'FORBIDDEN',
      });
    }

    next();
  };
}

module.exports = { authorize };
