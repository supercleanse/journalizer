import { describe, it, expect, vi } from "vitest";
import { transcribeAudio, cleanFillerWords } from "../src/services/transcription";
import { EmptyTranscript } from "../src/lib/errors";

describe("transcribeAudio", () => {
  it("returns transcript from Whisper result", async () => {
    const mockAi = {
      run: vi.fn().mockResolvedValue({
        text: "Hello, this is a test.",
        word_count: 5,
        transcription_info: { duration: 1.8 },
        segments: [
          {
            words: [
              { word: "Hello", start: 0, end: 0.5 },
              { word: "this", start: 0.6, end: 0.8 },
              { word: "is", start: 0.9, end: 1.0 },
              { word: "a", start: 1.1, end: 1.2 },
              { word: "test", start: 1.3, end: 1.8 },
            ],
          },
        ],
      }),
    } as unknown as Ai;

    const buffer = new ArrayBuffer(100);
    const result = await transcribeAudio(mockAi, buffer);

    expect(result.transcript).toBe("Hello, this is a test.");
    expect(result.words).toBe(5);
    expect(result.durationSeconds).toBe(1.8);
    expect(result.confidence).toBe(1.0);
    expect(mockAi.run).toHaveBeenCalledWith(
      "@cf/openai/whisper-large-v3-turbo",
      expect.objectContaining({
        audio: expect.any(String),
        language: "en",
        vad_filter: true,
      })
    );
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

  it("falls back to segment words for duration when transcription_info is missing", async () => {
    const mockAi = {
      run: vi.fn().mockResolvedValue({
        text: "Hello world",
        word_count: 2,
        segments: [
          {
            words: [
              { word: "Hello", start: 0, end: 0.5 },
              { word: "world", start: 0.6, end: 1.0 },
            ],
          },
        ],
      }),
    } as unknown as Ai;

    const buffer = new ArrayBuffer(100);
    const result = await transcribeAudio(mockAi, buffer);
    expect(result.words).toBe(2);
    expect(result.durationSeconds).toBe(1.0);
  });

  it("handles missing segments and transcription_info", async () => {
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

  it("passes initial_prompt when provided", async () => {
    const mockAi = {
      run: vi.fn().mockResolvedValue({
        text: "Hello Aimee",
        word_count: 2,
        transcription_info: { duration: 0.8 },
      }),
    } as unknown as Ai;

    const buffer = new ArrayBuffer(100);
    await transcribeAudio(mockAi, buffer, {
      initialPrompt: "Names and places: Aimee.",
    });

    expect(mockAi.run).toHaveBeenCalledWith(
      "@cf/openai/whisper-large-v3-turbo",
      expect.objectContaining({
        initial_prompt: "Names and places: Aimee.",
      })
    );
  });

  it("removes filler words from transcript", async () => {
    const mockAi = {
      run: vi.fn().mockResolvedValue({
        text: "Um, I went to, uh, the store and, like, bought some milk.",
        word_count: 12,
        transcription_info: { duration: 3.5 },
      }),
    } as unknown as Ai;

    const buffer = new ArrayBuffer(100);
    const result = await transcribeAudio(mockAi, buffer);
    expect(result.transcript).toBe("I went to, the store and, bought some milk.");
  });
});

describe("cleanFillerWords", () => {
  it("removes um/uh/erm/ah/hmm between commas", () => {
    expect(cleanFillerWords("I went to, um, the store")).toBe("I went to, the store");
    expect(cleanFillerWords("It was, uh, really great")).toBe("It was, really great");
    expect(cleanFillerWords("So, erm, that happened")).toBe("So, that happened");
    expect(cleanFillerWords("Well, hmm, I think so")).toBe("Well, I think so");
  });

  it("removes fillers at start of text", () => {
    expect(cleanFillerWords("Um, I went to the store")).toBe("I went to the store");
    expect(cleanFillerWords("Uh I think so")).toBe("I think so");
    expect(cleanFillerWords("Ah, that makes sense")).toBe("That makes sense");
  });

  it("removes fillers after sentence boundaries", () => {
    expect(cleanFillerWords("I went home. Um, then I ate dinner.")).toBe("I went home. Then I ate dinner.");
    expect(cleanFillerWords("Great idea! Uh, let me think.")).toBe("Great idea! Let me think.");
  });

  it("removes 'like' only in filler positions", () => {
    expect(cleanFillerWords("I was, like, really tired")).toBe("I was, really tired");
    expect(cleanFillerWords("Like, I don't even know")).toBe("I don't even know");
    expect(cleanFillerWords("I like coffee")).toBe("I like coffee");
    expect(cleanFillerWords("It looks like rain")).toBe("It looks like rain");
  });

  it("removes 'you know' in filler positions", () => {
    expect(cleanFillerWords("I was, you know, really tired")).toBe("I was, really tired");
    expect(cleanFillerWords("You know, it was great")).toBe("It was great");
  });

  it("removes 'I mean' in filler positions", () => {
    expect(cleanFillerWords("I mean, it was fine")).toBe("It was fine");
    expect(cleanFillerWords("That was odd. I mean, really odd.")).toBe("That was odd. Really odd.");
  });

  it("preserves text without fillers", () => {
    const text = "I went to the store and bought some milk.";
    expect(cleanFillerWords(text)).toBe(text);
  });

  it("handles multiple fillers in one sentence", () => {
    expect(cleanFillerWords("Um, so I was, like, going to, uh, the park."))
      .toBe("So I was, going to, the park.");
  });

  it("re-capitalizes after removing sentence-start fillers", () => {
    expect(cleanFillerWords("Um, the cat sat down.")).toBe("The cat sat down.");
    expect(cleanFillerWords("OK. Uh, the next thing.")).toBe("OK. The next thing.");
  });
});
