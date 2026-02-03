import type { Env } from "../types/env";

// Glass contract: failure modes (functions return boolean)
export { TelegramAPIError, InvalidSignature } from "../lib/errors";

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    date: number;
    text?: string;
    photo?: { file_id: string; file_size?: number }[];
    voice?: { file_id: string; duration: number; mime_type?: string };
    video?: { file_id: string; duration: number; mime_type?: string };
    audio?: { file_id: string; duration: number; mime_type?: string };
    document?: { file_id: string; file_name?: string; mime_type?: string };
    caption?: string;
  };
}

/**
 * Send a text message via Telegram Bot API.
 */
export async function sendTelegramMessage(
  env: Env,
  chatId: string,
  text: string
): Promise<boolean> {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  return response.ok;
}

/**
 * Get a file download URL from Telegram.
 */
export async function getTelegramFileUrl(
  env: Env,
  fileId: string
): Promise<string | null> {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
  });
  if (!response.ok) return null;

  const data = (await response.json()) as {
    ok: boolean;
    result?: { file_path: string };
  };
  if (!data.ok || !data.result?.file_path) return null;

  return `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${data.result.file_path}`;
}

/**
 * Register webhook URL with Telegram.
 */
export async function setTelegramWebhook(
  botToken: string,
  webhookUrl: string
): Promise<boolean> {
  const url = `https://api.telegram.org/bot${botToken}/setWebhook`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl }),
  });
  return response.ok;
}
