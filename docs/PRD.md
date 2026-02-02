# Journalizer — Design Document

**Repository:** `supercleans/journalizer`
**Version:** 1.0 Draft
**Date:** February 2, 2026

---

## 1. Executive Summary

Journalizer is a web-based journaling application that makes capturing life's moments as easy as sending a text message. Users can submit journal entries via SMS/MMS (text, photos, audio, video) or through a web dashboard. An AI layer — powered by Anthropic's Claude — refines raw input into polished, readable journal entries while preserving the user's authentic voice. The platform also offers configurable reminders, a rich web dashboard for browsing entries, and a future print-on-demand subscription for receiving physical journal volumes by mail.

The application will be built in TypeScript, deployed to Cloudflare Workers, and backed by Cloudflare's native storage ecosystem (D1, R2, KV).

---

## 2. Project Setup & Repository

### 2.1 GitHub Repository

- **Organization/User:** `supercleans`
- **Repository Name:** `journalizer`
- **Full path:** `supercleans/journalizer`

### 2.2 Initial Setup Checklist

1. Create the GitHub repository at `supercleans/journalizer`
2. Initialize with a TypeScript + Cloudflare Workers scaffold (using `create-cloudflare`)
3. Configure branch protection on `main` (require PR reviews)
4. Set up CI/CD via GitHub Actions for linting, testing, and deploying to Cloudflare
5. Add `.env.example` with all required environment variable keys
6. Create a `README.md` with project overview, setup instructions, and architecture diagram

### 2.3 Recommended Project Structure

```
supercleans/journalizer/
├── src/
│   ├── index.ts                 # Worker entry point / router
│   ├── routes/
│   │   ├── auth.ts              # Google OAuth flow
│   │   ├── api/
│   │   │   ├── entries.ts       # CRUD for journal entries
│   │   │   ├── reminders.ts     # Reminder configuration
│   │   │   ├── settings.ts      # User settings / voice config
│   │   │   └── webhooks.ts      # Twilio inbound SMS/MMS handler
│   │   └── pages/
│   │       ├── dashboard.ts     # Dashboard HTML renderer
│   │       └── entry.ts         # Single entry view
│   ├── services/
│   │   ├── ai.ts                # Anthropic API integration
│   │   ├── transcription.ts     # Speech-to-text (Deepgram)
│   │   ├── media.ts             # R2 media upload/retrieval
│   │   ├── sms.ts               # Twilio send/receive
│   │   └── reminders.ts         # Reminder scheduling logic
│   ├── db/
│   │   ├── schema.sql           # D1 schema definitions
│   │   ├── migrations/          # Incremental migration files
│   │   └── queries.ts           # Typed query helpers
│   ├── lib/
│   │   ├── auth.ts              # JWT / session management
│   │   └── utils.ts             # Shared utilities
│   └── types/
│       └── index.ts             # Shared TypeScript interfaces
├── frontend/                     # SPA / static assets
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   ├── components/
│   │   └── styles/
│   └── vite.config.ts
├── wrangler.toml                 # Cloudflare Workers config
├── package.json
├── tsconfig.json
└── .github/
    └── workflows/
        └── deploy.yml
```

---

## 3. Competitor Analysis

### 3.1 Key Competitors

| App | SMS Journaling | AI Features | Media Support | Price | Print Option |
|-----|---------------|-------------|---------------|-------|-------------|
| **Day One** | Yes (US/Canada only, Premium) | Basic prompts | Photos, video, audio | Free / $34.99/yr Premium | Book printing via built-in feature |
| **Journey** | No | Mood tracking, guided prompts | Photos, audio | Free / $29.99/yr | PDF export only |
| **Reflection** | No | AI-enhanced insights, voice-to-text | Photos, voice notes | Free / $47.99/yr ($5.99/mo) | No |
| **Penzu** | No | None | Photos | Free / $19.99/yr | No |
| **Rosebud** | No | AI chatbot-style journaling | Text only | $12.99/mo or $107.99/yr | No |
| **JournalFlow** | Telegram, Messenger, Email | Anniversary reminders | Photos, locations | Free | No |
| **Dabble Me** | Email-based | None | Text, photos via email | $4/mo | No |
| **Daylio** | No | Mood pattern charts | Icons, no free-form text | Free / $23.99/yr | No |

### 3.2 Market Gaps Journalizer Can Fill

1. **True multimedia SMS/MMS journaling:** Day One is the only serious competitor with SMS support, and it's limited to the US/Canada with a premium subscription. No competitor supports full rich media (photos, audio, video) over messaging as a first-class input method.
2. **AI polish that preserves voice:** Rosebud and Reflection use AI for prompts or insights, but none take a raw text snippet or voice memo and transform it into a clean journal entry while keeping the user's words intact.
3. **Audio/video transcription built in:** No major competitor automatically transcribes audio and video into journal text while attaching the original files.
4. **Print-on-demand subscriptions:** Day One offers one-off book printing, but no competitor provides a recurring subscription for monthly/quarterly/yearly printed journals shipped to your door.
5. **Smart reminders:** Most apps offer daily reminders. None offer "nudge only if you've missed X days" logic.

### 3.3 Pricing Recommendations

Based on the competitive landscape:

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | Web-only journaling, 5 entries/month, no SMS, no AI polish |
| **Personal** | $4.99/mo or $39.99/yr | Unlimited entries, SMS journaling, AI polish, audio transcription, reminders |
| **Premium** | $9.99/mo or $79.99/yr | Everything in Personal + video transcription, priority processing, advanced analytics, print-ready exports |
| **Print Add-on** | $14.99–$29.99/shipment | Monthly, quarterly, or yearly printed journal volumes |

These price points position Journalizer competitively against Day One ($34.99/yr) and Reflection ($47.99/yr) while offering significantly more functionality around SMS and AI. The print add-on is a unique revenue stream no competitor currently offers as a subscription.

> **Note:** Charging is Phase 2. Phase 1 will be free for all features to validate the product and gather user feedback.

---

## 4. System Architecture

### 4.1 High-Level Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────────┐
│  User Phone  │────▶│   Twilio      │────▶│  Cloudflare Worker   │
│  (SMS/MMS)   │◀────│  (Webhooks)   │◀────│  /api/webhooks/sms   │
└─────────────┘     └──────────────┘     └──────────┬──────────┘
                                                     │
┌─────────────┐                              ┌───────▼────────┐
│  Web Browser │─────────────────────────────▶│  Cloudflare    │
│  (SPA)       │◀────────────────────────────│  Worker (API)  │
└─────────────┘                              └───────┬────────┘
                                                     │
                    ┌────────────────────────────────┼────────────────────┐
                    │                                │                    │
              ┌─────▼─────┐                   ┌──────▼──────┐     ┌──────▼──────┐
              │  Cloudflare │                   │  Cloudflare  │     │  Cloudflare  │
              │  D1 (SQLite)│                   │  R2 (Media)  │     │  KV (Sessions│
              │  Database   │                   │  Storage     │     │  & Cache)    │
              └─────────────┘                   └─────────────┘     └──────────────┘
                    │
     ┌──────────────┼──────────────┐
     │              │              │
┌────▼────┐  ┌─────▼─────┐  ┌────▼─────┐
│Anthropic │  │ Deepgram   │  │ Twilio   │
│Claude API│  │ (STT)      │  │ (SMS)    │
└──────────┘  └───────────┘  └──────────┘
```

### 4.2 Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Runtime** | Cloudflare Workers | Edge-deployed, TypeScript-native, serverless, global distribution |
| **Language** | TypeScript | Type safety, developer experience, first-class Cloudflare support |
| **Database** | Cloudflare D1 (SQLite) | Native Workers integration, zero-latency binding, Time Travel backups (30-day point-in-time restore), serverless pricing. **Stores metadata only** (text, references, settings) — not media files. |
| **Media Storage** | Cloudflare R2 | S3-compatible object storage, zero egress fees, native Workers binding. **All binary media** (photos, audio, video) lives here — no practical storage cap. |
| **Session/Cache** | Cloudflare KV | Low-latency key-value store for sessions, tokens, and rate limiting |
| **Frontend** | React + Vite (deployed via Cloudflare Pages or Workers static assets) | Modern SPA, fast builds, TypeScript support |
| **SMS/MMS** | Twilio Programmable Messaging | Industry standard, MMS support for photos/audio/video, webhook-based, RCS support upcoming |
| **AI (Text Polish)** | Anthropic Claude API | High-quality text refinement while preserving voice |
| **Speech-to-Text** | Deepgram Nova-3 | Best balance of accuracy, speed, and cost ($0.0043/min); JavaScript SDK |
| **Authentication** | Google OAuth 2.0 | Simple user-facing login, well-documented, works with Workers |
| **Print-on-Demand** | Lulu Print API | RESTful API, 3,000+ format options, global shipping, no inventory, per-order fulfillment |

---

## 5. Infrastructure & Hosting Decision

### 5.1 Why Cloudflare Over Heroku

After research, **Cloudflare is the recommended platform**. Here's why:

| Concern | Cloudflare | Heroku |
|---------|-----------|--------|
| **Database** | D1 (SQLite-based) — up to 10 GB per database, SQL support via Drizzle ORM, zero-latency from Workers | Heroku Postgres — full Postgres, proven, but adds network latency and costs more |
| **Backups** | D1 Time Travel: restore to any minute within the last 30 days, automatic, no configuration needed | Depends on plan tier — 7 days on Standard, continuous on Premium |
| **Media Storage** | R2 — S3-compatible, zero egress fees, native binding | Would need S3 or similar, with egress costs |
| **Scaling** | Automatic, global edge deployment, pay-per-request | Dyno-based, requires manual scaling config |
| **Cold Starts** | None (V8 isolates) | Yes (especially on free/basic dynos) |
| **Cost at Low Scale** | Generous free tier (100K requests/day, 5M D1 reads/day, 10 GB R2 free) | $7/mo minimum per dyno + $9/mo Postgres |
| **TypeScript** | First-class support | Supported but not native |

**D1 is not Postgres**, but for this use case it's more than sufficient. Critically, D1 only stores **metadata and text** — journal entry text, user records, settings, and R2 object keys that point to where media files live. All binary media (photos, audio, video) is stored in R2, which has no practical storage limit. This means the 10 GB D1 cap is consumed only by text content, which compresses to very little. For context, 10 GB of plain text is roughly 5 million journal entries of 2,000 characters each — far beyond what even a large user base would produce in years.

D1 supports JSON functions, full-text search is achievable via virtual tables, and Drizzle ORM provides a typed query layer that abstracts the underlying dialect.

### 5.2 Storage Separation: D1 vs. R2

This is an important architectural distinction:

```
┌──────────────────────────────────────────────────────────────┐
│                     Cloudflare D1 (10 GB cap)                │
│                     METADATA & TEXT ONLY                      │
│                                                              │
│  • User accounts, settings, preferences                      │
│  • Journal entry text (raw + polished)                       │
│  • Transcriptions of audio/video                             │
│  • Media table rows (r2_key, file_size, mime_type, etc.)     │
│  • Reminder configs, processing logs                         │
│  • Print subscription records                                │
│                                                              │
│  Typical row size: ~1–5 KB                                   │
│  Estimated 10 GB capacity: ~2–5 million entries              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                   Cloudflare R2 (unlimited)                   │
│                   ALL BINARY MEDIA FILES                      │
│                                                              │
│  • Photos: 1–10 MB each                                      │
│  • Audio clips: 1–50 MB each                                 │
│  • Video files: 10–500 MB each                               │
│  • Thumbnails: 50–200 KB each                                │
│  • PDF exports, print-ready files                            │
│                                                              │
│  Storage cost: $0.015/GB/mo (first 10 GB free)               │
│  Egress cost: $0 (zero egress fees)                          │
│  No per-database cap — scales to TB+ without changes         │
└──────────────────────────────────────────────────────────────┘
```

A user who journals daily with a photo and a 1-minute audio clip generates roughly:
- **D1:** ~3–5 KB/day of metadata → ~1.5 MB/year
- **R2:** ~15–20 MB/day of media → ~6 GB/year

Even with 1,000 active users, D1 would hold ~1.5 GB after a full year. R2 would hold ~6 TB, but that's fine — R2 scales to this without issue at ~$90/month in storage.

### 5.3 Postgres Scale-Out Path

While D1 is well-suited for the POC and likely well beyond it, here is the explicit escape hatch if a migration to Postgres becomes necessary:

**When to consider migrating:**
- D1 database approaches 7–8 GB (monitor via Cloudflare dashboard)
- Need for advanced query features (full-text search with ranking, complex aggregations, window functions)
- Regulatory or compliance requirements that mandate a specific database engine
- Desire for the "battle-tested comfort" of Postgres for a production SaaS with paying customers

**How the migration works:**

1. **ORM abstraction is key.** By using Drizzle ORM from day one, all queries are written in TypeScript — not raw SQLite SQL. Drizzle supports both SQLite and Postgres dialects, so switching is a configuration change, not a rewrite.
2. **Target database:** Neon (serverless Postgres, generous free tier, branching) or Supabase (Postgres + auth + realtime, self-hostable). Both work with Cloudflare Hyperdrive.
3. **Cloudflare Hyperdrive** sits between Workers and the external Postgres instance, providing connection pooling and query caching at the edge. This eliminates the latency penalty of calling an external database from a Worker.
4. **Migration steps:**
   - Export D1 schema and data via `wrangler d1 export`
   - Convert SQLite schema to Postgres (Drizzle can generate both)
   - Import into Neon/Supabase
   - Update `wrangler.toml` to use Hyperdrive binding instead of D1 binding
   - Update Drizzle config from `sqlite` dialect to `postgres`
   - Test, deploy

**Estimated migration effort:** 1–2 days of developer time for the database swap, plus a testing cycle. No application logic changes required if Drizzle ORM is used consistently.

### 5.4 Backup Strategy

| Layer | Backup Method | Retention | Recovery |
|-------|--------------|-----------|----------|
| **D1 Database** | Time Travel (built-in) | 30 days, point-in-time to the minute | `wrangler d1 time-travel restore` to any point |
| **R2 Media** | Cross-bucket replication via scheduled Worker | Daily incremental to a secondary R2 bucket (Infrequent Access storage class) | Copy from backup bucket |
| **User Data Export** | On-demand user export feature (Settings page) | User-initiated | JSON + media zip download |
| **Catastrophic** | Weekly full D1 export to R2 (via Cron Trigger Worker) | 12 weeks rolling | Import SQL dump |

D1's Time Travel is a standout feature — it provides disaster recovery comparable to Heroku's continuous backup on Premium plans, but it's included by default. For media files, a scheduled Worker will perform incremental copies to a backup R2 bucket using the Infrequent Access storage class ($0.01/GB/mo vs. $0.015/GB/mo for standard).

---

## 6. Database Schema (D1 — Metadata Only)

The D1 database stores **text, references, and configuration only**. All binary media files (photos, audio, video) are stored in R2 and referenced by `r2_key` fields. This single-database architecture keeps things simple — all users share one D1 instance, isolated by `user_id` in every query.

```sql
-- Users table
CREATE TABLE users (
    id              TEXT PRIMARY KEY,          -- UUID
    google_id       TEXT UNIQUE NOT NULL,
    email           TEXT UNIQUE NOT NULL,
    display_name    TEXT,
    avatar_url      TEXT,
    phone_number    TEXT,                      -- For SMS, verified
    phone_verified  INTEGER DEFAULT 0,
    voice_style     TEXT DEFAULT 'natural',    -- AI voice preference
    voice_notes     TEXT,                      -- Free-form voice description
    timezone        TEXT DEFAULT 'America/New_York',
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

-- Journal entries
CREATE TABLE entries (
    id              TEXT PRIMARY KEY,          -- UUID
    user_id         TEXT NOT NULL REFERENCES users(id),
    raw_content     TEXT,                      -- Original text/transcription
    polished_content TEXT,                     -- AI-refined content
    entry_type      TEXT NOT NULL,             -- 'text', 'audio', 'video', 'photo'
    source          TEXT NOT NULL,             -- 'sms', 'web'
    mood            TEXT,                      -- Optional mood tag
    tags            TEXT,                      -- JSON array of tags
    location        TEXT,                      -- JSON {lat, lng, name}
    entry_date      TEXT NOT NULL,             -- User-facing date
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

-- Media attachments (photos, audio, video files)
CREATE TABLE media (
    id              TEXT PRIMARY KEY,
    entry_id        TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL REFERENCES users(id),
    r2_key          TEXT NOT NULL,             -- R2 object key
    media_type      TEXT NOT NULL,             -- 'image', 'audio', 'video'
    mime_type       TEXT,
    file_size       INTEGER,
    duration_seconds INTEGER,                  -- For audio/video
    transcription   TEXT,                      -- For audio/video STT output
    thumbnail_r2_key TEXT,                     -- Thumbnail for video/images
    created_at      TEXT DEFAULT (datetime('now'))
);

-- Reminder configuration
CREATE TABLE reminders (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id),
    reminder_type   TEXT NOT NULL,             -- 'daily', 'weekly', 'monthly', 'smart'
    time_of_day     TEXT,                      -- HH:MM in user's timezone
    day_of_week     INTEGER,                   -- 0-6 for weekly
    day_of_month    INTEGER,                   -- 1-28 for monthly
    smart_threshold INTEGER DEFAULT 2,         -- Days missed before nudge
    is_active       INTEGER DEFAULT 1,
    last_sent_at    TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
);

-- Audit / processing log
CREATE TABLE processing_log (
    id              TEXT PRIMARY KEY,
    entry_id        TEXT REFERENCES entries(id),
    action          TEXT NOT NULL,             -- 'transcribe', 'polish', 'sms_receive'
    status          TEXT NOT NULL,             -- 'pending', 'success', 'failed'
    details         TEXT,                      -- JSON error/metadata
    created_at      TEXT DEFAULT (datetime('now'))
);

-- Print subscriptions (Phase 2)
CREATE TABLE print_subscriptions (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id),
    frequency       TEXT NOT NULL,             -- 'monthly', 'quarterly', 'yearly'
    format          TEXT DEFAULT 'softcover',  -- 'softcover', 'hardcover'
    status          TEXT DEFAULT 'active',
    shipping_address TEXT,                     -- JSON address object
    next_print_date TEXT,
    last_printed_at TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX idx_entries_user_date ON entries(user_id, entry_date DESC);
CREATE INDEX idx_entries_user_created ON entries(user_id, created_at DESC);
CREATE INDEX idx_media_entry ON media(entry_id);
CREATE INDEX idx_reminders_user ON reminders(user_id);
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_google ON users(google_id);
```

> **ORM Note:** All queries will be written via **Drizzle ORM** (not raw SQL). Drizzle supports both SQLite and Postgres dialects with the same TypeScript query syntax, making a future database migration a config-level change rather than a rewrite. The schema above is shown as raw SQL for clarity, but in practice it will be defined as Drizzle schema objects in `src/db/schema.ts`.

---

## 7. Authentication

### 7.1 Google OAuth 2.0 Flow

```
User clicks "Sign in with Google"
        │
        ▼
Worker redirects to Google's OAuth consent screen
    (client_id, redirect_uri, scope: email + profile)
        │
        ▼
User authorizes → Google redirects to /auth/callback?code=XXX
        │
        ▼
Worker exchanges code for tokens via Google's token endpoint
        │
        ▼
Worker extracts user info (email, name, avatar) from ID token
        │
        ▼
Worker creates/updates user in D1, issues a session JWT
        │
        ▼
JWT stored in HttpOnly Secure cookie → user is logged in
```

### 7.2 Implementation Details

- **Google Client ID/Secret** stored as Worker Secrets via `wrangler secret put`
- **Session JWTs** signed with a Worker Secret, short-lived (1 hour) with refresh tokens stored in KV
- **CSRF protection** via state parameter in the OAuth flow
- The `worker-auth-providers` library or Cloudflare's own `workers-oauth-provider` package can be used to simplify the Google OAuth integration
- Phone number verification happens separately in Settings (user enters phone → receives a verification SMS via Twilio → confirms code)

---

## 8. Core Features

### 8.1 SMS/MMS Journaling (The Killer Feature)

#### Inbound Flow

```
User sends SMS/MMS to Twilio number
        │
        ▼
Twilio webhook POST → /api/webhooks/sms
        │
        ▼
Worker looks up user by phone number (must be verified)
        │
        ├─── Text only ──────────▶ Create entry, send to AI polish
        │
        ├─── Photo attached ─────▶ Store photo in R2, OCR if text detected,
        │                          create entry with attachment
        │
        ├─── Audio attached ─────▶ Store audio in R2, send to Deepgram for
        │                          transcription, create entry with transcript
        │                          + audio attachment
        │
        └─── Video attached ─────▶ Store video in R2, extract audio track,
                                   send to Deepgram, create entry with
                                   transcript + video attachment
        │
        ▼
AI Polish step (Anthropic Claude):
  - Input: raw text or transcription + user's voice preferences
  - Output: polished journal entry preserving user's words
        │
        ▼
Entry saved to D1, user receives confirmation SMS
```

#### Twilio Configuration

- **Phone number:** A dedicated US long-code number with MMS capability ($1.15/mo + per-message fees)
- **Inbound SMS:** ~$0.0079/message received
- **Inbound MMS:** ~$0.01/message received (includes media)
- **Outbound SMS** (confirmations, reminders): ~$0.0079/message
- **Webhook URL:** `https://journalizer.supercleans.workers.dev/api/webhooks/sms`
- Media files from MMS are hosted temporarily on Twilio's servers and downloaded by the Worker into R2 during processing

#### MMS and Rich Media

Standard MMS supports images (JPEG, PNG, GIF), audio (AMR, MP3, WAV), and video (MP4, 3GP). File size limits are carrier-dependent but typically 1–5 MB for MMS. For larger files, users would use the web interface. RCS (Rich Communication Services) is an emerging option that Twilio is rolling out support for, which would allow richer media and higher file sizes — this can be adopted as Twilio's RCS support matures.

### 8.2 AI Content Processing

#### Text Polish (Anthropic Claude)

```typescript
// Simplified example of the AI polish prompt
const systemPrompt = `You are a journal editor. Your job is to take a raw journal 
entry and lightly polish it for readability. Rules:
- Keep the author's voice, words, and personality intact
- Fix obvious typos, grammar, and punctuation
- Add paragraph breaks where natural
- Do NOT add content the author didn't write
- Do NOT change the meaning or tone
- The result should read like a natural journal entry, not a blog post
- Voice style preference: ${user.voiceStyle}
- Additional voice notes: ${user.voiceNotes}`;
```

The user's "voice style" setting (configured in Settings) can include options like:
- **Natural** — minimal edits, just fix typos
- **Conversational** — keep it casual, light cleanup
- **Reflective** — slightly more structured, add sentence flow
- **Polished** — more thorough editing while keeping their words

Users can also write free-form notes describing how they want their entries to sound (e.g., "I like short sentences. Don't make it flowery.").

#### Audio/Video Transcription (Deepgram)

- **Service:** Deepgram Nova-3 (batch/pre-recorded API)
- **Cost:** ~$0.0043/min for standard transcription
- **Features used:** Punctuation, paragraphs, speaker diarization (useful if user narrates with quotes)
- **Flow:** Worker downloads media from R2 → sends to Deepgram API → receives transcript → passes to Claude for polish → saves both raw transcript and polished version

#### Photo Processing

- Photos are stored directly in R2
- If the photo contains visible text (like a handwritten note, whiteboard, or screenshot), we can use Claude's vision capability to extract and transcribe the text
- The photo is always attached to the entry regardless of whether text is extracted

### 8.3 Web Dashboard

#### Dashboard View (Home)

The dashboard is the primary web experience after login. It presents journal entries in a clean, chronological timeline.

**Layout:**

```
┌─────────────────────────────────────────────────┐
│  🔖 Journalizer              [Search] [⚙ Settings] [👤] │
├─────────────────────────────────────────────────┤
│                                                   │
│  ◀ January 2026 ▶           [Month] [Week] [Day] │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  📅 Jan 31, 2026 — 8:42 PM         via SMS  │ │
│  │                                               │ │
│  │  Had the most incredible dinner at that new   │ │
│  │  Thai place downtown. The pad see ew was      │ │
│  │  perfect — crispy noodles, just the right     │ │
│  │  amount of heat. Sarah said she'd never had   │ │
│  │  better. We stayed until they closed talking  │ │
│  │  about the trip next month.                   │ │
│  │                                               │ │
│  │  📷 [photo thumbnail]                         │ │
│  │                                               │ │
│  │  [Edit] [View Original] [🔊 Audio]            │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  📅 Jan 30, 2026 — 6:15 AM         via Web  │ │
│  │                                               │ │
│  │  Morning reflection: Woke up feeling rested   │ │
│  │  for the first time in weeks...               │ │
│  │                                               │ │
│  │  [Edit] [View Original]                       │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│             [Load More Entries]                    │
│                                                   │
├─────────────────────────────────────────────────┤
│  📊 Streak: 12 days  |  📝 47 entries this month │
└─────────────────────────────────────────────────┘
```

**Key UI Features:**

- **Timeline view** with month/week/day toggles
- **Calendar sidebar** (on desktop) showing days with entries highlighted
- **Entry cards** showing polished content, source badge (SMS/Web), media thumbnails
- **"View Original"** toggle to see raw unedited text alongside the polished version
- **Inline media player** for audio and video attachments
- **Search** across all entries (full-text)
- **Streak counter** and monthly entry count for motivation

#### New Entry (Web)

A full-featured entry creation form:

```
┌─────────────────────────────────────────────────┐
│  New Journal Entry                    [Save] [×] │
├─────────────────────────────────────────────────┤
│                                                   │
│  📅 Date: [Feb 2, 2026      ▼]                   │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │                                               │ │
│  │  Write your entry here...                     │ │
│  │                                               │ │
│  │                                               │ │
│  │                                               │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  [📷 Photo] [🎤 Record Audio] [🎥 Record Video]  │
│  [📎 Attach File]                                 │
│                                                   │
│  ☐ Polish with AI before saving                   │
│                                                   │
│  Tags: [add tags...]                              │
│  Mood: 😊 😐 😢 😡 🤔                            │
│                                                   │
└─────────────────────────────────────────────────┘
```

- Text area with markdown support
- File upload for photos, audio, video
- In-browser audio recording (MediaRecorder API)
- Optional AI polish toggle (on by default, user can disable per entry)
- Mood and tag selectors

#### Settings Page

```
┌─────────────────────────────────────────────────┐
│  Settings                                         │
├─────────────────────────────────────────────────┤
│                                                   │
│  PROFILE                                          │
│  Display Name: [_______________]                  │
│  Email: user@gmail.com (from Google)              │
│  Timezone: [America/New_York ▼]                   │
│                                                   │
│  SMS JOURNALING                                   │
│  Phone Number: [+1 ___________] [Verify]          │
│  Status: ✅ Verified                              │
│                                                   │
│  AI VOICE PREFERENCES                             │
│  Style: [Natural ▼]                               │
│  Custom Instructions:                             │
│  ┌─────────────────────────────────────────────┐ │
│  │ Keep it casual. I like em dashes. Don't      │ │
│  │ remove my slang.                             │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  REMINDERS                                        │
│  ☑ Daily reminder at [8:00 PM ▼]                  │
│  ☐ Weekly reminder on [Sunday ▼]                  │
│  ☐ Monthly reminder on day [1 ▼]                  │
│  ☑ Smart nudge after [2 ▼] missed days            │
│                                                   │
│  DATA                                             │
│  [Export All Entries] [Export as PDF]              │
│                                                   │
│  PRINT SUBSCRIPTION (Coming Soon)                 │
│  Frequency: [Monthly ▼]                           │
│  Format: [Softcover ▼]                            │
│  Shipping Address: [_______________]              │
│                                                   │
└─────────────────────────────────────────────────┘
```

### 8.4 Journal Reminders

Reminders are powered by Cloudflare Workers Cron Triggers, which allow scheduled execution at defined intervals.

#### Implementation

A Cron Trigger Worker runs every 15 minutes and:

1. Queries D1 for all active reminders whose next fire time is within the current 15-minute window
2. For **daily/weekly/monthly** reminders: checks if the time matches (adjusted for user's timezone)
3. For **smart** reminders: queries the user's most recent entry date and compares against the configured threshold
4. Sends an SMS via Twilio with a friendly, varied prompt:
   - "Hey! What happened today? Just reply to this message to add a journal entry. 📓"
   - "Quick check-in: How's your day going? Reply with anything — a thought, a photo, whatever's on your mind."
   - "It's been 3 days since your last entry. No pressure, but we're here when you're ready. Just reply!"

#### Reminder Messages

Reminder messages will rotate through a set of pre-written prompts to avoid monotony. The prompts can also be seasonally or contextually aware (e.g., "Happy Friday! Anything good happen this week?").

---

## 9. Print-on-Demand Integration

### 9.1 Overview

The print feature allows users to receive beautifully formatted, physical copies of their journal. This is a unique differentiator in the market.

### 9.2 Recommended Provider: Lulu Print API

- **Type:** RESTful API, JSON-based, OpenID Connect authentication
- **Capabilities:** 3,000+ format combinations (size, paper, binding), global shipping to 150+ countries, single-copy print-on-demand, webhook order status updates
- **Pricing:** Per-book cost varies by format. A ~200-page, 6×9 softcover in black and white runs approximately $4–6 in print cost. Full color adds roughly $8–15 depending on page count.
- **No minimums, no inventory:** Each order is printed and shipped individually.

### 9.3 Print Flow

```
Cron Trigger fires on user's print date (monthly/quarterly/yearly)
        │
        ▼
Worker compiles entries for the period:
  - Queries D1 for all entries in date range
  - Downloads associated photos from R2
  - Generates a PDF using a journal template
    (cover page, table of contents, entries with dates,
     inline photos, embedded transcriptions)
        │
        ▼
Worker uploads PDF to Lulu via Print API
  - Specifies format (softcover/hardcover, 6×9, B&W or color)
  - Includes shipping address from user's settings
        │
        ▼
Lulu prints and ships the book
  - Webhook notifies our Worker of shipping status
  - Worker sends user an SMS/email notification
```

### 9.4 Journal Book Format Options

| Option | Description | Est. Cost |
|--------|-------------|-----------|
| **Monthly Softcover** | ~30-60 pages, 6×9, B&W text + color photos | $5–8 print + $4–6 shipping |
| **Quarterly Softcover** | ~100-180 pages, same format | $8–12 print + $4–6 shipping |
| **Yearly Hardcover** | ~300-500 pages, 6×9, premium hardcover, color | $20–35 print + $5–8 shipping |

At a $14.99–$29.99 subscription price per shipment, there's healthy margin even on the yearly hardcover option.

---

## 10. API Endpoints

### 10.1 Authentication

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/auth/google` | Initiates Google OAuth flow |
| `GET` | `/auth/callback` | Handles Google OAuth callback |
| `POST` | `/auth/logout` | Clears session |
| `GET` | `/auth/me` | Returns current user info |

### 10.2 Journal Entries

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/entries` | List entries (paginated, filterable by date) |
| `GET` | `/api/entries/:id` | Get single entry with media |
| `POST` | `/api/entries` | Create new entry (web) |
| `PUT` | `/api/entries/:id` | Update entry |
| `DELETE` | `/api/entries/:id` | Soft-delete entry |

### 10.3 Media

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/media/upload` | Upload media file to R2 |
| `GET` | `/api/media/:id` | Get media file (proxied from R2) |

### 10.4 Settings & Reminders

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/settings` | Get user settings |
| `PUT` | `/api/settings` | Update settings |
| `POST` | `/api/settings/verify-phone` | Initiate phone verification |
| `POST` | `/api/settings/confirm-phone` | Confirm verification code |
| `GET` | `/api/reminders` | Get reminder configuration |
| `PUT` | `/api/reminders` | Update reminders |

### 10.5 Webhooks

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/webhooks/twilio` | Inbound SMS/MMS from Twilio |
| `POST` | `/api/webhooks/lulu` | Print order status from Lulu |

### 10.6 Export

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/export/json` | Export all entries as JSON |
| `GET` | `/api/export/pdf` | Generate PDF of entries for date range |

---

## 11. Third-Party Service Costs (Estimated Monthly)

For a small user base (~100 active users, ~50 using SMS):

| Service | Usage Estimate | Monthly Cost |
|---------|---------------|-------------|
| **Cloudflare Workers** | Free tier covers well beyond 100 users | $0 (free tier) |
| **Cloudflare D1** | Light read/write | $0 (free tier: 5M reads, 100K writes/day) |
| **Cloudflare R2** | ~5-10 GB media storage | $0 (free tier: 10 GB) |
| **Cloudflare KV** | Sessions/cache | $0 (free tier: 100K reads/day) |
| **Twilio Phone Number** | 1 US long-code | ~$1.15/mo |
| **Twilio SMS (inbound + outbound)** | ~3,000 messages | ~$24/mo |
| **Twilio MMS (inbound)** | ~500 MMS | ~$5/mo |
| **Deepgram Transcription** | ~500 minutes audio | ~$2.15/mo |
| **Anthropic Claude API** | ~2,000 polish requests (Haiku for speed/cost) | ~$5–10/mo |
| **Total** | | **~$37–42/mo** |

This scales favorably. Cloudflare's infrastructure costs remain near-zero until significant traffic, and per-message/per-minute API costs scale linearly with usage.

---

## 12. Security Considerations

| Concern | Approach |
|---------|---------|
| **Authentication** | Google OAuth 2.0, HttpOnly Secure cookies, short-lived JWTs |
| **Data at Rest** | D1 and R2 encrypted by Cloudflare by default (AES-256) |
| **Data in Transit** | TLS everywhere (Workers enforce HTTPS) |
| **API Secrets** | Stored as Worker Secrets (encrypted, not in source code) |
| **Twilio Webhook Verification** | Validate `X-Twilio-Signature` header on every inbound webhook |
| **Phone Verification** | SMS-based verification code before SMS journaling is enabled |
| **Rate Limiting** | Workers KV-based rate limiting on API endpoints |
| **CORS** | Strict origin policies, SPA served from same domain |
| **User Data Isolation** | All queries filtered by `user_id`, no cross-user access |
| **Export/Delete** | Users can export all data or request account deletion (GDPR-ready) |

---

## 13. Development Phases

### Phase 1 — MVP (Free, Core Features)

**Timeline:** 8–10 weeks

1. **Week 1–2:** Repository setup, Cloudflare project scaffold, D1 schema, Google OAuth flow
2. **Week 3–4:** Web dashboard (entry list, create entry, basic settings), R2 media upload
3. **Week 5–6:** Twilio SMS/MMS integration (inbound webhook, phone verification, outbound confirmations)
4. **Week 7–8:** AI integration (Anthropic text polish, Deepgram audio transcription)
5. **Week 9–10:** Reminders (cron triggers, smart nudge logic), testing, polish, deploy

**Phase 1 Deliverables:**
- Working web app with Google login
- Full SMS/MMS journaling with AI polish
- Audio and video transcription
- Photo attachments with optional text extraction
- Configurable reminders (daily, weekly, monthly, smart)
- Dashboard with timeline view, search, entry management
- Voice/style preferences in settings
- Data export (JSON)

### Phase 2 — Monetization & Print

**Timeline:** 6–8 weeks after Phase 1

1. Stripe integration for subscriptions
2. Tiered access (Free/Personal/Premium)
3. Lulu Print API integration
4. PDF generation for print-ready journal layouts
5. Print subscription management (settings, address, frequency)
6. Enhanced analytics (mood trends, journaling frequency charts)

### Phase 3 — Growth & Polish

**Timeline:** Ongoing

1. Mobile-optimized PWA or native app wrapper
2. RCS support as Twilio rolls it out
3. WhatsApp as an alternative input channel
4. Shared/collaborative journals
5. AI-generated "year in review" summaries
6. End-to-end encryption option for privacy-focused users
7. Advanced search (by mood, media type, date range, tags)

---

## 14. Open Questions & Decisions Needed

1. **Custom domain?** Should `journalizer.com` (or similar) be acquired, or use a subdomain of `supercleans`?
2. **Frontend framework:** React is recommended, but Svelte or Solid could be considered if preference exists.
3. **Anthropic model choice:** Claude Haiku for speed/cost on polish tasks vs. Sonnet for higher quality — worth A/B testing.
4. **MMS file size limits:** Carrier MMS limits (1–5 MB) may frustrate users sending video. Should we provide a "send large file" web upload link via SMS?
5. **International SMS:** Phase 1 targets US numbers only. International expansion would require additional Twilio phone numbers and compliance considerations.
6. **Print template design:** Should we invest in a professional print template designer for the Lulu journal format, or start with a simple programmatic layout?
