# Task ID: 1

**Title:** Initialize Cloudflare Workers project with TypeScript and Wrangler configuration

**Status:** pending

**Dependencies:** 23

**Priority:** high

**Description:** Set up the base Cloudflare Workers project structure using create-cloudflare CLI, configure wrangler.toml for D1, R2, KV bindings, and establish TypeScript configuration with strict mode.

**Details:**

Run `npm create cloudflare@latest` to scaffold the Workers project. Configure wrangler.toml with:
- D1 binding for database (name: journalizer_db)
- R2 binding for media storage (name: journalizer_media)
- KV binding for sessions/cache (name: journalizer_kv)
- Environment variables placeholders for GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, TWILIO_*, ANTHROPIC_API_KEY, DEEPGRAM_API_KEY

Set up tsconfig.json with strict mode, ESNext target, and proper module resolution. Create .env.example with all required keys. Initialize package.json with dependencies: @cloudflare/workers-types, drizzle-orm, hono (for routing), zod (for validation).

Project structure should match PRD section 2.3 with src/, glass/, tests/, dist/, glass-views/, annotations/ directories.

**Test Strategy:**

Verify wrangler.toml syntax with `wrangler deploy --dry-run`. Confirm TypeScript compiles with `tsc --noEmit`. Validate all directories exist and package.json has correct dependencies. Test that `wrangler dev` starts successfully.

## Subtasks

### 1.1. Scaffold Cloudflare Workers project using create-cloudflare CLI

**Status:** pending  
**Dependencies:** None  

Run the create-cloudflare CLI tool to generate the initial Cloudflare Workers project structure with TypeScript support.

**Details:**

Execute `npm create cloudflare@latest` in the /Users/supercleanse/Development/journalizer directory. Select options for: TypeScript template, Workers project type, and initialize git repository. This will generate the base project structure including package.json, tsconfig.json, wrangler.toml, and src/index.ts starter files. Accept default project name 'journalizer' or specify it during the CLI prompts.

### 1.2. Configure wrangler.toml with D1, R2, and KV bindings

**Status:** pending  
**Dependencies:** 1.1  

Set up all required Cloudflare service bindings in wrangler.toml for database, media storage, and key-value cache.

**Details:**

Edit wrangler.toml to add binding configurations: (1) D1 database binding with name 'journalizer_db' using [[d1_databases]] block, (2) R2 bucket binding with name 'journalizer_media' using [[r2_buckets]] block, (3) KV namespace binding with name 'journalizer_kv' using [[kv_namespaces]] block. Add [vars] section with placeholder environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, ANTHROPIC_API_KEY, DEEPGRAM_API_KEY. Set compatibility_date to current date and node_compat = true.

### 1.3. Configure TypeScript with strict mode and proper module resolution

**Status:** pending  
**Dependencies:** 1.1  

Update tsconfig.json with strict type checking, ESNext target, and module resolution settings appropriate for Cloudflare Workers.

**Details:**

Modify tsconfig.json to set: "strict": true, "target": "ESNext", "module": "ESNext", "moduleResolution": "bundler", "lib": ["ESNext"], "types": ["@cloudflare/workers-types"], "skipLibCheck": true, "resolveJsonModule": true, "allowSyntheticDefaultImports": true, "esModuleInterop": true, "isolatedModules": true, "noEmit": true. Set "include": ["src/**/*"] and "exclude": ["node_modules", "dist"].

### 1.4. Install required dependencies in package.json

**Status:** pending  
**Dependencies:** 1.1  

Add all necessary npm packages for the Workers project including framework, ORM, validation, and Cloudflare types.

**Details:**

Install production dependencies: `npm install hono drizzle-orm zod`. Install development dependencies: `npm install -D @cloudflare/workers-types typescript wrangler`. Verify package.json includes these packages with appropriate version ranges (use latest stable versions). Ensure scripts section includes: "dev": "wrangler dev", "deploy": "wrangler deploy", "typecheck": "tsc --noEmit", "lint": "eslint src".

### 1.5. Create project directory structure and environment template

**Status:** pending  
**Dependencies:** 1.1  

Set up the complete directory hierarchy as specified in PRD section 2.3 and create .env.example with all required API key placeholders.

**Details:**

Create directories: src/, glass/, tests/, dist/, glass-views/, annotations/. Within src/, create subdirectories: db/, routes/, services/, utils/, types/. Create .env.example file with placeholder entries for all environment variables: GOOGLE_CLIENT_ID=your_google_client_id_here, GOOGLE_CLIENT_SECRET=your_google_client_secret_here, TWILIO_ACCOUNT_SID=your_twilio_account_sid_here, TWILIO_AUTH_TOKEN=your_twilio_auth_token_here, TWILIO_PHONE_NUMBER=your_twilio_phone_number_here, ANTHROPIC_API_KEY=your_anthropic_api_key_here, DEEPGRAM_API_KEY=your_deepgram_api_key_here. Add .env to .gitignore if not already present.
