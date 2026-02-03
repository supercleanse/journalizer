import Anthropic from "@anthropic-ai/sdk";
import type { Database } from "../db/index";
import { logProcessing } from "../db/queries";

export type VoiceStyle = "natural" | "conversational" | "reflective" | "polished";

const VOICE_INSTRUCTIONS: Record<VoiceStyle, string> = {
  natural: "Make minimal edits. Fix typos and grammar only. Keep the raw, authentic feel.",
  conversational:
    "Keep it casual and flowing. Light cleanup — fix obvious errors but preserve slang and personality.",
  reflective:
    "Add gentle sentence flow and structure. Keep their words but improve readability. Slightly more thoughtful tone.",
  polished:
    "Thorough editing for readability and flow. Preserve the author's vocabulary and meaning but elevate the writing.",
};

function buildSystemPrompt(voiceStyle: VoiceStyle, voiceNotes: string | null): string {
  return `You are a journal editor. Your job is to take a raw journal entry and lightly polish it for readability.

Rules:
- Keep the author's voice, words, and personality intact
- Fix obvious typos, grammar, and punctuation
- Add paragraph breaks where natural
- Do NOT add content the author didn't write
- Do NOT change the meaning or tone
- The result should read like a natural journal entry, not a blog post
- Voice style preference: ${voiceStyle} — ${VOICE_INSTRUCTIONS[voiceStyle]}
${voiceNotes ? `- Additional voice notes from the author: "${voiceNotes}"` : ""}

Return ONLY the polished journal entry text. No explanations, no preamble, no quotes.`;
}

export interface PolishResult {
  polishedContent: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Polish a raw journal entry using Anthropic Claude.
 */
export async function polishEntry(
  apiKey: string,
  rawContent: string,
  options: {
    voiceStyle?: VoiceStyle;
    voiceNotes?: string | null;
  } = {}
): Promise<PolishResult> {
  const { voiceStyle = "natural", voiceNotes = null } = options;

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-haiku-4-20250414",
    max_tokens: 2048,
    system: buildSystemPrompt(voiceStyle, voiceNotes),
    messages: [{ role: "user", content: rawContent }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  const polishedContent = textBlock?.text ?? rawContent;

  return {
    polishedContent,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };
}

/**
 * Polish an entry and log the processing result to D1.
 */
export async function polishEntryWithLogging(
  db: Database,
  apiKey: string,
  entryId: string,
  rawContent: string,
  options: {
    voiceStyle?: VoiceStyle;
    voiceNotes?: string | null;
  } = {}
): Promise<PolishResult> {
  const logId = crypto.randomUUID();

  try {
    const result = await polishEntry(apiKey, rawContent, options);

    await logProcessing(db, {
      id: logId,
      entryId,
      action: "polish",
      status: "success",
      details: JSON.stringify({
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        voiceStyle: options.voiceStyle ?? "natural",
      }),
    });

    return result;
  } catch (error) {
    await logProcessing(db, {
      id: logId,
      entryId,
      action: "polish",
      status: "failed",
      details: JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    });
    throw error;
  }
}
