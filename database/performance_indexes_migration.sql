-- ============================================================
-- PERFORMANCE INDEXES MIGRATION
-- Fixes thundering-herd DB overload after deployment restarts.
-- NOTE: gps_points and raw_packets are TimescaleDB hypertables —
--       CONCURRENTLY is NOT supported on hypertables.
--       Regular tables (vehicle_latest_state, alerts) use CONCURRENTLY.
-- All indexes use IF NOT EXISTS so they are safe to re-run.
-- ============================================================

-- 1. Composite covering index for today's distance query:
--    SELECT lat,lng,speed,ignition FROM gps_points
--    WHERE vehicle_id=$1 AND device_time >= today AND device_time <= now
--    TimescaleDB hypertable: CONCURRENTLY not allowed
CREATE INDEX IF NOT EXISTS idx_gps_vehicle_time_covering
  ON gps_points (vehicle_id, device_time ASC)
  INCLUDE (lat, lng, speed, ignition);

-- 2. Partial index for live points (most frequent query pattern)
--    TimescaleDB hypertable: CONCURRENTLY not allowed
CREATE INDEX IF NOT EXISTS idx_gps_vehicle_time_live
  ON gps_points (vehicle_id, device_time DESC)
  WHERE is_live = true;

-- 3. Covering index for vehicle_latest_state (regular table, CONCURRENTLY safe)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vls_vehicle_id_covering
  ON vehicle_latest_state (vehicle_id)
  INCLUDE (lat, lng, speed, ignition, today_distance, is_online, last_seen);

-- 4. raw_packets BRIN index — TimescaleDB hypertable: CONCURRENTLY not allowed
CREATE INDEX IF NOT EXISTS idx_raw_packets_received_at_brin
  ON raw_packets USING brin (received_at);

-- 5. Alerts unread index (regular table, CONCURRENTLY safe)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_org_unread
  ON alerts (vehicle_id)
  WHERE is_read IS NOT TRUE;

-- 6. ANALYZE hot tables to refresh query planner statistics
ANALYZE gps_points;
ANALYZE vehicle_latest_state;
ANALYZE raw_packets;
ANALYZE vehicles;
