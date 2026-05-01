import type { TelegramConfig, TelegramUpdate } from "./types";

export async function sendTelegramMessage(
  config: TelegramConfig,
  text: string,
  chatId: number | string = config.chatId,
): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Telegram sendMessage failed with ${response.status}: ${await response.text()}`);
  }
}

export async function getTelegramUpdates(
  config: TelegramConfig,
  offset?: number,
): Promise<TelegramUpdate[]> {
  const url = new URL(`https://api.telegram.org/bot${config.botToken}/getUpdates`);
  url.searchParams.set("timeout", "0");
  if (offset !== undefined) {
    url.searchParams.set("offset", String(offset));
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Telegram getUpdates failed with ${response.status}: ${await response.text()}`);
  }

  const payload = (await response.json()) as unknown;
  if (!isTelegramUpdatesResponse(payload)) {
    throw new Error("Telegram getUpdates returned an unexpected payload.");
  }

  return payload.result;
}

function isTelegramUpdatesResponse(
  value: unknown,
): value is { ok: boolean; result: TelegramUpdate[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    "result" in value &&
    Array.isArray(value.result)
  );
}
