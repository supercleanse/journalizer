# Task ID: 21

**Title:** Implement comprehensive error handling and logging system

**Status:** pending

**Dependencies:** 4

**Priority:** high

**Description:** Build centralized error handling, structured logging, and monitoring integration for debugging, tracking API failures, and monitoring Worker performance.

**Details:**

Create `src/lib/logger.ts` with logging utilities:

```typescript
interface LogContext {
  userId?: string;
  requestId: string;
  endpoint: string;
  duration?: number;
  error?: Error;
  metadata?: Record<string, any>;
}

function log(level: 'info' | 'warn' | 'error', message: string, context: LogContext)
```

Integrate with:
- Cloudflare Workers Analytics Engine for custom metrics
- Sentry or Axiom for error tracking (optional Phase 2)
- processing_log table for AI/transcription operation tracking

**Error handling patterns:**
- API errors: Return structured JSON { error: { code, message, details } }
- Use error codes: AUTH_FAILED, VALIDATION_ERROR, MEDIA_PROCESSING_FAILED, RATE_LIMIT_EXCEEDED, etc.
- Never expose internal errors (stack traces) to clients
- Log all errors with context (userId, endpoint, input parameters)

**Monitoring:**
- Track key metrics: API latency, AI processing time, transcription duration, SMS delivery rate
- Alert on: High error rates, slow responses (>2s), Twilio failures, API quota exhaustion

**Rate limiting:**
- Use KV for rate limit counters: `rate-limit:{userId}:{endpoint}`
- Limits: 100 requests/hour per user for entry creation, 10/hour for phone verification

Glass spec:
- `glass/lib/error-handling.glass` - Intent: reliable error tracking and debugging; Contract: guarantees structured error responses, PII protection in logs, metric collection, rate limit enforcement

**Test Strategy:**

Test all error scenarios (auth failure, validation error, API timeout, etc.). Verify error responses have correct structure. Test rate limiting blocks excess requests. Verify logs are structured and searchable. Test that sensitive data (passwords, tokens) is never logged.

## Subtasks

### 21.1. Create logger.ts with structured logging utilities

**Status:** pending  
**Dependencies:** None  

Create src/lib/logger.ts file with core logging infrastructure including the log function and LogContext interface

**Details:**

Create src/lib/logger.ts with:
- LogContext interface with fields: userId (optional), requestId, endpoint, duration (optional), error (optional), metadata (optional)
- log function signature: log(level: 'info' | 'warn' | 'error', message: string, context: LogContext)
- Basic implementation that formats logs as structured JSON
- Ensure all logs include timestamp, level, message, and context fields

### 21.2. Implement PII filtering in logs

**Status:** pending  
**Dependencies:** 21.1  

Add PII protection layer to logger to prevent sensitive data from being logged

**Details:**

Enhance logger.ts with PII filtering:
- Create sanitize function that removes/redacts sensitive fields from context and metadata
- Filter patterns: passwords, tokens, auth headers, credit cards, SSNs, API keys
- Use allowlist approach for metadata fields to ensure unknown fields don't leak PII
- Redact sensitive parts of phone numbers and emails (show format but mask digits)
- Apply sanitization before logging at all levels

### 21.3. Define error codes and structured error response types

**Status:** pending  
**Dependencies:** None  

Create standardized error code constants and error response structure for consistent API error handling

**Details:**

Create error types and codes in src/lib/logger.ts or src/lib/errors.ts:
- Define ErrorCode enum with values: AUTH_FAILED, VALIDATION_ERROR, MEDIA_PROCESSING_FAILED, RATE_LIMIT_EXCEEDED, NOT_FOUND, INTERNAL_ERROR, EXTERNAL_API_FAILED, QUOTA_EXCEEDED
- Create ErrorResponse interface: { error: { code: ErrorCode, message: string, details?: Record<string, any> } }
- Create helper function createErrorResponse(code, message, details?) that returns properly structured response
- Ensure stack traces and internal errors are never exposed in details

### 21.4. Implement structured error response handler

**Status:** pending  
**Dependencies:** 21.2, 21.3  

Create middleware or utility to convert errors into standardized JSON responses

**Details:**

Create error handling utilities:
- Implement handleError(error: Error, context: LogContext) function that logs error with sanitized context and returns structured ErrorResponse
- Map common error types to appropriate error codes (auth errors -> AUTH_FAILED, validation -> VALIDATION_ERROR)
- Set appropriate HTTP status codes (401 for AUTH_FAILED, 400 for VALIDATION_ERROR, 429 for RATE_LIMIT_EXCEEDED, 500 for INTERNAL_ERROR)
- Always log errors before returning response
- Include requestId in error response for tracing

### 21.5. Integrate Cloudflare Workers Analytics Engine

**Status:** pending  
**Dependencies:** 21.1  

Set up Workers Analytics Engine bindings and create metric tracking utilities

**Details:**

Configure Analytics Engine integration:
- Add Analytics Engine binding to wrangler.toml (name: ANALYTICS)
- Create writeMetric(name: string, value: number, context: Record<string, string>) utility
- Define metric names: api_latency, ai_processing_time, transcription_duration, sms_delivery_success, sms_delivery_failure
- Include dimensions in context: endpoint, userId, status_code, error_code
- Call writeMetric in log function for relevant events
- Ensure metric writes don't block request processing (fire-and-forget)

### 21.6. Track key performance metrics

**Status:** pending  
**Dependencies:** 21.5  

Implement automatic tracking of API latency, AI processing time, transcription duration, and SMS delivery rates

**Details:**

Add metric tracking throughout application:
- Track api_latency: measure request start to end, log with endpoint and status_code dimensions
- Track ai_processing_time: measure AI analysis duration in journal entry processing
- Track transcription_duration: measure time for Whisper API calls
- Track sms_delivery_success and sms_delivery_failure: track Twilio send outcomes
- Use performance.now() for timing measurements
- Include userId dimension for per-user analysis
- Log metrics at 'info' level with duration in context

### 21.7. Implement rate limiting using KV counters

**Status:** pending  
**Dependencies:** 21.3  

Build rate limiting system using Cloudflare KV with configurable limits per endpoint and user

**Details:**

Create src/lib/rate-limit.ts:
- Implement checkRateLimit(userId: string, endpoint: string, limit: number, windowSeconds: number): Promise<boolean>
- Use KV keys: rate-limit:{userId}:{endpoint}:{windowStart}
- Store counter value and expiration (TTL = windowSeconds)
- Limits: entry creation 100/hour (3600s), phone verification 10/hour
- Return RATE_LIMIT_EXCEEDED error when limit exceeded
- Include headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
- Log rate limit violations with userId and endpoint

### 21.8. Apply rate limiting to entry creation and phone verification endpoints

**Status:** pending  
**Dependencies:** 21.7, 21.4  

Integrate rate limiting middleware into API endpoints that require throttling

**Details:**

Add rate limiting to endpoints:
- Apply to POST /api/entries (100 requests/hour per user)
- Apply to POST /api/settings/verify-phone (10 requests/hour per user)
- Call checkRateLimit before processing request
- Return 429 status with RATE_LIMIT_EXCEEDED error if limit exceeded
- Include rate limit headers in all responses
- Log rate limit violations with full context (userId, endpoint, requestId)
- Ensure rate limiting happens before expensive operations

### 21.9. Configure alerting for high error rates and slow responses

**Status:** pending  
**Dependencies:** 21.6  

Set up monitoring alerts for critical performance and error conditions

**Details:**

Configure alerting strategy (implementation depends on monitoring tool):
- Alert on error rate >5% over 5-minute window (group by endpoint)
- Alert on API latency p95 >2000ms over 5-minute window
- Alert on Twilio SMS failures >10% over 15-minute window
- Alert on AI/transcription API quota exhaustion (track quota usage in metrics)
- Document alert configuration in README or monitoring setup guide
- Use Cloudflare Workers Analytics Engine for querying
- Consider Cloudflare Workers notifications or external service (PagerDuty, Slack) for Phase 2

### 21.10. Integrate processing_log table for AI/transcription operations

**Status:** pending  
**Dependencies:** 21.1, 21.2  

Log all AI analysis and transcription operations to processing_log table for debugging and tracking

**Details:**

Enhance AI/transcription operations with logging:
- Insert into processing_log table when starting AI/transcription operations (status=pending)
- Update processing_log on completion (status=completed, error_message if failed)
- Store operation_type (e.g., 'gemini_analysis', 'whisper_transcription')
- Store input_data reference (journal_entry_id or media reference)
- Store duration in processing_time_ms
- Sanitize input_data and output_data to prevent PII logging
- Log processing_log insertions/updates using logger with appropriate context

### 21.11. Create Glass spec for lib/error-handling.glass

**Status:** pending  
**Dependencies:** 21.1, 21.2, 21.3, 21.4, 21.5, 21.7, 21.10  

Document error handling system contract and intent in Glass framework format

**Details:**

Create glass/lib/error-handling.glass following Glass framework format:
- Intent: Reliable error tracking and debugging for all API operations
- Contract: Guarantees structured error responses (code, message, details), PII protection in all logs, metric collection for key operations, rate limit enforcement per endpoint/user
- Inputs: Errors from any application layer, log contexts from request handlers
- Outputs: Structured JSON error responses, sanitized logs, metrics in Analytics Engine, rate limit decisions
- Dependencies: Cloudflare KV (rate limiting), Analytics Engine (metrics), D1 processing_log table
- Document error codes, rate limits, PII filtering rules, and alerting thresholds
