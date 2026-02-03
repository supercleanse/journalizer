import { Hono } from "hono";
import type { Env } from "../types/env";
import { createDb } from "../db/index";
import {
  getUserByPhone,
  createEntry,
  logProcessing,
} from "../db/queries";
import {
  validateTwilioSignature,
  twimlResponse,
} from "../services/sms";
import { downloadAndStore } from "../services/media";
import { transcribeFromR2 } from "../services/transcription";
import { polishEntryWithLogging } from "../services/ai";
import type { VoiceStyle } from "../services/ai";

const webhooks = new Hono<{ Bindings: Env }>();

// POST /api/webhooks/twilio — inbound SMS/MMS from Twilio
webhooks.post("/twilio", async (c) => {
  const formData = await c.req.parseBody();
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(formData)) {
    if (typeof value === "string") params[key] = value;
  }

  // Validate Twilio signature
  const signature = c.req.header("X-Twilio-Signature") ?? "";
  const requestUrl = new URL(c.req.url);
  const isValid = await validateTwilioSignature(
    c.env.TWILIO_AUTH_TOKEN,
    signature,
    `${requestUrl.origin}${requestUrl.pathname}`,
    params
  );

  if (!isValid) {
    return c.json({ error: "Invalid Twilio signature" }, 403);
  }

  const from = params["From"] ?? "";
  const body = params["Body"] ?? "";
  const numMedia = parseInt(params["NumMedia"] ?? "0", 10);

  const db = createDb(c.env.DB);

  // Look up user by verified phone number
  const user = await getUserByPhone(db, from);
  if (!user) {
    return twimlResponse(
      "This phone number is not registered with Journalizer. " +
        "Sign up at journalizer.com and verify your phone number to start journaling via SMS."
    );
  }

  const entryId = crypto.randomUUID();
  const logId = crypto.randomUUID();

  await logProcessing(db, {
    id: logId,
    entryId,
    action: "sms_receive",
    status: "success",
    details: JSON.stringify({ from, numMedia, bodyLength: body.length }),
  });

  // Determine entry type
  let entryType = "text";
  let rawContent = body;

  // Process media attachments
  if (numMedia > 0) {
    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = params[`MediaUrl${i}`];
      const mediaContentType = params[`MediaContentType${i}`] ?? "application/octet-stream";

      if (!mediaUrl) continue;

      try {
        const mediaRecord = await downloadAndStore(c.env, db, mediaUrl, {
          userId: user.id,
          entryId,
          mimeType: mediaContentType,
        });

        // Determine entry type from first media
        if (i === 0) {
          if (mediaContentType.startsWith("image/")) entryType = "photo";
          else if (mediaContentType.startsWith("audio/")) entryType = "audio";
          else if (mediaContentType.startsWith("video/")) entryType = "video";
        }

        // Transcribe audio/video
        if (
          mediaContentType.startsWith("audio/") ||
          mediaContentType.startsWith("video/")
        ) {
          try {
            const transcription = await transcribeFromR2(
              c.env,
              db,
              mediaRecord.r2Key,
              entryId,
              mediaContentType
            );
            // Prepend or use transcription as raw content
            rawContent = rawContent
              ? `${rawContent}\n\n[Transcription]: ${transcription.transcript}`
              : transcription.transcript;
          } catch (err) {
            await logProcessing(db, {
              id: crypto.randomUUID(),
              entryId,
              action: "transcription",
              status: "error",
              details: JSON.stringify({
                error: err instanceof Error ? err.message : "Transcription failed",
                r2Key: mediaRecord.r2Key,
              }),
            }).catch(() => {});
          }
        }
      } catch (err) {
        await logProcessing(db, {
          id: crypto.randomUUID(),
          entryId,
          action: "media_download",
          status: "error",
          details: JSON.stringify({
            error: err instanceof Error ? err.message : "Media download failed",
            mediaUrl,
          }),
        }).catch(() => {});
      }
    }
  }

  // Polish with AI
  let polishedContent: string | undefined;
  if (rawContent) {
    try {
      const result = await polishEntryWithLogging(
        db,
        c.env.ANTHROPIC_API_KEY,
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
    source: "sms",
    entryDate: today,
  });

  return twimlResponse("Got it! Your journal entry has been saved. ✏️");
});

// POST /api/webhooks/lulu — print order status from Lulu (Phase 2)
webhooks.post("/lulu", async (c) => {
  return c.json({ error: "Not implemented" }, 501);
});

export default webhooks;
