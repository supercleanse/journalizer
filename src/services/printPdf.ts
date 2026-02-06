import type { ExportEntry, PdfOptions } from "./export";

// Glass contract: failure modes
export { DatabaseError } from "../lib/errors";

// ── Print-specific dimensions (in points: 1 inch = 72 points) ──

interface PrintSpecs {
  pageWidth: number;
  pageHeight: number;
  marginInner: number; // binding side
  marginOuter: number;
  marginTop: number;
  marginBottom: number;
  needsPadding: boolean; // saddle-stitch needs multiples of 4
}

const SPECS: Record<string, PrintSpecs> = {
  weekly: {
    // 5.5" x 8.5" (digest booklet)
    pageWidth: 396,
    pageHeight: 612,
    marginInner: 36, // 0.5"
    marginOuter: 27, // 0.375"
    marginTop: 36,
    marginBottom: 36,
    needsPadding: false, // using perfect-bound, not saddle-stitch
  },
  default: {
    // 6" x 9" (standard book)
    pageWidth: 432,
    pageHeight: 648,
    marginInner: 36,
    marginOuter: 27,
    marginTop: 36,
    marginBottom: 36,
    needsPadding: false,
  },
};

function getSpecs(frequency: string): PrintSpecs {
  return frequency === "weekly" ? SPECS.weekly : SPECS.default;
}

// ── Reuse text helpers from export.ts ──
// These are duplicated to keep printPdf self-contained

function sanitizeForPdf(text: string): string {
  return text
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7E\n\t]/g, "");
}

function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function prepareText(text: string): string {
  return escapeText(sanitizeForPdf(text));
}

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
      if (current.length > 0) lines.push(current);
    }
  }
  return lines;
}

function estimateWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.52;
}

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
    return isoStr;
  }
}

function formatSource(source: string): string {
  const map: Record<string, string> = {
    web: "Web", telegram: "Telegram", sms: "SMS", system: "System",
  };
  return map[source] || source;
}

function getJpegDimensions(data: Uint8Array): { width: number; height: number } | null {
  let i = 0;
  if (data[0] !== 0xff || data[1] !== 0xd8) return null;
  i = 2;
  while (i < data.length - 8) {
    if (data[i] !== 0xff) { i++; continue; }
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

// ── Print PDF types ──

export interface PrintPdfOptions extends PdfOptions {
  frequency: string;
  colorOption: string;
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
  footer?: string;
}

// ── Interior PDF ──

/**
 * Generate a print-ready interior PDF for Lulu.
 * Returns the PDF bytes and page count.
 */
const MAX_PRINT_ENTRIES = 500;

export function generateInteriorPdf(
  entries: ExportEntry[],
  options: PrintPdfOptions
): { pdf: Uint8Array; pageCount: number } {
  // Guard against memory exhaustion on Workers (128MB limit)
  const limitedEntries = entries.slice(0, MAX_PRINT_ENTRIES);
  const specs = getSpecs(options.frequency);
  const { pageWidth, pageHeight, marginInner, marginOuter, marginTop, marginBottom } = specs;
  const usableWidth = pageWidth - marginInner - marginOuter;
  const fontSize = 10;
  const leading = 14;
  const maxLineLen = Math.floor(usableWidth / (fontSize * 0.52));

  // ── Title page ──
  const titlePage: PageContent = { textCommands: [], images: [] };
  const centerY = pageHeight / 2 + 40;

  const nameText = prepareText(options.userName || "My Journal");
  const nameX = (pageWidth - estimateWidth(nameText, 18)) / 2;
  titlePage.textCommands.push(`/F2 18 Tf`);
  titlePage.textCommands.push(`1 0 0 1 ${Math.max(marginOuter, nameX)} ${centerY} Tm (${nameText}) Tj`);

  const subtitleText = "Journal";
  const subtitleX = (pageWidth - estimateWidth(subtitleText, 14)) / 2;
  titlePage.textCommands.push(`/F1 14 Tf`);
  titlePage.textCommands.push(`1 0 0 1 ${Math.max(marginOuter, subtitleX)} ${centerY - 30} Tm (${subtitleText}) Tj`);

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
  titlePage.textCommands.push(`1 0 0 1 ${Math.max(marginOuter, rangeX)} ${centerY - 55} Tm (${rangeText}) Tj`);

  // ── Content blocks ──
  interface ContentBlock {
    type: "text" | "heading" | "image";
    lines?: string[];
    imageId?: string;
    imageData?: Uint8Array;
    width?: number;
    height?: number;
  }

  const contentBlocks: ContentBlock[] = [];

  for (const entry of entries) {
    const content = entry.polishedContent || entry.rawContent || "";
    const hasContent = content.trim().length > 0;
    const hasImages = entry.imageData.size > 0;
    if (!hasContent && !hasImages) continue;

    let headerText: string;
    if (entry.entryType === "digest") {
      headerText = `${formatDate(entry.entryDate)} (Daily Combined Entry)`;
    } else {
      const dateTime = entry.createdAt
        ? formatDateTime(entry.createdAt, options.timezone)
        : formatDate(entry.entryDate);
      const source = formatSource(entry.source);
      headerText = `${dateTime} (via ${source})`;
    }
    contentBlocks.push({ type: "heading", lines: [prepareText(headerText)] });

    if (hasContent) {
      const sanitized = sanitizeForPdf(content);
      const escaped = escapeText(sanitized);
      contentBlocks.push({ type: "text", lines: wrapText(escaped, maxLineLen) });
    }

    for (const [mediaId, imageBytes] of entry.imageData) {
      const mediaRecord = entry.media.find((m) => m.id === mediaId);
      if (mediaRecord?.mimeType?.startsWith("image/jpeg")) {
        const dims = getJpegDimensions(imageBytes);
        if (dims) {
          let { width, height } = dims;
          if (width > usableWidth) {
            height = (height * usableWidth) / width;
            width = usableWidth;
          }
          const maxImgHeight = pageHeight - marginTop - marginBottom - 40;
          if (height > maxImgHeight) {
            width = (width * maxImgHeight) / height;
            height = maxImgHeight;
          }
          contentBlocks.push({ type: "image", imageId: mediaId, imageData: imageBytes, width, height });
        }
      }
    }

    contentBlocks.push({ type: "text", lines: [""] });
  }

  // ── Build pages ──
  const contentPages: PageContent[] = [];
  let currentPage: PageContent = { textCommands: [], images: [] };
  currentPage.textCommands.push(`/F1 ${fontSize} Tf`);
  let yPos = pageHeight - marginTop;
  const headingSize = 11;
  const headingLeading = 16;
  const leftMargin = marginInner; // binding side gets bigger margin

  for (const block of contentBlocks) {
    if (block.type === "heading" && block.lines) {
      for (const line of block.lines) {
        if (yPos - headingLeading < marginBottom + 20) {
          contentPages.push(currentPage);
          currentPage = { textCommands: [], images: [] };
          currentPage.textCommands.push(`/F1 ${fontSize} Tf`);
          yPos = pageHeight - marginTop;
        }
        currentPage.textCommands.push(`/F2 ${headingSize} Tf`);
        currentPage.textCommands.push(`1 0 0 1 ${leftMargin} ${yPos} Tm (${line}) Tj`);
        currentPage.textCommands.push(`/F1 ${fontSize} Tf`);
        yPos -= headingLeading;
      }
    } else if (block.type === "text" && block.lines) {
      for (const line of block.lines) {
        if (yPos - leading < marginBottom + 20) {
          contentPages.push(currentPage);
          currentPage = { textCommands: [], images: [] };
          currentPage.textCommands.push(`/F1 ${fontSize} Tf`);
          yPos = pageHeight - marginTop;
        }
        currentPage.textCommands.push(`1 0 0 1 ${leftMargin} ${yPos} Tm (${line}) Tj`);
        yPos -= leading;
      }
    } else if (block.type === "image" && block.imageData && block.width && block.height) {
      if (yPos - block.height < marginBottom + 20) {
        contentPages.push(currentPage);
        currentPage = { textCommands: [], images: [] };
        currentPage.textCommands.push(`/F1 ${fontSize} Tf`);
        yPos = pageHeight - marginTop;
      }
      const imgY = yPos - block.height;
      currentPage.images.push({
        id: block.imageId!,
        data: block.imageData,
        x: leftMargin,
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

  // Add page number footers
  const userName = sanitizeForPdf(options.userName || "");
  for (let i = 0; i < contentPages.length; i++) {
    const footerText = userName
      ? `${escapeText(userName)} - Page ${i + 1}`
      : `Page ${i + 1}`;
    contentPages[i].footer = footerText;
  }

  const allPages = [titlePage, ...contentPages];

  if (allPages.length === 1) {
    allPages.push({
      textCommands: [`/F1 ${fontSize} Tf`, `1 0 0 1 ${leftMargin} ${pageHeight - marginTop} Tm (No entries for this period) Tj`],
      images: [],
      footer: userName ? `${escapeText(userName)} - Page 1` : "Page 1",
    });
  }

  const pdf = buildPdf(allPages, pageWidth, pageHeight, fontSize, leading);
  return { pdf, pageCount: allPages.length };
}

// ── Cover PDF ──

/**
 * Generate a simple cover PDF for Lulu perfect-bound books.
 * Lulu requires a separate cover PDF for the front, spine, and back.
 * For simplicity, we generate a single-page front cover.
 * Lulu will wrap this around the book.
 */
export function generateCoverPdf(
  options: PrintPdfOptions,
  pageCount: number
): Uint8Array {
  const specs = getSpecs(options.frequency);
  // Cover dimensions: Lulu calculates spine width from page count
  // Approximate: 0.0025" per page for standard paper
  const spineWidth = Math.max(pageCount * 0.18, 14); // points, minimum ~0.2"

  // Full cover: back + spine + front, all in one
  // Width = back + spine + front + bleed
  const bleed = 9; // 0.125" each side
  const coverWidth = specs.pageWidth * 2 + spineWidth + bleed * 2;
  const coverHeight = specs.pageHeight + bleed * 2;

  const page: PageContent = { textCommands: [], images: [] };

  // Front cover text (right half of the cover spread)
  const frontCenterX = specs.pageWidth + spineWidth + specs.pageWidth / 2 + bleed;
  const frontCenterY = coverHeight / 2 + 40;

  const nameText = prepareText(options.userName || "My Journal");
  const nameX = frontCenterX - estimateWidth(nameText, 22) / 2;
  page.textCommands.push(`/F2 22 Tf`);
  page.textCommands.push(`1 0 0 1 ${nameX} ${frontCenterY} Tm (${nameText}) Tj`);

  const subtitleText = "Journal";
  const subtitleX = frontCenterX - estimateWidth(subtitleText, 16) / 2;
  page.textCommands.push(`/F1 16 Tf`);
  page.textCommands.push(`1 0 0 1 ${subtitleX} ${frontCenterY - 35} Tm (${subtitleText}) Tj`);

  let rangeText = "";
  if (options.startDate && options.endDate) {
    rangeText = `${formatDate(options.startDate)} - ${formatDate(options.endDate)}`;
  } else if (options.startDate) {
    rangeText = `From ${formatDate(options.startDate)}`;
  }
  if (rangeText) {
    rangeText = prepareText(rangeText);
    const rangeX = frontCenterX - estimateWidth(rangeText, 12) / 2;
    page.textCommands.push(`/F1 12 Tf`);
    page.textCommands.push(`1 0 0 1 ${rangeX} ${frontCenterY - 60} Tm (${rangeText}) Tj`);
  }

  // Spine text (rotated, centered on spine)
  const spineText = prepareText(options.userName || "Journal");
  const spineX = specs.pageWidth + bleed + spineWidth / 2;
  page.textCommands.push(`ET\nq\n`);
  page.textCommands.push(`0 1 -1 0 ${spineX} ${bleed + 36} cm\n`);
  page.textCommands.push(`BT\n/F2 8 Tf\n0 0 Td\n(${spineText}) Tj\nET\nQ\nBT\n`);

  return buildPdf([page], coverWidth, coverHeight, 10, 14);
}

// ── Shared PDF builder ──

function buildPdf(
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

  const catalogObj = objNum++;
  objects.push(`${catalogObj} 0 obj\n<< /Type /Catalog /Pages ${catalogObj + 1} 0 R >>\nendobj`);

  const pagesObj = objNum++;
  const pagesObjIndex = objects.length;
  objects.push("");

  const pageObjNums: number[] = [];
  for (let i = 0; i < pages.length; i++) {
    pageObjNums.push(objNum);
    objNum += 2;
  }

  const fontObj1 = objNum++;
  const fontObj2 = objNum++;

  for (const page of pages) {
    for (const img of page.images) {
      if (!imageMap.has(img.id)) {
        imageMap.set(img.id, { data: img.data, objNum: objNum++ });
      }
    }
  }

  const kidRefs = pageObjNums.map((n) => `${n} 0 R`).join(" ");
  objects[pagesObjIndex] = `${pagesObj} 0 obj\n<< /Type /Pages /Kids [${kidRefs}] /Count ${pages.length} >>\nendobj`;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pageObjNum = pageObjNums[i];
    const streamObjNum = pageObjNum + 1;

    let stream = `BT\n/F1 ${fontSize} Tf\n${leading} TL\n`;
    for (const cmd of page.textCommands) {
      stream += cmd + "\n";
    }
    stream += "ET\n";

    for (const img of page.images) {
      const imgObjNum = imageMap.get(img.id)!.objNum;
      stream += `q\n${img.width} 0 0 ${img.height} ${img.x} ${img.y} cm\n/Im${imgObjNum} Do\nQ\n`;
    }

    if (page.footer) {
      const footerWidth = estimateWidth(page.footer, 9);
      const footerX = (pageWidth - footerWidth) / 2;
      stream += `BT\n/F1 9 Tf\n0.5 0.5 0.5 rg\n1 0 0 1 ${footerX} 20 Tm\n(${page.footer}) Tj\n0 0 0 rg\nET\n`;
    }

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

  objects.push(`${fontObj1} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj`);
  objects.push(`${fontObj2} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj`);

  for (const [, { data, objNum: imgObjNum }] of imageMap) {
    const dims = getJpegDimensions(data);
    if (dims) {
      const header = `${imgObjNum} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${dims.width} /Height ${dims.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${data.length} >>\nstream\n`;
      binaryObjects.push({ objNum: imgObjNum, header, data });
    }
  }

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
    while (offsets.length < binObj.objNum) offsets.push(0);
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

  const xrefOffset = currentOffset;
  let xref = `xref\n0 ${objNum}\n`;
  xref += "0000000000 65535 f \n";
  for (let i = 0; i < objNum - 1; i++) {
    const offset = offsets[i] ?? 0;
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objNum} /Root ${catalogObj} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  textParts.push(encoder.encode(xref));

  const totalLength = textParts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const part of textParts) {
    result.set(part, pos);
    pos += part.length;
  }
  return result;
}
