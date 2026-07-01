// ============================================================
// VEHICLE MODEL - SQL queries for vehicles table
// IMEI is the key identifier linking device packets to vehicles
// ============================================================

const db = require('../config/db');

const VehicleModel = {
  /**
   * Find vehicle by IMEI (used by TCP server to match packets)
   */
  async findByImei(imei) {
    const result = await db.query(
      `SELECT v.*, v.metadata, o.name as org_name
       FROM vehicles v
       JOIN organizations o ON v.org_id = o.id
       WHERE v.imei = $1`,
      [imei]
    );
    return result.rows[0] || null;
  },

  /**
   * Find vehicle by ID with latest state
   */
  async findById(vehicleId) {
    const result = await db.query(
      `SELECT v.*, v.metadata,
              o.name as org_name,
              vls.lat, vls.lng, vls.speed as current_speed,
              vls.fuel as current_fuel, vls.ignition as current_ignition,
              vls.voltage as current_voltage, vls.is_online,
              vls.last_seen, (COALESCE(vls.odometer, 0) + COALESCE(CAST(NULLIF(v.metadata->>'odometerReading', '') AS NUMERIC), 0)) as current_odometer,
              vls.direction as current_direction,
              vls.satellites as current_satellites,
              vls.gsm_signal as current_gsm_signal,
              (SELECT COALESCE(MAX(odometer) - MIN(NULLIF(odometer, 0)), 0) FROM gps_points gp WHERE gp.vehicle_id = v.id AND gp.device_time >= (DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')) as today_distance
       FROM vehicles v
       JOIN organizations o ON v.org_id = o.id
       LEFT JOIN vehicle_latest_state vls ON v.id = vls.vehicle_id
       WHERE v.id = $1`,
      [vehicleId]
    );
    return result.rows[0] || null;
  },

  /**
   * Get all vehicles for an org (with latest state)
   * Filtered by org hierarchy: superadmin sees all, dealer sees their org + children
   */
  async findAll(orgId, role, { page = 1, limit = 100, search, groupId, userId } = {}) {
    const offset = (page - 1) * limit;
    let whereClause = '';
    const params = [];
    let paramIndex = 1;

    if (role === 'superadmin') {
      // See all vehicles
      whereClause = 'WHERE v.is_active = TRUE';
    } else if (role === 'customer') {
      // See only vehicles assigned to the groups this customer belongs to
      params.push(userId);
      whereClause = `WHERE v.is_active = TRUE AND v.id IN (
        SELECT vg.vehicle_id 
        FROM vehicle_groups vg
        JOIN user_groups ug ON vg.group_id = ug.group_id
        WHERE ug.user_id = $${paramIndex++}
      )`;
    } else {
      // See vehicles in own org + child orgs
      params.push(orgId);
      whereClause = `WHERE v.is_active = TRUE AND (
        v.org_id = $${paramIndex++}
        OR v.org_id IN (SELECT id FROM organizations WHERE parent_id = $1)
      )`;
    }

    // Search filter (name, plate, IMEI)
    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (
        v.name ILIKE $${paramIndex} OR
        v.plate ILIKE $${paramIndex} OR
        v.imei ILIKE $${paramIndex}
      )`;
      paramIndex++;
    }

    // Group filter
    if (groupId) {
      params.push(groupId);
      whereClause += ` AND v.id IN (
        SELECT vehicle_id FROM vehicle_groups WHERE group_id = $${paramIndex}
      )`;
      paramIndex++;
    }

    // Count total
    const countResult = await db.query(
      `SELECT COUNT(*) FROM vehicles v ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Fetch vehicles with latest state
    params.push(limit, offset);
    const result = await db.query(
      `SELECT v.id, v.org_id, v.imei, v.name, v.plate, v.model,
              v.driver_name, v.driver_phone, v.is_active, v.created_at,
              v.server_name, v.gps_sim_no, v.device_version, v.timezone,
              v.apn, v.licence_issued_date, v.licence_expire_date, v.metadata,
              o.name as org_name,
              STRING_AGG(DISTINCT g.name, ', ' ORDER BY g.name) as group_name,
              vls.lat, vls.lng, vls.speed as current_speed,
              vls.fuel as current_fuel, vls.ignition as current_ignition,
              vls.voltage as current_voltage, vls.is_online,
              vls.last_seen, vls.direction as current_direction,
              (COALESCE(vls.odometer, 0) + COALESCE(CAST(NULLIF(v.metadata->>'odometerReading', '') AS NUMERIC), 0)) as current_odometer,
              (SELECT COALESCE(MAX(odometer) - MIN(NULLIF(odometer, 0)), 0) FROM gps_points gp WHERE gp.vehicle_id = v.id AND gp.device_time >= (DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')) as today_distance
       FROM vehicles v
       JOIN organizations o ON v.org_id = o.id
       LEFT JOIN vehicle_latest_state vls ON v.id = vls.vehicle_id
       LEFT JOIN vehicle_groups vg ON v.id = vg.vehicle_id
       LEFT JOIN groups g ON vg.group_id = g.id
       ${whereClause}
       GROUP BY v.id, v.org_id, v.imei, v.name, v.plate, v.model,
                v.driver_name, v.driver_phone, v.is_active, v.created_at,
                v.server_name, v.gps_sim_no, v.device_version, v.timezone,
                v.apn, v.licence_issued_date, v.licence_expire_date, v.metadata,
                o.name, vls.lat, vls.lng, vls.speed, vls.fuel, vls.ignition,
                vls.voltage, vls.is_online, vls.last_seen, vls.direction, vls.odometer
       ORDER BY v.name ASC NULLS LAST, v.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return {
      vehicles: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Create a new vehicle (IMEI is required!)
   */
  async create({ orgId, imei, name, plate, model, driverName, driverPhone, serverName, gpsSimNo, deviceVersion, timezone, apn, licenceIssuedDate, licenceExpireDate, metadata }) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Insert vehicle
      const result = await client.query(
        `INSERT INTO vehicles (org_id, imei, name, plate, model, driver_name, driver_phone, server_name, gps_sim_no, device_version, timezone, apn, licence_issued_date, licence_expire_date, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING *`,
        [orgId, imei, name, plate, model, driverName, driverPhone, serverName, gpsSimNo, deviceVersion, timezone, apn, licenceIssuedDate || null, licenceExpireDate || null, metadata || {}]
      );
      const vehicle = result.rows[0];

      // Create initial latest state entry
      await client.query(
        `INSERT INTO vehicle_latest_state (vehicle_id, is_online)
         VALUES ($1, FALSE)`,
        [vehicle.id]
      );

      await client.query('COMMIT');
      return vehicle;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Update vehicle
   */
  async update(vehicleId, { name, plate, model, driverName, driverPhone, isActive, orgId, serverName, gpsSimNo, deviceVersion, timezone, apn, licenceIssuedDate, licenceExpireDate, metadata }) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(name); }
    if (plate !== undefined) { fields.push(`plate = $${paramIndex++}`); values.push(plate); }
    if (model !== undefined) { fields.push(`model = $${paramIndex++}`); values.push(model); }
    if (driverName !== undefined) { fields.push(`driver_name = $${paramIndex++}`); values.push(driverName); }
    if (driverPhone !== undefined) { fields.push(`driver_phone = $${paramIndex++}`); values.push(driverPhone); }
    if (isActive !== undefined) { fields.push(`is_active = $${paramIndex++}`); values.push(isActive); }
    if (orgId !== undefined) { fields.push(`org_id = $${paramIndex++}`); values.push(orgId); }

    // New fields
    if (serverName !== undefined) { fields.push(`server_name = $${paramIndex++}`); values.push(serverName); }
    if (gpsSimNo !== undefined) { fields.push(`gps_sim_no = $${paramIndex++}`); values.push(gpsSimNo); }
    if (deviceVersion !== undefined) { fields.push(`device_version = $${paramIndex++}`); values.push(deviceVersion); }
    if (timezone !== undefined) { fields.push(`timezone = $${paramIndex++}`); values.push(timezone); }
    if (apn !== undefined) { fields.push(`apn = $${paramIndex++}`); values.push(apn); }
    if (licenceIssuedDate !== undefined) { fields.push(`licence_issued_date = $${paramIndex++}`); values.push(licenceIssuedDate || null); }
    if (licenceExpireDate !== undefined) { fields.push(`licence_expire_date = $${paramIndex++}`); values.push(licenceExpireDate || null); }
    if (metadata !== undefined) { fields.push(`metadata = $${paramIndex++}`); values.push(metadata); }

    if (fields.length === 0) return null;

    values.push(vehicleId);
    const result = await db.query(
      `UPDATE vehicles SET ${fields.join(', ')} WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );
    return result.rows[0] || null;
  },

  /**
   * Delete vehicle (soft delete)
   */
  async delete(vehicleId) {
    const result = await db.query(
      `UPDATE vehicles SET is_active = FALSE WHERE id = $1 RETURNING id`,
      [vehicleId]
    );
    return result.rows[0] || null;
  },

  /**
   * Migrate vehicle to a new IMEI device
   */
  async migrate(vehicleId, newImei) {
    const result = await db.query(
      `UPDATE vehicles SET imei = $1 WHERE id = $2 RETURNING *`,
      [newImei, vehicleId]
    );
    return result.rows[0] || null;
  },

  /**
   * Check if vehicle belongs to org (ownership check for RBAC)
   */
  async belongsToOrg(vehicleId, orgId) {
    const result = await db.query(
      `SELECT id FROM vehicles
       WHERE id = $1 AND (
         org_id = $2
         OR org_id IN (SELECT id FROM organizations WHERE parent_id = $2)
       )`,
      [vehicleId, orgId]
    );
    return result.rows.length > 0;
  },

  /**
   * Get vehicle groups
   */
  async getGroups(vehicleId) {
    const result = await db.query(
      `SELECT g.* FROM groups g
       JOIN vehicle_groups vg ON g.id = vg.group_id
       WHERE vg.vehicle_id = $1
       ORDER BY g.name`,
      [vehicleId]
    );
    return result.rows;
  },

  /**
   * Assign vehicle to groups
   */
  async assignToGroups(vehicleId, groupIds) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      // Remove existing assignments
      await client.query('DELETE FROM vehicle_groups WHERE vehicle_id = $1', [vehicleId]);
      // Add new assignments
      for (const groupId of groupIds) {
        await client.query(
          'INSERT INTO vehicle_groups (vehicle_id, group_id) VALUES ($1, $2)',
          [vehicleId, groupId]
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
   * Get vehicle names by array of IDs
   */
  async getNamesByIds(ids) {
    if (!ids || ids.length === 0) return [];
    const result = await db.query(
      `SELECT name FROM vehicles WHERE id = ANY($1)`,
      [ids]
    );
    return result.rows.map(row => row.name);
  }
};

module.exports = VehicleModel;
