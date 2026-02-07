import Anthropic from "@anthropic-ai/sdk";
import type { Env } from "../types/env";

export interface DigestNotificationContent {
  quip: string;
  synopsis: string[];
}

export const DIGEST_CONGRATULATIONS_QUIPS = [
  "Another day documented! Your future self just high-fived you.",
  "Day: captured. Memories: secured. You: awesome.",
  "Look at you, documenting your life like a responsible human.",
  "Your journal just got a little thicker. And a little wiser.",
  "Achievement unlocked: today has been thoroughly chronicled.",
  "Another day in the books. Literally.",
  "Your future memoir just got a new chapter. No pressure.",
  "You journaled today. The internet can't say the same.",
  "Today's memories are now officially tamper-proof.",
  "Congratulations, you out-documented most of humanity today.",
  "Your journal is doing a little happy dance right now.",
  "Day logged. Feelings processed. You're basically a productivity guru.",
  "Another entry in the vault. Your thoughts are safe here.",
  "You showed up for yourself today. Your journal noticed.",
  "Plot twist: you actually journaled today. Character development!",
  "Your journal was starting to worry. Crisis averted.",
  "Today's entry: filed under 'things future you will love reading.'",
  "Not all heroes wear capes. Some just journal consistently.",
  "Documented and dusted. Today is officially on the record.",
  "Your journal's loyalty points just went up.",
  "Another day, another beautifully captured slice of life.",
  "You turned today into words. That's basically magic.",
  "Your life story got a fresh page today. Keep going.",
  "Journal entry complete. Treat yourself to something nice.",
  "Today's thoughts? Saved. Tomorrow's gratitude? Guaranteed.",
  "Your journal is glowing. That's the warm fuzzy feeling of consistency.",
  "One more day preserved. Future you is already grateful.",
  "You didn't let today slip through the cracks. Well done.",
  "Your journal approves of today's life choices.",
  "Daily entry complete. That's what we call a power move.",
  "You just gave future you a gift. They'll never forget it. Literally.",
  "Today: documented. Regret of forgetting: eliminated.",
  "Your thoughts are now safely archived. The cloud has nothing on you.",
  "Another chapter closed, another memory preserved.",
  "Your journal streak is looking mighty fine today.",
  "You wrote today. Somewhere, a blank page breathed a sigh of relief.",
  "Mission accomplished: today has been thoroughly journalized.",
  "Your daily entry is ready. Time to pat yourself on the back.",
  "Consistency looks good on you. So does journaling.",
  "One day at a time, one entry at a time. You're crushing it.",
  "Your journal thanks you for your continued patronage.",
  "Today was worth writing about. And you proved it.",
  "Entry complete. Your future biographer sends their thanks.",
  "You showed up, you wrote, you conquered. Classic you.",
  "Your journal's daily quota: met. Your awesomeness quota: exceeded.",
  "Another day preserved in amber. Well, digital amber.",
  "Your dedication to documenting life is genuinely impressive.",
  "Today's entry is in the bag. Tomorrow's nostalgia is guaranteed.",
  "You and your journal make a great team.",
  "Journaling streak: active. Self-awareness: leveling up.",
];

export function getFallbackDigestQuip(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const startOfYear = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor(
    (d.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)
  );
  return DIGEST_CONGRATULATIONS_QUIPS[
    dayOfYear % DIGEST_CONGRATULATIONS_QUIPS.length
  ];
}

/**
 * Generate or retrieve cached AI content for a digest notification.
 * Returns { quip, synopsis } for use in both Telegram and email.
 */
export async function generateDigestNotificationContent(
  env: Env,
  userId: string,
  date: string,
  digestContent: string
): Promise<DigestNotificationContent> {
  const kvKey = `digest_notif:${userId}:${date}`;

  // Check KV cache
  try {
    const cached = await env.KV.get(kvKey);
    if (cached) return JSON.parse(cached);
  } catch {
    // KV failure — continue to generation/fallback
  }

  // Try AI generation
  if (env.ANTHROPIC_API_KEY) {
    try {
      const content = await callHaikuForDigestNotification(
        env.ANTHROPIC_API_KEY,
        date,
        digestContent
      );
      // Cache with 48h TTL
      await env.KV
        .put(kvKey, JSON.stringify(content), { expirationTtl: 172800 })
        .catch(() => {});
      return content;
    } catch (err) {
      console.error("Digest notification AI generation failed:", err);
    }
  }

  // Fallback: static quip, no synopsis
  return {
    quip: getFallbackDigestQuip(date),
    synopsis: [],
  };
}

async function callHaikuForDigestNotification(
  apiKey: string,
  dateStr: string,
  digestContent: string
): Promise<DigestNotificationContent> {
  const truncated =
    digestContent.length > 2000
      ? digestContent.slice(0, 2000) + "..."
      : digestContent;

  const formatted = new Date(dateStr + "T12:00:00").toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }
  );

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: "claude-3-5-haiku-20241022",
    max_tokens: 256,
    system:
      `You generate fun notification content for a journaling app called Journalizer. ` +
      `The user has just completed their daily journal entry for ${formatted}. Congratulate them!\n\n` +
      `Respond with ONLY a JSON object (no markdown fences):\n` +
      `{"quip": "A fun, cheeky 1-2 sentence congratulations for journaling today", "synopsis": ["bullet 1", "bullet 2", "bullet 3"]}\n\n` +
      `Rules for the quip:\n` +
      `- Congratulate them for journaling today\n` +
      `- Be warm, cheeky, and fun — a bit playful\n` +
      `- Reference something specific from their day if possible\n` +
      `- Keep it to 1-2 sentences\n\n` +
      `Rules for the synopsis:\n` +
      `- 2-3 bullet points summarizing the day's events/themes\n` +
      `- Each bullet under 20 words\n` +
      `- Write in second person ("You explored..." not "Explored...")\n` +
      `- Cover the breadth of the day, not just one event`,
    messages: [{ role: "user", content: truncated || "(no text entries)" }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock?.text)
    throw new Error("Empty AI response for digest notification");

  const raw = textBlock.text
    .replace(/^```(?:json)?\n?|\n?```$/g, "")
    .trim();
  const parsed = JSON.parse(raw);
  if (typeof parsed.quip !== "string" || !Array.isArray(parsed.synopsis)) {
    throw new Error("Invalid AI response structure for digest notification");
  }

  return {
    quip: parsed.quip.length > 300 ? parsed.quip.slice(0, 300) : parsed.quip,
    synopsis: parsed.synopsis.slice(0, 3).map(String),
  };
}

/**
 * Format a Telegram message with quip and synopsis.
 */
export function formatDigestTelegramMessage(
  date: string,
  content: DigestNotificationContent
): string {
  let msg = `${content.quip}\n\nYour daily entry for ${date} is ready!`;
  if (content.synopsis.length > 0) {
    msg += "\n\nToday's highlights:";
    for (const bullet of content.synopsis) {
      msg += `\n• ${bullet}`;
    }
  }
  return msg;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Build an HTML email for the digest notification.
 */
export function buildDigestNotificationEmailHtml(
  name: string,
  date: string,
  content: DigestNotificationContent
): string {
  const formatted = new Date(date + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  const synopsisHtml =
    content.synopsis.length > 0
      ? `<div style="margin: 24px 0; padding: 16px; background: #f8fafc; border-radius: 8px;">
      <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #475569;">Today's Highlights</p>
      <ul style="margin: 0; padding-left: 20px; color: #334155; font-size: 14px; line-height: 1.6;">
        ${content.synopsis.map((b) => `<li style="margin-bottom: 4px;">${escapeHtml(b)}</li>`).join("\n        ")}
      </ul>
    </div>`
      : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background: #f1f5f9;">
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 20px;">
  <div style="background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h2 style="margin: 0 0 20px 0; font-size: 20px; color: #0f172a;">Daily Entry Complete</h2>
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.5;">Hi ${escapeHtml(name)},</p>
    <p style="margin: 0 0 8px 0; font-size: 15px; color: #334155; line-height: 1.5;">${escapeHtml(content.quip)}</p>
    ${synopsisHtml}
    <p style="margin: 0; font-size: 14px; color: #64748b; line-height: 1.5;">Your daily entry for <strong>${formatted}</strong> is ready to view in Journalizer.</p>
  </div>
  <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 24px; line-height: 1.5;">
    You received this because you have digest email notifications enabled.<br>
    To turn them off, visit your Settings page in Journalizer.
  </p>
</div>
</body>
</html>`;
}
