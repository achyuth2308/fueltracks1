-- Add missing indexes for vehicles and organizations
CREATE INDEX IF NOT EXISTS idx_vehicles_org_id ON vehicles(org_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_imei ON vehicles(imei);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(is_active);
CREATE INDEX IF NOT EXISTS idx_organizations_id ON organizations(id);
ANALYZE vehicles;
ANALYZE organizations;

-- Note on raw_packets:
-- If raw_packets is not a hypertable and contains time-series data, it should be converted:
-- SELECT create_hypertable('raw_packets', 'device_time', if_not_exists => TRUE);
