import { Hono } from "hono";
import type { AppContext } from "../types/env";
import { createDb } from "../db/index";
import {
  fetchEntriesForExport,
  generatePdfWithImages,
  generateExportZip,
} from "../services/export";
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

  // Validate date formats
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (startDate && !dateRegex.test(startDate)) {
    throw new ValidationError("startDate must be YYYY-MM-DD");
  }
  if (endDate && !dateRegex.test(endDate)) {
    throw new ValidationError("endDate must be YYYY-MM-DD");
  }

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

  // Determine output format
  if (includeMultimedia) {
    // Check if there's actually any multimedia
    const hasMultimedia = entries.some((e) =>
      e.media.some(
        (m) =>
          m.mimeType?.startsWith("audio/") || m.mimeType?.startsWith("video/")
      )
    );

    if (hasMultimedia) {
      const zip = await generateExportZip(entries, c.env);
      return new Response(zip, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="journalizer-export-${today}.zip"`,
        },
      });
    }
  }

  // Default: PDF with images
  const pdf = generatePdfWithImages(entries);
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="journalizer-export-${today}.pdf"`,
    },
  });
});

export default exportRoutes;
