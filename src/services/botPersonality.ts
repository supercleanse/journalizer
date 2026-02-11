import Anthropic from "@anthropic-ai/sdk";

// Glass contract: failure modes
export { ApiError, RateLimited } from "../lib/errors";

export type BotPersonality = "encouraging" | "drill_sergeant" | "chill" | "coach";

interface HabitResponseContext {
  habitName: string;
  completed: boolean;
  currentStreak: number;
  consecutiveMisses: number;
  personality: BotPersonality;
}

interface JournalReminderContext {
  journalStreak: number;
  daysSinceLastEntry: number;
  personality: BotPersonality;
}

const PERSONALITY_PROMPTS: Record<BotPersonality, string> = {
  encouraging:
    "You are a warm, supportive friend. Celebrate successes enthusiastically. On failures, be gentle and encouraging — never shame. Use positive language.",
  drill_sergeant:
    "You are a tough drill sergeant. On success, give grudging, minimal acknowledgment ('Adequate. Don't get cocky.'). On failure, be aggressive and demanding — bark short commands. Never use expletives. Keep it under 2 sentences.",
  chill:
    "You are a calm, zen master. Be serene and non-judgmental. Make mindful observations. No urgency. Use peaceful language. Think Buddhist monk meets surfer.",
  coach:
    "You are a firm but supportive performance coach. Be goal-oriented and strategic. Celebrate wins genuinely but briefly. On losses, give actionable advice. Be direct.",
};

/**
 * Generate an AI-powered habit response using the user's bot personality.
 */
export async function generateHabitResponse(
  apiKey: string,
  context: HabitResponseContext
): Promise<string> {
  try {
    const client = new Anthropic({ apiKey });

    const streakInfo = context.completed
      ? context.currentStreak > 1
        ? `They are on a ${context.currentStreak}-day streak.`
        : "They just completed this habit."
      : context.consecutiveMisses > 1
        ? `They have missed this habit ${context.consecutiveMisses} days in a row.`
        : "They missed this habit today.";

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      temperature: 0.8,
      system: PERSONALITY_PROMPTS[context.personality],
      messages: [
        {
          role: "user",
          content: `The user just answered "${context.completed ? "yes" : "no"}" for their habit "${context.habitName}". ${streakInfo} Give a brief response (1-2 sentences max).`,
        },
      ],
    });

    const text = response.content[0];
    if (text.type === "text") {
      return text.text;
    }
    return getStaticHabitResponse(context);
  } catch {
    return getStaticHabitResponse(context);
  }
}

/**
 * Generate an AI-powered journal reminder using the user's bot personality.
 */
export async function generateJournalReminderMessage(
  apiKey: string,
  context: JournalReminderContext
): Promise<string> {
  try {
    const client = new Anthropic({ apiKey });

    const streakInfo =
      context.daysSinceLastEntry === 0
        ? `They already journaled today and have a ${context.journalStreak}-day streak.`
        : context.daysSinceLastEntry === 1
          ? `They journaled yesterday. ${context.journalStreak > 0 ? `They have a ${context.journalStreak}-day streak going.` : ""}`
          : `It's been ${context.daysSinceLastEntry} days since their last journal entry.`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      temperature: 0.8,
      system: PERSONALITY_PROMPTS[context.personality],
      messages: [
        {
          role: "user",
          content: `Send a brief journal reminder to the user. ${streakInfo} Motivate them to write today in 1-2 sentences. Don't use quotes or greetings like "Hey".`,
        },
      ],
    });

    const text = response.content[0];
    if (text.type === "text") {
      return text.text;
    }
    return getStaticJournalReminder(context);
  } catch {
    return getStaticJournalReminder(context);
  }
}

/**
 * Static fallback for habit responses when AI is unavailable.
 */
export function getStaticHabitResponse(context: HabitResponseContext): string {
  const { completed, currentStreak, consecutiveMisses, personality } = context;

  if (completed) {
    if (currentStreak > 1) {
      switch (personality) {
        case "drill_sergeant":
          return `${currentStreak} days. Acceptable. Keep moving.`;
        case "chill":
          return `${currentStreak} days flowing. Beautiful.`;
        case "coach":
          return `${currentStreak}-day streak! Solid consistency.`;
        default:
          return `Amazing! ${currentStreak} days in a row! Keep it up!`;
      }
    }
    switch (personality) {
      case "drill_sergeant":
        return "Noted. Don't let it go to your head.";
      case "chill":
        return "Nice. One moment at a time.";
      case "coach":
        return "Good work. Let's build on this.";
      default:
        return "Great job! Every day counts!";
    }
  }

  // Not completed
  if (consecutiveMisses > 3) {
    switch (personality) {
      case "drill_sergeant":
        return `${consecutiveMisses} days missed. Unacceptable. Fix it tomorrow.`;
      case "chill":
        return "It's all part of the journey. Tomorrow is fresh.";
      case "coach":
        return `${consecutiveMisses} days off track. Let's reset and commit to tomorrow.`;
      default:
        return "That's okay! Tomorrow is a new opportunity. You've got this!";
    }
  }
  switch (personality) {
    case "drill_sergeant":
      return "Missed. Get it together.";
    case "chill":
      return "No worries. The path is always there.";
    case "coach":
      return "Noted. What can we do differently tomorrow?";
    default:
      return "No worries! Tomorrow's another chance.";
  }
}

/**
 * Static fallback for journal reminders when AI is unavailable.
 */
export function getStaticJournalReminder(context: JournalReminderContext): string {
  const { journalStreak, daysSinceLastEntry, personality } = context;

  if (daysSinceLastEntry === 0) {
    switch (personality) {
      case "drill_sergeant":
        return "You already logged today. Good. Dismissed.";
      case "chill":
        return "You've already written today. Enjoy the moment.";
      case "coach":
        return "Already journaled today. Keep the momentum going!";
      default:
        return "You've already journaled today! Amazing dedication!";
    }
  }

  if (journalStreak > 0 && daysSinceLastEntry <= 1) {
    switch (personality) {
      case "drill_sergeant":
        return `${journalStreak}-day streak. Don't break it. Write now.`;
      case "chill":
        return `${journalStreak} days of reflection. The flow continues when you're ready.`;
      case "coach":
        return `${journalStreak}-day streak on the line. Take 2 minutes to write.`;
      default:
        return `You're on a ${journalStreak}-day streak! Keep it going — what happened today?`;
    }
  }

  if (daysSinceLastEntry > 3) {
    switch (personality) {
      case "drill_sergeant":
        return `${daysSinceLastEntry} days AWOL. Report in. Now.`;
      case "chill":
        return `It's been ${daysSinceLastEntry} days. Your journal is here whenever you're ready.`;
      case "coach":
        return `${daysSinceLastEntry} days since your last entry. Let's get back on track — even one sentence counts.`;
      default:
        return `It's been ${daysSinceLastEntry} days — no pressure, but we'd love to hear from you! Even a quick note counts.`;
    }
  }

  switch (personality) {
    case "drill_sergeant":
      return "Time to write. No excuses.";
    case "chill":
      return "A moment to reflect — what's on your mind?";
    case "coach":
      return "Quick check-in: what's one thing worth noting today?";
    default:
      return "Time for your daily journal! What's on your mind?";
  }
}
