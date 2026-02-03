import { Hono } from "hono";
import type { AppContext } from "../types/env";

const settings = new Hono<AppContext>();

// GET /api/settings — get user settings
settings.get("/", async (c) => {
  return c.json({ error: "Not implemented" }, 501);
});

// PUT /api/settings — update settings
settings.put("/", async (c) => {
  return c.json({ error: "Not implemented" }, 501);
});

// POST /api/settings/verify-phone — initiate phone verification
settings.post("/verify-phone", async (c) => {
  return c.json({ error: "Not implemented" }, 501);
});

// POST /api/settings/confirm-phone — confirm verification code
settings.post("/confirm-phone", async (c) => {
  return c.json({ error: "Not implemented" }, 501);
});

export default settings;
