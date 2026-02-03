export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  KV: KVNamespace;
  ENVIRONMENT: string;
  ALLOWED_ORIGINS: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  ANTHROPIC_API_KEY: string;
  JWT_SECRET: string;
  ADMIN_EMAILS?: string;
}

export interface AppVariables {
  userId: string;
  email: string;
}

export interface AppContext {
  Bindings: Env;
  Variables: AppVariables;
}
