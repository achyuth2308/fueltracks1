-- ============================================================
-- MINING REGISTRATIONS MIGRATION
-- Multi-step vehicle/device registration persistence
-- ============================================================

CREATE TABLE IF NOT EXISTS mining_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  asm_tsl_phone VARCHAR(20) NOT NULL,
  device_model VARCHAR(100) NOT NULL,
  vehicle_number VARCHAR(50) NOT NULL,
  imei_number VARCHAR(20),
  engine_number VARCHAR(100) NOT NULL,
  chassis_number VARCHAR(100) NOT NULL,
  manufacturing_year INT NOT NULL,
  vehicle_manufacturer VARCHAR(100) NOT NULL,
  customer_name VARCHAR(150) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  fo_address TEXT NOT NULL,
  aadhar_number VARCHAR(20) NOT NULL,
  vehicle_number_photo_url TEXT NOT NULL,
  rc_copy_photo_url TEXT NOT NULL,
  aadhar_copy_photo_url TEXT NOT NULL,
  installer_name VARCHAR(150) NOT NULL,
  request_type VARCHAR(100) NOT NULL,
  submitted_by_email VARCHAR(150) NOT NULL,
  send_email_copy BOOLEAN DEFAULT TRUE,
  status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'IN_REVIEW')),
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient lookups and admin dashboard filters
CREATE INDEX IF NOT EXISTS idx_mining_reg_org_id ON mining_registrations(org_id);
CREATE INDEX IF NOT EXISTS idx_mining_reg_user_id ON mining_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_mining_reg_status ON mining_registrations(status);
CREATE INDEX IF NOT EXISTS idx_mining_reg_vehicle_number ON mining_registrations(vehicle_number);
CREATE INDEX IF NOT EXISTS idx_mining_reg_imei ON mining_registrations(imei_number);
CREATE INDEX IF NOT EXISTS idx_mining_reg_created_at ON mining_registrations(created_at DESC);
