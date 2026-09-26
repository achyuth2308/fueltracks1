-- ============================================================
-- PERFORMANCE INDEXES MIGRATION
-- Fixes thundering-herd DB overload after deployment restarts
-- and speeds up all gps_points range queries and raw_packets inserts.
-- All indexes are CONCURRENT so they don't lock the table.
-- ============================================================

-- 1. Composite covering index for today's distance query:
--    SELECT lat,lng,speed,ignition FROM gps_points
--    WHERE vehicle_id=$1 AND device_time >= today AND device_time <= now
--    ORDER BY device_time ASC
--    Previously falling back to the unique constraint (no covering columns).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gps_vehicle_time_covering
  ON gps_points (vehicle_id, device_time ASC)
  INCLUDE (lat, lng, speed, ignition);

-- 2. Partial index for live points (most frequent query pattern)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gps_vehicle_time_live
  ON gps_points (vehicle_id, device_time DESC)
  WHERE is_live = true;

-- 3. Covering index for vehicle_latest_state lookups (dashboard reads all columns)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vls_vehicle_id_covering
  ON vehicle_latest_state (vehicle_id)
  INCLUDE (lat, lng, speed, ignition, today_distance, is_online, last_seen);

-- 4. raw_packets — received_at for archival/cleanup queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_packets_received_at_brin
  ON raw_packets USING brin (received_at);

-- 5. Alerts index for org + unread query
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_org_unread
  ON alerts (vehicle_id)
  WHERE is_read IS NOT TRUE;

-- 6. VACUUM ANALYZE the hot tables to update planner statistics
ANALYZE gps_points;
ANALYZE vehicle_latest_state;
ANALYZE raw_packets;
ANALYZE vehicles;
