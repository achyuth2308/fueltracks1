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
        lat=$2, lng=$3, speed=$4, direction=$5, fuel=$6, ignition=$7,
        voltage=$8, odometer=$9, satellites=$10, gsm_signal=$11,
        is_online=TRUE, last_seen=NOW()`,
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
      params.push(startDate);
      dateFilter += ` AND device_time >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
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
      params.push(startDate);
      dateFilter += ` AND device_time >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
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
      params.push(startDate);
      dateFilter += ` AND device_time >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
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
        MAX(odometer) - MIN(odometer) as distance_km,
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
        MAX(odometer) - MIN(odometer) as total_distance,
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
   * Get dashboard stats for an org
   */
  async getDashboardStats(orgId, role) {
    let orgFilterV = '';
    let orgFilterO = '';
    let orgFilterU = '';
    const params = [];

    if (role !== 'superadmin') {
      params.push(orgId);
      orgFilterV = `WHERE v.org_id = $1 OR v.org_id IN (SELECT id FROM organizations WHERE parent_id = $1)`;
      orgFilterO = `WHERE id = $1 OR parent_id = $1`;
      orgFilterU = `WHERE org_id = $1 OR org_id IN (SELECT id FROM organizations WHERE parent_id = $1)`;
    }

    const result = await db.query(
      `SELECT
        (SELECT COUNT(*) FROM vehicles v ${orgFilterV ? orgFilterV + ' AND' : 'WHERE'} v.is_active = TRUE) as total_vehicles,
        (SELECT SUM(CASE WHEN vls.is_online = TRUE THEN 1 ELSE 0 END) 
         FROM vehicles v 
         LEFT JOIN vehicle_latest_state vls ON v.id = vls.vehicle_id 
         ${orgFilterV ? orgFilterV + ' AND' : 'WHERE'} v.is_active = TRUE) as online_vehicles,
        (SELECT COUNT(*) FROM organizations ${orgFilterO}) as organizations_count,
        (SELECT COUNT(*) FROM users ${orgFilterU}) as users_count
      `,
      params
    );

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
