-- ============================================================
-- FUELTRACKS AUDIT MODULE — DB MIGRATION
-- Creates audit_logs table (new, isolated — does not touch existing tables)
-- Run once: node backend/scripts/runAuditMigration.js
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id                  BIGSERIAL PRIMARY KEY,

  -- Audit classification
  audit_type          VARCHAR(30)  NOT NULL,    -- 'organization'|'user'|'group'|'vehicle'|'device'|'license'|'login'|'system'
  entity_type         VARCHAR(50)  NOT NULL,    -- 'Organization'|'User'|'Group'|'Vehicle'|'Device'
  entity_id           VARCHAR(100),             -- UUID or string ID of the entity
  entity_name         VARCHAR(200),             -- Human-readable name at time of event

  -- What happened
  action              VARCHAR(100) NOT NULL,    -- 'CREATED'|'UPDATED'|'DELETED'|'LOGIN_SUCCESS'|'LOGIN_FAILED'|'LOGOUT'|'REGISTERED'|'ASSIGNED'|'REMOVED'

  -- Change snapshot
  old_data            JSONB,                    -- State before change (null for creates)
  new_data            JSONB,                    -- State after change (null for deletes)

  -- Who did it
  performed_by_id     UUID,                     -- users.id of actor
  performed_by_name   VARCHAR(100),             -- name at time of event
  performed_by_email  VARCHAR(100),             -- email at time of event
  performed_by_role   VARCHAR(30),              -- role at time of event

  -- Context hierarchy
  org_id              UUID,                     -- organization context
  org_name            VARCHAR(100),
  group_id            UUID,
  group_name          VARCHAR(100),
  vehicle_id          UUID,
  vehicle_name        VARCHAR(100),
  device_id           VARCHAR(50),

  -- Network context
  ip_address          VARCHAR(45),
  user_agent          TEXT,

  -- Timestamp
  created_at          TIMESTAMP DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_audit_type    ON audit_logs(audit_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type   ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id        ON audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at    ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by  ON audit_logs(performed_by_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action        ON audit_logs(action);
