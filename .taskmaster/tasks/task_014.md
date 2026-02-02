# Task ID: 14

**Title:** Create React SPA frontend with Vite build system

**Status:** pending

**Dependencies:** 4

**Priority:** high

**Description:** Initialize React single-page application with Vite, configure routing, authentication context, API client, and deploy to Cloudflare Pages or Workers static assets.

**Details:**

Run `npm create vite@latest frontend -- --template react-ts`.

Project structure:
```
frontend/
  src/
    App.tsx - Main app with routing
    main.tsx - Entry point
    pages/
      Login.tsx - Google OAuth button
      Dashboard.tsx - Entry timeline
      EntryView.tsx - Single entry detail
      NewEntry.tsx - Create entry form
      Settings.tsx - User settings
    components/
      EntryCard.tsx - Entry display component
      MediaPlayer.tsx - Audio/video player
      Calendar.tsx - Calendar sidebar
      Header.tsx - Navigation header
    lib/
      api.ts - Fetch wrapper with JWT
      auth.ts - Auth context provider
    types/
      index.ts - TypeScript interfaces matching backend
```

Install: react-router-dom, @tanstack/react-query (API state), date-fns (date formatting), tailwindcss (styling).

API client handles:
- JWT token in Authorization header
- Automatic token refresh
- Error handling and toast notifications
- Request/response type safety

Deploy: Build with Vite, upload to Cloudflare Pages, or serve from Workers using static asset handler.

Glass spec:
- `glass/frontend/app.glass` - Intent: web interface for journal management; Contract: guarantees authenticated API calls, responsive design, offline-first approach (optional)

**Test Strategy:**

Test dev server with `npm run dev`. Verify routing works. Test API client with authenticated requests. Test build output with `npm run build`. Deploy to staging and verify all routes work. Test on mobile viewport.

## Subtasks

### 14.1. Initialize Vite React TypeScript project

**Status:** pending  
**Dependencies:** None  

Run npm create vite command to scaffold the frontend React application with TypeScript template and verify initial setup works.

**Details:**

Execute `npm create vite@latest frontend -- --template react-ts` in the project root. Navigate to frontend directory and run `npm install`. Test with `npm run dev` to ensure Vite dev server starts successfully. Verify TypeScript configuration is present and working. Check that basic React app renders at localhost.

### 14.2. Install core dependencies and configure Tailwind CSS

**Status:** pending  
**Dependencies:** 14.1  

Install react-router-dom, @tanstack/react-query, date-fns, and tailwindcss with configuration.

**Details:**

Run `npm install react-router-dom @tanstack/react-query date-fns`. Install and configure Tailwind: `npm install -D tailwindcss postcss autoprefixer && npx tailwindcss init -p`. Update tailwind.config.js with content paths for src/**/*.{js,jsx,ts,tsx}. Create src/index.css with Tailwind directives (@tailwind base, components, utilities). Import index.css in main.tsx.

### 14.3. Create project directory structure

**Status:** pending  
**Dependencies:** 14.1  

Set up the complete frontend folder structure for pages, components, lib, and types directories.

**Details:**

Create directories: src/pages/, src/components/, src/lib/, src/types/. Create placeholder files: pages/Login.tsx, Dashboard.tsx, EntryView.tsx, NewEntry.tsx, Settings.tsx; components/EntryCard.tsx, MediaPlayer.tsx, Calendar.tsx, Header.tsx; lib/api.ts, auth.ts; types/index.ts. Each placeholder should export a basic functional component or empty object/interface to prevent import errors.

### 14.4. Define TypeScript interfaces matching backend schema

**Status:** pending  
**Dependencies:** 14.3  

Create comprehensive TypeScript type definitions in types/index.ts that match the D1 database schema and API contracts.

**Details:**

In src/types/index.ts, define interfaces for: User (id, email, displayName, avatarUrl, phoneNumber, timezone, voiceStyle, createdAt), Entry (id, userId, rawContent, polishedContent, entryDate, type, source, tags, mood, location, processingStatus), Media (id, entryId, type, url, duration, transcription), Reminder (id, userId, title, message, scheduledFor), ApiResponse generic wrapper, PaginatedResponse<T>, AuthContextType. Include all fields from the backend schema.

### 14.5. Implement authentication context provider with JWT management

**Status:** pending  
**Dependencies:** 14.4  

Create auth context that handles JWT token storage, refresh, and provides authentication state to the app.

**Details:**

In src/lib/auth.ts, create AuthContext using React Context API. Implement AuthProvider component that: stores JWT in localStorage, provides login/logout functions, exposes user state and isAuthenticated boolean, handles token expiration checks, provides getToken() function for API calls. Include useAuth() custom hook for consuming context. Handle initial token validation on app load. Implement automatic logout on token expiry.

### 14.6. Build API client wrapper with authentication and error handling

**Status:** pending  
**Dependencies:** 14.4, 14.5  

Create centralized API client in lib/api.ts with automatic JWT injection, token refresh, and comprehensive error handling.

**Details:**

In src/lib/api.ts, create fetchAPI wrapper function that: reads JWT from AuthContext, adds Authorization: Bearer <token> header, handles 401 responses with token refresh attempt, implements retry logic for failed requests, parses JSON responses with type safety, throws typed errors for different status codes. Export typed API methods: getEntries(), createEntry(), updateEntry(), deleteEntry(), etc. Include request/response interceptors for logging in development.

### 14.7. Configure React Router with protected route guards

**Status:** pending  
**Dependencies:** 14.3, 14.5  

Set up client-side routing with react-router-dom including public and protected routes based on authentication state.

**Details:**

In src/App.tsx, configure BrowserRouter with routes: / (redirect to /dashboard or /login), /login (public), /dashboard (protected), /entry/:id (protected), /new (protected), /settings (protected). Create ProtectedRoute component that checks authentication via useAuth() and redirects to /login if unauthenticated. Wrap authenticated routes with ProtectedRoute. Configure React Query QueryClientProvider in App.tsx wrapping Router.

### 14.8. Implement toast notification system for error and success messages

**Status:** pending  
**Dependencies:** 14.2  

Add global toast notification system for displaying API errors, success messages, and user feedback.

**Details:**

Install react-hot-toast or similar library: `npm install react-hot-toast`. Create src/lib/toast.ts with typed wrapper functions: showSuccess(), showError(), showInfo(). Add Toaster component to App.tsx. Integrate toast notifications in API client error handling to automatically show errors. Export useToast hook for manual toast triggering in components. Configure toast positioning, duration, and styling with Tailwind classes.

### 14.9. Create basic page components with routing integration

**Status:** pending  
**Dependencies:** 14.7, 14.8  

Implement skeleton components for all pages (Login, Dashboard, EntryView, NewEntry, Settings) with basic structure and navigation.

**Details:**

Implement each page component with: Login.tsx (Google OAuth button placeholder, form layout), Dashboard.tsx (header with navigation, entry list placeholder, calendar sidebar placeholder), EntryView.tsx (entry detail view with back button), NewEntry.tsx (form with text input, media upload placeholder), Settings.tsx (settings form with user preferences). Add Header component with navigation links and user menu. Ensure all pages use Tailwind for responsive layout.

### 14.10. Configure Vite build and deploy to Cloudflare Pages

**Status:** pending  
**Dependencies:** 14.9  

Set up production build configuration and deploy the frontend to Cloudflare Pages with proper environment configuration.

**Details:**

Update vite.config.ts with build optimizations (chunk splitting, minification). Create .env.example with API_URL, GOOGLE_CLIENT_ID placeholders. Configure base URL for API calls based on environment. Run `npm run build` and verify dist/ output. Create wrangler.toml for Pages or use Cloudflare Pages dashboard. Deploy to Cloudflare Pages: connect Git repo or use `wrangler pages publish dist`. Configure environment variables in Cloudflare dashboard. Set up preview deployments for branches. Create glass/frontend/app.glass spec file documenting Intent (web interface for journal management) and Contract (authenticated API calls, responsive design).
