export interface User {
  displayName: string;
  email: string;
  timezone: string;
  phoneNumber: string | null;
  phoneVerified: boolean;
  voiceStyle: string;
  voiceNotes: string | null;
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

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  timezone: string;
  phoneVerified: boolean;
  voiceStyle: string;
  createdAt: string;
}
