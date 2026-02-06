import { describe, it, expect } from "vitest";
import { uint8ArrayToBase64 } from "../src/services/email";

describe("uint8ArrayToBase64", () => {
  it("encodes a simple byte array", () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    expect(uint8ArrayToBase64(bytes)).toBe(btoa("Hello"));
  });

  it("handles empty array", () => {
    expect(uint8ArrayToBase64(new Uint8Array([]))).toBe("");
  });

  it("encodes binary data correctly", () => {
    const bytes = new Uint8Array([0, 127, 255]);
    const result = uint8ArrayToBase64(bytes);
    expect(result).toBe(btoa("\x00\x7f\xff"));
  });
});
