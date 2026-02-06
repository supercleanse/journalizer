import Anthropic from "@anthropic-ai/sdk";
import type { Database } from "../db/index";
import { logProcessing } from "../db/queries";

// Glass contract: failure modes
export { ApiError, RateLimited, InvalidResponse } from "../lib/errors";

export type VoiceStyle = "natural" | "conversational" | "reflective" | "polished";

function buildSystemPrompt(voiceStyle: VoiceStyle, voiceNotes: string | null, dictionaryHint?: string): string {
  return `You are a copy editor. Fix ONLY typos, spelling, and broken grammar. Do not change anything else.

Your output should be almost identical to the input. If a sentence is grammatically fine, copy it exactly. Do not rephrase, reword, restructure, or "improve" anything. Do not change word choices. Do not add or remove words. Do not add transitions, introductions, or conclusions. Just fix errors and return the text.

You SHOULD add paragraph breaks to improve readability — especially for long blocks of transcribed audio that come in as one chunk. Break into paragraphs at natural topic shifts.
${dictionaryHint || ""}${voiceNotes ? `\nAuthor's notes: "${voiceNotes}"` : ""}
Return ONLY the cleaned-up text.`;
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
    dictionaryHint?: string;
  } = {}
): Promise<PolishResult> {
  const { voiceStyle = "natural", voiceNotes = null, dictionaryHint } = options;

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-3-5-haiku-20241022",
    max_tokens: 2048,
    system: buildSystemPrompt(voiceStyle, voiceNotes, dictionaryHint),
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
    dictionaryHint?: string;
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
