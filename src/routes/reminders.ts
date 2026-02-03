import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../types/env";
import { createDb } from "../db/index";
import {
  listReminders,
  createReminder,
  updateReminder,
  deleteReminder,
} from "../db/queries";
import { ValidationError, ReminderNotFound } from "../lib/errors";

const remindersRoutes = new Hono<AppContext>();

const createReminderSchema = z
  .object({
    reminderType: z.enum(["daily", "weekly", "monthly", "smart"]),
    timeOfDay: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "Must be HH:MM format")
      .optional(),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    dayOfMonth: z.number().int().min(1).max(28).optional(),
    smartThreshold: z.number().int().min(1).max(14).optional(),
  })
  .refine(
    (data) => {
      if (data.reminderType !== "smart" && !data.timeOfDay) return false;
      if (data.reminderType === "weekly" && data.dayOfWeek === undefined)
        return false;
      if (data.reminderType === "monthly" && data.dayOfMonth === undefined)
        return false;
      return true;
    },
    { message: "Non-smart types require timeOfDay; weekly requires dayOfWeek; monthly requires dayOfMonth" }
  );

// GET /api/reminders — list user reminders
remindersRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);
  const result = await listReminders(db, userId);
  return c.json({ reminders: result });
});

// POST /api/reminders — create a reminder
remindersRoutes.post("/", async (c) => {
  const userId = c.get("userId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError("Invalid JSON body");
  }

  const parsed = createReminderSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Validation failed");
  }

  const db = createDb(c.env.DB);
  const reminder = await createReminder(db, {
    id: crypto.randomUUID(),
    userId,
    ...parsed.data,
  });

  return c.json({ reminder }, 201);
});

const updateReminderSchema = z.object({
  reminderType: z.enum(["daily", "weekly", "monthly", "smart"]).optional(),
  timeOfDay: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  dayOfMonth: z.number().int().min(1).max(28).optional(),
  smartThreshold: z.number().int().min(1).max(14).optional(),
  isActive: z.number().int().min(0).max(1).optional(),
});

// PUT /api/reminders/:id — update a reminder
remindersRoutes.put("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError("Invalid JSON body");
  }

  const parsed = updateReminderSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Validation failed");
  }

  const db = createDb(c.env.DB);
  const reminder = await updateReminder(db, id, userId, parsed.data);

  if (!reminder) {
    throw new ReminderNotFound();
  }

  return c.json({ reminder });
});

// DELETE /api/reminders/:id — delete a reminder
remindersRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = createDb(c.env.DB);

  const deleted = await deleteReminder(db, id, userId);
  if (!deleted) {
    throw new ReminderNotFound();
  }

  return c.json({ success: true });
});

export default remindersRoutes;
