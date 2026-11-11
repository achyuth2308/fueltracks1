// ============================================================
// VEHICLE MODEL - SQL queries for vehicles table
// IMEI is the key identifier linking device packets to vehicles
// ============================================================

const db = require('../config/db');
const { redis } = require('../config/redis');

function enrichVehicleFuel(v) {
  if (!v) return v;
  let tankCap = null;
  const meta = v.metadata || {};
  const fuelCal = meta.fuelCalibration || meta.fuel || {};
  if (fuelCal.tanks && typeof fuelCal.tanks === 'object') {
    const tVals = Object.values(fuelCal.tanks);
    const sumCap = tVals.reduce((sum, t) => sum + (parseFloat(t.tankSize) || 0), 0);
    if (sumCap > 0) tankCap = Math.round(sumCap * 10) / 10;
  }
  if (!tankCap) {
    const rawCap = parseFloat(fuelCal.tankSize || meta.tankSize || meta.tankCapacity);
    if (!isNaN(rawCap) && rawCap > 0) tankCap = Math.round(rawCap * 10) / 10;
  }

  const curFuel = v.current_fuel != null && !isNaN(v.current_fuel)
    ? Math.round(parseFloat(v.current_fuel) * 10) / 10
    : null;
  const fuelPercent = (tankCap > 0 && curFuel != null)
    ? Math.max(0, Math.min(100, Math.round((curFuel / tankCap) * 1000) / 10))
    : null;

  return {
    ...v,
    current_fuel: curFuel,
    tank_capacity: tankCap,
    fuel_percentage: fuelPercent
  };
}

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
              d.device_type, d.licence_id,
              vls.lat, vls.lng, vls.speed as current_speed,
              vls.fuel as current_fuel, vls.ignition as current_ignition,
              vls.voltage as current_voltage, vls.battery as current_battery,
              CASE 
                -- 1. Active telemetry within 1 hour: Live / Online
                WHEN vls.last_seen >= NOW() - INTERVAL '1 hour' THEN TRUE 
                -- 2. Parked vehicles (Ignition OFF, Speed <= 2): Universal 24h Sleep Mode for ALL vehicles
                WHEN (vls.ignition = FALSE OR vls.ignition IS NULL)
                  AND (vls.speed <= 2.0 OR vls.speed IS NULL)
                  AND vls.last_seen >= NOW() - INTERVAL '24 hours' THEN TRUE
                ELSE FALSE 
              END as is_online,
              vls.is_immobilized, vls.immobilizer_updated_at,
              vls.last_seen, GREATEST(0, CASE
                WHEN v.metadata->>'odometerReading' IS NOT NULL AND v.metadata->>'odometerReading' != '' AND v.metadata->>'odometerReading' != '0'
                THEN COALESCE(CAST(NULLIF(v.metadata->>'odometerReading','') AS NUMERIC), 0) + GREATEST(0, (CASE WHEN vls.today_start_odometer IS NOT NULL THEN (COALESCE(vls.today_start_odometer, 0) + COALESCE(vls.today_distance, 0)) ELSE COALESCE(vls.today_distance, vls.odometer, 0) END) - COALESCE(CAST(NULLIF(v.metadata->>'odometerSnapshot','') AS NUMERIC), 0))
                ELSE CASE WHEN vls.today_start_odometer IS NOT NULL THEN (COALESCE(vls.today_start_odometer, 0) + COALESCE(vls.today_distance, 0)) ELSE COALESCE(vls.today_distance, vls.odometer, 0) END
              END) as current_odometer,
              vls.direction as current_direction,
              vls.satellites as current_satellites,
              vls.gsm_signal as current_gsm_signal,
              vls.today_distance as today_distance
       FROM vehicles v
       JOIN organizations o ON v.org_id = o.id
       LEFT JOIN devices d ON v.imei = d.device_id
       LEFT JOIN vehicle_latest_state vls ON v.id = vls.vehicle_id
       WHERE v.id = $1`,
      [vehicleId]
    );
    return result.rows[0] ? enrichVehicleFuel(result.rows[0]) : null;
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
    } else if (role === 'customer') {
      // See vehicles assigned to the customer's groups ONLY
      params.push(userId);
      whereClause = `WHERE v.is_active = TRUE AND v.id IN (
        SELECT vg.vehicle_id 
        FROM vehicle_groups vg
        JOIN user_groups ug ON vg.group_id = ug.group_id
        WHERE ug.user_id = $${paramIndex++}
      )`;
    } else {
      // Dealer: See vehicles in own org + child orgs, or scoped to selected child org
      if (filterOrgId && filterOrgId !== 'all') {
        params.push(filterOrgId, orgId);
        whereClause = `WHERE v.is_active = TRUE AND v.org_id = $${paramIndex++} AND (
          v.org_id = $${paramIndex} OR v.org_id IN (SELECT id FROM organizations WHERE parent_id = $${paramIndex})
        )`;
        paramIndex++;
      } else {
        params.push(orgId);
        whereClause = `WHERE v.is_active = TRUE AND (
          v.org_id = $${paramIndex++}
          OR v.org_id IN (SELECT id FROM organizations WHERE parent_id = $1)
        )`;
      }
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
              CASE 
                -- 1. Active telemetry within 1 hour: Live / Online
                WHEN vls.last_seen >= NOW() - INTERVAL '1 hour' THEN TRUE 
                -- 2. Parked vehicles (Ignition OFF, Speed <= 2): Universal 24h Sleep Mode for ALL vehicles
                WHEN (vls.ignition = FALSE OR vls.ignition IS NULL)
                  AND (vls.speed <= 2.0 OR vls.speed IS NULL)
                  AND vls.last_seen >= NOW() - INTERVAL '24 hours' THEN TRUE
                ELSE FALSE 
              END as is_online,
              vls.is_immobilized, vls.immobilizer_updated_at,
              vls.last_seen, vls.direction as current_direction,
              GREATEST(0, CASE
                WHEN v.metadata->>'odometerReading' IS NOT NULL AND v.metadata->>'odometerReading' != '' AND v.metadata->>'odometerReading' != '0'
                THEN COALESCE(CAST(NULLIF(v.metadata->>'odometerReading','') AS NUMERIC), 0) + GREATEST(0, (CASE WHEN vls.today_start_odometer IS NOT NULL THEN (COALESCE(vls.today_start_odometer, 0) + COALESCE(vls.today_distance, 0)) ELSE COALESCE(vls.today_distance, vls.odometer, 0) END) - COALESCE(CAST(NULLIF(v.metadata->>'odometerSnapshot','') AS NUMERIC), 0))
                ELSE CASE WHEN vls.today_start_odometer IS NOT NULL THEN (COALESCE(vls.today_start_odometer, 0) + COALESCE(vls.today_distance, 0)) ELSE COALESCE(vls.today_distance, vls.odometer, 0) END
              END) as current_odometer,
              COALESCE(vls.today_distance, 0) as today_distance
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
                vls.voltage, vls.battery, vls.is_immobilized, vls.immobilizer_updated_at, vls.last_seen, vls.direction, vls.odometer, vls.today_distance, vls.today_start_odometer
       ORDER BY v.name ASC NULLS LAST, v.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return {
      vehicles: result.rows.map(enrichVehicleFuel),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async create({ orgId, imei, name, plate, model, driverName, driverPhone, serverName, gpsSimNo, deviceVersion, timezone, apn, licenceIssuedDate, licenceExpireDate, metadata, category, isSandMining }) {
    let finalIssuedDate = licenceIssuedDate || null;
    let finalExpireDate = licenceExpireDate || null;
    if (finalIssuedDate && !finalExpireDate) {
      const d = new Date(finalIssuedDate);
      if (!isNaN(d.getTime())) {
        const exp = new Date(d.getTime());
        exp.setFullYear(exp.getFullYear() + 1);
        exp.setDate(exp.getDate() - 1);
        finalExpireDate = exp;
      }
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Insert vehicle
      const result = await client.query(
        `INSERT INTO vehicles (org_id, imei, name, plate, model, driver_name, driver_phone, server_name, gps_sim_no, device_version, timezone, apn, licence_issued_date, licence_expire_date, metadata, category, is_sand_mining)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         RETURNING *`,
        [orgId, imei, name, plate, model, driverName, driverPhone, serverName, gpsSimNo, deviceVersion, timezone, apn, finalIssuedDate, finalExpireDate, metadata || {}, category || 'General', isSandMining || false]
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
  async update(vehicleId, { name, plate, model, driverName, driverPhone, isActive, orgId, serverName, gpsSimNo, deviceVersion, timezone, apn, licenceIssuedDate, licenceExpireDate, metadata, category, isSandMining }) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(name); }
    if (plate !== undefined) { fields.push(`plate = $${paramIndex++}`); values.push(plate); }
    if (model !== undefined) { fields.push(`model = $${paramIndex++}`); values.push(model); }
    if (driverName !== undefined) { fields.push(`driver_name = $${paramIndex++}`); values.push(driverName); }
    if (isSandMining !== undefined) { fields.push(`is_sand_mining = $${paramIndex++}`); values.push(isSandMining); }
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

      // Keep devices.device_type in sync with vehicle device version / model
      const modelToSync = (metadata && metadata.deviceModel) || deviceVersion;
      if (modelToSync) {
        try {
          await db.query(
            `UPDATE devices SET device_type = $1 WHERE device_id = $2`,
            [modelToSync, updatedVehicle.imei]
          );
        } catch (syncErr) {
          console.warn('[DB] Failed to sync device_type to devices table:', syncErr.message);
        }
      }
    }
    
    return updatedVehicle;
  },

  /**
   * Delete vehicle (soft delete)
   */
  async delete(vehicleId) {
    await db.query(`DELETE FROM vehicle_groups WHERE vehicle_id = $1`, [vehicleId]);
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

    if (oldImei && oldImei !== newImei) {
      // Fetch the old device record
      const oldDevice = await db.query(`SELECT * FROM devices WHERE device_id = $1`, [oldImei]);
      
      if (oldDevice.rows.length > 0) {
        const d = oldDevice.rows[0];
        
        // Insert NEW device record, preserving licence, org, etc., and linking to the vehicle
        await db.query(
          `INSERT INTO devices 
            (org_id, device_id, device_type, licence_id, vehicle_id, assigned_user_id, assigned_group_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (device_id) DO UPDATE SET
             org_id = EXCLUDED.org_id,
             device_type = EXCLUDED.device_type,
             licence_id = EXCLUDED.licence_id,
             vehicle_id = EXCLUDED.vehicle_id,
             assigned_user_id = EXCLUDED.assigned_user_id,
             assigned_group_id = EXCLUDED.assigned_group_id`,
          [d.org_id, newImei, d.device_type, d.licence_id, vehicleId, d.assigned_user_id, d.assigned_group_id]
        );
        
        // Mark OLD device as unassigned and stripped of licence
        await db.query(
          `UPDATE devices 
           SET vehicle_id = NULL, licence_id = NULL, assigned_user_id = NULL, assigned_group_id = NULL
           WHERE device_id = $1`,
          [oldImei]
        );
      }
    }

    // Invalidate cache for both the old IMEI (now stale) and the new IMEI
    // (may exist from a previous registration of the same device).
    const keysToDelete = [oldImei, newImei].filter(Boolean).map(i => `vehicle:imei:${i}`);
    if (keysToDelete.length) {
      try { await redis.del(...keysToDelete); } catch (_) {}
    }

    return result.rows[0] || null;
  },

  /**
   * Move an existing device (current IMEI) to a completely new vehicle,
   * detaching it from the old vehicle so old history stays separated.
   */
  async reassignDeviceToNewVehicle({ oldVehicleId, newPlate, newName, targetOrgId, model, category, deactivateOldVehicle = false }) {
    // 1. Get old vehicle
    const oldVehRes = await db.query(`SELECT * FROM vehicles WHERE id = $1`, [oldVehicleId]);
    if (oldVehRes.rows.length === 0) throw new Error('Source vehicle not found.');
    const oldVeh = oldVehRes.rows[0];
    const imei = oldVeh.imei;
    if (!imei) throw new Error('Source vehicle has no IMEI device assigned.');

    // 2. Unlink IMEI from old vehicle
    await db.query(
      `UPDATE vehicles SET imei = NULL, is_active = $1, updated_at = NOW() WHERE id = $2`,
      [!deactivateOldVehicle, oldVehicleId]
    );

    // 3. Create the brand new vehicle with clean history
    const finalOrgId = targetOrgId || oldVeh.org_id;
    const finalName = (newName || newPlate).trim();
    const finalPlate = (newPlate || newName).trim();
    const finalModel = model || oldVeh.model || 'truck';
    const finalCategory = category || oldVeh.category || 'General';

    const newVehRes = await db.query(
      `INSERT INTO vehicles (name, plate, imei, org_id, model, category, licence_issued_date, licence_expire_date, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW(), NOW())
       RETURNING *`,
      [finalName, finalPlate, imei, finalOrgId, finalModel, finalCategory, oldVeh.licence_issued_date, oldVeh.licence_expire_date]
    );
    const newVehicle = newVehRes.rows[0];

    // 4. Create clean initial state for new vehicle
    await db.query(
      `INSERT INTO vehicle_latest_state (vehicle_id, is_online, speed, odometer, today_distance, last_seen)
       VALUES ($1, FALSE, 0, 0, 0, NULL)
       ON CONFLICT (vehicle_id) DO NOTHING`,
      [newVehicle.id]
    );

    // 5. Update devices table to point to new vehicle and new org
    await db.query(
      `UPDATE devices SET vehicle_id = $1, org_id = $2, updated_at = NOW() WHERE device_id = $3`,
      [newVehicle.plate, finalOrgId, imei]
    );

    // 6. Invalidate Redis cache
    try { await redis.del(`vehicle:imei:${imei}`); } catch (_) {}

    return newVehicle;
  },

  /**
   * Check if vehicle belongs to org (ownership check for RBAC)
   */
  async belongsToOrg(vehicleId, orgId, userId = null, role = null) {
    if (role === 'customer' && userId) {
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
