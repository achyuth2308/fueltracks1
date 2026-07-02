// ============================================================
// GPS MODEL - SQL queries for gps_points, alerts, vehicle_latest_state
// ============================================================

const db = require('../config/db');

const GpsModel = {
  /**
   * Save a GPS point (with dedup via ON CONFLICT)
   */
  async savePoint({ vehicleId, lat, lng, speed, direction, odometer, fuel,
                     ignition, satellites, gsmSignal, battery, voltage,
                     isLive, deviceTime }) {
    const result = await db.query(
      `INSERT INTO gps_points
        (vehicle_id, lat, lng, speed, direction, odometer, fuel, ignition,
         satellites, gsm_signal, battery, voltage, is_live, device_time)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (vehicle_id, device_time) DO NOTHING
       RETURNING id`,
      [vehicleId, lat, lng, speed, direction, odometer, fuel, ignition,
       satellites, gsmSignal, battery, voltage, isLive, deviceTime]
    );
    return result.rows[0] || null;
  },

  /**
   * Update vehicle latest state (upsert)
   */
  async updateLatestState({ vehicleId, lat, lng, speed, direction, fuel,
                             ignition, voltage, odometer, satellites, gsmSignal }) {
    await db.query(
      `INSERT INTO vehicle_latest_state
        (vehicle_id, lat, lng, speed, direction, fuel, ignition, voltage,
         odometer, satellites, gsm_signal, is_online, last_seen)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE,NOW())
       ON CONFLICT (vehicle_id) DO UPDATE SET
        lat = COALESCE($2, vehicle_latest_state.lat), 
        lng = COALESCE($3, vehicle_latest_state.lng), 
        speed = COALESCE($4, vehicle_latest_state.speed),
        direction = COALESCE($5, vehicle_latest_state.direction), 
        fuel = COALESCE($6, vehicle_latest_state.fuel), 
        ignition = COALESCE($7, vehicle_latest_state.ignition),
        voltage = COALESCE($8, vehicle_latest_state.voltage), 
        odometer = COALESCE($9, vehicle_latest_state.odometer), 
        satellites = COALESCE($10, vehicle_latest_state.satellites), 
        gsm_signal = COALESCE($11, vehicle_latest_state.gsm_signal),
        is_online = TRUE, last_seen = NOW()`,
      [vehicleId, lat, lng, speed, direction, fuel, ignition, voltage,
       odometer, satellites, gsmSignal]
    );
  },

  /**
   * Get GPS history for a vehicle (paginated)
   */
  async getHistory(vehicleId, { startDate, endDate, page = 1, limit = 100 }) {
    const offset = (page - 1) * limit;
    const params = [vehicleId];
    let dateFilter = '';

    if (startDate) {
      params.push(startDate.length === 10 ? `${startDate} 00:00:00` : startDate);
      dateFilter += ` AND device_time >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate.length === 10 ? `${endDate} 23:59:59` : endDate);
      dateFilter += ` AND device_time <= $${params.length}`;
    }

    // Count
    const countResult = await db.query(
      `SELECT COUNT(*) FROM gps_points
       WHERE vehicle_id = $1 ${dateFilter}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Fetch
    params.push(limit, offset);
    const result = await db.query(
      `SELECT id, lat, lng, speed, direction, odometer, fuel, ignition,
              satellites, gsm_signal, voltage, is_live, device_time, server_time
       FROM gps_points
       WHERE vehicle_id = $1 ${dateFilter}
       ORDER BY device_time DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      points: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Get route data (lat, lng, time, speed) for polyline drawing
   * Returns ALL points in chronological order (no pagination for route)
   */
  async getRoute(vehicleId, { startDate, endDate }) {
    const params = [vehicleId];
    let dateFilter = '';

    if (startDate) {
      params.push(startDate.length === 10 ? `${startDate} 00:00:00` : startDate);
      dateFilter += ` AND device_time >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate.length === 10 ? `${endDate} 23:59:59` : endDate);
      dateFilter += ` AND device_time <= $${params.length}`;
    }

    const result = await db.query(
      `SELECT lat, lng, speed, fuel, ignition, odometer, direction, device_time
       FROM gps_points
       WHERE vehicle_id = $1 ${dateFilter}
       ORDER BY device_time ASC`,
      params
    );

    return result.rows;
  },

  /**
   * Get daily report data for a vehicle
   */
  async getReport(vehicleId, { startDate, endDate }) {
    const params = [vehicleId];
    let dateFilter = '';

    if (startDate) {
      params.push(startDate.length === 10 ? `${startDate} 00:00:00` : startDate);
      dateFilter += ` AND device_time >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate.length === 10 ? `${endDate} 23:59:59` : endDate);
      dateFilter += ` AND device_time <= $${params.length}`;
    }

    // Daily aggregated stats
    const result = await db.query(
      `SELECT
        DATE(device_time) as date,
        COUNT(*) as total_points,
        ROUND(AVG(speed)::numeric, 1) as avg_speed,
        MAX(speed) as max_speed,
        MIN(CASE WHEN fuel > 0 THEN fuel END)::numeric as min_fuel,
        MAX(fuel)::numeric as max_fuel,
        MAX(odometer) - MIN(NULLIF(odometer, 0)) as distance_km,
        SUM(CASE WHEN ignition = TRUE THEN 1 ELSE 0 END) as ignition_on_count,
        MIN(device_time) as first_point,
        MAX(device_time) as last_point
       FROM gps_points
       WHERE vehicle_id = $1 ${dateFilter}
       GROUP BY DATE(device_time)
       ORDER BY date DESC`,
      params
    );

    // Summary
    const summaryResult = await db.query(
      `SELECT
        COUNT(*) as total_points,
        ROUND(AVG(speed)::numeric, 1) as avg_speed,
        MAX(speed) as max_speed,
        MAX(odometer) - MIN(NULLIF(odometer, 0)) as total_distance,
        MIN(CASE WHEN fuel > 0 THEN fuel END)::numeric as min_fuel,
        MAX(fuel)::numeric as max_fuel,
        MIN(device_time) as start_time,
        MAX(device_time) as end_time
       FROM gps_points
       WHERE vehicle_id = $1 ${dateFilter}`,
      params
    );

    return {
      daily: result.rows,
      summary: summaryResult.rows[0],
    };
  },

  /**
   * Save an alert
   */
  async saveAlert({ vehicleId, alertType, alertText, lat, lng, deviceTime }) {
    const result = await db.query(
      `INSERT INTO alerts (vehicle_id, alert_type, alert_text, lat, lng, device_time)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [vehicleId, alertType, alertText, lat, lng, deviceTime]
    );
    return result.rows[0];
  },

  /**
   * Get alerts for a vehicle (paginated)
   */
  async getAlerts(vehicleId, { page = 1, limit = 50, alertType } = {}) {
    const offset = (page - 1) * limit;
    const params = [vehicleId];
    let typeFilter = '';

    if (alertType) {
      params.push(alertType);
      typeFilter = ` AND alert_type = $${params.length}`;
    }

    const countResult = await db.query(
      `SELECT COUNT(*) FROM alerts WHERE vehicle_id = $1 ${typeFilter}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await db.query(
      `SELECT * FROM alerts
       WHERE vehicle_id = $1 ${typeFilter}
       ORDER BY device_time DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      alerts: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Save raw packet for debugging
   */
  async saveRawPacket(imei, raw, parsed = true, error = null) {
    await db.query(
      `INSERT INTO raw_packets (imei, raw, parsed, error) VALUES ($1, $2, $3, $4)`,
      [imei, raw, parsed, error]
    );
  },

  /**
   * Save raw packet with extended metadata for Sensor Data logs.
   * Strips null bytes (0x00) from string fields to prevent PostgreSQL UTF-8 errors.
   */
  async saveRawPacketWithMetadata({ imei, raw, packetType, deviceTime, odometer, rawHex, parsedJson }) {
    // PostgreSQL TEXT columns reject null bytes — strip them from every string field
    const sanitizeStr = (v) => (typeof v === 'string' ? v.replace(/\0/g, '') : v);

    await db.query(
      `INSERT INTO raw_packets 
       (imei, raw, parsed, packet_type, device_time, odometer, raw_hex, parsed_data) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        sanitizeStr(imei),
        sanitizeStr(raw),
        true,
        sanitizeStr(packetType),
        deviceTime,
        odometer,
        sanitizeStr(rawHex),
        sanitizeStr(parsedJson)
      ]
    );
  },

  /**
   * Get raw messages for Sensor Data page
   */
  async getRawMessages(imei, { page = 1, limit = 100 }) {
    const offset = (page - 1) * limit;

    const countResult = await db.query(
      `SELECT COUNT(*) FROM raw_packets WHERE imei = $1`,
      [imei]
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await db.query(
      `SELECT * FROM raw_packets
       WHERE imei = $1
       ORDER BY received_at DESC
       LIMIT $2 OFFSET $3`,
      [imei, limit, offset]
    );

    return {
      messages: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Get dashboard stats for an org
   */
  async getDashboardStats(orgId, role) {
    let params = [];
    let orgWhere = '';

    if (role !== 'superadmin') {
      params.push(orgId);
      orgWhere = `$1`;
    }

    let result;
    if (role === 'superadmin') {
      result = await db.query(`
        SELECT
          COUNT(DISTINCT CASE WHEN v.is_active = TRUE THEN v.id END) AS total_vehicles,
          COUNT(DISTINCT CASE WHEN v.is_active = TRUE AND vls.is_online = TRUE THEN v.id END) AS online_vehicles,
          COUNT(DISTINCT o.id) AS organizations_count,
          COUNT(DISTINCT u.id) AS users_count
        FROM organizations o
        LEFT JOIN vehicles v ON v.org_id = o.id
        LEFT JOIN vehicle_latest_state vls ON v.id = vls.vehicle_id
        LEFT JOIN users u ON u.org_id = o.id
      `);
    } else {
      result = await db.query(`
        SELECT
          COUNT(DISTINCT CASE WHEN v.is_active = TRUE THEN v.id END) AS total_vehicles,
          COUNT(DISTINCT CASE WHEN v.is_active = TRUE AND vls.is_online = TRUE THEN v.id END) AS online_vehicles,
          COUNT(DISTINCT o.id) AS organizations_count,
          COUNT(DISTINCT u.id) AS users_count
        FROM organizations o
        LEFT JOIN vehicles v ON v.org_id = o.id
        LEFT JOIN vehicle_latest_state vls ON v.id = vls.vehicle_id
        LEFT JOIN users u ON u.org_id = o.id
        WHERE o.id = $1 OR o.parent_id = $1
      `, params);
    }

    const totalVehicles = parseInt(result.rows[0].total_vehicles || 0);
    const availableInventory = 150; // Simulated unused inventory

    return {
      total_devices: totalVehicles + availableInventory,
      assigned_devices: totalVehicles,
      available_devices: availableInventory,
      total_vehicles: totalVehicles,
      online_vehicles: parseInt(result.rows[0].online_vehicles || 0),
      organizations: parseInt(result.rows[0].organizations_count || 0),
      users: parseInt(result.rows[0].users_count || 0),
    };
  },
};

module.exports = GpsModel;
