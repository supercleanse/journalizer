export interface User {
  displayName: string;
  email: string;
  timezone: string;
  telegramLinked: boolean;
  voiceStyle: string;
  voiceNotes: string | null;
  digestNotifyEmail: boolean;
}

export interface Entry {
  id: string;
  userId: string;
  rawContent: string | null;
  polishedContent: string | null;
  entryType: string;
  source: string;
  entryDate: string;
  createdAt: string;
  media?: MediaAttachment[];
}

export interface MediaAttachment {
  id: string;
  entryId: string;
  mediaType: string;
  mimeType: string | null;
  r2Key: string;
  fileSize: number | null;
  durationSeconds: number | null;
  transcription: string | null;
  thumbnailR2Key: string | null;
  createdAt: string;
}

export interface Reminder {
  id: string;
  userId: string;
  reminderType: "daily" | "weekly" | "monthly" | "smart";
  timeOfDay: string | null;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  smartThreshold: number | null;
  isActive: boolean;
  lastSentAt: string | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  entries: T[];
  total: number;
  offset: number;
  limit: number;
}

export interface PrintSubscription {
  id: string;
  userId: string;
  frequency: "weekly" | "monthly" | "quarterly" | "yearly";
  isActive: number;
  shippingName: string;
  shippingLine1: string;
  shippingLine2: string | null;
  shippingCity: string;
  shippingState: string;
  shippingZip: string;
  shippingCountry: string;
  colorOption: string;
  includeImages: number;
  nextPrintDate: string | null;
  lastPrintedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PrintOrder {
  id: string;
  userId: string;
  subscriptionId: string | null;
  luluJobId: string | null;
  status: string;
  frequency: string;
  periodStart: string;
  periodEnd: string;
  entryCount: number | null;
  pageCount: number | null;
  costCents: number | null;
  retailCents: number | null;
  trackingUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface EmailSubscription {
  id: string;
  userId: string;
  frequency: "weekly" | "monthly" | "quarterly" | "yearly";
  entryTypes: "daily" | "individual" | "both";
  isActive: number;
  includeImages: number;
  nextEmailDate: string | null;
  lastEmailedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DictionaryTerm {
  id: string;
  term: string;
  category: string;
  autoExtracted: number;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  timezone: string;
  telegramLinked: boolean;
  voiceStyle: string;
  role: "user" | "admin";
  createdAt: string;
}
