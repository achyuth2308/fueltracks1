// ============================================================
// MINING REGISTRATION MODEL
// SQL queries and helpers for vehicle/device mining registrations
// ============================================================

const db = require('../config/db');

const MiningRegistrationModel = {
  /**
   * Create a new registration record
   */
  async create(data) {
    const {
      org_id,
      user_id,
      asm_tsl_phone,
      device_model,
      vehicle_number,
      imei_number,
      engine_number,
      chassis_number,
      manufacturing_year,
      vehicle_manufacturer,
      customer_name,
      customer_phone,
      fo_address,
      aadhar_number,
      vehicle_number_photo_url,
      rc_copy_photo_url,
      aadhar_copy_photo_url,
      installer_name,
      request_type,
      submitted_by_email,
      send_email_copy = true,
      status = 'PENDING'
    } = data;

    const query = `
      INSERT INTO mining_registrations (
        org_id,
        user_id,
        asm_tsl_phone,
        device_model,
        vehicle_number,
        imei_number,
        engine_number,
        chassis_number,
        manufacturing_year,
        vehicle_manufacturer,
        customer_name,
        customer_phone,
        fo_address,
        aadhar_number,
        vehicle_number_photo_url,
        rc_copy_photo_url,
        aadhar_copy_photo_url,
        installer_name,
        request_type,
        submitted_by_email,
        send_email_copy,
        status,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, NOW(), NOW()
      )
      RETURNING *;
    `;

    const values = [
      org_id || null,
      user_id || null,
      asm_tsl_phone,
      device_model,
      vehicle_number,
      imei_number || null,
      engine_number,
      chassis_number,
      manufacturing_year,
      vehicle_manufacturer,
      customer_name,
      customer_phone,
      fo_address,
      aadhar_number,
      vehicle_number_photo_url,
      rc_copy_photo_url,
      aadhar_copy_photo_url,
      installer_name,
      request_type,
      submitted_by_email,
      send_email_copy,
      status
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  },

  /**
   * Find registrations with filters, pagination and search
   */
  async findAll({
    orgId = null,
    userId = null,
    role = null,
    status = null,
    requestType = null,
    search = '',
    limit = 50,
    offset = 0,
    sortBy = 'created_at',
    sortOrder = 'DESC'
  } = {}) {
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    // Multi-tenant scoping: Dealers can see registrations in their org, customers see their own submissions
    if (role === 'customer' && userId) {
      whereConditions.push(`mr.user_id = $${paramIndex++}`);
      params.push(userId);
    } else if (role === 'dealer' && orgId) {
      whereConditions.push(`mr.org_id = $${paramIndex++}`);
      params.push(orgId);
    }

    if (status && status !== 'ALL') {
      whereConditions.push(`mr.status = $${paramIndex++}`);
      params.push(status);
    }

    if (requestType && requestType !== 'ALL') {
      whereConditions.push(`mr.request_type = $${paramIndex++}`);
      params.push(requestType);
    }

    if (search && search.trim() !== '') {
      const term = `%${search.trim().toLowerCase()}%`;
      whereConditions.push(`(
        LOWER(mr.vehicle_number) LIKE $${paramIndex} OR
        LOWER(mr.customer_name) LIKE $${paramIndex} OR
        LOWER(mr.customer_phone) LIKE $${paramIndex} OR
        LOWER(COALESCE(mr.imei_number, '')) LIKE $${paramIndex} OR
        LOWER(mr.installer_name) LIKE $${paramIndex} OR
        LOWER(mr.submitted_by_email) LIKE $${paramIndex}
      )`);
      params.push(term);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Allowed sort columns
    const allowedSortCols = ['created_at', 'vehicle_number', 'customer_name', 'status', 'request_type'];
    const validSortBy = allowedSortCols.includes(sortBy) ? sortBy : 'created_at';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM mining_registrations mr
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.total || 0, 10);

    // Data query
    const dataQuery = `
      SELECT 
        mr.*,
        o.name as org_name,
        u.name as user_name
      FROM mining_registrations mr
      LEFT JOIN organizations o ON mr.org_id = o.id
      LEFT JOIN users u ON mr.user_id = u.id
      ${whereClause}
      ORDER BY mr.${validSortBy} ${validSortOrder}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(limit, offset);
    const dataResult = await db.query(dataQuery, params);

    return {
      total,
      limit,
      offset,
      registrations: dataResult.rows
    };
  },

  /**
   * Find single registration by ID
   */
  async findById(id) {
    const query = `
      SELECT 
        mr.*,
        o.name as org_name,
        u.name as user_name
      FROM mining_registrations mr
      LEFT JOIN organizations o ON mr.org_id = o.id
      LEFT JOIN users u ON mr.user_id = u.id
      WHERE mr.id = $1
    `;
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  },

  /**
   * Update status and notes
   */
  async updateStatus(id, status, adminNotes = null) {
    const query = `
      UPDATE mining_registrations
      SET 
        status = $1,
        admin_notes = COALESCE($2, admin_notes),
        updated_at = NOW()
      WHERE id = $3
      RETURNING *;
    `;
    const result = await db.query(query, [status, adminNotes, id]);
    return result.rows[0] || null;
  },

  /**
   * Delete registration
   */
  async deleteById(id) {
    const result = await db.query('DELETE FROM mining_registrations WHERE id = $1 RETURNING id', [id]);
    return result.rows[0] || null;
  },

  /**
   * Export all registrations matching criteria for CSV
   */
  async exportAll(options = {}) {
    return this.findAll({ ...options, limit: 5000, offset: 0 });
  }
};

module.exports = MiningRegistrationModel;
