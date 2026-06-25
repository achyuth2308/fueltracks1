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
              p.name as parent_name,
              COUNT(DISTINCT CASE WHEN v.is_active = TRUE THEN v.id END) AS vehicle_count,
              COUNT(DISTINCT CASE WHEN u.is_active = TRUE THEN u.id END) AS user_count,
              COUNT(DISTINCT g.id) AS groups_count,
              COUNT(DISTINCT d.id) AS devices_count
       FROM organizations o
       LEFT JOIN organizations p ON o.parent_id = p.id
       LEFT JOIN vehicles v ON v.org_id = o.id
       LEFT JOIN users u ON u.org_id = o.id
       LEFT JOIN groups g ON g.org_id = o.id
       LEFT JOIN devices d ON d.org_id = o.id
       WHERE o.id = $1
       GROUP BY o.id, p.name`,
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
    let whereClause = '';
    const params = [];

    if (role !== 'superadmin') {
      whereClause = 'WHERE (o.id = $1 OR o.parent_id = $1)';
      params.push(orgId);
    }

    // Single query with LEFT JOINs instead of 4 correlated subqueries per row
    const query = `
      SELECT o.*,
             p.name as parent_name,
             COUNT(DISTINCT CASE WHEN v.is_active = TRUE THEN v.id END) AS vehicle_count,
             COUNT(DISTINCT CASE WHEN u.is_active = TRUE THEN u.id END) AS user_count,
             COUNT(DISTINCT g.id) AS groups_count,
             COUNT(DISTINCT d.id) AS devices_count
      FROM organizations o
      LEFT JOIN organizations p ON o.parent_id = p.id
      LEFT JOIN vehicles v ON v.org_id = o.id
      LEFT JOIN users u ON u.org_id = o.id
      LEFT JOIN groups g ON g.org_id = o.id
      LEFT JOIN devices d ON d.org_id = o.id
      ${whereClause}
      GROUP BY o.id, p.name
      ORDER BY o.type, o.name
    `;

    const result = await db.query(query, params);
    return result.rows;
  },


  /**
   * Create organization
   */
  async create({ name, type, parentId, address, phone, contactPerson, email }) {
    const result = await db.query(
      `INSERT INTO organizations (name, type, parent_id, address, phone, contact_person, email)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, type, parentId, address, phone, contactPerson, email]
    );
    return result.rows[0];
  },

  /**
   * Update organization
   */
  async update(orgId, { name, type, address, phone, isActive, contactPerson, email }) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(name); }
    if (type !== undefined) { fields.push(`type = $${paramIndex++}`); values.push(type); }
    if (address !== undefined) { fields.push(`address = $${paramIndex++}`); values.push(address); }
    if (phone !== undefined) { fields.push(`phone = $${paramIndex++}`); values.push(phone); }
    if (contactPerson !== undefined) { fields.push(`contact_person = $${paramIndex++}`); values.push(contactPerson); }
    if (email !== undefined) { fields.push(`email = $${paramIndex++}`); values.push(email); }
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
      `DELETE FROM organizations WHERE id = $1 RETURNING id`,
      [orgId]
    );
    return result.rows[0] || null;
  },
};

module.exports = OrgModel;
