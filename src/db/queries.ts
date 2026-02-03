import { eq, ne, desc, and, sql, like, or, lte, gte } from "drizzle-orm";
import type { Database } from "./index";
import {
  users,
  entries,
  media,
  reminders,
  processingLog,
  digestEntries,
} from "./schema";

// Glass contract: failure modes (soft failures return null)
export { RecordNotFound, DatabaseError } from "../lib/errors";

// ── Users ──────────────────────────────────────────────────────────

export async function getUserById(db: Database, id: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function getUserByGoogleId(db: Database, googleId: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.googleId, googleId))
    .limit(1);
  return result[0] ?? null;
}

export async function getUserByPhone(db: Database, phoneNumber: string) {
  const result = await db
    .select()
    .from(users)
    .where(
      and(eq(users.phoneNumber, phoneNumber), eq(users.phoneVerified, 1))
    )
    .limit(1);
  return result[0] ?? null;
}

export async function getUserByTelegramChatId(db: Database, chatId: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.telegramChatId, chatId))
    .limit(1);
  return result[0] ?? null;
}

export async function createUser(
  db: Database,
  data: {
    id: string;
    googleId: string;
    email: string;
    displayName?: string;
    avatarUrl?: string;
    role?: "user" | "admin";
  }
) {
  await db.insert(users).values(data);
  return getUserById(db, data.id);
}

export async function updateUser(
  db: Database,
  id: string,
  data: Partial<{
    displayName: string;
    avatarUrl: string;
    telegramChatId: string | null;
    voiceStyle: string;
    voiceNotes: string;
    timezone: string;
    role: "user" | "admin";
  }>
) {
  await db
    .update(users)
    .set({ ...data, updatedAt: sql`(datetime('now'))` })
    .where(eq(users.id, id));
  return getUserById(db, id);
}

// ── Entries ─────────────────────────────────────────────────────────

export interface ListEntriesOptions {
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
  entryType?: string;
  excludeType?: string;
  source?: string;
  search?: string;
}

export async function listEntries(
  db: Database,
  userId: string,
  options: ListEntriesOptions = {}
) {
  const { limit = 20, offset = 0, startDate, endDate, entryType, excludeType, source, search } = options;

  const conditions = [eq(entries.userId, userId)];

  if (startDate) conditions.push(gte(entries.entryDate, startDate));
  if (endDate) conditions.push(lte(entries.entryDate, endDate));
  if (entryType) conditions.push(eq(entries.entryType, entryType));
  if (excludeType) conditions.push(ne(entries.entryType, excludeType));
  if (source) conditions.push(eq(entries.source, source));
  if (search) {
    // Escape LIKE wildcards to prevent pattern injection
    const escaped = search.replace(/%/g, "\\%").replace(/_/g, "\\_");
    const pattern = `%${escaped}%`;
    conditions.push(
      or(
        like(entries.polishedContent, pattern),
        like(entries.rawContent, pattern)
      ) ?? sql`1=0`
    );
  }

  const where = and(...conditions);

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(entries)
      .where(where)
      .orderBy(desc(entries.entryDate))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(entries)
      .where(where),
  ]);

  return { entries: rows, total: countResult[0]?.count ?? 0 };
}

export async function getEntryById(db: Database, id: string, userId: string) {
  const result = await db
    .select()
    .from(entries)
    .where(and(eq(entries.id, id), eq(entries.userId, userId)))
    .limit(1);

  if (!result[0]) return null;

  const entryMedia = await db
    .select()
    .from(media)
    .where(eq(media.entryId, id));

  return { ...result[0], media: entryMedia };
}

export async function createEntry(
  db: Database,
  data: {
    id: string;
    userId: string;
    rawContent?: string;
    polishedContent?: string;
    entryType: string;
    source: string;
    mood?: string;
    tags?: string;
    location?: string;
    entryDate: string;
  }
) {
  await db.insert(entries).values(data);
  return getEntryById(db, data.id, data.userId);
}

export async function updateEntry(
  db: Database,
  id: string,
  userId: string,
  data: Partial<{
    rawContent: string;
    polishedContent: string;
    mood: string;
    tags: string;
    location: string;
    entryDate: string;
  }>
) {
  await db
    .update(entries)
    .set({ ...data, updatedAt: sql`(datetime('now'))` })
    .where(and(eq(entries.id, id), eq(entries.userId, userId)));
  return getEntryById(db, id, userId);
}

export async function deleteEntry(db: Database, id: string, userId: string) {
  const result = await db
    .delete(entries)
    .where(and(eq(entries.id, id), eq(entries.userId, userId)));
  return result.meta.changes > 0;
}

// ── Media ───────────────────────────────────────────────────────────

export async function createMedia(
  db: Database,
  data: {
    id: string;
    entryId: string;
    userId: string;
    r2Key: string;
    mediaType: string;
    mimeType?: string;
    fileSize?: number;
    durationSeconds?: number;
    transcription?: string;
    thumbnailR2Key?: string;
  }
) {
  await db.insert(media).values(data);
  const result = await db
    .select()
    .from(media)
    .where(eq(media.id, data.id))
    .limit(1);
  return result[0] ?? null;
}

export async function getMediaByEntry(db: Database, entryId: string) {
  return db.select().from(media).where(eq(media.entryId, entryId));
}

export async function getMediaByEntryIds(
  db: Database,
  entryIds: string[]
): Promise<Record<string, typeof media.$inferSelect[]>> {
  if (entryIds.length === 0) return {};
  const rows = await db
    .select()
    .from(media)
    .where(
      sql`${media.entryId} IN (${sql.join(
        entryIds.map((id) => sql`${id}`),
        sql`, `
      )})`
    );
  const result: Record<string, typeof media.$inferSelect[]> = {};
  for (const row of rows) {
    if (!result[row.entryId]) result[row.entryId] = [];
    result[row.entryId].push(row);
  }
  return result;
}

export async function getMediaCountsByEntries(
  db: Database,
  entryIds: string[]
): Promise<Record<string, number>> {
  if (entryIds.length === 0) return {};
  const rows = await db
    .select({
      entryId: media.entryId,
      count: sql<number>`count(*)`,
    })
    .from(media)
    .where(
      sql`${media.entryId} IN (${sql.join(
        entryIds.map((id) => sql`${id}`),
        sql`, `
      )})`
    )
    .groupBy(media.entryId);
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.entryId] = row.count;
  }
  return result;
}

export async function getMediaById(
  db: Database,
  id: string,
  userId: string
) {
  const result = await db
    .select()
    .from(media)
    .where(and(eq(media.id, id), eq(media.userId, userId)))
    .limit(1);
  return result[0] ?? null;
}

// ── Reminders ───────────────────────────────────────────────────────

export async function listReminders(db: Database, userId: string) {
  return db
    .select()
    .from(reminders)
    .where(eq(reminders.userId, userId));
}

export async function createReminder(
  db: Database,
  data: {
    id: string;
    userId: string;
    reminderType: string;
    timeOfDay?: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    smartThreshold?: number;
  }
) {
  await db.insert(reminders).values(data);
  const result = await db
    .select()
    .from(reminders)
    .where(eq(reminders.id, data.id))
    .limit(1);
  return result[0] ?? null;
}

export async function updateReminder(
  db: Database,
  id: string,
  userId: string,
  data: Partial<{
    reminderType: string;
    timeOfDay: string;
    dayOfWeek: number;
    dayOfMonth: number;
    smartThreshold: number;
    isActive: number;
    lastSentAt: string;
  }>
) {
  await db
    .update(reminders)
    .set(data)
    .where(and(eq(reminders.id, id), eq(reminders.userId, userId)));
  const result = await db
    .select()
    .from(reminders)
    .where(eq(reminders.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function deleteReminder(
  db: Database,
  id: string,
  userId: string
) {
  const result = await db
    .delete(reminders)
    .where(and(eq(reminders.id, id), eq(reminders.userId, userId)));
  return result.meta.changes > 0;
}

export async function getAllActiveReminders(db: Database) {
  return db
    .select()
    .from(reminders)
    .where(eq(reminders.isActive, 1));
}

export async function getUsersByIds(db: Database, ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(users)
    .where(
      sql`${users.id} IN (${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `
      )})`
    );
}

export async function getEntryDates(db: Database, userId: string) {
  const rows = await db
    .select({ entryDate: entries.entryDate })
    .from(entries)
    .where(eq(entries.userId, userId))
    .orderBy(desc(entries.entryDate));
  return rows.map((r) => r.entryDate);
}

export async function getLastEntryDate(db: Database, userId: string) {
  const result = await db
    .select({ entryDate: entries.entryDate })
    .from(entries)
    .where(eq(entries.userId, userId))
    .orderBy(desc(entries.entryDate))
    .limit(1);
  return result[0]?.entryDate ?? null;
}

export async function getLastEntryDatesByUserIds(
  db: Database,
  userIds: string[]
): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};
  const rows = await db
    .select({
      userId: entries.userId,
      entryDate: sql<string>`MAX(${entries.entryDate})`,
    })
    .from(entries)
    .where(
      sql`${entries.userId} IN (${sql.join(
        userIds.map((id) => sql`${id}`),
        sql`, `
      )})`
    )
    .groupBy(entries.userId);
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.userId] = row.entryDate;
  }
  return result;
}

export async function updateReminderLastSent(
  db: Database,
  id: string,
  timestamp: string
) {
  await db
    .update(reminders)
    .set({ lastSentAt: timestamp })
    .where(eq(reminders.id, id));
}

// ── Digests ─────────────────────────────────────────────────────────

export async function getAllUsers(db: Database) {
  return db.select().from(users);
}

export async function updateUserLastDigestDate(
  db: Database,
  userId: string,
  date: string
) {
  await db
    .update(users)
    .set({ lastDigestDate: date, updatedAt: sql`(datetime('now'))` })
    .where(eq(users.id, userId));
}

export async function getEntriesForDate(db: Database, userId: string, date: string) {
  const rows = await db
    .select()
    .from(entries)
    .where(
      and(
        eq(entries.userId, userId),
        eq(entries.entryDate, date),
        ne(entries.entryType, "digest")
      )
    )
    .orderBy(entries.createdAt);

  if (rows.length === 0) return [];

  const entryIds = rows.map((r) => r.id);
  const mediaRows = await db
    .select()
    .from(media)
    .where(
      sql`${media.entryId} IN (${sql.join(
        entryIds.map((id) => sql`${id}`),
        sql`, `
      )})`
    );

  const mediaByEntry: Record<string, typeof media.$inferSelect[]> = {};
  for (const row of mediaRows) {
    if (!mediaByEntry[row.entryId]) mediaByEntry[row.entryId] = [];
    mediaByEntry[row.entryId].push(row);
  }

  return rows.map((r) => ({ ...r, media: mediaByEntry[r.id] ?? [] }));
}

export async function createDigest(
  db: Database,
  data: {
    id: string;
    userId: string;
    rawContent?: string;
    polishedContent: string;
    entryDate: string;
    sourceEntryIds: string[];
  }
) {
  await db.insert(entries).values({
    id: data.id,
    userId: data.userId,
    rawContent: data.rawContent,
    polishedContent: data.polishedContent,
    entryType: "digest",
    source: "system",
    entryDate: data.entryDate,
  });

  for (const sourceId of data.sourceEntryIds) {
    await db.insert(digestEntries).values({
      id: crypto.randomUUID(),
      digestId: data.id,
      sourceEntryId: sourceId,
    });
  }

  return getEntryById(db, data.id, data.userId);
}

export async function getDigestSourceEntryIds(
  db: Database,
  digestId: string
): Promise<string[]> {
  const rows = await db
    .select({ sourceEntryId: digestEntries.sourceEntryId })
    .from(digestEntries)
    .where(eq(digestEntries.digestId, digestId));
  return rows.map((r) => r.sourceEntryId);
}

export async function getDigestSourceEntries(
  db: Database,
  digestId: string,
  userId: string
) {
  const sourceIds = await getDigestSourceEntryIds(db, digestId);
  if (sourceIds.length === 0) return [];

  const rows = await db
    .select()
    .from(entries)
    .where(
      and(
        eq(entries.userId, userId),
        sql`${entries.id} IN (${sql.join(
          sourceIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      )
    )
    .orderBy(entries.createdAt);

  const mediaRows = await db
    .select()
    .from(media)
    .where(
      sql`${media.entryId} IN (${sql.join(
        sourceIds.map((id) => sql`${id}`),
        sql`, `
      )})`
    );

  const mediaByEntry: Record<string, typeof media.$inferSelect[]> = {};
  for (const row of mediaRows) {
    if (!mediaByEntry[row.entryId]) mediaByEntry[row.entryId] = [];
    mediaByEntry[row.entryId].push(row);
  }

  return rows.map((r) => ({ ...r, media: mediaByEntry[r.id] ?? [] }));
}

export async function getDigestMediaForEntries(
  db: Database,
  digestIds: string[]
): Promise<Record<string, typeof media.$inferSelect[]>> {
  if (digestIds.length === 0) return {};

  // Get all source entry IDs for all digests
  const joinRows = await db
    .select()
    .from(digestEntries)
    .where(
      sql`${digestEntries.digestId} IN (${sql.join(
        digestIds.map((id) => sql`${id}`),
        sql`, `
      )})`
    );

  if (joinRows.length === 0) return {};

  const sourceIds = joinRows.map((r) => r.sourceEntryId);
  const mediaRows = await db
    .select()
    .from(media)
    .where(
      sql`${media.entryId} IN (${sql.join(
        sourceIds.map((id) => sql`${id}`),
        sql`, `
      )})`
    );

  // Map: digestId -> media[]
  const sourceToDigest: Record<string, string> = {};
  for (const row of joinRows) {
    sourceToDigest[row.sourceEntryId] = row.digestId;
  }

  const result: Record<string, typeof media.$inferSelect[]> = {};
  for (const row of mediaRows) {
    const digestId = sourceToDigest[row.entryId];
    if (digestId) {
      if (!result[digestId]) result[digestId] = [];
      result[digestId].push(row);
    }
  }
  return result;
}

// ── Processing Log ──────────────────────────────────────────────────

export async function logProcessing(
  db: Database,
  data: {
    id: string;
    entryId?: string;
    action: string;
    status: string;
    details?: string;
  }
) {
  await db.insert(processingLog).values(data);
}
