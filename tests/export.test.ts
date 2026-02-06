import { describe, it, expect } from "vitest";
import { generatePdfWithImages, type ExportEntry, type PdfOptions } from "../src/services/export";

function makeEntry(overrides: Partial<ExportEntry> = {}): ExportEntry {
  return {
    id: "test-id",
    entryDate: "2026-01-15",
    entryType: "text",
    source: "web",
    rawContent: "Test content",
    polishedContent: null,
    createdAt: "2026-01-15T15:30:00Z",
    media: [],
    imageData: new Map(),
    ...overrides,
  };
}

const defaultOptions: PdfOptions = {
  userName: "Test User",
  timezone: "America/Denver",
  startDate: undefined,
  endDate: undefined,
};

describe("generatePdfWithImages", () => {
  it("returns a Uint8Array", () => {
    const result = generatePdfWithImages([makeEntry()], defaultOptions);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it("starts with %PDF-1.4", () => {
    const result = generatePdfWithImages([makeEntry()], defaultOptions);
    const text = new TextDecoder().decode(result);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
  });

  it("ends with %%EOF", () => {
    const result = generatePdfWithImages([makeEntry()], defaultOptions);
    const text = new TextDecoder().decode(result);
    expect(text.endsWith("%%EOF")).toBe(true);
  });

  it("uses Helvetica font", () => {
    const result = generatePdfWithImages([makeEntry()], defaultOptions);
    const text = new TextDecoder().decode(result);
    expect(text).toContain("/BaseFont /Helvetica");
    expect(text).toContain("/BaseFont /Helvetica-Bold");
  });

  it("includes title page with user name", () => {
    const result = generatePdfWithImages([makeEntry()], { userName: "Blair Williams", timezone: "America/Denver", startDate: "2026-01-01", endDate: "2026-01-31" });
    const text = new TextDecoder().decode(result);
    expect(text).toContain("Blair Williams");
    expect(text).toContain("Journal Export");
  });

  it("includes page numbers with user name", () => {
    const result = generatePdfWithImages([makeEntry()], { userName: "Blair Williams", timezone: "America/Denver" });
    const text = new TextDecoder().decode(result);
    expect(text).toContain("Blair Williams - Page 1");
  });

  it("formats source in entry header without dashes", () => {
    const result = generatePdfWithImages([makeEntry({ source: "telegram" })], defaultOptions);
    const text = new TextDecoder().decode(result);
    expect(text).toContain("via Telegram");
    expect(text).not.toContain("---");
  });

  it("formats daily entry with date only", () => {
    const result = generatePdfWithImages([makeEntry({ entryType: "digest", entryDate: "2026-01-15" })], defaultOptions);
    const text = new TextDecoder().decode(result);
    expect(text).toContain("January 15, 2026");
    expect(text).toContain("Daily Entry");
  });

  it("renders entry headers in bold font", () => {
    const result = generatePdfWithImages([makeEntry()], defaultOptions);
    const text = new TextDecoder().decode(result);
    // Heading uses F2 (Helvetica-Bold) at 12pt
    expect(text).toContain("/F2 12 Tf");
  });

  it("strips emojis from content", () => {
    const result = generatePdfWithImages([makeEntry({ rawContent: "Hello 🌍 World 🎉" })], defaultOptions);
    const text = new TextDecoder().decode(result);
    expect(text).toContain("Hello  World");
    expect(text).not.toContain("🌍");
  });

  it("omits entries with no content and no images", () => {
    const result = generatePdfWithImages([
      makeEntry({ rawContent: null, polishedContent: null }),
    ], defaultOptions);
    const text = new TextDecoder().decode(result);
    expect(text).not.toContain("via Web");
    expect(text).not.toContain("no content");
  });

  it("replaces smart quotes with ASCII equivalents", () => {
    const result = generatePdfWithImages([makeEntry({ rawContent: "\u201CHello\u201D" })], defaultOptions);
    const text = new TextDecoder().decode(result);
    expect(text).toContain('"Hello"');
  });

  it("handles multi-page content", () => {
    const longText = Array(100).fill("Line of text that needs to be rendered").join("\n");
    const result = generatePdfWithImages([makeEntry({ rawContent: longText })], defaultOptions);
    const text = new TextDecoder().decode(result);
    // Title page + content pages = more than 2 pages
    const countMatch = text.match(/\/Count (\d+)/);
    expect(countMatch).not.toBeNull();
    expect(parseInt(countMatch![1], 10)).toBeGreaterThan(2);
  });

  it("escapes parentheses in content", () => {
    const result = generatePdfWithImages([makeEntry({ rawContent: "Hello (world)" })], defaultOptions);
    const text = new TextDecoder().decode(result);
    expect(text).toContain("Hello \\(world\\)");
  });
});
