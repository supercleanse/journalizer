import type { Env } from "../types/env";
import { createDb } from "../db/index";
import {
  getActiveEmailSubscriptions,
  updateEmailSubscription,
  logProcessing,
} from "../db/queries";
import { fetchEntriesForExport, generatePdfWithImages } from "./export";
import type { ExportOptions, PdfOptions } from "./export";
import { sendEmail, uint8ArrayToBase64 } from "./email";
import { buildPersonalizedEmailHtml } from "./emailBody";
import { getTrailingPeriod, advanceAlignedDate, isDueInTimezone } from "../lib/period";

// Glass contract: failure modes
export { ResendAPIError } from "../lib/errors";

/**
 * Process due email subscriptions.
 * Called from the cron handler alongside reminders and print scheduler.
 */
export async function handleEmailScheduler(env: Env): Promise<void> {
  if (!env.RESEND_API_KEY) return;

  const db = createDb(env.DB);
  const fromEmail = env.RESEND_FROM_EMAIL || "Journalizer <noreply@journalizer.app>";

  const subscriptions = await getActiveEmailSubscriptions(db);

  for (const sub of subscriptions) {
    try {
      const userTimezone = sub.userTimezone || "UTC";

      // Check if the send date has arrived in the user's local timezone
      if (!isDueInTimezone(sub.nextEmailDate, userTimezone)) continue;

      if (!sub.userEmail) continue;

      // Calculate the trailing period (e.g. Monday send = previous Mon-Sun)
      const { start, end } = getTrailingPeriod(sub.frequency, sub.nextEmailDate!);

      const exportOptions: ExportOptions = {
        userId: sub.userId,
        startDate: start,
        endDate: end,
        entryTypes: (sub.entryTypes as "daily" | "individual" | "both") || "both",
        includeImages: sub.includeImages === 1,
        includeMultimedia: false,
      };

      const entries = await fetchEntriesForExport(db, env, exportOptions);

      if (entries.length === 0) {
        const nextDate = advanceAlignedDate(sub.frequency, sub.nextEmailDate!);
        await updateEmailSubscription(db, sub.id, sub.userId, {
          nextEmailDate: nextDate,
        });
        await logProcessing(db, {
          id: crypto.randomUUID(),
          action: "email_schedule",
          status: "skipped",
          details: JSON.stringify({
            subscriptionId: sub.id,
            reason: "No entries for period",
            periodStart: start,
            periodEnd: end,
          }),
        });
        continue;
      }

      const pdfOptions: PdfOptions = {
        userName: sub.userDisplayName || "My Journal",
        timezone: userTimezone,
        startDate: start,
        endDate: end,
      };

      const pdfBytes = generatePdfWithImages(entries, pdfOptions);
      const base64Pdf = uint8ArrayToBase64(pdfBytes);

      const frequencyLabel = sub.frequency.charAt(0).toUpperCase() + sub.frequency.slice(1);
      const subject = `Your ${frequencyLabel} Journal - ${formatDateRange(start, end)}`;

      const html = await buildPersonalizedEmailHtml(
        env.ANTHROPIC_API_KEY,
        entries,
        {
          name: sub.userDisplayName || "there",
          periodLabel: frequencyLabel,
          startDate: start,
          endDate: end,
        }
      );

      await sendEmail(env.RESEND_API_KEY, fromEmail, {
        to: sub.userEmail,
        subject,
        html,
        attachments: [
          {
            filename: `journal-${start}-to-${end}.pdf`,
            content: base64Pdf,
          },
        ],
      });

      const nextDate = advanceAlignedDate(sub.frequency, sub.nextEmailDate!);
      await updateEmailSubscription(db, sub.id, sub.userId, {
        nextEmailDate: nextDate,
        lastEmailedAt: new Date().toISOString(),
      });

      await logProcessing(db, {
        id: crypto.randomUUID(),
        action: "email_send",
        status: "success",
        details: JSON.stringify({
          subscriptionId: sub.id,
          frequency: sub.frequency,
          periodStart: start,
          periodEnd: end,
          entryCount: entries.length,
          pdfSizeBytes: pdfBytes.length,
        }),
      });
    } catch (err) {
      console.error(`Email scheduler error for sub ${sub.id}:`, err);
      await logProcessing(db, {
        id: crypto.randomUUID(),
        action: "email_schedule",
        status: "error",
        details: JSON.stringify({
          subscriptionId: sub.id,
          error: err instanceof Error ? err.message : "Unknown error",
        }),
      }).catch(() => {});
    }
  }
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[s.getUTCMonth()]} ${s.getUTCDate()}-${months[e.getUTCMonth()]} ${e.getUTCDate()}, ${e.getUTCFullYear()}`;
}

