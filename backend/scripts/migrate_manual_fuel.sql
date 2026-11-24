-- Migration: Manual Fuel Monitoring & Mileage Prediction System
-- Enables fuel tracking based on GPS distance travelled without hardware fuel sensors

-- 1. Vehicle Fuel Configuration
CREATE TABLE IF NOT EXISTS vehicle_fuel_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    fuel_type VARCHAR(20) NOT NULL DEFAULT 'Diesel', -- Diesel, Petrol, CNG
    tank_capacity NUMERIC(8,2) NOT NULL, -- Litres
    initial_fuel NUMERIC(8,2) NOT NULL DEFAULT 0, -- Litres
    initial_odometer NUMERIC(10,2) NOT NULL DEFAULT 0, -- KM
    initial_mileage NUMERIC(6,2) NOT NULL DEFAULT 8.0, -- KM/L
    reserve_fuel_level NUMERIC(8,2) DEFAULT 10.0, -- Litres
    low_fuel_alert_threshold NUMERIC(8,2) DEFAULT 15.0, -- Litres
    critical_fuel_alert_threshold NUMERIC(8,2) DEFAULT 8.0, -- Litres
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_vehicle_fuel_config UNIQUE (vehicle_id)
);

CREATE INDEX IF NOT EXISTS idx_vfc_vehicle_id ON vehicle_fuel_configs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vfc_org_id ON vehicle_fuel_configs(org_id);

-- 2. Current Fuel State (Fast lookup for live telemetry, range, and status)
CREATE TABLE IF NOT EXISTS vehicle_fuel_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    current_fuel NUMERIC(8,2) NOT NULL, -- Estimated remaining fuel in Litres
    current_mileage NUMERIC(6,2) NOT NULL DEFAULT 8.0, -- Learned or initial KM/L
    total_distance_travelled NUMERIC(12,2) NOT NULL DEFAULT 0, -- Total KM since monitoring began
    total_fuel_consumed NUMERIC(10,2) NOT NULL DEFAULT 0, -- Total Litres consumed
    total_fuel_refilled NUMERIC(10,2) NOT NULL DEFAULT 0, -- Total Litres refilled
    estimated_range_km NUMERIC(10,2) NOT NULL DEFAULT 0, -- current_fuel * current_mileage
    last_known_odometer NUMERIC(12,2) DEFAULT 0, -- Reference odometer for incremental deductions
    last_refill_date TIMESTAMPTZ,
    last_entry_date TIMESTAMPTZ,
    fuel_status VARCHAR(30) DEFAULT 'Normal', -- Healthy, Normal, Low Fuel, Critical Fuel, No Fuel Data
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_vehicle_fuel_state UNIQUE (vehicle_id)
);

CREATE INDEX IF NOT EXISTS idx_vfs_vehicle_id ON vehicle_fuel_states(vehicle_id);

-- 3. Driver Manual Fuel Entries
CREATE TABLE IF NOT EXISTS manual_fuel_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
    driver_name VARCHAR(100),
    entry_type VARCHAR(40) NOT NULL, -- INITIAL, REFILL, RECONCILIATION
    fuel_quantity NUMERIC(8,2) NOT NULL, -- Fuel available or current level (L)
    fuel_filled NUMERIC(8,2) DEFAULT 0, -- Fuel refilled if applicable (L)
    odometer NUMERIC(10,2) NOT NULL, -- KM at time of entry
    estimated_fuel_before NUMERIC(8,2), -- System estimate before this entry (L)
    fuel_difference NUMERIC(8,2), -- Discrepancy between system estimate & actual (L)
    receipt_url TEXT,
    remarks TEXT,
    entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfe_vehicle_id ON manual_fuel_entries(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_mfe_entry_time ON manual_fuel_entries(entry_time DESC);

-- 4. Fuel Consumption & Distance Deductions Audit Log
CREATE TABLE IF NOT EXISTS fuel_consumption_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    distance_km NUMERIC(8,3) NOT NULL, -- Distance covered in this segment
    mileage_applied NUMERIC(6,2) NOT NULL, -- KM/L used
    fuel_consumed NUMERIC(8,3) NOT NULL, -- distance_km / mileage_applied
    fuel_before NUMERIC(8,2) NOT NULL,
    fuel_after NUMERIC(8,2) NOT NULL,
    start_odometer NUMERIC(12,2),
    end_odometer NUMERIC(12,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fcl_vehicle_id ON fuel_consumption_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fcl_created_at ON fuel_consumption_logs(created_at DESC);

-- 5. Vehicle Learned Mileage History
CREATE TABLE IF NOT EXISTS vehicle_mileage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    previous_entry_id UUID REFERENCES manual_fuel_entries(id) ON DELETE SET NULL,
    current_entry_id UUID REFERENCES manual_fuel_entries(id) ON DELETE SET NULL,
    distance_travelled NUMERIC(10,2) NOT NULL, -- KM between 2 verified entries
    actual_fuel_consumed NUMERIC(8,2) NOT NULL, -- Litres consumed
    calculated_mileage NUMERIC(6,2) NOT NULL, -- distance / fuel_consumed
    rolling_average_mileage NUMERIC(6,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vmh_vehicle_id ON vehicle_mileage_history(vehicle_id);
