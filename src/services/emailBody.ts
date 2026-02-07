import Anthropic from "@anthropic-ai/sdk";
import type { ExportEntry, HabitData } from "./export";

export interface EmailBodyStats {
  daysJournaled: number;
  totalEntries: number;
  imageCount: number;
  videoCount: number;
  audioCount: number;
}

export function computeEntryStats(entries: ExportEntry[]): EmailBodyStats {
  const uniqueDates = new Set<string>();
  let imageCount = 0;
  let videoCount = 0;
  let audioCount = 0;

  for (const entry of entries) {
    uniqueDates.add(entry.entryDate);
    for (const m of entry.media) {
      if (m.mimeType?.startsWith("image/")) imageCount++;
      else if (m.mimeType?.startsWith("video/")) videoCount++;
      else if (m.mimeType?.startsWith("audio/")) audioCount++;
    }
  }

  return {
    daysJournaled: uniqueDates.size,
    totalEntries: entries.length,
    imageCount,
    videoCount,
    audioCount,
  };
}

export async function generateEmailAIContent(
  apiKey: string,
  entries: ExportEntry[],
  periodLabel: string,
  startDate: string,
  endDate: string,
): Promise<{ quip: string; synopsis: string[] }> {
  const entrySnippets = entries
    .slice(0, 50)
    .map((e) => {
      const text = e.polishedContent || e.rawContent || "";
      const truncated = text.length > 300 ? text.slice(0, 300) + "..." : text;
      return `[${e.entryDate}] ${truncated}`;
    })
    .join("\n\n");

  const systemPrompt = `You generate short, fun email content for a journaling app called Journalizer.
You will receive journal entry snippets from a user's ${periodLabel.toLowerCase()} period (${startDate} to ${endDate}).

Respond with ONLY a JSON object (no markdown fences, no extra text):
{
  "quip": "A fun 1-2 sentence congratulations",
  "synopsis": ["bullet 1", "bullet 2", "bullet 3"]
}

Rules for the quip:
- Be warm, genuine, and slightly playful
- Reference a specific detail from their journal entries to make it personal
- Keep it to 1-2 sentences max
- Do not be sappy or over-the-top

Rules for the synopsis:
- Exactly 3-4 bullet points
- Each bullet is a single sentence summarizing a theme or highlight from the period
- Cover the breadth of the period, not just one day
- Keep each bullet under 25 words
- Write in third person (e.g. "Explored new hiking trails" not "You explored")`;

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-3-5-haiku-20241022",
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: "user", content: entrySnippets || "(no text entries)" }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock?.text) throw new Error("Empty AI response for email body");

  const raw = textBlock.text.replace(/^```(?:json)?\n?|\n?```$/g, "").trim();
  const parsed = JSON.parse(raw);
  if (typeof parsed.quip !== "string" || !Array.isArray(parsed.synopsis)) {
    throw new Error("Invalid AI response structure for email body");
  }

  return {
    quip: parsed.quip,
    synopsis: parsed.synopsis.slice(0, 4).map(String),
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function renderStatsHtml(stats: EmailBodyStats): string {
  const parts: string[] = [
    `<strong>${stats.daysJournaled}</strong> day${stats.daysJournaled !== 1 ? "s" : ""} journaled`,
    `<strong>${stats.totalEntries}</strong> ${stats.totalEntries === 1 ? "entry" : "entries"}`,
  ];
  if (stats.imageCount > 0)
    parts.push(`<strong>${stats.imageCount}</strong> photo${stats.imageCount !== 1 ? "s" : ""}`);
  if (stats.videoCount > 0)
    parts.push(`<strong>${stats.videoCount}</strong> video${stats.videoCount !== 1 ? "s" : ""}`);
  if (stats.audioCount > 0)
    parts.push(`<strong>${stats.audioCount}</strong> audio recording${stats.audioCount !== 1 ? "s" : ""}`);

  return `<div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center; color: #4a4a4a; font-size: 14px;">
    ${parts.join(" &nbsp;&bull;&nbsp; ")}
  </div>`;
}

function renderHabitStatsHtml(habitData: HabitData, totalDays: number): string {
  if (habitData.habits.length === 0) return "";

  const rows = habitData.habits.map((habit) => {
    let completedDays = 0;
    for (const dateLogs of Object.values(habitData.logsByDate)) {
      if (dateLogs[habit.id]) completedDays++;
    }
    const pct = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;
    const name = escapeHtml(habit.name);
    return `<tr><td style="padding: 4px 12px 4px 0; color: #4a4a4a;">${name}</td><td style="padding: 4px 0; color: #1a1a1a; font-weight: 600;">${completedDays}/${totalDays} days (${pct}%)</td></tr>`;
  });

  return `<div style="margin: 20px 0;">
    <p style="color: #1a1a1a; font-weight: 600; font-size: 14px; margin-bottom: 8px;">Habit Tracking</p>
    <table style="font-size: 14px; border-collapse: collapse;">
      ${rows.join("\n      ")}
    </table>
  </div>`;
}

export async function buildPersonalizedEmailHtml(
  apiKey: string | undefined,
  entries: ExportEntry[],
  options: {
    name: string;
    periodLabel: string;
    startDate: string;
    endDate: string;
    habitData?: HabitData;
  },
): Promise<string> {
  const stats = computeEntryStats(entries);

  let quip: string | null = null;
  let synopsis: string[] | null = null;

  if (apiKey && entries.length > 0) {
    try {
      const aiContent = await generateEmailAIContent(
        apiKey,
        entries,
        options.periodLabel,
        options.startDate,
        options.endDate,
      );
      quip = aiContent.quip;
      synopsis = aiContent.synopsis;
    } catch (err) {
      console.error("Email body AI generation failed:", err);
    }
  }

  const safeName = escapeHtml(options.name);
  const safePeriod = escapeHtml(options.periodLabel);
  const safeQuip = quip ? escapeHtml(quip) : "Here's your journal for the period.";

  const synopsisHtml =
    synopsis && synopsis.length > 0
      ? `<div style="margin: 20px 0;">
    <p style="color: #1a1a1a; font-weight: 600; font-size: 14px; margin-bottom: 8px;">Period Highlights</p>
    <ul style="color: #4a4a4a; line-height: 1.8; padding-left: 20px; margin: 0;">
      ${synopsis.map((b) => `<li>${escapeHtml(b)}</li>`).join("\n      ")}
    </ul>
  </div>`
      : "";

  const habitHtml = options.habitData
    ? renderHabitStatsHtml(options.habitData, stats.daysJournaled)
    : "";

  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a1a;">Your ${safePeriod} Journal</h2>
  <p style="color: #4a4a4a; line-height: 1.6;">
    Hi ${safeName},
  </p>
  <p style="color: #4a4a4a; line-height: 1.6;">
    ${safeQuip}
  </p>
  ${renderStatsHtml(stats)}
  ${synopsisHtml}
  ${habitHtml}
  <p style="color: #4a4a4a; line-height: 1.6;">
    Your journal PDF for <strong>${formatDate(options.startDate)}</strong> through <strong>${formatDate(options.endDate)}</strong> is attached.
  </p>
  <p style="color: #999; font-size: 13px; margin-top: 30px;">
    You received this email because you have an active ${safePeriod.toLowerCase()} email subscription in Journalizer.
    To unsubscribe, visit your Settings page.
  </p>
</div>`;
}
