// ============================================================
// ORGANIZATION MODEL - SQL queries for organizations table
// ============================================================

const db = require('../config/db');

const OrgModel = {
  /**
   * Find org by ID
   */
  /**
   * Find org by ID
   */
  async findById(orgId) {
    const result = await db.query(
      `SELECT o.*,
              p.name as parent_name,
              (SELECT name FROM users WHERE org_id = o.id ORDER BY created_at ASC LIMIT 1) AS primary_user_name,
              (SELECT phone FROM users WHERE org_id = o.id ORDER BY created_at ASC LIMIT 1) AS primary_user_phone,
              (SELECT email FROM users WHERE org_id = o.id ORDER BY created_at ASC LIMIT 1) AS primary_user_email,
              (SELECT COUNT(DISTINCT v_id)::int FROM (
                 SELECT id AS v_id FROM vehicles WHERE org_id = o.id AND is_active = TRUE
                 UNION
                 SELECT vg.vehicle_id AS v_id FROM vehicle_groups vg
                 JOIN user_groups ug ON vg.group_id = ug.group_id
                 JOIN users u ON ug.user_id = u.id
                 JOIN vehicles v ON vg.vehicle_id = v.id
                 WHERE u.org_id = o.id AND u.is_active = TRUE AND v.is_active = TRUE
               ) sub_v) AS vehicle_count,
              (SELECT COUNT(id)::int FROM users WHERE org_id = o.id AND is_active = TRUE) AS user_count,
              (SELECT COUNT(DISTINCT g_id)::int FROM (
                 SELECT id AS g_id FROM groups WHERE org_id = o.id
                 UNION
                 SELECT ug.group_id AS g_id FROM user_groups ug
                 JOIN users u ON ug.user_id = u.id
                 WHERE u.org_id = o.id AND u.is_active = TRUE
               ) sub_g) AS groups_count,
              (SELECT COUNT(DISTINCT d_id)::int FROM (
                 SELECT id AS d_id FROM devices WHERE org_id = o.id
                 UNION
                 SELECT d.id AS d_id FROM devices d
                 JOIN vehicles v ON d.vehicle_id = v.id::text
                 JOIN vehicle_groups vg ON vg.vehicle_id = v.id
                 JOIN user_groups ug ON vg.group_id = ug.group_id
                 JOIN users u ON ug.user_id = u.id
                 WHERE u.org_id = o.id AND u.is_active = TRUE AND v.is_active = TRUE
               ) sub_d) AS devices_count,
              (SELECT COUNT(id)::int FROM users WHERE org_id = o.id AND role = 'superadmin') AS superadmin_count
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
    let whereClause = '';
    const params = [];

    if (role !== 'superadmin') {
      whereClause = 'WHERE (o.id = $1 OR o.parent_id = $1)';
      params.push(orgId);
    }

    const query = `
      SELECT o.*,
             p.name as parent_name,
             (SELECT name FROM users WHERE org_id = o.id ORDER BY created_at ASC LIMIT 1) AS primary_user_name,
             (SELECT phone FROM users WHERE org_id = o.id ORDER BY created_at ASC LIMIT 1) AS primary_user_phone,
             (SELECT email FROM users WHERE org_id = o.id ORDER BY created_at ASC LIMIT 1) AS primary_user_email,
             (SELECT COUNT(DISTINCT v_id)::int FROM (
                SELECT id AS v_id FROM vehicles WHERE org_id = o.id AND is_active = TRUE
                UNION
                SELECT vg.vehicle_id AS v_id FROM vehicle_groups vg
                JOIN user_groups ug ON vg.group_id = ug.group_id
                JOIN users u ON ug.user_id = u.id
                JOIN vehicles v ON vg.vehicle_id = v.id
                WHERE u.org_id = o.id AND u.is_active = TRUE AND v.is_active = TRUE
              ) sub_v) AS vehicle_count,
             (SELECT COUNT(id)::int FROM users WHERE org_id = o.id AND is_active = TRUE) AS user_count,
             (SELECT COUNT(DISTINCT g_id)::int FROM (
                SELECT id AS g_id FROM groups WHERE org_id = o.id
                UNION
                SELECT ug.group_id AS g_id FROM user_groups ug
                JOIN users u ON ug.user_id = u.id
                WHERE u.org_id = o.id AND u.is_active = TRUE
              ) sub_g) AS groups_count,
             (SELECT COUNT(DISTINCT d_id)::int FROM (
                SELECT id AS d_id FROM devices WHERE org_id = o.id
                UNION
                SELECT d.id AS d_id FROM devices d
                JOIN vehicles v ON d.vehicle_id = v.id::text
                JOIN vehicle_groups vg ON vg.vehicle_id = v.id
                JOIN user_groups ug ON vg.group_id = ug.group_id
                JOIN users u ON ug.user_id = u.id
                WHERE u.org_id = o.id AND u.is_active = TRUE AND v.is_active = TRUE
              ) sub_d) AS devices_count,
             (SELECT COUNT(id)::int FROM users WHERE org_id = o.id AND role = 'superadmin') AS superadmin_count
      FROM organizations o
      LEFT JOIN organizations p ON o.parent_id = p.id
      ${whereClause}
      ORDER BY o.type, o.name
    `;

    const result = await db.query(query, params);
    return result.rows;
  },

  /**
   * Get complete user -> attached groups -> attached vehicles structure for an organization
   */
  async getOrgResources(orgId) {
    const usersRes = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.phone, u.is_active, u.created_at
       FROM users u
       WHERE u.org_id = $1
       ORDER BY u.name`,
      [orgId]
    );
    const users = usersRes.rows;
    for (const u of users) {
      const groupsRes = await db.query(
        `SELECT g.id, g.name, g.description
         FROM user_groups ug
         JOIN groups g ON ug.group_id = g.id
         WHERE ug.user_id = $1
         ORDER BY g.name`,
        [u.id]
      );
      u.groups = groupsRes.rows;
      for (const g of u.groups) {
        const vehRes = await db.query(
          `SELECT v.id, v.name, v.imei, v.plate, v.model, v.driver_name, v.driver_phone
           FROM vehicle_groups vg
           JOIN vehicles v ON vg.vehicle_id = v.id
           WHERE vg.group_id = $1 AND v.is_active = TRUE
           ORDER BY v.name`,
          [g.id]
        );
        g.vehicles = vehRes.rows;
      }
    }
    return users;
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
