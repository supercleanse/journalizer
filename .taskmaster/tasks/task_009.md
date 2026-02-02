# Task ID: 9

**Title:** Implement Twilio SMS/MMS inbound webhook with phone verification

**Status:** pending

**Dependencies:** 5, 6, 7, 8

**Priority:** high

**Description:** Build Twilio webhook handler for receiving SMS/MMS messages, process text and media attachments, match to verified users by phone number, and create journal entries automatically.

**Details:**

Create `src/routes/api/webhooks.ts` with POST /api/webhooks/twilio endpoint.

Implement Twilio webhook signature validation using X-Twilio-Signature header (CRITICAL for security).

Webhook processing flow (from PRD section 8.1):
1. Validate Twilio signature
2. Extract From (phone number), Body (text), NumMedia, MediaUrl0-9, MediaContentType0-9
3. Look up user by phone_number where phone_verified=1. If not found, send SMS: "This number is not registered. Visit journalizer.com to set up."
4. Process message:
   - Text only: Create entry with raw_content=Body, entry_type='text', source='sms'
   - Photo attached: Download from MediaUrl, upload to R2 via media service, create entry with entry_type='photo', attach media
   - Audio attached: Download, upload to R2, send to transcription service, create entry with raw_content=transcript, entry_type='audio', attach media
   - Video attached: Download, upload to R2, send to transcription service (audio track), create entry with raw_content=transcript, entry_type='video', attach media
5. Send polished entry to AI service (background job)
6. Respond to webhook with TwiML: "Got it! Your entry has been saved. 📓"

Implement phone verification in `src/routes/api/settings.ts`:
- POST /api/settings/verify-phone - Generate 6-digit code, store in KV with 10-min TTL, send via Twilio SMS
- POST /api/settings/confirm-phone - Validate code from KV, set phone_verified=1

Glass specs:
- `glass/webhooks/twilio.glass` - Intent: receive user journal entries via SMS; Contract: guarantees signature validation, user matching, media processing, confirmation delivery
- `glass/settings/phone-verify.glass` - Intent: verify user phone ownership; Contract: guarantees code expiration, rate limiting, secure delivery

**Test Strategy:**

Use Twilio's webhook testing tool to send mock requests. Test signature validation with correct and incorrect signatures. Test all media types (text, photo, audio, video). Verify unregistered numbers receive error message. Test phone verification flow end-to-end. Test rate limiting on verification codes.

## Subtasks

### 9.1. Create Twilio webhook endpoint with POST /api/webhooks/twilio route

**Status:** pending  
**Dependencies:** None  

Set up the basic webhook endpoint structure in src/routes/api/webhooks.ts to receive Twilio SMS/MMS messages

**Details:**

Create src/routes/api/webhooks.ts file with POST /api/webhooks/twilio endpoint handler. Set up route registration in main router. Accept form-urlencoded webhook payload from Twilio. Return 200 OK response structure. This is the foundation for all webhook processing.

### 9.2. Implement X-Twilio-Signature validation for webhook security

**Status:** pending  
**Dependencies:** 9.1  

Validate incoming webhook requests using Twilio signature validation to prevent unauthorized access (CRITICAL security feature)

**Details:**

Extract X-Twilio-Signature header from request. Compute HMAC-SHA1 signature using Twilio auth token and full request URL + payload. Compare computed signature with header value using constant-time comparison. Reject requests with invalid signatures with 403 Forbidden. Reference Twilio security docs for exact algorithm.

### 9.3. Parse Twilio webhook payload (From, Body, NumMedia, MediaUrl, MediaContentType)

**Status:** pending  
**Dependencies:** 9.2  

Extract all relevant fields from the Twilio webhook form-urlencoded payload including phone number, message text, and media attachments

**Details:**

Parse form-urlencoded body to extract: From (sender phone number in E.164 format), Body (message text), NumMedia (count of attachments), MediaUrl0-9 (media URLs), MediaContentType0-9 (MIME types). Handle cases where NumMedia=0 (text-only). Validate phone number format. Log parsed data for debugging.

### 9.4. Implement user lookup by phone_number with phone_verified=1 check

**Status:** pending  
**Dependencies:** 9.3  

Query D1 database to find user by phone number and verify their phone is verified before processing the message

**Details:**

Query users table: SELECT * FROM users WHERE phone_number = ? AND phone_verified = 1. Use prepared statement to prevent SQL injection. Handle case where no user found (return null). Handle case where user found but phone_verified=0 (treat as unregistered). Cache lookup result for current request processing.

### 9.5. Handle unregistered phone numbers with SMS error response

**Status:** pending  
**Dependencies:** 9.4  

Send informative SMS reply to unregistered phone numbers directing them to register on the website

**Details:**

When user lookup returns null, use Twilio Messages API to send SMS: 'This number is not registered. Visit journalizer.com to set up.' Use Twilio REST API with account SID and auth token. Set From to Twilio phone number, To to sender's number, Body to error message. Log failed lookup attempts. Return TwiML empty response to webhook.

### 9.6. Handle text-only messages: create journal entry and queue for AI processing

**Status:** pending  
**Dependencies:** 9.4  

Process SMS messages without media attachments by creating text journal entries and sending to AI service for polishing

**Details:**

When NumMedia=0, create entry in entries table: user_id, raw_content=Body, entry_type='text', source='sms', entry_date=now(), created_at=now(). Generate UUID for entry ID. Queue background job to AI service for polishing (use Cloudflare Queue or async task). Return entry ID for confirmation.

### 9.7. Handle photo MMS: download from Twilio, upload to R2, create entry

**Status:** pending  
**Dependencies:** 9.4  

Process MMS messages with photo attachments by downloading media, storing in R2, and creating photo journal entries

**Details:**

When MediaContentType0 starts with 'image/', fetch MediaUrl0 with Twilio basic auth. Download image bytes. Generate unique filename (userId_timestamp_uuid.ext). Upload to R2 using media service POST /api/media/upload. Create entry: entry_type='photo', raw_content=Body (caption), source='sms'. Insert media record linking entry_id, media_url (R2 URL), media_type='photo'. Handle multiple images if NumMedia>1.

### 9.8. Handle audio MMS: download, upload to R2, transcribe, create entry

**Status:** pending  
**Dependencies:** 9.4  

Process MMS messages with audio attachments by downloading, storing, transcribing via transcription service, and creating audio entries

**Details:**

When MediaContentType0 starts with 'audio/', fetch MediaUrl0 and download audio file. Upload to R2 via media service. Send audio file URL to transcription service (OpenAI Whisper or similar). Wait for transcript response. Create entry: entry_type='audio', raw_content=transcript text, source='sms'. Link media record with audio file URL and transcription text. Queue AI polish job for transcript.

### 9.9. Handle video MMS: download, upload to R2, transcribe audio track, create entry

**Status:** pending  
**Dependencies:** 9.4  

Process MMS messages with video attachments by downloading, storing, extracting and transcribing audio track, and creating video entries

**Details:**

When MediaContentType0 starts with 'video/', fetch MediaUrl0 and download video file. Upload to R2 via media service. Extract audio track from video (may need ffmpeg or transcription service handles this). Send audio to transcription service. Create entry: entry_type='video', raw_content=transcript, source='sms'. Link media record with video URL and transcription. Queue AI polish job.

### 9.10. Queue background job to send polished entry to AI service

**Status:** pending  
**Dependencies:** 9.6, 9.7, 9.8, 9.9  

After creating journal entry, enqueue async job to AI service for content polishing and enhancement

**Details:**

After entry creation, enqueue job to Cloudflare Queue with payload: { entryId, userId, rawContent, entryType }. AI worker processes queue, calls OpenAI API for polishing, updates entries.polished_content field. Set job retry policy (3 attempts, exponential backoff). Log job creation. Return immediately without blocking webhook response.

### 9.11. Respond to webhook with TwiML confirmation message

**Status:** pending  
**Dependencies:** 9.5, 9.6, 9.7, 9.8, 9.9  

Return TwiML response to Twilio webhook acknowledging successful message receipt and processing

**Details:**

Generate TwiML XML response: <?xml version="1.0" encoding="UTF-8"?><Response><Message>Got it! Your entry has been saved. 📓</Message></Response>. Set Content-Type: text/xml. Return 200 OK status. This confirms to user their message was received. Twilio will send this SMS back to user.

### 9.12. Implement POST /api/settings/verify-phone with 6-digit code generation

**Status:** pending  
**Dependencies:** None  

Create endpoint to initiate phone verification by generating verification code and storing in KV with TTL

**Details:**

Create src/routes/api/settings.ts. Implement POST /api/settings/verify-phone endpoint. Require authenticated user. Accept body: { phoneNumber: string (E.164 format) }. Validate phone format. Generate random 6-digit code (100000-999999). Store in KV: key='phone_verify:{phoneNumber}', value={ code, userId, attempts: 0 }, TTL=10 minutes. Rate limit: max 3 verification requests per phone per hour (check KV rate limit key).

### 9.13. Send verification code SMS via Twilio API

**Status:** pending  
**Dependencies:** 9.12  

Use Twilio Messages API to send the 6-digit verification code to user's phone number

**Details:**

After generating code in verify-phone endpoint, call Twilio Messages API: POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json with body: To={phoneNumber}, From={TwilioPhoneNumber}, Body='Your Journalizer verification code is: {code}. Valid for 10 minutes.' Use HTTP basic auth with Twilio SID and token. Handle API errors (invalid number, rate limit). Return success response without exposing code.

### 9.14. Implement POST /api/settings/confirm-phone with code validation

**Status:** pending  
**Dependencies:** 9.13  

Create endpoint to verify phone ownership by validating the 6-digit code submitted by user

**Details:**

Implement POST /api/settings/confirm-phone. Accept body: { phoneNumber, code: string }. Retrieve KV value for 'phone_verify:{phoneNumber}'. Verify code matches and userId matches current user. Increment attempts counter. If attempts >= 3, delete KV entry and return error. If code valid, update users table: SET phone_number={phoneNumber}, phone_verified=1 WHERE id={userId}. Delete KV entry. Return success.

### 9.15. Create Glass specs for webhooks/twilio.glass and settings/phone-verify.glass

**Status:** pending  
**Dependencies:** 9.11, 9.14  

Document the webhook and phone verification flows in Glass framework format with intents, contracts, and guarantees

**Details:**

Create glass/webhooks/twilio.glass: Intent='receive user journal entries via SMS', Contract guarantees: (1) signature validation prevents unauthorized requests, (2) user matching requires phone_verified=1, (3) media processing handles all types (text/photo/audio/video), (4) confirmation delivery via TwiML. Create glass/settings/phone-verify.glass: Intent='verify user phone ownership', Contract guarantees: (1) code expiration after 10 minutes, (2) rate limiting 3 verifications per hour, (3) 3 attempt limit per code, (4) secure delivery via Twilio SMS. Document all edge cases and error handling.
