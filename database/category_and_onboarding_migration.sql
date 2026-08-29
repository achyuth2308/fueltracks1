-- ============================================================
-- CATEGORY & ONBOARDING ENHANCEMENT MIGRATION
-- Adds category to vehicles and Aadhar/PAN to users
-- ============================================================

-- Add category to vehicles (TG Mining, VLTD, VLTD + Mining, General, etc.)
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'General';

CREATE INDEX IF NOT EXISTS idx_vehicles_category ON vehicles(category);

-- Add Aadhar & PAN to users for customer onboarding
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS aadhar_no VARCHAR(20),
ADD COLUMN IF NOT EXISTS pan_no VARCHAR(20);
