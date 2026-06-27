-- ============================================================
-- raw_packets table maintenance migration
-- Keeps the table from growing unbounded and speeds up COUNT queries
-- ============================================================

-- 1. Ensure indexes are present (idempotent)
CREATE INDEX IF NOT EXISTS idx_raw_packets_imei        ON raw_packets(imei);
CREATE INDEX IF NOT EXISTS idx_raw_packets_received_at ON raw_packets(received_at);

-- 2. Composite index for (imei, received_at DESC) — speeds up paginated sensor logs
CREATE INDEX IF NOT EXISTS idx_raw_packets_imei_time
  ON raw_packets(imei, received_at DESC);

-- 3. Delete old raw packets older than 7 days to keep the table lean
DELETE FROM raw_packets
WHERE received_at < NOW() - INTERVAL '7 days';

-- 4. VACUUM to reclaim space and update the planner's statistics
VACUUM ANALYZE raw_packets;
