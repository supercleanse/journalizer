import { describe, it, expect, vi } from "vitest";
import { transcribeAudio } from "../src/services/transcription";
import { EmptyTranscript } from "../src/lib/errors";

describe("transcribeAudio", () => {
  it("returns transcript from Whisper result", async () => {
    const mockAi = {
      run: vi.fn().mockResolvedValue({
        text: "Hello, this is a test.",
        word_count: 5,
        words: [
          { word: "Hello", start: 0, end: 0.5 },
          { word: "this", start: 0.6, end: 0.8 },
          { word: "is", start: 0.9, end: 1.0 },
          { word: "a", start: 1.1, end: 1.2 },
          { word: "test", start: 1.3, end: 1.8 },
        ],
      }),
    } as unknown as Ai;

    const buffer = new ArrayBuffer(100);
    const result = await transcribeAudio(mockAi, buffer);

    expect(result.transcript).toBe("Hello, this is a test.");
    expect(result.words).toBe(5);
    expect(result.durationSeconds).toBe(1.8);
    expect(result.confidence).toBe(1.0);
    expect(mockAi.run).toHaveBeenCalledWith("@cf/openai/whisper", {
      audio: expect.any(Array),
    });
  });

  it("throws EmptyTranscript when text is empty", async () => {
    const mockAi = {
      run: vi.fn().mockResolvedValue({ text: "", word_count: 0 }),
    } as unknown as Ai;

    const buffer = new ArrayBuffer(100);
    await expect(transcribeAudio(mockAi, buffer)).rejects.toThrow(
      EmptyTranscript
    );
  });

  it("throws EmptyTranscript when text is whitespace-only", async () => {
    const mockAi = {
      run: vi.fn().mockResolvedValue({ text: "   ", word_count: 0 }),
    } as unknown as Ai;

    const buffer = new ArrayBuffer(100);
    await expect(transcribeAudio(mockAi, buffer)).rejects.toThrow(
      EmptyTranscript
    );
  });

  it("falls back to words array length when word_count is missing", async () => {
    const mockAi = {
      run: vi.fn().mockResolvedValue({
        text: "Hello world",
        words: [
          { word: "Hello", start: 0, end: 0.5 },
          { word: "world", start: 0.6, end: 1.0 },
        ],
      }),
    } as unknown as Ai;

    const buffer = new ArrayBuffer(100);
    const result = await transcribeAudio(mockAi, buffer);
    expect(result.words).toBe(2);
    expect(result.durationSeconds).toBe(1.0);
  });

  it("handles missing words array", async () => {
    const mockAi = {
      run: vi.fn().mockResolvedValue({
        text: "Hello world",
        word_count: 2,
      }),
    } as unknown as Ai;

    const buffer = new ArrayBuffer(100);
    const result = await transcribeAudio(mockAi, buffer);
    expect(result.durationSeconds).toBe(0);
    expect(result.words).toBe(2);
  });
});
