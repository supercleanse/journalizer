// Glass contract: failure modes
export { ResendAPIError } from "../lib/errors";
import { ResendAPIError } from "../lib/errors";

export interface EmailAttachment {
  filename: string;
  content: string; // base64-encoded
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

/**
 * Send an email via the Resend REST API.
 */
export async function sendEmail(
  apiKey: string,
  fromEmail: string,
  options: SendEmailOptions
): Promise<{ id: string }> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ResendAPIError(`Resend API error (${response.status}): ${body}`);
  }

  return response.json() as Promise<{ id: string }>;
}

/**
 * Convert a Uint8Array to a base64 string.
 * Used to encode PDF attachments for the Resend API.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
