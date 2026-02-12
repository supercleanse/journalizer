import Anthropic from "@anthropic-ai/sdk";
import type { Env } from "../types/env";
import { PERSONALITY_PROMPTS, type BotPersonality } from "./botPersonality";

export const FALLBACK_QUIPS: Record<BotPersonality, string[]> = {
  encouraging: [
    "Your journal misses you. Don't leave it on read.",
    "Future you will thank present you for writing this down.",
    "Your thoughts called. They'd like to be written down.",
    "Plot twist: today is worth remembering.",
    "Your journal has been staring at a blank page all day.",
    "Even a sentence counts. Your future biographer will appreciate it.",
    "Somewhere, a blank page is crying. Be a hero.",
    "Today's memories have a 24-hour shelf life. Better write them down.",
    "Your journal won't judge you. Probably.",
    "Unwritten thoughts eventually become unreliable narrators.",
    "Quick, before today becomes a fuzzy memory.",
    "Your brain stores thousands of thoughts. Your journal stores the good ones.",
    "Breaking news: something interesting happened to you today.",
    "This is your daily reminder that you're interesting enough to journal about.",
    "Pen to paper. Fingers to keyboard. Thoughts to somewhere permanent.",
    "Don't let today ghost your journal.",
    "Even one line beats zero lines. Math checks out.",
    "Your journal has trust issues from being ignored yesterday.",
    "Today called. It wants to be documented.",
    "Journaling: cheaper than therapy, quieter than venting to friends.",
    "Your future self just sent a thank-you note from the future.",
    "You've already had at least one thought worth writing down today.",
    "A moment of your time for a lifetime of memories.",
    "Your journal called a meeting. Attendance: mandatory. Dress code: pajamas.",
    "Behind every great person is a slightly neglected journal.",
    "The world needs your version of today. Write it down.",
    "Your journal: the only place where rambling is encouraged.",
    "If a day happens and nobody journals it, did it even count?",
    "Friendly reminder: autocorrect can't fix an unwritten entry.",
    "Your thoughts deserve better than disappearing into the void.",
    "Daily journaling: now with 100% less procrastination. Starting now.",
    "You're one entry away from a journaling streak.",
    "Your journal has separation anxiety. Please visit.",
    "News flash: you did something worth writing about today.",
    "Write now, thank yourself later. Literally.",
    "Your journal is giving you the silent treatment until you write.",
    "Today is tomorrow's nostalgia. Capture it.",
    "Even Shakespeare started with a blank page. Your turn.",
    "Your journal has been refreshing all day waiting for you.",
    "Think of journaling as texting yourself in the future.",
    "One small entry for you, one giant leap for self-reflection.",
    "Your journal: where it's totally fine to talk about yourself.",
    "The best time to journal was this morning. Second best: right now.",
    "Your thoughts are limited edition. Don't let them sell out.",
    "Warning: unjournaled thoughts may cause forgetting.",
    "Your future memoir needs raw material. Start here.",
    "Today has some stories. Your journal has some empty pages. Perfect match.",
    "No filter needed. Just write.",
    "Your journal: zero followers, maximum honesty.",
    "Capture today before it becomes a vague hand gesture.",
  ],
  drill_sergeant: [
    "Report in. Now.",
    "Your journal is waiting. Don't make it wait longer.",
    "No entry today? Unacceptable.",
    "Write. That's an order.",
    "Your thoughts won't document themselves.",
    "Zero entries today. Fix that.",
    "Time to write. Move it.",
    "The journal doesn't fill itself.",
    "Entry due. No excuses.",
    "You call that journaling? Write something.",
    "Today's report is overdue.",
    "Get in there and write.",
    "Blank pages are a failure. Fill one.",
    "Your journal needs you. Show up.",
    "Discipline means writing even when you don't feel like it.",
  ],
  chill: [
    "Whenever you're ready, your journal is here.",
    "A quiet moment to reflect. No rush.",
    "Your thoughts are gently waiting to be captured.",
    "The page is open. Come as you are.",
    "A few words, whenever the mood strikes.",
    "Your journal holds space for you. Always.",
    "Let the day's moments flow onto the page.",
    "No pressure. Just presence.",
    "A breath, a thought, a sentence. That's enough.",
    "Your journal is a calm harbor. Visit when you like.",
    "Today's reflections are ready whenever you are.",
    "The pen doesn't judge. Neither does the page.",
    "A gentle nudge to write. Or not. It's all good.",
    "Your thoughts are like clouds. Let a few settle on paper.",
    "Peace begins with awareness. Journaling helps.",
  ],
  coach: [
    "Quick check-in: what's worth documenting today?",
    "Today's review starts with one sentence. Go.",
    "Building the journaling habit. Today's rep is waiting.",
    "What did you learn today? Write it down.",
    "Accountability starts with writing it out.",
    "One entry a day compounds into real self-awareness.",
    "Time for your daily debrief. What happened?",
    "Journal time. What's the highlight?",
    "Your growth depends on reflection. Start writing.",
    "Track the day. Spot the patterns. That's progress.",
    "A few minutes now saves hours of forgotten context later.",
    "Champions review their day. Your turn.",
    "What went well? What didn't? Write it out.",
    "Today's data point: captured when you write it down.",
    "Reflection is the ultimate performance tool. Use it.",
  ],
};

/**
 * Get the daily quip for reminder messages.
 * Checks KV cache first, then generates via AI, falls back to static list.
 */
export async function getDailyQuip(env: Env, personality: BotPersonality = "encouraging"): Promise<string> {
  const today = new Date().toISOString().split("T")[0];
  const kvKey = `reminder_quip:${today}:${personality}`;

  // Check KV cache
  try {
    const cached = await env.KV.get(kvKey);
    if (cached) return cached;
  } catch {
    // KV failure — continue to generation/fallback
  }

  // Try AI generation
  if (env.ANTHROPIC_API_KEY) {
    try {
      const quip = await generateQuip(env.ANTHROPIC_API_KEY, today, personality);
      // Cache with 48h TTL
      await env.KV.put(kvKey, quip, { expirationTtl: 172800 }).catch(() => {});
      return quip;
    } catch (err) {
      console.error("Reminder quip AI generation failed:", err);
    }
  }

  // Fallback: static list rotated by day-of-year
  return getFallbackQuip(today, personality);
}

async function generateQuip(apiKey: string, dateStr: string, personality: BotPersonality): Promise<string> {
  const d = new Date(dateStr + "T00:00:00Z");
  const formatted = d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  const personalityInstruction = PERSONALITY_PROMPTS[personality];

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-3-5-haiku-20241022",
    max_tokens: 64,
    system:
      `You write short one-liner quips for a journaling app called Journalizer. ` +
      `${personalityInstruction} ` +
      "Rules: No vulgarity. Under 15 words. " +
      "Just output the quip text directly, no quotes, no punctuation framing, no preamble.",
    messages: [
      {
        role: "user",
        content: `Generate a unique journaling reminder quip for ${formatted}.`,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock?.text) throw new Error("Empty AI response for reminder quip");

  // Guard against unexpectedly long responses
  const quip = textBlock.text.trim();
  return quip.length > 200 ? quip.slice(0, 200) : quip;
}

export function getFallbackQuip(dateStr: string, personality: BotPersonality = "encouraging"): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const startOfYear = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor(
    (d.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)
  );
  const quips = FALLBACK_QUIPS[personality];
  return quips[dayOfYear % quips.length];
}
