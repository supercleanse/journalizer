import type { Env } from "../types/env";
import type { Database } from "../db/index";
import { logProcessing } from "../db/queries";

// Glass contract: failure modes
export { R2ObjectNotFound, EmptyTranscript } from "../lib/errors";
import { R2ObjectNotFound, EmptyTranscript } from "../lib/errors";

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  durationSeconds: number;
  words: number;
}

/**
 * Transcribe audio using Cloudflare Workers AI (Whisper model).
 */
export async function transcribeAudio(
  ai: Ai,
  audioData: ArrayBuffer
): Promise<TranscriptionResult> {
  const audioArray = [...new Uint8Array(audioData)];

  const result = await ai.run("@cf/openai/whisper", {
    audio: audioArray,
  });

  if (!result.text || result.text.trim().length === 0) {
    throw new EmptyTranscript("No transcript returned from Workers AI Whisper");
  }

  const lastWord = result.words?.[result.words.length - 1];
  const estimatedDuration = lastWord?.end ?? 0;

  return {
    transcript: result.text.trim(),
    confidence: 1.0,
    durationSeconds: estimatedDuration,
    words: result.word_count ?? result.words?.length ?? 0,
  };
}

/**
 * Transcribe media from R2 and log the result.
 */
export async function transcribeFromR2(
  env: Env,
  db: Database,
  r2Key: string,
  entryId: string
): Promise<TranscriptionResult> {
  const logId = crypto.randomUUID();

  try {
    const object = await env.MEDIA.get(r2Key);
    if (!object) {
      throw new R2ObjectNotFound(`R2 object not found: ${r2Key}`);
    }

    const audioBuffer = await object.arrayBuffer();
    const result = await transcribeAudio(env.AI, audioBuffer);

    await logProcessing(db, {
      id: logId,
      entryId,
      action: "transcribe",
      status: "success",
      details: JSON.stringify({
        durationSeconds: result.durationSeconds,
        confidence: result.confidence,
        wordCount: result.words,
      }),
    });

    return result;
  } catch (error) {
    await logProcessing(db, {
      id: logId,
      entryId,
      action: "transcribe",
      status: "failed",
      details: JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        r2Key,
      }),
    });
    throw error;
  }
}
