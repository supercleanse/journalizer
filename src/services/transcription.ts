import type { Env } from "../types/env";
import type { Database } from "../db/index";
import { logProcessing } from "../db/queries";
import { ApiError, R2ObjectNotFound, EmptyTranscript } from "../lib/errors";

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  durationSeconds: number;
  words: number;
}

interface DeepgramResponse {
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        transcript?: string;
        confidence?: number;
        words?: Array<{
          word: string;
          start: number;
          end: number;
          confidence: number;
        }>;
      }>;
    }>;
  };
  metadata?: {
    duration?: number;
  };
}

/**
 * Transcribe audio/video using Deepgram Nova-3 pre-recorded API.
 */
export async function transcribeMedia(
  apiKey: string,
  audioSource: ArrayBuffer | ReadableStream | string,
  options: {
    mimeType?: string;
  } = {}
): Promise<TranscriptionResult> {
  const isUrl = typeof audioSource === "string";

  const requestBody = isUrl
    ? JSON.stringify({ url: audioSource })
    : audioSource;

  const headers: Record<string, string> = {
    Authorization: `Token ${apiKey}`,
  };

  if (isUrl) {
    headers["Content-Type"] = "application/json";
  } else if (options.mimeType) {
    headers["Content-Type"] = options.mimeType;
  }

  const params = new URLSearchParams({
    model: "nova-3",
    punctuate: "true",
    paragraphs: "true",
    diarize: "true",
    smart_format: "true",
  });

  const response = await fetch(
    `https://api.deepgram.com/v1/listen?${params}`,
    {
      method: "POST",
      headers,
      body: requestBody,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new ApiError(`Deepgram API error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as DeepgramResponse;

  const channel = data.results?.channels?.[0];
  const alternative = channel?.alternatives?.[0];

  if (!alternative?.transcript) {
    throw new EmptyTranscript("No transcript returned from Deepgram");
  }

  return {
    transcript: alternative.transcript,
    confidence: alternative.confidence ?? 0,
    durationSeconds: data.metadata?.duration ?? 0,
    words: alternative.words?.length ?? 0,
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
  mimeType: string,
  apiKey: string
): Promise<TranscriptionResult> {
  const logId = crypto.randomUUID();

  try {
    const object = await env.MEDIA.get(r2Key);
    if (!object) {
      throw new R2ObjectNotFound(`R2 object not found: ${r2Key}`);
    }

    const audioBuffer = await object.arrayBuffer();

    const result = await transcribeMedia(apiKey, audioBuffer, {
      mimeType,
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
