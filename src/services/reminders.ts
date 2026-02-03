import type { Env } from "../types/env";
import { createDb } from "../db/index";
import {
  getAllActiveReminders,
  getUsersByIds,
  getLastEntryDate,
  updateReminderLastSent,
  logProcessing,
} from "../db/queries";
import { sendSMS } from "./sms";

// Glass contract: failure modes (soft failures in cron loop)
export { SMSDeliveryFailed, UserNotFound, TimezoneInvalid } from "../lib/errors";

const DAILY_MESSAGES = [
  "Hey! What happened today? Just reply to this message.",
  "Quick check-in: How's your day going? Reply with anything.",
  "Time for your daily journal! What's on your mind?",
  "Your daily writing prompt: What was the highlight of your day?",
  "A moment to reflect — reply with whatever comes to mind.",
];

const SMART_NUDGE_TEMPLATE = (days: number) =>
  `It's been ${days} day${days === 1 ? "" : "s"} since your last entry. No pressure, but we're here when you're ready!`;

/**
 * Convert a UTC Date to the user's local time components.
 */
function getUserLocalTime(utcDate: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(utcDate);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return {
    hour: parseInt(get("hour"), 10),
    minute: parseInt(get("minute"), 10),
    dayOfWeek: utcDate.toLocaleDateString("en-US", {
      timeZone: timezone,
      weekday: "short",
    }),
    dayOfMonth: parseInt(get("day"), 10),
    dateString: `${get("year")}-${get("month").padStart(2, "0")}-${get("day").padStart(2, "0")}`,
  };
}

const DAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Check whether a reminder's timeOfDay falls within the current 15-minute cron window.
 */
function timeMatches(
  reminderTime: string | null,
  localHour: number,
  localMinute: number
): boolean {
  if (!reminderTime) return false;
  const [rh, rm] = reminderTime.split(":").map(Number);
  // The cron runs every 15 minutes. Match if the reminder's HH:MM falls
  // within [localHour:localMinute, localHour:localMinute + 14].
  const reminderMinutes = rh * 60 + rm;
  const currentMinutes = localHour * 60 + localMinute;
  return (
    reminderMinutes >= currentMinutes && reminderMinutes < currentMinutes + 15
  );
}

/**
 * Check if the reminder was already sent today (in the user's timezone).
 */
function alreadySentToday(
  lastSentAt: string | null,
  userDateString: string,
  timezone: string
): boolean {
  if (!lastSentAt) return false;
  const sentDate = new Date(lastSentAt);
  const sentLocal = getUserLocalTime(sentDate, timezone);
  return sentLocal.dateString === userDateString;
}

/**
 * Select a reminder message. Uses the reminder ID hash for deterministic rotation.
 */
function selectMessage(
  reminderType: string,
  reminderId: string,
  daysSinceLastEntry?: number
): string {
  if (reminderType === "smart" && daysSinceLastEntry !== undefined) {
    return SMART_NUDGE_TEMPLATE(daysSinceLastEntry);
  }
  // Deterministic rotation based on reminder ID
  let hash = 0;
  for (let i = 0; i < reminderId.length; i++) {
    hash = (hash * 31 + reminderId.charCodeAt(i)) | 0;
  }
  // Mix in the current date so it rotates daily
  const today = new Date().toISOString().split("T")[0];
  for (let i = 0; i < today.length; i++) {
    hash = (hash * 31 + today.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % DAILY_MESSAGES.length;
  return DAILY_MESSAGES[idx];
}

/**
 * Main cron handler. Evaluates all active reminders and sends SMS for those that are due.
 */
export async function handleCron(env: Env): Promise<void> {
  const db = createDb(env.DB);
  const now = new Date();

  const activeReminders = await getAllActiveReminders(db);

  // Batch-fetch all users to avoid N+1 queries
  const userIds = [...new Set(activeReminders.map((r) => r.userId))];
  const usersArr = await getUsersByIds(db, userIds);
  const usersMap = new Map(usersArr.map((u) => [u.id, u]));

  for (const reminder of activeReminders) {
    try {
      const user = usersMap.get(reminder.userId);
      if (!user || !user.phoneNumber || user.phoneVerified !== 1) continue;

      let timezone = user.timezone || "UTC";
      let local;
      try {
        local = getUserLocalTime(now, timezone);
      } catch {
        // Invalid timezone — fall back to UTC
        timezone = "UTC";
        local = getUserLocalTime(now, timezone);
      }

      // Skip if already sent today
      if (alreadySentToday(reminder.lastSentAt, local.dateString, timezone)) {
        continue;
      }

      let shouldSend = false;
      let daysSinceLastEntry: number | undefined;

      switch (reminder.reminderType) {
        case "daily":
          shouldSend = timeMatches(reminder.timeOfDay, local.hour, local.minute);
          break;

        case "weekly": {
          const dayNum = DAY_MAP[local.dayOfWeek] ?? -1;
          shouldSend =
            dayNum === reminder.dayOfWeek &&
            timeMatches(reminder.timeOfDay, local.hour, local.minute);
          break;
        }

        case "monthly":
          shouldSend =
            local.dayOfMonth === reminder.dayOfMonth &&
            timeMatches(reminder.timeOfDay, local.hour, local.minute);
          break;

        case "smart": {
          const lastEntry = await getLastEntryDate(db, reminder.userId);
          if (lastEntry) {
            const lastDate = new Date(lastEntry);
            daysSinceLastEntry = Math.floor(
              (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
            );
          } else {
            // No entries at all — use a large gap
            daysSinceLastEntry = 999;
          }
          const threshold = reminder.smartThreshold ?? 2;
          shouldSend = daysSinceLastEntry >= threshold;
          break;
        }
      }

      if (!shouldSend) continue;

      const message = selectMessage(
        reminder.reminderType,
        reminder.id,
        daysSinceLastEntry
      );

      const sent = await sendSMS(env, user.phoneNumber, message);

      if (sent) {
        await updateReminderLastSent(db, reminder.id, now.toISOString());
        await logProcessing(db, {
          id: crypto.randomUUID(),
          action: "reminder_sent",
          status: "success",
          details: JSON.stringify({
            reminderId: reminder.id,
            userId: reminder.userId,
            reminderType: reminder.reminderType,
          }),
        });
      } else {
        await logProcessing(db, {
          id: crypto.randomUUID(),
          action: "reminder_sent",
          status: "error",
          details: JSON.stringify({
            reminderId: reminder.id,
            error: "SMS delivery failed",
          }),
        });
      }
    } catch (err) {
      // Log and continue — don't let one reminder failure stop the rest
      await logProcessing(db, {
        id: crypto.randomUUID(),
        action: "reminder_sent",
        status: "error",
        details: JSON.stringify({
          reminderId: reminder.id,
          error: err instanceof Error ? err.message : "Unknown error",
        }),
      }).catch(() => {});
    }
  }
}
