const db = require('../config/db');

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
    const result = await db.query(
      `SELECT r.* FROM routes r
       JOIN vehicle_routes vr ON r.id = vr.route_id
       WHERE vr.vehicle_id = $1 AND r.is_active = TRUE`,
      [vehicleId]
    );
    return result.rows[0] || null;
  }
};

module.exports = RouteModel;
