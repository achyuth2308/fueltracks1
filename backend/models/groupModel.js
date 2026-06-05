// ============================================================
// GROUP MODEL - SQL queries for groups, vehicle_groups, and user_groups
// ============================================================

const db = require('../config/db');

const GroupModel = {
  /**
   * Find group by ID
   */
  async findById(groupId) {
    const result = await db.query(
      `SELECT g.*, o.name as org_name
       FROM groups g
       JOIN organizations o ON g.org_id = o.id
       WHERE g.id = $1`,
      [groupId]
    );
    return result.rows[0] || null;
  },

  /**
   * Get all groups (filtered by org for multi-tenancy)
   */
  async findAll(orgId, role) {
    let query, params;

    if (role === 'superadmin') {
      query = `SELECT g.*, o.name as org_name,
                      (SELECT COUNT(*) FROM vehicle_groups WHERE group_id = g.id) as vehicle_count,
                      (SELECT COUNT(*) FROM user_groups WHERE group_id = g.id) as user_count,
                      (
                        SELECT json_agg(json_build_object('id', v.id, 'name', v.name, 'vehicleId', v.metadata->>'vehicleId'))
                        FROM vehicle_groups vg
                        JOIN vehicles v ON vg.vehicle_id = v.id
                        WHERE vg.group_id = g.id
                      ) as vehicles
               FROM groups g
               JOIN organizations o ON g.org_id = o.id
               ORDER BY g.name ASC`;
      params = [];
    } else {
      // Dealer or Customer sees groups in their own org
      query = `SELECT g.*, o.name as org_name,
                      (SELECT COUNT(*) FROM vehicle_groups WHERE group_id = g.id) as vehicle_count,
                      (SELECT COUNT(*) FROM user_groups WHERE group_id = g.id) as user_count,
                      (
                        SELECT json_agg(json_build_object('id', v.id, 'name', v.name, 'vehicleId', v.metadata->>'vehicleId'))
                        FROM vehicle_groups vg
                        JOIN vehicles v ON vg.vehicle_id = v.id
                        WHERE vg.group_id = g.id
                      ) as vehicles
               FROM groups g
               JOIN organizations o ON g.org_id = o.id
               WHERE g.org_id = $1 OR g.org_id IN (SELECT id FROM organizations WHERE parent_id = $1)
               ORDER BY g.name ASC`;
      params = [orgId];
    }

    const result = await db.query(query, params);
    return result.rows;
  },

  /**
   * Create group
   */
  async create({ orgId, name, description }) {
    const result = await db.query(
      `INSERT INTO groups (org_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [orgId, name, description]
    );
    return result.rows[0];
  },

  /**
   * Update group
   */
  async update(groupId, { name, description, isActive }) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(name); }
    if (description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(description); }
    if (isActive !== undefined) { fields.push(`is_active = $${paramIndex++}`); values.push(isActive); }

    if (fields.length === 0) return null;

    values.push(groupId);
    const result = await db.query(
      `UPDATE groups SET ${fields.join(', ')} WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );
    return result.rows[0] || null;
  },

  /**
   * Delete group
   */
  async delete(groupId) {
    const result = await db.query(
      `DELETE FROM groups WHERE id = $1 RETURNING id`,
      [groupId]
    );
    return result.rows[0] || null;
  },

  /**
   * Check if group belongs to org (ownership check)
   */
  async belongsToOrg(groupId, orgId) {
    const result = await db.query(
      `SELECT id FROM groups
       WHERE id = $1 AND (
         org_id = $2
         OR org_id IN (SELECT id FROM organizations WHERE parent_id = $2)
       )`,
      [groupId, orgId]
    );
    return result.rows.length > 0;
  },

  /**
   * Assign user to groups
   */
  async assignUserToGroups(userId, groupIds) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      // Remove existing group assignments for user
      await client.query('DELETE FROM user_groups WHERE user_id = $1', [userId]);
      // Add new assignments
      for (const groupId of groupIds) {
        await client.query(
          'INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2)',
          [userId, groupId]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Get groups assigned to a user
   */
  async getUserGroups(userId) {
    const result = await db.query(
      `SELECT g.* FROM groups g
       JOIN user_groups ug ON g.id = ug.group_id
       WHERE ug.user_id = $1`,
      [userId]
    );
    return result.rows;
  },

  /**
   * Assign vehicles to group
   */
  async assignVehiclesToGroup(groupId, vehicleIds) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM vehicle_groups WHERE group_id = $1', [groupId]);
      for (const vehicleId of vehicleIds) {
        await client.query(
          'INSERT INTO vehicle_groups (group_id, vehicle_id) VALUES ($1, $2)',
          [groupId, vehicleId]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Get vehicle IDs assigned to a group
   */
  async getAssignedVehicleIds(groupId) {
    const result = await db.query(
      `SELECT vehicle_id FROM vehicle_groups WHERE group_id = $1`,
      [groupId]
    );
    return result.rows.map(row => row.vehicle_id);
  },

  /**
   * Get group names by array of IDs
   */
  async getNamesByIds(ids) {
    if (!ids || ids.length === 0) return [];
    const result = await db.query(
      `SELECT name FROM groups WHERE id = ANY($1)`,
      [ids]
    );
    return result.rows.map(row => row.name);
  }
};

module.exports = GroupModel;
