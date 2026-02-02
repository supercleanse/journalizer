# Task ID: 2

**Title:** Design and implement D1 database schema with migration system

**Status:** pending

**Dependencies:** 1

**Priority:** high

**Description:** Create the complete D1 SQLite schema as specified in PRD section 6, including users, entries, media, reminders, processing_log, and print_subscriptions tables with proper indexes and foreign key constraints.

**Details:**

Create `src/db/schema.sql` with all six tables (users, entries, media, reminders, processing_log, print_subscriptions) exactly as defined in PRD section 6. Use TEXT for primary keys (UUIDs), proper foreign key constraints with ON DELETE CASCADE, and all specified indexes.

Set up Drizzle ORM schema definitions in `src/db/schema.ts` mirroring the SQL schema. Configure Drizzle to use SQLite dialect. Create migration system in `src/db/migrations/` with timestamped migration files.

Implement `src/db/queries.ts` with typed query helpers for common operations: getUserById, createUser, createEntry, listEntries (with pagination), etc.

Create corresponding Glass specs:
- `glass/db/schema.glass` - Intent: data persistence layer; Contract: guarantees ACID properties, foreign key integrity
- `glass/db/queries.glass` - Intent: type-safe database access; Contract: guarantees SQL injection protection, proper error handling

**Test Strategy:**

Run `wrangler d1 create journalizer_db` and apply migrations with `wrangler d1 migrations apply`. Verify schema with `wrangler d1 execute --command=".schema"`. Write unit tests for Drizzle query helpers to ensure correct SQL generation and type safety. Test foreign key cascade behavior.

## Subtasks

### 2.1. Create SQL schema file with users table and indexes

**Status:** pending  
**Dependencies:** None  

Create src/db/schema.sql and implement the users table with all fields as specified in PRD section 6, including proper primary key, indexes, and constraints.

**Details:**

Create src/db/schema.sql file. Define users table with columns: id (TEXT PRIMARY KEY), email (TEXT UNIQUE NOT NULL), name (TEXT), picture_url (TEXT), phone_number (TEXT UNIQUE), phone_verified (INTEGER DEFAULT 0), timezone (TEXT DEFAULT 'UTC'), created_at (TEXT NOT NULL), updated_at (TEXT NOT NULL). Add indexes: CREATE INDEX idx_users_email ON users(email); CREATE INDEX idx_users_phone ON users(phone_number);. Enable foreign key constraints with PRAGMA foreign_keys = ON;

### 2.2. Add entries table with foreign keys and indexes

**Status:** pending  
**Dependencies:** 2.1  

Add the entries table to schema.sql with proper foreign key constraints to users table, ON DELETE CASCADE behavior, and performance indexes.

**Details:**

Add entries table to schema.sql with columns: id (TEXT PRIMARY KEY), user_id (TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE), content (TEXT), transcribed_content (TEXT), entry_type (TEXT CHECK(entry_type IN ('sms', 'mms', 'email', 'web', 'voice'))), source_phone (TEXT), source_email (TEXT), media_count (INTEGER DEFAULT 0), created_at (TEXT NOT NULL), updated_at (TEXT NOT NULL). Add indexes: CREATE INDEX idx_entries_user_id ON entries(user_id); CREATE INDEX idx_entries_created_at ON entries(created_at); CREATE INDEX idx_entries_user_created ON entries(user_id, created_at DESC);

### 2.3. Add media table with R2 key references

**Status:** pending  
**Dependencies:** 2.2  

Implement the media table in schema.sql for tracking uploaded media files stored in R2, with foreign keys to entries table and proper indexes.

**Details:**

Add media table to schema.sql with columns: id (TEXT PRIMARY KEY), entry_id (TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE), r2_key (TEXT NOT NULL), media_type (TEXT CHECK(media_type IN ('image', 'audio', 'video', 'document'))), mime_type (TEXT NOT NULL), file_size (INTEGER), width (INTEGER), height (INTEGER), duration (REAL), thumbnail_r2_key (TEXT), created_at (TEXT NOT NULL). Add indexes: CREATE INDEX idx_media_entry_id ON media(entry_id); CREATE INDEX idx_media_r2_key ON media(r2_key);

### 2.4. Add reminders and processing_log tables

**Status:** pending  
**Dependencies:** 2.1  

Add reminders table for user notification preferences and processing_log table for tracking asynchronous AI/transcription operations.

**Details:**

Add reminders table with columns: id (TEXT PRIMARY KEY), user_id (TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE), reminder_type (TEXT CHECK(reminder_type IN ('daily', 'weekly', 'monthly', 'smart'))), time_of_day (TEXT), day_of_week (INTEGER CHECK(day_of_week BETWEEN 0 AND 6)), day_of_month (INTEGER CHECK(day_of_month BETWEEN 1 AND 28)), smart_threshold (INTEGER CHECK(smart_threshold BETWEEN 1 AND 14)), is_active (INTEGER DEFAULT 1), created_at (TEXT NOT NULL). Add processing_log table with columns: id (TEXT PRIMARY KEY), entry_id (TEXT REFERENCES entries(id) ON DELETE SET NULL), operation_type (TEXT CHECK(operation_type IN ('transcription', 'ai_enhancement', 'summarization'))), status (TEXT CHECK(status IN ('pending', 'processing', 'completed', 'failed'))), error_message (TEXT), started_at (TEXT), completed_at (TEXT). Add indexes: CREATE INDEX idx_reminders_user_id ON reminders(user_id); CREATE INDEX idx_processing_status ON processing_log(status, started_at);

### 2.5. Add print_subscriptions table

**Status:** pending  
**Dependencies:** 2.1  

Create the print_subscriptions table for managing monthly photo book delivery subscriptions with address and status tracking.

**Details:**

Add print_subscriptions table to schema.sql with columns: id (TEXT PRIMARY KEY), user_id (TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE), subscription_status (TEXT CHECK(subscription_status IN ('active', 'paused', 'cancelled'))), shipping_name (TEXT NOT NULL), shipping_address_line1 (TEXT NOT NULL), shipping_address_line2 (TEXT), shipping_city (TEXT NOT NULL), shipping_state (TEXT NOT NULL), shipping_postal_code (TEXT NOT NULL), shipping_country (TEXT NOT NULL DEFAULT 'US'), last_print_date (TEXT), next_print_date (TEXT), created_at (TEXT NOT NULL), updated_at (TEXT NOT NULL). Add index: CREATE INDEX idx_print_user_id ON print_subscriptions(user_id);

### 2.6. Set up Drizzle ORM schema definitions in TypeScript

**Status:** pending  
**Dependencies:** 2.5  

Create src/db/schema.ts with Drizzle ORM table definitions that mirror the SQL schema, using SQLite dialect and proper TypeScript types.

**Details:**

Install drizzle-orm and configure SQLite dialect. Create src/db/schema.ts with Drizzle table definitions for all six tables using sqliteTable(). Map SQL types: TEXT->text(), INTEGER->integer(), REAL->real(). Define foreign key relationships using references(). Export table schemas and infer TypeScript types using typeof. Create src/db/index.ts to initialize Drizzle client with D1 binding. Set up drizzle.config.ts for migration configuration pointing to src/db/migrations/ directory with timestamped migration files.

### 2.7. Implement typed query helpers for database operations

**Status:** pending  
**Dependencies:** 2.6  

Create src/db/queries.ts with type-safe query helper functions for common database operations including pagination, using Drizzle ORM query builder.

**Details:**

Implement query helpers in src/db/queries.ts: getUserById(db, id) returns User | undefined, createUser(db, data: NewUser) returns User, updateUser(db, id, data) returns User, getUserByEmail(db, email), getUserByPhone(db, phone), createEntry(db, data: NewEntry) returns Entry, listEntries(db, userId, options: { limit: number, offset: number, orderBy: 'asc'|'desc' }) returns { entries: Entry[], total: number }, getEntryById(db, id) with media eager loading, createReminder(db, data), listReminders(db, userId), createMedia(db, data), logProcessing(db, data). Use Drizzle query builder with proper typing, parameterized queries for SQL injection protection, and error handling with try-catch.

### 2.8. Create Glass specification files for database layer

**Status:** pending  
**Dependencies:** 2.7  

Create Glass framework specification files glass/db/schema.glass and glass/db/queries.glass documenting the Intent and Contract for the database persistence layer.

**Details:**

Create glass/db/schema.glass with Intent section describing the data persistence layer purpose and Contract section guaranteeing ACID properties, foreign key integrity enforcement, CASCADE deletion behavior, and data validation via CHECK constraints. Create glass/db/queries.glass with Intent section describing type-safe database access abstraction and Contract section guaranteeing SQL injection protection via parameterized queries, proper error handling with typed return values, pagination correctness, and transaction support. Follow GLASS.md format with clear Intent and Contract sections.
