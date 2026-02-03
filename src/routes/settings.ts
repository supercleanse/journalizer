import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../types/env";
import { createDb } from "../db/index";
import { getUserById, updateUser } from "../db/queries";
import { sendSMS, generateVerificationCode } from "../services/sms";

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
    phoneNumber: user.phoneNumber,
    phoneVerified: user.phoneVerified === 1,
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
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
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

const verifyPhoneSchema = z.object({
  phoneNumber: z.string().regex(/^\+[1-9]\d{6,14}$/, "Must be E.164 format"),
});

// POST /api/settings/verify-phone — initiate phone verification
settings.post("/verify-phone", async (c) => {
  const userId = c.get("userId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = verifyPhoneSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid phone number. Use E.164 format (e.g., +15551234567)" }, 400);
  }

  // Rate limit: 3 verification attempts per hour
  const rateLimitKey = `phone_verify_rate:${userId}`;
  const attempts = parseInt((await c.env.KV.get(rateLimitKey)) ?? "0", 10);
  if (attempts >= 3) {
    return c.json({ error: "Too many verification attempts. Try again later." }, 429);
  }
  await c.env.KV.put(rateLimitKey, String(attempts + 1), { expirationTtl: 3600 });

  const code = generateVerificationCode();

  // Store code in KV with 10-minute TTL
  await c.env.KV.put(`phone_code:${userId}`, code, { expirationTtl: 600 });

  // Store the phone number being verified
  await c.env.KV.put(`phone_pending:${userId}`, parsed.data.phoneNumber, {
    expirationTtl: 600,
  });

  // Send SMS with verification code
  const sent = await sendSMS(
    c.env,
    parsed.data.phoneNumber,
    `Your Journalizer verification code is: ${code}`
  );

  if (!sent) {
    return c.json({ error: "Failed to send verification SMS" }, 502);
  }

  return c.json({ success: true, message: "Verification code sent" });
});

const confirmPhoneSchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/),
});

// POST /api/settings/confirm-phone — confirm verification code
settings.post("/confirm-phone", async (c) => {
  const userId = c.get("userId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = confirmPhoneSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid code format" }, 400);
  }

  const storedCode = await c.env.KV.get(`phone_code:${userId}`);
  const pendingPhone = await c.env.KV.get(`phone_pending:${userId}`);

  if (!storedCode || !pendingPhone) {
    return c.json({ error: "No pending verification. Request a new code." }, 400);
  }

  // Constant-time comparison to prevent timing attacks
  const encoder = new TextEncoder();
  const a = encoder.encode(storedCode);
  const b = encoder.encode(parsed.data.code);
  let mismatch = a.length !== b.length ? 1 : 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a[i] ^ (b[i] ?? 0);
  }
  if (mismatch !== 0) {
    return c.json({ error: "Incorrect verification code" }, 400);
  }

  // Clean up KV
  await c.env.KV.delete(`phone_code:${userId}`);
  await c.env.KV.delete(`phone_pending:${userId}`);

  // Update user with verified phone
  const db = createDb(c.env.DB);
  await updateUser(db, userId, {
    phoneNumber: pendingPhone,
    phoneVerified: 1,
  });

  return c.json({ success: true, phoneNumber: pendingPhone, verified: true });
});

export default settings;
