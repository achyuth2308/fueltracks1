-- ============================================================
-- API KEYS TABLE — FuelTracks Third-Party Integration
-- Stores API keys issued to client organizations
-- ============================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key_hash      TEXT NOT NULL UNIQUE,           -- SHA-256 hash of the raw key
  key_prefix    VARCHAR(12) NOT NULL,           -- First 8 chars, for display in admin UI (e.g. "ftkn_abc1")
  name          TEXT NOT NULL,                 -- Descriptive label, e.g. "Client Portal Integration"
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_org_id   ON api_keys(org_id);

COMMENT ON TABLE api_keys IS 'API keys issued to client organizations for third-party integration access.';
