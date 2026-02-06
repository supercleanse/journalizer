import type { Env } from "../types/env";
import { createDb } from "../db/index";
import {
  getActivePrintSubscriptions,
  getUserById,
  getLastPrintOrder,
  createPrintOrder,
  updatePrintOrder,
  updatePrintSubscription,
  logProcessing,
} from "../db/queries";
import { fetchEntriesForExport } from "./export";
import { generateInteriorPdf, generateCoverPdf } from "./printPdf";
import type { PrintPdfOptions } from "./printPdf";
import {
  getAccessToken,
  createPrintJob,
  calculateCost,
  getPodPackageId,
  getRetailPriceCents,
} from "./lulu";
import type { LuluShippingAddress } from "./lulu";
import { chargeCustomer, refundPayment } from "./stripe";

// Glass contract: failure modes
export { LuluAPIError, StripeAPIError, PaymentFailed } from "../lib/errors";

// ── Period Calculation ──────────────────────────────────────────────

function calculatePeriodDates(
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
      // End = day before the same date next month (handles month boundaries safely)
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

function getNextPrintDate(frequency: string, currentEnd: string): string {
  const end = new Date(currentEnd + "T00:00:00Z");
  end.setUTCDate(end.getUTCDate() + 1);
  return formatDateStr(end);
}

function formatDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function isDue(nextPrintDate: string | null): boolean {
  if (!nextPrintDate) return false;
  const today = new Date().toISOString().split("T")[0];
  return nextPrintDate <= today;
}

// ── Main Scheduler ──────────────────────────────────────────────────

/**
 * Process due print subscriptions.
 * Called from the cron handler alongside reminders.
 */
export async function handlePrintScheduler(env: Env): Promise<void> {
  // Skip if Lulu or Stripe not configured
  if (!env.LULU_API_KEY || !env.LULU_API_SECRET || !env.STRIPE_SECRET_KEY) {
    return;
  }

  const db = createDb(env.DB);
  const sandbox = env.LULU_SANDBOX === "true";

  const subscriptions = await getActivePrintSubscriptions(db);

  for (const sub of subscriptions) {
    try {
      if (!isDue(sub.nextPrintDate)) continue;

      const user = await getUserById(db, sub.userId);
      if (!user) continue;

      // Need Stripe customer ID
      if (!user.stripeCustomerId) {
        await logProcessing(db, {
          id: crypto.randomUUID(),
          action: "print_schedule",
          status: "skipped",
          details: JSON.stringify({
            subscriptionId: sub.id,
            reason: "No Stripe customer ID",
          }),
        });
        continue;
      }

      // Calculate period
      const { start, end } = calculatePeriodDates(
        sub.frequency,
        sub.nextPrintDate!
      );

      // Create order record
      const orderId = crypto.randomUUID();
      await createPrintOrder(db, {
        id: orderId,
        userId: sub.userId,
        subscriptionId: sub.id,
        frequency: sub.frequency,
        periodStart: start,
        periodEnd: end,
        status: "generating",
      });

      // Fetch entries
      const entries = await fetchEntriesForExport(db, env, {
        userId: sub.userId,
        startDate: start,
        endDate: end,
        entryTypes: "both",
        includeImages: sub.includeImages === 1,
        includeMultimedia: false,
      });

      if (entries.length === 0) {
        await updatePrintOrder(db, orderId, {
          status: "failed",
          errorMessage: "No entries for this period",
          entryCount: 0,
        });
        // Advance to next period anyway
        const nextDate = getNextPrintDate(sub.frequency, end);
        await updatePrintSubscription(db, sub.id, sub.userId, {
          nextPrintDate: nextDate,
        });
        continue;
      }

      // Generate print PDFs
      const pdfOptions: PrintPdfOptions = {
        userName: user.displayName || "My Journal",
        timezone: user.timezone || "UTC",
        startDate: start,
        endDate: end,
        frequency: sub.frequency,
        colorOption: sub.colorOption || "bw",
      };

      const { pdf: interiorPdf, pageCount } = generateInteriorPdf(entries, pdfOptions);
      const coverPdf = generateCoverPdf(pdfOptions, pageCount);

      await updatePrintOrder(db, orderId, {
        entryCount: entries.length,
        pageCount,
      });

      // Calculate cost via Lulu API
      const token = await getAccessToken(env.LULU_API_KEY, env.LULU_API_SECRET, sandbox);
      const podPackageId = getPodPackageId(sub.frequency, sub.colorOption || "bw");

      const shippingAddress: LuluShippingAddress = {
        name: sub.shippingName,
        street1: sub.shippingLine1,
        street2: sub.shippingLine2 || undefined,
        city: sub.shippingCity,
        state_code: sub.shippingState,
        country_code: sub.shippingCountry,
        postcode: sub.shippingZip,
        phone_number: "0000000000", // Lulu requires phone but we may not have it
        email: user.email,
      };

      const { costCents } = await calculateCost(token, sandbox, {
        podPackageId,
        pageCount,
        shippingAddress,
      });

      const retailCents = getRetailPriceCents(sub.frequency, costCents);

      await updatePrintOrder(db, orderId, { costCents, retailCents });

      // Charge customer
      let stripePaymentId: string;
      try {
        stripePaymentId = await chargeCustomer(
          env.STRIPE_SECRET_KEY,
          user.stripeCustomerId,
          retailCents,
          `Journalizer ${sub.frequency} print: ${start} to ${end}`
        );
      } catch (err) {
        await updatePrintOrder(db, orderId, {
          status: "payment_failed",
          errorMessage: err instanceof Error ? err.message : "Payment failed",
        });
        continue;
      }

      await updatePrintOrder(db, orderId, { stripePaymentId });

      // Upload PDFs to R2 for Lulu to fetch
      const interiorKey = `print/${orderId}/interior.pdf`;
      const coverKey = `print/${orderId}/cover.pdf`;
      await env.MEDIA.put(interiorKey, interiorPdf);
      await env.MEDIA.put(coverKey, coverPdf);

      // Create Lulu print job
      // Note: Lulu needs publicly accessible URLs for PDFs.
      // We use R2 public URLs or signed URLs depending on bucket config.
      // For now, store in R2 and create signed URLs
      // TODO: Generate presigned R2 URLs or use a public bucket path
      const baseUrl = `https://journalizer-media.${env.ENVIRONMENT === "production" ? "" : "dev."}r2.cloudflarestorage.com`;
      const interiorUrl = `${baseUrl}/${interiorKey}`;
      const coverUrl = `${baseUrl}/${coverKey}`;

      try {
        const luluJob = await createPrintJob(token, sandbox, {
          externalId: orderId,
          podPackageId,
          title: `${user.displayName || "Journal"} - ${start} to ${end}`,
          interiorUrl,
          coverUrl,
          shippingAddress,
          contactEmail: user.email,
        });

        await updatePrintOrder(db, orderId, {
          status: "uploaded",
          luluJobId: String(luluJob.id),
        });
      } catch (err) {
        // Refund the Stripe charge since Lulu submission failed
        try {
          await refundPayment(env.STRIPE_SECRET_KEY!, stripePaymentId);
        } catch (refundErr) {
          console.error(`Refund failed for order ${orderId}:`, refundErr);
        }
        await updatePrintOrder(db, orderId, {
          status: "failed",
          errorMessage: err instanceof Error ? err.message : "Lulu submission failed",
        });
        // Advance nextPrintDate so we don't retry and double-charge
        const nextDate = getNextPrintDate(sub.frequency, end);
        await updatePrintSubscription(db, sub.id, sub.userId, {
          nextPrintDate: nextDate,
        });
        continue;
      }

      // Advance subscription to next period
      const nextDate = getNextPrintDate(sub.frequency, end);
      await updatePrintSubscription(db, sub.id, sub.userId, {
        nextPrintDate: nextDate,
        lastPrintedAt: new Date().toISOString(),
      });

      await logProcessing(db, {
        id: crypto.randomUUID(),
        action: "print_submit",
        status: "success",
        details: JSON.stringify({
          orderId,
          subscriptionId: sub.id,
          frequency: sub.frequency,
          periodStart: start,
          periodEnd: end,
          pageCount,
          costCents,
          retailCents,
        }),
      });
    } catch (err) {
      // Log error but continue with next subscription
      console.error(`Print scheduler error for sub ${sub.id}:`, err);
      await logProcessing(db, {
        id: crypto.randomUUID(),
        action: "print_schedule",
        status: "error",
        details: JSON.stringify({
          subscriptionId: sub.id,
          error: err instanceof Error ? err.message : "Unknown error",
        }),
      }).catch(() => {});
    }
  }
}
