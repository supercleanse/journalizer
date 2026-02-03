// Legacy SMS service — retained for Glass spec compatibility.
// Messaging now handled by src/services/telegram.ts.

// Glass contract: failure modes (functions return boolean)
export { TwilioAPIError, InvalidSignature } from "../lib/errors";

/**
 * Generate a 6-digit verification code.
 */
export function generateVerificationCode(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const num = ((bytes[0] << 16) | (bytes[1] << 8) | bytes[2]) % 900000 + 100000;
  return num.toString();
}

export const messageTemplates = {
  verificationCode: (code: string) =>
    `Your Journalizer verification code is: ${code}`,
  entryConfirmation: () => "Got it! Your journal entry has been saved.",
  reminderDaily: () =>
    "Hey! What happened today? Just reply to this message.",
  reminderNudge: (days: number) =>
    `It's been ${days} day${days === 1 ? "" : "s"} since your last entry. No pressure, but we're here when you're ready!`,
};
