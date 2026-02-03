-- Journalizer D1 Schema (metadata & text only — media files live in R2)
PRAGMA foreign_keys = ON;

-- Users table
CREATE TABLE users (
    id              TEXT PRIMARY KEY,
    google_id       TEXT UNIQUE NOT NULL,
    email           TEXT UNIQUE NOT NULL,
    display_name    TEXT,
    avatar_url      TEXT,
    phone_number    TEXT,
    phone_verified  INTEGER DEFAULT 0,
    voice_style     TEXT DEFAULT 'natural',
    voice_notes     TEXT,
    timezone        TEXT DEFAULT 'America/New_York',
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

-- Journal entries
CREATE TABLE entries (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    raw_content     TEXT,
    polished_content TEXT,
    entry_type      TEXT NOT NULL,
    source          TEXT NOT NULL,
    mood            TEXT,
    tags            TEXT,
    location        TEXT,
    entry_date      TEXT NOT NULL,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

-- Media attachments
CREATE TABLE media (
    id              TEXT PRIMARY KEY,
    entry_id        TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL REFERENCES users(id),
    r2_key          TEXT NOT NULL,
    media_type      TEXT NOT NULL,
    mime_type       TEXT,
    file_size       INTEGER,
    duration_seconds INTEGER,
    transcription   TEXT,
    thumbnail_r2_key TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
);

-- Reminder configuration
CREATE TABLE reminders (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reminder_type   TEXT NOT NULL,
    time_of_day     TEXT,
    day_of_week     INTEGER,
    day_of_month    INTEGER,
    smart_threshold INTEGER DEFAULT 2,
    is_active       INTEGER DEFAULT 1,
    last_sent_at    TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
);

-- Processing log
CREATE TABLE processing_log (
    id              TEXT PRIMARY KEY,
    entry_id        TEXT REFERENCES entries(id) ON DELETE SET NULL,
    action          TEXT NOT NULL,
    status          TEXT NOT NULL,
    details         TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
);

-- Print subscriptions (Phase 2)
CREATE TABLE print_subscriptions (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    frequency       TEXT NOT NULL,
    format          TEXT DEFAULT 'softcover',
    status          TEXT DEFAULT 'active',
    shipping_address TEXT,
    next_print_date TEXT,
    last_printed_at TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX idx_entries_user_date ON entries(user_id, entry_date DESC);
CREATE INDEX idx_entries_user_created ON entries(user_id, created_at DESC);
CREATE INDEX idx_media_entry ON media(entry_id);
CREATE INDEX idx_media_user ON media(user_id);
CREATE INDEX idx_reminders_user ON reminders(user_id);
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_google ON users(google_id);
CREATE INDEX idx_processing_log_entry ON processing_log(entry_id);
CREATE INDEX idx_processing_log_status ON processing_log(status, created_at);
