const db = require('../config/db');
const { redis } = require('../config/redis');

const RouteModel = {
  async findAll(orgId) {
    const result = await db.query(
      `SELECT * FROM routes WHERE org_id = $1 ORDER BY name ASC`,
      [orgId]
    );
    return result.rows;
  },

  async findById(id) {
    const result = await db.query(
      `SELECT * FROM routes WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  async create({ orgId, name, coordinates, tolerance }) {
    const result = await db.query(
      `INSERT INTO routes (org_id, name, coordinates, tolerance)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [orgId, name, JSON.stringify(coordinates), tolerance || 100]
    );
    return result.rows[0];
  },

  async update(id, { name, coordinates, tolerance, is_active }) {
    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
    if (coordinates !== undefined) { fields.push(`coordinates = $${idx++}`); values.push(JSON.stringify(coordinates)); }
    if (tolerance !== undefined) { fields.push(`tolerance = $${idx++}`); values.push(tolerance); }
    if (is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(is_active); }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const result = await db.query(
      `UPDATE routes SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  },

  async delete(id) {
    const result = await db.query(
      `DELETE FROM routes WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rows[0] || null;
  },

  async assignToVehicles(routeId, vehicleIds) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM vehicle_routes WHERE route_id = $1', [routeId]);
      for (const vehicleId of vehicleIds) {
        await client.query(
          'INSERT INTO vehicle_routes (vehicle_id, route_id) VALUES ($1, $2) ON CONFLICT (vehicle_id) DO UPDATE SET route_id = EXCLUDED.route_id',
          [vehicleId, routeId]
        );
      }
      await client.query('COMMIT');

      // Invalidate route cache for every affected vehicle so the
      // location subscriber picks up the new assignment on the next packet.
      for (const vehicleId of vehicleIds) {
        try { await redis.del(`vehicle:route:${vehicleId}`); } catch (_) {}
      }
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async findVehiclesForRoute(routeId) {
    const result = await db.query(
      `SELECT v.id, v.name, v.plate FROM vehicles v
       JOIN vehicle_routes vr ON v.id = vr.vehicle_id
       WHERE vr.route_id = $1`,
      [routeId]
    );
    return result.rows;
  },

  async findRouteForVehicle(vehicleId) {
    // Cache route lookups per vehicle for 5 minutes.
    // Called on every live GPS packet for route deviation checks.
    // Invalidated immediately in assignToVehicles when the assignment changes.
    // TTL handles route edits/deactivations (up to 5 min stale — acceptable).
    const cacheKey = `vehicle:route:${vehicleId}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return cached === 'null' ? null : JSON.parse(cached);
    } catch (_) { /* cache read failed — fall through to DB */ }

    const result = await db.query(
      `SELECT r.* FROM routes r
       JOIN vehicle_routes vr ON r.id = vr.route_id
       WHERE vr.vehicle_id = $1 AND r.is_active = TRUE`,
      [vehicleId]
    );
    const route = result.rows[0] || null;

    try {
      // Cache null as the string 'null' so cache hits are distinguishable from cache misses
      await redis.set(cacheKey, route ? JSON.stringify(route) : 'null', 'EX', 300);
    } catch (_) { /* non-critical */ }

    return route;
  }
};

module.exports = RouteModel;
