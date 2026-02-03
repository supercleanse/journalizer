import { Hono } from "hono";
import type { AppContext } from "../types/env";

const remindersRoutes = new Hono<AppContext>();

// GET /api/reminders — get reminder configuration
remindersRoutes.get("/", async (c) => {
  return c.json({ error: "Not implemented" }, 501);
});

// PUT /api/reminders — update reminders
remindersRoutes.put("/", async (c) => {
  return c.json({ error: "Not implemented" }, 501);
});

export default remindersRoutes;
