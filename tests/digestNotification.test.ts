import { describe, it, expect, vi } from "vitest";
import {
  DIGEST_CONGRATULATIONS_QUIPS,
  getFallbackDigestQuip,
  formatDigestTelegramMessage,
  buildDigestNotificationEmailHtml,
  generateDigestNotificationContent,
  type DigestNotificationContent,
} from "../src/services/digestNotification";

describe("DIGEST_CONGRATULATIONS_QUIPS", () => {
  it("has at least 15 entries per personality", () => {
    for (const personality of ["encouraging", "drill_sergeant", "chill", "coach"] as const) {
      expect(DIGEST_CONGRATULATIONS_QUIPS[personality].length).toBeGreaterThanOrEqual(15);
    }
  });

  it("all entries are unique within each personality", () => {
    for (const personality of ["encouraging", "drill_sergeant", "chill", "coach"] as const) {
      const unique = new Set(DIGEST_CONGRATULATIONS_QUIPS[personality]);
      expect(unique.size).toBe(DIGEST_CONGRATULATIONS_QUIPS[personality].length);
    }
  });

  it("all entries are non-empty strings", () => {
    for (const personality of ["encouraging", "drill_sergeant", "chill", "coach"] as const) {
      for (const quip of DIGEST_CONGRATULATIONS_QUIPS[personality]) {
        expect(typeof quip).toBe("string");
        expect(quip.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe("getFallbackDigestQuip", () => {
  it("returns a quip from the list", () => {
    const quip = getFallbackDigestQuip("2025-06-15");
    expect(DIGEST_CONGRATULATIONS_QUIPS.encouraging).toContain(quip);
  });

  it("returns a personality-specific quip", () => {
    const quip = getFallbackDigestQuip("2025-06-15", "drill_sergeant");
    expect(DIGEST_CONGRATULATIONS_QUIPS.drill_sergeant).toContain(quip);
  });

  it("returns the same quip for the same date", () => {
    const a = getFallbackDigestQuip("2025-06-15");
    const b = getFallbackDigestQuip("2025-06-15");
    expect(a).toBe(b);
  });

  it("returns different quips for different dates", () => {
    const quips = new Set(
      Array.from({ length: 10 }, (_, i) =>
        getFallbackDigestQuip(`2025-01-${String(i + 1).padStart(2, "0")}`)
      )
    );
    expect(quips.size).toBeGreaterThan(1);
  });
});

describe("formatDigestTelegramMessage", () => {
  it("includes quip, date, and synopsis bullets", () => {
    const content: DigestNotificationContent = {
      quip: "Great journaling today!",
      synopsis: ["You had a productive morning", "You enjoyed lunch with a friend"],
      accountability: null,
    };
    const msg = formatDigestTelegramMessage("2025-06-15", content);
    expect(msg).toContain("Great journaling today!");
    expect(msg).toContain("2025-06-15");
    expect(msg).toContain("Today's highlights:");
    expect(msg).toContain("\u2022 You had a productive morning");
    expect(msg).toContain("\u2022 You enjoyed lunch with a friend");
  });

  it("omits highlights section when synopsis is empty", () => {
    const content: DigestNotificationContent = {
      quip: "Nice job!",
      synopsis: [],
      accountability: null,
    };
    const msg = formatDigestTelegramMessage("2025-06-15", content);
    expect(msg).toContain("Nice job!");
    expect(msg).toContain("2025-06-15");
    expect(msg).not.toContain("Today's highlights:");
    expect(msg).not.toContain("\u2022");
  });

  it("includes accountability when present", () => {
    const content: DigestNotificationContent = {
      quip: "Nice job!",
      synopsis: [],
      accountability: "Your journaling about exercise ties well with your fitness habit.",
    };
    const msg = formatDigestTelegramMessage("2025-06-15", content);
    expect(msg).toContain("Your journaling about exercise ties well with your fitness habit.");
  });
});

describe("buildDigestNotificationEmailHtml", () => {
  it("produces HTML with escaped name and quip", () => {
    const content: DigestNotificationContent = {
      quip: "You're on fire <script>alert('xss')</script>!",
      synopsis: ["You did amazing things"],
      accountability: null,
    };
    const html = buildDigestNotificationEmailHtml("Bob & Alice", "2025-06-15", content);
    expect(html).toContain("Bob &amp; Alice");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("includes synopsis bullets", () => {
    const content: DigestNotificationContent = {
      quip: "Well done!",
      synopsis: ["Morning workout", "Afternoon coding"],
      accountability: null,
    };
    const html = buildDigestNotificationEmailHtml("Test", "2025-06-15", content);
    expect(html).toContain("Today's Highlights");
    expect(html).toContain("Morning workout");
    expect(html).toContain("Afternoon coding");
  });

  it("omits highlights when synopsis is empty", () => {
    const content: DigestNotificationContent = {
      quip: "Nice!",
      synopsis: [],
      accountability: null,
    };
    const html = buildDigestNotificationEmailHtml("Test", "2025-06-15", content);
    expect(html).not.toContain("Today's Highlights");
  });

  it("includes accountability section when present", () => {
    const content: DigestNotificationContent = {
      quip: "Nice!",
      synopsis: [],
      accountability: "Keep building on that morning routine.",
    };
    const html = buildDigestNotificationEmailHtml("Test", "2025-06-15", content);
    expect(html).toContain("Keep building on that morning routine.");
  });

  it("includes unsubscribe footer", () => {
    const content: DigestNotificationContent = {
      quip: "Done!",
      synopsis: [],
      accountability: null,
    };
    const html = buildDigestNotificationEmailHtml("Test", "2025-06-15", content);
    expect(html).toContain("digest email notifications enabled");
    expect(html).toContain("Settings page");
  });

  it("includes formatted date", () => {
    const content: DigestNotificationContent = {
      quip: "Done!",
      synopsis: [],
      accountability: null,
    };
    const html = buildDigestNotificationEmailHtml("Test", "2025-06-15", content);
    expect(html).toContain("June 15, 2025");
  });
});

describe("generateDigestNotificationContent", () => {
  it("returns cached KV content when available", async () => {
    const cached = {
      quip: "Cached quip",
      synopsis: ["Cached bullet"],
    };
    const env = {
      KV: {
        get: vi.fn().mockResolvedValue(JSON.stringify(cached)),
        put: vi.fn(),
      },
      ANTHROPIC_API_KEY: "test-key",
    } as unknown as import("../src/types/env").Env;

    const result = await generateDigestNotificationContent(
      env,
      "user-1",
      "2025-06-15",
      "Some digest content"
    );
    expect(result).toEqual({ ...cached, accountability: null });
    expect(env.KV.get).toHaveBeenCalledWith("digest_notif:user-1:2025-06-15:encouraging");
  });

  it("falls back to static quip when KV and AI both fail", async () => {
    const env = {
      KV: {
        get: vi.fn().mockRejectedValue(new Error("KV down")),
        put: vi.fn(),
      },
      ANTHROPIC_API_KEY: undefined,
    } as unknown as import("../src/types/env").Env;

    const result = await generateDigestNotificationContent(
      env,
      "user-1",
      "2025-06-15",
      "Some digest content"
    );
    expect(DIGEST_CONGRATULATIONS_QUIPS.encouraging).toContain(result.quip);
    expect(result.synopsis).toEqual([]);
    expect(result.accountability).toBeNull();
  });
});
