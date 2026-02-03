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
  logProcessing,
} from "../db/queries";
import type { TelegramUpdate } from "../services/telegram";
import {
  sendTelegramMessage,
  getTelegramFileUrl,
} from "../services/telegram";
import { downloadAndStore } from "../services/media";
import { polishEntryWithLogging } from "../services/ai";
import type { VoiceStyle } from "../services/ai";

const webhooks = new Hono<{ Bindings: Env }>();

/**
 * Process a Telegram journal message (text, media) in the background.
 */
async function processJournalMessage(
  env: Env,
  db: Database,
  user: { id: string; voiceStyle: string | null; voiceNotes: string | null },
  chatId: string,
  message: NonNullable<TelegramUpdate["message"]>
) {
  const text = message.text ?? message.caption ?? "";
  const entryId = crypto.randomUUID();

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

  let entryType = "text";
  let rawContent = text;

  // Process media attachments
  const mediaFile =
    message.voice ??
    message.audio ??
    message.video ??
    (message.photo ? message.photo[message.photo.length - 1] : null);

  if (mediaFile) {
    const fileUrl = await getTelegramFileUrl(env, mediaFile.file_id);

    if (fileUrl) {
      // Determine MIME type
      let mimeType = "application/octet-stream";
      if (message.voice) {
        mimeType = message.voice.mime_type ?? "audio/ogg";
        entryType = "audio";
      } else if (message.audio) {
        mimeType = message.audio.mime_type ?? "audio/mpeg";
        entryType = "audio";
      } else if (message.video) {
        mimeType = message.video.mime_type ?? "video/mp4";
        entryType = "video";
      } else if (message.photo) {
        mimeType = "image/jpeg";
        entryType = "photo";
      }

      try {
        await downloadAndStore(env, db, fileUrl, {
          userId: user.id,
          entryId,
          mimeType,
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

    // For voice/audio without text, set a placeholder so the entry isn't empty
    if ((entryType === "audio" || entryType === "video") && !rawContent) {
      rawContent = `[${entryType === "audio" ? "Voice" : "Video"} message]`;
    }
  }

  // Polish with AI
  let polishedContent: string | undefined;
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
        }
      );
      polishedContent = result.polishedContent;
    } catch {
      // AI polish failed — continue with raw content
    }
  }

  // Create the entry
  const today = new Date().toISOString().split("T")[0];
  await createEntry(db, {
    id: entryId,
    userId: user.id,
    rawContent: rawContent || undefined,
    polishedContent,
    entryType,
    source: "telegram",
    entryDate: today,
  });

  await sendTelegramMessage(
    env,
    chatId,
    "Got it! Your journal entry has been saved."
  );
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
      "Welcome to Journalizer! To link your account, go to Settings on journalizer.caseproof.workers.dev, " +
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
        "Sign in at journalizer.caseproof.workers.dev and link your Telegram in Settings."
    );
    return c.json({ ok: true });
  }

  // Process the journal entry in the background to avoid Telegram webhook timeout
  c.executionCtx.waitUntil(
    processJournalMessage(c.env, db, user, chatId, message)
  );

  return c.json({ ok: true });
});

// POST /api/webhooks/lulu — print order status from Lulu (Phase 2)
webhooks.post("/lulu", async (c) => {
  return c.json({ error: "Not implemented" }, 501);
});

export default webhooks;
