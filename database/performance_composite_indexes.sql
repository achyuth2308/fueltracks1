-- ============================================================
-- PERFORMANCE COMPOSITE INDEXES
-- Resolves slow query bottlenecks on gps_points and raw_packets.
-- Uses CONCURRENTLY so table writes and live telemetry are NOT blocked.
-- ============================================================

-- 1. Accelerates chronological distance calculations (GpsModel.getTodayDistanceFromHistory)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gps_points_veh_time_asc 
ON gps_points (vehicle_id, device_time ASC);

-- 2. Accelerates live tracking and reverse history lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gps_points_veh_time_all 
ON gps_points (vehicle_id, device_time DESC);

-- 3. Accelerates raw packet inspection for Device Data & Sensor Logs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_packets_imei_time 
ON raw_packets (imei, received_at DESC);

