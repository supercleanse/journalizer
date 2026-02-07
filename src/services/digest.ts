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
  return `Combine the author's journal entries from ${formatted} into one entry. Use the author's own words.

How to do this:
1. Put the entries in chronological order.
2. Copy the author's sentences as-is. Fix typos and grammar only.
3. Separate entries with a paragraph break. Do not add transition sentences.
4. If an entry is a transcription, include it as if the author wrote it.
5. Skip photo-only entries with no text.

Do NOT:
- Rewrite, rephrase, or paraphrase any of the author's words
- Add transitions like "The day began with..." or "Later that evening..."
- Add introductory or concluding sentences
- Change word choices (keep "got", "stuff", "kid", etc. exactly as written)
- Summarize or condense — the output should be about the same length as all inputs combined
- Add any observations or commentary the author didn't write

You SHOULD add paragraph breaks to improve readability — especially for long blocks of transcribed audio. Break into paragraphs at natural topic shifts.

The result should read like the author's entries pasted together with good paragraph formatting, with typos fixed. That's it.
${voiceNotes ? `\nAuthor's notes: "${voiceNotes}"` : ""}
Return ONLY the combined entry text. No preamble or titles.`;
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
      const content = e.rawContent || e.polishedContent || "";
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
  date: string
): Promise<string | null> {
  const logId = crypto.randomUUID();

  try {
    const entriesForDate = await getEntriesForDate(db, userId, date);

    if (entriesForDate.length === 0) {
      await updateUserLastDigestDate(db, userId, date);
      return null;
    }

    const user = await getUserById(db, userId);
    if (!user) return null;

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

    return polishedContent;
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
    return null;
  }
}
