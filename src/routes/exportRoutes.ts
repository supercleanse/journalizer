import { Hono } from "hono";
import type { AppContext } from "../types/env";

const exportRoutes = new Hono<AppContext>();

// GET /api/export/json — export all entries as JSON
exportRoutes.get("/json", async (c) => {
  return c.json({ error: "Not implemented" }, 501);
});

// GET /api/export/pdf — generate PDF of entries
exportRoutes.get("/pdf", async (c) => {
  return c.json({ error: "Not implemented" }, 501);
});

export default exportRoutes;
