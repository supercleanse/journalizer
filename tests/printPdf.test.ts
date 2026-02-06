import { describe, it, expect } from "vitest";
import { generateInteriorPdf, generateCoverPdf } from "../src/services/printPdf";
import type { PrintPdfOptions } from "../src/services/printPdf";
import type { ExportEntry } from "../src/services/export";

function makeEntry(overrides: Partial<ExportEntry> = {}): ExportEntry {
  return {
    id: "test-id",
    entryDate: "2026-01-15",
    entryType: "text",
    source: "web",
    rawContent: "Test content for the printed journal",
    polishedContent: null,
    createdAt: "2026-01-15T15:30:00Z",
    media: [],
    imageData: new Map(),
    ...overrides,
  };
}

const defaultOptions: PrintPdfOptions = {
  userName: "Test User",
  timezone: "America/Denver",
  startDate: "2026-01-01",
  endDate: "2026-01-31",
  frequency: "monthly",
  colorOption: "bw",
};

describe("generateInteriorPdf", () => {
  it("returns a PDF Uint8Array and page count", () => {
    const { pdf, pageCount } = generateInteriorPdf([makeEntry()], defaultOptions);
    expect(pdf).toBeInstanceOf(Uint8Array);
    expect(pageCount).toBeGreaterThanOrEqual(2); // title + content
  });

  it("starts with %PDF-1.4", () => {
    const { pdf } = generateInteriorPdf([makeEntry()], defaultOptions);
    const text = new TextDecoder().decode(pdf);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
  });

  it("ends with %%EOF", () => {
    const { pdf } = generateInteriorPdf([makeEntry()], defaultOptions);
    const text = new TextDecoder().decode(pdf);
    expect(text.endsWith("%%EOF")).toBe(true);
  });

  it("uses 6x9 dimensions for monthly", () => {
    const { pdf } = generateInteriorPdf([makeEntry()], defaultOptions);
    const text = new TextDecoder().decode(pdf);
    expect(text).toContain("/MediaBox [0 0 432 648]"); // 6x9 at 72dpi
  });

  it("uses 5.5x8.5 dimensions for weekly", () => {
    const { pdf } = generateInteriorPdf([makeEntry()], {
      ...defaultOptions,
      frequency: "weekly",
    });
    const text = new TextDecoder().decode(pdf);
    expect(text).toContain("/MediaBox [0 0 396 612]"); // 5.5x8.5 at 72dpi
  });

  it("includes user name on title page", () => {
    const { pdf } = generateInteriorPdf([makeEntry()], defaultOptions);
    const text = new TextDecoder().decode(pdf);
    expect(text).toContain("Test User");
  });

  it("includes page numbers", () => {
    const { pdf } = generateInteriorPdf([makeEntry()], defaultOptions);
    const text = new TextDecoder().decode(pdf);
    expect(text).toContain("Test User - Page 1");
  });

  it("uses Helvetica fonts", () => {
    const { pdf } = generateInteriorPdf([makeEntry()], defaultOptions);
    const text = new TextDecoder().decode(pdf);
    expect(text).toContain("/BaseFont /Helvetica");
    expect(text).toContain("/BaseFont /Helvetica-Bold");
  });
});

describe("generateCoverPdf", () => {
  it("returns a valid PDF", () => {
    const cover = generateCoverPdf(defaultOptions, 50);
    const text = new TextDecoder().decode(cover);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.endsWith("%%EOF")).toBe(true);
  });

  it("includes user name on cover", () => {
    const cover = generateCoverPdf(defaultOptions, 50);
    const text = new TextDecoder().decode(cover);
    expect(text).toContain("Test User");
  });

  it("includes date range on cover", () => {
    const cover = generateCoverPdf(defaultOptions, 50);
    const text = new TextDecoder().decode(cover);
    expect(text).toContain("January 1, 2026");
  });
});
