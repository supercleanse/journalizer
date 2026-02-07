-- Add digest email notification preference (opt-in, default off)
ALTER TABLE users ADD COLUMN digest_notify_email INTEGER DEFAULT 0;
