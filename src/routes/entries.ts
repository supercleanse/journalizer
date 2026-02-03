import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../types/env";
import { createDb } from "../db/index";
import {
  listEntries,
  getEntryById,
  getEntryDates,
  createEntry,
  updateEntry,
  deleteEntry,
  getUserById,
  getMediaByEntry,
} from "../db/queries";
import { polishEntryWithLogging } from "../services/ai";
import type { VoiceStyle } from "../services/ai";
import { ValidationError, EntryNotFound, AIPolishFailed } from "../lib/errors";

const entries = new Hono<AppContext>();

// GET /api/entries — list entries (paginated, filterable)
entries.get("/", async (c) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);

  const limit = Math.min(parseInt(c.req.query("limit") ?? "20", 10) || 20, 100);
  const offset = parseInt(c.req.query("offset") ?? "0", 10) || 0;

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

// GET /api/entries/dates — lightweight list of all entry dates for calendar/streak
entries.get("/dates", async (c) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);
  const dates = await getEntryDates(db, userId);
  return c.json({ dates });
});

// GET /api/entries/:id — get single entry with media
entries.get("/:id", async (c) => {
  const userId = c.get("userId");
  const entryId = c.req.param("id");
  const db = createDb(c.env.DB);

  const entry = await getEntryById(db, entryId, userId);
  if (!entry) {
    throw new EntryNotFound();
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
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError("Invalid JSON body");
  }

  const parsed = createEntrySchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Validation failed");
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
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError("Invalid JSON body");
  }

  const parsed = updateEntrySchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Validation failed");
  }

  const db = createDb(c.env.DB);
  const entry = await updateEntry(db, entryId, userId, parsed.data);

  if (!entry) {
    throw new EntryNotFound();
  }

  return c.json({ entry });
});

// DELETE /api/entries/:id — delete entry (cleans up R2 media)
entries.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const entryId = c.req.param("id");
  const db = createDb(c.env.DB);

  // Verify ownership before touching R2
  const entry = await getEntryById(db, entryId, userId);
  if (!entry) {
    throw new EntryNotFound();
  }

  // Collect R2 keys to delete after DB cascade
  const mediaRows = await getMediaByEntry(db, entryId);
  const r2Keys = mediaRows.flatMap((m) =>
    m.thumbnailR2Key ? [m.r2Key, m.thumbnailR2Key] : [m.r2Key]
  );

  const deleted = await deleteEntry(db, entryId, userId);
  if (!deleted) {
    throw new EntryNotFound();
  }

  // Clean up R2 objects in parallel after ownership-verified delete
  await Promise.allSettled(r2Keys.map((key) => c.env.MEDIA.delete(key)));

  return c.json({ success: true });
});

export default entries;
