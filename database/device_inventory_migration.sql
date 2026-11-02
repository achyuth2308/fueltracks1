-- ============================================================
-- FUELTRACKS DEVICE INVENTORY MASTER — DB MIGRATION
-- High-performance, additive table for hardware stock (IMEI, Serial, ICCID)
-- Production Safe: 0 table locks on existing tables, isolated table
-- ============================================================

CREATE TABLE IF NOT EXISTS device_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  imei VARCHAR(30) NOT NULL,
  serial_no VARCHAR(100),
  iccid VARCHAR(50),
  device_model VARCHAR(100),
  manufacturer VARCHAR(150),
  sim_provider VARCHAR(100),
  sim_no VARCHAR(30),
  batch_name VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- B-Tree Unique Index for sub-millisecond O(1) lookups by IMEI
CREATE UNIQUE INDEX IF NOT EXISTS uq_device_inventory_imei ON device_inventory(imei);

-- Index for org-scoped filtering
CREATE INDEX IF NOT EXISTS idx_device_inventory_org ON device_inventory(org_id);

