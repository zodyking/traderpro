ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_preferences jsonb NOT NULL DEFAULT '{"signUp":true,"login":true,"alerts":true,"backtests":true,"productUpdates":false}'::jsonb;
