# Task ID: 5

**Title:** Build R2 media storage service with upload, retrieval, and thumbnail generation

**Status:** pending

**Dependencies:** 2, 4

**Priority:** high

**Description:** Create a media storage abstraction layer for R2 that handles file uploads, generates thumbnails for images/videos, manages object keys, and provides secure retrieval URLs.

**Details:**

Implement `src/services/media.ts` with functions:

- `uploadMedia(file: File, userId: string, entryId: string): Promise<MediaRecord>` - Generates UUID-based R2 key (format: `{userId}/{entryId}/{uuid}.{ext}`), uploads to R2, stores metadata in D1 media table, returns media record
- `generateThumbnail(r2Key: string, mediaType: string): Promise<string>` - For images: resize to 300px width using ImageMagick or sharp (via wasm). For videos: extract first frame. Upload thumbnail to R2 with `-thumb` suffix
- `getMediaUrl(mediaId: string, userId: string): Promise<string>` - Validates user ownership, returns presigned R2 URL or proxied URL through worker
- `deleteMedia(mediaId: string, userId: string): Promise<void>` - Soft delete (mark in D1, keep in R2 for 30 days before cleanup)

Use R2's presigned URL feature for direct client uploads in web UI. Implement streaming for large file uploads.

Glass spec:
- `glass/services/media.glass` - Intent: secure binary file storage and retrieval; Contract: guarantees user isolation, file integrity, automatic cleanup, thumbnail generation

**Test Strategy:**

Test uploading various file types (JPEG, PNG, MP3, MP4). Verify R2 keys follow the correct format and files are accessible. Test thumbnail generation for images and videos. Confirm user can only access their own media. Test deletion and verify files remain in R2 for 30 days.

## Subtasks

### 5.1. Implement uploadMedia function with UUID-based R2 key generation

**Status:** pending  
**Dependencies:** None  

Create the core uploadMedia function that accepts File, userId, and entryId parameters, generates a UUID-based R2 object key following the format {userId}/{entryId}/{uuid}.{ext}, and sets up the foundation for file uploads.

**Details:**

In src/services/media.ts, implement uploadMedia(file: File, userId: string, entryId: string): Promise<MediaRecord>. Generate UUID using crypto.randomUUID(). Extract file extension from file.name or file.type. Construct R2 key as `${userId}/${entryId}/${uuid}.${ext}`. Validate userId and entryId are non-empty. Return structure should include mediaId, r2Key, fileSize, mimeType, createdAt.

### 5.2. Handle file streaming and upload to R2

**Status:** pending  
**Dependencies:** 5.1  

Implement the actual file upload logic to R2 using streaming for large files, utilizing the R2 binding from Cloudflare Workers environment.

**Details:**

Use env.R2_BUCKET.put(r2Key, fileStream) to upload file to R2. Implement streaming using ReadableStream for files larger than 10MB. Handle R2 upload errors and retry logic with exponential backoff. Set appropriate Content-Type metadata based on file.type. Calculate and store file size and checksum for integrity validation. Use R2's conditional puts to prevent overwrites.

### 5.3. Store media metadata in D1 media table

**Status:** pending  
**Dependencies:** 5.2  

After successful R2 upload, persist media metadata to the D1 database media table including all relevant file information and relationships.

**Details:**

Insert record into D1 media table with fields: id (UUID), userId, entryId, r2Key, fileName, fileSize, mimeType, thumbnailR2Key (nullable), uploadedAt, deletedAt (nullable). Use prepared statements to prevent SQL injection. Transaction handling to ensure atomicity between R2 upload and D1 insert. Return complete MediaRecord object after successful insert. Index on userId and entryId for efficient queries.

### 5.4. Implement thumbnail generation for images using wasm-based processing

**Status:** pending  
**Dependencies:** 5.2  

Create image thumbnail generation functionality using a wasm-based image processing library compatible with Cloudflare Workers (since sharp requires native modules).

**Details:**

Research and integrate wasm-based image processing library (e.g., @cf/image or custom wasm module). Implement image resizing to 300px width while maintaining aspect ratio. Support JPEG, PNG, WebP formats. Handle EXIF orientation. Convert output to JPEG with 80% quality for consistent thumbnail sizes. Fetch original image from R2, process in-memory, prepare for upload. Handle errors gracefully for corrupted or unsupported image formats.

### 5.5. Implement video thumbnail generation (extract first frame)

**Status:** pending  
**Dependencies:** 5.2  

Build video thumbnail extraction capability that captures the first frame of video files and converts it to a thumbnail image, working within Cloudflare Workers constraints.

**Details:**

Investigate Workers-compatible video processing options (may require external service or ffmpeg.wasm). Extract first frame at 1-second mark (not 0 to avoid black frames). Convert frame to JPEG image. Resize to 300px width. For Workers limitations, consider: (1) using Cloudflare Stream API if available, (2) offloading to external service via HTTP, or (3) implementing basic frame extraction with wasm. Support MP4, MOV, AVI formats. Handle videos without decodable frames.

### 5.6. Upload thumbnails to R2 with -thumb suffix

**Status:** pending  
**Dependencies:** 5.4, 5.5  

Implement the thumbnail upload logic that takes generated thumbnail images and stores them in R2 with a -thumb suffix while updating the media metadata.

**Details:**

Create uploadThumbnail helper function. Generate thumbnail R2 key by appending '-thumb' before file extension: `{userId}/{entryId}/{uuid}-thumb.jpg`. Upload thumbnail blob to R2 using same R2 binding. Set Content-Type to image/jpeg. Update D1 media record with thumbnailR2Key. Implement generateThumbnail(r2Key: string, mediaType: string): Promise<string> as main interface that orchestrates image/video thumbnail generation and upload, returning thumbnail R2 key.

### 5.7. Implement getMediaUrl with user ownership validation

**Status:** pending  
**Dependencies:** 5.3  

Create secure media retrieval function that validates user ownership before providing access to media files, preventing unauthorized access.

**Details:**

Implement getMediaUrl(mediaId: string, userId: string): Promise<string>. Query D1 media table for mediaId and verify userId matches and deletedAt IS NULL. Return 403 error if ownership validation fails. Return 404 if media not found. After validation, proceed to generate presigned URL or proxy URL. Log access attempts in processing_log for security audit. Consider caching validation results in KV with short TTL (5 minutes).

### 5.8. Implement R2 presigned URL generation

**Status:** pending  
**Dependencies:** 5.7  

Generate secure, time-limited presigned URLs for R2 objects that allow direct client access without exposing R2 credentials.

**Details:**

Use R2 binding's presigned URL capability (env.R2_BUCKET.createSignedUrl()). Set expiration to 1 hour (3600 seconds) for balance between usability and security. Include thumbnail URL in response if thumbnailR2Key exists. For direct client uploads from web UI, implement createUploadUrl(userId: string, entryId: string, fileName: string): Promise<{ uploadUrl: string, r2Key: string }> that returns presigned upload URL. Handle CORS headers appropriately for browser access.

### 5.9. Implement deleteMedia with soft delete logic

**Status:** pending  
**Dependencies:** 5.3  

Create soft delete functionality that marks media as deleted in D1 while keeping files in R2 for 30-day retention period before permanent cleanup.

**Details:**

Implement deleteMedia(mediaId: string, userId: string): Promise<void>. Validate user ownership (reuse validation logic from getMediaUrl). Update D1 media record: SET deletedAt = CURRENT_TIMESTAMP WHERE id = mediaId. Do NOT delete from R2 immediately. Mark both original file and thumbnail for deletion. Log deletion event in processing_log. Return success after D1 update. Deleted media should not appear in getMediaUrl queries (check deletedAt IS NULL).

### 5.10. Set up 30-day R2 cleanup strategy

**Status:** pending  
**Dependencies:** 5.9  

Implement automated cleanup process that permanently removes soft-deleted media files from R2 after 30-day retention period.

**Details:**

Create scheduled Cloudflare Worker cron trigger (daily at 2 AM UTC) in wrangler.toml. Implement cleanup function in src/jobs/cleanup-media.ts. Query D1 for media where deletedAt < NOW() - INTERVAL 30 DAYS. Batch delete from R2 (max 100 per run to avoid timeout). Delete both original file and thumbnail. Delete D1 records after successful R2 deletion. Log cleanup operations. Consider R2 lifecycle policies as alternative or supplement. Add retry logic for failed deletions.

### 5.11. Implement streaming for large file uploads

**Status:** pending  
**Dependencies:** 5.2  

Optimize file upload handling for large media files using streaming to avoid memory issues and timeouts in Cloudflare Workers environment.

**Details:**

Enhance uploadMedia to use ReadableStream for files >10MB. Implement chunked upload using R2's multipart upload API for files >100MB. Use TransformStream to process chunks without loading entire file in memory. Set appropriate Worker timeout considerations (max 30s for free tier, 15min for paid). Progress tracking using request context. Handle abort scenarios. For client-side, use presigned upload URLs to bypass Worker entirely for very large files (>100MB), uploading directly from browser to R2.

### 5.12. Create Glass spec for services/media.glass with security contracts

**Status:** pending  
**Dependencies:** 5.1, 5.2, 5.3, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11  

Document the media service in Glass framework format, defining intent, contract, security guarantees, and implementation specifications.

**Details:**

Create glass/services/media.glass file following Glass framework conventions from GLASS.md. Define Intent: 'Secure binary file storage and retrieval with user isolation and automatic lifecycle management'. Contract: 'Guarantees user isolation (users can only access own media), file integrity (checksums), automatic cleanup (30-day soft delete), thumbnail generation (images/videos), secure access (presigned URLs), streaming support (large files)'. Document all public functions: uploadMedia, generateThumbnail, getMediaUrl, deleteMedia. Specify error conditions, security boundaries, and performance characteristics. Reference R2 and D1 bindings.
