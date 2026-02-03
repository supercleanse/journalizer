import { describe, it, expect } from "vitest";

// Test the reminder matching logic extracted from src/services/reminders.ts

function timeMatches(
  reminderTime: string | null,
  localHour: number,
  localMinute: number
): boolean {
  if (!reminderTime) return false;
  const [rh, rm] = reminderTime.split(":").map(Number);
  const reminderMinutes = rh * 60 + rm;
  const currentMinutes = localHour * 60 + localMinute;
  return (
    reminderMinutes >= currentMinutes && reminderMinutes < currentMinutes + 15
  );
}

function selectMessage(
  reminderType: string,
  reminderId: string,
  daysSinceLastEntry?: number
): string {
  const DAILY_MESSAGES = [
    "Hey! What happened today? Just reply to this message.",
    "Quick check-in: How's your day going? Reply with anything.",
    "Time for your daily journal! What's on your mind?",
    "Your daily writing prompt: What was the highlight of your day?",
    "A moment to reflect — reply with whatever comes to mind.",
  ];

  const SMART_NUDGE_TEMPLATE = (days: number) =>
    `It's been ${days} day${days === 1 ? "" : "s"} since your last entry. No pressure, but we're here when you're ready!`;

  if (reminderType === "smart" && daysSinceLastEntry !== undefined) {
    return SMART_NUDGE_TEMPLATE(daysSinceLastEntry);
  }

  let hash = 0;
  for (let i = 0; i < reminderId.length; i++) {
    hash = (hash * 31 + reminderId.charCodeAt(i)) | 0;
  }
  const today = new Date().toISOString().split("T")[0];
  for (let i = 0; i < today.length; i++) {
    hash = (hash * 31 + today.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % DAILY_MESSAGES.length;
  return DAILY_MESSAGES[idx];
}

describe("timeMatches", () => {
  it("matches when reminder time is in the 15-minute window", () => {
    expect(timeMatches("09:00", 9, 0)).toBe(true);
    expect(timeMatches("09:05", 9, 0)).toBe(true);
    expect(timeMatches("09:14", 9, 0)).toBe(true);
  });

  it("does not match when reminder time is outside the window", () => {
    expect(timeMatches("09:15", 9, 0)).toBe(false);
    expect(timeMatches("08:59", 9, 0)).toBe(false);
    expect(timeMatches("10:00", 9, 0)).toBe(false);
  });

  it("handles null reminder time", () => {
    expect(timeMatches(null, 9, 0)).toBe(false);
  });

  it("handles midnight", () => {
    expect(timeMatches("00:00", 0, 0)).toBe(true);
    expect(timeMatches("23:50", 23, 45)).toBe(true);
  });

  it("handles boundary at end of day", () => {
    expect(timeMatches("23:59", 23, 45)).toBe(true);
    expect(timeMatches("23:45", 23, 45)).toBe(true);
  });
});

describe("selectMessage", () => {
  it("returns a smart nudge message with day count", () => {
    const msg = selectMessage("smart", "reminder-1", 5);
    expect(msg).toContain("5 days");
    expect(msg).toContain("since your last entry");
  });

  it("handles singular day in smart nudge", () => {
    const msg = selectMessage("smart", "reminder-1", 1);
    expect(msg).toContain("1 day ");
    expect(msg).not.toContain("1 days");
  });

  it("returns a daily message for non-smart types", () => {
    const msg = selectMessage("daily", "reminder-abc");
    expect(typeof msg).toBe("string");
    expect(msg.length).toBeGreaterThan(10);
  });

  it("returns same message for same reminder on same day (deterministic)", () => {
    const msg1 = selectMessage("daily", "test-id-123");
    const msg2 = selectMessage("daily", "test-id-123");
    expect(msg1).toBe(msg2);
  });

  it("returns different messages for different reminder IDs", () => {
    // Not guaranteed but highly likely with different IDs
    const messages = new Set<string>();
    for (let i = 0; i < 10; i++) {
      messages.add(selectMessage("daily", `reminder-${i}-${Math.random()}`));
    }
    expect(messages.size).toBeGreaterThan(1);
  });
});
