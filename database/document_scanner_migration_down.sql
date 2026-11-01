-- ============================================================
-- DOCUMENT SCANNER MIGRATION (DOWN / ROLLBACK)
-- Rollback order:
--  1. Feature flag DOCUMENT_SCANNER_ENABLED=false
--  2. Stop scanner worker process
--  3. pg_dump table backups (document_scans, document_scan_fields)
--  4. Execute this DOWN script
-- ============================================================

BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10s';

DROP TABLE IF EXISTS document_scan_fields CASCADE;
DROP TABLE IF EXISTS document_scans CASCADE;

COMMIT;

