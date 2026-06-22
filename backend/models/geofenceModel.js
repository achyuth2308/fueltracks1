const db = require('../config/db');

const GeofenceModel = {
  async findAll(orgId) {
    const result = await db.query(
      `SELECT * FROM geofences WHERE org_id = $1 ORDER BY name ASC`,
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

  async create({ orgId, name, type, coordinates, radius, center_lat, center_lng }) {
    const result = await db.query(
      `INSERT INTO geofences (org_id, name, type, coordinates, radius, center_lat, center_lng)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [orgId, name, type || 'polygon', JSON.stringify(coordinates), radius || null, center_lat || null, center_lng || null]
    );
    return result.rows[0];
  },

  async update(id, { name, type, coordinates, radius, center_lat, center_lng, is_active }) {
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

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const result = await db.query(
      `UPDATE geofences SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
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
      for (const vehicleId of vehicleIds) {
        await client.query(
          'INSERT INTO vehicle_geofences (vehicle_id, geofence_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [vehicleId, geofenceId]
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
    const result = await db.query(
      `SELECT g.* FROM geofences g
       JOIN vehicle_geofences vg ON g.id = vg.geofence_id
       WHERE vg.vehicle_id = $1 AND g.is_active = TRUE`,
      [vehicleId]
    );
    return result.rows;
  }
};

module.exports = GeofenceModel;
