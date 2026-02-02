# Task ID: 12

**Title:** Build Cron Trigger worker for processing scheduled reminders

**Status:** pending

**Dependencies:** 11

**Priority:** medium

**Description:** Implement scheduled worker using Cloudflare Cron Triggers that runs every 15 minutes to process due reminders, handles timezone conversion, checks smart nudge conditions, and sends SMS via Twilio.

**Details:**

Create `src/services/reminders.ts` with cron handler.

In wrangler.toml, add:
```toml
[triggers]
crons = ["*/15 * * * *"]  # Every 15 minutes
```

Cron logic:
```typescript
export async function handleCron(env: Env) {
  const now = new Date();
  const activeReminders = await getAllActiveReminders(env.DB);
  
  for (const reminder of activeReminders) {
    const user = await getUserById(reminder.userId, env.DB);
    const userTime = convertToTimezone(now, user.timezone);
    
    if (shouldFireReminder(reminder, userTime, user)) {
      const message = selectReminderMessage(reminder.reminderType);
      await sendSMS(user.phoneNumber, message, env);
      await updateLastSentAt(reminder.id, now, env.DB);
    }
  }
}
```

Smart nudge logic: Query entries table for user's most recent entry, calculate days since, compare to smartThreshold.

Reminder messages rotate through variations (PRD section 8.4):
- "Hey! What happened today? Just reply to this message 📓"
- "Quick check-in: How's your day going? Reply with anything."
- "It's been {X} days since your last entry. No pressure, but we're here when you're ready!"

Glass spec:
- `glass/services/reminders.glass` - Intent: automated journal prompts; Contract: guarantees timezone-accurate delivery, smart threshold calculation, message delivery confirmation, no duplicate sends

**Test Strategy:**

Test cron trigger locally with `wrangler dev`. Mock current time and test all reminder types fire at correct times. Test timezone conversion for users in different zones. Test smart nudge logic with various entry gaps. Verify Twilio SMS delivery. Test duplicate prevention (last_sent_at check).

## Subtasks

### 12.1. Configure Cloudflare Cron Trigger in wrangler.toml

**Status:** pending  
**Dependencies:** None  

Add cron trigger configuration to wrangler.toml to execute the reminder worker every 15 minutes using the schedule pattern */15 * * * *

**Details:**

Edit wrangler.toml and add a [triggers] section with crons array containing the pattern "*/15 * * * *". This configures the Worker to run every 15 minutes. Verify the syntax matches Cloudflare's cron trigger format and ensure it's properly positioned in the configuration file.

### 12.2. Create reminders service file and handleCron entry point

**Status:** pending  
**Dependencies:** 12.1  

Create src/services/reminders.ts with the main handleCron function that serves as the entry point for the cron trigger execution

**Details:**

Create the file structure for src/services/reminders.ts. Implement the handleCron(env: Env) function skeleton that will be called by the cron trigger. Set up proper TypeScript typing for the Env parameter including D1, KV, and environment variable bindings. Add the scheduled handler export in the main worker file to route cron events to handleCron.

### 12.3. Implement getAllActiveReminders database query function

**Status:** pending  
**Dependencies:** 12.2  

Create database query function to fetch all active reminders from the reminders table that need to be evaluated for sending

**Details:**

Implement getAllActiveReminders(db: D1Database) function that queries the reminders table for all reminders where is_active = true. Return reminder records with userId, reminderType, timeOfDay, dayOfWeek, dayOfMonth, smartThreshold, and last_sent_at fields. Optimize query for performance since it runs every 15 minutes.

### 12.4. Implement timezone conversion utility function

**Status:** pending  
**Dependencies:** 12.2  

Create convertToTimezone function that converts UTC server time to user's local timezone using their timezone setting from the users table

**Details:**

Implement convertToTimezone(utcDate: Date, timezone: string): Date function using Intl.DateTimeFormat or date-fns-tz library. Handle IANA timezone identifiers (e.g., 'America/Los_Angeles'). Extract hour and minute components in user's local time for comparison with reminder timeOfDay settings. Include proper error handling for invalid timezone strings.

### 12.5. Implement shouldFireReminder logic for daily reminders

**Status:** pending  
**Dependencies:** 12.3, 12.4  

Create logic to determine if a daily reminder should fire by comparing current user local time to configured timeOfDay

**Details:**

Implement shouldFireReminder function that takes reminder config, user local time, and last_sent_at timestamp. For daily reminders, check if current time hour:minute matches timeOfDay within the 15-minute window. Ensure reminder hasn't been sent already today by checking last_sent_at date. Return boolean indicating whether to send.

### 12.6. Implement weekly reminder matching logic

**Status:** pending  
**Dependencies:** 12.5  

Add weekly reminder logic that checks both day of week and time of day before firing

**Details:**

Extend shouldFireReminder to handle reminderType='weekly'. Check if current day of week (0-6, Sunday=0) matches reminder.dayOfWeek. Also verify timeOfDay matches within 15-minute window. Check last_sent_at to ensure reminder hasn't fired this week on this day. Return true only if all conditions match.

### 12.7. Implement monthly reminder matching logic

**Status:** pending  
**Dependencies:** 12.6  

Add monthly reminder logic that checks day of month and time of day before firing

**Details:**

Extend shouldFireReminder to handle reminderType='monthly'. Check if current day of month (1-31) matches reminder.dayOfMonth. Also verify timeOfDay matches within 15-minute window. Check last_sent_at to ensure reminder hasn't fired this month on this day. Handle months with fewer days (e.g., dayOfMonth=31 won't fire in February).

### 12.8. Implement smart nudge logic with entry gap calculation

**Status:** pending  
**Dependencies:** 12.3, 12.4  

Create smart nudge logic that queries entries table to calculate days since last entry and compares to smartThreshold

**Details:**

Implement getLastEntryDate(userId, db) that queries entries table for user's most recent entry ordered by created_at DESC. Calculate daysSinceLastEntry = Math.floor((now - lastEntryDate) / (1000*60*60*24)). In shouldFireReminder for reminderType='smart', return true if daysSinceLastEntry >= smartThreshold and last_sent_at is not today. Handle case where user has no entries (send reminder if smartThreshold days passed since user creation).

### 12.9. Implement reminder message rotation system

**Status:** pending  
**Dependencies:** None  

Create selectReminderMessage function that rotates through 3-5 message variations based on reminder type and context

**Details:**

Implement selectReminderMessage(reminderType, daysSinceLastEntry?) that returns one of 3-5 message variations. Standard messages: 'Hey! What happened today? Just reply to this message 📓', 'Quick check-in: How's your day going? Reply with anything.'. Smart nudge variation: 'It's been {X} days since your last entry. No pressure, but we're here when you're ready!'. Use random selection or round-robin based on reminder ID to distribute evenly.

### 12.10. Integrate SMS service to send reminder messages

**Status:** pending  
**Dependencies:** 12.9  

Call Twilio SMS API to send the selected reminder message to the user's verified phone number

**Details:**

Implement sendSMS(phoneNumber, message, env) function that uses Twilio API credentials from env (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER). Make HTTP POST to Twilio API to send SMS. Handle Twilio errors (invalid number, delivery failure) gracefully with logging. Return success/failure status. Ensure phone number is in E.164 format.

### 12.11. Update last_sent_at timestamp after successful SMS delivery

**Status:** pending  
**Dependencies:** 12.10  

After successfully sending a reminder SMS, update the reminder's last_sent_at field in the database to prevent duplicate sends

**Details:**

Implement updateLastSentAt(reminderId, timestamp, db) function that executes UPDATE query on reminders table: SET last_sent_at = ? WHERE id = ?. Call this function immediately after successful sendSMS call. Use current UTC timestamp. This prevents the same reminder from firing again within the 15-minute cron window or same day.

### 12.12. Create Glass specification for services/reminders.glass

**Status:** pending  
**Dependencies:** 12.11  

Document the reminders service in Glass framework format with intent, contract, and guarantees for timezone-accurate delivery and duplicate prevention

**Details:**

Create glass/services/reminders.glass file following Glass Framework methodology. Document Intent: automated journal prompts via SMS on configurable schedules. Contract: guarantees timezone-accurate delivery (converts UTC to user timezone), smart threshold calculation (queries entries for gap analysis), message delivery confirmation (Twilio response), no duplicate sends within same day (last_sent_at tracking). Include function signatures for handleCron, shouldFireReminder, convertToTimezone, sendSMS. Document error handling approach.
