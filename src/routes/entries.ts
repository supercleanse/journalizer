import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../types/env";
import { createDb } from "../db/index";
import { and, eq } from "drizzle-orm";
import { entries as entriesTable } from "../db/schema";
import {
  listEntries,
  getEntryById,
  getEntryDates,
  createEntry,
  updateEntry,
  deleteEntry,
  getUserById,
  getMediaByEntry,
  getMediaByEntryIds,
  getDigestSourceEntries,
  getDigestMediaForEntries,
} from "../db/queries";
import { polishEntryWithLogging } from "../services/ai";
import type { VoiceStyle } from "../services/ai";
import { transcribeFromR2 } from "../services/transcription";
import { generateDailyDigest } from "../services/digest";
import { sendTelegramMessage } from "../services/telegram";
import {
  generateDigestNotificationContent,
  formatDigestTelegramMessage,
} from "../services/digestNotification";
import {
  AppError,
  ValidationError,
  EntryNotFound,
  AIPolishFailed,
} from "../lib/errors";
import { listDictionaryTerms } from "../db/queries";
import { formatDictionaryForPolish, formatDictionaryForWhisper } from "../services/dictionary";

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
    excludeType: c.req.query("excludeType"),
    source: c.req.query("source"),
    search: c.req.query("search"),
    timelineView: c.req.query("timelineView") === "true",
  });

  // Attach media records to each entry
  const entryIds = result.entries.map((e) => e.id);
  const mediaByEntry = await getMediaByEntryIds(db, entryIds);

  // For digest entries, merge media from all source entries
  const digestIds = result.entries
    .filter((e) => e.entryType === "digest")
    .map((e) => e.id);
  const digestMedia =
    digestIds.length > 0
      ? await getDigestMediaForEntries(db, digestIds)
      : {};

  const entriesWithMedia = result.entries.map((e) => ({
    ...e,
    media:
      e.entryType === "digest"
        ? digestMedia[e.id] ?? []
        : mediaByEntry[e.id] ?? [],
  }));

  return c.json({
    entries: entriesWithMedia,
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

// GET /api/entries/:id/source-entries — get source entries for a digest
entries.get("/:id/source-entries", async (c) => {
  const userId = c.get("userId");
  const digestId = c.req.param("id");
  const db = createDb(c.env.DB);

  const entry = await getEntryById(db, digestId, userId);
  if (!entry) {
    throw new EntryNotFound();
  }
  if (entry.entryType !== "digest") {
    return c.json({ entries: [] });
  }

  const sourceEntries = await getDigestSourceEntries(db, digestId, userId);
  return c.json({ entries: sourceEntries });
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

  // For digest entries, merge media from all source entries
  if (entry.entryType === "digest") {
    const digestMedia = await getDigestMediaForEntries(db, [entryId]);
    return c.json({ entry: { ...entry, media: digestMedia[entryId] ?? [] } });
  }

  return c.json({ entry });
});

const createEntrySchema = z.object({
  rawContent: z.string().min(1).optional(),
  entryType: z.enum(["text", "audio", "video", "photo"]),
  source: z.enum(["sms", "web", "telegram"]).default("web"),
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
      const dictTerms = await listDictionaryTerms(db, userId);
      const polishHint = formatDictionaryForPolish(dictTerms);
      const result = await polishEntryWithLogging(
        db,
        c.env.ANTHROPIC_API_KEY,
        entryId,
        data.rawContent,
        {
          voiceStyle: (user?.voiceStyle as VoiceStyle) ?? "natural",
          voiceNotes: user?.voiceNotes,
          dictionaryHint: polishHint || undefined,
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

// POST /api/entries/:id/retranscribe — re-transcribe audio/video
entries.post("/:id/retranscribe", async (c) => {
  const userId = c.get("userId");
  const entryId = c.req.param("id");
  const db = createDb(c.env.DB);

  const user = await getUserById(db, userId);
  const entry = await getEntryById(db, entryId, userId);
  if (!entry) {
    throw new EntryNotFound();
  }

  const mediaRows = await getMediaByEntry(db, entryId);
  const audioMedia = mediaRows.find(
    (m) =>
      m.mimeType?.startsWith("audio/") || m.mimeType?.startsWith("video/")
  );
  if (!audioMedia) {
    return c.json({ error: "No audio/video media found on this entry" }, 400);
  }

  const dictTerms = await listDictionaryTerms(db, userId);
  const whisperPrompt = formatDictionaryForWhisper(dictTerms);
  const polishHint = formatDictionaryForPolish(dictTerms);

  const transcription = await transcribeFromR2(
    c.env,
    db,
    audioMedia.r2Key,
    entryId,
    whisperPrompt ? { initialPrompt: whisperPrompt } : undefined
  );

  // Replace any existing [Transcription] block to avoid duplicates on re-transcribe
  const existingText = entry.rawContent?.replace(/\n\n\[Transcription\]\n[\s\S]*$/, "") ?? "";
  const rawContent = existingText
    ? `${existingText}\n\n[Transcription]\n${transcription.transcript}`
    : transcription.transcript;

  await updateEntry(db, entryId, userId, { rawContent });

  // Polish the transcription
  if (user) {
    try {
      const result = await polishEntryWithLogging(
        db,
        c.env.ANTHROPIC_API_KEY,
        entryId,
        rawContent,
        {
          voiceStyle: (user.voiceStyle as VoiceStyle) ?? "natural",
          voiceNotes: user.voiceNotes,
          dictionaryHint: polishHint || undefined,
        }
      );
      await updateEntry(db, entryId, userId, {
        polishedContent: result.polishedContent,
      });
    } catch {
      // Polish failed — keep raw content
    }
  }

  const updated = await getEntryById(db, entryId, userId);
  return c.json({ entry: updated, transcript: transcription.transcript });
});

// ── Admin Endpoints ─────────────────────────────────────────────────

// POST /api/entries/regenerate-digest — regenerate digest for a date (admin only)
entries.post("/regenerate-digest", async (c) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);

  const user = await getUserById(db, userId);
  if (!user || user.role !== "admin") {
    throw AppError.forbidden("Admin access required");
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError("Invalid JSON body");
  }

  const digestSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD") });
  const parsed2 = digestSchema.safeParse(body);
  if (!parsed2.success) {
    throw new ValidationError("date must be YYYY-MM-DD");
  }
  const { date } = parsed2.data;

  // Delete existing digest for this date
  const existingDigests = await db
    .select()
    .from(entriesTable)
    .where(
      and(
        eq(entriesTable.userId, userId),
        eq(entriesTable.entryType, "digest"),
        eq(entriesTable.entryDate, date)
      )
    );

  for (const digest of existingDigests) {
    await deleteEntry(db, digest.id, userId);
  }

  const digestContent = await generateDailyDigest(c.env, db, userId, date);

  // Send enhanced notification if digest was created
  if (digestContent && user.telegramChatId) {
    try {
      const notifContent = await generateDigestNotificationContent(
        c.env,
        userId,
        date,
        digestContent
      );
      const telegramMsg = formatDigestTelegramMessage(date, notifContent);
      await sendTelegramMessage(c.env, user.telegramChatId, telegramMsg);
    } catch {
      // Notification failure is non-fatal
    }
  }

  return c.json({ success: true, date });
});

export default entries;
