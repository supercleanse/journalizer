import { Hono } from "hono";
import type { AppContext } from "../types/env";
import { createDb } from "../db/index";
import { listEntries, getMediaCountsByEntries } from "../db/queries";

const exportRoutes = new Hono<AppContext>();

// GET /api/export/json — export all entries as JSON
exportRoutes.get("/json", async (c) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);

  // Fetch all entries (up to 1000)
  const { entries } = await listEntries(db, userId, {
    limit: 1000,
    offset: 0,
  });

  // Enrich with media counts in a single query
  const mediaCounts = await getMediaCountsByEntries(
    db,
    entries.map((e) => e.id)
  );
  const enriched = entries.map((entry) => ({
    id: entry.id,
    entryDate: entry.entryDate,
    entryType: entry.entryType,
    source: entry.source,
    rawContent: entry.rawContent,
    polishedContent: entry.polishedContent,
    createdAt: entry.createdAt,
    mediaCount: mediaCounts[entry.id] ?? 0,
  }));

  const exportData = {
    exportedAt: new Date().toISOString(),
    entryCount: enriched.length,
    entries: enriched,
  };

  return c.json(exportData, 200, {
    "Content-Disposition": `attachment; filename="journalizer-export-${new Date().toISOString().split("T")[0]}.json"`,
  });
});

// GET /api/export/pdf — generate a simple text-based PDF of entries
exportRoutes.get("/pdf", async (c) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);

  const { entries } = await listEntries(db, userId, {
    limit: 500,
    offset: 0,
  });

  // Build a minimal PDF manually (no external library needed for Workers)
  const lines: string[] = [];
  lines.push("My Journal - Journalizer Export");
  lines.push(`Exported: ${new Date().toISOString().split("T")[0]}`);
  lines.push(`Total entries: ${entries.length}`);
  lines.push("");

  for (const entry of entries) {
    lines.push(`--- ${entry.entryDate} (${entry.entryType}) ---`);
    const content = entry.polishedContent || entry.rawContent || "(no content)";
    lines.push(content);
    lines.push("");
  }

  const textContent = lines.join("\n");

  // Generate minimal valid PDF
  const pdfContent = generateMinimalPdf(textContent);

  return new Response(pdfContent, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="journalizer-export-${new Date().toISOString().split("T")[0]}.pdf"`,
    },
  });
});

/**
 * Generate a minimal valid PDF with text content.
 * This produces a basic but valid PDF without external dependencies.
 */
function generateMinimalPdf(text: string): Uint8Array {
  // Escape special PDF characters
  const escaped = text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

  // Wrap long lines
  const maxLineLen = 80;
  const wrappedLines: string[] = [];
  for (const line of escaped.split("\n")) {
    if (line.length <= maxLineLen) {
      wrappedLines.push(line);
    } else {
      for (let i = 0; i < line.length; i += maxLineLen) {
        wrappedLines.push(line.slice(i, i + maxLineLen));
      }
    }
  }

  // Build PDF text stream with line positioning
  const fontSize = 10;
  const leading = 14;
  const margin = 50;
  const pageHeight = 792;
  const pageWidth = 612;
  const usableHeight = pageHeight - 2 * margin;
  const linesPerPage = Math.floor(usableHeight / leading);

  const pages: string[][] = [];
  for (let i = 0; i < wrappedLines.length; i += linesPerPage) {
    pages.push(wrappedLines.slice(i, i + linesPerPage));
  }

  if (pages.length === 0) pages.push(["(empty)"]);

  // Build PDF objects
  const objects: string[] = [];
  let objNum = 1;

  // Object 1: Catalog
  const catalogObj = objNum++;
  objects.push(
    `${catalogObj} 0 obj\n<< /Type /Catalog /Pages ${catalogObj + 1} 0 R >>\nendobj`
  );

  // Object 2: Pages
  const pagesObj = objNum++;
  const pageObjNums: number[] = [];
  // Reserve object numbers for pages and their content streams
  for (let i = 0; i < pages.length; i++) {
    pageObjNums.push(objNum);
    objNum += 2; // page obj + stream obj
  }
  // Font object
  const fontObj = objNum++;

  const kidRefs = pageObjNums.map((n) => `${n} 0 R`).join(" ");
  objects.push(
    `${pagesObj} 0 obj\n<< /Type /Pages /Kids [${kidRefs}] /Count ${pages.length} >>\nendobj`
  );

  // Page + stream objects
  for (let i = 0; i < pages.length; i++) {
    const pageLines = pages[i];
    const pageObjNum = pageObjNums[i];
    const streamObjNum = pageObjNum + 1;

    let stream = `BT\n/F1 ${fontSize} Tf\n${leading} TL\n${margin} ${pageHeight - margin} Td\n`;
    for (const line of pageLines) {
      stream += `(${line}) Tj T*\n`;
    }
    stream += "ET";

    objects.push(
      `${pageObjNum} 0 obj\n<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${streamObjNum} 0 R /Resources << /Font << /F1 ${fontObj} 0 R >> >> >>\nendobj`
    );

    objects.push(
      `${streamObjNum} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`
    );
  }

  // Font object
  objects.push(
    `${fontObj} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj`
  );

  // Build final PDF
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj + "\n";
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objNum}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objNum} /Root ${catalogObj} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

export default exportRoutes;
