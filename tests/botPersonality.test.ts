import { describe, it, expect } from "vitest";
import {
  getStaticHabitResponse,
  getStaticJournalReminder,
  type BotPersonality,
} from "../src/services/botPersonality";

describe("getStaticHabitResponse", () => {
  const personalities: BotPersonality[] = ["encouraging", "drill_sergeant", "chill", "coach"];

  it("returns a non-empty string for all personalities on completion", () => {
    for (const personality of personalities) {
      const response = getStaticHabitResponse({
        habitName: "Meditation",
        completed: true,
        currentStreak: 5,
        consecutiveMisses: 0,
        personality,
      });
      expect(response).toBeTruthy();
      expect(typeof response).toBe("string");
      expect(response.length).toBeGreaterThan(0);
    }
  });

  it("returns a non-empty string for all personalities on miss", () => {
    for (const personality of personalities) {
      const response = getStaticHabitResponse({
        habitName: "Exercise",
        completed: false,
        currentStreak: 0,
        consecutiveMisses: 2,
        personality,
      });
      expect(response).toBeTruthy();
    }
  });

  it("mentions streak count for multi-day streaks on completion", () => {
    const response = getStaticHabitResponse({
      habitName: "Reading",
      completed: true,
      currentStreak: 10,
      consecutiveMisses: 0,
      personality: "encouraging",
    });
    expect(response).toContain("10");
  });

  it("uses different tone for drill_sergeant vs encouraging on miss", () => {
    const encouraging = getStaticHabitResponse({
      habitName: "Exercise",
      completed: false,
      currentStreak: 0,
      consecutiveMisses: 5,
      personality: "encouraging",
    });
    const drillSergeant = getStaticHabitResponse({
      habitName: "Exercise",
      completed: false,
      currentStreak: 0,
      consecutiveMisses: 5,
      personality: "drill_sergeant",
    });
    expect(encouraging).not.toBe(drillSergeant);
  });

  it("mentions miss count for high consecutive misses", () => {
    const response = getStaticHabitResponse({
      habitName: "Exercise",
      completed: false,
      currentStreak: 0,
      consecutiveMisses: 5,
      personality: "coach",
    });
    expect(response).toContain("5");
  });

  it("handles first-day completion (streak = 1)", () => {
    const response = getStaticHabitResponse({
      habitName: "Exercise",
      completed: true,
      currentStreak: 1,
      consecutiveMisses: 0,
      personality: "encouraging",
    });
    expect(response).toBeTruthy();
    expect(response).not.toContain("in a row");
  });
});

describe("getStaticJournalReminder", () => {
  const personalities: BotPersonality[] = ["encouraging", "drill_sergeant", "chill", "coach"];

  it("returns a non-empty string for all personalities with active streak", () => {
    for (const personality of personalities) {
      const response = getStaticJournalReminder({
        journalStreak: 5,
        daysSinceLastEntry: 0,
        personality,
      });
      expect(response).toBeTruthy();
    }
  });

  it("returns a non-empty string for all personalities with gap", () => {
    for (const personality of personalities) {
      const response = getStaticJournalReminder({
        journalStreak: 0,
        daysSinceLastEntry: 5,
        personality,
      });
      expect(response).toBeTruthy();
    }
  });

  it("mentions gap days for large gaps", () => {
    const response = getStaticJournalReminder({
      journalStreak: 0,
      daysSinceLastEntry: 10,
      personality: "encouraging",
    });
    expect(response).toContain("10");
  });

  it("mentions streak for active streaks", () => {
    const response = getStaticJournalReminder({
      journalStreak: 7,
      daysSinceLastEntry: 1,
      personality: "coach",
    });
    expect(response).toContain("7");
  });

  it("drill_sergeant is more aggressive than chill", () => {
    const drill = getStaticJournalReminder({
      journalStreak: 0,
      daysSinceLastEntry: 5,
      personality: "drill_sergeant",
    });
    const chill = getStaticJournalReminder({
      journalStreak: 0,
      daysSinceLastEntry: 5,
      personality: "chill",
    });
    expect(drill).not.toBe(chill);
    // Drill sergeant should be more demanding
    expect(drill.toLowerCase()).toMatch(/awol|report|now/i);
  });
});

describe("BotPersonality type", () => {
  it("accepts all valid personalities", () => {
    const valid: BotPersonality[] = ["encouraging", "drill_sergeant", "chill", "coach"];
    expect(valid).toHaveLength(4);
  });
});
