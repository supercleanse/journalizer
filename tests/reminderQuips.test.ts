import { describe, it, expect } from "vitest";
import { FALLBACK_QUIPS, getFallbackQuip } from "../src/services/reminderQuips";

describe("FALLBACK_QUIPS", () => {
  it("has at least 50 quips", () => {
    expect(FALLBACK_QUIPS.length).toBeGreaterThanOrEqual(50);
  });

  it("all quips are non-empty strings", () => {
    for (const quip of FALLBACK_QUIPS) {
      expect(typeof quip).toBe("string");
      expect(quip.trim().length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate quips", () => {
    const unique = new Set(FALLBACK_QUIPS);
    expect(unique.size).toBe(FALLBACK_QUIPS.length);
  });
});

describe("getFallbackQuip", () => {
  it("returns a quip from the fallback list", () => {
    const quip = getFallbackQuip("2025-06-15");
    expect(FALLBACK_QUIPS).toContain(quip);
  });

  it("returns different quips for different dates", () => {
    const quips = new Set<string>();
    for (let d = 1; d <= 10; d++) {
      quips.add(getFallbackQuip(`2025-01-${String(d).padStart(2, "0")}`));
    }
    // At least some should be different (with 50 quips, 10 consecutive days should yield variety)
    expect(quips.size).toBeGreaterThan(1);
  });

  it("returns the same quip for the same date", () => {
    const a = getFallbackQuip("2025-03-20");
    const b = getFallbackQuip("2025-03-20");
    expect(a).toBe(b);
  });

  it("wraps around when day-of-year exceeds quip count", () => {
    // Day 365 should still return a valid quip
    const quip = getFallbackQuip("2025-12-31");
    expect(FALLBACK_QUIPS).toContain(quip);
  });
});
