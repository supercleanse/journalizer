export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  KV: KVNamespace;
  ENVIRONMENT: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_PHONE_NUMBER: string;
  ANTHROPIC_API_KEY: string;
  DEEPGRAM_API_KEY: string;
  JWT_SECRET: string;
}

export interface AppVariables {
  userId: string;
  email: string;
}

export interface AppContext {
  Bindings: Env;
  Variables: AppVariables;
}
