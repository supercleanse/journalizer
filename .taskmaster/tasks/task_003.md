# Task ID: 3

**Title:** Implement Google OAuth 2.0 authentication flow with session management

**Status:** pending

**Dependencies:** 2

**Priority:** high

**Description:** Build complete OAuth authentication using Google OAuth 2.0, including login initiation, callback handling, JWT session management with HttpOnly cookies, and CSRF protection.

**Details:**

Implement four auth endpoints in `src/routes/auth.ts`:

1. GET /auth/google - Redirect to Google consent screen with state parameter for CSRF protection, scopes: email, profile
2. GET /auth/callback - Exchange authorization code for tokens using Google token endpoint, extract user info from ID token (sub, email, name, picture), create/update user in D1, issue session JWT
3. POST /auth/logout - Clear session cookie and KV session entry
4. GET /auth/me - Return current user info from JWT

Store JWT signing key as Worker Secret. Sessions stored in KV with 1-hour TTL, refresh tokens in KV with 7-day TTL. JWT payload: { userId, email, iat, exp }. Use HttpOnly, Secure, SameSite=Lax cookies.

Create middleware in `src/lib/auth.ts` for JWT verification and user context injection.

Glass specs:
- `glass/auth/oauth.glass` - Intent: user identity verification; Contract: guarantees CSRF protection, secure token handling, no credential exposure
- `glass/auth/session.glass` - Intent: stateless session management; Contract: guarantees JWT integrity, automatic expiration, HttpOnly cookie security

**Test Strategy:**

Mock Google OAuth endpoints and test full flow. Verify state parameter prevents CSRF. Test JWT signing/verification. Confirm cookies have HttpOnly and Secure flags. Test session expiration and refresh. Validate that invalid JWTs are rejected.

## Subtasks

### 3.1. Implement GET /auth/google endpoint with Google OAuth consent redirect

**Status:** pending  
**Dependencies:** None  

Create the initial OAuth flow endpoint that redirects users to Google's consent screen with proper CSRF state parameter and OAuth scopes (email, profile).

**Details:**

In `src/routes/auth.ts`, implement GET /auth/google endpoint that: (1) generates a cryptographically secure random state parameter for CSRF protection, (2) stores state in KV with 5-minute TTL, (3) constructs Google OAuth URL with client_id, redirect_uri, response_type=code, scope=email+profile, state parameter, (4) redirects user to Google consent screen. Client ID and redirect URI should be from Worker environment variables.

### 3.2. Implement GET /auth/callback endpoint with authorization code exchange

**Status:** pending  
**Dependencies:** 3.1  

Build the OAuth callback handler that receives the authorization code from Google, validates the state parameter, and exchanges the code for access and ID tokens.

**Details:**

In `src/routes/auth.ts`, implement GET /auth/callback endpoint that: (1) extracts code and state query parameters, (2) validates state against KV store and deletes it (one-time use), (3) exchanges authorization code for tokens by POSTing to Google's token endpoint (https://oauth2.googleapis.com/token) with code, client_id, client_secret, redirect_uri, grant_type=authorization_code, (4) receives access_token, id_token, and refresh_token in response. Handle errors for invalid state (CSRF attack) or failed token exchange.

### 3.3. Extract user info from Google ID token and create/update user in D1

**Status:** pending  
**Dependencies:** 3.2  

Decode the Google ID token to extract user information (sub, email, name, picture) and create a new user record in D1 or update existing user information.

**Details:**

Continue callback handler: (1) decode JWT ID token from Google (verify signature using Google's public keys from https://www.googleapis.com/oauth2/v3/certs), (2) extract claims: sub (Google user ID), email, name, picture, (3) query D1 users table by google_id=sub, (4) if user exists, UPDATE display_name, profile_picture_url, updated_at, (5) if new user, INSERT with google_id, email, display_name, profile_picture_url, created_at, updated_at. Return userId for session creation.

### 3.4. Implement JWT session management with signing and verification

**Status:** pending  
**Dependencies:** 3.3  

Build JWT creation and verification utilities for stateless session management with proper signing using Worker secrets and payload validation.

**Details:**

Create `src/lib/auth.ts` with functions: (1) `createSessionJWT(userId: string, email: string, secret: string): string` - creates JWT with payload { userId, email, iat: Date.now()/1000, exp: iat + 3600 }, signed with HS256 using Worker secret, (2) `verifySessionJWT(token: string, secret: string): { userId, email } | null` - verifies signature and expiration, returns payload or null if invalid/expired. Use a JWT library compatible with Cloudflare Workers (e.g., jose or @tsndr/cloudflare-worker-jwt).

### 3.5. Set up HttpOnly Secure cookies with session JWT and proper security flags

**Status:** pending  
**Dependencies:** 3.4  

Configure secure cookie handling for session JWTs with HttpOnly, Secure, SameSite=Lax flags to prevent XSS and CSRF attacks.

**Details:**

In callback handler after JWT creation: (1) set session cookie with name 'session', value=JWT, HttpOnly=true (prevents JavaScript access), Secure=true (HTTPS only), SameSite=Lax (CSRF protection while allowing normal navigation), Max-Age=3600 (1 hour), Path=/, (2) use response.headers.set('Set-Cookie', ...) with properly formatted cookie string. Also store refresh_token from Google in KV with key `refresh:${userId}`, TTL 7 days for future token refresh capability.

### 3.6. Implement POST /auth/logout endpoint to clear session

**Status:** pending  
**Dependencies:** 3.5  

Build logout endpoint that clears the session cookie and removes session data from KV storage to completely terminate user session.

**Details:**

In `src/routes/auth.ts`, implement POST /auth/logout endpoint that: (1) reads session JWT from cookie, (2) if valid, extract userId and delete refresh token from KV (key `refresh:${userId}`), (3) clear session cookie by setting Set-Cookie with same name, empty value, Max-Age=0, and same Path, Domain, (4) return { success: true, message: 'Logged out successfully' }. Endpoint should work even if JWT is invalid/expired (always clear cookie).

### 3.7. Implement GET /auth/me endpoint to return current user info

**Status:** pending  
**Dependencies:** 3.4  

Create endpoint that returns authenticated user's profile information extracted from the session JWT.

**Details:**

In `src/routes/auth.ts`, implement GET /auth/me endpoint that: (1) uses auth middleware (see subtask 8) to verify JWT and inject user context, (2) queries D1 users table for full user profile by userId from JWT, (3) returns JSON: { userId, email, displayName, profilePictureUrl, createdAt }. If JWT is missing/invalid, middleware returns 401 Unauthorized before reaching handler.

### 3.8. Create auth middleware for JWT verification and user context injection

**Status:** pending  
**Dependencies:** 3.4  

Build reusable middleware that verifies session JWT from cookies and injects authenticated user context into request for protected routes.

**Details:**

In `src/lib/auth.ts`, create middleware function `requireAuth(handler)` that: (1) extracts session cookie from request.headers.get('Cookie'), (2) parses cookie to get JWT value, (3) calls verifySessionJWT() to validate token, (4) if valid, inject user context into request (e.g., request.user = { userId, email }) and call next handler, (5) if invalid/missing, return 401 response with { error: 'Unauthorized', message: 'Valid session required' }. Export middleware for use in protected routes.

### 3.9. Set up KV storage for session and refresh tokens with TTL

**Status:** pending  
**Dependencies:** None  

Configure Cloudflare KV namespace bindings for storing OAuth state parameters, refresh tokens, and session invalidation with automatic TTL-based expiration.

**Details:**

In `wrangler.toml`, add KV namespace binding: [[kv_namespaces]] binding = "AUTH_KV", id = "<production-id>", preview_id = "<preview-id>". Create KV namespace using `wrangler kv:namespace create AUTH_KV`. Update TypeScript types to include AUTH_KV in Env interface. Use KV methods: (1) put(key, value, { expirationTtl: seconds }) for state (300s), refresh tokens (604800s/7 days), (2) get(key) for retrieval, (3) delete(key) for cleanup. Key patterns: `state:${randomId}`, `refresh:${userId}`.

### 3.10. Create Glass specification files for OAuth and session management

**Status:** pending  
**Dependencies:** 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9  

Document the authentication system's intent and contracts in Glass framework format for oauth.glass and session.glass specification files.

**Details:**

Create `glass/auth/oauth.glass` with: Intent: 'User identity verification via Google OAuth 2.0', Contract: 'Guarantees CSRF protection via state parameter, secure authorization code exchange, no credential exposure in URLs/logs, proper error handling for auth failures'. Create `glass/auth/session.glass` with: Intent: 'Stateless session management with JWT', Contract: 'Guarantees JWT integrity via HMAC signature, automatic 1-hour expiration, HttpOnly cookie prevents XSS, SameSite=Lax prevents CSRF, refresh token rotation for extended sessions'. Follow GLASS.md format conventions.
