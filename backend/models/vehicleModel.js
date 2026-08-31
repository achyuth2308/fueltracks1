// ============================================================
// VEHICLE MODEL - SQL queries for vehicles table
// IMEI is the key identifier linking device packets to vehicles
// ============================================================

const db = require('../config/db');
const { redis } = require('../config/redis');

const VehicleModel = {
  /**
   * Find vehicle by IMEI (used by TCP server to match packets)
   */
  async findByImei(imei) {
    // Cache IMEI → vehicle lookups for 5 minutes.
    // This is the hottest DB read in the system — called on every GPS packet.
    // TTL-based invalidation is safe: IMEI changes only happen via the migrate
    // method (which deletes the cache entry), and metadata updates are rare.
    const cacheKey = `vehicle:imei:${imei}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (_) { /* cache read failed — fall through to DB */ }

    const result = await db.query(
      `SELECT v.*, v.metadata, o.name as org_name
       FROM vehicles v
       JOIN organizations o ON v.org_id = o.id
       WHERE v.imei = $1`,
      [imei]
    );
    const vehicle = result.rows[0] || null;

    if (vehicle) {
      try {
        await redis.set(cacheKey, JSON.stringify(vehicle), 'EX', 300); // 5-min TTL
      } catch (_) { /* non-critical — DB is the source of truth */ }
    }

    return vehicle;
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
              vls.voltage as current_voltage, vls.battery as current_battery,
              CASE WHEN vls.last_seen >= NOW() - INTERVAL '3 minutes' THEN TRUE ELSE FALSE END as is_online,
              vls.is_immobilized, vls.immobilizer_updated_at,
              vls.last_seen, CASE
                WHEN v.metadata->>'odometerReading' IS NOT NULL AND v.metadata->>'odometerReading' != '' AND v.metadata->>'odometerReading' != '0'
                THEN COALESCE(CAST(NULLIF(v.metadata->>'odometerReading','') AS NUMERIC), 0) + GREATEST(0, COALESCE(vls.odometer, 0) - COALESCE(CAST(NULLIF(v.metadata->>'odometerSnapshot','') AS NUMERIC), 0))
                ELSE COALESCE(vls.odometer, 0)
              END as current_odometer,
              vls.direction as current_direction,
              vls.satellites as current_satellites,
              vls.gsm_signal as current_gsm_signal,
              (SELECT COALESCE(SUM(dist), 0) FROM (SELECT (6371 * acos(least(1.0, cos(radians(prev_lat)) * cos(radians(lat)) * cos(radians(lng) - radians(prev_lng)) + sin(radians(prev_lat)) * sin(radians(lat))))) as dist FROM (SELECT lat, lng, LAG(lat) OVER (ORDER BY device_time) as prev_lat, LAG(lng) OVER (ORDER BY device_time) as prev_lng FROM gps_points gp WHERE gp.vehicle_id = v.id AND gp.device_time >= (DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') AND gp.lat > 6.5 AND gp.lat < 37.5 AND gp.lng > 68.0 AND gp.lng < 98.0) sub WHERE prev_lat IS NOT NULL AND (prev_lat != lat OR prev_lng != lng)) dist_sub WHERE dist > 0.01 AND dist < 5) as today_distance
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
  async findAll(orgId, role, { page = 1, limit = 100, search, groupId, userId, category, orgId: filterOrgId } = {}) {
    const offset = (page - 1) * limit;
    let whereClause = '';
    const params = [];
    let paramIndex = 1;

    if (role === 'superadmin') {
      // See all vehicles, or filter by specific org if provided
      if (filterOrgId && filterOrgId !== 'all') {
        params.push(filterOrgId);
        whereClause = `WHERE v.is_active = TRUE AND v.org_id = $${paramIndex++}`;
      } else {
        whereClause = 'WHERE v.is_active = TRUE';
      }
    } else if (role === 'customer' || role === 'dealer') {
      // See vehicles assigned to the user's groups ONLY
      params.push(userId);
      whereClause = `WHERE v.is_active = TRUE AND v.id IN (
        SELECT vg.vehicle_id 
        FROM vehicle_groups vg
        JOIN user_groups ug ON vg.group_id = ug.group_id
        WHERE ug.user_id = $${paramIndex++}
      )`;
    }

    // Category filter (TG Mining, VLTD, VLTD + Mining, General, etc.)
    if (category && category !== 'All' && category !== 'all') {
      params.push(category);
      whereClause += ` AND (v.category ILIKE $${paramIndex} OR (v.category IS NULL AND $${paramIndex} = 'General'))`;
      paramIndex++;
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
      `SELECT COUNT(DISTINCT v.id) FROM vehicles v ${whereClause}`,
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
              v.category,
              o.name as org_name,
              d.licence_id as "licenceId",
              d.device_type as "deviceType",
              STRING_AGG(DISTINCT g.name, ', ' ORDER BY g.name) as group_name,
              JSON_AGG(DISTINCT jsonb_build_object('id', g.id, 'name', g.name)) FILTER (WHERE g.id IS NOT NULL) as groups,
              vls.lat, vls.lng, vls.speed as current_speed,
              vls.fuel as current_fuel, vls.ignition as current_ignition,
              vls.voltage as current_voltage, vls.battery as current_battery,
              CASE WHEN vls.last_seen >= NOW() - INTERVAL '3 minutes' THEN TRUE ELSE FALSE END as is_online,
              vls.is_immobilized, vls.immobilizer_updated_at,
              vls.last_seen, vls.direction as current_direction,
              CASE
                WHEN v.metadata->>'odometerReading' IS NOT NULL AND v.metadata->>'odometerReading' != '' AND v.metadata->>'odometerReading' != '0'
                THEN COALESCE(CAST(NULLIF(v.metadata->>'odometerReading','') AS NUMERIC), 0) + GREATEST(0, COALESCE(vls.odometer, 0) - COALESCE(CAST(NULLIF(v.metadata->>'odometerSnapshot','') AS NUMERIC), 0))
                ELSE COALESCE(vls.odometer, 0)
              END as current_odometer,
              (SELECT COALESCE(SUM(dist), 0) FROM (SELECT (6371 * acos(least(1.0, cos(radians(prev_lat)) * cos(radians(lat)) * cos(radians(lng) - radians(prev_lng)) + sin(radians(prev_lat)) * sin(radians(lat))))) as dist FROM (SELECT lat, lng, LAG(lat) OVER (ORDER BY device_time) as prev_lat, LAG(lng) OVER (ORDER BY device_time) as prev_lng FROM gps_points gp WHERE gp.vehicle_id = v.id AND gp.device_time >= (DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') AND gp.lat > 6.5 AND gp.lat < 37.5 AND gp.lng > 68.0 AND gp.lng < 98.0) sub WHERE prev_lat IS NOT NULL AND (prev_lat != lat OR prev_lng != lng)) dist_sub WHERE dist > 0.01 AND dist < 5) as today_distance
       FROM vehicles v
       JOIN organizations o ON v.org_id = o.id
       LEFT JOIN vehicle_latest_state vls ON v.id = vls.vehicle_id
       LEFT JOIN vehicle_groups vg ON v.id = vg.vehicle_id
       LEFT JOIN groups g ON vg.group_id = g.id
       LEFT JOIN devices d ON v.imei = d.device_id
       ${whereClause}
       GROUP BY v.id, v.org_id, v.imei, v.name, v.plate, v.model,
                v.driver_name, v.driver_phone, v.is_active, v.created_at,
                v.server_name, v.gps_sim_no, v.device_version, v.timezone,
                v.apn, v.licence_issued_date, v.licence_expire_date, v.metadata,
                v.category,
                o.name, d.licence_id, d.device_type, vls.lat, vls.lng, vls.speed, vls.fuel, vls.ignition,
                vls.voltage, vls.battery, vls.is_immobilized, vls.immobilizer_updated_at, vls.last_seen, vls.direction, vls.odometer
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
  async create({ orgId, imei, name, plate, model, driverName, driverPhone, serverName, gpsSimNo, deviceVersion, timezone, apn, licenceIssuedDate, licenceExpireDate, metadata, category }) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Insert vehicle
      const result = await client.query(
        `INSERT INTO vehicles (org_id, imei, name, plate, model, driver_name, driver_phone, server_name, gps_sim_no, device_version, timezone, apn, licence_issued_date, licence_expire_date, metadata, category)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING *`,
        [orgId, imei, name, plate, model, driverName, driverPhone, serverName, gpsSimNo, deviceVersion, timezone, apn, licenceIssuedDate || null, licenceExpireDate || null, metadata || {}, category || 'General']
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
  async update(vehicleId, { name, plate, model, driverName, driverPhone, isActive, orgId, serverName, gpsSimNo, deviceVersion, timezone, apn, licenceIssuedDate, licenceExpireDate, metadata, category }) {
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
    if (category !== undefined) { fields.push(`category = $${paramIndex++}`); values.push(category || 'General'); }

    if (fields.length === 0) return null;

    values.push(vehicleId);
    const result = await db.query(
      `UPDATE vehicles SET ${fields.join(', ')} WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );
    
    const updatedVehicle = result.rows[0] || null;
    if (updatedVehicle && updatedVehicle.imei) {
      try {
        await redis.del(`vehicle:imei:${updatedVehicle.imei}`);
      } catch (err) {
        console.error('[REDIS] Cache invalidation failed for vehicle update:', err.message);
      }
    }
    
    return updatedVehicle;
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
    // Fetch the current IMEI before overwriting so we can purge the old cache entry.
    const currentRow = await db.query(`SELECT imei FROM vehicles WHERE id = $1`, [vehicleId]);
    const oldImei = currentRow.rows[0]?.imei;

    const result = await db.query(
      `UPDATE vehicles SET imei = $1 WHERE id = $2 RETURNING *`,
      [newImei, vehicleId]
    );

    // Invalidate cache for both the old IMEI (now stale) and the new IMEI
    // (may exist from a previous registration of the same device).
    const keysToDelete = [oldImei, newImei].filter(Boolean).map(i => `vehicle:imei:${i}`);
    if (keysToDelete.length) {
      try { await redis.del(...keysToDelete); } catch (_) {}
    }

    return result.rows[0] || null;
  },

  /**
   * Check if vehicle belongs to org (ownership check for RBAC)
   */
  async belongsToOrg(vehicleId, orgId, userId = null, role = null) {
    if (role === 'customer' || role === 'dealer') {
      const result = await db.query(
        `SELECT v.id FROM vehicles v
         WHERE v.id = $1 AND v.id IN (
           SELECT vg.vehicle_id 
           FROM vehicle_groups vg
           JOIN user_groups ug ON vg.group_id = ug.group_id
           WHERE ug.user_id = $2
         )`,
        [vehicleId, userId]
      );
      return result.rows.length > 0;
    } else {
      const result = await db.query(
        `SELECT id FROM vehicles
         WHERE id = $1 AND (
           org_id = $2
           OR org_id IN (SELECT id FROM organizations WHERE parent_id = $2)
         )`,
        [vehicleId, orgId]
      );
      return result.rows.length > 0;
    }
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
      if (Array.isArray(groupIds)) {
        for (const groupId of groupIds) {
          if (groupId) {
            await client.query(
              'INSERT INTO vehicle_groups (vehicle_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [vehicleId, groupId]
            );
          }
        }
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
   * Bulk assign multiple vehicles to multiple groups
   */
  async bulkAssignGroups(vehicleIds, groupIds, mode = 'replace') {
    if (!Array.isArray(vehicleIds) || vehicleIds.length === 0) return { updatedCount: 0 };
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      for (const vehicleId of vehicleIds) {
        if (mode === 'replace') {
          await client.query('DELETE FROM vehicle_groups WHERE vehicle_id = $1', [vehicleId]);
        }
        if (Array.isArray(groupIds)) {
          for (const groupId of groupIds) {
            if (groupId) {
              await client.query(
                'INSERT INTO vehicle_groups (vehicle_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [vehicleId, groupId]
              );
            }
          }
        }
      }
      await client.query('COMMIT');
      return { updatedCount: vehicleIds.length };
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
  },

  /**
   * Update immobilizer state for vehicle
   */
  async setImmobilizerState(vehicleId, isImmobilized) {
    const result = await db.query(
      `INSERT INTO vehicle_latest_state (vehicle_id, is_immobilized, immobilizer_updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (vehicle_id) DO UPDATE
       SET is_immobilized = $2, immobilizer_updated_at = NOW()
       RETURNING is_immobilized, immobilizer_updated_at`,
      [vehicleId, isImmobilized]
    );
    return result.rows[0] || null;
  }
};

module.exports = VehicleModel;
