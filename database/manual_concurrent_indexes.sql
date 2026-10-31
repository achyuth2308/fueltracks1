-- ============================================================
-- MANUAL CONCURRENT INDEXES FOR ZERO-DOWNTIME EXECUTION
-- DO NOT RUN VIA AUTOMATED MIGRATION RUNNER (cannot run inside transactions)
--
-- TIMESCALEDB HYPERTABLE NOTICE:
-- In TimescaleDB, 'gps_points' and 'raw_packets' are hypertables.
-- 1. Standard PostgreSQL 'CREATE INDEX CONCURRENTLY' on a hypertable parent
--    is supported in TimescaleDB 2.7+ without holding table write locks.
-- 2. If running on older TimescaleDB versions, indexes must be created either
--    chunk-by-chunk using 'create_index_on_chunks()' or with standard 'CREATE INDEX'.
-- 3. Run each statement individually in an autocommit psql session.
-- ============================================================

-- 1. Alerts Table (Standard PostgreSQL Table)
-- Safe zero-lock index for unread alerts:
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_org_unread_concurrent
  ON alerts (vehicle_id)
  WHERE is_read IS NOT TRUE;

-- 2. Vehicle Latest State Table (Standard PostgreSQL Table)
-- Safe zero-lock covering index for dashboard latest state:
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vls_vehicle_id_covering_concurrent
  ON vehicle_latest_state (vehicle_id)
  INCLUDE (lat, lng, speed, ignition, today_distance, is_online, last_seen);

-- 3. GPS Points (TimescaleDB Hypertable)
-- Note: Requires TimescaleDB >= 2.7 for parent concurrent index propagation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gps_vehicle_time_covering_concurrent
  ON gps_points (vehicle_id, device_time ASC)
  INCLUDE (lat, lng, speed, ignition);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gps_vehicle_time_live_concurrent
  ON gps_points (vehicle_id, device_time DESC)
  WHERE is_live = true;

