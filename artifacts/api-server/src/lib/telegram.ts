import { logger } from "./logger";

const TELEGRAM_API = "https://api.telegram.org";

/**
 * Send a message to a Telegram channel using the Bot API.
 * @param botToken  Bot token from @BotFather (e.g. "123456:ABC-...")
 * @param chatId    Channel username (@mychannel) or numeric ID (-100...)
 * @param text      Message text (supports HTML parse mode)
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const url = `${TELEGRAM_API}/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json() as Record<string, unknown>;

    if (!res.ok || data["ok"] !== true) {
      const description = typeof data["description"] === "string"
        ? data["description"]
        : `HTTP ${res.status}`;
      logger.warn({ chatId, description }, "Telegram sendMessage failed");
      return { ok: false, error: description };
    }

    logger.info({ chatId }, "Message posted to Telegram");
    return { ok: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err, chatId }, "Telegram API call failed");
    return { ok: false, error: message };
  }
}

/**
 * Verify a bot token is valid by calling getMe.
 */
export async function verifyBotToken(
  botToken: string
): Promise<{ valid: boolean; username: string | null; error: string | null }> {
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${botToken}/getMe`, {
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json() as Record<string, unknown>;

    if (data["ok"] === true) {
      const result = data["result"] as Record<string, unknown>;
      return {
        valid: true,
        username: typeof result["username"] === "string" ? result["username"] : null,
        error: null,
      };
    }

    return {
      valid: false,
      username: null,
      error: typeof data["description"] === "string" ? data["description"] : "Invalid token",
    };
  } catch (err) {
    return { valid: false, username: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
