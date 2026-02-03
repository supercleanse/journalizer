import type { Env } from "../types/env";

// Glass contract: failure modes (functions return boolean)
export { TwilioAPIError, InvalidSignature } from "../lib/errors";

/**
 * Validate Twilio webhook signature.
 * Uses the X-Twilio-Signature header to verify the request is from Twilio.
 */
export async function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): Promise<boolean> {
  // Build the data string: URL + sorted params concatenated
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }

  // HMAC-SHA1 signature
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));

  return expected === signature;
}

/**
 * Send an SMS via Twilio REST API.
 */
export async function sendSMS(
  env: Env,
  to: string,
  body: string
): Promise<boolean> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`),
    },
    body: new URLSearchParams({
      From: env.TWILIO_PHONE_NUMBER,
      To: to,
      Body: body,
    }),
  });

  return response.ok;
}

/**
 * Generate a 6-digit verification code.
 */
export function generateVerificationCode(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const num = ((bytes[0] << 16) | (bytes[1] << 8) | bytes[2]) % 900000 + 100000;
  return num.toString();
}

/**
 * Return TwiML XML response for Twilio webhook.
 */
export function twimlResponse(message: string): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(message)}</Message>
</Response>`;

  return new Response(xml, {
    headers: { "Content-Type": "text/xml" },
  });
}

// ── Message Templates ──────────────────────────────────────────────

export const messageTemplates = {
  verificationCode: (code: string) =>
    `Your Journalizer verification code is: ${code}`,
  entryConfirmation: () => "Got it! Your journal entry has been saved.",
  reminderDaily: () =>
    "Hey! What happened today? Just reply to this message.",
  reminderNudge: (days: number) =>
    `It's been ${days} day${days === 1 ? "" : "s"} since your last entry. No pressure, but we're here when you're ready!`,
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
