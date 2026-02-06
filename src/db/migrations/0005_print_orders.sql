-- Print service: expand print_subscriptions, add print_orders, add stripe_customer_id
PRAGMA foreign_keys = ON;

-- Drop the placeholder print_subscriptions table (no production data)
DROP TABLE IF EXISTS print_subscriptions;

-- Recreate with full schema
CREATE TABLE print_subscriptions (
    id                TEXT PRIMARY KEY,
    user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    frequency         TEXT NOT NULL,  -- 'weekly' | 'monthly' | 'quarterly' | 'yearly'
    is_active         INTEGER DEFAULT 1,
    shipping_name     TEXT NOT NULL,
    shipping_line1    TEXT NOT NULL,
    shipping_line2    TEXT,
    shipping_city     TEXT NOT NULL,
    shipping_state    TEXT NOT NULL,
    shipping_zip      TEXT NOT NULL,
    shipping_country  TEXT NOT NULL DEFAULT 'US',
    color_option      TEXT DEFAULT 'bw',  -- 'bw' | 'color'
    include_images    INTEGER DEFAULT 1,
    next_print_date   TEXT,
    last_printed_at   TEXT,
    created_at        TEXT DEFAULT (datetime('now')),
    updated_at        TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_print_subs_user ON print_subscriptions(user_id);
CREATE INDEX idx_print_subs_next ON print_subscriptions(next_print_date) WHERE is_active = 1;

-- Print orders table
CREATE TABLE print_orders (
    id                TEXT PRIMARY KEY,
    user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id   TEXT REFERENCES print_subscriptions(id) ON DELETE SET NULL,
    lulu_job_id       TEXT,
    status            TEXT NOT NULL DEFAULT 'pending',  -- pending | generating | uploaded | in_production | shipped | delivered | failed | payment_failed
    frequency         TEXT NOT NULL,
    period_start      TEXT NOT NULL,
    period_end        TEXT NOT NULL,
    entry_count       INTEGER,
    page_count        INTEGER,
    cost_cents        INTEGER,
    retail_cents      INTEGER,
    tracking_url      TEXT,
    error_message     TEXT,
    stripe_payment_id TEXT,
    created_at        TEXT DEFAULT (datetime('now')),
    updated_at        TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_print_orders_user ON print_orders(user_id);
CREATE INDEX idx_print_orders_sub ON print_orders(subscription_id);
CREATE INDEX idx_print_orders_status ON print_orders(status);
CREATE INDEX idx_print_orders_lulu ON print_orders(lulu_job_id);

-- Add stripe_customer_id to users
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
