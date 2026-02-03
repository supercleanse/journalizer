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
  mimeType: string;
  r2Key: string;
  originalFilename: string | null;
  sizeBytes: number | null;
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
  isActive: number;
  lastSentAt: string | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}
