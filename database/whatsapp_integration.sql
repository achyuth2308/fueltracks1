-- ============================================================
-- WHATSAPP INTEGRATION MIGRATION
-- Adds tables for WhatsApp recipients, outbox/message logging,
-- and organization WhatsApp preferences.
-- Idempotent (safe to re-run).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. WhatsApp Recipients table (opt-in consent tracked per tenant)
CREATE TABLE IF NOT EXISTS whatsapp_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone_e164 VARCHAR(32) NOT NULL,
    role VARCHAR(50) DEFAULT 'other',
    opt_in BOOLEAN DEFAULT false,
    opt_in_at TIMESTAMP WITH TIME ZONE,
    opt_in_source VARCHAR(50),
    opt_out_at TIMESTAMP WITH TIME ZONE,
    receive_refill BOOLEAN DEFAULT true,
    receive_theft BOOLEAN DEFAULT true,
    receive_daily_report BOOLEAN DEFAULT true,
    vehicle_scope JSONB DEFAULT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_whatsapp_recipient_org_phone UNIQUE(org_id, phone_e164)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_recipients_org ON whatsapp_recipients(org_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_recipients_phone ON whatsapp_recipients(phone_e164);

-- 2. WhatsApp Messages table (Transactional Outbox + Delivery Log)
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id BIGSERIAL PRIMARY KEY,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES whatsapp_recipients(id) ON DELETE SET NULL,
    phone_masked VARCHAR(32) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_ref VARCHAR(255) NOT NULL,
    template_name VARCHAR(100) NOT NULL,
    language VARCHAR(20) DEFAULT 'en',
    payload JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) DEFAULT 'queued',
    wamid VARCHAR(255),
    error_code VARCHAR(50),
    error_message TEXT,
    attempts INT DEFAULT 0,
    next_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_whatsapp_messages_idempotency UNIQUE(event_type, event_ref, recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status_next ON whatsapp_messages (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_wamid ON whatsapp_messages (wamid);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_org_created ON whatsapp_messages (org_id, created_at DESC);

-- 3. WhatsApp Organization Settings (Daily report timing, toggles, & rate limits)
CREATE TABLE IF NOT EXISTS whatsapp_org_settings (
    org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    daily_report_enabled BOOLEAN DEFAULT true,
    daily_report_time VARCHAR(10) DEFAULT '07:00',
    daily_report_include_pdf BOOLEAN DEFAULT false,
    max_daily_messages INT DEFAULT 1000,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE whatsapp_org_settings ADD COLUMN IF NOT EXISTS max_daily_messages INT DEFAULT 1000;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_expires_at ON whatsapp_messages (expires_at) WHERE status IN ('queued', 'failed');
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;


