import { Hono } from "hono";
import type { AppContext } from "../types/env";
import { createDb } from "../db/index";
import { getUserById, listHabits, getHabitLogsForDateRange } from "../db/queries";
import {
  fetchEntriesForExport,
  generatePdfWithImages,
  generateExportZip,
} from "../services/export";
import type { HabitData } from "../services/export";
import { ValidationError } from "../lib/errors";

// Glass contract: failure modes
export { DatabaseError, ValidationError } from "../lib/errors";

const exportRoutes = new Hono<AppContext>();

/**
 * GET /api/export — export entries with options
 *
 * Query parameters:
 *   - startDate: YYYY-MM-DD (optional)
 *   - endDate: YYYY-MM-DD (optional)
 *   - entryTypes: daily | individual | both (default: both)
 *   - includeImages: true | false (default: true)
 *   - includeMultimedia: true | false (default: false, triggers ZIP)
 */
exportRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);

  // Parse query params
  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");
  const entryTypesParam = c.req.query("entryTypes") ?? "both";
  const includeImages = c.req.query("includeImages") !== "false";
  const includeMultimedia = c.req.query("includeMultimedia") === "true";

  // Validate entryTypes
  if (!["daily", "individual", "both"].includes(entryTypesParam)) {
    throw new ValidationError("entryTypes must be 'daily', 'individual', or 'both'");
  }
  const entryTypes = entryTypesParam as "daily" | "individual" | "both";

  // Validate date formats and semantic validity
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (startDate) {
    if (!dateRegex.test(startDate)) {
      throw new ValidationError("startDate must be YYYY-MM-DD");
    }
    if (isNaN(new Date(startDate).getTime())) {
      throw new ValidationError("startDate is not a valid date");
    }
  }
  if (endDate) {
    if (!dateRegex.test(endDate)) {
      throw new ValidationError("endDate must be YYYY-MM-DD");
    }
    if (isNaN(new Date(endDate).getTime())) {
      throw new ValidationError("endDate is not a valid date");
    }
  }
  if (startDate && endDate && startDate > endDate) {
    throw new ValidationError("startDate cannot be after endDate");
  }

  // Fetch user info for PDF title page
  const user = await getUserById(db, userId);
  const userName = user?.displayName || "My Journal";

  // Fetch entries with media
  const entries = await fetchEntriesForExport(db, c.env, {
    userId,
    startDate,
    endDate,
    entryTypes,
    includeImages,
    includeMultimedia,
  });

  if (entries.length === 0) {
    throw new ValidationError("No entries found for the specified criteria");
  }

  const today = new Date().toISOString().split("T")[0];
  const timezone = user?.timezone || "UTC";

  // Fetch habit data for the export period
  let habitData: HabitData | undefined;
  const habits = await listHabits(db, userId);
  if (habits.length > 0) {
    const entryDates = entries.map((e) => e.entryDate).sort();
    const rangeStart = startDate || entryDates[0];
    const rangeEnd = endDate || entryDates[entryDates.length - 1];
    const logs = await getHabitLogsForDateRange(db, userId, rangeStart, rangeEnd);

    const logsByDate: Record<string, Record<string, boolean>> = {};
    for (const log of logs) {
      if (!logsByDate[log.logDate]) logsByDate[log.logDate] = {};
      logsByDate[log.logDate][log.habitId] = log.completed === 1;
    }

    habitData = {
      habits: habits.map((h) => ({ id: h.id, name: h.name })),
      logsByDate,
    };
  }

  const pdfOptions = { userName, timezone, startDate, endDate, habitData };

  // Determine output format
  if (includeMultimedia) {
    const hasMultimedia = entries.some((e) =>
      e.media.some(
        (m) =>
          m.mimeType?.startsWith("audio/") || m.mimeType?.startsWith("video/")
      )
    );

    if (hasMultimedia) {
      const zip = await generateExportZip(entries, c.env, pdfOptions);
      return new Response(zip, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="journalizer-export-${today}.zip"`,
        },
      });
    }
  }

  // Default: PDF with images
  const pdf = generatePdfWithImages(entries, pdfOptions);
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="journalizer-export-${today}.pdf"`,
    },
  });
});

export default exportRoutes;
