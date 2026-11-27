-- ============================================================
-- OBD Telemetry Migration: RPM, Coolant Temp, Throttle, OBD Data
-- ============================================================

-- Add OBD columns to vehicle_latest_state for real-time display and REST API
ALTER TABLE vehicle_latest_state ADD COLUMN IF NOT EXISTS rpm INTEGER;
ALTER TABLE vehicle_latest_state ADD COLUMN IF NOT EXISTS coolant_temp SMALLINT;
ALTER TABLE vehicle_latest_state ADD COLUMN IF NOT EXISTS throttle SMALLINT;
ALTER TABLE vehicle_latest_state ADD COLUMN IF NOT EXISTS obd_data JSONB DEFAULT '{}'::jsonb;

-- Add OBD columns to gps_points for trip history and diagnostics
ALTER TABLE gps_points ADD COLUMN IF NOT EXISTS rpm INTEGER;
ALTER TABLE gps_points ADD COLUMN IF NOT EXISTS coolant_temp SMALLINT;
ALTER TABLE gps_points ADD COLUMN IF NOT EXISTS throttle SMALLINT;
ALTER TABLE gps_points ADD COLUMN IF NOT EXISTS obd_data JSONB;
