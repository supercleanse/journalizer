# Task ID: 10

**Title:** Create user settings API for profile, voice preferences, and phone management

**Status:** pending

**Dependencies:** 8, 9

**Priority:** medium

**Description:** Build settings management API that allows users to configure their profile, AI voice style preferences, phone number verification, timezone, and export data.

**Details:**

Create `src/routes/api/settings.ts` with:

- GET /api/settings - Return user settings: { displayName, email, avatarUrl, phoneNumber, phoneVerified, voiceStyle, voiceNotes, timezone, createdAt }
- PUT /api/settings - Update settings. Body: { displayName?, voiceStyle?: 'natural'|'conversational'|'reflective'|'polished', voiceNotes?: string, timezone?: string }. Validate timezone against IANA database
- POST /api/settings/verify-phone - Start phone verification. Body: { phoneNumber }. Validate E.164 format. Generate 6-digit code, store in KV: key=`phone-verify:{userId}`, value={ phoneNumber, code, attempts: 0 }, TTL=10min. Send via Twilio: "Your Journalizer verification code is: {code}"
- POST /api/settings/confirm-phone - Confirm verification. Body: { code }. Check KV, validate code, increment attempts (max 3), update users.phone_number and phone_verified=1, delete KV entry
- GET /api/settings/export - (Handled in export route) Return user data JSON with all entries and media references

Implement rate limiting: 3 verification SMS per hour per user using KV counter.

Glass spec:
- `glass/routes/settings.glass` - Intent: user preference management; Contract: guarantees phone verification security, timezone validation, rate limiting on verification, data export completeness

**Test Strategy:**

Test updating all settings fields. Verify voice preferences affect AI polish output. Test phone verification flow including incorrect codes and rate limiting. Test timezone validation with valid/invalid values. Verify export includes all user data.

## Subtasks

### 10.1. Implement GET /api/settings endpoint to fetch user settings

**Status:** pending  
**Dependencies:** None  

Create the GET endpoint that retrieves current user settings including profile data, voice preferences, phone verification status, and timezone from D1 database.

**Details:**

Query the users table in D1 to fetch displayName, email, avatarUrl, phoneNumber, phoneVerified, voiceStyle, voiceNotes, timezone, and createdAt fields. Ensure proper authentication middleware is applied. Return JSON response with all settings. Handle cases where user doesn't exist or fields are null.

### 10.2. Create Zod validation schemas for settings update requests

**Status:** pending  
**Dependencies:** None  

Define comprehensive Zod schemas to validate PUT /api/settings request body including displayName, voiceStyle enum, voiceNotes length limits, and timezone format.

**Details:**

Create Zod schema with: displayName (optional string, max 100 chars), voiceStyle (optional enum: 'natural'|'conversational'|'reflective'|'polished'), voiceNotes (optional string, max 500 chars), timezone (optional string for IANA validation). Ensure proper error messages for validation failures.

### 10.3. Implement IANA timezone validation logic

**Status:** pending  
**Dependencies:** 10.2  

Add timezone validation against the IANA timezone database to ensure only valid timezone identifiers are accepted in settings updates.

**Details:**

Use a library like 'spacetime' or validate against Intl.supportedValuesOf('timeZone') to check if provided timezone is valid IANA identifier (e.g., 'America/New_York'). Integrate into Zod schema refinement or custom validator. Return clear error message for invalid timezones.

### 10.4. Implement PUT /api/settings endpoint with validation and D1 update

**Status:** pending  
**Dependencies:** 10.1, 10.2, 10.3  

Create the PUT endpoint that validates incoming settings data using Zod schemas and updates the users table in D1 database with new settings values.

**Details:**

Parse request body with Zod schema from subtask 2. Validate timezone with logic from subtask 3. Execute D1 UPDATE query to modify displayName, voiceStyle, voiceNotes, and timezone fields for authenticated user. Return updated settings object. Handle database errors and validation failures with appropriate HTTP status codes.

### 10.5. Integrate phone verification endpoints from task 9

**Status:** pending  
**Dependencies:** 10.4  

Add POST /api/settings/verify-phone and POST /api/settings/confirm-phone endpoints by integrating the phone verification logic from task 9 into the settings route.

**Details:**

Import or reference phone verification handlers from task 9 implementation. Mount verify-phone endpoint (validates E.164 format, generates 6-digit code, stores in KV with TTL=10min, sends Twilio SMS). Mount confirm-phone endpoint (validates code from KV, checks attempts <= 3, updates D1 users table phone_number and phone_verified=1, deletes KV entry). Ensure proper error handling.

### 10.6. Implement rate limiting for phone verification using KV counters

**Status:** pending  
**Dependencies:** 10.5  

Add rate limiting logic to restrict users to 3 phone verification SMS messages per hour using Cloudflare KV as a counter store.

**Details:**

On POST /api/settings/verify-phone, check KV for key `rate-limit:phone-verify:{userId}`. If exists and count >= 3, return 429 Too Many Requests. Otherwise, increment counter with TTL=1 hour (3600 seconds). Use atomic KV operations if available. Return clear error message indicating remaining time until reset.

### 10.7. Add voiceStyle enum validation and voiceNotes length constraints

**Status:** pending  
**Dependencies:** 10.2  

Ensure strict validation of voiceStyle field against allowed enum values and enforce character limits on voiceNotes field with descriptive error messages.

**Details:**

In Zod schema, define voiceStyle as z.enum(['natural', 'conversational', 'reflective', 'polished']) with custom error message. Define voiceNotes as z.string().max(500) or similar appropriate limit with helpful error. Ensure validation occurs before database update in PUT endpoint.

### 10.8. Create Glass specification for settings route contracts

**Status:** pending  
**Dependencies:** 10.1, 10.4, 10.6, 10.7  

Write glass/routes/settings.glass defining the intent, contracts, validation guarantees, and security constraints for the settings management API.

**Details:**

Create settings.glass file documenting: Intent (user preference management), Contract (phone verification security with rate limiting, timezone IANA validation, voiceStyle enum enforcement, voiceNotes length limits, data export completeness), Validation contracts (E.164 phone format, 6-digit code format, max 3 verification attempts, 3 SMS per hour rate limit), Security (authenticated access only, user can only modify own settings). Follow Glass Framework format from GLASS.md.
