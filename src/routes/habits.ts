import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../types/env";
import { createDb } from "../db/index";
import {
  listHabits,
  getHabitById,
  createHabit,
  updateHabit,
  deleteHabit,
  getHabitLogsForDate,
  getHabitLogsForDateRange,
  upsertHabitLog,
} from "../db/queries";
import { ValidationError, HabitNotFound } from "../lib/errors";

// Glass contract: failure modes
export { ValidationError, HabitNotFound } from "../lib/errors";

const habitsRouter = new Hono<AppContext>();

// GET /api/habits — list user's habits
habitsRouter.get("/", async (c) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);
  const rows = await listHabits(db, userId);
  return c.json({
    habits: rows.map((h) => ({
      ...h,
      isActive: h.isActive === 1,
    })),
  });
});

const createHabitSchema = z.object({
  name: z.string().min(1).max(200),
  question: z.string().min(1).max(500),
  sortOrder: z.number().int().min(0).optional(),
  checkinTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Must be HH:MM format")
    .optional()
    .nullable(),
});

// POST /api/habits — create a habit
habitsRouter.post("/", async (c) => {
  const userId = c.get("userId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = createHabitSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Validation failed");
  }

  const db = createDb(c.env.DB);
  const id = crypto.randomUUID();
  const habit = await createHabit(db, {
    id,
    userId,
    name: parsed.data.name.trim(),
    question: parsed.data.question.trim(),
    sortOrder: parsed.data.sortOrder,
    checkinTime: parsed.data.checkinTime ?? undefined,
  });

  if (!habit) {
    throw new HabitNotFound("Failed to create habit");
  }
  return c.json({ habit: { ...habit, isActive: habit.isActive === 1 } }, 201);
});

const updateHabitSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  question: z.string().min(1).max(500).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  checkinTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Must be HH:MM format")
    .optional()
    .nullable(),
});

// PUT /api/habits/:id — update a habit
habitsRouter.put("/:id", async (c) => {
  const userId = c.get("userId");
  const habitId = c.req.param("id");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = updateHabitSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Validation failed");
  }

  const db = createDb(c.env.DB);

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (typeof updateData.isActive === "boolean") {
    updateData.isActive = updateData.isActive ? 1 : 0;
  }

  const habit = await updateHabit(db, habitId, userId, updateData as Parameters<typeof updateHabit>[3]);

  if (!habit) {
    throw new HabitNotFound();
  }

  return c.json({ habit: { ...habit, isActive: habit.isActive === 1 } });
});

// DELETE /api/habits/:id — delete a habit
habitsRouter.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const habitId = c.req.param("id");
  const db = createDb(c.env.DB);

  const deleted = await deleteHabit(db, habitId, userId);
  if (!deleted) {
    throw new HabitNotFound();
  }

  return c.json({ success: true });
});

// GET /api/habits/logs — get logs for a date or date range
habitsRouter.get("/logs", async (c) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);
  const date = c.req.query("date");
  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  let logs;
  if (date) {
    if (!dateRegex.test(date)) {
      throw new ValidationError("date must be YYYY-MM-DD");
    }
    logs = await getHabitLogsForDate(db, userId, date);
  } else if (startDate && endDate) {
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      throw new ValidationError("startDate and endDate must be YYYY-MM-DD");
    }
    logs = await getHabitLogsForDateRange(db, userId, startDate, endDate);
  } else {
    return c.json({ error: "Provide date or startDate+endDate" }, 400);
  }

  return c.json({
    logs: logs.map((l) => ({ ...l, completed: l.completed === 1 })),
  });
});

const upsertLogsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  logs: z.array(
    z.object({
      habitId: z.string().min(1),
      completed: z.boolean(),
    })
  ),
});

// PUT /api/habits/logs — batch upsert logs for a date
habitsRouter.put("/logs", async (c) => {
  const userId = c.get("userId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = upsertLogsSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Validation failed");
  }

  const db = createDb(c.env.DB);

  // Verify all habitIds belong to the authenticated user
  const userHabits = await listHabits(db, userId);
  const userHabitIds = new Set(userHabits.map((h) => h.id));
  for (const log of parsed.data.logs) {
    if (!userHabitIds.has(log.habitId)) {
      throw new ValidationError(`Habit ${log.habitId} not found`);
    }
  }

  await Promise.all(
    parsed.data.logs.map((log) =>
      upsertHabitLog(db, {
        id: crypto.randomUUID(),
        habitId: log.habitId,
        userId,
        logDate: parsed.data.date,
        completed: log.completed ? 1 : 0,
        source: "web",
      })
    )
  );

  const updatedLogs = await getHabitLogsForDate(db, userId, parsed.data.date);
  return c.json({
    logs: updatedLogs.map((l) => ({ ...l, completed: l.completed === 1 })),
  });
});

export default habitsRouter;
