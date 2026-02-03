import { Hono } from "hono";
import type { AppContext } from "../types/env";

const mediaRoutes = new Hono<AppContext>();

// POST /api/media/upload — upload media file to R2
mediaRoutes.post("/upload", async (c) => {
  return c.json({ error: "Not implemented" }, 501);
});

// GET /api/media/:id — get media file (proxied from R2)
mediaRoutes.get("/:id", async (c) => {
  return c.json({ error: "Not implemented" }, 501);
});

export default mediaRoutes;
