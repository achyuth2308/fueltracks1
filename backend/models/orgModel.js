// ============================================================
// ORGANIZATION MODEL - SQL queries for organizations table
// ============================================================

const db = require('../config/db');

const OrgModel = {
  /**
   * Find org by ID
   */
  async findById(orgId) {
    const result = await db.query(
      `SELECT o.*,
              (SELECT COUNT(*) FROM vehicles WHERE org_id = o.id AND is_active = TRUE) as vehicle_count,
              (SELECT COUNT(*) FROM users WHERE org_id = o.id AND is_active = TRUE) as user_count,
              p.name as parent_name
       FROM organizations o
       LEFT JOIN organizations p ON o.parent_id = p.id
       WHERE o.id = $1`,
      [orgId]
    );
    return result.rows[0] || null;
  },

  /**
   * Get all organizations
   * superadmin: all orgs
   * dealer: own org + child orgs
   */
  async findAll(orgId, role) {
    let query, params;

    if (role === 'superadmin') {
      query = `SELECT o.*,
                      (SELECT COUNT(*) FROM vehicles WHERE org_id = o.id AND is_active = TRUE) as vehicle_count,
                      (SELECT COUNT(*) FROM users WHERE org_id = o.id AND is_active = TRUE) as user_count,
                      p.name as parent_name
               FROM organizations o
               LEFT JOIN organizations p ON o.parent_id = p.id
               ORDER BY o.type, o.name`;
      params = [];
    } else {
      query = `SELECT o.*,
                      (SELECT COUNT(*) FROM vehicles WHERE org_id = o.id AND is_active = TRUE) as vehicle_count,
                      (SELECT COUNT(*) FROM users WHERE org_id = o.id AND is_active = TRUE) as user_count,
                      p.name as parent_name
               FROM organizations o
               LEFT JOIN organizations p ON o.parent_id = p.id
               WHERE o.id = $1 OR o.parent_id = $1
               ORDER BY o.type, o.name`;
      params = [orgId];
    }

    const result = await db.query(query, params);
    return result.rows;
  },

  /**
   * Create organization
   */
  async create({ name, type, parentId, address, phone }) {
    const result = await db.query(
      `INSERT INTO organizations (name, type, parent_id, address, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, type, parentId, address, phone]
    );
    return result.rows[0];
  },

  /**
   * Update organization
   */
  async update(orgId, { name, type, address, phone, isActive }) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(name); }
    if (type !== undefined) { fields.push(`type = $${paramIndex++}`); values.push(type); }
    if (address !== undefined) { fields.push(`address = $${paramIndex++}`); values.push(address); }
    if (phone !== undefined) { fields.push(`phone = $${paramIndex++}`); values.push(phone); }
    if (isActive !== undefined) { fields.push(`is_active = $${paramIndex++}`); values.push(isActive); }

    if (fields.length === 0) return null;

    values.push(orgId);
    const result = await db.query(
      `UPDATE organizations SET ${fields.join(', ')} WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );
    return result.rows[0] || null;
  },

  /**
   * Delete organization (soft delete)
   */
  async delete(orgId) {
    const result = await db.query(
      `UPDATE organizations SET is_active = FALSE WHERE id = $1 RETURNING id`,
      [orgId]
    );
    return result.rows[0] || null;
  },
};

module.exports = OrgModel;
