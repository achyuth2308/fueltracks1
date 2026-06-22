const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'fueltracks1',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('[SEED] Resolving simulated vehicle...');
    const vehicleRes = await client.query("SELECT id, org_id FROM vehicles WHERE imei = '865006049210220'");
    if (vehicleRes.rows.length === 0) {
      console.error('[SEED] ERROR: Simulated vehicle with IMEI 865006049210220 not found in database.');
      return;
    }
    const vehicleId = vehicleRes.rows[0].id;
    const orgId = vehicleRes.rows[0].org_id;
    console.log(`[SEED] Found Vehicle ID: ${vehicleId}, Org ID: ${orgId}`);

    // Update organization profile to enable email/WhatsApp notifications
    console.log('[SEED] Updating organization profile settings...');
    await client.query(`
      INSERT INTO organization_profiles (organization_id, email, mobile, email_enabled, whatsapp_enabled)
      VALUES ($1, 'test-alerts@fueltracks.com', '+1234567890', TRUE, TRUE)
      ON CONFLICT (organization_id) DO UPDATE SET
        email = 'test-alerts@fueltracks.com',
        mobile = '+1234567890',
        email_enabled = TRUE,
        whatsapp_enabled = TRUE
    `, [orgId]);

    // Create a geofence centered near starting location (radius 100m)
    console.log('[SEED] Creating circle geofence...');
    const geofenceRes = await client.query(`
      INSERT INTO geofences (org_id, name, type, coordinates, radius, center_lat, center_lng, is_active)
      VALUES ($1, 'Office HQ Boundary', 'circle', '[]'::jsonb, 100, 17.207174, 78.314323, TRUE)
      RETURNING id
    `, [orgId]);
    const geofenceId = geofenceRes.rows[0].id;

    // Assign geofence to vehicle
    console.log('[SEED] Assigning geofence to vehicle...');
    await client.query(`
      INSERT INTO vehicle_geofences (vehicle_id, geofence_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [vehicleId, geofenceId]);

    // Create a route starting near HQ (tolerance 50m)
    console.log('[SEED] Creating predefined route...');
    const routeCoordinates = [
      { lat: 17.207174, lng: 78.314323 },
      { lat: 17.208174, lng: 78.315323 },
      { lat: 17.209174, lng: 78.316323 }
    ];
    const routeRes = await client.query(`
      INSERT INTO routes (org_id, name, coordinates, tolerance, is_active)
      VALUES ($1, 'Delivery Route #1', $2, 50, TRUE)
      RETURNING id
    `, [orgId, JSON.stringify(routeCoordinates)]);
    const routeId = routeRes.rows[0].id;

    // Assign route to vehicle
    console.log('[SEED] Assigning route to vehicle...');
    await client.query(`
      INSERT INTO vehicle_routes (vehicle_id, route_id)
      VALUES ($1, $2)
      ON CONFLICT (vehicle_id) DO UPDATE SET route_id = EXCLUDED.route_id
    `, [vehicleId, routeId]);

    console.log('[SEED] ✓ Seeding geofence and route configuration completed successfully.');
  } catch (err) {
    console.error('[SEED] Seeding error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
