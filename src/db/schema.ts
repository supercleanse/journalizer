import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Glass contract: failure modes (constraint violations from D1)
export { UniqueConstraintViolation, ForeignKeyViolation, NotNullViolation } from "../lib/errors";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    googleId: text("google_id").unique().notNull(),
    email: text("email").unique().notNull(),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    phoneNumber: text("phone_number"),
    phoneVerified: integer("phone_verified").default(0),
    telegramChatId: text("telegram_chat_id"),
    voiceStyle: text("voice_style").default("natural"),
    voiceNotes: text("voice_notes"),
    timezone: text("timezone").default("America/New_York"),
    role: text("role").notNull().default("user"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_users_phone").on(table.phoneNumber),
    index("idx_users_google").on(table.googleId),
  ]
);

export const entries = sqliteTable(
  "entries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rawContent: text("raw_content"),
    polishedContent: text("polished_content"),
    entryType: text("entry_type").notNull(),
    source: text("source").notNull(),
    mood: text("mood"),
    tags: text("tags"),
    location: text("location"),
    entryDate: text("entry_date").notNull(),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_entries_user_date").on(table.userId, table.entryDate),
    index("idx_entries_user_created").on(table.userId, table.createdAt),
  ]
);

export const media = sqliteTable(
  "media",
  {
    id: text("id").primaryKey(),
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    r2Key: text("r2_key").notNull(),
    mediaType: text("media_type").notNull(),
    mimeType: text("mime_type"),
    fileSize: integer("file_size"),
    durationSeconds: integer("duration_seconds"),
    transcription: text("transcription"),
    thumbnailR2Key: text("thumbnail_r2_key"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_media_entry").on(table.entryId),
    index("idx_media_user").on(table.userId),
  ]
);

export const reminders = sqliteTable(
  "reminders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reminderType: text("reminder_type").notNull(),
    timeOfDay: text("time_of_day"),
    dayOfWeek: integer("day_of_week"),
    dayOfMonth: integer("day_of_month"),
    smartThreshold: integer("smart_threshold").default(2),
    isActive: integer("is_active").default(1),
    lastSentAt: text("last_sent_at"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
  },
  (table) => [index("idx_reminders_user").on(table.userId)]
);

export const processingLog = sqliteTable(
  "processing_log",
  {
    id: text("id").primaryKey(),
    entryId: text("entry_id").references(() => entries.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    status: text("status").notNull(),
    details: text("details"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_processing_log_entry").on(table.entryId),
    index("idx_processing_log_status").on(table.status, table.createdAt),
  ]
);

export const printSubscriptions = sqliteTable("print_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  frequency: text("frequency").notNull(),
  format: text("format").default("softcover"),
  status: text("status").default("active"),
  shippingAddress: text("shipping_address"),
  nextPrintDate: text("next_print_date"),
  lastPrintedAt: text("last_printed_at"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});
