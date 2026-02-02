# Task ID: 22

**Title:** Write comprehensive test suite with unit and integration tests

**Status:** pending

**Dependencies:** 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13

**Priority:** high

**Description:** Develop complete test coverage using Vitest for unit tests and Playwright for end-to-end tests, covering all API endpoints, services, and critical user flows.

**Details:**

Set up testing infrastructure:

**Unit tests** (Vitest):
- Install vitest, @cloudflare/workers-types
- Create `tests/unit/` directory structure mirroring src/
- Test coverage goals:
  - `src/db/queries.ts`: All CRUD operations with mock D1
  - `src/services/ai.ts`: AI polish with mocked Anthropic API
  - `src/services/transcription.ts`: Transcription with mocked Deepgram
  - `src/services/media.ts`: R2 upload/download with mocked R2
  - `src/services/sms.ts`: SMS sending with mocked Twilio
  - `src/lib/auth.ts`: JWT signing/verification
  - `src/routes/`: All endpoints with mocked dependencies

**Integration tests** (Wrangler + Vitest):
- Test with real D1 (local or dev), R2, KV bindings
- Test full request flows: login → create entry → list entries
- Test webhook processing with mocked Twilio requests
- Test cron trigger logic

**E2E tests** (Playwright):
- Test critical user flows:
  1. Sign up with Google OAuth
  2. Verify phone number
  3. Create entry via web
  4. Simulate SMS entry via webhook
  5. Configure reminder
  6. Export data

Target 80%+ code coverage. Run tests in CI.

Glass specs for each test file:
- `glass/tests/unit/queries.glass` - Intent: verify database operations; Contract: guarantees isolation, rollback on error, SQL injection protection

Glass spec:
- `glass/tests/suite.glass` - Intent: comprehensive quality assurance; Contract: guarantees 80%+ coverage, all critical paths tested, no flaky tests

**Test Strategy:**

Run `npm test` and verify all tests pass. Generate coverage report with `npm run test:coverage`. Run E2E tests with `npx playwright test`. Verify tests run in CI. Test that mocked external APIs don't make real requests. Measure test execution time.

## Subtasks

### 22.1. Set up Vitest configuration and test infrastructure

**Status:** pending  
**Dependencies:** None  

Install Vitest and configure testing environment with TypeScript support, coverage reporting, and Cloudflare Workers types for proper type checking in tests.

**Details:**

Install `vitest`, `@vitest/ui`, `@cloudflare/workers-types`, and `@vitest/coverage-v8`. Create `vitest.config.ts` with proper TypeScript configuration, coverage thresholds (80%+), and test environment settings. Configure test scripts in package.json: `test`, `test:watch`, `test:coverage`. Set up path aliases to match src/ structure. Configure coverage exclusions for config files and Glass specs.

### 22.2. Create test directory structure mirroring src/

**Status:** pending  
**Dependencies:** 22.1  

Establish organized test file structure that mirrors the source code layout for maintainability and discoverability.

**Details:**

Create `tests/unit/` directory with subdirectories: `db/`, `services/`, `lib/`, `routes/api/`. Create `tests/integration/` for integration tests. Create `tests/e2e/` for Playwright tests. Set up test helper files: `tests/helpers/mocks.ts` for shared mock factories, `tests/helpers/fixtures.ts` for test data, `tests/helpers/setup.ts` for global test setup.

### 22.3. Write unit tests for db/queries.ts with mocked D1

**Status:** pending  
**Dependencies:** 22.2  

Test all database CRUD operations with comprehensive mocking of Cloudflare D1 to ensure SQL queries work correctly and handle errors properly.

**Details:**

Create `tests/unit/db/queries.test.ts`. Mock D1Database interface using Vitest mocks. Test all functions: createUser, getUserById, createEntry, getEntries, updateEntry, deleteEntry, createReminder, etc. Test cases: successful operations, constraint violations (duplicate user), not found errors, SQL injection attempts (verify parameterized queries), transaction rollbacks on error. Mock D1PreparedStatement and D1Result interfaces. Verify all queries use prepared statements with bind parameters.

### 22.4. Write unit tests for services/ai.ts with mocked Anthropic API

**Status:** pending  
**Dependencies:** 22.2  

Test AI polish functionality with mocked Claude API calls to verify prompt construction, response parsing, and error handling without making real API requests.

**Details:**

Create `tests/unit/services/ai.test.ts`. Mock Anthropic SDK client using Vitest. Test polishEntry function with various inputs: short entries, long entries, entries with markdown, entries with special characters. Mock API responses with different polished outputs. Test error scenarios: API timeout, rate limit (429), invalid API key (401), malformed response. Verify prompt includes user's voice preferences when provided. Test retry logic for transient failures. Verify no actual API calls are made by asserting mock call counts.

### 22.5. Write unit tests for services/transcription.ts with mocked Deepgram

**Status:** pending  
**Dependencies:** 22.2  

Test transcription service with mocked Deepgram API to verify audio/video processing, response parsing, and error handling.

**Details:**

Create `tests/unit/services/transcription.test.ts`. Mock Deepgram SDK and R2 bucket operations. Test transcribeMedia function with: audio files (various formats), video files (verify audio extraction logic), very long files (streaming), multi-speaker audio (diarization). Mock Deepgram responses with realistic transcript structures including paragraphs and punctuation. Test error scenarios: unsupported format, API failure, corrupted file, timeout. Verify R2 streaming for large files. Test cost tracking metadata is populated correctly.

### 22.6. Write unit tests for services/media.ts with mocked R2

**Status:** pending  
**Dependencies:** 22.2  

Test media upload and download functionality with mocked Cloudflare R2 to verify file handling, validation, and error cases.

**Details:**

Create `tests/unit/services/media.test.ts`. Mock R2Bucket interface. Test uploadMedia function: valid audio files (mp3, m4a, wav), valid video files (mp4, mov), file size validation (reject >100MB), MIME type validation, generate unique keys, metadata storage. Test downloadMedia function: existing files, non-existent files (404), streaming large files. Test deleteMedia function. Verify presigned URL generation for downloads. Test error handling: R2 unavailable, insufficient storage, corrupted uploads.

### 22.7. Write unit tests for services/sms.ts with mocked Twilio

**Status:** pending  
**Dependencies:** 22.2  

Test SMS sending functionality with mocked Twilio API to verify message formatting, phone validation, and delivery handling.

**Details:**

Create `tests/unit/services/sms.test.ts`. Mock Twilio SDK client. Test sendSMS function: valid phone numbers (E.164 format), various message lengths, special characters in messages, international numbers. Test sendVerificationCode function: generates 6-digit codes, stores in KV with TTL, rate limiting (max 3 attempts per hour). Test verifyCode function: correct code, incorrect code, expired code. Mock Twilio responses: success, invalid phone number, delivery failure. Verify no actual SMS sent during tests.

### 22.8. Write unit tests for lib/auth.ts (JWT signing/verification)

**Status:** pending  
**Dependencies:** 22.2  

Test authentication utilities including JWT token generation, validation, refresh logic, and Google OAuth integration.

**Details:**

Create `tests/unit/lib/auth.test.ts`. Test signJWT function: generates valid tokens, includes correct claims (userId, email, exp), uses proper algorithm (RS256 or HS256). Test verifyJWT function: validates signature, checks expiration, rejects tampered tokens, rejects expired tokens. Test refreshToken function. Test extractUser middleware: parses Authorization header, attaches user to request context, rejects missing/invalid tokens. Mock Google OAuth verification. Test role-based access control if implemented.

### 22.9. Write unit tests for all route handlers with mocked dependencies

**Status:** pending  
**Dependencies:** 22.2, 22.3, 22.4, 22.5, 22.6, 22.7, 22.8  

Test all API endpoint handlers with mocked services and database to verify request/response handling, validation, and error responses.

**Details:**

Create test files: `tests/unit/routes/api/auth.test.ts`, `entries.test.ts`, `media.test.ts`, `reminders.test.ts`, `settings.test.ts`, `webhooks.test.ts`, `export.test.ts`. Mock all service layer functions and database queries. Test each endpoint: successful requests, validation errors (invalid input), authentication errors (missing/invalid token), authorization errors (accessing other user's data), rate limiting, request body parsing, response formatting. Verify HTTP status codes are correct. Test query parameter parsing and pagination.

### 22.10. Set up integration tests with real D1/R2/KV bindings

**Status:** pending  
**Dependencies:** 22.1  

Configure integration test environment that uses actual Cloudflare bindings (D1, R2, KV) in local or development mode for realistic testing.

**Details:**

Create `tests/integration/setup.ts` with Wrangler integration. Use `wrangler dev --local` or leverage Miniflare for local bindings. Create test database migrations that run before integration tests. Set up test R2 bucket and KV namespace. Create `afterEach` hooks to clean up test data (truncate tables, delete R2 objects, clear KV). Configure separate test environment variables. Create helper functions to seed test data and reset state between tests.

### 22.11. Write integration test for login → create entry → list entries flow

**Status:** pending  
**Dependencies:** 22.10  

Test complete user journey from authentication through creating and retrieving journal entries using real bindings.

**Details:**

Create `tests/integration/flows/journaling.test.ts`. Test flow: (1) POST /api/auth/google with mock OAuth token → receive JWT, (2) POST /api/entries with JWT → create entry, verify stored in D1, (3) GET /api/entries with JWT → verify entry returned, (4) POST /api/entries with media attachment → verify R2 upload, (5) trigger AI polish → verify processing_log entry, (6) verify transcription for media entry. Use real D1 database, R2 storage, KV for sessions. Mock only external APIs (Google, Anthropic, Deepgram, Twilio).

### 22.12. Write integration test for webhook processing with mocked Twilio

**Status:** pending  
**Dependencies:** 22.10  

Test SMS webhook handling including signature validation, entry creation, and media processing with realistic Twilio payloads.

**Details:**

Create `tests/integration/webhooks.test.ts`. Test POST /api/webhooks/sms with: valid Twilio signature (use Twilio's signature algorithm), text-only message → creates entry, message with media URL → downloads and processes media, invalid signature → rejected (403), duplicate message handling, rate limiting per phone number. Mock Twilio signature generation for test requests. Use real D1 for entry storage, real R2 for media. Mock external media downloads and transcription API. Test webhook idempotency.

### 22.13. Write integration test for cron trigger logic

**Status:** pending  
**Dependencies:** 22.10  

Test scheduled reminder functionality including trigger evaluation, SMS sending, and reminder status updates.

**Details:**

Create `tests/integration/cron.test.ts`. Test cron handler: (1) seed database with reminders at various times and frequencies (daily, weekly), (2) mock current time to match reminder trigger time, (3) invoke cron handler, (4) verify correct reminders are triggered, (5) verify SMS sent to verified phone numbers, (6) verify last_sent timestamp updated, (7) test timezone handling (reminders fire at correct local time). Mock Twilio SMS API. Use real D1 for reminder queries. Test edge cases: user with no phone number, unverified phone, disabled reminders, overlapping schedules.

### 22.14. Set up Playwright for E2E tests covering critical user flows

**Status:** pending  
**Dependencies:** 22.1  

Configure Playwright testing framework and implement end-to-end tests for critical user journeys including sign-up, phone verification, entry creation, and data export.

**Details:**

Install `@playwright/test`. Create `playwright.config.ts` with browser configurations (chromium, firefox, webkit), base URL for local dev server, video recording on failure, screenshot on failure. Create `tests/e2e/` directory. Implement page object models for: Login page, Dashboard, Entry creation, Settings. Write E2E tests: (1) Sign up with Google OAuth (mock OAuth flow), (2) Verify phone number (mock SMS code), (3) Create entry via web form → verify appears in list, (4) Simulate SMS entry via webhook → verify in dashboard, (5) Configure reminder in settings → verify saved, (6) Export data → verify JSON download. Set up test user accounts and cleanup.

### 22.15. Configure coverage reporting with 80%+ target

**Status:** pending  
**Dependencies:** 22.1, 22.3, 22.4, 22.5, 22.6, 22.7, 22.8, 22.9, 22.11, 22.12, 22.13  

Set up comprehensive code coverage reporting to track test coverage across unit and integration tests and ensure quality standards are met.

**Details:**

Configure `@vitest/coverage-v8` in vitest.config.ts with coverage thresholds: statements 80%, branches 80%, functions 80%, lines 80%. Exclude from coverage: Glass specs, test files, config files, type definitions. Generate coverage reports in multiple formats: HTML (for local viewing), JSON (for CI), lcov (for integration with coverage tools). Configure coverage to fail CI if below thresholds. Create npm script `test:coverage` that runs all tests and generates report. Set up coverage badges for README. Identify uncovered code paths and add tests to reach 80%+ target.

### 22.16. Create Glass specs for test files with isolation contracts

**Status:** pending  
**Dependencies:** 22.14, 22.15  

Document testing contracts and guarantees using Glass Framework specifications to ensure test quality, isolation, and reliability.

**Details:**

Create `glass/tests/unit/queries.glass` with: Intent: verify database operations in isolation; Contract: guarantees test isolation (no shared state), automatic rollback on error, SQL injection protection verification, 100% coverage of CRUD operations. Create `glass/tests/integration/flows.glass` with isolation contracts for integration tests. Create `glass/tests/e2e/playwright.glass` documenting E2E test guarantees. Create master spec `glass/tests/suite.glass` with: Intent: comprehensive quality assurance; Contract: guarantees 80%+ coverage, all critical user paths tested, no flaky tests (max 1% flake rate), tests run in <5 minutes, parallel execution safe, deterministic results. Document mocking strategy and test data management in Glass specs.
