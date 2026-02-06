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
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate()));
      end.setUTCDate(end.getUTCDate() - 1);
      return { start: formatDateStr(start), end: formatDateStr(end) };
    }
    case "quarterly": {
      const start = new Date(from);
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, start.getUTCDate()));
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
