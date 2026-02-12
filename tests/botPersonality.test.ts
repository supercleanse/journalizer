import { describe, it, expect } from "vitest";
import {
  getStaticHabitResponse,
  getStaticJournalReminder,
  getStaticEntrySavedAck,
  getStaticTranscriptionCompleteMsg,
  getStaticCancelMsg,
  getStaticInvalidResponseMsg,
  getStaticCleanupOffer,
  getStaticCleanupResponse,
  getStaticCheckinSummaryLine,
  getStaticCheckinIntro,
  resolvePersonality,
  sanitizeJournalContent,
  generateAccountabilityInsight,
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

describe("resolvePersonality", () => {
  it("returns valid personality strings as-is", () => {
    expect(resolvePersonality("drill_sergeant")).toBe("drill_sergeant");
    expect(resolvePersonality("chill")).toBe("chill");
    expect(resolvePersonality("coach")).toBe("coach");
    expect(resolvePersonality("encouraging")).toBe("encouraging");
  });

  it("returns encouraging for null/undefined/invalid", () => {
    expect(resolvePersonality(null)).toBe("encouraging");
    expect(resolvePersonality(undefined)).toBe("encouraging");
    expect(resolvePersonality("invalid")).toBe("encouraging");
    expect(resolvePersonality("")).toBe("encouraging");
  });
});

describe("sanitizeJournalContent", () => {
  it("preserves newlines and tabs", () => {
    expect(sanitizeJournalContent("line1\nline2\ttab")).toBe("line1\nline2\ttab");
  });

  it("strips dangerous control characters", () => {
    expect(sanitizeJournalContent("abc\x00def\x01ghi")).toBe("abcdefghi");
  });

  it("truncates to specified max length", () => {
    const long = "a".repeat(300);
    expect(sanitizeJournalContent(long, 100).length).toBe(100);
  });
});

describe("getStaticEntrySavedAck", () => {
  const personalities: BotPersonality[] = ["encouraging", "drill_sergeant", "chill", "coach"];

  it("returns non-empty string for all personalities and entry types", () => {
    for (const p of personalities) {
      for (const t of ["text", "audio", "video", "photo"]) {
        const msg = getStaticEntrySavedAck(p, t);
        expect(msg).toBeTruthy();
        expect(typeof msg).toBe("string");
      }
    }
  });

  it("mentions media processing for audio/video", () => {
    const msg = getStaticEntrySavedAck("encouraging", "audio");
    expect(msg.toLowerCase()).toMatch(/processing|media/);
  });
});

describe("getStaticTranscriptionCompleteMsg", () => {
  const personalities: BotPersonality[] = ["encouraging", "drill_sergeant", "chill", "coach"];

  it("returns non-empty string for all personalities and outcomes", () => {
    for (const p of personalities) {
      expect(getStaticTranscriptionCompleteMsg(p, true)).toBeTruthy();
      expect(getStaticTranscriptionCompleteMsg(p, false)).toBeTruthy();
    }
  });

  it("differentiates success and failure messages", () => {
    const success = getStaticTranscriptionCompleteMsg("encouraging", true);
    const failure = getStaticTranscriptionCompleteMsg("encouraging", false);
    expect(success).not.toBe(failure);
  });
});

describe("getStaticCancelMsg", () => {
  const personalities: BotPersonality[] = ["encouraging", "drill_sergeant", "chill", "coach"];

  it("returns non-empty string for all personalities", () => {
    for (const p of personalities) {
      expect(getStaticCancelMsg(p)).toBeTruthy();
    }
  });
});

describe("getStaticInvalidResponseMsg", () => {
  const personalities: BotPersonality[] = ["encouraging", "drill_sergeant", "chill", "coach"];

  it("returns non-empty string for all personalities", () => {
    for (const p of personalities) {
      expect(getStaticInvalidResponseMsg(p)).toBeTruthy();
    }
  });
});

describe("getStaticCleanupOffer", () => {
  const personalities: BotPersonality[] = ["encouraging", "drill_sergeant", "chill", "coach"];

  it("returns non-empty string for all personalities", () => {
    for (const p of personalities) {
      expect(getStaticCleanupOffer(p, "Exercise", 10)).toBeTruthy();
    }
  });

  it("includes habit name and miss count", () => {
    const msg = getStaticCleanupOffer("encouraging", "Meditation", 8);
    expect(msg).toContain("Meditation");
    expect(msg).toContain("8");
  });
});

describe("getStaticCleanupResponse", () => {
  const personalities: BotPersonality[] = ["encouraging", "drill_sergeant", "chill", "coach"];

  it("returns non-empty string for deactivate and keep", () => {
    for (const p of personalities) {
      expect(getStaticCleanupResponse(p, "Running", "deactivated")).toBeTruthy();
      expect(getStaticCleanupResponse(p, "Running", "kept")).toBeTruthy();
    }
  });

  it("differentiates deactivated and kept messages", () => {
    const deactivated = getStaticCleanupResponse("encouraging", "Running", "deactivated");
    const kept = getStaticCleanupResponse("encouraging", "Running", "kept");
    expect(deactivated).not.toBe(kept);
  });
});

describe("getStaticCheckinSummaryLine", () => {
  const personalities: BotPersonality[] = ["encouraging", "drill_sergeant", "chill", "coach"];

  it("returns non-empty string for all personalities", () => {
    for (const p of personalities) {
      expect(getStaticCheckinSummaryLine(p)).toBeTruthy();
    }
  });
});

describe("getStaticCheckinIntro", () => {
  const personalities: BotPersonality[] = ["encouraging", "drill_sergeant", "chill", "coach"];

  it("returns non-empty string for all personalities", () => {
    for (const p of personalities) {
      expect(getStaticCheckinIntro(p, 3)).toBeTruthy();
    }
  });

  it("includes habit count", () => {
    for (const p of personalities) {
      expect(getStaticCheckinIntro(p, 5)).toContain("5");
    }
  });

  it("handles singular habit count", () => {
    const msg = getStaticCheckinIntro("drill_sergeant", 1);
    expect(msg).toContain("1 habit ");
    expect(msg).not.toContain("habits");
  });
});

describe("generateAccountabilityInsight", () => {
  it("returns null for empty snippets", async () => {
    const result = await generateAccountabilityInsight("fake-key", {
      personality: "encouraging",
      recentEntrySnippets: [],
      activeHabitNames: ["Exercise"],
    });
    expect(result).toBeNull();
  });
});
