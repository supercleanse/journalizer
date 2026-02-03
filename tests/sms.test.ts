import { describe, it, expect } from "vitest";
import { generateVerificationCode } from "../src/services/sms";

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
