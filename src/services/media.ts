import type { Env } from "../types/env";
import type { Database } from "../db/index";
import { createMedia, getMediaById, getMediaByEntry } from "../db/queries";

export interface MediaRecord {
  id: string;
  entryId: string;
  userId: string;
  r2Key: string;
  mediaType: string;
  mimeType: string | null;
  fileSize: number | null;
  durationSeconds: number | null;
  transcription: string | null;
  thumbnailR2Key: string | null;
  createdAt: string | null;
}

export interface UploadResult {
  media: MediaRecord;
  url: string;
}

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/amr": "amr",
    "audio/ogg": "ogg",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/3gpp": "3gp",
    "video/webm": "webm",
  };
  return map[mimeType] ?? "bin";
}

function getMediaTypeFromMime(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return "document";
}

/**
 * Upload a media file to R2 and record metadata in D1.
 */
export async function uploadMedia(
  env: Env,
  db: Database,
  file: ArrayBuffer | ReadableStream,
  options: {
    userId: string;
    entryId: string;
    mimeType: string;
    fileSize: number;
    durationSeconds?: number;
  }
): Promise<MediaRecord> {
  const { userId, entryId, mimeType, fileSize, durationSeconds } = options;
  const id = crypto.randomUUID();
  const ext = getExtension(mimeType);
  const r2Key = `${userId}/${entryId}/${id}.${ext}`;
  const mediaType = getMediaTypeFromMime(mimeType);

  // Upload to R2
  await env.MEDIA.put(r2Key, file, {
    httpMetadata: { contentType: mimeType },
    customMetadata: { userId, entryId },
  });

  // Record in D1
  const record = await createMedia(db, {
    id,
    entryId,
    userId,
    r2Key,
    mediaType,
    mimeType,
    fileSize,
    durationSeconds,
  });

  if (!record) {
    // Clean up R2 if D1 insert failed
    await env.MEDIA.delete(r2Key);
    throw new Error("Failed to create media record");
  }

  return record as MediaRecord;
}

/**
 * Get a media file from R2, validating user ownership.
 */
export async function getMedia(
  env: Env,
  db: Database,
  mediaId: string,
  userId: string
): Promise<{ record: MediaRecord; object: R2ObjectBody } | null> {
  const record = await getMediaById(db, mediaId, userId);
  if (!record) return null;

  const object = await env.MEDIA.get(record.r2Key);
  if (!object) return null;

  return { record: record as MediaRecord, object };
}

/**
 * Get a URL for accessing media. Returns a path to the Worker proxy endpoint.
 */
export function getMediaUrl(mediaId: string): string {
  return `/api/media/${mediaId}`;
}

/**
 * Soft-delete media by removing from R2 and marking in D1.
 * In practice, the D1 record is cascade-deleted with the entry.
 */
export async function deleteMedia(
  env: Env,
  db: Database,
  mediaId: string,
  userId: string
): Promise<boolean> {
  const record = await getMediaById(db, mediaId, userId);
  if (!record) return false;

  // Delete from R2
  await env.MEDIA.delete(record.r2Key);
  if (record.thumbnailR2Key) {
    await env.MEDIA.delete(record.thumbnailR2Key);
  }

  return true;
}

/**
 * Download media from an external URL (e.g., Twilio MMS) and store in R2.
 */
export async function downloadAndStore(
  env: Env,
  db: Database,
  sourceUrl: string,
  options: {
    userId: string;
    entryId: string;
    mimeType: string;
  }
): Promise<MediaRecord> {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download media: ${response.status}`);
  }

  const fileSize = parseInt(response.headers.get("content-length") ?? "0", 10);
  const mimeType =
    response.headers.get("content-type") ?? options.mimeType;

  return uploadMedia(env, db, response.body!, {
    userId: options.userId,
    entryId: options.entryId,
    mimeType,
    fileSize,
  });
}
