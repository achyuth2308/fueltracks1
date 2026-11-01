// ============================================================
// ORG SCOPE SERVICE
// Evaluates multi-tenant org boundaries for Document Scanner
// Shared across upload, GET, vehicle-matches, and confirm
// ============================================================

/**
 * Checks whether an authenticated user is permitted to access targetOrgId
 *
 * Rules:
 *  - superadmin: permitted if target organization exists in database
 *  - dealer: permitted if targetOrgId === user.orgId OR parent_id = user.orgId (one level child)
 *  - all other roles: rejected (v1 restricted to superadmin and dealer)
 *
 * @param {Object} dbClient - PG client or pool instance
 * @param {Object} user - req.user from JWT authentication
 * @param {string} targetOrgId - The UUID of the target organization
 * @returns {Promise<{ allowed: boolean, org: Object|null, code?: string, error?: string }>}
 */
async function canAccessOrg(dbClient, user, targetOrgId) {
  if (!user) {
    return { allowed: false, org: null, code: 'NOT_AUTHENTICATED', error: 'Authentication required' };
  }

  // 1. Role Check: Strictly superadmin and dealer in v1
  if (!['superadmin', 'dealer'].includes(user.role)) {
    return { allowed: false, org: null, code: 'FORBIDDEN', error: 'Access denied. Required role: superadmin or dealer' };
  }

  if (!targetOrgId) {
    return { allowed: false, org: null, code: 'TARGET_ORG_REQUIRED', error: 'Target organization ID is required' };
  }

  // 2. Superadmin scope check
  if (user.role === 'superadmin') {
    const res = await dbClient.query('SELECT id, name, parent_id FROM organizations WHERE id = $1', [targetOrgId]);
    if (res.rows.length === 0) {
      return { allowed: false, org: null, code: 'ORG_NOT_FOUND', error: 'Target organization does not exist' };
    }
    return { allowed: true, org: res.rows[0] };
  }

  // 3. Dealer scope check: Own org or immediate child org
  if (targetOrgId === user.orgId) {
    const res = await dbClient.query('SELECT id, name, parent_id FROM organizations WHERE id = $1', [targetOrgId]);
    if (res.rows.length === 0) {
      return { allowed: false, org: null, code: 'ORG_NOT_FOUND', error: 'Dealer organization does not exist' };
    }
    return { allowed: true, org: res.rows[0] };
  }

  // Check if target is a child organization of the dealer
  const childRes = await dbClient.query(
    'SELECT id, name, parent_id FROM organizations WHERE id = $1 AND parent_id = $2',
    [targetOrgId, user.orgId]
  );
  if (childRes.rows.length === 0) {
    return {
      allowed: false,
      org: null,
      code: 'FORBIDDEN',
      error: 'Cannot access or assign vehicle to an organization you do not own'
    };
  }

  return { allowed: true, org: childRes.rows[0] };
}

module.exports = {
  canAccessOrg
};
