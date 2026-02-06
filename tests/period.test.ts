import { describe, it, expect } from "vitest";
import {
  calculatePeriodDates,
  getNextDate,
  isDue,
  formatDateStr,
  getAlignedSendDate,
  getTrailingPeriod,
  advanceAlignedDate,
} from "../src/lib/period";

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

describe("getAlignedSendDate", () => {
  it("weekly from Wednesday → next Monday", () => {
    // 2026-02-04 is a Wednesday
    expect(getAlignedSendDate("weekly", "2026-02-04")).toBe("2026-02-09");
  });

  it("weekly from Sunday → next Monday", () => {
    // 2026-02-08 is a Sunday
    expect(getAlignedSendDate("weekly", "2026-02-08")).toBe("2026-02-09");
  });

  it("weekly from Monday → next Monday (not today)", () => {
    // 2026-02-09 is a Monday
    expect(getAlignedSendDate("weekly", "2026-02-09")).toBe("2026-02-16");
  });

  it("monthly → 1st of next month", () => {
    expect(getAlignedSendDate("monthly", "2026-02-15")).toBe("2026-03-01");
  });

  it("quarterly from Feb → Apr 1", () => {
    expect(getAlignedSendDate("quarterly", "2026-02-15")).toBe("2026-04-01");
  });

  it("quarterly from Dec → Jan 1 next year", () => {
    expect(getAlignedSendDate("quarterly", "2026-12-15")).toBe("2027-01-01");
  });

  it("yearly → Jan 1 of next year", () => {
    expect(getAlignedSendDate("yearly", "2026-06-15")).toBe("2027-01-01");
  });
});

describe("getTrailingPeriod", () => {
  it("weekly Monday → previous Mon-Sun", () => {
    const { start, end } = getTrailingPeriod("weekly", "2026-02-09");
    expect(start).toBe("2026-02-02");
    expect(end).toBe("2026-02-08");
  });

  it("monthly 1st → previous month", () => {
    const { start, end } = getTrailingPeriod("monthly", "2026-03-01");
    expect(start).toBe("2026-02-01");
    expect(end).toBe("2026-02-28");
  });

  it("monthly Jan 1 → previous December", () => {
    const { start, end } = getTrailingPeriod("monthly", "2026-01-01");
    expect(start).toBe("2025-12-01");
    expect(end).toBe("2025-12-31");
  });

  it("quarterly Apr 1 → Jan-Mar", () => {
    const { start, end } = getTrailingPeriod("quarterly", "2026-04-01");
    expect(start).toBe("2026-01-01");
    expect(end).toBe("2026-03-31");
  });

  it("quarterly Jan 1 → previous Oct-Dec", () => {
    const { start, end } = getTrailingPeriod("quarterly", "2026-01-01");
    expect(start).toBe("2025-10-01");
    expect(end).toBe("2025-12-31");
  });

  it("yearly Jan 1 → previous year", () => {
    const { start, end } = getTrailingPeriod("yearly", "2027-01-01");
    expect(start).toBe("2026-01-01");
    expect(end).toBe("2026-12-31");
  });
});

describe("advanceAlignedDate", () => {
  it("weekly advances by 7 days", () => {
    expect(advanceAlignedDate("weekly", "2026-02-09")).toBe("2026-02-16");
  });

  it("monthly advances to 1st of next month", () => {
    expect(advanceAlignedDate("monthly", "2026-02-01")).toBe("2026-03-01");
  });

  it("quarterly advances by 3 months", () => {
    expect(advanceAlignedDate("quarterly", "2026-04-01")).toBe("2026-07-01");
  });

  it("yearly advances to next Jan 1", () => {
    expect(advanceAlignedDate("yearly", "2026-01-01")).toBe("2027-01-01");
  });
});
