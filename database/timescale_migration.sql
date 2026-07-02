-- ============================================================
-- TIMESCALEDB MIGRATION — FuelTracks
-- Run ONCE on the production Postgres instance.
-- Safe to re-run (all statements use IF NOT EXISTS).
--
-- Prerequisites:
--   sudo apt install timescaledb-2-postgresql-15
--   Add 'shared_preload_libraries = timescaledb' to postgresql.conf
--   Restart Postgres BEFORE running this file.
--
-- Apply with:
--   sudo -u postgres psql -d fueltracks -f database/timescale_migration.sql
-- ============================================================

-- 1. Enable the extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- 2. Convert gps_points to a hypertable (7-day chunks)
--    migrate_data=TRUE handles existing rows, but the table must NOT
--    have any foreign key referencing it yet. If it does, you may need
--    to temporarily drop and re-add FKs.
SELECT create_hypertable(
  'gps_points',
  'device_time',
  if_not_exists     => TRUE,
  migrate_data      => TRUE,
  chunk_time_interval => INTERVAL '7 days'
);

-- 3. Enable columnar compression (saves ~70-80% disk vs raw rows)
ALTER TABLE gps_points SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'vehicle_id',
  timescaledb.compress_orderby   = 'device_time DESC'
);

-- 4. Compression policy: compress chunks older than 14 days automatically
SELECT add_compression_policy(
  'gps_points',
  INTERVAL '14 days',
  if_not_exists => TRUE
);

-- 5. Retention policy: drop chunks older than 180 days
SELECT add_retention_policy(
  'gps_points',
  INTERVAL '180 days',
  if_not_exists => TRUE
);

-- 6. Continuous aggregate: hourly rollup (used by trip/speed dashboard queries)
CREATE MATERIALIZED VIEW IF NOT EXISTS gps_points_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', device_time) AS bucket,
  vehicle_id,
  AVG(speed)::SMALLINT                            AS avg_speed,
  MAX(speed)                                       AS max_speed,
  (MAX(odometer) - MIN(odometer))                  AS distance_m,
  COUNT(*)                                         AS point_count,
  BOOL_OR(ignition)                                AS had_ignition_on
FROM gps_points
GROUP BY bucket, vehicle_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
  'gps_points_hourly',
  start_offset      => INTERVAL '3 hours',
  end_offset        => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists     => TRUE
);

-- 7. Continuous aggregate: daily rollup (used by 7-day / 30-day trend charts)
CREATE MATERIALIZED VIEW IF NOT EXISTS gps_points_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', device_time) AS bucket,
  vehicle_id,
  AVG(speed)::SMALLINT                                              AS avg_speed,
  MAX(speed)                                                         AS max_speed,
  (MAX(odometer) - MIN(odometer))                                    AS distance_m,
  COUNT(*)                                                           AS point_count,
  SUM(CASE WHEN ignition = TRUE THEN 1 ELSE 0 END)::INTEGER          AS ignition_on_count
FROM gps_points
GROUP BY bucket, vehicle_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
  'gps_points_daily',
  start_offset      => INTERVAL '3 days',
  end_offset        => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 day',
  if_not_exists     => TRUE
);

-- 8. Performance indexes missing from original schema.sql
--    These cover the offline checker cron and common fleet queries.
CREATE INDEX IF NOT EXISTS idx_vls_last_seen
  ON vehicle_latest_state(last_seen);

CREATE INDEX IF NOT EXISTS idx_vls_is_online
  ON vehicle_latest_state(is_online)
  WHERE is_online = TRUE;   -- partial index — only true rows need fast lookup

CREATE INDEX IF NOT EXISTS idx_audit_logs_composite
  ON audit_logs(org_id, created_at DESC);  -- covers the getStats WHERE + ORDER BY in one scan

-- ============================================================
-- Verify the setup
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '=== TimescaleDB migration complete ===';
  RAISE NOTICE 'Hypertable: gps_points';
  RAISE NOTICE 'Compression policy: 14 days';
  RAISE NOTICE 'Retention policy: 180 days';
  RAISE NOTICE 'Continuous aggregates: gps_points_hourly, gps_points_daily';
  RAISE NOTICE '======================================';
END;
$$;
