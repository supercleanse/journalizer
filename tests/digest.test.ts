import { describe, it, expect } from "vitest";

// Extracted from src/services/digest.ts for unit testing without CF runtime

interface DigestEntry {
  rawContent: string | null;
  polishedContent: string | null;
  entryType: string;
  createdAt: string | null;
  media?: Array<{ transcription: string | null }>;
}

function formatEntriesForPrompt(entries: DigestEntry[]): string {
  return entries
    .map((e, i) => {
      const time = e.createdAt
        ? new Date(e.createdAt).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })
        : `Entry ${i + 1}`;
      const content = e.polishedContent || e.rawContent || "";
      const transcription = e.media
        ?.map((m) => m.transcription)
        .filter(Boolean)
        .join("\n");

      let text = `[${time} — ${e.entryType}]`;
      if (content) text += `\n${content}`;
      if (transcription) text += `\n[Transcription]: ${transcription}`;
      if (!content && !transcription) text += "\n[Media only, no text]";
      return text;
    })
    .join("\n\n---\n\n");
}

type VoiceStyle = "natural" | "conversational" | "reflective" | "polished";

const VOICE_INSTRUCTIONS: Record<VoiceStyle, string> = {
  natural:
    "Keep the raw, authentic feel. Minimal smoothing — just weave entries together naturally.",
  conversational:
    "Keep it casual and flowing. The digest should read like you're telling a friend about your day.",
  reflective:
    "Add gentle structure and flow. Slightly more thoughtful, introspective tone.",
  polished:
    "Create a well-written, readable narrative. Preserve vocabulary and meaning but elevate the prose.",
};

function buildDigestPrompt(
  voiceStyle: VoiceStyle,
  voiceNotes: string | null,
  date: string
): string {
  const formatted = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return `You are creating a daily journal digest for ${formatted}.
You will receive multiple journal entries from this day, in chronological order.
Your task is to weave them into a single, cohesive narrative of the day.

Rules:
- Maintain chronological flow
- Preserve key details, emotions, and events
- Keep the author's voice and personality intact
- Voice style: ${voiceStyle} — ${VOICE_INSTRUCTIONS[voiceStyle]}
${voiceNotes ? `- Author's voice notes: "${voiceNotes}"` : ""}
- Write as a single continuous narrative, not bullet points or separate sections
- If entries include audio/video transcriptions, integrate them naturally
- Do NOT add events, emotions, or details that weren't mentioned
- For photo-only entries (no text), you may briefly note the photo if context is available, or skip

Return ONLY the digest narrative. No preamble, explanations, titles, or metadata.`;
}

describe("formatEntriesForPrompt", () => {
  it("formats a single text entry with polished content", () => {
    const entries: DigestEntry[] = [
      {
        rawContent: "raw text",
        polishedContent: "polished text",
        entryType: "text",
        createdAt: "2025-01-15T14:30:00Z",
      },
    ];
    const result = formatEntriesForPrompt(entries);
    expect(result).toContain("polished text");
    expect(result).toContain("text]");
    expect(result).not.toContain("raw text");
  });

  it("falls back to rawContent when no polishedContent", () => {
    const entries: DigestEntry[] = [
      {
        rawContent: "raw only",
        polishedContent: null,
        entryType: "text",
        createdAt: "2025-01-15T14:30:00Z",
      },
    ];
    const result = formatEntriesForPrompt(entries);
    expect(result).toContain("raw only");
  });

  it("marks media-only entries", () => {
    const entries: DigestEntry[] = [
      {
        rawContent: null,
        polishedContent: null,
        entryType: "photo",
        createdAt: "2025-01-15T14:30:00Z",
        media: [{ transcription: null }],
      },
    ];
    const result = formatEntriesForPrompt(entries);
    expect(result).toContain("[Media only, no text]");
  });

  it("includes transcription from media", () => {
    const entries: DigestEntry[] = [
      {
        rawContent: null,
        polishedContent: null,
        entryType: "audio",
        createdAt: "2025-01-15T14:30:00Z",
        media: [{ transcription: "Hello, this is a voice note." }],
      },
    ];
    const result = formatEntriesForPrompt(entries);
    expect(result).toContain("[Transcription]: Hello, this is a voice note.");
    expect(result).not.toContain("[Media only, no text]");
  });

  it("separates multiple entries with dividers", () => {
    const entries: DigestEntry[] = [
      {
        rawContent: "Morning thoughts",
        polishedContent: null,
        entryType: "text",
        createdAt: "2025-01-15T08:00:00Z",
      },
      {
        rawContent: "Evening reflection",
        polishedContent: null,
        entryType: "text",
        createdAt: "2025-01-15T20:00:00Z",
      },
    ];
    const result = formatEntriesForPrompt(entries);
    expect(result).toContain("---");
    expect(result).toContain("Morning thoughts");
    expect(result).toContain("Evening reflection");
  });

  it("uses fallback label when createdAt is null", () => {
    const entries: DigestEntry[] = [
      {
        rawContent: "Some text",
        polishedContent: null,
        entryType: "text",
        createdAt: null,
      },
    ];
    const result = formatEntriesForPrompt(entries);
    expect(result).toContain("[Entry 1 — text]");
  });
});

describe("buildDigestPrompt", () => {
  it("includes the formatted date", () => {
    const prompt = buildDigestPrompt("natural", null, "2025-01-15");
    expect(prompt).toContain("January 15, 2025");
  });

  it("includes voice style instructions", () => {
    const prompt = buildDigestPrompt("conversational", null, "2025-01-15");
    expect(prompt).toContain("conversational");
    expect(prompt).toContain("telling a friend");
  });

  it("includes voice notes when provided", () => {
    const prompt = buildDigestPrompt("natural", "Keep it brief", "2025-01-15");
    expect(prompt).toContain('Author\'s voice notes: "Keep it brief"');
  });

  it("omits voice notes line when null", () => {
    const prompt = buildDigestPrompt("natural", null, "2025-01-15");
    expect(prompt).not.toContain("Author's voice notes");
  });

  it("covers all voice styles", () => {
    const styles: VoiceStyle[] = [
      "natural",
      "conversational",
      "reflective",
      "polished",
    ];
    for (const style of styles) {
      const prompt = buildDigestPrompt(style, null, "2025-01-15");
      expect(prompt).toContain(`Voice style: ${style}`);
      expect(prompt).toContain(VOICE_INSTRUCTIONS[style]);
    }
  });
});

describe("digest generation logic", () => {
  it("single-entry days use content directly (no AI call)", () => {
    // Simulates the logic in generateDailyDigest
    const entries = [
      {
        id: "e1",
        rawContent: "Today was great",
        polishedContent: "Today was a great day",
        entryType: "text" as const,
        createdAt: "2025-01-15T14:30:00Z",
      },
    ];

    let polishedContent: string;
    if (entries.length === 1) {
      const entry = entries[0];
      polishedContent =
        entry.polishedContent || entry.rawContent || "[Media entry]";
    } else {
      polishedContent = "AI-generated narrative"; // would call AI
    }

    expect(polishedContent).toBe("Today was a great day");
  });

  it("single-entry with no content falls back to [Media entry]", () => {
    const entries = [
      {
        id: "e1",
        rawContent: null as string | null,
        polishedContent: null as string | null,
        entryType: "photo" as const,
        createdAt: "2025-01-15T14:30:00Z",
      },
    ];

    let polishedContent: string;
    if (entries.length === 1) {
      const entry = entries[0];
      polishedContent =
        entry.polishedContent || entry.rawContent || "[Media entry]";
    } else {
      polishedContent = "AI-generated narrative";
    }

    expect(polishedContent).toBe("[Media entry]");
  });

  it("multi-entry days would invoke AI generation", () => {
    const entries = [
      {
        id: "e1",
        rawContent: "Morning",
        polishedContent: null,
        entryType: "text" as const,
        createdAt: "2025-01-15T08:00:00Z",
      },
      {
        id: "e2",
        rawContent: "Evening",
        polishedContent: null,
        entryType: "text" as const,
        createdAt: "2025-01-15T20:00:00Z",
      },
    ];

    // Multi-entry path
    expect(entries.length).toBeGreaterThan(1);
    const prompt = formatEntriesForPrompt(entries);
    expect(prompt).toContain("Morning");
    expect(prompt).toContain("Evening");
    expect(prompt).toContain("---");
  });
});
