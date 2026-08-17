const db = require('../../../config/db');

class TripRepository {
  /** Create a planned trip */
  async create({ vehicleId, routeId, createdBy, name, origin, destination, notes }) {
    const res = await db.query(
      `INSERT INTO trips (vehicle_id, route_id, created_by, name, origin, destination, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'planned')
       RETURNING *`,
      [vehicleId, routeId || null, createdBy, name, origin || null, destination || null, notes || null]
    );
    return res.rows[0];
  }

  /** Start a planned trip — set in_progress, record start GPS */
  async start(tripId, { lat, lng }) {
    const res = await db.query(
      `UPDATE trips
       SET status='in_progress', start_time=NOW(), start_lat=$2, start_lng=$3
       WHERE id=$1 AND status='planned'
       RETURNING *`,
      [tripId, lat || null, lng || null]
    );
    return res.rows[0] || null;
  }

  /** Finalize a trip — set completed, record end GPS + accumulated stats */
  async end(tripId, { lat, lng, distanceKm, maxSpeed, avgSpeed, durationSecs, pointCount }) {
    const res = await db.query(
      `UPDATE trips
       SET status='completed',
           end_time=NOW(),
           end_lat=$2,
           end_lng=$3,
           distance_km=$4,
           max_speed=$5,
           avg_speed=$6,
           duration_secs=$7,
           point_count=$8
       WHERE id=$1 AND status='in_progress'
       RETURNING *`,
      [tripId, lat || null, lng || null,
        parseFloat(distanceKm || 0).toFixed(3),
        Math.round(maxSpeed || 0),
        parseFloat(avgSpeed || 0).toFixed(1),
        Math.round(durationSecs || 0),
        Math.round(pointCount || 0)]
    );
    return res.rows[0] || null;
  }

  /** Flush live stats mid-trip (called every 5 min for crash safety) */
  async flushStats(tripId, { distanceKm, maxSpeed }) {
    await db.query(
      `UPDATE trips SET distance_km=$2, max_speed=$3 WHERE id=$1 AND status='in_progress'`,
      [tripId, parseFloat(distanceKm || 0).toFixed(3), Math.round(maxSpeed || 0)]
    );
  }

  /** Cancel a trip */
  async cancel(tripId) {
    const res = await db.query(
      `UPDATE trips SET status='cancelled' WHERE id=$1 AND status IN ('planned','in_progress') RETURNING *`,
      [tripId]
    );
    return res.rows[0] || null;
  }

  /** Find a trip by ID */
  async findById(tripId) {
    const res = await db.query(
      `SELECT t.*, v.name as vehicle_name, v.plate,
              r.name as route_name, o.name as org_name
       FROM trips t
       LEFT JOIN vehicles v ON t.vehicle_id = v.id
       LEFT JOIN routes r ON t.route_id = r.id
       LEFT JOIN organizations o ON v.org_id = o.id
       WHERE t.id = $1`,
      [tripId]
    );
    return res.rows[0] || null;
  }

  /** Find active in-progress trip for a vehicle */
  async findActiveForVehicle(vehicleId) {
    const res = await db.query(
      `SELECT * FROM trips WHERE vehicle_id=$1 AND status='in_progress' LIMIT 1`,
      [vehicleId]
    );
    return res.rows[0] || null;
  }

  /** List trips for a vehicle/org with optional filters */
  async list({ vehicleId, orgId, status, startDate, endDate, limit = 100, offset = 0 }) {
    let where = [];
    const params = [];
    let pi = 1;

    if (vehicleId) { where.push(`t.vehicle_id=$${pi++}`); params.push(vehicleId); }
    if (orgId) { where.push(`v.org_id=$${pi++}`); params.push(orgId); }
    if (status) { where.push(`t.status=$${pi++}`); params.push(status); }

    if (startDate && endDate) {
      where.push(`COALESCE(t.start_time, t.created_at) BETWEEN $${pi++} AND $${pi++}`);
      params.push(startDate, endDate);
    }

    const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';
    params.push(limit, offset);

    const res = await db.query(
      `SELECT t.*, v.name as vehicle_name, v.plate,
              r.name as route_name
       FROM trips t
       LEFT JOIN vehicles v ON t.vehicle_id = v.id
       LEFT JOIN routes r ON t.route_id = r.id
       ${whereStr}
       ORDER BY t.created_at DESC
       LIMIT $${pi++} OFFSET $${pi}`,
      params
    );
    return res.rows;
  }

  /** List all in-progress trips (for periodic flush job) */
  async listInProgress() {
    const res = await db.query(
      `SELECT id, vehicle_id FROM trips WHERE status='in_progress'`
    );
    return res.rows;
  }
}

module.exports = new TripRepository();
