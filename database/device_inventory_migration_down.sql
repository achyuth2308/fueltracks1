-- ============================================================
-- FUELTRACKS DEVICE INVENTORY MASTER — DOWN MIGRATION
-- Safely drops device_inventory table
-- ============================================================

DROP TABLE IF EXISTS device_inventory CASCADE;

