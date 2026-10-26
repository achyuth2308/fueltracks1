const db = require('../config/db');
const { redis } = require('../config/redis');

const GeofenceModel = {
  async findAll(orgId) {
    const result = await db.query(
      `SELECT * FROM geofences WHERE org_id = $1 ORDER BY name ASC`,
      [orgId]
    );
    return result.rows;
  },

  async findAllWithStats(orgId) {
    const result = await db.query(
      `SELECT g.*, COUNT(vg.vehicle_id)::int AS assigned_vehicles_count
       FROM geofences g
       LEFT JOIN vehicle_geofences vg ON g.id = vg.geofence_id
       WHERE g.org_id = $1
       GROUP BY g.id
       ORDER BY g.name ASC`,
      [orgId]
    );
    return result.rows;
  },

  async findById(id) {
    const result = await db.query(
      `SELECT * FROM geofences WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  async create({ orgId, name, type, coordinates, radius, center_lat, center_lng, is_active = true, notification_time = '00:00', color = '#3B82F6', alert_on_enter = true, alert_on_exit = true }) {
    const coordsJson = typeof coordinates === 'string' ? coordinates : JSON.stringify(coordinates || []);
    try {
      const result = await db.query(
        `INSERT INTO geofences (org_id, name, type, coordinates, radius, center_lat, center_lng, is_active, notification_time, color, alert_on_enter, alert_on_exit)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [orgId, name, type || 'polygon', coordsJson, radius || null, center_lat || null, center_lng || null, is_active, notification_time, color || '#3B82F6', alert_on_enter !== false, alert_on_exit !== false]
      );
      return result.rows[0];
    } catch (err) {
      if (err.code === '42703') { // undefined column error
        const result = await db.query(
          `INSERT INTO geofences (org_id, name, type, coordinates, radius, center_lat, center_lng, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [orgId, name, type || 'polygon', coordsJson, radius || null, center_lat || null, center_lng || null, is_active]
        );
        return result.rows[0];
      }
      throw err;
    }
  },

  async update(id, { name, type, coordinates, radius, center_lat, center_lng, is_active, notification_time, color, alert_on_enter, alert_on_exit }) {
    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
    if (type !== undefined) { fields.push(`type = $${idx++}`); values.push(type); }
    if (coordinates !== undefined) { fields.push(`coordinates = $${idx++}`); values.push(JSON.stringify(coordinates)); }
    if (radius !== undefined) { fields.push(`radius = $${idx++}`); values.push(radius); }
    if (center_lat !== undefined) { fields.push(`center_lat = $${idx++}`); values.push(center_lat); }
    if (center_lng !== undefined) { fields.push(`center_lng = $${idx++}`); values.push(center_lng); }
    if (is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(is_active); }
    if (notification_time !== undefined) { fields.push(`notification_time = $${idx++}`); values.push(notification_time); }
    if (color !== undefined) { fields.push(`color = $${idx++}`); values.push(color); }
    if (alert_on_enter !== undefined) { fields.push(`alert_on_enter = $${idx++}`); values.push(alert_on_enter); }
    if (alert_on_exit !== undefined) { fields.push(`alert_on_exit = $${idx++}`); values.push(alert_on_exit); }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const result = await db.query(
      `UPDATE geofences SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    // Invalidate vehicle cache for assigned vehicles
    try {
      const vRows = await this.findVehiclesForGeofence(id);
      for (const v of vRows) {
        await redis.del(`vehicle:geofences:${v.id}`);
      }
    } catch (_) {}

    return result.rows[0] || null;
  },

  async findGeofencesByVehicleId(vehicleId, includeInactive = true) {
    const query = includeInactive
      ? `SELECT g.*, vg.assigned_at,
           (SELECT COUNT(*) FROM vehicle_geofences vg2 WHERE vg2.geofence_id = g.id)::int AS assigned_vehicles_count
         FROM geofences g
         JOIN vehicle_geofences vg ON g.id = vg.geofence_id
         WHERE vg.vehicle_id = $1 ORDER BY g.created_at DESC`
      : `SELECT g.*, vg.assigned_at,
           (SELECT COUNT(*) FROM vehicle_geofences vg2 WHERE vg2.geofence_id = g.id)::int AS assigned_vehicles_count
         FROM geofences g
         JOIN vehicle_geofences vg ON g.id = vg.geofence_id
         WHERE vg.vehicle_id = $1 AND g.is_active = TRUE ORDER BY g.created_at DESC`;
    const result = await db.query(query, [vehicleId]);
    return result.rows;
  },

  async updateSiteNotification(id, { is_active, notification_time }) {
    const fields = [];
    const values = [];
    let idx = 1;

    if (is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(is_active); }
    if (notification_time !== undefined) { fields.push(`notification_time = $${idx++}`); values.push(notification_time); }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const result = await db.query(
      `UPDATE geofences SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    // Invalidate vehicle cache for assigned vehicles
    try {
      const vRows = await this.findVehiclesForGeofence(id);
      for (const v of vRows) {
        await redis.del(`vehicle:geofences:${v.id}`);
      }
    } catch (_) {}

    return result.rows[0] || null;
  },

  async delete(id) {
    const result = await db.query(
      `DELETE FROM geofences WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rows[0] || null;
  },

  async assignToVehicles(geofenceId, vehicleIds) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM vehicle_geofences WHERE geofence_id = $1', [geofenceId]);

      const cleanVehicleIds = (Array.isArray(vehicleIds) ? vehicleIds : [vehicleIds])
        .map(v => typeof v === 'object' && v !== null ? (v.id || v.vehicle_id) : v)
        .filter(v => typeof v === 'string' && v.trim().length > 0);

      for (const vehicleId of cleanVehicleIds) {
        await client.query(
          'INSERT INTO vehicle_geofences (vehicle_id, geofence_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [vehicleId, geofenceId]
        );
      }
      await client.query('COMMIT');

      // Invalidate geofence list cache for every affected vehicle so the
      // location subscriber picks up the new assignment on the next packet.
      for (const vehicleId of cleanVehicleIds) {
        try { await redis.del(`vehicle:geofences:${vehicleId}`); } catch (_) {}
      }
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async linkVehicle(geofenceId, vehicleId) {
    await db.query(
      `INSERT INTO vehicle_geofences (vehicle_id, geofence_id)
       VALUES ($1, $2)
       ON CONFLICT (vehicle_id, geofence_id) DO NOTHING`,
      [vehicleId, geofenceId]
    );
    try {
      await redis.del(`vehicle:geofences:${vehicleId}`);
    } catch (_) {}
    return true;
  },

  async unlinkVehicle(geofenceId, vehicleId) {
    await db.query(
      `DELETE FROM vehicle_geofences WHERE vehicle_id = $1 AND geofence_id = $2`,
      [vehicleId, geofenceId]
    );
    try {
      await redis.del(`vehicle:geofences:${vehicleId}`);
    } catch (_) {}
    return true;
  },

  async findVehiclesForGeofence(geofenceId) {
    const result = await db.query(
      `SELECT v.id, v.name, v.plate FROM vehicles v
       JOIN vehicle_geofences vg ON v.id = vg.vehicle_id
       WHERE vg.geofence_id = $1`,
      [geofenceId]
    );
    return result.rows;
  },

  async findGeofencesForVehicle(vehicleId) {
    // Cache geofence lists per vehicle for 5 minutes.
    // Invalidated immediately in assignToVehicles when assignments change.
    // TTL handles geofence edits/deletes (up to 5 min stale — acceptable).
    const cacheKey = `vehicle:geofences:${vehicleId}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (_) { /* cache read failed — fall through to DB */ }

    const result = await db.query(
      `SELECT g.* FROM geofences g
       JOIN vehicle_geofences vg ON g.id = vg.geofence_id
       WHERE vg.vehicle_id = $1 AND g.is_active = TRUE`,
      [vehicleId]
    );

    try {
      await redis.set(cacheKey, JSON.stringify(result.rows), 'EX', 300); // 5-min TTL
    } catch (_) { /* non-critical */ }

    return result.rows;
  },

  async copyVehicleGeofences({ sourceVehicleId, targetVehicleId, replaceExisting = true }) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Fetch source geofence IDs
      const sourceRes = await client.query(
        `SELECT vg.geofence_id, g.name, g.type, g.is_active
         FROM vehicle_geofences vg
         JOIN geofences g ON g.id = vg.geofence_id
         WHERE vg.vehicle_id = $1`,
        [sourceVehicleId]
      );
      const sourceGeofences = sourceRes.rows;

      if (sourceGeofences.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, count: 0, error: 'The selected vehicle has no geofences configured.' };
      }

      if (replaceExisting) {
        await client.query(
          'DELETE FROM vehicle_geofences WHERE vehicle_id = $1',
          [targetVehicleId]
        );
      }

      for (const row of sourceGeofences) {
        await client.query(
          `INSERT INTO vehicle_geofences (vehicle_id, geofence_id)
           VALUES ($1, $2)
           ON CONFLICT (vehicle_id, geofence_id) DO NOTHING`,
          [targetVehicleId, row.geofence_id]
        );
      }

      await client.query('COMMIT');

      try {
        await redis.del(`vehicle:geofences:${targetVehicleId}`);
      } catch (_) {}

      return {
        success: true,
        count: sourceGeofences.length,
        geofences: sourceGeofences
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async copyVehicleGeofencesToMultiple({ sourceVehicleId, targetVehicleIds = [], replaceExisting = true }) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const sourceRes = await client.query(
        `SELECT vg.geofence_id, g.name, g.type, g.is_active
         FROM vehicle_geofences vg
         JOIN geofences g ON g.id = vg.geofence_id
         WHERE vg.vehicle_id = $1`,
        [sourceVehicleId]
      );
      const sourceGeofences = sourceRes.rows;

      if (sourceGeofences.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, count: 0, error: 'Source vehicle has no geofences configured.' };
      }

      for (const tId of targetVehicleIds) {
        if (replaceExisting) {
          await client.query(
            'DELETE FROM vehicle_geofences WHERE vehicle_id = $1',
            [tId]
          );
        }
        for (const row of sourceGeofences) {
          await client.query(
            `INSERT INTO vehicle_geofences (vehicle_id, geofence_id)
             VALUES ($1, $2)
             ON CONFLICT (vehicle_id, geofence_id) DO NOTHING`,
            [tId, row.geofence_id]
          );
        }
      }

      await client.query('COMMIT');

      for (const tId of targetVehicleIds) {
        try {
          await redis.del(`vehicle:geofences:${tId}`);
        } catch (_) {}
      }

      return {
        success: true,
        count: sourceGeofences.length,
        targetVehiclesCount: targetVehicleIds.length,
        geofences: sourceGeofences
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async getVehiclesWithGeofenceCounts(orgId, userId = null, role = null) {
    let query = `
      SELECT v.id, v.name, v.plate, v.imei, v.status,
             COUNT(vg.geofence_id)::int AS geofence_count
      FROM vehicles v
      LEFT JOIN vehicle_geofences vg ON v.id = vg.vehicle_id
    `;
    const params = [];

    if (role !== 'superadmin' && orgId) {
      params.push(orgId);
      query += ` WHERE v.org_id = $${params.length}`;
    }

    query += `
      GROUP BY v.id, v.name, v.plate, v.imei, v.status
      ORDER BY geofence_count DESC, v.name ASC
    `;

    const result = await db.query(query, params);
    return result.rows;
  }
};

module.exports = GeofenceModel;
