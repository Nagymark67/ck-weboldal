-- Create push_tokens table for storing device FCM registration tokens
CREATE TABLE IF NOT EXISTS push_tokens (
  token TEXT PRIMARY KEY,
  username VARCHAR(100),
  platform VARCHAR(50) DEFAULT 'android',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS push_tokens_username_idx ON push_tokens (username);

-- Create sent_event_reminders table to track sent calendar push notifications
CREATE TABLE IF NOT EXISTS sent_event_reminders (
  reminder_key TEXT PRIMARY KEY,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
