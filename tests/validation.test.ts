import { describe, it, expect } from "vitest";
import { z } from "zod";

// Replicate the validation schemas from routes to test them in isolation

const createReminderSchema = z
  .object({
    reminderType: z.enum(["daily", "weekly", "monthly", "smart"]),
    timeOfDay: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "Must be HH:MM format")
      .optional(),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    dayOfMonth: z.number().int().min(1).max(28).optional(),
    smartThreshold: z.number().int().min(1).max(14).optional(),
  })
  .refine(
    (data) => {
      if (data.reminderType === "weekly" && data.dayOfWeek === undefined)
        return false;
      if (data.reminderType === "monthly" && data.dayOfMonth === undefined)
        return false;
      return true;
    },
    { message: "weekly requires dayOfWeek; monthly requires dayOfMonth" }
  );

const verifyPhoneSchema = z.object({
  phoneNumber: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, "Must be E.164 format"),
});

const confirmPhoneSchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/),
});

describe("createReminderSchema", () => {
  it("accepts valid daily reminder", () => {
    const result = createReminderSchema.safeParse({
      reminderType: "daily",
      timeOfDay: "09:00",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid weekly reminder with dayOfWeek", () => {
    const result = createReminderSchema.safeParse({
      reminderType: "weekly",
      timeOfDay: "09:00",
      dayOfWeek: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects weekly reminder without dayOfWeek", () => {
    const result = createReminderSchema.safeParse({
      reminderType: "weekly",
      timeOfDay: "09:00",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid monthly reminder with dayOfMonth", () => {
    const result = createReminderSchema.safeParse({
      reminderType: "monthly",
      timeOfDay: "09:00",
      dayOfMonth: 15,
    });
    expect(result.success).toBe(true);
  });

  it("rejects monthly reminder without dayOfMonth", () => {
    const result = createReminderSchema.safeParse({
      reminderType: "monthly",
      timeOfDay: "09:00",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid smart reminder", () => {
    const result = createReminderSchema.safeParse({
      reminderType: "smart",
      smartThreshold: 3,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid reminderType", () => {
    const result = createReminderSchema.safeParse({
      reminderType: "hourly",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid timeOfDay format", () => {
    const result = createReminderSchema.safeParse({
      reminderType: "daily",
      timeOfDay: "9:00",
    });
    expect(result.success).toBe(false);
  });

  it("rejects dayOfWeek out of range", () => {
    const result = createReminderSchema.safeParse({
      reminderType: "weekly",
      timeOfDay: "09:00",
      dayOfWeek: 7,
    });
    expect(result.success).toBe(false);
  });

  it("rejects dayOfMonth out of range", () => {
    const result = createReminderSchema.safeParse({
      reminderType: "monthly",
      timeOfDay: "09:00",
      dayOfMonth: 29,
    });
    expect(result.success).toBe(false);
  });

  it("rejects smartThreshold out of range", () => {
    const result = createReminderSchema.safeParse({
      reminderType: "smart",
      smartThreshold: 15,
    });
    expect(result.success).toBe(false);
  });
});

describe("verifyPhoneSchema", () => {
  it("accepts valid E.164 phone number", () => {
    expect(
      verifyPhoneSchema.safeParse({ phoneNumber: "+15551234567" }).success
    ).toBe(true);
  });

  it("accepts international number", () => {
    expect(
      verifyPhoneSchema.safeParse({ phoneNumber: "+447911123456" }).success
    ).toBe(true);
  });

  it("rejects number without +", () => {
    expect(
      verifyPhoneSchema.safeParse({ phoneNumber: "15551234567" }).success
    ).toBe(false);
  });

  it("rejects number starting with +0", () => {
    expect(
      verifyPhoneSchema.safeParse({ phoneNumber: "+0551234567" }).success
    ).toBe(false);
  });

  it("rejects too-short number", () => {
    expect(
      verifyPhoneSchema.safeParse({ phoneNumber: "+12345" }).success
    ).toBe(false);
  });
});

describe("confirmPhoneSchema", () => {
  it("accepts 6-digit code", () => {
    expect(
      confirmPhoneSchema.safeParse({ code: "123456" }).success
    ).toBe(true);
  });

  it("rejects 5-digit code", () => {
    expect(
      confirmPhoneSchema.safeParse({ code: "12345" }).success
    ).toBe(false);
  });

  it("rejects non-numeric code", () => {
    expect(
      confirmPhoneSchema.safeParse({ code: "abcdef" }).success
    ).toBe(false);
  });
});
