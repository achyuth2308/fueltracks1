-- ============================================================
-- FCM Notifications Migration
-- Adds tables to store device FCM tokens and user notification preferences
-- ============================================================

-- Store device FCM tokens for push notifications
CREATE TABLE IF NOT EXISTS user_fcm_tokens (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    fcm_token TEXT NOT NULL,
    device_info JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, fcm_token)
);

-- Store user toggle preferences for different alert types
CREATE TABLE IF NOT EXISTS user_alert_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    preferences JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
