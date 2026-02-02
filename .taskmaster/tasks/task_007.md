# Task ID: 7

**Title:** Integrate Deepgram Nova-3 API for audio and video transcription

**Status:** pending

**Dependencies:** 5

**Priority:** high

**Description:** Implement speech-to-text transcription service using Deepgram Nova-3 that processes audio and video files, generates accurate transcriptions with punctuation and paragraphs, and handles long-form content.

**Details:**

Create `src/services/transcription.ts`:

```typescript
async function transcribeMedia(r2Key: string, mediaType: 'audio' | 'video'): Promise<TranscriptionResult>
```

Process flow:
1. Download media file from R2 (stream for large files)
2. For video: extract audio track using FFmpeg (via wasm or separate extraction step)
3. Send to Deepgram Nova-3 pre-recorded API with options: punctuation=true, paragraphs=true, diarize=true (speaker detection)
4. Parse response and extract transcript text
5. Return { transcript: string, confidence: number, duration: number, words: Word[] }

Use Deepgram's JavaScript SDK. Cost: ~$0.0043/minute. Store transcription in media.transcription column. Handle failures gracefully (poor audio quality, unsupported formats).

Glass spec:
- `glass/services/transcription.glass` - Intent: convert speech to text for journal entries; Contract: guarantees punctuation, speaker diarization, timestamp accuracy, failure on unsupported formats

**Test Strategy:**

Test with clear audio (voice memo), noisy audio (background noise), multi-speaker audio, various accents. Test video files and verify audio extraction. Measure accuracy on test set. Test handling of very long files (>30 min). Verify cost tracking in processing_log.

## Subtasks

### 7.1. Set up Deepgram SDK and create transcription service skeleton

**Status:** pending  
**Dependencies:** None  

Install Deepgram JavaScript SDK, create src/services/transcription.ts with TypeScript interfaces for TranscriptionResult, Word, and the main transcribeMedia function signature.

**Details:**

Install @deepgram/sdk package. Create src/services/transcription.ts with types: TranscriptionResult { transcript: string, confidence: number, duration: number, words: Word[] }, Word { word: string, start: number, end: number, confidence: number, speaker?: number }. Add Deepgram API key to wrangler.toml environment bindings. Initialize Deepgram client with API key from environment.

### 7.2. Implement R2 media download with streaming for large files

**Status:** pending  
**Dependencies:** 7.1  

Create function to download media files from R2 bucket with streaming support to handle large audio/video files efficiently in Workers environment.

**Details:**

Implement downloadMediaFromR2(r2Key: string): Promise<ReadableStream> that retrieves file from R2 bucket. Use R2 bucket.get() with streaming. Handle cases where file doesn't exist (return error). For files >10MB, ensure streaming is used to avoid memory limits. Add content-type detection to validate media type.

### 7.3. Research and implement FFmpeg solution for video audio extraction

**Status:** pending  
**Dependencies:** 7.1  

Evaluate and implement FFmpeg-based audio extraction from video files, either using FFmpeg.wasm in Workers or an external service approach.

**Details:**

Research options: (1) @ffmpeg/ffmpeg wasm library in Workers, (2) external microservice with FFmpeg binary, (3) Cloudflare Queues + Durable Objects for heavy processing. Due to Workers 128MB memory limit and CPU constraints, likely need external service or Queue-based approach. Implement extractAudioFromVideo(videoStream: ReadableStream): Promise<ReadableStream> that returns audio-only stream. Support common video formats: MP4, MOV, WEBM.

### 7.4. Integrate Deepgram Nova-3 pre-recorded API with required features

**Status:** pending  
**Dependencies:** 7.1, 7.2  

Implement the core Deepgram API integration using pre-recorded transcription endpoint with punctuation, paragraphs, and speaker diarization enabled.

**Details:**

Create sendToDeepgram(audioStream: ReadableStream, options): Promise<DeepgramResponse> function. Configure Deepgram options: { punctuate: true, paragraphs: true, diarize: true, model: 'nova-2' (or latest Nova-3), smart_format: true }. Handle streaming audio upload to Deepgram. Use prerecorded.transcribeFile() method from SDK. Set appropriate timeout (5+ minutes for long files).

### 7.5. Parse Deepgram response and extract transcript data

**Status:** pending  
**Dependencies:** 7.4  

Implement response parsing logic to extract transcript text, confidence scores, duration, word-level timestamps, and speaker information from Deepgram API response.

**Details:**

Create parseDeepgramResponse(response): TranscriptionResult function. Extract: (1) transcript text from response.results.channels[0].alternatives[0].transcript, (2) confidence score (average word confidences), (3) duration from metadata, (4) words array with timestamps and speaker labels. Handle multiple speakers in diarized output. Calculate overall confidence as weighted average. Format paragraphs from Deepgram's paragraph markers.

### 7.6. Implement long-form content handling for files >30 minutes

**Status:** pending  
**Dependencies:** 7.4  

Add support for transcribing long audio/video files (>30 minutes) by handling Deepgram's processing time limits and implementing chunking or polling strategies if needed.

**Details:**

Deepgram pre-recorded API supports long files but may take time to process. Implement timeout handling with retries. For files >1 hour, consider: (1) using Deepgram's callback URL feature for async processing, (2) implementing progress tracking in processing_log, (3) setting Workers timeout appropriately or using Durable Objects for long-running tasks. Add file duration estimation before transcription.

### 7.7. Implement comprehensive error handling for audio quality and format issues

**Status:** pending  
**Dependencies:** 7.4, 7.5  

Add error handling for poor audio quality, unsupported formats, Deepgram API failures, and network timeouts with appropriate user-facing error messages.

**Details:**

Handle error cases: (1) unsupported format - validate file extension/MIME type before processing, (2) poor audio quality - check Deepgram confidence scores, return warning if <0.6 average, (3) API failures - retry with exponential backoff (max 3 retries), (4) network timeouts - set reasonable timeout (10min default), (5) API rate limits - return 429 with retry-after. Create custom error types: TranscriptionError, UnsupportedFormatError, PoorQualityWarning. Log all errors to processing_log.

### 7.8. Store transcription results in D1 media.transcription column

**Status:** pending  
**Dependencies:** 7.5  

Implement database update logic to save transcription text, confidence score, and metadata to the media table after successful transcription.

**Details:**

Update media table: SET transcription = ?, transcription_confidence = ?, transcription_duration = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?. Store full transcript in transcription column (TEXT type). Optionally store word-level data as JSON in separate column or related table for future features (word search, timestamp navigation). Update processing_log with success status and cost.

### 7.9. Implement cost tracking in processing_log table

**Status:** pending  
**Dependencies:** 7.5  

Add cost calculation and logging for each transcription request to track Deepgram API usage and expenses in the processing_log table.

**Details:**

Calculate cost: duration_minutes * $0.0043 (Deepgram Nova-3 rate). Insert into processing_log: { user_id, media_id, operation_type: 'transcription', provider: 'deepgram', model: 'nova-3', input_duration: seconds, cost_usd: calculated_cost, status: 'success'|'failed', error_message?, created_at }. Track cumulative costs per user for billing/monitoring. Add cost field to TranscriptionResult return type.

### 7.10. Create Glass specification for transcription service

**Status:** pending  
**Dependencies:** 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9  

Write glass/services/transcription.glass following Glass Framework methodology to document the transcription service's intent, contract, state management, and error scenarios.

**Details:**

Create glass/services/transcription.glass with: Intent - convert speech to text for journal entries with high accuracy; Contract - guarantees punctuation, speaker diarization when multiple speakers detected, word-level timestamp accuracy ±100ms, failure on unsupported formats with clear error messages; State - processes media from R2, updates D1 media table; Errors - UnsupportedFormatError, PoorQualityWarning (confidence <0.6), ApiTimeoutError, RateLimitError; Dependencies - Deepgram Nova-3 API, R2 storage, D1 database; Performance - <30s for 5min audio, <5min for 60min audio.

### 7.11. Integrate transcribeMedia into main workflow and add end-to-end tests

**Status:** pending  
**Dependencies:** 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9  

Wire up the transcription service to the media upload workflow, implement the complete transcribeMedia function orchestrating all components, and create comprehensive end-to-end tests.

**Details:**

Complete transcribeMedia(r2Key: string, mediaType: 'audio' | 'video'): Promise<TranscriptionResult> orchestration: (1) download from R2, (2) extract audio if video, (3) send to Deepgram, (4) parse response, (5) store in D1, (6) log cost. Add to media processing pipeline (likely called after upload). Handle race conditions if multiple workers process same file. Add API endpoint POST /api/media/:id/transcribe for manual retranscription. Create integration tests with real Deepgram API (test mode) covering all scenarios.
