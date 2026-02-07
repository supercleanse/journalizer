import { describe, it, expect } from "vitest";
import { generatePdfWithImages, type ExportEntry, type PdfOptions, type HabitData } from "../src/services/export";
import type { HabitCheckinSession } from "../src/services/reminders";

function makeEntry(overrides: Partial<ExportEntry> = {}): ExportEntry {
  return {
    id: "test-id",
    entryDate: "2026-01-15",
    entryType: "text",
    source: "web",
    rawContent: "Test content",
    polishedContent: null,
    createdAt: "2026-01-15T15:30:00Z",
    media: [],
    imageData: new Map(),
    ...overrides,
  };
}

const defaultOptions: PdfOptions = {
  userName: "Test User",
  timezone: "America/Denver",
  startDate: "2026-01-15",
  endDate: "2026-01-15",
};

describe("HabitCheckinSession type", () => {
  it("has the expected shape", () => {
    const session: HabitCheckinSession = {
      userId: "user-1",
      habitIds: ["h1", "h2"],
      questions: ["Did you meditate?", "Did you exercise?"],
      names: ["Meditation", "Exercise"],
      currentIndex: 0,
      answers: {},
      date: "2026-01-15",
    };
    expect(session.habitIds).toHaveLength(2);
    expect(session.currentIndex).toBe(0);
    expect(session.answers).toEqual({});
  });

  it("tracks answers as they progress", () => {
    const session: HabitCheckinSession = {
      userId: "user-1",
      habitIds: ["h1", "h2"],
      questions: ["Did you meditate?", "Did you exercise?"],
      names: ["Meditation", "Exercise"],
      currentIndex: 0,
      answers: {},
      date: "2026-01-15",
    };

    // Simulate answering first question
    session.answers["h1"] = true;
    session.currentIndex = 1;
    expect(session.currentIndex).toBe(1);

    // Simulate answering second question
    session.answers["h2"] = false;
    session.currentIndex = 2;
    expect(session.currentIndex).toBe(2);
    expect(session.currentIndex >= session.habitIds.length).toBe(true);
  });
});

describe("yes/no response parsing", () => {
  const YES_RESPONSES = new Set(["y", "yes", "t", "true", "1"]);
  const NO_RESPONSES = new Set(["n", "no", "f", "false", "0"]);

  function parseResponse(text: string): "yes" | "no" | null {
    const normalized = text.trim().toLowerCase();
    if (YES_RESPONSES.has(normalized)) return "yes";
    if (NO_RESPONSES.has(normalized)) return "no";
    return null;
  }

  it("recognizes yes responses", () => {
    expect(parseResponse("y")).toBe("yes");
    expect(parseResponse("yes")).toBe("yes");
    expect(parseResponse("Y")).toBe("yes");
    expect(parseResponse("YES")).toBe("yes");
    expect(parseResponse("t")).toBe("yes");
    expect(parseResponse("true")).toBe("yes");
    expect(parseResponse("1")).toBe("yes");
  });

  it("recognizes no responses", () => {
    expect(parseResponse("n")).toBe("no");
    expect(parseResponse("no")).toBe("no");
    expect(parseResponse("N")).toBe("no");
    expect(parseResponse("NO")).toBe("no");
    expect(parseResponse("f")).toBe("no");
    expect(parseResponse("false")).toBe("no");
    expect(parseResponse("0")).toBe("no");
  });

  it("rejects unrecognized responses", () => {
    expect(parseResponse("maybe")).toBeNull();
    expect(parseResponse("")).toBeNull();
    expect(parseResponse("hello")).toBeNull();
    expect(parseResponse("2")).toBeNull();
  });

  it("handles whitespace in responses", () => {
    expect(parseResponse("  yes  ")).toBe("yes");
    expect(parseResponse("  n  ")).toBe("no");
  });
});

describe("PDF habit export - short exports (<=7 days)", () => {
  it("includes habit grid in short exports", () => {
    const habitData: HabitData = {
      habits: [
        { id: "h1", name: "Meditation" },
        { id: "h2", name: "Exercise" },
      ],
      logsByDate: {
        "2026-01-15": { h1: true, h2: false },
      },
    };

    const entries = [makeEntry()];
    const result = generatePdfWithImages(entries, { ...defaultOptions, habitData });
    const text = new TextDecoder().decode(result);

    expect(text).toContain("--- Habits ---");
    expect(text).toContain("[x] Meditation");
    expect(text).toContain("[ ] Exercise");
  });

  it("does not include habit summary in short exports", () => {
    const habitData: HabitData = {
      habits: [{ id: "h1", name: "Meditation" }],
      logsByDate: { "2026-01-15": { h1: true } },
    };

    const result = generatePdfWithImages([makeEntry()], { ...defaultOptions, habitData });
    const text = new TextDecoder().decode(result);

    expect(text).not.toContain("Habit Summary");
  });

  it("omits habit grid when no logs for a date", () => {
    const habitData: HabitData = {
      habits: [{ id: "h1", name: "Meditation" }],
      logsByDate: {},
    };

    const result = generatePdfWithImages([makeEntry()], { ...defaultOptions, habitData });
    const text = new TextDecoder().decode(result);

    expect(text).not.toContain("--- Habits ---");
  });
});

describe("PDF habit export - long exports (>7 days)", () => {
  it("includes habit summary in long exports", () => {
    // Create entries spanning more than 7 unique dates
    const entries: ExportEntry[] = [];
    const logsByDate: Record<string, Record<string, boolean>> = {};

    for (let d = 1; d <= 10; d++) {
      const date = `2026-01-${String(d).padStart(2, "0")}`;
      entries.push(makeEntry({ id: `entry-${d}`, entryDate: date }));
      logsByDate[date] = { h1: d % 2 === 0 }; // completed every other day
    }

    const habitData: HabitData = {
      habits: [{ id: "h1", name: "Meditation" }],
      logsByDate,
    };

    const result = generatePdfWithImages(entries, {
      userName: "Test User",
      timezone: "America/Denver",
      startDate: "2026-01-01",
      endDate: "2026-01-10",
      habitData,
    });
    const text = new TextDecoder().decode(result);

    expect(text).toContain("Habit Summary");
    expect(text).toContain("Meditation: 5/10 days");
    expect(text).toContain("50%");
  });

  it("does not include daily habit grid in long exports", () => {
    const entries: ExportEntry[] = [];
    const logsByDate: Record<string, Record<string, boolean>> = {};

    for (let d = 1; d <= 10; d++) {
      const date = `2026-01-${String(d).padStart(2, "0")}`;
      entries.push(makeEntry({ id: `entry-${d}`, entryDate: date }));
      logsByDate[date] = { h1: true };
    }

    const habitData: HabitData = {
      habits: [{ id: "h1", name: "Meditation" }],
      logsByDate,
    };

    const result = generatePdfWithImages(entries, {
      userName: "Test User",
      timezone: "America/Denver",
      startDate: "2026-01-01",
      endDate: "2026-01-10",
      habitData,
    });
    const text = new TextDecoder().decode(result);

    expect(text).not.toContain("--- Habits ---");
  });
});

describe("PDF without habit data", () => {
  it("renders normally without habit data", () => {
    const result = generatePdfWithImages([makeEntry()], defaultOptions);
    const text = new TextDecoder().decode(result);

    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.endsWith("%%EOF")).toBe(true);
    expect(text).not.toContain("--- Habits ---");
    expect(text).not.toContain("Habit Summary");
  });
});
