/**
 * Shared period calculation utilities for recurring subscriptions.
 * Used by both printScheduler and emailScheduler.
 */

export function calculatePeriodDates(
  frequency: string,
  fromDate: string
): { start: string; end: string } {
  const from = new Date(fromDate + "T00:00:00Z");

  switch (frequency) {
    case "weekly": {
      const start = new Date(from);
      const end = new Date(from);
      end.setUTCDate(end.getUTCDate() + 6);
      return { start: formatDateStr(start), end: formatDateStr(end) };
    }
    case "monthly": {
      const start = new Date(from);
      const lastDayOfNextMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 2, 0)).getUTCDate();
      const endDay = Math.min(start.getUTCDate(), lastDayOfNextMonth);
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, endDay));
      end.setUTCDate(end.getUTCDate() - 1);
      return { start: formatDateStr(start), end: formatDateStr(end) };
    }
    case "quarterly": {
      const start = new Date(from);
      const lastDayOfTargetMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 4, 0)).getUTCDate();
      const endDay = Math.min(start.getUTCDate(), lastDayOfTargetMonth);
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, endDay));
      end.setUTCDate(end.getUTCDate() - 1);
      return { start: formatDateStr(start), end: formatDateStr(end) };
    }
    case "yearly": {
      const start = new Date(from);
      const end = new Date(Date.UTC(start.getUTCFullYear() + 1, start.getUTCMonth(), start.getUTCDate()));
      end.setUTCDate(end.getUTCDate() - 1);
      return { start: formatDateStr(start), end: formatDateStr(end) };
    }
    default:
      return { start: fromDate, end: fromDate };
  }
}

export function getNextDate(frequency: string, currentEnd: string): string {
  const end = new Date(currentEnd + "T00:00:00Z");
  end.setUTCDate(end.getUTCDate() + 1);
  return formatDateStr(end);
}

export function formatDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function isDue(nextDate: string | null): boolean {
  if (!nextDate) return false;
  const today = new Date().toISOString().split("T")[0];
  return nextDate <= today;
}

/**
 * Get the next calendar-aligned send date for an email subscription.
 * Weekly = next Monday, Monthly = 1st of next month,
 * Quarterly = 1st of next quarter, Yearly = next Jan 1.
 */
export function getAlignedSendDate(frequency: string, fromDate?: string): string {
  const d = fromDate ? new Date(fromDate + "T00:00:00Z") : new Date();

  switch (frequency) {
    case "weekly": {
      // Next Monday (1=Mon in getUTCDay: 0=Sun,1=Mon,...,6=Sat)
      const day = d.getUTCDay(); // 0=Sun
      const daysUntilMonday = day === 0 ? 1 : (8 - day);
      const next = new Date(d);
      next.setUTCDate(next.getUTCDate() + daysUntilMonday);
      return formatDateStr(next);
    }
    case "monthly": {
      // 1st of next month
      return formatDateStr(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)));
    }
    case "quarterly": {
      // 1st of next quarter (Jan, Apr, Jul, Oct)
      const currentQuarter = Math.floor(d.getUTCMonth() / 3);
      const nextQuarterMonth = (currentQuarter + 1) * 3;
      return formatDateStr(new Date(Date.UTC(d.getUTCFullYear(), nextQuarterMonth, 1)));
    }
    case "yearly": {
      // Jan 1 of next year
      return formatDateStr(new Date(Date.UTC(d.getUTCFullYear() + 1, 0, 1)));
    }
    default:
      return formatDateStr(d);
  }
}

/**
 * Given a send date, calculate the trailing period it covers.
 * The send date is the day AFTER the period ends.
 * Weekly (Monday): previous Mon-Sun. Monthly (1st): previous month.
 * Quarterly (1st of quarter): previous 3 months. Yearly (Jan 1): previous year.
 */
export function getTrailingPeriod(
  frequency: string,
  sendDate: string
): { start: string; end: string } {
  const d = new Date(sendDate + "T00:00:00Z");

  switch (frequency) {
    case "weekly": {
      // sendDate is Monday, period = previous Mon through Sun
      const end = new Date(d);
      end.setUTCDate(end.getUTCDate() - 1); // Sunday
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - 6); // Monday
      return { start: formatDateStr(start), end: formatDateStr(end) };
    }
    case "monthly": {
      // sendDate is 1st, period = previous month
      const end = new Date(d);
      end.setUTCDate(end.getUTCDate() - 1); // last day of prev month
      const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
      return { start: formatDateStr(start), end: formatDateStr(end) };
    }
    case "quarterly": {
      // sendDate is 1st of quarter, period = previous 3 months
      const end = new Date(d);
      end.setUTCDate(end.getUTCDate() - 1); // last day of prev quarter
      const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 2, 1));
      return { start: formatDateStr(start), end: formatDateStr(end) };
    }
    case "yearly": {
      // sendDate is Jan 1, period = previous year
      const prevYear = d.getUTCFullYear() - 1;
      return {
        start: formatDateStr(new Date(Date.UTC(prevYear, 0, 1))),
        end: formatDateStr(new Date(Date.UTC(prevYear, 11, 31))),
      };
    }
    default:
      return { start: sendDate, end: sendDate };
  }
}

/**
 * Advance a send date to the next aligned occurrence.
 */
export function advanceAlignedDate(frequency: string, currentSendDate: string): string {
  const d = new Date(currentSendDate + "T00:00:00Z");

  switch (frequency) {
    case "weekly":
      d.setUTCDate(d.getUTCDate() + 7);
      return formatDateStr(d);
    case "monthly":
      return formatDateStr(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)));
    case "quarterly":
      return formatDateStr(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, 1)));
    case "yearly":
      return formatDateStr(new Date(Date.UTC(d.getUTCFullYear() + 1, 0, 1)));
    default:
      return currentSendDate;
  }
}
