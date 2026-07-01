-- ============================================================
-- FORGOT PASSWORD MIGRATION
-- Adds reset_token and reset_token_expires to users table
-- ============================================================

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;
