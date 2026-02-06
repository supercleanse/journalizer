import Anthropic from "@anthropic-ai/sdk";

// Glass contract: failure modes
export { ApiError } from "../lib/errors";

export interface DictionaryTerm {
  term: string;
  category: string; // person, place, brand, pet, other
}

/**
 * Extract proper nouns from journal entry text using Claude.
 */
export async function extractProperNouns(
  apiKey: string,
  text: string
): Promise<DictionaryTerm[]> {
  if (!text || text.trim().length < 10) return [];

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-3-5-haiku-20241022",
    max_tokens: 1024,
    system: `Extract all proper nouns from this journal text. Return ONLY a JSON array of objects.
Format: [{"term": "Aimee", "category": "person"}, {"term": "Jersey Mike's", "category": "place"}]
Categories: person, place, brand, pet, other.
Only include specific proper nouns — not common words, pronouns, or generic terms.
Do not include days of the week, months, or common place words like "home" or "work".
If there are no proper nouns, return an empty array: []
Return ONLY the JSON array. No other text.`,
    messages: [{ role: "user", content: text }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock?.text) return [];

  try {
    const parsed = JSON.parse(textBlock.text.trim());
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item: unknown): item is DictionaryTerm =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as DictionaryTerm).term === "string" &&
        typeof (item as DictionaryTerm).category === "string" &&
        (item as DictionaryTerm).term.trim().length > 0
    );
  } catch {
    return [];
  }
}

/**
 * Format dictionary terms into a Whisper initial_prompt string.
 * Stays under ~200 tokens (roughly 800 chars).
 */
export function formatDictionaryForWhisper(terms: { term: string }[]): string {
  if (terms.length === 0) return "";
  const termList = terms.map((t) => t.term).join(", ");
  const prompt = `Names and places: ${termList}.`;
  // Truncate if too long (~800 chars ≈ 200 tokens)
  if (prompt.length > 800) {
    return prompt.slice(0, 797) + "...";
  }
  return prompt;
}

/**
 * Format dictionary terms for the polish system prompt.
 */
export function formatDictionaryForPolish(terms: { term: string }[]): string {
  if (terms.length === 0) return "";
  return `\nProper nouns to spell correctly: ${terms.map((t) => t.term).join(", ")}`;
}
