import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../types/env";
import { createDb } from "../db/index";
import {
  listEntries,
  getEntryById,
  createEntry,
  updateEntry,
  deleteEntry,
  getUserById,
} from "../db/queries";
import { polishEntryWithLogging } from "../services/ai";
import type { VoiceStyle } from "../services/ai";

const entries = new Hono<AppContext>();

// GET /api/entries — list entries (paginated, filterable)
entries.get("/", async (c) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);

  const limit = Math.min(parseInt(c.req.query("limit") ?? "20", 10), 100);
  const offset = parseInt(c.req.query("offset") ?? "0", 10);

  const result = await listEntries(db, userId, {
    limit,
    offset,
    startDate: c.req.query("startDate"),
    endDate: c.req.query("endDate"),
    entryType: c.req.query("entryType"),
    source: c.req.query("source"),
    search: c.req.query("search"),
  });

  return c.json({
    entries: result.entries,
    total: result.total,
    limit,
    offset,
  });
});

// GET /api/entries/:id — get single entry with media
entries.get("/:id", async (c) => {
  const userId = c.get("userId");
  const entryId = c.req.param("id");
  const db = createDb(c.env.DB);

  const entry = await getEntryById(db, entryId, userId);
  if (!entry) {
    return c.json({ error: "Entry not found" }, 404);
  }

  return c.json({ entry });
});

const createEntrySchema = z.object({
  rawContent: z.string().min(1).optional(),
  entryType: z.enum(["text", "audio", "video", "photo"]),
  source: z.enum(["sms", "web"]).default("web"),
  mood: z.string().optional(),
  tags: z.string().optional(),
  location: z.string().optional(),
  entryDate: z.string().min(1),
  polishWithAI: z.boolean().default(true),
});

// POST /api/entries — create new entry
entries.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();

  const parsed = createEntrySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const data = parsed.data;
  const db = createDb(c.env.DB);
  const entryId = crypto.randomUUID();

  let polishedContent: string | undefined;

  // Polish with AI if requested and there's text content
  if (data.polishWithAI && data.rawContent) {
    try {
      const user = await getUserById(db, userId);
      const result = await polishEntryWithLogging(
        db,
        c.env.ANTHROPIC_API_KEY,
        entryId,
        data.rawContent,
        {
          voiceStyle: (user?.voiceStyle as VoiceStyle) ?? "natural",
          voiceNotes: user?.voiceNotes,
        }
      );
      polishedContent = result.polishedContent;
    } catch {
      // AI polish failed — continue with raw content only
      polishedContent = undefined;
    }
  }

  const entry = await createEntry(db, {
    id: entryId,
    userId,
    rawContent: data.rawContent,
    polishedContent,
    entryType: data.entryType,
    source: data.source,
    mood: data.mood,
    tags: data.tags,
    location: data.location,
    entryDate: data.entryDate,
  });

  return c.json({ entry }, 201);
});

const updateEntrySchema = z.object({
  polishedContent: z.string().optional(),
  mood: z.string().optional(),
  tags: z.string().optional(),
  location: z.string().optional(),
  entryDate: z.string().optional(),
});

// PUT /api/entries/:id — update entry
entries.put("/:id", async (c) => {
  const userId = c.get("userId");
  const entryId = c.req.param("id");
  const body = await c.req.json();

  const parsed = updateEntrySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const db = createDb(c.env.DB);
  const entry = await updateEntry(db, entryId, userId, parsed.data);

  if (!entry) {
    return c.json({ error: "Entry not found" }, 404);
  }

  return c.json({ entry });
});

// DELETE /api/entries/:id — delete entry
entries.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const entryId = c.req.param("id");
  const db = createDb(c.env.DB);

  const deleted = await deleteEntry(db, entryId, userId);
  if (!deleted) {
    return c.json({ error: "Entry not found" }, 404);
  }

  return c.json({ success: true });
});

export default entries;
