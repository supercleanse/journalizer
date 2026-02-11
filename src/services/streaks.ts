import type { Database } from "../db/index";
import { getHabitLogsForHabit, getRecentEntryDates } from "../db/queries";

// Glass contract: failure modes
export { DatabaseError } from "../lib/errors";

export interface HabitStreakData {
  currentStreak: number;
  consecutiveMisses: number;
  totalCompletions: number;
  totalDays: number;
}

export interface JournalStreakData {
  currentStreak: number;
  daysSinceLastEntry: number;
}

/**
 * Compute streak data for a specific habit.
 * Analyzes logs in reverse chronological order from asOfDate.
 */
export async function getHabitStreak(
  db: Database,
  habitId: string,
  _userId: string,
  asOfDate: string
): Promise<HabitStreakData> {
  const logs = await getHabitLogsForHabit(db, habitId, 60);

  if (logs.length === 0) {
    return { currentStreak: 0, consecutiveMisses: 0, totalCompletions: 0, totalDays: 0 };
  }

  // Build a map of date -> completed
  const logMap = new Map<string, boolean>();
  for (const log of logs) {
    logMap.set(log.logDate, log.completed === 1);
  }

  let totalCompletions = 0;
  for (const log of logs) {
    if (log.completed === 1) totalCompletions++;
  }

  // Walk backwards from asOfDate to compute current streak / consecutive misses
  let currentStreak = 0;
  let consecutiveMisses = 0;
  let streakType: "completed" | "missed" | null = null;

  const date = new Date(asOfDate + "T00:00:00Z");
  for (let i = 0; i < 60; i++) {
    const dateStr = date.toISOString().slice(0, 10);
    const completed = logMap.get(dateStr);

    if (completed === undefined) {
      // No log for this date — skip if no streak started, break if one has
      if (streakType === null) {
        // Keep looking back for the first logged day
        date.setUTCDate(date.getUTCDate() - 1);
        continue;
      }
      // A gap in logged days breaks the streak
      break;
    } else if (completed) {
      if (streakType === null) {
        streakType = "completed";
        currentStreak = 1;
      } else if (streakType === "completed") {
        currentStreak++;
      } else {
        break;
      }
    } else {
      // completed === false (explicitly missed)
      if (streakType === null) {
        streakType = "missed";
        consecutiveMisses = 1;
      } else if (streakType === "missed") {
        consecutiveMisses++;
      } else {
        break;
      }
    }

    date.setUTCDate(date.getUTCDate() - 1);
  }

  return {
    currentStreak,
    consecutiveMisses,
    totalCompletions,
    totalDays: logs.length,
  };
}

/**
 * Compute journal entry streak data.
 * Counts consecutive days with entries from asOfDate backwards.
 */
export async function getJournalStreak(
  db: Database,
  userId: string,
  asOfDate: string
): Promise<JournalStreakData> {
  const entryDates = await getRecentEntryDates(db, userId, 60);

  if (entryDates.length === 0) {
    return { currentStreak: 0, daysSinceLastEntry: 999 };
  }

  const dateSet = new Set(entryDates);

  // Days since last entry
  const daysSinceLastEntry = dateSet.has(asOfDate)
    ? 0
    : Math.floor(
        (new Date(asOfDate + "T00:00:00Z").getTime() -
          new Date(entryDates[0] + "T00:00:00Z").getTime()) /
          (1000 * 60 * 60 * 24)
      );

  // Walk backwards from asOfDate to count consecutive days with entries
  let currentStreak = 0;
  const date = new Date(asOfDate + "T00:00:00Z");
  for (let i = 0; i < 60; i++) {
    const dateStr = date.toISOString().slice(0, 10);
    if (dateSet.has(dateStr)) {
      currentStreak++;
    } else {
      break;
    }
    date.setUTCDate(date.getUTCDate() - 1);
  }

  return { currentStreak, daysSinceLastEntry };
}
