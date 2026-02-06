import { zipSync } from "fflate";
import type { Database } from "../db/index";
import type { Env } from "../types/env";
import { listEntries, getMediaByEntryIds } from "../db/queries";

// Glass contract: failure modes
export { DatabaseError, ValidationError } from "../lib/errors";

export interface ExportOptions {
  userId: string;
  startDate?: string;
  endDate?: string;
  entryTypes: "daily" | "individual" | "both";
  includeImages: boolean;
  includeMultimedia: boolean;
}

export interface PdfOptions {
  userName: string;
  timezone: string;
  startDate?: string;
  endDate?: string;
}

// Memory limits for Cloudflare Workers (128MB)
const MAX_ENTRIES = 500;
const MAX_IMAGES = 50;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB per image
const MAX_MULTIMEDIA_FILES = 20;

export interface MediaRecord {
  id: string;
  entryId: string;
  r2Key: string;
  mediaType: string;
  mimeType: string | null;
  fileSize: number | null;
}

export interface ExportEntry {
  id: string;
  entryDate: string;
  entryType: string;
  source: string;
  rawContent: string | null;
  polishedContent: string | null;
  createdAt: string | null;
  media: MediaRecord[];
  imageData: Map<string, Uint8Array>; // mediaId -> image bytes
}

/**
 * Fetch entries for export with their media records and image data.
 */
export async function fetchEntriesForExport(
  db: Database,
  env: Env,
  options: ExportOptions
): Promise<ExportEntry[]> {
  const { userId, startDate, endDate, entryTypes, includeImages } = options;

  // Build entry type filter
  let entryTypeFilter: string | undefined;
  let excludeTypeFilter: string | undefined;
  if (entryTypes === "daily") {
    entryTypeFilter = "digest";
  } else if (entryTypes === "individual") {
    excludeTypeFilter = "digest";
  }

  // Fetch entries
  const { entries } = await listEntries(db, userId, {
    limit: 500,
    offset: 0,
    startDate,
    endDate,
    entryType: entryTypeFilter,
    excludeType: excludeTypeFilter,
  });

  if (entries.length === 0) {
    return [];
  }

  // Sort chronologically (oldest first) for export
  entries.reverse();

  // Fetch media for all entries
  const entryIds = entries.map((e) => e.id);
  const mediaByEntry = await getMediaByEntryIds(db, entryIds);

  // Build export entries with image data
  const exportEntries: ExportEntry[] = [];
  let totalImagesLoaded = 0;

  for (const entry of entries) {
    const media = (mediaByEntry[entry.id] ?? []) as MediaRecord[];
    const imageData = new Map<string, Uint8Array>();

    // Fetch image data if requested (with limits for memory safety)
    if (includeImages && totalImagesLoaded < MAX_IMAGES) {
      const imageMedia = media.filter(
        (m) => m.mimeType?.startsWith("image/jpeg") // Only JPEG supported in PDF
      );

      // Fetch images in batches of 5 to avoid memory issues
      for (let i = 0; i < imageMedia.length && totalImagesLoaded < MAX_IMAGES; i += 5) {
        const batch = imageMedia.slice(i, Math.min(i + 5, MAX_IMAGES - totalImagesLoaded + i));
        await Promise.all(
          batch.map(async (m) => {
            try {
              // Check file size before loading
              const obj = await env.MEDIA.get(m.r2Key);
              if (obj && obj.size <= MAX_IMAGE_SIZE) {
                const buffer = await obj.arrayBuffer();
                imageData.set(m.id, new Uint8Array(buffer));
                totalImagesLoaded++;
              }
            } catch {
              // Skip failed image fetches - user can re-export if needed
            }
          })
        );
      }
    }

    exportEntries.push({
      id: entry.id,
      entryDate: entry.entryDate,
      entryType: entry.entryType,
      source: entry.source,
      rawContent: entry.rawContent,
      polishedContent: entry.polishedContent,
      createdAt: entry.createdAt,
      media,
      imageData,
    });
  }

  return exportEntries;
}

// ── PDF text helpers ──

/** Strip emojis and non-ASCII characters, replace smart quotes/dashes with ASCII equivalents */
function sanitizeForPdf(text: string): string {
  return text
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7E\n\t]/g, "");
}

/** Escape PDF string special characters */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

/** Sanitize then escape text for PDF strings */
function prepareText(text: string): string {
  return escapeText(sanitizeForPdf(text));
}

/** Wrap text at word boundaries */
function wrapText(text: string, maxLen: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph.length <= maxLen) {
      lines.push(paragraph);
    } else {
      const words = paragraph.split(" ");
      let current = "";
      for (const word of words) {
        if (current.length === 0) {
          current = word;
        } else if (current.length + 1 + word.length <= maxLen) {
          current += " " + word;
        } else {
          lines.push(current);
          current = word;
        }
      }
      if (current.length > 0) {
        lines.push(current);
      }
    }
  }
  return lines;
}

/** Estimate string width in points for Helvetica at given font size */
function estimateWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.52;
}

/** Format YYYY-MM-DD as "January 15, 2026" */
function formatDate(dateStr: string): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const [year, month, day] = dateStr.split("-");
  const m = parseInt(month, 10) - 1;
  const d = parseInt(day, 10);
  return `${months[m]} ${d}, ${year}`;
}

/** Format ISO datetime as "January 15, 2026 at 3:45 PM" in the given timezone */
function formatDateTime(isoStr: string, timezone: string): string {
  const date = new Date(isoStr);
  if (isNaN(date.getTime())) return isoStr;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return `${get("month")} ${get("day")}, ${get("year")} at ${get("hour")}:${get("minute")} ${get("dayPeriod")}`;
  } catch {
    // Fallback to UTC if timezone is invalid
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const month = months[date.getUTCMonth()];
    const day = date.getUTCDate();
    const year = date.getUTCFullYear();
    let hours = date.getUTCHours();
    const minutes = date.getUTCMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${month} ${day}, ${year} at ${hours}:${minutes} ${ampm}`;
  }
}

/** Capitalize source for display */
function formatSource(source: string): string {
  const map: Record<string, string> = {
    web: "Web",
    telegram: "Telegram",
    sms: "SMS",
    system: "System",
  };
  return map[source] || source;
}

// ── PDF generation ──

interface PageContent {
  textCommands: string[];
  images: Array<{
    id: string;
    data: Uint8Array;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  footer?: string;
}

/**
 * Generate a PDF with title page, text, inline images, and page numbers.
 */
export function generatePdfWithImages(entries: ExportEntry[], options: PdfOptions): Uint8Array {
  const fontSize = 10;
  const leading = 15; // ~1.5x line spacing
  const margin = 50;
  const pageHeight = 792;
  const pageWidth = 612;
  const usableWidth = pageWidth - 2 * margin;
  const maxLineLen = 95;

  // ── Title page ──
  const titlePage: PageContent = { textCommands: [], images: [] };
  const centerY = pageHeight / 2 + 40; // slightly above true center

  // User's name (18pt bold)
  const nameText = prepareText(options.userName || "My Journal");
  const nameX = (pageWidth - estimateWidth(nameText, 18)) / 2;
  titlePage.textCommands.push(`/F2 18 Tf`);
  titlePage.textCommands.push(`1 0 0 1 ${Math.max(margin, nameX)} ${centerY} Tm (${nameText}) Tj`);

  // "Journal Export" (14pt)
  const subtitleText = "Journal Export";
  const subtitleX = (pageWidth - estimateWidth(subtitleText, 14)) / 2;
  titlePage.textCommands.push(`/F1 14 Tf`);
  titlePage.textCommands.push(`1 0 0 1 ${Math.max(margin, subtitleX)} ${centerY - 30} Tm (${subtitleText}) Tj`);

  // Date range (12pt)
  let rangeText: string;
  if (options.startDate && options.endDate) {
    rangeText = `${formatDate(options.startDate)} - ${formatDate(options.endDate)}`;
  } else if (options.startDate) {
    rangeText = `From ${formatDate(options.startDate)}`;
  } else if (options.endDate) {
    rangeText = `Through ${formatDate(options.endDate)}`;
  } else {
    rangeText = "All Entries";
  }
  rangeText = prepareText(rangeText);
  const rangeX = (pageWidth - estimateWidth(rangeText, 12)) / 2;
  titlePage.textCommands.push(`/F1 12 Tf`);
  titlePage.textCommands.push(`1 0 0 1 ${Math.max(margin, rangeX)} ${centerY - 55} Tm (${rangeText}) Tj`);

  // Export date and entry count (10pt)
  const exportDateText = prepareText(`Exported ${formatDate(new Date().toISOString().split("T")[0])} - ${entries.length} entries`);
  const exportDateX = (pageWidth - estimateWidth(exportDateText, 10)) / 2;
  titlePage.textCommands.push(`/F1 10 Tf`);
  titlePage.textCommands.push(`1 0 0 1 ${Math.max(margin, exportDateX)} ${centerY - 80} Tm (${exportDateText}) Tj`);

  // ── Content pages ──
  interface ContentBlock {
    type: "text" | "heading" | "image";
    lines?: string[];
    imageId?: string;
    imageData?: Uint8Array;
    mimeType?: string;
    width?: number;
    height?: number;
  }

  const contentBlocks: ContentBlock[] = [];

  for (const entry of entries) {
    const content = entry.polishedContent || entry.rawContent || "";
    const hasContent = content.trim().length > 0;
    const hasImages = entry.imageData.size > 0;

    // Skip entries with no content and no images
    if (!hasContent && !hasImages) continue;

    // Entry header with date, time, and source (bold, larger font)
    let headerText: string;
    if (entry.entryType === "digest") {
      headerText = `${formatDate(entry.entryDate)} (Daily Entry)`;
    } else {
      const dateTime = entry.createdAt
        ? formatDateTime(entry.createdAt, options.timezone)
        : formatDate(entry.entryDate);
      const source = formatSource(entry.source);
      headerText = `${dateTime} (via ${source})`;
    }
    contentBlocks.push({
      type: "heading",
      lines: [prepareText(headerText)],
    });

    // Entry content (only if non-empty)
    if (hasContent) {
      const sanitized = sanitizeForPdf(content);
      const escaped = escapeText(sanitized);
      const wrappedLines = wrapText(escaped, maxLineLen);
      contentBlocks.push({ type: "text", lines: wrappedLines });
    }

    // Images (inline after text)
    for (const [mediaId, imageBytes] of entry.imageData) {
      const mediaRecord = entry.media.find((m) => m.id === mediaId);
      if (mediaRecord && mediaRecord.mimeType?.startsWith("image/jpeg")) {
        const dims = getJpegDimensions(imageBytes);
        if (dims) {
          let { width, height } = dims;
          if (width > usableWidth) {
            height = (height * usableWidth) / width;
            width = usableWidth;
          }
          if (height > 300) {
            width = (width * 300) / height;
            height = 300;
          }
          contentBlocks.push({
            type: "image",
            imageId: mediaId,
            imageData: imageBytes,
            mimeType: mediaRecord.mimeType,
            width,
            height,
          });
        }
      }
    }

    // Spacing after entry
    contentBlocks.push({ type: "text", lines: [""] });
  }

  // Build content pages from blocks
  const contentPages: PageContent[] = [];
  let currentPage: PageContent = { textCommands: [], images: [] };
  // Reset font to body size at start of each page
  currentPage.textCommands.push(`/F1 ${fontSize} Tf`);
  let yPos = pageHeight - margin;

  const headingSize = 12;
  const headingLeading = 18;

  for (const block of contentBlocks) {
    if (block.type === "heading" && block.lines) {
      for (const line of block.lines) {
        if (yPos - headingLeading < margin + 20) {
          contentPages.push(currentPage);
          currentPage = { textCommands: [], images: [] };
          currentPage.textCommands.push(`/F1 ${fontSize} Tf`);
          yPos = pageHeight - margin;
        }
        currentPage.textCommands.push(`/F2 ${headingSize} Tf`);
        currentPage.textCommands.push(`1 0 0 1 ${margin} ${yPos} Tm (${line}) Tj`);
        currentPage.textCommands.push(`/F1 ${fontSize} Tf`);
        yPos -= headingLeading;
      }
    } else if (block.type === "text" && block.lines) {
      for (const line of block.lines) {
        if (yPos - leading < margin + 20) { // +20 to leave room for footer
          contentPages.push(currentPage);
          currentPage = { textCommands: [], images: [] };
          currentPage.textCommands.push(`/F1 ${fontSize} Tf`);
          yPos = pageHeight - margin;
        }
        currentPage.textCommands.push(`1 0 0 1 ${margin} ${yPos} Tm (${line}) Tj`);
        yPos -= leading;
      }
    } else if (block.type === "image" && block.imageData && block.width && block.height) {
      if (yPos - block.height < margin + 20) {
        contentPages.push(currentPage);
        currentPage = { textCommands: [], images: [] };
        currentPage.textCommands.push(`/F1 ${fontSize} Tf`);
        yPos = pageHeight - margin;
      }

      const imgY = yPos - block.height;
      currentPage.images.push({
        id: block.imageId!,
        data: block.imageData,
        x: margin,
        y: imgY,
        width: block.width,
        height: block.height,
      });
      yPos = imgY - leading;
    }
  }

  if (currentPage.textCommands.length > 1 || currentPage.images.length > 0) {
    contentPages.push(currentPage);
  }

  // Add page number footers to content pages
  const userName = sanitizeForPdf(options.userName || "");
  for (let i = 0; i < contentPages.length; i++) {
    const footerText = userName
      ? `${escapeText(userName)} - Page ${i + 1}`
      : `Page ${i + 1}`;
    contentPages[i].footer = footerText;
  }

  // Combine: title page + content pages
  const allPages = [titlePage, ...contentPages];

  if (allPages.length === 1) {
    // Only title page, no content
    allPages.push({
      textCommands: [`/F1 ${fontSize} Tf`, `1 0 0 1 ${margin} ${pageHeight - margin} Tm (No entries found) Tj`],
      images: [],
      footer: userName ? `${escapeText(userName)} - Page 1` : "Page 1",
    });
  }

  return buildPdfWithImages(allPages, pageWidth, pageHeight, fontSize, leading);
}

function getJpegDimensions(data: Uint8Array): { width: number; height: number } | null {
  let i = 0;
  if (data[0] !== 0xff || data[1] !== 0xd8) return null;

  i = 2;
  while (i < data.length - 8) {
    if (data[i] !== 0xff) {
      i++;
      continue;
    }

    const marker = data[i + 1];
    if (marker >= 0xc0 && marker <= 0xc2) {
      const height = (data[i + 5] << 8) | data[i + 6];
      const width = (data[i + 7] << 8) | data[i + 8];
      return { width, height };
    }

    const len = (data[i + 2] << 8) | data[i + 3];
    i += 2 + len;
  }

  return null;
}

function buildPdfWithImages(
  pages: PageContent[],
  pageWidth: number,
  pageHeight: number,
  fontSize: number,
  leading: number
): Uint8Array {
  const objects: string[] = [];
  const binaryObjects: Array<{ objNum: number; header: string; data: Uint8Array }> = [];
  let objNum = 1;

  const imageMap = new Map<string, { data: Uint8Array; objNum: number }>();

  // Object 1: Catalog
  const catalogObj = objNum++;
  objects.push(`${catalogObj} 0 obj\n<< /Type /Catalog /Pages ${catalogObj + 1} 0 R >>\nendobj`);

  // Object 2: Pages (placeholder)
  const pagesObj = objNum++;
  const pagesObjIndex = objects.length;
  objects.push("");

  // Reserve object numbers for pages and streams
  const pageObjNums: number[] = [];
  for (let i = 0; i < pages.length; i++) {
    pageObjNums.push(objNum);
    objNum += 2; // page + stream
  }

  // Font objects: F1 = Helvetica, F2 = Helvetica-Bold
  const fontObj1 = objNum++;
  const fontObj2 = objNum++;

  // Reserve image object numbers
  for (const page of pages) {
    for (const img of page.images) {
      if (!imageMap.has(img.id)) {
        imageMap.set(img.id, { data: img.data, objNum: objNum++ });
      }
    }
  }

  // Build Pages object
  const kidRefs = pageObjNums.map((n) => `${n} 0 R`).join(" ");
  objects[pagesObjIndex] = `${pagesObj} 0 obj\n<< /Type /Pages /Kids [${kidRefs}] /Count ${pages.length} >>\nendobj`;

  // Build page objects
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pageObjNum = pageObjNums[i];
    const streamObjNum = pageObjNum + 1;

    // Build content stream
    let stream = `BT\n/F1 ${fontSize} Tf\n${leading} TL\n`;

    for (const cmd of page.textCommands) {
      stream += cmd + "\n";
    }
    stream += "ET\n";

    // Image commands
    for (const img of page.images) {
      const imgObjNum = imageMap.get(img.id)!.objNum;
      stream += `q\n${img.width} 0 0 ${img.height} ${img.x} ${img.y} cm\n/Im${imgObjNum} Do\nQ\n`;
    }

    // Footer (centered at bottom)
    if (page.footer) {
      const footerWidth = estimateWidth(page.footer, 9);
      const footerX = (pageWidth - footerWidth) / 2;
      stream += `BT\n/F1 9 Tf\n0.5 0.5 0.5 rg\n1 0 0 1 ${footerX} 30 Tm\n(${page.footer}) Tj\n0 0 0 rg\nET\n`;
    }

    // Page resources
    const xobjRefs = page.images
      .map((img) => `/Im${imageMap.get(img.id)!.objNum} ${imageMap.get(img.id)!.objNum} 0 R`)
      .join(" ");
    const xobjDict = page.images.length > 0 ? ` /XObject << ${xobjRefs} >>` : "";

    objects.push(
      `${pageObjNum} 0 obj\n<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${streamObjNum} 0 R /Resources << /Font << /F1 ${fontObj1} 0 R /F2 ${fontObj2} 0 R >>${xobjDict} >> >>\nendobj`
    );

    objects.push(
      `${streamObjNum} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`
    );
  }

  // Font objects
  objects.push(`${fontObj1} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj`);
  objects.push(`${fontObj2} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj`);

  // Image XObjects
  for (const [id, { data, objNum: imgObjNum }] of imageMap) {
    const dims = getJpegDimensions(data);
    if (dims) {
      const header = `${imgObjNum} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${dims.width} /Height ${dims.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${data.length} >>\nstream\n`;
      binaryObjects.push({ objNum: imgObjNum, header, data });
    }
  }

  // Build PDF binary
  const textParts: Uint8Array[] = [];
  const encoder = new TextEncoder();

  textParts.push(encoder.encode("%PDF-1.4\n"));

  const offsets: number[] = [];
  let currentOffset = 9;

  for (const obj of objects) {
    if (obj) {
      offsets.push(currentOffset);
      const objBytes = encoder.encode(obj + "\n");
      textParts.push(objBytes);
      currentOffset += objBytes.length;
    }
  }

  for (const binObj of binaryObjects) {
    while (offsets.length < binObj.objNum) {
      offsets.push(0);
    }
    offsets[binObj.objNum - 1] = currentOffset;

    const headerBytes = encoder.encode(binObj.header);
    textParts.push(headerBytes);
    currentOffset += headerBytes.length;

    textParts.push(binObj.data);
    currentOffset += binObj.data.length;

    const footer = encoder.encode("\nendstream\nendobj\n");
    textParts.push(footer);
    currentOffset += footer.length;
  }

  // xref table
  const xrefOffset = currentOffset;
  let xref = `xref\n0 ${objNum}\n`;
  xref += "0000000000 65535 f \n";
  for (let i = 0; i < objNum - 1; i++) {
    const offset = offsets[i] ?? 0;
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  xref += `trailer\n<< /Size ${objNum} /Root ${catalogObj} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  textParts.push(encoder.encode(xref));

  // Concatenate
  const totalLength = textParts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const part of textParts) {
    result.set(part, pos);
    pos += part.length;
  }

  return result;
}

/**
 * Generate a ZIP file with PDF and multimedia attachments.
 */
export async function generateExportZip(
  entries: ExportEntry[],
  env: Env,
  pdfOptions: PdfOptions
): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {};

  const pdf = generatePdfWithImages(entries, pdfOptions);
  files["journal.pdf"] = pdf;

  // Add multimedia files (with limits for memory safety)
  let multimediaCount = 0;
  for (const entry of entries) {
    if (multimediaCount >= MAX_MULTIMEDIA_FILES) break;

    for (const media of entry.media) {
      if (multimediaCount >= MAX_MULTIMEDIA_FILES) break;

      const isMultimedia =
        media.mimeType?.startsWith("audio/") ||
        media.mimeType?.startsWith("video/");

      if (isMultimedia) {
        try {
          const obj = await env.MEDIA.get(media.r2Key);
          if (obj) {
            const buffer = await obj.arrayBuffer();
            const ext = getExtensionFromMime(media.mimeType ?? "");
            const filename = `media/${entry.entryDate}_${entry.id.slice(0, 8)}_${media.id.slice(0, 8)}.${ext}`;
            files[filename] = new Uint8Array(buffer);
            multimediaCount++;
          }
        } catch {
          // Skip failed media fetches - user can re-export if needed
        }
      }
    }
  }

  return zipSync(files);
}

function getExtensionFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "audio/amr": "amr",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/3gpp": "3gp",
    "video/webm": "webm",
  };
  return map[mimeType] ?? "bin";
}
