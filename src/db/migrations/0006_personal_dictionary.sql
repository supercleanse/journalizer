-- Personal dictionary for per-user proper noun storage
-- Used to improve transcription accuracy (Whisper initial_prompt) and polishing

CREATE TABLE IF NOT EXISTS personal_dictionary (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  term            TEXT NOT NULL,
  category        TEXT DEFAULT 'other',
  auto_extracted  INTEGER DEFAULT 0,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dict_user_term ON personal_dictionary(user_id, term);
CREATE INDEX IF NOT EXISTS idx_dict_user ON personal_dictionary(user_id);
