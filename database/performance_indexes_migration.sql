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
ALTER TABLE vehicle_latest_state ADD COLUMN IF NOT EXISTS today_distance DECIMAL(8,2) DEFAULT 0;
ALTER TABLE vehicle_latest_state ADD COLUMN IF NOT EXISTS today_distance_date DATE;
ALTER TABLE vehicle_latest_state ADD COLUMN IF NOT EXISTS battery DECIMAL(5,2);
ALTER TABLE vehicle_latest_state ADD COLUMN IF NOT EXISTS today_start_odometer NUMERIC(10,2);

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  secret TEXT,
  label VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vls_vehicle_id_covering
  ON vehicle_latest_state (vehicle_id)
  INCLUDE (lat, lng, speed, ignition, today_distance, is_online, last_seen);

-- 4. BRIN index on raw_packets for archival/cleanup range scans
CREATE INDEX IF NOT EXISTS idx_raw_packets_received_at_brin
  ON raw_packets USING brin (received_at);

-- 5. Partial index on alerts for unread queries per vehicle
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_alerts_org_unread
  ON alerts (vehicle_id)
  WHERE is_read IS NOT TRUE;

-- 6. Refresh query planner statistics on hot tables
ANALYZE gps_points;
ANALYZE vehicle_latest_state;
ANALYZE raw_packets;
ANALYZE vehicles;
