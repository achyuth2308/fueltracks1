-- Add is_sand_mining column to vehicles table
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS is_sand_mining BOOLEAN DEFAULT false;
