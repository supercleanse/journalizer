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

  // Fetch media for all entries
  const entryIds = entries.map((e) => e.id);
  const mediaByEntry = await getMediaByEntryIds(db, entryIds);

  // Build export entries with image data
  const exportEntries: ExportEntry[] = [];

  for (const entry of entries) {
    const media = (mediaByEntry[entry.id] ?? []) as MediaRecord[];
    const imageData = new Map<string, Uint8Array>();

    // Fetch image data if requested
    if (includeImages) {
      const imageMedia = media.filter(
        (m) => m.mimeType?.startsWith("image/")
      );

      // Fetch images in batches of 5 to avoid memory issues
      for (let i = 0; i < imageMedia.length; i += 5) {
        const batch = imageMedia.slice(i, i + 5);
        await Promise.all(
          batch.map(async (m) => {
            try {
              const obj = await env.MEDIA.get(m.r2Key);
              if (obj) {
                const buffer = await obj.arrayBuffer();
                imageData.set(m.id, new Uint8Array(buffer));
              }
            } catch {
              // Skip failed image fetches
            }
          })
        );
      }
    }

    exportEntries.push({
      id: entry.id,
      entryDate: entry.entryDate,
      entryType: entry.entryType,
      rawContent: entry.rawContent,
      polishedContent: entry.polishedContent,
      createdAt: entry.createdAt,
      media,
      imageData,
    });
  }

  return exportEntries;
}

/**
 * Generate a PDF with text and inline images.
 */
export function generatePdfWithImages(entries: ExportEntry[]): Uint8Array {
  const fontSize = 10;
  const leading = 14;
  const margin = 50;
  const pageHeight = 792;
  const pageWidth = 612;
  const usableWidth = pageWidth - 2 * margin;
  const usableHeight = pageHeight - 2 * margin;
  const maxLineLen = 80;

  // Collect all content blocks (text and images)
  interface ContentBlock {
    type: "text" | "image";
    lines?: string[];
    imageId?: string;
    imageData?: Uint8Array;
    mimeType?: string;
    width?: number;
    height?: number;
  }

  const contentBlocks: ContentBlock[] = [];

  // Header
  contentBlocks.push({
    type: "text",
    lines: [
      "My Journal - Journalizer Export",
      `Exported: ${new Date().toISOString().split("T")[0]}`,
      `Total entries: ${entries.length}`,
      "",
    ],
  });

  for (const entry of entries) {
    // Entry header
    const entryLabel = entry.entryType === "digest" ? "Daily Entry" : entry.entryType;
    contentBlocks.push({
      type: "text",
      lines: [`--- ${entry.entryDate} (${entryLabel}) ---`],
    });

    // Entry content
    const content = entry.polishedContent || entry.rawContent || "(no content)";
    const escaped = escapeText(content);
    const wrappedLines = wrapText(escaped, maxLineLen);
    contentBlocks.push({ type: "text", lines: wrappedLines });

    // Images (inline after text)
    for (const [mediaId, imageBytes] of entry.imageData) {
      const mediaRecord = entry.media.find((m) => m.id === mediaId);
      if (mediaRecord && mediaRecord.mimeType?.startsWith("image/jpeg")) {
        // Get JPEG dimensions
        const dims = getJpegDimensions(imageBytes);
        if (dims) {
          // Scale to fit within usable width, max height 300
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

  // Now build pages with content blocks
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
  }

  const pages: PageContent[] = [];
  let currentPage: PageContent = { textCommands: [], images: [] };
  let yPos = pageHeight - margin;

  for (const block of contentBlocks) {
    if (block.type === "text" && block.lines) {
      for (const line of block.lines) {
        if (yPos - leading < margin) {
          // New page
          pages.push(currentPage);
          currentPage = { textCommands: [], images: [] };
          yPos = pageHeight - margin;
        }
        currentPage.textCommands.push(`${margin} ${yPos} Td (${line}) Tj`);
        yPos -= leading;
      }
    } else if (block.type === "image" && block.imageData && block.width && block.height) {
      // Check if image fits on current page
      if (yPos - block.height < margin) {
        // New page
        pages.push(currentPage);
        currentPage = { textCommands: [], images: [] };
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
      yPos = imgY - leading; // Space after image
    }
  }

  if (currentPage.textCommands.length > 0 || currentPage.images.length > 0) {
    pages.push(currentPage);
  }

  if (pages.length === 0) {
    pages.push({ textCommands: [`${margin} ${pageHeight - margin} Td (Empty export) Tj`], images: [] });
  }

  // Build PDF with images as XObjects
  return buildPdfWithImages(pages, pageWidth, pageHeight, fontSize, leading);
}

function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapText(text: string, maxLen: number): string[] {
  const lines: string[] = [];
  for (const line of text.split("\n")) {
    if (line.length <= maxLen) {
      lines.push(line);
    } else {
      for (let i = 0; i < line.length; i += maxLen) {
        lines.push(line.slice(i, i + maxLen));
      }
    }
  }
  return lines;
}

function getJpegDimensions(data: Uint8Array): { width: number; height: number } | null {
  // Simple JPEG dimension parser - look for SOF0 marker
  let i = 0;
  if (data[0] !== 0xff || data[1] !== 0xd8) return null; // Not JPEG

  i = 2;
  while (i < data.length - 8) {
    if (data[i] !== 0xff) {
      i++;
      continue;
    }

    const marker = data[i + 1];
    // SOF0, SOF1, SOF2 markers contain dimensions
    if (marker >= 0xc0 && marker <= 0xc2) {
      const height = (data[i + 5] << 8) | data[i + 6];
      const width = (data[i + 7] << 8) | data[i + 8];
      return { width, height };
    }

    // Skip to next marker
    const len = (data[i + 2] << 8) | data[i + 3];
    i += 2 + len;
  }

  return null;
}

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

  // Collect all unique images across pages
  const imageMap = new Map<string, { data: Uint8Array; objNum: number }>();

  // Object 1: Catalog
  const catalogObj = objNum++;
  objects.push(`${catalogObj} 0 obj\n<< /Type /Catalog /Pages ${catalogObj + 1} 0 R >>\nendobj`);

  // Object 2: Pages (placeholder - will be replaced)
  const pagesObj = objNum++;
  const pagesObjIndex = objects.length;
  objects.push(""); // Placeholder

  // Reserve object numbers for pages and streams
  const pageObjNums: number[] = [];
  for (let i = 0; i < pages.length; i++) {
    pageObjNums.push(objNum);
    objNum += 2; // page + stream
  }

  // Font object
  const fontObj = objNum++;

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

    // Text commands
    for (const cmd of page.textCommands) {
      stream += cmd + "\n";
    }
    stream += "ET\n";

    // Image commands
    for (const img of page.images) {
      const imgObjNum = imageMap.get(img.id)!.objNum;
      // Save graphics state, apply transformation matrix, draw image, restore
      stream += `q\n${img.width} 0 0 ${img.height} ${img.x} ${img.y} cm\n/Im${imgObjNum} Do\nQ\n`;
    }

    // Build XObject references for this page's images
    const xobjRefs = page.images
      .map((img) => `/Im${imageMap.get(img.id)!.objNum} ${imageMap.get(img.id)!.objNum} 0 R`)
      .join(" ");
    const xobjDict = page.images.length > 0 ? `/XObject << ${xobjRefs} >>` : "";

    objects.push(
      `${pageObjNum} 0 obj\n<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${streamObjNum} 0 R /Resources << /Font << /F1 ${fontObj} 0 R >> ${xobjDict} >> >>\nendobj`
    );

    objects.push(
      `${streamObjNum} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`
    );
  }

  // Font object
  objects.push(`${fontObj} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj`);

  // Image XObjects (binary data handled separately)
  for (const [id, { data, objNum: imgObjNum }] of imageMap) {
    const dims = getJpegDimensions(data);
    if (dims) {
      const header = `${imgObjNum} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${dims.width} /Height ${dims.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${data.length} >>\nstream\n`;
      binaryObjects.push({ objNum: imgObjNum, header, data });
    }
  }

  // Build PDF with binary image data
  const textParts: Uint8Array[] = [];
  const encoder = new TextEncoder();

  // PDF header
  textParts.push(encoder.encode("%PDF-1.4\n"));

  // Track offsets for xref
  const offsets: number[] = [];
  let currentOffset = 9; // "%PDF-1.4\n".length

  // Add text objects
  for (const obj of objects) {
    if (obj) {
      offsets.push(currentOffset);
      const objBytes = encoder.encode(obj + "\n");
      textParts.push(objBytes);
      currentOffset += objBytes.length;
    }
  }

  // Add binary image objects
  for (const binObj of binaryObjects) {
    // Find the right position in offsets array
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

  // Build xref
  const xrefOffset = currentOffset;
  let xref = `xref\n0 ${objNum}\n`;
  xref += "0000000000 65535 f \n";
  for (let i = 0; i < objNum - 1; i++) {
    const offset = offsets[i] ?? 0;
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  // Trailer
  xref += `trailer\n<< /Size ${objNum} /Root ${catalogObj} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  textParts.push(encoder.encode(xref));

  // Concatenate all parts
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
  env: Env
): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {};

  // Generate PDF (text + images)
  const pdf = generatePdfWithImages(entries);
  files["journal.pdf"] = pdf;

  // Add multimedia files
  for (const entry of entries) {
    for (const media of entry.media) {
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
          }
        } catch {
          // Skip failed media fetches
        }
      }
    }
  }

  // Generate ZIP
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
