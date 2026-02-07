-- Habit definitions
CREATE TABLE IF NOT EXISTS habits (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  question      TEXT NOT NULL,
  sort_order    INTEGER DEFAULT 0,
  is_active     INTEGER DEFAULT 1,
  checkin_time  TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id);

-- Daily habit completion logs
CREATE TABLE IF NOT EXISTS habit_logs (
  id          TEXT PRIMARY KEY,
  habit_id    TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date    TEXT NOT NULL,
  completed   INTEGER NOT NULL,
  source      TEXT NOT NULL DEFAULT 'web',
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_habit_logs_unique ON habit_logs(habit_id, log_date);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date ON habit_logs(user_id, log_date);
