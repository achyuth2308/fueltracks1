-- ============================================================
-- FUELTRACKS DEVICES MODULE — DB MIGRATION
-- Creates devices table (does not touch existing tables if they exist)
-- ============================================================

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  device_id VARCHAR(50) UNIQUE NOT NULL,
  device_type VARCHAR(50),
  licence_id VARCHAR(50),
  vehicle_id VARCHAR(100),
  assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_devices_org ON devices(org_id);
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);

-- Trigger to auto-update updated_at column
DROP TRIGGER IF EXISTS update_devices_updated_at ON devices;

CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
