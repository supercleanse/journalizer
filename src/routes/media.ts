import { Hono } from "hono";
import type { AppContext } from "../types/env";
import { createDb } from "../db/index";
import { getMedia, uploadMedia } from "../services/media";

const mediaRoutes = new Hono<AppContext>();

// POST /api/media/upload — upload media file to R2
mediaRoutes.post("/upload", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.parseBody();
  const file = body["file"];

  if (!file || !(file instanceof File)) {
    return c.json({ error: "No file provided" }, 400);
  }

  const entryId = typeof body["entryId"] === "string" ? body["entryId"] : "";
  if (!entryId) {
    return c.json({ error: "entryId is required" }, 400);
  }

  const db = createDb(c.env.DB);
  const buffer = await file.arrayBuffer();

  const record = await uploadMedia(c.env, db, buffer, {
    userId,
    entryId,
    mimeType: file.type || "application/octet-stream",
    fileSize: file.size,
  });

  return c.json({ media: record }, 201);
});

// GET /api/media/:id — get media file (proxied from R2)
mediaRoutes.get("/:id", async (c) => {
  const userId = c.get("userId");
  const mediaId = c.req.param("id");

  const db = createDb(c.env.DB);
  const result = await getMedia(c.env, db, mediaId, userId);

  if (!result) {
    return c.json({ error: "Media not found" }, 404);
  }

  const headers = new Headers();
  if (result.record.mimeType) {
    headers.set("Content-Type", result.record.mimeType);
  }
  headers.set("Cache-Control", "private, max-age=3600");

  return new Response(result.object.body, { headers });
});

export default mediaRoutes;
