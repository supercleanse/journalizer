import { describe, it, expect, vi } from "vitest";
import { computeEntryStats, buildPersonalizedEmailHtml } from "../src/services/emailBody";
import type { ExportEntry } from "../src/services/export";

function makeEntry(overrides: Partial<ExportEntry> = {}): ExportEntry {
  return {
    id: "e1",
    entryDate: "2025-01-15",
    entryType: "text",
    source: "telegram",
    rawContent: "Had a great day hiking.",
    polishedContent: "Enjoyed a wonderful day on the trails.",
    createdAt: "2025-01-15T10:00:00Z",
    media: [],
    imageData: new Map(),
    ...overrides,
  };
}

describe("computeEntryStats", () => {
  it("counts a single entry with no media", () => {
    const stats = computeEntryStats([makeEntry()]);
    expect(stats).toEqual({
      daysJournaled: 1,
      totalEntries: 1,
      imageCount: 0,
      videoCount: 0,
      audioCount: 0,
    });
  });

  it("counts unique days across multiple entries", () => {
    const entries = [
      makeEntry({ id: "e1", entryDate: "2025-01-15" }),
      makeEntry({ id: "e2", entryDate: "2025-01-15" }),
      makeEntry({ id: "e3", entryDate: "2025-01-16" }),
    ];
    const stats = computeEntryStats(entries);
    expect(stats.daysJournaled).toBe(2);
    expect(stats.totalEntries).toBe(3);
  });

  it("counts media by type", () => {
    const entries = [
      makeEntry({
        media: [
          { id: "m1", entryId: "e1", userId: "u1", r2Key: "k1", mimeType: "image/jpeg", createdAt: "" },
          { id: "m2", entryId: "e1", userId: "u1", r2Key: "k2", mimeType: "image/png", createdAt: "" },
          { id: "m3", entryId: "e1", userId: "u1", r2Key: "k3", mimeType: "video/mp4", createdAt: "" },
          { id: "m4", entryId: "e1", userId: "u1", r2Key: "k4", mimeType: "audio/ogg", createdAt: "" },
        ] as any,
      }),
    ];
    const stats = computeEntryStats(entries);
    expect(stats.imageCount).toBe(2);
    expect(stats.videoCount).toBe(1);
    expect(stats.audioCount).toBe(1);
  });

  it("returns zeros for empty entries", () => {
    const stats = computeEntryStats([]);
    expect(stats).toEqual({
      daysJournaled: 0,
      totalEntries: 0,
      imageCount: 0,
      videoCount: 0,
      audioCount: 0,
    });
  });
});

describe("buildPersonalizedEmailHtml", () => {
  it("renders fallback HTML when no API key provided", async () => {
    const entries = [makeEntry()];
    const html = await buildPersonalizedEmailHtml(undefined, entries, {
      name: "Alice",
      periodLabel: "Weekly",
      startDate: "2025-01-13",
      endDate: "2025-01-19",
    });

    expect(html).toContain("Your Weekly Journal");
    expect(html).toContain("Hi Alice,");
    expect(html).toContain("January 13, 2025");
    expect(html).toContain("January 19, 2025");
    expect(html).toContain("<strong>1</strong> day journaled");
    expect(html).toContain("<strong>1</strong> entry");
    expect(html).not.toContain("Period Highlights");
  });

  it("escapes HTML in user name", async () => {
    const html = await buildPersonalizedEmailHtml(undefined, [makeEntry()], {
      name: '<script>alert("xss")</script>',
      periodLabel: "Monthly",
      startDate: "2025-01-01",
      endDate: "2025-01-31",
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("shows media stats only when non-zero", async () => {
    const entries = [
      makeEntry({
        media: [
          { id: "m1", entryId: "e1", userId: "u1", r2Key: "k1", mimeType: "image/jpeg", createdAt: "" },
        ] as any,
      }),
    ];
    const html = await buildPersonalizedEmailHtml(undefined, entries, {
      name: "Bob",
      periodLabel: "Weekly",
      startDate: "2025-01-13",
      endDate: "2025-01-19",
    });

    expect(html).toContain("1</strong> photo");
    expect(html).not.toContain("video");
    expect(html).not.toContain("audio");
  });

  it("pluralizes correctly", async () => {
    const entries = [
      makeEntry({ id: "e1", entryDate: "2025-01-15" }),
      makeEntry({ id: "e2", entryDate: "2025-01-16" }),
      makeEntry({
        id: "e3",
        entryDate: "2025-01-17",
        media: [
          { id: "m1", entryId: "e3", userId: "u1", r2Key: "k1", mimeType: "image/jpeg", createdAt: "" },
          { id: "m2", entryId: "e3", userId: "u1", r2Key: "k2", mimeType: "image/png", createdAt: "" },
        ] as any,
      }),
    ];
    const html = await buildPersonalizedEmailHtml(undefined, entries, {
      name: "Carol",
      periodLabel: "Weekly",
      startDate: "2025-01-13",
      endDate: "2025-01-19",
    });

    expect(html).toContain("3</strong> days journaled");
    expect(html).toContain("3</strong> entries");
    expect(html).toContain("2</strong> photos");
  });

  it("falls back to simple template when AI call fails", async () => {
    // Mock the Anthropic SDK to throw
    vi.mock("@anthropic-ai/sdk", () => ({
      default: class {
        messages = {
          create: () => Promise.reject(new Error("API quota exceeded")),
        };
      },
    }));

    const entries = [makeEntry()];
    const html = await buildPersonalizedEmailHtml("fake-api-key", entries, {
      name: "Eve",
      periodLabel: "Weekly",
      startDate: "2025-01-13",
      endDate: "2025-01-19",
    });

    // Should still render valid HTML with stats, just no AI content
    expect(html).toContain("Your Weekly Journal");
    expect(html).toContain("Hi Eve,");
    expect(html).toContain("<strong>1</strong> entry");
    expect(html).not.toContain("Period Highlights");

    vi.restoreAllMocks();
  });

  it("includes unsubscribe footer", async () => {
    const html = await buildPersonalizedEmailHtml(undefined, [makeEntry()], {
      name: "Dave",
      periodLabel: "Quarterly",
      startDate: "2025-01-01",
      endDate: "2025-03-31",
    });

    expect(html).toContain("quarterly email subscription");
    expect(html).toContain("Settings page");
  });
});
