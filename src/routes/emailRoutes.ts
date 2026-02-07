import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../types/env";
import { createDb } from "../db/index";
import {
  listEmailSubscriptions,
  getEmailSubscriptionById,
  createEmailSubscription,
  updateEmailSubscription,
  getUserById,
} from "../db/queries";
import { ValidationError, EmailSubscriptionNotFound } from "../lib/errors";
import { fetchEntriesForExport, generatePdfWithImages } from "../services/export";
import type { ExportOptions, PdfOptions } from "../services/export";
import { sendEmail, uint8ArrayToBase64 } from "../services/email";
import { buildPersonalizedEmailHtml } from "../services/emailBody";
import { formatDateStr, getAlignedSendDate } from "../lib/period";

// Glass contract: failure modes
export { ValidationError, EmailSubscriptionNotFound } from "../lib/errors";

const emailRoutes = new Hono<AppContext>();

const VALID_FREQUENCIES = ["weekly", "monthly", "quarterly", "yearly"];
const VALID_ENTRY_TYPES = ["daily", "individual", "both"];

const createSubSchema = z.object({
  frequency: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
  entryTypes: z.enum(["daily", "individual", "both"]).default("both"),
  includeImages: z.boolean().default(true),
});

// GET /api/email/subscriptions — list user's email subscriptions
emailRoutes.get("/subscriptions", async (c) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);
  const subs = await listEmailSubscriptions(db, userId);
  return c.json({ subscriptions: subs });
});

// POST /api/email/subscriptions — create new subscription
emailRoutes.post("/subscriptions", async (c) => {
  const userId = c.get("userId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError("Invalid JSON body");
  }

  const parsed = createSubSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Validation failed");
  }

  const db = createDb(c.env.DB);
  const nextEmailDate = getAlignedSendDate(parsed.data.frequency);

  const sub = await createEmailSubscription(db, {
    id: crypto.randomUUID(),
    userId,
    frequency: parsed.data.frequency,
    entryTypes: parsed.data.entryTypes,
    includeImages: parsed.data.includeImages ? 1 : 0,
    nextEmailDate,
  });

  return c.json({ subscription: sub }, 201);
});

const updateSubSchema = z.object({
  frequency: z.enum(["weekly", "monthly", "quarterly", "yearly"]).optional(),
  entryTypes: z.enum(["daily", "individual", "both"]).optional(),
  isActive: z.boolean().optional(),
  includeImages: z.boolean().optional(),
});

// PUT /api/email/subscriptions/:id — update subscription
emailRoutes.put("/subscriptions/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = createDb(c.env.DB);

  const existing = await getEmailSubscriptionById(db, id, userId);
  if (!existing) throw new EmailSubscriptionNotFound();

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError("Invalid JSON body");
  }

  const parsed = updateSubSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Validation failed");
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.frequency !== undefined) updates.frequency = parsed.data.frequency;
  if (parsed.data.entryTypes !== undefined) updates.entryTypes = parsed.data.entryTypes;
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive ? 1 : 0;
  if (parsed.data.includeImages !== undefined) updates.includeImages = parsed.data.includeImages ? 1 : 0;

  const sub = await updateEmailSubscription(db, id, userId, updates as Parameters<typeof updateEmailSubscription>[3]);
  return c.json({ subscription: sub });
});

// DELETE /api/email/subscriptions/:id — deactivate subscription
emailRoutes.delete("/subscriptions/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = createDb(c.env.DB);

  const existing = await getEmailSubscriptionById(db, id, userId);
  if (!existing) throw new EmailSubscriptionNotFound();

  await updateEmailSubscription(db, id, userId, { isActive: 0 });
  return c.json({ success: true });
});

// POST /api/email/send-now — send an immediate email for the trailing period
const sendNowSchema = z.object({
  period: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
});

emailRoutes.post("/send-now", async (c) => {
  const userId = c.get("userId");

  if (!c.env.RESEND_API_KEY) {
    throw new ValidationError("Email sending is not configured");
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError("Invalid JSON body");
  }

  const parsed = sendNowSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Invalid period");
  }

  const db = createDb(c.env.DB);
  const user = await getUserById(db, userId);
  if (!user || !user.email) {
    throw new ValidationError("No email address on account");
  }

  // Calculate trailing period ending yesterday
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const endDate = formatDateStr(yesterday);

  const startDateObj = new Date(yesterday);
  switch (parsed.data.period) {
    case "weekly":
      startDateObj.setUTCDate(startDateObj.getUTCDate() - 6);
      break;
    case "monthly":
      startDateObj.setUTCMonth(startDateObj.getUTCMonth() - 1);
      startDateObj.setUTCDate(startDateObj.getUTCDate() + 1);
      break;
    case "quarterly":
      startDateObj.setUTCMonth(startDateObj.getUTCMonth() - 3);
      startDateObj.setUTCDate(startDateObj.getUTCDate() + 1);
      break;
    case "yearly":
      startDateObj.setUTCFullYear(startDateObj.getUTCFullYear() - 1);
      startDateObj.setUTCDate(startDateObj.getUTCDate() + 1);
      break;
  }
  const startDate = formatDateStr(startDateObj);

  const exportOptions: ExportOptions = {
    userId,
    startDate,
    endDate,
    entryTypes: "both",
    includeImages: true,
    includeMultimedia: false,
  };

  const entries = await fetchEntriesForExport(db, c.env, exportOptions);

  if (entries.length === 0) {
    return c.json({ success: false, message: "No entries found for this period" }, 200);
  }

  const pdfOptions: PdfOptions = {
    userName: user.displayName || "My Journal",
    timezone: user.timezone || "UTC",
    startDate,
    endDate,
  };

  const pdfBytes = generatePdfWithImages(entries, pdfOptions);
  const base64Pdf = uint8ArrayToBase64(pdfBytes);

  const periodLabel = parsed.data.period.charAt(0).toUpperCase() + parsed.data.period.slice(1);
  const fromEmail = c.env.RESEND_FROM_EMAIL || "Journalizer <noreply@journalizer.app>";

  const html = await buildPersonalizedEmailHtml(
    c.env.ANTHROPIC_API_KEY,
    entries,
    {
      name: user.displayName || "there",
      periodLabel,
      startDate,
      endDate,
    }
  );

  await sendEmail(c.env.RESEND_API_KEY, fromEmail, {
    to: user.email,
    subject: `Your ${periodLabel} Journal - ${startDate} to ${endDate}`,
    html,
    attachments: [
      {
        filename: `journal-${startDate}-to-${endDate}.pdf`,
        content: base64Pdf,
      },
    ],
  });

  return c.json({ success: true, entryCount: entries.length, startDate, endDate });
});

export default emailRoutes;
