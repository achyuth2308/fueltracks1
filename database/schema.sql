-- ============================================================
-- FUELTRACKS DATABASE SCHEMA
-- PostgreSQL 15+
-- ============================================================

-- Enable UUID generation
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ORGANIZATIONS (multi-tenant hierarchy)
-- super → dealer → customer
-- ============================================================
CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  type        VARCHAR(20) NOT NULL CHECK (type IN ('super','dealer','customer')),
  parent_id   UUID REFERENCES organizations(id) ON DELETE SET NULL,
  address     TEXT,
  phone       VARCHAR(20),
  contact_person VARCHAR(100),
  email       VARCHAR(100),
  is_active   BOOLEAN DEFAULT TRUE,
  device_limits JSONB DEFAULT '{"Starter": 0, "Basic": 0, "Advanced": 0, "Premium": 0}'::jsonb,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email       VARCHAR(100) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,  -- bcrypt hashed
  role        VARCHAR(20) NOT NULL CHECK (role IN ('superadmin','dealer','customer')),
  name        VARCHAR(100),
  phone       VARCHAR(20),
  is_active   BOOLEAN DEFAULT TRUE,
  last_login  TIMESTAMP,
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMP,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- GROUPS (sub-org units created by dealers)
-- Dealers create groups, assign vehicles + users to them
-- A vehicle can belong to multiple groups (many-to-many)
-- ============================================================
CREATE TABLE groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- VEHICLES
-- IMEI is the unique device identifier from BSTPL-17 packets
-- ============================================================
CREATE TABLE vehicles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  imei        VARCHAR(20) UNIQUE NOT NULL,  -- Device IMEI from packets
  name        VARCHAR(100),                 -- Friendly name e.g. "Truck #42"
  plate       VARCHAR(20),                  -- License plate
  model       VARCHAR(100),                 -- Vehicle model
  driver_name VARCHAR(100),
  driver_phone VARCHAR(20),
  server_name VARCHAR(100),
  gps_sim_no  VARCHAR(20),
  device_version VARCHAR(50),
  timezone    VARCHAR(50),
  apn         VARCHAR(100),
  licence_issued_date DATE,
  licence_expire_date DATE,
  is_active   BOOLEAN DEFAULT TRUE,
  metadata    JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- VEHICLE ↔ GROUP (many-to-many)
-- ============================================================
CREATE TABLE vehicle_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(vehicle_id, group_id)
);

-- ============================================================
-- USER ↔ GROUP (many-to-many)
-- Users assigned to groups see only those group's vehicles
-- ============================================================
CREATE TABLE user_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, group_id)
);

-- ============================================================
-- GPS HISTORY (high write volume)
-- Every location packet from every device goes here
-- ============================================================
CREATE TABLE gps_points (
  id          BIGSERIAL PRIMARY KEY,
  vehicle_id  UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  lat         DECIMAL(10,7) NOT NULL,
  lng         DECIMAL(10,7) NOT NULL,
  speed       SMALLINT,
  direction   SMALLINT,
  odometer    INTEGER,
  fuel        DECIMAL(6,2),
  ignition    BOOLEAN,
  satellites  SMALLINT,
  gsm_signal  SMALLINT,
  battery     SMALLINT,
  voltage     DECIMAL(5,2),
  is_live     BOOLEAN DEFAULT TRUE,   -- L=live, H=buffered history
  is_valid    BOOLEAN DEFAULT TRUE,
  device_time TIMESTAMP NOT NULL,
  server_time TIMESTAMP DEFAULT NOW(),
  UNIQUE(vehicle_id, device_time)     -- prevent duplicate packets
);

-- ============================================================
-- ALERTS (ignition, battery, box open/close, etc.)
-- ============================================================
CREATE TABLE alerts (
  id          BIGSERIAL PRIMARY KEY,
  vehicle_id  UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  alert_type  VARCHAR(50) NOT NULL,
  alert_text  TEXT,
  lat         DECIMAL(10,7),
  lng         DECIMAL(10,7),
  device_time TIMESTAMP NOT NULL,
  server_time TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- VEHICLE LATEST STATE (denormalized for dashboard speed)
-- One row per vehicle, updated on every packet
-- ============================================================
CREATE TABLE vehicle_latest_state (
  vehicle_id  UUID PRIMARY KEY REFERENCES vehicles(id) ON DELETE CASCADE,
  lat         DECIMAL(10,7),
  lng         DECIMAL(10,7),
  speed       SMALLINT,
  direction   SMALLINT,
  fuel        DECIMAL(6,2),
  ignition    BOOLEAN,
  voltage     DECIMAL(5,2),
  odometer    INTEGER,
  satellites  SMALLINT,
  gsm_signal  SMALLINT,
  is_online   BOOLEAN DEFAULT FALSE,
  last_seen   TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- RAW PACKETS (debugging - stores raw TCP data)
-- ============================================================
CREATE TABLE raw_packets (
  id          BIGSERIAL PRIMARY KEY,
  imei        VARCHAR(20),
  raw         TEXT,
  parsed      BOOLEAN DEFAULT FALSE,
  error       TEXT,
  received_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- DEVICES
-- ============================================================
CREATE TABLE devices (
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

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE audit_logs (
  id                  BIGSERIAL PRIMARY KEY,
  audit_type          VARCHAR(30)  NOT NULL,    -- 'organization'|'user'|'group'|'vehicle'|'device'|'license'|'login'|'system'
  entity_type         VARCHAR(50)  NOT NULL,    -- 'Organization'|'User'|'Group'|'Vehicle'|'Device'
  entity_id           VARCHAR(100),             -- UUID or string ID of the entity
  entity_name         VARCHAR(200),             -- Human-readable name at time of event
  action              VARCHAR(100) NOT NULL,    -- 'CREATED'|'UPDATED'|'DELETED'|'LOGIN_SUCCESS'|'LOGIN_FAILED'|'LOGOUT'|'REGISTERED'|'ASSIGNED'|'REMOVED'
  old_data            JSONB,                    -- State before change (null for creates)
  new_data            JSONB,                    -- State after change (null for deletes)
  performed_by_id     UUID,                     -- users.id of actor
  performed_by_name   VARCHAR(100),             -- name at time of event
  performed_by_email  VARCHAR(100),             -- email at time of event
  performed_by_role   VARCHAR(30),              -- role at time of event
  org_id              UUID,                     -- organization context
  org_name            VARCHAR(100),
  group_id            UUID,
  group_name          VARCHAR(100),
  vehicle_id          UUID,
  vehicle_name        VARCHAR(100),
  device_id           VARCHAR(50),
  ip_address          VARCHAR(45),
  user_agent          TEXT,
  created_at          TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- ORGANIZATION PROFILES
-- ============================================================
CREATE TABLE organization_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
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
  logo_url VARCHAR(255),
  favicon_url VARCHAR(255),
  login_background_url VARCHAR(255),
  map_provider VARCHAR(50) DEFAULT 'OpenStreetMap',
  encrypted_api_key TEXT,
  default_latitude DECIMAL(10,7),
  default_longitude DECIMAL(10,7),
  default_zoom SMALLINT DEFAULT 12,
  sms_enabled BOOLEAN DEFAULT FALSE,
  email_enabled BOOLEAN DEFAULT FALSE,
  whatsapp_enabled BOOLEAN DEFAULT FALSE,
  push_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- INDEXES (critical for query performance)
-- ============================================================
CREATE INDEX idx_gps_vehicle_time ON gps_points(vehicle_id, device_time DESC);
CREATE INDEX idx_gps_device_time ON gps_points(device_time DESC);
CREATE INDEX idx_alerts_vehicle_time ON alerts(vehicle_id, device_time DESC);
CREATE INDEX idx_vehicles_imei ON vehicles(imei);
CREATE INDEX idx_vehicles_org ON vehicles(org_id);
CREATE INDEX idx_users_org ON users(org_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_groups_org ON groups(org_id);
CREATE INDEX idx_vehicle_groups_vehicle ON vehicle_groups(vehicle_id);
CREATE INDEX idx_vehicle_groups_group ON vehicle_groups(group_id);
CREATE INDEX idx_user_groups_user ON user_groups(user_id);
CREATE INDEX idx_user_groups_group ON user_groups(group_id);
CREATE INDEX idx_raw_packets_imei ON raw_packets(imei);
CREATE INDEX idx_devices_org ON devices(org_id);
CREATE INDEX idx_devices_device_id ON devices(device_id);
CREATE INDEX idx_audit_logs_audit_type ON audit_logs(audit_type);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_org_id ON audit_logs(org_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_performed_by ON audit_logs(performed_by_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- ============================================================
-- UPDATED_AT TRIGGER (auto-update updated_at columns)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicle_latest_state_updated_at BEFORE UPDATE ON vehicle_latest_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_profiles_updated_at BEFORE UPDATE ON organization_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
