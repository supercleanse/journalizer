# Task ID: 4

**Title:** Set up Hono router and worker entry point with middleware pipeline

**Status:** pending

**Dependencies:** 3

**Priority:** high

**Description:** Configure Hono as the routing framework, set up the worker entry point in src/index.ts with CORS, authentication middleware, error handling, and route organization.

**Details:**

Install Hono: `npm install hono`. Create `src/index.ts` as the Worker entry point implementing the fetch handler.

Router structure:
```typescript
const app = new Hono()

// Global middleware
app.use('*', cors({ origin: 'https://journalizer.com', credentials: true }))
app.use('*', errorHandler)

// Public routes
app.route('/auth', authRoutes)

// Protected routes (require auth)
app.use('/api/*', authMiddleware)
app.route('/api/entries', entriesRoutes)
app.route('/api/media', mediaRoutes)
app.route('/api/settings', settingsRoutes)
app.route('/api/reminders', remindersRoutes)
app.route('/api/export', exportRoutes)

// Webhooks (Twilio signature validation)
app.route('/api/webhooks', webhooksRoutes)

export default app
```

Implement error handler that catches all errors, logs to console, returns structured JSON error responses. Set up proper TypeScript bindings for Cloudflare Workers environment (Env type with D1, R2, KV bindings).

Glass spec:
- `glass/index.glass` - Intent: HTTP request routing and orchestration; Contract: guarantees authentication on protected routes, CORS headers, structured error responses

**Test Strategy:**

Test with `wrangler dev` and make requests to all route paths. Verify CORS headers in OPTIONS requests. Test that /api/* routes return 401 without valid JWT. Confirm error handler catches and formats errors correctly. Use curl to test each endpoint.

## Subtasks

### 4.1. Install Hono and create basic Worker entry point in src/index.ts

**Status:** pending  
**Dependencies:** None  

Install Hono framework and set up the basic Worker entry point with minimal fetch handler configuration.

**Details:**

Run `npm install hono` to install the framework. Create `src/index.ts` with a basic Hono app instance and export default fetch handler. Implement minimal structure: `const app = new Hono(); export default app;`. This establishes the foundation for all subsequent middleware and routing configuration.

### 4.2. Define TypeScript Env type with D1, R2, KV bindings

**Status:** pending  
**Dependencies:** 4.1  

Create TypeScript type definitions for the Cloudflare Workers environment including all required bindings.

**Details:**

In `src/index.ts` or separate `src/types/env.ts`, define the Env interface with proper TypeScript bindings: `interface Env { DB: D1Database; MEDIA: R2Bucket; KV: KVNamespace; GOOGLE_CLIENT_ID: string; GOOGLE_CLIENT_SECRET: string; TWILIO_ACCOUNT_SID: string; TWILIO_AUTH_TOKEN: string; TWILIO_PHONE_NUMBER: string; ANTHROPIC_API_KEY: string; DEEPGRAM_API_KEY: string; JWT_SECRET: string; }`. This enables type-safe access to all Cloudflare bindings throughout the application.

### 4.3. Implement global CORS middleware with proper configuration

**Status:** pending  
**Dependencies:** 4.1  

Configure CORS middleware to allow requests from the Journalizer frontend with credentials support.

**Details:**

Import `cors` from `hono/cors` and add global CORS middleware: `app.use('*', cors({ origin: 'https://journalizer.com', credentials: true }))`. This ensures all routes respond with proper CORS headers for cross-origin requests from the frontend, including support for cookies and authentication tokens.

### 4.4. Implement global error handler middleware with structured JSON responses

**Status:** pending  
**Dependencies:** 4.1  

Create error handling middleware that catches all errors and returns consistent JSON error responses.

**Details:**

Create error handler middleware function that catches errors, logs them to console with context (request path, method, timestamp), and returns structured JSON responses with format: `{ error: { message: string, code: string, status: number } }`. Add middleware with `app.use('*', errorHandler)`. Handle different error types: validation errors (400), authentication errors (401), not found (404), and internal errors (500).

### 4.5. Set up auth middleware for /api/* protected routes

**Status:** pending  
**Dependencies:** 4.2, 4.4  

Implement authentication middleware that validates JWT tokens for all protected API routes.

**Details:**

Create `authMiddleware` function (stub implementation for now, full JWT validation will be implemented in Task 3). Middleware should extract JWT from Authorization header, validate token format, and set user context in request. Add to Hono app: `app.use('/api/*', authMiddleware)`. This ensures all /api/* routes require valid authentication before processing requests. Return 401 Unauthorized if token is missing or invalid.

### 4.6. Configure route organization for all API modules

**Status:** pending  
**Dependencies:** 4.3, 4.5  

Set up route structure with placeholder handlers for auth, entries, media, settings, reminders, export, and webhooks routes.

**Details:**

Create route files: `src/routes/auth.ts`, `src/routes/entries.ts`, `src/routes/media.ts`, `src/routes/settings.ts`, `src/routes/reminders.ts`, `src/routes/export.ts`, `src/routes/webhooks.ts`. Each exports a Hono app instance with placeholder handlers. In `src/index.ts`, import all route modules and register them: `app.route('/auth', authRoutes)` for public auth routes, then `app.route('/api/entries', entriesRoutes)`, `app.route('/api/media', mediaRoutes)`, `app.route('/api/settings', settingsRoutes)`, `app.route('/api/reminders', remindersRoutes)`, `app.route('/api/export', exportRoutes)`, `app.route('/api/webhooks', webhooksRoutes)` for protected and webhook routes.

### 4.7. Create Glass spec for index.glass with routing contract

**Status:** pending  
**Dependencies:** 4.6  

Document the HTTP routing and orchestration contract in glass/index.glass following Glass Framework conventions.

**Details:**

Create `glass/index.glass` file documenting: Intent (HTTP request routing and orchestration), Contract (guarantees authentication on protected routes via authMiddleware on /api/*, CORS headers on all responses with origin https://journalizer.com and credentials support, structured error responses with format { error: { message, code, status } }), Inputs (HTTP requests to /auth/*, /api/*, /api/webhooks/*), Outputs (HTTP responses with proper status codes and headers), Dependencies (authMiddleware, errorHandler, CORS middleware), and Error Handling (all errors caught by global errorHandler, returns JSON with appropriate status codes).
