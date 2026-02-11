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
 * Remove filler words from transcribed text.
 * Conservative: only removes words in clearly filler positions to preserve meaning.
 */
export function cleanFillerWords(text: string): string {
  let cleaned = text;

  // Filler words that are almost always meaningless in transcription
  const fillers = ['um', 'uh', 'erm', 'ah', 'hmm'];

  for (const filler of fillers) {
    // Between commas: ", um," → ","
    cleaned = cleaned.replace(new RegExp(`,\\s*\\b${filler}\\b\\s*,`, 'gi'), ',');
    // At start of text: "Um, ..." → "..."
    cleaned = cleaned.replace(new RegExp(`^\\b${filler}\\b[,.]?\\s*`, 'i'), '');
    // After sentence boundary: ". Um, " → ". "
    cleaned = cleaned.replace(new RegExp(`([.!?])\\s*\\b${filler}\\b[,.]?\\s+`, 'gi'), '$1 ');
  }

  // "like" only when clearly a filler (between commas): ", like," → ","
  cleaned = cleaned.replace(/,\s*\blike\b\s*,/gi, ',');
  // "Like, " at start of text
  cleaned = cleaned.replace(/^\blike\b,\s*/i, '');
  // "Like, " after sentence boundary
  cleaned = cleaned.replace(/([.!?])\s*\blike\b,\s+/gi, '$1 ');

  // "you know" as filler (between commas): ", you know," → ","
  cleaned = cleaned.replace(/,\s*\byou know\b\s*,/gi, ',');
  // "You know, " at start of text
  cleaned = cleaned.replace(/^\byou know\b,\s*/i, '');
  // "You know, " after sentence boundary
  cleaned = cleaned.replace(/([.!?])\s*\byou know\b,\s+/gi, '$1 ');

  // "I mean" as filler at start or after sentence boundary (only when followed by comma)
  cleaned = cleaned.replace(/^\bI mean\b,\s*/i, '');
  cleaned = cleaned.replace(/([.!?])\s*\bI mean\b,\s+/gi, '$1 ');

  // Clean up artifacts
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  cleaned = cleaned.replace(/\s+([.,!?])/g, '$1');
  cleaned = cleaned.replace(/,\s*,/g, ',');

  // Re-capitalize after filler removal
  cleaned = cleaned.replace(/^([a-z])/, (_, c: string) => c.toUpperCase());
  cleaned = cleaned.replace(/([.!?]\s+)([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase());

  return cleaned.trim();
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
  // Use chunked String.fromCharCode to avoid O(n²) string concatenation
  const bytes = new Uint8Array(audioData);
  const CHUNK_SIZE = 8192;
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE)));
  }
  const base64Audio = btoa(chunks.join(''));

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
    transcript: cleanFillerWords(text.trim()),
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
