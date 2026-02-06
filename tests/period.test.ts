import { describe, it, expect } from "vitest";
import { calculatePeriodDates, getNextDate, isDue, formatDateStr } from "../src/lib/period";

describe("calculatePeriodDates", () => {
  it("calculates weekly period", () => {
    const { start, end } = calculatePeriodDates("weekly", "2026-01-05");
    expect(start).toBe("2026-01-05");
    expect(end).toBe("2026-01-11");
  });

  it("calculates monthly period", () => {
    const { start, end } = calculatePeriodDates("monthly", "2026-01-01");
    expect(start).toBe("2026-01-01");
    expect(end).toBe("2026-01-31");
  });

  it("calculates monthly period crossing year boundary", () => {
    const { start, end } = calculatePeriodDates("monthly", "2026-12-01");
    expect(start).toBe("2026-12-01");
    expect(end).toBe("2026-12-31");
  });

  it("calculates quarterly period", () => {
    const { start, end } = calculatePeriodDates("quarterly", "2026-01-01");
    expect(start).toBe("2026-01-01");
    expect(end).toBe("2026-03-31");
  });

  it("calculates yearly period", () => {
    const { start, end } = calculatePeriodDates("yearly", "2026-01-01");
    expect(start).toBe("2026-01-01");
    expect(end).toBe("2026-12-31");
  });

  it("clamps monthly period when start day exceeds next month length", () => {
    // Jan 31 → Feb only has 28 days, should not overflow into March
    const { start, end } = calculatePeriodDates("monthly", "2026-01-31");
    expect(start).toBe("2026-01-31");
    expect(end).toBe("2026-02-27");
  });

  it("clamps quarterly period for short months", () => {
    // Nov 30 → target month is Feb which has 28 days
    const { start, end } = calculatePeriodDates("quarterly", "2026-11-30");
    expect(start).toBe("2026-11-30");
    expect(end).toBe("2027-02-27");
  });

  it("returns same date for unknown frequency", () => {
    const { start, end } = calculatePeriodDates("biweekly", "2026-01-01");
    expect(start).toBe("2026-01-01");
    expect(end).toBe("2026-01-01");
  });
});

describe("getNextDate", () => {
  it("returns the day after the end date", () => {
    expect(getNextDate("weekly", "2026-01-11")).toBe("2026-01-12");
  });

  it("handles month boundaries", () => {
    expect(getNextDate("monthly", "2026-01-31")).toBe("2026-02-01");
  });

  it("handles year boundaries", () => {
    expect(getNextDate("yearly", "2026-12-31")).toBe("2027-01-01");
  });
});

describe("isDue", () => {
  it("returns false for null", () => {
    expect(isDue(null)).toBe(false);
  });

  it("returns true for past date", () => {
    expect(isDue("2020-01-01")).toBe(true);
  });

  it("returns false for far future date", () => {
    expect(isDue("2099-01-01")).toBe(false);
  });

  it("returns true for today", () => {
    const today = new Date().toISOString().split("T")[0];
    expect(isDue(today)).toBe(true);
  });
});

describe("formatDateStr", () => {
  it("formats a date as YYYY-MM-DD", () => {
    const d = new Date("2026-03-15T00:00:00Z");
    expect(formatDateStr(d)).toBe("2026-03-15");
  });
});
