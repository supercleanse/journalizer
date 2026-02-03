-- Daily digest support: join table linking digest entries to their source entries
CREATE TABLE digest_entries (
    id              TEXT PRIMARY KEY,
    digest_id       TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    source_entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_digest_entries_digest ON digest_entries(digest_id);
CREATE INDEX idx_digest_entries_source ON digest_entries(source_entry_id);

-- Track last digest date per user to prevent duplicate generation
ALTER TABLE users ADD COLUMN last_digest_date TEXT;
