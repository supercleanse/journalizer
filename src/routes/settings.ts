import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../types/env";
import { createDb } from "../db/index";
import { getUserById, updateUser } from "../db/queries";
import { ValidationError } from "../lib/errors";

const settings = new Hono<AppContext>();

// GET /api/settings — get user settings
settings.get("/", async (c) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);
  const user = await getUserById(db, userId);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({
    displayName: user.displayName,
    email: user.email,
    timezone: user.timezone,
    telegramLinked: !!user.telegramChatId,
    voiceStyle: user.voiceStyle,
    voiceNotes: user.voiceNotes,
  });
});

const updateSettingsSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  timezone: z.string().min(1).optional(),
  voiceStyle: z
    .enum(["natural", "conversational", "reflective", "polished"])
    .optional(),
  voiceNotes: z.string().max(500).optional(),
});

// PUT /api/settings — update settings
settings.put("/", async (c) => {
  const userId = c.get("userId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Validation failed");
  }

  const db = createDb(c.env.DB);
  const user = await updateUser(db, userId, parsed.data);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({
    displayName: user.displayName,
    timezone: user.timezone,
    voiceStyle: user.voiceStyle,
    voiceNotes: user.voiceNotes,
  });
});

// POST /api/settings/link-telegram — generate a linking code
settings.post("/link-telegram", async (c) => {
  const userId = c.get("userId");

  // Rate limit: 5 link attempts per hour
  const rateLimitKey = `telegram_link_rate:${userId}`;
  const attempts = parseInt((await c.env.KV.get(rateLimitKey)) ?? "0", 10);
  if (attempts >= 5) {
    return c.json({ error: "Too many linking attempts. Try again later." }, 429);
  }
  await c.env.KV.put(rateLimitKey, String(attempts + 1), { expirationTtl: 3600 });

  // Generate an 8-character alphanumeric linking code with uniform distribution
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const code = Array.from(bytes).map((b) => alphabet[b % 36]).join("");

  // Check for collision before writing
  const existing = await c.env.KV.get(`telegram_link:${code}`);
  if (existing) {
    // Extremely unlikely — ask user to retry
    return c.json({ error: "Please try again" }, 409);
  }

  // Store code → userId in KV with 10-minute TTL
  await c.env.KV.put(`telegram_link:${code}`, userId, { expirationTtl: 600 });

  return c.json({
    success: true,
    code,
    botUsername: "JournalizerAppBot",
    message: `Send this code to the Journalizer bot on Telegram: ${code}`,
  });
});

// POST /api/settings/unlink-telegram — remove Telegram link
settings.post("/unlink-telegram", async (c) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);

  await updateUser(db, userId, { telegramChatId: null });

  return c.json({ success: true });
});

export default settings;
