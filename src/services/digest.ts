import Anthropic from "@anthropic-ai/sdk";
import type { Database } from "../db/index";

// Glass contract: failure modes
export { AnthropicError, EmptyResponse, NoEntries } from "../lib/errors";
import type { VoiceStyle } from "./ai";
import {
  logProcessing,
  getEntriesForDate,
  getUserById,
  createDigest,
  updateUserLastDigestDate,
} from "../db/queries";

const VOICE_INSTRUCTIONS: Record<VoiceStyle, string> = {
  natural:
    "Keep the raw, authentic feel. Minimal smoothing — just weave entries together naturally.",
  conversational:
    "Keep it casual and flowing. The digest should read like you're telling a friend about your day.",
  reflective:
    "Add gentle structure and flow. Slightly more thoughtful, introspective tone.",
  polished:
    "Create a well-written, readable narrative. Preserve vocabulary and meaning but elevate the prose.",
};

function buildDigestPrompt(
  voiceStyle: VoiceStyle,
  voiceNotes: string | null,
  date: string
): string {
  const formatted = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return `You are creating a daily journal digest for ${formatted}.
You will receive multiple journal entries from this day, in chronological order.
Your task is to weave them into a single, cohesive narrative of the day.

Rules:
- Maintain chronological flow
- Preserve key details, emotions, and events
- Keep the author's voice and personality intact
- Voice style: ${voiceStyle} — ${VOICE_INSTRUCTIONS[voiceStyle]}
${voiceNotes ? `- Author's voice notes: "${voiceNotes}"` : ""}
- Write as a single continuous narrative, not bullet points or separate sections
- If entries include audio/video transcriptions, integrate them naturally
- Do NOT add events, emotions, or details that weren't mentioned
- For photo-only entries (no text), you may briefly note the photo if context is available, or skip

Return ONLY the digest narrative. No preamble, explanations, titles, or metadata.`;
}

export interface DigestEntry {
  rawContent: string | null;
  polishedContent: string | null;
  entryType: string;
  createdAt: string | null;
  media?: Array<{ transcription: string | null }>;
}

export interface DigestResult {
  digestContent: string;
  inputTokens: number;
  outputTokens: number;
}

function formatEntriesForPrompt(entries: DigestEntry[]): string {
  return entries
    .map((e, i) => {
      const time = e.createdAt
        ? new Date(e.createdAt).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })
        : `Entry ${i + 1}`;
      const content = e.polishedContent || e.rawContent || "";
      const transcription = e.media
        ?.map((m) => m.transcription)
        .filter(Boolean)
        .join("\n");

      let text = `[${time} — ${e.entryType}]`;
      if (content) text += `\n${content}`;
      if (transcription) text += `\n[Transcription]: ${transcription}`;
      if (!content && !transcription) text += "\n[Media only, no text]";
      return text;
    })
    .join("\n\n---\n\n");
}

export async function generateDigest(
  apiKey: string,
  entries: DigestEntry[],
  options: {
    voiceStyle?: VoiceStyle;
    voiceNotes?: string | null;
    date: string;
  }
): Promise<DigestResult> {
  const { voiceStyle = "natural", voiceNotes = null, date } = options;

  const client = new Anthropic({ apiKey });
  const userContent = formatEntriesForPrompt(entries);

  const message = await client.messages.create({
    model: "claude-3-5-haiku-20241022",
    max_tokens: 4096,
    system: buildDigestPrompt(voiceStyle, voiceNotes, date),
    messages: [{ role: "user", content: userContent }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || !textBlock.text?.trim()) {
    throw new Error("Anthropic did not return a non-empty text block for digest generation");
  }
  const digestContent = textBlock.text;

  return {
    digestContent,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };
}

/**
 * Generate and store a daily digest for a user.
 * Called by the cron handler at midnight in the user's timezone.
 */
export async function generateDailyDigest(
  env: { ANTHROPIC_API_KEY: string; TELEGRAM_BOT_TOKEN: string },
  db: Database,
  userId: string,
  date: string,
  sendNotification?: (chatId: string, message: string) => Promise<void>
): Promise<void> {
  const logId = crypto.randomUUID();

  try {
    const entriesForDate = await getEntriesForDate(db, userId, date);

    if (entriesForDate.length === 0) {
      await updateUserLastDigestDate(db, userId, date);
      return;
    }

    const user = await getUserById(db, userId);
    if (!user) return;

    const digestId = crypto.randomUUID();
    let polishedContent: string;
    let inputTokens = 0;
    let outputTokens = 0;

    if (entriesForDate.length === 1) {
      // Single entry — use its content directly, no AI call
      const entry = entriesForDate[0];
      polishedContent =
        entry.polishedContent || entry.rawContent || "[Media entry]";
    } else {
      // Multiple entries — generate AI narrative
      const result = await generateDigest(env.ANTHROPIC_API_KEY, entriesForDate, {
        voiceStyle: (user.voiceStyle as VoiceStyle) ?? "natural",
        voiceNotes: user.voiceNotes,
        date,
      });
      polishedContent = result.digestContent;
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
    }

    await createDigest(db, {
      id: digestId,
      userId,
      polishedContent,
      entryDate: date,
      sourceEntryIds: entriesForDate.map((e) => e.id),
    });

    await updateUserLastDigestDate(db, userId, date);

    await logProcessing(db, {
      id: logId,
      entryId: digestId,
      action: "digest_generated",
      status: "success",
      details: JSON.stringify({
        date,
        entryCount: entriesForDate.length,
        inputTokens,
        outputTokens,
      }),
    });

    // Notify via Telegram if user has it linked
    if (user.telegramChatId && sendNotification) {
      await sendNotification(
        user.telegramChatId,
        `Your daily digest for ${date} is ready!`
      ).catch(() => {});
    }
  } catch (error) {
    await logProcessing(db, {
      id: logId,
      action: "digest_generated",
      status: "error",
      details: JSON.stringify({
        userId,
        date,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    }).catch(() => {});
  }
}
