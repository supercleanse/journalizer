-- Add Telegram chat ID column for bot linking
ALTER TABLE users ADD COLUMN telegram_chat_id TEXT;
CREATE INDEX idx_users_telegram ON users(telegram_chat_id);
