-- =============================================================================
-- Migration 007: Trap / Honeypot Logs
-- Paste into Supabase -> SQL Editor -> Run
-- =============================================================================

CREATE TABLE IF NOT EXISTS trap_logs (
    id            BIGSERIAL PRIMARY KEY,
    ip            VARCHAR(64) NOT NULL DEFAULT 'UNKNOWN',
    country       VARCHAR(10) NOT NULL DEFAULT 'UNKNOWN',
    device_model  VARCHAR(150) NOT NULL DEFAULT 'Unknown',
    browser       VARCHAR(100) NOT NULL DEFAULT 'Unknown',
    os            VARCHAR(100) NOT NULL DEFAULT 'Unknown',
    user_agent    TEXT,
    extra         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_traps_created ON trap_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_traps_ip ON trap_logs(ip);

-- RLS: Only service role / backend connection can access
ALTER TABLE trap_logs ENABLE ROW LEVEL SECURITY;
