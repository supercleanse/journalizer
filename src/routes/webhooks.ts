import { Hono } from "hono";
import type { Env } from "../types/env";
import { createDb } from "../db/index";
import type { Database } from "../db/index";

// Glass contract: failure modes
export { InvalidSignature } from "../lib/errors";
import {
  getUserByTelegramChatId,
  updateUser,
  createEntry,
  updateEntry,
  logProcessing,
  upsertHabitLog,
} from "../db/queries";
import type { HabitCheckinSession } from "../services/reminders";
import type { TelegramUpdate } from "../services/telegram";
import {
  sendTelegramMessage,
  getTelegramFileUrl,
} from "../services/telegram";
import { downloadAndStore } from "../services/media";
import type { MediaRecord } from "../services/media";
import { polishEntryWithLogging } from "../services/ai";
import type { VoiceStyle } from "../services/ai";
import { transcribeFromR2 } from "../services/transcription";
import { listDictionaryTerms, addDictionaryTerm } from "../db/queries";
import {
  formatDictionaryForWhisper,
  formatDictionaryForPolish,
  extractProperNouns,
} from "../services/dictionary";

const webhooks = new Hono<{ Bindings: Env }>();

/**
 * Process a Telegram journal message (text, media) in the background.
 *
 * Creates the entry first so that processing_log FK references are valid,
 * then downloads media, transcribes audio/video, and AI polishes text.
 */
async function processJournalMessage(
  env: Env,
  db: Database,
  user: { id: string; voiceStyle: string | null; voiceNotes: string | null; timezone: string | null },
  chatId: string,
  message: NonNullable<TelegramUpdate["message"]>
) {
  const text = message.text ?? message.caption ?? "";
  const entryId = crypto.randomUUID();

  let entryType = "text";
  let rawContent = text;

  // Determine entry type from media (no placeholder text)
  const mediaFile =
    message.voice ??
    message.audio ??
    message.video ??
    (message.photo ? message.photo[message.photo.length - 1] : null);

  if (mediaFile) {
    if (message.voice) entryType = "audio";
    else if (message.audio) entryType = "audio";
    else if (message.video) entryType = "video";
    else if (message.photo) entryType = "photo";
  }

  // Use user's timezone for entry_date (not UTC)
  const today = new Date().toLocaleDateString("en-CA", { timeZone: user.timezone || "UTC" });
  try {
    await createEntry(db, {
      id: entryId,
      userId: user.id,
      rawContent: rawContent || undefined,
      entryType,
      source: "telegram",
      entryDate: today,
    });
  } catch {
    await sendTelegramMessage(
      env,
      chatId,
      "Sorry, there was an error saving your journal entry. Please try again."
    );
    return;
  }

  // Send immediate acknowledgment so user knows the entry was saved
  const hasAudioVideo = entryType === "audio" || entryType === "video";
  await sendTelegramMessage(
    env,
    chatId,
    hasAudioVideo
      ? "Got it! Your journal entry has been saved. Processing audio..."
      : "Got it! Your journal entry has been saved."
  );

  await logProcessing(db, {
    id: crypto.randomUUID(),
    entryId,
    action: "telegram_receive",
    status: "success",
    details: JSON.stringify({
      chatId,
      hasText: !!text,
      hasPhoto: !!message.photo,
      hasVoice: !!message.voice,
      hasVideo: !!message.video,
    }),
  });

  // Download and store media attachments
  let mediaRecord: MediaRecord | null = null;

  if (mediaFile) {
    const fileUrl = await getTelegramFileUrl(env, mediaFile.file_id);

    if (fileUrl) {
      let mimeType = "application/octet-stream";
      if (message.voice) mimeType = message.voice.mime_type ?? "audio/ogg";
      else if (message.audio) mimeType = message.audio.mime_type ?? "audio/mpeg";
      else if (message.video) mimeType = message.video.mime_type ?? "video/mp4";
      else if (message.photo) mimeType = "image/jpeg";

      let durationSeconds: number | undefined;
      if (message.voice) durationSeconds = message.voice.duration;
      else if (message.audio) durationSeconds = message.audio.duration;
      else if (message.video) durationSeconds = message.video.duration;

      try {
        mediaRecord = await downloadAndStore(env, db, fileUrl, {
          userId: user.id,
          entryId,
          mimeType,
          durationSeconds,
        });
      } catch (err) {
        await logProcessing(db, {
          id: crypto.randomUUID(),
          entryId,
          action: "media_download",
          status: "error",
          details: JSON.stringify({
            error: err instanceof Error ? err.message : "Media download failed",
          }),
        }).catch(() => {});
      }
    }
  }

  // Fetch user's personal dictionary for transcription hints
  const dictTerms = await listDictionaryTerms(db, user.id);
  const whisperPrompt = formatDictionaryForWhisper(dictTerms);
  const polishHint = formatDictionaryForPolish(dictTerms);

  // Transcribe audio/video via Workers AI Whisper
  if (mediaRecord && (entryType === "audio" || entryType === "video")) {
    try {
      const transcription = await transcribeFromR2(
        env,
        db,
        mediaRecord.r2Key,
        entryId,
        whisperPrompt ? { initialPrompt: whisperPrompt } : undefined
      );

      if (!rawContent) {
        rawContent = transcription.transcript;
      } else {
        rawContent = `${rawContent}\n\n[Transcription]\n${transcription.transcript}`;
      }

      await updateEntry(db, entryId, user.id, { rawContent });
    } catch (err) {
      // Transcription failed — transcribeFromR2 logs internally, but log here
      // as fallback in case logging itself failed
      console.error("Transcription failed for entry", entryId, err);
    }
  }

  // Polish with AI (only when there is actual text)
  if (rawContent) {
    try {
      const result = await polishEntryWithLogging(
        db,
        env.ANTHROPIC_API_KEY,
        entryId,
        rawContent,
        {
          voiceStyle: (user.voiceStyle as VoiceStyle) ?? "natural",
          voiceNotes: user.voiceNotes,
          dictionaryHint: polishHint || undefined,
        }
      );
      await updateEntry(db, entryId, user.id, {
        polishedContent: result.polishedContent,
      });

      // Auto-extract proper nouns from new entry
      try {
        const nouns = await extractProperNouns(env.ANTHROPIC_API_KEY, rawContent);
        for (const noun of nouns) {
          await addDictionaryTerm(db, {
            id: crypto.randomUUID(),
            userId: user.id,
            term: noun.term,
            category: noun.category,
            autoExtracted: 1,
          });
        }
      } catch {
        // Non-critical — dictionary extraction failure shouldn't block entry
      }
    } catch {
      // AI polish failed — entry keeps raw content only
    }
  }

  // Send follow-up for audio/video after transcription + polish completes
  if (hasAudioVideo) {
    await sendTelegramMessage(
      env,
      chatId,
      "Your audio has been transcribed and polished."
    );
  }
}

// POST /api/webhooks/telegram — inbound messages from Telegram
webhooks.post("/telegram", async (c) => {
  // Validate Telegram webhook secret token
  const secret = c.req.header("X-Telegram-Bot-Api-Secret-Token");
  if (secret !== c.env.TELEGRAM_WEBHOOK_SECRET) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  const update = (await c.req.json()) as TelegramUpdate;
  const message = update.message;

  if (!message) {
    return c.json({ ok: true });
  }

  const chatId = String(message.chat.id);
  const text = message.text ?? message.caption ?? "";
  const db = createDb(c.env.DB);

  // Handle /start command (deep link from bot)
  if (text === "/start") {
    await sendTelegramMessage(
      c.env,
      chatId,
      "Welcome to Journalizer! To link your account, go to Settings on journalizerapp.com, " +
        "click 'Link Telegram', and send the code here."
    );
    return c.json({ ok: true });
  }

  // Check if this is a linking code (8-char uppercase alphanumeric)
  const trimmedText = text.trim().toUpperCase();
  if (/^[0-9A-Z]{8}$/.test(trimmedText)) {
    // Rate limit linking attempts: 10 per hour per chat ID
    const rateLimitKey = `telegram_link_attempt:${chatId}`;
    const attempts = parseInt((await c.env.KV.get(rateLimitKey)) ?? "0", 10);
    if (attempts >= 10) {
      await sendTelegramMessage(
        c.env,
        chatId,
        "Too many linking attempts. Please try again later."
      );
      return c.json({ ok: true });
    }
    await c.env.KV.put(rateLimitKey, String(attempts + 1), { expirationTtl: 3600 });

    const linkUserId = await c.env.KV.get(`telegram_link:${trimmedText}`);
    if (linkUserId) {
      await c.env.KV.delete(`telegram_link:${trimmedText}`);
      await updateUser(db, linkUserId, { telegramChatId: chatId });
      await sendTelegramMessage(
        c.env,
        chatId,
        "Your Telegram is now linked to Journalizer! Send me text, photos, voice messages, or videos to create journal entries."
      );
      return c.json({ ok: true });
    }
  }

  // Look up user by Telegram chat ID
  const user = await getUserByTelegramChatId(db, chatId);
  if (!user) {
    await sendTelegramMessage(
      c.env,
      chatId,
      "This Telegram account is not linked to Journalizer. " +
        "Sign in at journalizerapp.com and link your Telegram in Settings."
    );
    return c.json({ ok: true });
  }

  // ── Habit Check-In Intercept ─────────────────────────────────────
  const sessionKey = `habit_checkin:${chatId}`;
  try {
    const sessionJson = await c.env.KV.get(sessionKey);
    if (sessionJson) {
      const session: HabitCheckinSession = JSON.parse(sessionJson);

      // Handle /cancel command
      if (text.trim().toLowerCase() === "/cancel") {
        await c.env.KV.delete(sessionKey);
        await sendTelegramMessage(c.env, chatId, "Habit check-in cancelled.");
        return c.json({ ok: true });
      }

      // Parse yes/no response
      const normalized = text.trim().toLowerCase();
      const YES_RESPONSES = new Set(["y", "yes", "t", "true", "1"]);
      const NO_RESPONSES = new Set(["n", "no", "f", "false", "0"]);

      const isYes = YES_RESPONSES.has(normalized);
      const isNo = NO_RESPONSES.has(normalized);

      if (!isYes && !isNo) {
        await sendTelegramMessage(
          c.env,
          chatId,
          "Please reply yes or no (y/n/t/f/1/0)."
        );
        return c.json({ ok: true });
      }

      const completed = isYes;
      const habitId = session.habitIds[session.currentIndex];

      // Record the answer
      await upsertHabitLog(db, {
        id: crypto.randomUUID(),
        habitId,
        userId: session.userId,
        logDate: session.date,
        completed: completed ? 1 : 0,
        source: "telegram",
      });

      session.answers[habitId] = completed;
      session.currentIndex++;

      // Check if there are more questions
      if (session.currentIndex < session.habitIds.length) {
        // Update session and send next question
        await c.env.KV.put(sessionKey, JSON.stringify(session), { expirationTtl: 3600 });
        await sendTelegramMessage(
          c.env,
          chatId,
          session.questions[session.currentIndex]
        );
      } else {
        // All done — delete session and send summary
        await c.env.KV.delete(sessionKey);
        const summary = session.names
          .map((name, i) => {
            const done = session.answers[session.habitIds[i]];
            return `${done ? "\u2705" : "\u274c"} ${name}`;
          })
          .join("\n");
        await sendTelegramMessage(
          c.env,
          chatId,
          `Habit check-in complete!\n\n${summary}`
        );
      }

      return c.json({ ok: true });
    }
  } catch {
    // KV failure — fall through to normal journal entry processing
  }

  // Process the journal entry in the background to avoid Telegram webhook timeout
  c.executionCtx.waitUntil(
    processJournalMessage(c.env, db, user, chatId, message)
  );

  return c.json({ ok: true });
});

// POST /api/webhooks/lulu — print order status updates
webhooks.post("/lulu", async (c) => {
  // Verify HMAC signature
  if (c.env.LULU_API_SECRET) {
    const signature = c.req.header("Lulu-HMAC-SHA256");
    if (!signature) {
      return c.json({ error: "Missing signature" }, 403);
    }
    const body = await c.req.text();
    const { verifyWebhookSignature } = await import("../services/lulu");
    const valid = await verifyWebhookSignature(body, signature, c.env.LULU_API_SECRET);
    if (!valid) {
      return c.json({ error: "Invalid signature" }, 403);
    }
    // Parse the body we already read
    const payload = JSON.parse(body) as {
      topic: string;
      data: {
        id: number;
        status: { name: string };
        external_id: string;
        line_items?: Array<{
          tracking_id?: string | null;
          tracking_urls?: string[];
        }>;
      };
    };
    await handleLuluWebhook(c.env, payload);
  } else {
    // Reject webhooks when LULU_API_SECRET is not configured
    return c.json({ error: "Webhook verification not configured" }, 501);
  }

  return c.json({ ok: true });
});

async function handleLuluWebhook(
  env: Env,
  payload: {
    topic: string;
    data: {
      id: number;
      status: { name: string };
      external_id: string;
      line_items?: Array<{
        tracking_id?: string | null;
        tracking_urls?: string[];
      }>;
    };
  }
) {
  if (payload.topic !== "PRINT_JOB_STATUS_CHANGED") return;

  const { getPrintOrderByLuluJobId, updatePrintOrder, logProcessing } = await import("../db/queries");
  const db = createDb(env.DB);

  const order = await getPrintOrderByLuluJobId(db, String(payload.data.id));
  if (!order) return;

  const statusMap: Record<string, string> = {
    CREATED: "uploaded",
    ACCEPTED: "uploaded",
    IN_PRODUCTION: "in_production",
    SHIPPED: "shipped",
    REJECTED: "failed",
    ERROR: "failed",
  };

  const newStatus = statusMap[payload.data.status.name];
  if (!newStatus) return;

  const updates: Parameters<typeof updatePrintOrder>[2] = { status: newStatus };

  // Extract tracking URL if shipped
  if (newStatus === "shipped" && payload.data.line_items?.[0]?.tracking_urls?.[0]) {
    updates.trackingUrl = payload.data.line_items[0].tracking_urls[0];
  }

  if (newStatus === "failed") {
    updates.errorMessage = `Lulu status: ${payload.data.status.name}`;
  }

  await updatePrintOrder(db, order.id, updates);

  await logProcessing(db, {
    id: crypto.randomUUID(),
    action: "lulu_webhook",
    status: "success",
    details: JSON.stringify({
      orderId: order.id,
      luluJobId: payload.data.id,
      luluStatus: payload.data.status.name,
      mappedStatus: newStatus,
    }),
  });
}

export default webhooks;
