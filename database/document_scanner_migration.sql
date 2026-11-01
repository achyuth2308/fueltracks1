-- ============================================================
-- DOCUMENT SCANNER MIGRATION (UP)
-- Production Safety:
--  - Strictly ADDITIVE ONLY: new tables document_scans and document_scan_fields
--  - Transactional with 3s lock_timeout to prevent queueing behind live traffic
--  - Idempotent (IF NOT EXISTS)
--  - Tenant-scoped idempotency unique index excluding failed/rejected/purged
-- ============================================================

BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10s';

-- 1. Main Document Scans Table
CREATE TABLE IF NOT EXISTS document_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'queued', -- queued, processing, done, needs_review, failed, purged, rejected
  document_type VARCHAR(50),                     -- fitment_certificate, rc, aadhaar, unknown
  template_id VARCHAR(50),                       -- fueltracks, volty, unknown_template
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_hash VARCHAR(64) NOT NULL,                -- SHA-256 for tenant-scoped idempotency
  file_size INT NOT NULL,
  mime_type VARCHAR(50) NOT NULL,
  source_used VARCHAR(30),                       -- pdf_text, qr, ocr, llm
  overall_confidence NUMERIC(5,4),
  needs_review BOOLEAN DEFAULT TRUE,
  extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_confirmed_data JSONB DEFAULT NULL,
  warnings JSONB DEFAULT '[]'::jsonb,
  error_code VARCHAR(50) DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  next_attempt_at TIMESTAMP DEFAULT NOW(),
  locked_at TIMESTAMP DEFAULT NULL,
  locked_by VARCHAR(100) DEFAULT NULL,
  aadhaar_last4 VARCHAR(4) DEFAULT NULL,
  aadhaar_hmac VARCHAR(64) DEFAULT NULL,         -- Salted HMAC for duplicate detection without raw storage
  aadhaar_consent BOOLEAN DEFAULT FALSE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMP DEFAULT NULL,
  confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP DEFAULT NULL
);

-- 2. Per-Field Extraction Table
CREATE TABLE IF NOT EXISTS document_scan_fields (
  id BIGSERIAL PRIMARY KEY,
  scan_id UUID NOT NULL REFERENCES document_scans(id) ON DELETE CASCADE,
  field_group VARCHAR(50) NOT NULL,              -- certificate, vehicle, device, installer, etc.
  field_name VARCHAR(100) NOT NULL,              -- vehicle_registration_no, imei_number, etc.
  extracted_value TEXT,
  normalized_value TEXT,
  confirmed_value TEXT,
  confidence NUMERIC(5,4) NOT NULL DEFAULT 1.0,
  source VARCHAR(30) NOT NULL,                   -- pdf_text, qr, ocr, llm
  validated BOOLEAN DEFAULT TRUE,
  warnings JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Tenant-scoped idempotency unique index (allows re-upload if failed, rejected or purged)
CREATE UNIQUE INDEX IF NOT EXISTS uq_document_scans_org_hash
  ON document_scans(org_id, file_hash)
  WHERE deleted_at IS NULL AND status NOT IN ('failed', 'rejected', 'purged');

-- 4. Partial queue index for SKIP LOCKED worker claims
CREATE INDEX IF NOT EXISTS idx_document_scans_queue
  ON document_scans(next_attempt_at, created_at)
  WHERE status = 'queued';

-- 5. Additional performant query indexes
CREATE INDEX IF NOT EXISTS idx_document_scans_org_status
  ON document_scans(org_id, status);

CREATE INDEX IF NOT EXISTS idx_document_scans_aadhaar_hmac
  ON document_scans(org_id, aadhaar_hmac)
  WHERE aadhaar_hmac IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_document_scan_fields_scan_id
  ON document_scan_fields(scan_id);

COMMIT;

