# Task ID: 6

**Title:** Integrate Anthropic Claude API for journal entry text polishing

**Status:** pending

**Dependencies:** 2, 4

**Priority:** high

**Description:** Implement AI text refinement using Claude API (Haiku model for cost efficiency) that polishes raw journal entries while preserving the user's authentic voice and applying user-specific voice style preferences.

**Details:**

Create `src/services/ai.ts` with:

```typescript
async function polishEntry(rawText: string, userPreferences: VoicePreferences): Promise<string>
```

Use Claude 3 Haiku via Anthropic API. System prompt (from PRD section 8.2):
```
You are a journal editor. Your job is to take a raw journal entry and lightly polish it for readability. Rules:
- Keep the author's voice, words, and personality intact
- Fix obvious typos, grammar, and punctuation
- Add paragraph breaks where natural
- Do NOT add content the author didn't write
- Do NOT change the meaning or tone
- The result should read like a natural journal entry, not a blog post
- Voice style preference: ${user.voiceStyle}
- Additional voice notes: ${user.voiceNotes}
```

Support voice styles: natural (minimal), conversational (light cleanup), reflective (structured), polished (thorough). Include user's custom voice notes from settings.

Implement retry logic with exponential backoff. Log all API calls to processing_log table. Handle rate limits gracefully.

Glass spec:
- `glass/services/ai.glass` - Intent: enhance readability while preserving authenticity; Contract: guarantees no content addition, voice preservation, idempotency, failure recovery

**Test Strategy:**

Test with various raw inputs: typos, run-on sentences, stream-of-consciousness text. Verify output maintains user's words and tone. Test all voice style options. Mock API failures and verify retry logic. Measure latency and cost per request. Validate that personal info is not leaked in logs.

## Subtasks

### 6.1. Set up Anthropic API client and implement basic polishEntry function

**Status:** pending  
**Dependencies:** None  

Create src/services/ai.ts with Anthropic SDK integration, API key configuration from environment, and skeleton polishEntry function that accepts rawText and userPreferences parameters.

**Details:**

Install @anthropic-ai/sdk package. Create ai.ts service file with proper TypeScript types for VoicePreferences interface (voiceStyle: 'natural' | 'conversational' | 'reflective' | 'polished', voiceNotes?: string). Initialize Anthropic client with API key from env.ANTHROPIC_API_KEY. Implement basic polishEntry function signature that returns a Promise<string>. Use Claude 3 Haiku model (claude-3-haiku-20240307) for cost efficiency.

### 6.2. Implement dynamic system prompt construction based on voice preferences

**Status:** pending  
**Dependencies:** 6.1  

Build prompt builder that generates the system prompt dynamically by incorporating user's voice style preference and custom voice notes into the base journal editor prompt.

**Details:**

Create buildSystemPrompt(userPreferences: VoicePreferences): string helper function. Start with base prompt: 'You are a journal editor. Your job is to take a raw journal entry and lightly polish it for readability. Rules: - Keep the author's voice, words, and personality intact - Fix obvious typos, grammar, and punctuation - Add paragraph breaks where natural - Do NOT add content the author didn't write - Do NOT change the meaning or tone - The result should read like a natural journal entry, not a blog post'. Append voice style guidance and user's custom voice notes to the system prompt.

### 6.3. Implement voice style logic for natural, conversational, reflective, and polished modes

**Status:** pending  
**Dependencies:** 6.2  

Define specific guidance text for each of the four voice style options that will be injected into the system prompt to control the level of polish applied by Claude.

**Details:**

Create voice style mapping: 'natural' = minimal changes, only fix obvious errors; 'conversational' = light cleanup, maintain casual tone; 'reflective' = add structure and paragraph breaks, thoughtful tone; 'polished' = thorough editing for clarity and flow. Implement getVoiceStyleGuidance(style: VoiceStyle): string function that returns appropriate guidance text. This text instructs Claude on how aggressively to polish based on user preference.

### 6.4. Integrate user custom voice notes into prompt generation

**Status:** pending  
**Dependencies:** 6.2  

Extend prompt builder to safely incorporate user's custom voice notes (free-form text preferences) into the system prompt without breaking prompt structure or enabling prompt injection.

**Details:**

Modify buildSystemPrompt to append user.voiceNotes if present. Add section: 'Additional voice notes from user: ${userPreferences.voiceNotes}'. Sanitize voice notes to prevent prompt injection (though Claude API has built-in protections). Handle null/undefined voice notes gracefully. Ensure voice notes are clearly delineated in prompt to prevent confusion with core instructions.

### 6.5. Implement retry logic with exponential backoff for API failures

**Status:** pending  
**Dependencies:** 6.1  

Add robust retry mechanism that handles transient API failures using exponential backoff strategy with configurable max retries and backoff multiplier.

**Details:**

Create retry wrapper function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T>. Implement exponential backoff: first retry after 1s, second after 2s, third after 4s, etc. Max 3 retries by default. Retry on network errors, 5xx status codes, and rate limit errors (429). Don't retry on 4xx client errors (except 429). Use Anthropic SDK's error types to distinguish error categories. Add jitter to prevent thundering herd.

### 6.6. Implement rate limit handling for Anthropic API

**Status:** pending  
**Dependencies:** 6.5  

Add graceful handling of rate limit responses (429 status) from Anthropic API, respecting Retry-After headers and providing informative errors when rate limits are exhausted.

**Details:**

Check for 429 status code in API responses. Read Retry-After header if present and wait specified duration before retrying. If rate limit persists after retries, throw RateLimitError with clear message. Consider implementing client-side rate limiting to prevent hitting API limits. Track rate limit events in logs. Return user-friendly error message: 'AI service temporarily unavailable due to high demand, please try again shortly'.

### 6.7. Log all API calls to processing_log table without exposing PII

**Status:** pending  
**Dependencies:** 6.1  

Implement comprehensive logging of AI API operations to D1 processing_log table, tracking costs, latency, token usage, and errors while ensuring no personally identifiable information is logged.

**Details:**

Create logProcessing(type: 'ai_polish', userId: string, metadata: ProcessingMetadata) helper that inserts to processing_log table. Log: operation type, user_id (UUID only, no email/name), timestamp, duration_ms, tokens_used (from API response), estimated_cost (tokens * price per token), status (success/failure), error_message if failed. DO NOT log: raw entry text, polished text, user voice notes, any content. Store only metadata: text length, model used, voice style selected.

### 6.8. Implement cost and latency tracking for AI operations

**Status:** pending  
**Dependencies:** 6.7  

Add monitoring and metrics collection for AI API usage including token consumption, cost per request, response latency, and aggregate statistics for budget management.

**Details:**

Track usage metrics: input_tokens, output_tokens from API response. Calculate cost: Haiku pricing is ~$0.25 per 1M input tokens, ~$1.25 per 1M output tokens (verify current pricing). Store in processing_log. Add latency tracking: measure time from API call to response. Create helper getCostEstimate(inputTokens: number, outputTokens: number): number. Consider adding aggregate queries for daily/monthly cost reporting. Set up alerts if costs exceed thresholds.

### 6.9. Create Glass spec for services/ai.glass with voice preservation contract

**Status:** pending  
**Dependencies:** 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8  

Document the AI service contract in Glass format specifying intent, guarantees (no content addition, voice preservation, idempotency), failure modes, and verification strategy.

**Details:**

Create glass/services/ai.glass file following GLASS.md format. Intent: Enhance journal entry readability while preserving authentic voice. Contract guarantees: (1) No content addition - output only contains words/ideas from input, (2) Voice preservation - maintains author's tone, style, personality, (3) Idempotency - same input + preferences = same output, (4) Failure recovery - retries transient errors, (5) Privacy - no PII logged. Define invariants, edge cases, and testing strategy. Document voice style behavior matrix. Specify how to verify AI didn't add content (e.g., word-level diff analysis showing only edits, not additions).
