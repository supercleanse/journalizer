# Task ID: 13

**Title:** Build outbound SMS service using Twilio Programmable Messaging

**Status:** pending

**Dependencies:** 12

**Priority:** medium

**Description:** Create reusable SMS sending service for reminders, confirmations, and verification codes using Twilio's Messaging API with error handling and delivery tracking.

**Details:**

Create `src/services/sms.ts` with functions:

```typescript
async function sendSMS(to: string, body: string, env: Env): Promise<SendResult>
```

Use Twilio REST API (not SDK, to avoid runtime issues with Workers):
- POST to `https://api.twilio.com/2010-04-01/Accounts/{ACCOUNT_SID}/Messages.json`
- Auth: Basic auth with ACCOUNT_SID and AUTH_TOKEN
- Body: From={TWILIO_PHONE_NUMBER}, To={to}, Body={body}

Validate E.164 phone format. Log all sends to processing_log. Handle Twilio errors:
- 21211 (invalid To number): throw validation error
- 21614 (unverified number in trial): throw trial limit error
- Rate limits: implement exponential backoff

Support message templates:
- verificationCode(code: string): "Your Journalizer verification code is: {code}"
- entryConfirmation(): "Got it! Your entry has been saved. 📓"
- reminder(type: string): Select from rotation

Glass spec:
- `glass/services/sms.glass` - Intent: reliable SMS delivery; Contract: guarantees E.164 validation, error handling, delivery tracking, no PII in logs

**Test Strategy:**

Test sending to valid/invalid numbers. Verify Twilio API authentication. Test error handling for all Twilio error codes. Verify rate limiting and backoff. Test message templates. Confirm delivery with Twilio dashboard. Test with international numbers.

## Subtasks

### 13.1. Implement sendSMS function using Twilio REST API

**Status:** pending  
**Dependencies:** None  

Create the core SMS sending function that makes HTTP POST requests to Twilio's REST API endpoint without using the SDK to avoid Cloudflare Workers runtime issues.

**Details:**

Create `src/services/sms.ts` with the `sendSMS(to: string, body: string, env: Env): Promise<SendResult>` function. Implement POST request to `https://api.twilio.com/2010-04-01/Accounts/{ACCOUNT_SID}/Messages.json` using fetch API. Structure request body with URL-encoded parameters: From, To, and Body. Return SendResult containing message SID, status, and any error information.

### 13.2. Set up Basic Authentication with Twilio credentials

**Status:** pending  
**Dependencies:** 13.1  

Implement Basic Auth header construction using TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN from environment variables.

**Details:**

Extract TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN from the Env object. Create Basic Auth header by base64 encoding 'ACCOUNT_SID:AUTH_TOKEN'. Add Authorization header to all Twilio API requests. Include Content-Type: application/x-www-form-urlencoded header.

### 13.3. Implement E.164 phone number validation

**Status:** pending  
**Dependencies:** 13.1  

Add phone number validation to ensure all recipient numbers conform to E.164 international format before sending SMS.

**Details:**

Create validation function that checks phone numbers match E.164 format (e.g., +1234567890). Validate that number starts with '+', followed by country code and subscriber number. Reject numbers missing '+' prefix or containing invalid characters. Throw descriptive validation errors for malformed numbers before making Twilio API call.

### 13.4. Handle Twilio error codes and implement error mapping

**Status:** pending  
**Dependencies:** 13.2  

Parse Twilio API error responses and map specific error codes (21211, 21614) to meaningful application errors with appropriate handling.

**Details:**

Parse JSON error responses from Twilio API. Handle error code 21211 (invalid To number) by throwing a validation error with helpful message. Handle error code 21614 (unverified number in trial account) by throwing trial limitation error. Map other common Twilio errors to appropriate error types. Include original Twilio error details in logs for debugging.

### 13.5. Implement exponential backoff for rate limiting

**Status:** pending  
**Dependencies:** 13.4  

Add retry logic with exponential backoff to handle Twilio rate limit errors gracefully and ensure reliable message delivery.

**Details:**

Detect rate limit errors from Twilio API (HTTP 429 or error code 20429). Implement exponential backoff: first retry after 1s, then 2s, 4s, 8s up to maximum 3-5 retries. Include jitter to prevent thundering herd. Respect Retry-After header if provided by Twilio. Throw final error if all retries exhausted.

### 13.6. Log SMS sends to processing_log without PII

**Status:** pending  
**Dependencies:** 13.1  

Record all SMS sending attempts in the processing_log table for auditing and troubleshooting while ensuring no personally identifiable information is logged.

**Details:**

After each sendSMS call, insert record into processing_log table with: id (UUID), user_id, processing_type='sms_send', status (success/failure), input_metadata (redacted phone number last 4 digits only, message length), result_metadata (Twilio message SID, delivery status), error_message (if failed), processed_at timestamp. Never log full phone numbers or message content.

### 13.7. Implement message templates for common use cases

**Status:** pending  
**Dependencies:** 13.1  

Create reusable message template functions for verification codes, entry confirmations, and reminders to ensure consistent messaging.

**Details:**

Create template functions: `verificationCode(code: string)` returns 'Your Journalizer verification code is: {code}', `entryConfirmation()` returns 'Got it! Your entry has been saved. 📓', `reminder(type: string)` selects from predefined rotation of reminder messages. Export templates from sms.ts for use by other services. Keep templates concise for SMS character limits.

### 13.8. Create Glass specification for SMS service contract

**Status:** pending  
**Dependencies:** 13.3, 13.4, 13.5, 13.6, 13.7  

Document the SMS service contract, intent, and guarantees in a Glass spec file following the GLASS.md framework conventions.

**Details:**

Create `glass/services/sms.glass` with: Intent section describing reliable SMS delivery for reminders/confirmations/verification. Contract section guaranteeing E.164 validation, comprehensive error handling, delivery tracking, exponential backoff for rate limits, and no PII in logs. Document sendSMS function signature, parameters, return type. List Twilio error codes handled. Specify logging behavior and privacy guarantees.
