import { describe, it, expect } from "vitest";
import { generateVerificationCode, twimlResponse } from "../src/services/sms";

describe("generateVerificationCode", () => {
  it("returns a 6-digit string", () => {
    const code = generateVerificationCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("returns a number >= 100000", () => {
    for (let i = 0; i < 100; i++) {
      const num = parseInt(generateVerificationCode(), 10);
      expect(num).toBeGreaterThanOrEqual(100000);
      expect(num).toBeLessThanOrEqual(999999);
    }
  });

  it("generates different codes on successive calls", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      codes.add(generateVerificationCode());
    }
    // With random generation, we should get multiple unique codes
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("twimlResponse", () => {
  it("returns a Response with XML content type", () => {
    const res = twimlResponse("Hello");
    expect(res.headers.get("Content-Type")).toBe("text/xml");
  });

  it("wraps message in TwiML XML", async () => {
    const res = twimlResponse("Test message");
    const body = await res.text();
    expect(body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(body).toContain("<Response>");
    expect(body).toContain("<Message>Test message</Message>");
    expect(body).toContain("</Response>");
  });

  it("escapes XML special characters", async () => {
    const res = twimlResponse('Hello <world> & "friends"');
    const body = await res.text();
    expect(body).toContain("&lt;world&gt;");
    expect(body).toContain("&amp;");
    expect(body).toContain("&quot;friends&quot;");
  });
});
