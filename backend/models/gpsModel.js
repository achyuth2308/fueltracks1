// ============================================================
// GPS MODEL - SQL queries for gps_points, alerts, vehicle_latest_state
// ============================================================

const db = require('../config/db');
const { redis } = require('../config/redis');

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
   * Get recent alerts for an organization
   */
  async getRecentAlerts(orgId, limit = 100) {
    const result = await db.query(
      `SELECT a.id, a.vehicle_id as "vehicleId", v.imei, v.name as "vehicleName", v.plate,
              a.alert_type as "alertType", a.alert_text as "alertText", 
              a.lat, a.lng, a.device_time as "deviceTime", a.server_time as "serverTime",
              COALESCE(a.is_read, FALSE) as "isRead"
       FROM alerts a
       JOIN vehicles v ON a.vehicle_id = v.id
       WHERE v.org_id = $1 AND COALESCE(a.is_read, FALSE) = FALSE
       ORDER BY a.server_time DESC
       LIMIT $2`,
      [orgId, limit]
    );
    return result.rows;
  },

  /**
   * Update vehicle latest state (upsert)
   */
  async updateLatestState({ vehicleId, lat, lng, speed, direction, fuel,
                             ignition, voltage, odometer, satellites, gsmSignal, battery }) {
    await db.query(
      `INSERT INTO vehicle_latest_state
        (vehicle_id, lat, lng, speed, direction, fuel, ignition, voltage,
         odometer, satellites, gsm_signal, battery, is_online, last_seen)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,TRUE,NOW())
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
        battery = COALESCE($12, vehicle_latest_state.battery),
        is_online = TRUE, last_seen = NOW()`,
      [vehicleId, lat, lng, speed, direction, fuel, ignition, voltage,
       odometer, satellites, gsmSignal, battery]
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
              satellites, gsm_signal, battery, voltage, is_live, device_time, server_time
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
      `SELECT lat, lng, speed, fuel, ignition, odometer, direction, battery, voltage, device_time
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
      const typeStr = alertType.toLowerCase();
      if (typeStr === 'geofence') {
        typeFilter = ` AND alert_type IN ('geofence', 'geofence_enter', 'geofence_exit', 'geofenceenter', 'geofenceexit')`;
      } else if (typeStr === 'ignition') {
        typeFilter = ` AND alert_type IN ('ignition', 'ignition_on', 'ignition_off', 'moving', 'start_moving', 'trip_started', 'trip_ended', 'stopped', 'idle', 'stoppage')`;
      } else if (typeStr === 'sos') {
        typeFilter = ` AND alert_type IN ('sos', 'panic', 'theft', 'theft_alarm', 'tamper', 'tow', 'crash', 'accident')`;
      } else if (typeStr === 'power') {
        typeFilter = ` AND alert_type IN ('power', 'power_cut', 'power_disconnected', 'battery', 'low_battery')`;
      } else if (typeStr === 'harsh') {
        typeFilter = ` AND alert_type IN ('harsh', 'harsh_driving', 'harsh_braking', 'harsh_acceleration')`;
      } else {
        params.push(typeStr);
        typeFilter = ` AND alert_type = $${params.length}`;
      }
    }

    const countResult = await db.query(
      `SELECT COUNT(*) FROM alerts WHERE vehicle_id = $1 ${typeFilter}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await db.query(
      `SELECT a.id, a.vehicle_id as "vehicleId", v.name as "vehicleName", v.plate, v.imei,
              a.alert_type as "alertType", a.alert_text as "alertText",
              a.lat, a.lng, a.device_time as "deviceTime", a.server_time as "serverTime",
              COALESCE(a.is_read, FALSE) as "isRead"
       FROM alerts a
       JOIN vehicles v ON a.vehicle_id = v.id
       WHERE a.vehicle_id = $1 ${typeFilter}
       ORDER BY a.device_time DESC
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
    const sampleRate = parseInt(process.env.RAW_LOG_SAMPLE_RATE) || 1;
    if (sampleRate > 1 && Math.random() > (1 / sampleRate)) {
      return; // Skip logging this packet
    }

    await db.query(
      `INSERT INTO raw_packets (imei, raw, parsed, error) VALUES ($1, $2, $3, $4)`,
      [imei, raw, parsed, error]
    );
  },

  /**
   * Save raw packet with extended metadata for Sensor Data logs.
   * Strips null bytes (0x00) from string fields to prevent PostgreSQL UTF-8 errors.
   */
  async saveRawPacketWithMetadata({ imei, raw, packetType, deviceTime, odometer, rawHex, parsedJson, parsed = true, error = null }) {
    if (!imei) return;
    const sampleRate = parseInt(process.env.RAW_LOG_SAMPLE_RATE) || 1;
    if (sampleRate > 1 && Math.random() > (1 / sampleRate)) {
      return; // Skip logging this packet
    }

    // PostgreSQL TEXT columns reject null bytes — strip them from every string field
    const sanitizeStr = (v) => (typeof v === 'string' ? v.replace(/\0/g, '') : (v == null ? null : String(v)));
    const cleanRaw = sanitizeStr(rawHex || raw);
    const cleanPacketType = sanitizeStr(packetType || 'DATA');
    const safeDeviceTime = deviceTime && !isNaN(new Date(deviceTime).getTime()) ? new Date(deviceTime) : new Date();
    const safeOdometer = odometer !== null && odometer !== undefined && !isNaN(Number(odometer)) ? Math.round(Number(odometer)) : 0;
    const parsedDataJson = parsedJson ? (typeof parsedJson === 'object' ? JSON.stringify(parsedJson) : String(parsedJson)) : null;
    const isParsed = parsed !== false;
    const cleanError = sanitizeStr(error);

    try {
      await db.query(
        `INSERT INTO raw_packets 
         (imei, raw, parsed, packet_type, device_time, odometer, raw_hex, parsed_data, error) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          sanitizeStr(imei),
          cleanRaw,
          isParsed,
          cleanPacketType,
          safeDeviceTime,
          safeOdometer,
          cleanRaw,
          parsedDataJson,
          cleanError
        ]
      );
    } catch (err) {
      // Safe fallback if extended columns have issues
      try {
        await db.query(
          `INSERT INTO raw_packets (imei, raw, parsed, error) VALUES ($1, $2, $3, $4)`,
          [sanitizeStr(imei), cleanRaw, isParsed, cleanError]
        );
      } catch (fallbackErr) {
        console.error('[DB] saveRawPacket fallback error:', fallbackErr.message);
      }
    }
  },

  /**
   * Get raw messages for Sensor Data page
   */
  async getRawMessages(imei, { page = 1, limit = 100 }) {
    if (!imei) {
      return { messages: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 1 } };
    }
    const offset = (page - 1) * limit;

    const countResult = await db.query(
      `SELECT COUNT(*) FROM raw_packets WHERE imei = $1`,
      [imei]
    );
    const total = parseInt(countResult.rows[0]?.count || 0);

    const result = await db.query(
      `SELECT id, imei, raw, parsed, error, received_at,
              COALESCE(packet_type, 'DATA') as packet_type,
              COALESCE(device_time, received_at) as device_time,
              COALESCE(odometer, 0) as odometer,
              COALESCE(raw_hex, raw) as raw_hex,
              parsed_data
       FROM raw_packets
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
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  },

  /**
   * Get paginated alerts for an org (user-facing history feed)
   */
  async getAlertsForOrg(orgId, { page = 1, limit = 50, alertType, role, userId } = {}) {
    // 1. Try Redis cache for default fetch
    const redisKey = `org:alerts:${orgId}`;
    if (page === 1 && !alertType && limit <= 50 && role !== 'user') {
      try {
        const cached = await redis.lrange(redisKey, 0, limit - 1);
        if (cached && cached.length > 0) {
          return {
            alerts: cached.map(JSON.parse),
            pagination: { page: 1, limit, total: -1, totalPages: 1 }, // approximated for cache
          };
        }
      } catch (err) {
        console.warn('[REDIS] Alert cache read failed:', err.message);
      }
    }

    const offset = (page - 1) * limit;
    const params = [orgId];
    let typeFilter = '';
    
    // Add user filter
    let userFilter = '';
    if (role === 'user' && userId) {
      params.push(userId);
      userFilter = ` AND EXISTS (SELECT 1 FROM vehicle_groups vg JOIN user_groups ug ON vg.group_id = ug.group_id WHERE vg.vehicle_id = v.id AND ug.user_id = $${params.length})`;
    }

    if (alertType) {
      const typeStr = alertType.toLowerCase();
      if (typeStr === 'geofence') {
        typeFilter = ` AND a.alert_type IN ('geofence', 'geofence_enter', 'geofence_exit', 'geofenceenter', 'geofenceexit')`;
      } else if (typeStr === 'ignition') {
        typeFilter = ` AND a.alert_type IN ('ignition', 'ignition_on', 'ignition_off', 'moving', 'start_moving', 'trip_started', 'trip_ended', 'stopped', 'idle', 'stoppage')`;
      } else if (typeStr === 'sos') {
        typeFilter = ` AND a.alert_type IN ('sos', 'panic', 'theft', 'theft_alarm', 'tamper', 'tow', 'crash', 'accident')`;
      } else if (typeStr === 'power') {
        typeFilter = ` AND a.alert_type IN ('power', 'power_cut', 'power_disconnected', 'battery', 'low_battery')`;
      } else if (typeStr === 'harsh') {
        typeFilter = ` AND a.alert_type IN ('harsh', 'harsh_driving', 'harsh_braking', 'harsh_acceleration')`;
      } else {
        params.push(typeStr);
        typeFilter = ` AND a.alert_type = $${params.length}`;
      }
    }

    const countResult = await db.query(
      `SELECT COUNT(*) FROM alerts a
       JOIN vehicles v ON a.vehicle_id = v.id
       WHERE v.org_id = $1 ${userFilter} ${typeFilter}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await db.query(
      `SELECT a.id, a.vehicle_id as "vehicleId", v.name as "vehicleName", v.plate, v.imei,
              a.alert_type as "alertType", a.alert_text as "alertText",
              a.lat, a.lng, a.device_time as "deviceTime", a.server_time as "serverTime",
              COALESCE(a.is_read, FALSE) as "isRead"
       FROM alerts a
       JOIN vehicles v ON a.vehicle_id = v.id
       WHERE v.org_id = $1 ${userFilter} ${typeFilter}
       ORDER BY a.server_time DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    // 2. Populate Redis cache on miss
    if (page === 1 && !alertType && result.rows.length > 0 && role !== 'user') {
      try {
        const pipeline = redis.pipeline();
        pipeline.del(redisKey);
        result.rows.slice(0, 50).forEach(alert => {
          pipeline.rpush(redisKey, JSON.stringify(alert));
        });
        pipeline.expire(redisKey, 86400); // 24h
        await pipeline.exec();
      } catch (err) {
        console.warn('[REDIS] Alert cache write failed:', err.message);
      }
    }

    return {
      alerts: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  /**
   * Mark a single alert as read
   */
  async markAlertRead(alertId, orgId) {
    let query, params;
    if (orgId) {
      query = `UPDATE alerts SET is_read = TRUE WHERE id = $1 AND vehicle_id IN (SELECT id FROM vehicles WHERE org_id = $2) RETURNING id`;
      params = [alertId, orgId];
    } else {
      query = `UPDATE alerts SET is_read = TRUE WHERE id = $1 RETURNING id, (SELECT org_id FROM vehicles WHERE id = vehicle_id) as v_org`;
      params = [alertId];
    }
    const result = await db.query(query, params);

    if (result.rows.length > 0) {
      try {
        const targetOrgId = orgId || result.rows[0].v_org;
        if (targetOrgId) await redis.del(`org:alerts:${targetOrgId}`);
      } catch (err) {
        console.warn('[REDIS] Alert cache invalidation failed:', err.message);
      }
    }

    return result.rows[0] || null;
  },

  /**
   * Mark all alerts as read for an org
   */
  async markAllAlertsRead(orgId) {
    let query, params;
    if (orgId) {
      query = `UPDATE alerts SET is_read = TRUE WHERE vehicle_id IN (SELECT id FROM vehicles WHERE org_id = $1) AND COALESCE(is_read, FALSE) = FALSE RETURNING id`;
      params = [orgId];
    } else {
      query = `UPDATE alerts SET is_read = TRUE WHERE COALESCE(is_read, FALSE) = FALSE RETURNING id`;
      params = [];
    }
    const result = await db.query(query, params);

    if (result.rows.length > 0 && orgId) {
      try {
        await redis.del(`org:alerts:${orgId}`);
      } catch (err) {
        console.warn('[REDIS] Alert cache invalidation failed:', err.message);
      }
    }

    return result.rowCount;
  },

  /**
   * Get user alert preferences (returns defaults if not set)
   */
  async getUserAlertPreferences(userId) {
    // 1. Try to fetch from Redis Cache
    const redisKey = `user:preferences:${userId}`;
    try {
      const cached = await redis.get(redisKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.warn('[REDIS] Failed to get user preferences from cache:', err.message);
    }

    // 2. Fallback to Database
    const result = await db.query(
      `SELECT preferences FROM user_alert_preferences WHERE user_id = $1`,
      [userId]
    );

    let preferences = null;
    if (result.rows[0]) {
      preferences = result.rows[0].preferences;
    } else {
      // Return default preferences
      preferences = {
        sos: true, panic: true, crash: true, accident: true,
        tow: true, power_cut: true, theft: true, theft_alarm: true,
        safety_park: true,
        overspeed: true, harsh_braking: true, harsh_acceleration: true,
        geofence_enter: true, geofence_exit: true, low_battery: true,
        ignition_on: true, ignition_off: true, idle: false,
        stoppage: false, parking: true, trip_started: false, stopped: false,
      };
    }

    // 3. Save to Redis Cache (expire in 24 hours to keep fresh)
    try {
      await redis.set(redisKey, JSON.stringify(preferences), 'EX', 86400);
    } catch (err) {
      console.warn('[REDIS] Failed to cache user preferences:', err.message);
    }

    return preferences;
  },

  /**
   * Upsert user alert preferences
   */
  async upsertUserAlertPreferences(userId, preferences) {
    const result = await db.query(
      `INSERT INTO user_alert_preferences (user_id, preferences, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET preferences = $2, updated_at = NOW()
       RETURNING preferences`,
      [userId, JSON.stringify(preferences)]
    );

    // Update Redis Cache instantly
    const redisKey = `user:preferences:${userId}`;
    try {
      await redis.set(redisKey, JSON.stringify(result.rows[0].preferences), 'EX', 86400);
    } catch (err) {
      console.warn('[REDIS] Failed to update user preferences cache:', err.message);
    }

    return result.rows[0].preferences;
  },

  /**
   * Register or update an FCM token for a user
   */
  async registerFcmToken(userId, fcmToken, deviceInfo = {}) {
    await db.query(
      `INSERT INTO user_fcm_tokens (user_id, fcm_token, device_info, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, fcm_token) DO UPDATE SET device_info = $3, updated_at = NOW()`,
      [userId, fcmToken, JSON.stringify(deviceInfo)]
    );
  },

  /**
   * Remove an FCM token (logout / token refresh)
   */
  async removeFcmToken(userId, fcmToken) {
    await db.query(
      `DELETE FROM user_fcm_tokens WHERE user_id = $1 AND fcm_token = $2`,
      [userId, fcmToken]
    );
  },

  async getFcmTokensForAlert(orgId, vehicleId, alertType) {
    let prefKey = alertType;
    if (alertType) {
      const type = alertType.toLowerCase();
      if (type === 'ignition_on' || type === 'stoppage' || type === 'parking' || 
          type === 'excessive_idle' || type === 'trip_started' || type === 'trip_ended') {
        prefKey = 'ignition';
      } else if (type === 'safety_park') {
        prefKey = 'theft';
      } else if (type === 'route_deviation') {
        prefKey = 'geofence';
      }
    }

    const result = await db.query(
      `SELECT t.fcm_token
       FROM user_fcm_tokens t
       JOIN users u ON t.user_id = u.id
       LEFT JOIN user_alert_preferences p ON p.user_id = u.id
       WHERE (u.org_id = $1 OR u.role = 'superadmin')
         AND (
           p.preferences IS NULL
           OR COALESCE((p.preferences->$2)::text, 'true') != 'false'
         )
         AND (
           u.role != 'customer'
           OR EXISTS (
             SELECT 1
             FROM user_groups ug
             JOIN vehicle_groups vg ON ug.group_id = vg.group_id
             WHERE ug.user_id = u.id AND vg.vehicle_id = $3
           )
         )`,
      [orgId, prefKey, vehicleId]
    );
    return result.rows.map(r => r.fcm_token);
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
          COUNT(DISTINCT CASE WHEN v.is_active = TRUE AND vls.last_seen >= NOW() - INTERVAL '3 minutes' THEN v.id END) AS online_vehicles,
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
          COUNT(DISTINCT CASE WHEN v.is_active = TRUE AND vls.last_seen >= NOW() - INTERVAL '3 minutes' THEN v.id END) AS online_vehicles,
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
    const availableInventory = 0; // Inventory not tracked in DB — honest zero rather than fabricated constant


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

  async clearAlertsForOrg(orgId) {
    let query, params;
    if (orgId) {
      query = `DELETE FROM alerts USING vehicles WHERE alerts.vehicle_id = vehicles.id AND vehicles.org_id = $1`;
      params = [orgId];
    } else {
      query = `DELETE FROM alerts`;
      params = [];
    }
    const result = await db.query(query, params);
    if (orgId) await redis.del(`org:alerts:${orgId}`).catch(() => {});
    return result.rowCount;
  },

  async clearAlertsForVehicle(vehicleId, orgId) {
    let query, params;
    if (orgId) {
      query = `DELETE FROM alerts USING vehicles WHERE alerts.vehicle_id = vehicles.id AND alerts.vehicle_id = $1 AND vehicles.org_id = $2`;
      params = [vehicleId, orgId];
    } else {
      query = `DELETE FROM alerts WHERE vehicle_id = $1 RETURNING (SELECT org_id FROM vehicles WHERE id = $1) as v_org`;
      params = [vehicleId];
    }
    const result = await db.query(query, params);
    const targetOrgId = orgId || (result.rows.length > 0 ? result.rows[0].v_org : null);
    if (targetOrgId) await redis.del(`org:alerts:${targetOrgId}`).catch(() => {});
    return result.rowCount;
  },

  async deleteAlert(alertId, orgId) {
    let query, params;
    if (orgId) {
      query = `DELETE FROM alerts USING vehicles WHERE alerts.vehicle_id = vehicles.id AND alerts.id = $1 AND vehicles.org_id = $2`;
      params = [alertId, orgId];
    } else {
      query = `DELETE FROM alerts WHERE id = $1 RETURNING (SELECT org_id FROM vehicles WHERE id = vehicle_id) as v_org`;
      params = [alertId];
    }
    const result = await db.query(query, params);
    const targetOrgId = orgId || (result.rows.length > 0 ? result.rows[0].v_org : null);
    if (targetOrgId) await redis.del(`org:alerts:${targetOrgId}`).catch(() => {});
    return result.rowCount > 0;
  },
};

module.exports = GpsModel;
