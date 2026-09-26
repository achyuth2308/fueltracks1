-- ============================================================
-- PERFORMANCE INDEXES MIGRATION
-- gps_points and raw_packets are TimescaleDB hypertables.
-- vehicle_latest_state and alerts are regular tables.
--
-- NOTE: CONCURRENTLY cannot be used inside a transaction block.
--       The migrate runner wraps in a transaction, so we use
--       plain CREATE INDEX ... IF NOT EXISTS for all indexes.
--       This is safe and idempotent on every deploy.
-- ============================================================

-- 1. Composite covering index for today's distance query
CREATE INDEX IF NOT EXISTS idx_gps_vehicle_time_covering
  ON gps_points (vehicle_id, device_time ASC)
  INCLUDE (lat, lng, speed, ignition);

-- 2. Partial index for live-only queries (most frequent pattern)
CREATE INDEX IF NOT EXISTS idx_gps_vehicle_time_live
  ON gps_points (vehicle_id, device_time DESC)
  WHERE is_live = true;

-- 3. Covering index for vehicle_latest_state dashboard reads
CREATE INDEX IF NOT EXISTS idx_vls_vehicle_id_covering
  ON vehicle_latest_state (vehicle_id)
  INCLUDE (lat, lng, speed, ignition, today_distance, is_online, last_seen);

-- 4. BRIN index on raw_packets for archival/cleanup range scans
CREATE INDEX IF NOT EXISTS idx_raw_packets_received_at_brin
  ON raw_packets USING brin (received_at);

-- 5. Partial index on alerts for unread queries per vehicle
CREATE INDEX IF NOT EXISTS idx_alerts_org_unread
  ON alerts (vehicle_id)
  WHERE is_read IS NOT TRUE;

-- 6. Refresh query planner statistics on hot tables
ANALYZE gps_points;
ANALYZE vehicle_latest_state;
ANALYZE raw_packets;
ANALYZE vehicles;
