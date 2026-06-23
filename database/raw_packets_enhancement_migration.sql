-- Migration to enhance raw_packets table for the Sensor Data page
ALTER TABLE raw_packets ADD COLUMN IF NOT EXISTS packet_type VARCHAR(50);
ALTER TABLE raw_packets ADD COLUMN IF NOT EXISTS device_time TIMESTAMP;
ALTER TABLE raw_packets ADD COLUMN IF NOT EXISTS odometer INTEGER;
ALTER TABLE raw_packets ADD COLUMN IF NOT EXISTS raw_hex TEXT;
ALTER TABLE raw_packets ADD COLUMN IF NOT EXISTS parsed_data JSONB;

-- Add an index for faster queries on IMEI since this table will grow
CREATE INDEX IF NOT EXISTS idx_raw_packets_imei ON raw_packets(imei);
-- Add an index for auto-cleanup (timestamp)
CREATE INDEX IF NOT EXISTS idx_raw_packets_received_at ON raw_packets(received_at);
