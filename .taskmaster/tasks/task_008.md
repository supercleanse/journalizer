# Task ID: 8

**Title:** Build journal entries API with CRUD operations and pagination

**Status:** pending

**Dependencies:** 4, 6

**Priority:** high

**Description:** Implement REST API endpoints for creating, reading, updating, and deleting journal entries with support for filtering, pagination, search, and media attachments.

**Details:**

Create `src/routes/api/entries.ts` with endpoints:

- GET /api/entries - List entries with query params: page, limit (default 20), startDate, endDate, type (text/audio/video/photo), source (sms/web), search (full-text). Return paginated results with total count
- GET /api/entries/:id - Get single entry with all media attachments, includes both raw and polished content
- POST /api/entries - Create new entry from web. Body: { rawContent, entryDate, tags?, mood?, location?, mediaIds[]?, polishWithAI: boolean }. If polishWithAI=true, send to AI service asynchronously
- PUT /api/entries/:id - Update entry (only polished_content, tags, mood editable)
- DELETE /api/entries/:id - Soft delete (mark deleted in entries table, cascade to media)

All operations filtered by userId from JWT. Validate entryDate is not in future. Use Zod for request validation.

Glass spec:
- `glass/routes/entries.glass` - Intent: expose journal entry management to users; Contract: guarantees user isolation, input validation, pagination correctness, atomic operations

**Test Strategy:**

Test CRUD operations with authenticated requests. Verify pagination works correctly with different page sizes. Test filtering by date range, type, source. Verify users cannot access others' entries. Test search functionality. Validate error responses for invalid inputs.

## Subtasks

### 8.1. Implement GET /api/entries with pagination (page, limit params)

**Status:** pending  
**Dependencies:** None  

Create the base endpoint for listing journal entries with pagination support using page and limit query parameters (default limit: 20)

**Details:**

Create `src/routes/api/entries.ts` and implement GET /api/entries endpoint. Accept query params: page (default 1), limit (default 20, max 100). Query entries table with OFFSET and LIMIT. Return { entries: [], pagination: { page, limit, total, totalPages } }. Use Drizzle ORM for type-safe queries. Ensure userId filtering is applied (from JWT context).

### 8.2. Add filtering by date range (startDate, endDate)

**Status:** pending  
**Dependencies:** 8.1  

Extend GET /api/entries to support filtering entries by date range using startDate and endDate query parameters

**Details:**

Add optional query params: startDate, endDate (ISO 8601 format). Parse dates and validate format using Zod. Add WHERE clause: entry_date >= startDate AND entry_date <= endDate. Handle timezone considerations (store as UTC, filter inclusively). Return 400 if startDate > endDate or dates are invalid.

### 8.3. Add filtering by type and source

**Status:** pending  
**Dependencies:** 8.2  

Extend GET /api/entries to support filtering by entry type (text/audio/video/photo) and source (sms/web)

**Details:**

Add optional query params: type (text|audio|video|photo), source (sms|web). Validate using Zod enums matching DB schema. Add WHERE clauses for type and source when provided. Support multiple values (comma-separated or array). Combine with existing date and pagination filters using AND logic.

### 8.4. Implement full-text search functionality

**Status:** pending  
**Dependencies:** 8.3  

Add full-text search capability to GET /api/entries endpoint, searching across raw_content and polished_content fields

**Details:**

Add optional query param: search (string). Implement using SQLite FTS5 virtual table or LIKE queries. Create FTS5 table `entries_fts` with triggers to sync with entries table. Search both raw_content and polished_content. Use ranking for relevance. If FTS5 not available in D1, use: WHERE (raw_content LIKE '%searchTerm%' OR polished_content LIKE '%searchTerm%'). Sanitize input to prevent SQL injection.

### 8.5. Implement GET /api/entries/:id with media attachments

**Status:** pending  
**Dependencies:** 8.1  

Create endpoint to retrieve a single journal entry by ID, including all associated media attachments with raw and polished content

**Details:**

Implement GET /api/entries/:id. Validate UUID format using Zod. Query entries table by id and userId (ensure user isolation). JOIN with media table to fetch all attachments. Return: { id, rawContent, polishedContent, entryDate, type, source, mood, tags, location, createdAt, updatedAt, media: [{ id, type, url, transcription, thumbnailUrl }] }. Return 404 if not found or belongs to different user.

### 8.6. Implement POST /api/entries with Zod validation

**Status:** pending  
**Dependencies:** 8.1  

Create endpoint for creating new journal entries from web interface with comprehensive input validation using Zod schemas

**Details:**

Implement POST /api/entries. Define Zod schema: { rawContent: string (required), entryDate: ISO date (required, not future), tags: string[] (optional), mood: string (optional), location: string (optional), mediaIds: UUID[] (optional), polishWithAI: boolean (default false) }. Validate entryDate is not in future. Generate entry ID (UUID). Insert into entries table with type='text', source='web', userId from JWT. Verify mediaIds belong to user if provided. Return 201 with created entry.

### 8.7. Integrate async AI polish when polishWithAI=true

**Status:** pending  
**Dependencies:** 8.6  

Add asynchronous AI polishing workflow when creating entries with polishWithAI flag enabled

**Details:**

When polishWithAI=true in POST /api/entries: (1) Create entry with polished_content=null, (2) Add record to processing_log table with operation='ai_polish', status='pending', (3) Trigger async Worker/Queue job to call AI service (OpenAI/Anthropic), (4) Update entry.polished_content when complete, (5) Update processing_log status='completed'/'failed'. Use Cloudflare Queues or Durable Objects for async processing. Return 201 immediately without waiting for AI.

### 8.8. Implement PUT /api/entries/:id for editing polished content/tags/mood

**Status:** pending  
**Dependencies:** 8.5  

Create endpoint to update existing journal entries, allowing edits to polished_content, tags, and mood fields only

**Details:**

Implement PUT /api/entries/:id. Zod schema: { polishedContent: string (optional), tags: string[] (optional), mood: string (optional) }. At least one field required. Query entry by id and userId (user isolation). Return 404 if not found/unauthorized. Update only provided fields. Set updated_at to current timestamp. Return 200 with updated entry. DO NOT allow editing rawContent, entryDate, type, source.

### 8.9. Implement DELETE /api/entries/:id with soft delete and cascade

**Status:** pending  
**Dependencies:** 8.5  

Create endpoint to soft delete journal entries, marking them as deleted in database and cascading to associated media

**Details:**

Implement DELETE /api/entries/:id. Query entry by id and userId (user isolation). Return 404 if not found/unauthorized. Soft delete: SET deleted_at = CURRENT_TIMESTAMP in entries table (add deleted_at column if not exists). Cascade: also set deleted_at on all related media records. Modify all GET queries to filter WHERE deleted_at IS NULL. Return 204 No Content on success. Consider adding UNDELETE endpoint for recovery.

### 8.10. Ensure all operations filtered by userId from JWT

**Status:** pending  
**Dependencies:** 8.1, 8.5, 8.6, 8.8, 8.9  

Implement and enforce user isolation across all endpoints, ensuring users can only access their own journal entries

**Details:**

Extract userId from JWT token in middleware (use Hono's context). Add userId to every database query WHERE clause: WHERE user_id = ? AND deleted_at IS NULL. Audit all endpoints (GET list, GET single, POST, PUT, DELETE) to ensure userId filtering. Add integration tests specifically for cross-user access attempts. Document user isolation guarantees in Glass spec. Consider adding audit logging for failed authorization attempts.

### 8.11. Create Glass spec for routes/entries.glass with isolation contract

**Status:** pending  
**Dependencies:** 8.10  

Write Glass framework specification documenting the entries API contract, user isolation guarantees, and validation rules

**Details:**

Create `glass/routes/entries.glass` following GLASS.md format. Document: Intent (expose journal entry management to users), Contract (user isolation guarantee - users can only access own entries, input validation with Zod, pagination correctness, atomic operations), Dependencies (D1 database, JWT auth, AI service for polish), Failure Modes (invalid input returns 400, unauthorized access returns 404, DB errors return 500). Include example requests/responses. Document pagination algorithm, search behavior, soft delete semantics.
