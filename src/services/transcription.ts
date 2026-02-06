import type { Env } from "../types/env";
import type { Database } from "../db/index";
import { logProcessing } from "../db/queries";

// Glass contract: failure modes
import { R2ObjectNotFound, EmptyTranscript } from "../lib/errors";
export { R2ObjectNotFound, EmptyTranscript };

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  durationSeconds: number;
  words: number;
}

/**
 * Transcribe audio using Cloudflare Workers AI (Whisper model).
 */
const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB (Telegram bot file limit)

export async function transcribeAudio(
  ai: Ai,
  audioData: ArrayBuffer,
  options?: { initialPrompt?: string }
): Promise<TranscriptionResult> {
  if (audioData.byteLength > MAX_AUDIO_BYTES) {
    throw new Error(
      `Audio too large for transcription: ${audioData.byteLength} bytes (max ${MAX_AUDIO_BYTES})`
    );
  }

  // whisper-large-v3-turbo requires base64 audio input
  const bytes = new Uint8Array(audioData);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64Audio = btoa(binary);

  const input: Record<string, unknown> = {
    audio: base64Audio,
    language: "en",
    vad_filter: true,
  };
  if (options?.initialPrompt) {
    input.initial_prompt = options.initialPrompt;
  }

  const result = await ai.run(
    "@cf/openai/whisper-large-v3-turbo" as Parameters<typeof ai.run>[0],
    input as Parameters<typeof ai.run>[1]
  );

  const text = (result as { text?: string }).text;
  if (!text || text.trim().length === 0) {
    throw new EmptyTranscript("No transcript returned from Workers AI Whisper");
  }

  // Extract duration from segments or transcription_info
  const info = (result as { transcription_info?: { duration?: number } }).transcription_info;
  const segments = (result as { segments?: Array<{ words?: Array<{ end?: number }> }> }).segments;
  let estimatedDuration = info?.duration ?? 0;
  if (!estimatedDuration && segments?.length) {
    const lastSeg = segments[segments.length - 1];
    const lastWord = lastSeg.words?.[lastSeg.words.length - 1];
    estimatedDuration = lastWord?.end ?? 0;
  }

  const wordCount = (result as { word_count?: number }).word_count ?? 0;

  return {
    transcript: text.trim(),
    confidence: 1.0,
    durationSeconds: estimatedDuration,
    words: wordCount,
  };
}

/**
 * Transcribe media from R2 and log the result.
 */
export async function transcribeFromR2(
  env: Env,
  db: Database,
  r2Key: string,
  entryId: string,
  options?: { initialPrompt?: string }
): Promise<TranscriptionResult> {
  const logId = crypto.randomUUID();

  try {
    const object = await env.MEDIA.get(r2Key);
    if (!object) {
      throw new R2ObjectNotFound(`R2 object not found: ${r2Key}`);
    }

    const audioBuffer = await object.arrayBuffer();
    const result = await transcribeAudio(env.AI, audioBuffer, {
      initialPrompt: options?.initialPrompt,
    });

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
