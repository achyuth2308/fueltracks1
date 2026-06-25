// ============================================================
// USER MODEL - SQL queries for users table
// ============================================================

const db = require('../config/db');

const UserModel = {
  /**
   * Find user by email (for login)
   */
  async findByEmail(email) {
    const result = await db.query(
      `SELECT u.*, o.name as org_name, o.type as org_type
       FROM users u
       JOIN organizations o ON u.org_id = o.id
       WHERE u.email = $1 AND u.is_active = TRUE`,
      [email]
    );
    return result.rows[0] || null;
  },

  /**
   * Find user by ID
   */
  async findById(userId) {
    const result = await db.query(
      `SELECT u.id, u.org_id, u.email, u.role, u.name, u.phone,
              u.is_active, u.last_login, u.created_at,
              o.name as org_name, o.type as org_type
       FROM users u
       JOIN organizations o ON u.org_id = o.id
       WHERE u.id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  },

  /**
   * Get all users (filtered by org for dealers)
   */
  async findAll(orgId, role) {
    let whereClause = '';
    const params = [];

    if (role !== 'superadmin') {
      whereClause = `WHERE (u.org_id = $1 OR u.org_id IN (SELECT id FROM organizations WHERE parent_id = $1))`;
      params.push(orgId);
    }

    // Use LEFT JOIN + string_agg instead of a correlated subquery per user row
    const query = `
      SELECT u.id, u.org_id, u.email, u.role, u.name, u.phone,
             u.is_active, u.last_login, u.created_at,
             o.name as org_name,
             string_agg(g.name, ', ' ORDER BY g.name) as group_names
      FROM users u
      JOIN organizations o ON u.org_id = o.id
      LEFT JOIN user_groups ug ON u.id = ug.user_id
      LEFT JOIN groups g ON ug.group_id = g.id
      ${whereClause}
      GROUP BY u.id, u.org_id, u.email, u.role, u.name, u.phone,
               u.is_active, u.last_login, u.created_at, o.name
      ORDER BY u.created_at DESC
    `;

    const result = await db.query(query, params);
    return result.rows;
  },

  /**
   * Create a new user
   */
  async create({ orgId, email, password, role, name, phone }) {
    const result = await db.query(
      `INSERT INTO users (org_id, email, password, role, name, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, org_id, email, role, name, phone, is_active, created_at`,
      [orgId, email, password, role, name, phone]
    );
    return result.rows[0];
  },

  /**
   * Update user
   */
  async update(userId, { email, role, name, phone, isActive, orgId }) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (email !== undefined) { fields.push(`email = $${paramIndex++}`); values.push(email); }
    if (role !== undefined) { fields.push(`role = $${paramIndex++}`); values.push(role); }
    if (name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(name); }
    if (phone !== undefined) { fields.push(`phone = $${paramIndex++}`); values.push(phone); }
    if (isActive !== undefined) { fields.push(`is_active = $${paramIndex++}`); values.push(isActive); }
    if (orgId !== undefined) { fields.push(`org_id = $${paramIndex++}`); values.push(orgId); }

    if (fields.length === 0) return null;

    values.push(userId);
    const result = await db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, org_id, email, role, name, phone, is_active`,
      values
    );
    return result.rows[0] || null;
  },

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId) {
    await db.query(
      `UPDATE users SET last_login = NOW() WHERE id = $1`,
      [userId]
    );
  },

  /**
   * Update password
   */
  async updatePassword(userId, hashedPassword) {
    await db.query(
      `UPDATE users SET password = $1 WHERE id = $2`,
      [hashedPassword, userId]
    );
  },

  /**
   * Delete user (soft delete - set is_active = false)
   */
  async delete(userId) {
    const result = await db.query(
      `DELETE FROM users WHERE id = $1 RETURNING id`,
      [userId]
    );
    return result.rows[0] || null;
  },
};

module.exports = UserModel;
