export interface Env {
  DB: D1Database;
  AI: Ai;
  MEDIA: R2Bucket;
  KV: KVNamespace;
  ASSETS: Fetcher;
  ENVIRONMENT: string;
  ALLOWED_ORIGINS: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  ANTHROPIC_API_KEY: string;
  JWT_SECRET: string;
  ADMIN_EMAILS?: string;
  LULU_API_KEY?: string;
  LULU_API_SECRET?: string;
  LULU_SANDBOX?: string;
  STRIPE_SECRET_KEY?: string;
}

export interface AppVariables {
  userId: string;
  email: string;
}

export interface AppContext {
  Bindings: Env;
  Variables: AppVariables;
}
