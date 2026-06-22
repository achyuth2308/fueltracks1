-- ============================================================
-- GEOFENCES & ROUTES MIGRATION
-- ============================================================

CREATE TABLE IF NOT EXISTS geofences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) DEFAULT 'polygon' CHECK (type IN ('circle', 'polygon')),
  coordinates JSONB NOT NULL, -- e.g. [{"lat": 12.3, "lng": 77.1}, ...]
  radius DECIMAL, -- for circle type, in meters
  center_lat DECIMAL, -- for circle type
  center_lng DECIMAL, -- for circle type
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  coordinates JSONB NOT NULL, -- list of lat/lng [{"lat": 12.3, "lng": 77.1}, ...] representing path
  tolerance INTEGER DEFAULT 100, -- tolerance in meters
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicle_geofences (
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  geofence_id UUID NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (vehicle_id, geofence_id)
);

CREATE TABLE IF NOT EXISTS vehicle_routes (
  vehicle_id UUID UNIQUE NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (vehicle_id, route_id)
);

-- Triggers for auto updated_at
DROP TRIGGER IF EXISTS update_geofences_updated_at ON geofences;
CREATE TRIGGER update_geofences_updated_at BEFORE UPDATE ON geofences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_routes_updated_at ON routes;
CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON routes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
