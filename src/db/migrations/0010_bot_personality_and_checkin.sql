-- Add user-level habit check-in time and bot personality
ALTER TABLE users ADD COLUMN habit_checkin_time TEXT;
ALTER TABLE users ADD COLUMN bot_personality TEXT DEFAULT 'encouraging';

-- Add cleanup tracking to habits
ALTER TABLE habits ADD COLUMN last_cleanup_offered_at TEXT;

-- Migrate existing per-habit checkin times to user-level
UPDATE users SET habit_checkin_time = (
  SELECT MIN(checkin_time) FROM habits
  WHERE habits.user_id = users.id
  AND habits.checkin_time IS NOT NULL AND habits.is_active = 1
) WHERE habit_checkin_time IS NULL
AND EXISTS (SELECT 1 FROM habits WHERE habits.user_id = users.id AND habits.checkin_time IS NOT NULL);
