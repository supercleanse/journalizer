-- Email subscriptions for recurring journal PDF delivery
-- Users can subscribe to weekly, monthly, quarterly, or yearly email reports

CREATE TABLE IF NOT EXISTS email_subscriptions (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  frequency       TEXT NOT NULL,
  entry_types     TEXT DEFAULT 'both',
  is_active       INTEGER DEFAULT 1,
  include_images  INTEGER DEFAULT 1,
  next_email_date TEXT,
  last_emailed_at TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_email_subs_user ON email_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_email_subs_next ON email_subscriptions(next_email_date) WHERE is_active = 1;
