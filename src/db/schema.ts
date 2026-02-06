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
    lastDigestDate: text("last_digest_date"),
    stripeCustomerId: text("stripe_customer_id"),
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

export const digestEntries = sqliteTable(
  "digest_entries",
  {
    id: text("id").primaryKey(),
    digestId: text("digest_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    sourceEntryId: text("source_entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_digest_entries_digest").on(table.digestId),
    index("idx_digest_entries_source").on(table.sourceEntryId),
  ]
);

export const personalDictionary = sqliteTable(
  "personal_dictionary",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    term: text("term").notNull(),
    category: text("category").default("other"), // person, place, brand, pet, other
    autoExtracted: integer("auto_extracted").default(0),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_dict_user").on(table.userId),
  ]
);

export const emailSubscriptions = sqliteTable(
  "email_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    frequency: text("frequency").notNull(), // weekly | monthly | quarterly | yearly
    entryTypes: text("entry_types").default("both"), // daily | individual | both
    isActive: integer("is_active").default(1),
    includeImages: integer("include_images").default(1),
    nextEmailDate: text("next_email_date"),
    lastEmailedAt: text("last_emailed_at"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_email_subs_user").on(table.userId),
  ]
);

export const printSubscriptions = sqliteTable(
  "print_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    frequency: text("frequency").notNull(), // weekly | monthly | quarterly | yearly
    isActive: integer("is_active").default(1),
    shippingName: text("shipping_name").notNull(),
    shippingLine1: text("shipping_line1").notNull(),
    shippingLine2: text("shipping_line2"),
    shippingCity: text("shipping_city").notNull(),
    shippingState: text("shipping_state").notNull(),
    shippingZip: text("shipping_zip").notNull(),
    shippingCountry: text("shipping_country").notNull().default("US"),
    colorOption: text("color_option").default("bw"), // bw | color
    includeImages: integer("include_images").default(1),
    nextPrintDate: text("next_print_date"),
    lastPrintedAt: text("last_printed_at"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_print_subs_user").on(table.userId),
  ]
);

export const printOrders = sqliteTable(
  "print_orders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subscriptionId: text("subscription_id").references(
      () => printSubscriptions.id,
      { onDelete: "set null" }
    ),
    luluJobId: text("lulu_job_id"),
    status: text("status").notNull().default("pending"), // pending | generating | uploaded | in_production | shipped | delivered | failed | payment_failed
    frequency: text("frequency").notNull(),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    entryCount: integer("entry_count"),
    pageCount: integer("page_count"),
    costCents: integer("cost_cents"),
    retailCents: integer("retail_cents"),
    trackingUrl: text("tracking_url"),
    errorMessage: text("error_message"),
    stripePaymentId: text("stripe_payment_id"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_print_orders_user").on(table.userId),
    index("idx_print_orders_sub").on(table.subscriptionId),
    index("idx_print_orders_status").on(table.status),
  ]
);
