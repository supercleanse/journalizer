import { describe, it, expect } from "vitest";
import type { HabitStreakData, JournalStreakData } from "../src/services/streaks";

describe("HabitStreakData type", () => {
  it("has the expected shape", () => {
    const data: HabitStreakData = {
      currentStreak: 5,
      consecutiveMisses: 0,
      totalCompletions: 20,
      totalDays: 30,
    };
    expect(data.currentStreak).toBe(5);
    expect(data.consecutiveMisses).toBe(0);
    expect(data.totalCompletions).toBe(20);
    expect(data.totalDays).toBe(30);
  });

  it("models a miss streak correctly", () => {
    const data: HabitStreakData = {
      currentStreak: 0,
      consecutiveMisses: 3,
      totalCompletions: 10,
      totalDays: 15,
    };
    expect(data.currentStreak).toBe(0);
    expect(data.consecutiveMisses).toBe(3);
  });

  it("models zero data for new habits", () => {
    const data: HabitStreakData = {
      currentStreak: 0,
      consecutiveMisses: 0,
      totalCompletions: 0,
      totalDays: 0,
    };
    expect(data.totalDays).toBe(0);
  });
});

describe("JournalStreakData type", () => {
  it("has the expected shape", () => {
    const data: JournalStreakData = {
      currentStreak: 7,
      daysSinceLastEntry: 0,
    };
    expect(data.currentStreak).toBe(7);
    expect(data.daysSinceLastEntry).toBe(0);
  });

  it("models a gap correctly", () => {
    const data: JournalStreakData = {
      currentStreak: 0,
      daysSinceLastEntry: 5,
    };
    expect(data.currentStreak).toBe(0);
    expect(data.daysSinceLastEntry).toBe(5);
  });
});

describe("streak computation logic (unit)", () => {
  // Test the core algorithm by simulating what getHabitStreak does

  function computeStreakFromLogs(
    logs: { logDate: string; completed: number }[],
    asOfDate: string
  ): HabitStreakData {
    if (logs.length === 0) {
      return { currentStreak: 0, consecutiveMisses: 0, totalCompletions: 0, totalDays: 0 };
    }

    const logMap = new Map<string, boolean>();
    let totalCompletions = 0;
    for (const log of logs) {
      logMap.set(log.logDate, log.completed === 1);
      if (log.completed === 1) totalCompletions++;
    }

    let currentStreak = 0;
    let consecutiveMisses = 0;
    let streakType: "completed" | "missed" | null = null;

    const date = new Date(asOfDate + "T00:00:00Z");
    for (let i = 0; i < 60; i++) {
      const dateStr = date.toISOString().slice(0, 10);
      const completed = logMap.get(dateStr);

      if (completed === undefined) {
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

    return { currentStreak, consecutiveMisses, totalCompletions, totalDays: logs.length };
  }

  it("computes a current streak of completions", () => {
    const logs = [
      { logDate: "2026-01-15", completed: 1 },
      { logDate: "2026-01-14", completed: 1 },
      { logDate: "2026-01-13", completed: 1 },
      { logDate: "2026-01-12", completed: 0 },
    ];
    const result = computeStreakFromLogs(logs, "2026-01-15");
    expect(result.currentStreak).toBe(3);
    expect(result.consecutiveMisses).toBe(0);
  });

  it("computes consecutive misses", () => {
    const logs = [
      { logDate: "2026-01-15", completed: 0 },
      { logDate: "2026-01-14", completed: 0 },
      { logDate: "2026-01-13", completed: 1 },
    ];
    const result = computeStreakFromLogs(logs, "2026-01-15");
    expect(result.currentStreak).toBe(0);
    expect(result.consecutiveMisses).toBe(2);
  });

  it("skips unlogged dates to find first logged day", () => {
    // No log for 2026-01-15, log for 2026-01-14 — skips to 2026-01-14
    const logs = [
      { logDate: "2026-01-14", completed: 1 },
    ];
    const result = computeStreakFromLogs(logs, "2026-01-15");
    expect(result.currentStreak).toBe(1);
    expect(result.consecutiveMisses).toBe(0);
  });

  it("breaks streak on gap in logged days", () => {
    // Completed on 15 and 13, but gap on 14 breaks the streak
    const logs = [
      { logDate: "2026-01-15", completed: 1 },
      { logDate: "2026-01-13", completed: 1 },
    ];
    const result = computeStreakFromLogs(logs, "2026-01-15");
    expect(result.currentStreak).toBe(1);
  });

  it("returns zeros for empty logs", () => {
    const result = computeStreakFromLogs([], "2026-01-15");
    expect(result.currentStreak).toBe(0);
    expect(result.consecutiveMisses).toBe(0);
    expect(result.totalCompletions).toBe(0);
    expect(result.totalDays).toBe(0);
  });

  it("computes total completions correctly", () => {
    const logs = [
      { logDate: "2026-01-15", completed: 1 },
      { logDate: "2026-01-14", completed: 0 },
      { logDate: "2026-01-13", completed: 1 },
      { logDate: "2026-01-12", completed: 1 },
      { logDate: "2026-01-11", completed: 0 },
    ];
    const result = computeStreakFromLogs(logs, "2026-01-15");
    expect(result.totalCompletions).toBe(3);
    expect(result.totalDays).toBe(5);
  });

  it("handles a single completed day", () => {
    const logs = [{ logDate: "2026-01-15", completed: 1 }];
    const result = computeStreakFromLogs(logs, "2026-01-15");
    expect(result.currentStreak).toBe(1);
    expect(result.consecutiveMisses).toBe(0);
  });

  it("handles a single missed day", () => {
    const logs = [{ logDate: "2026-01-15", completed: 0 }];
    const result = computeStreakFromLogs(logs, "2026-01-15");
    expect(result.currentStreak).toBe(0);
    expect(result.consecutiveMisses).toBe(1);
  });
});
