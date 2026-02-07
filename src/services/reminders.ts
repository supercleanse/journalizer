import type { Env } from "../types/env";
import { createDb } from "../db/index";
import {
  getAllActiveReminders,
  getAllUsers,
  getUsersByIds,
  getLastEntryDatesByUserIds,
  updateReminderLastSent,
  logProcessing,
  getActiveHabitsWithCheckinTime,
  getHabitLogsForDate,
} from "../db/queries";
import { sendTelegramMessage } from "./telegram";
import { generateDailyDigest } from "./digest";
import { getDailyQuip, getFallbackQuip } from "./reminderQuips";
import {
  generateDigestNotificationContent,
  formatDigestTelegramMessage,
  buildDigestNotificationEmailHtml,
} from "./digestNotification";
import { sendEmail } from "./email";

// Glass contract: failure modes (soft failures in cron loop)
export { SMSDeliveryFailed, UserNotFound, TimezoneInvalid, DigestGenerationFailed } from "../lib/errors";

export interface HabitCheckinSession {
  userId: string;
  habitIds: string[];
  questions: string[];
  names: string[];
  currentIndex: number;
  answers: Record<string, boolean>;
  date: string;
}

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
 * Prepends a daily quip to daily/weekly/monthly reminders.
 */
function selectMessage(
  reminderType: string,
  reminderId: string,
  dailyQuip: string,
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
  return `${dailyQuip}\n\n${DAILY_MESSAGES[idx]}`;
}

/**
 * Main cron handler. Evaluates all active reminders and generates daily digests.
 */
export async function handleCron(env: Env): Promise<void> {
  const db = createDb(env.DB);
  const now = new Date();

  // ── Daily Digest Generation ──────────────────────────────────────
  try {
    const allUsers = await getAllUsers(db);

    for (const user of allUsers) {
      try {
        let timezone = user.timezone || "UTC";
        let local;
        try {
          local = getUserLocalTime(now, timezone);
        } catch {
          timezone = "UTC";
          local = getUserLocalTime(now, timezone);
        }

        // Generate digest in the 00:00-00:14 window (midnight)
        if (local.hour !== 0 || local.minute >= 15) continue;

        // Calculate yesterday's date using local calendar subtraction (DST-safe)
        const [year, month, day] = local.dateString.split("-").map(Number);
        const localCalendarDate = new Date(Date.UTC(year, month - 1, day));
        localCalendarDate.setUTCDate(localCalendarDate.getUTCDate() - 1);
        const targetDate = localCalendarDate.toISOString().slice(0, 10);

        // Skip if already generated for this date
        if (user.lastDigestDate === targetDate) continue;

        const digestContent = await generateDailyDigest(
          env,
          db,
          user.id,
          targetDate
        );

        // Send notifications if digest was created
        if (digestContent) {
          try {
            const notifContent = await generateDigestNotificationContent(
              env,
              user.id,
              targetDate,
              digestContent
            );

            // Enhanced Telegram notification
            if (user.telegramChatId) {
              const telegramMsg = formatDigestTelegramMessage(targetDate, notifContent);
              await sendTelegramMessage(env, user.telegramChatId, telegramMsg).catch(() => {});
            }

            // Opt-in email notification
            if (user.digestNotifyEmail && user.email && env.RESEND_API_KEY && env.RESEND_FROM_EMAIL) {
              const name = user.displayName || "there";
              const html = buildDigestNotificationEmailHtml(name, targetDate, notifContent);
              await sendEmail(env.RESEND_API_KEY, env.RESEND_FROM_EMAIL, {
                to: user.email,
                subject: `Your journal entry for ${targetDate} is ready`,
                html,
              }).catch((emailErr) => {
                console.error("Digest email notification failed:", emailErr);
              });
            }
          } catch {
            // Notification failure should not block other users
          }
        }
      } catch {
        // Skip this user, continue with others
      }
    }
  } catch (err) {
    await logProcessing(db, {
      id: crypto.randomUUID(),
      action: "digest_cron",
      status: "error",
      details: JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
    }).catch(() => {});
  }

  // ── Reminders ────────────────────────────────────────────────────
  let dailyQuip: string;
  try {
    dailyQuip = await getDailyQuip(env);
  } catch {
    dailyQuip = getFallbackQuip(new Date().toISOString().split("T")[0]);
  }
  const activeReminders = await getAllActiveReminders(db);

  // Batch-fetch all users and last entry dates to avoid N+1 queries
  const userIds = [...new Set(activeReminders.map((r) => r.userId))];
  const [usersArr, lastEntryDates] = await Promise.all([
    getUsersByIds(db, userIds),
    getLastEntryDatesByUserIds(db, userIds),
  ]);
  const usersMap = new Map(usersArr.map((u) => [u.id, u]));

  for (const reminder of activeReminders) {
    try {
      const user = usersMap.get(reminder.userId);
      const chatId = user?.telegramChatId;
      if (!user || !chatId) continue;

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
          const lastEntry = lastEntryDates[reminder.userId];
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
        dailyQuip,
        daysSinceLastEntry
      );

      const sent = await sendTelegramMessage(env, chatId, message);

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
            error: "Telegram delivery failed",
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

  // ── Habit Check-Ins ──────────────────────────────────────────────
  try {
    const habitsWithCheckin = await getActiveHabitsWithCheckinTime(db);
    if (habitsWithCheckin.length === 0) return;

    // Group habits by userId
    const habitsByUser = new Map<string, typeof habitsWithCheckin>();
    for (const habit of habitsWithCheckin) {
      const list = habitsByUser.get(habit.userId) ?? [];
      list.push(habit);
      habitsByUser.set(habit.userId, list);
    }

    // Fetch all users who have habits with check-in times
    const habitUserIds = [...habitsByUser.keys()];
    const habitUsersArr = await getUsersByIds(db, habitUserIds);
    const habitUsersMap = new Map(habitUsersArr.map((u) => [u.id, u]));

    for (const [userId, userHabits] of habitsByUser) {
      try {
        const user = habitUsersMap.get(userId);
        const chatId = user?.telegramChatId;
        if (!user || !chatId) continue;

        let timezone = user.timezone || "UTC";
        let local;
        try {
          local = getUserLocalTime(now, timezone);
        } catch {
          timezone = "UTC";
          local = getUserLocalTime(now, timezone);
        }

        // Filter habits whose checkinTime falls within the current 15-min window
        const dueHabits = userHabits.filter((h) =>
          timeMatches(h.checkinTime, local.hour, local.minute)
        );
        if (dueHabits.length === 0) continue;

        // Skip if a session is already active for this chat
        const sessionKey = `habit_checkin:${chatId}`;
        const existingSession = await env.KV.get(sessionKey);
        if (existingSession) continue;

        // Skip habits already answered today
        const todayLogs = await getHabitLogsForDate(db, userId, local.dateString);
        const answeredHabitIds = new Set(todayLogs.map((l) => l.habitId));
        const unansweredHabits = dueHabits.filter((h) => !answeredHabitIds.has(h.id));
        if (unansweredHabits.length === 0) continue;

        // Create KV session
        const session: HabitCheckinSession = {
          userId,
          habitIds: unansweredHabits.map((h) => h.id),
          questions: unansweredHabits.map((h) => h.question),
          names: unansweredHabits.map((h) => h.name),
          currentIndex: 0,
          answers: {},
          date: local.dateString,
        };
        await env.KV.put(sessionKey, JSON.stringify(session), { expirationTtl: 3600 });

        // Send first question
        await sendTelegramMessage(
          env,
          chatId,
          `Habit check-in time!\n\n${session.questions[0]}`
        );

        await logProcessing(db, {
          id: crypto.randomUUID(),
          action: "habit_checkin_started",
          status: "success",
          details: JSON.stringify({
            userId,
            habitCount: unansweredHabits.length,
            date: local.dateString,
          }),
        });
      } catch (err) {
        await logProcessing(db, {
          id: crypto.randomUUID(),
          action: "habit_checkin_started",
          status: "error",
          details: JSON.stringify({
            userId,
            error: err instanceof Error ? err.message : "Unknown error",
          }),
        }).catch(() => {});
      }
    }
  } catch (err) {
    await logProcessing(db, {
      id: crypto.randomUUID(),
      action: "habit_checkin_cron",
      status: "error",
      details: JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
    }).catch(() => {});
  }
}
