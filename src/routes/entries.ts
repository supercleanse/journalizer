import { Hono } from "hono";
import type { AppContext } from "../types/env";

const entries = new Hono<AppContext>();

// GET /api/entries — list entries (paginated)
entries.get("/", async (c) => {
  return c.json({ entries: [], total: 0 });
});

// GET /api/entries/:id — get single entry with media
entries.get("/:id", async (c) => {
  return c.json({ error: "Not implemented" }, 501);
});

// POST /api/entries — create new entry
entries.post("/", async (c) => {
  return c.json({ error: "Not implemented" }, 501);
});

// PUT /api/entries/:id — update entry
entries.put("/:id", async (c) => {
  return c.json({ error: "Not implemented" }, 501);
});

// DELETE /api/entries/:id — soft-delete entry
entries.delete("/:id", async (c) => {
  return c.json({ error: "Not implemented" }, 501);
});

export default entries;
