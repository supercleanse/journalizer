import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../types/env";
import { createDb } from "../db/index";
import {
  listEmailSubscriptions,
  getEmailSubscriptionById,
  createEmailSubscription,
  updateEmailSubscription,
} from "../db/queries";
import { ValidationError, EmailSubscriptionNotFound } from "../lib/errors";

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
  const today = new Date().toISOString().split("T")[0];

  const sub = await createEmailSubscription(db, {
    id: crypto.randomUUID(),
    userId,
    frequency: parsed.data.frequency,
    entryTypes: parsed.data.entryTypes,
    includeImages: parsed.data.includeImages ? 1 : 0,
    nextEmailDate: today,
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

export default emailRoutes;
