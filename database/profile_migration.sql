-- ============================================================
-- FUELTRACKS PROFILE MODULE — DB MIGRATION
-- Creates organization_profiles table
-- ============================================================

CREATE TABLE IF NOT EXISTS organization_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Contact details
  contact_person VARCHAR(100),
  email VARCHAR(100),
  mobile VARCHAR(20),
  alternate_mobile VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  pincode VARCHAR(20),
  gst_number VARCHAR(50),
  website VARCHAR(255),
  timezone VARCHAR(50) DEFAULT 'UTC',
  
  -- Branding (URLs)
  logo_url VARCHAR(255),
  favicon_url VARCHAR(255),
  login_background_url VARCHAR(255),
  
  -- Map Configuration
  map_provider VARCHAR(50) DEFAULT 'OpenStreetMap',
  encrypted_api_key TEXT,
  default_latitude DECIMAL(10,7),
  default_longitude DECIMAL(10,7),
  default_zoom SMALLINT DEFAULT 12,
  
  -- Notification Flags
  sms_enabled BOOLEAN DEFAULT FALSE,
  email_enabled BOOLEAN DEFAULT FALSE,
  whatsapp_enabled BOOLEAN DEFAULT FALSE,
  push_enabled BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Note: Postgres does not support IF NOT EXISTS for triggers easily, 
-- so we drop it first if it exists.
DROP TRIGGER IF EXISTS update_organization_profiles_updated_at ON organization_profiles;

CREATE TRIGGER update_organization_profiles_updated_at BEFORE UPDATE ON organization_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
