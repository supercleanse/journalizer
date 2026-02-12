import Anthropic from "@anthropic-ai/sdk";
import type { Env } from "../types/env";
import { PERSONALITY_PROMPTS, type BotPersonality } from "./botPersonality";

export interface DigestNotificationContent {
  quip: string;
  synopsis: string[];
  accountability: string | null;
}

export const DIGEST_CONGRATULATIONS_QUIPS: Record<BotPersonality, string[]> = {
  encouraging: [
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
  ],
  drill_sergeant: [
    "Day logged. Acceptable work.",
    "Entry filed. Don't get comfortable.",
    "You showed up. That's the minimum. Keep it up.",
    "Report received. Continue operations.",
    "Another day documented. Don't break the streak.",
    "Entry complete. No excuses tomorrow either.",
    "Logged and noted. Consistency is discipline.",
    "Day recorded. That's what I expect.",
    "Your daily report is in. Adequate.",
    "Entry secured. Maintain this standard.",
    "Written and filed. Now do it again tomorrow.",
    "Day documented. Don't let me catch you slacking.",
    "Record complete. Mission continues.",
    "Today's debrief is logged. Dismissed.",
    "Entry received. Standards maintained.",
  ],
  chill: [
    "Another day gently captured. Beautiful.",
    "Your thoughts found their place. All is well.",
    "Day observed and recorded. Peace.",
    "The day's moments are safely resting now.",
    "Another page of your story, naturally unfolding.",
    "Breathe — today is safely written down.",
    "Your words settled into place. Lovely.",
    "One more day flowing through your journal.",
    "The day's energy is captured. Rest easy.",
    "Your reflections are home. Nice.",
    "Today's chapter, gently closed.",
    "Words found their resting place. Namaste.",
    "Another day observed without judgment.",
    "Your journal received today gracefully.",
    "The present moment, preserved.",
  ],
  coach: [
    "Entry logged — solid execution today.",
    "Great work showing up. Consistency wins.",
    "Day documented. That's how streaks are built.",
    "Another entry in the bank. Keep compounding.",
    "Good discipline. Your future self will thank you.",
    "Entry complete. One more rep in the journal gym.",
    "Documented and done. That's a win today.",
    "Day captured. Progress is in the process.",
    "Strong showing — keep the momentum rolling.",
    "Entry filed. You're building something here.",
    "Today's entry is locked in. Well done.",
    "Consistent effort pays off. Entry complete.",
    "Another day, another step forward. Logged.",
    "Great accountability. Keep it going.",
    "Entry saved. That's what commitment looks like.",
  ],
};

export function getFallbackDigestQuip(dateStr: string, personality: BotPersonality = "encouraging"): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const startOfYear = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor(
    (d.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)
  );
  const quips = DIGEST_CONGRATULATIONS_QUIPS[personality];
  return quips[dayOfYear % quips.length];
}

/**
 * Generate or retrieve cached AI content for a digest notification.
 * Returns { quip, synopsis, accountability } for use in both Telegram and email.
 */
export async function generateDigestNotificationContent(
  env: Env,
  userId: string,
  date: string,
  digestContent: string,
  personality: BotPersonality = "encouraging"
): Promise<DigestNotificationContent> {
  const kvKey = `digest_notif:${userId}:${date}:${personality}`;

  // Check KV cache
  try {
    const cached = await env.KV.get(kvKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (typeof parsed.quip === "string" && Array.isArray(parsed.synopsis)) {
        return { ...parsed, accountability: parsed.accountability ?? null };
      }
    }
  } catch {
    // KV failure — continue to generation/fallback
  }

  // Try AI generation
  if (env.ANTHROPIC_API_KEY) {
    try {
      const content = await callHaikuForDigestNotification(
        env.ANTHROPIC_API_KEY,
        date,
        digestContent,
        personality
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

  // Fallback: static quip, no synopsis, no accountability
  return {
    quip: getFallbackDigestQuip(date, personality),
    synopsis: [],
    accountability: null,
  };
}

async function callHaikuForDigestNotification(
  apiKey: string,
  dateStr: string,
  digestContent: string,
  personality: BotPersonality
): Promise<DigestNotificationContent> {
  const truncated =
    digestContent.length > 2000
      ? digestContent.slice(0, 2000) + "..."
      : digestContent;

  const formatted = new Date(dateStr + "T12:00:00Z").toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }
  );

  const personalityInstruction = PERSONALITY_PROMPTS[personality];

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: "claude-3-5-haiku-20241022",
    max_tokens: 350,
    system:
      `You generate notification content for a journaling app called Journalizer. ` +
      `${personalityInstruction}\n\n` +
      `The user has just completed their daily journal entry for ${formatted}. Congratulate them!\n\n` +
      `Respond with ONLY a JSON object (no markdown fences):\n` +
      `{"quip": "A 1-2 sentence congratulations for journaling today", "synopsis": ["bullet 1", "bullet 2", "bullet 3"], "accountability": "One sentence connecting journal themes to habits/growth, or null if nothing noteworthy"}\n\n` +
      `Rules for the quip:\n` +
      `- Congratulate them for journaling today\n` +
      `- Match the personality described above\n` +
      `- Reference something specific from their day if possible\n` +
      `- Keep it to 1-2 sentences\n\n` +
      `Rules for the synopsis:\n` +
      `- 2-3 bullet points summarizing the day's events/themes\n` +
      `- Each bullet under 20 words\n` +
      `- Write in second person ("You explored..." not "Explored...")\n` +
      `- Cover the breadth of the day, not just one event\n\n` +
      `Rules for accountability:\n` +
      `- One sentence connecting what they wrote about to personal growth or habits\n` +
      `- Set to null if the journal content doesn't lend itself to an observation\n` +
      `- Match the personality tone`,
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
    synopsis: parsed.synopsis.slice(0, 3).map((s: unknown) => {
      const str = String(s);
      return str.length > 200 ? str.slice(0, 200) : str;
    }),
    accountability: typeof parsed.accountability === "string" && parsed.accountability.length > 0
      ? (parsed.accountability.length > 300 ? parsed.accountability.slice(0, 300) : parsed.accountability)
      : null,
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
      msg += `\n\u2022 ${bullet}`;
    }
  }
  if (content.accountability) {
    msg += `\n\n${content.accountability}`;
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

  const accountabilityHtml = content.accountability
    ? `<div style="margin: 16px 0; padding: 12px 16px; background: #f0fdf4; border-left: 3px solid #22c55e; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px; color: #15803d; line-height: 1.5;">${escapeHtml(content.accountability)}</p>
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
    ${accountabilityHtml}
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
