import { describe, it, expect } from "vitest";
import {
  formatDictionaryForWhisper,
  formatDictionaryForPolish,
} from "../src/services/dictionary";

describe("formatDictionaryForWhisper", () => {
  it("returns empty string for no terms", () => {
    expect(formatDictionaryForWhisper([])).toBe("");
  });

  it("formats terms into a sentence", () => {
    const terms = [
      { term: "Aimee" },
      { term: "Jersey Mike's" },
      { term: "Journalizer" },
    ];
    expect(formatDictionaryForWhisper(terms)).toBe(
      "Names and places: Aimee, Jersey Mike's, Journalizer."
    );
  });

  it("truncates long lists to 800 chars", () => {
    const terms = Array.from({ length: 200 }, (_, i) => ({
      term: `LongProperNoun${i}`,
    }));
    const result = formatDictionaryForWhisper(terms);
    expect(result.length).toBeLessThanOrEqual(800);
    expect(result).toMatch(/\.\.\.$/);
  });
});

describe("formatDictionaryForPolish", () => {
  it("returns empty string for no terms", () => {
    expect(formatDictionaryForPolish([])).toBe("");
  });

  it("formats terms for polish hint", () => {
    const terms = [{ term: "Aimee" }, { term: "Blair" }];
    expect(formatDictionaryForPolish(terms)).toBe(
      "\nProper nouns to spell correctly: Aimee, Blair"
    );
  });
});
