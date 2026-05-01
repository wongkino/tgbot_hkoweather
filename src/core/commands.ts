import { sendCurrentWeather } from "./weather-bot";
import { sendTelegramMessage } from "./telegram";
import type { TelegramConfig, TelegramUpdate } from "./types";

const WEATHER_COMMANDS = new Set(["/weather", "/now"]);

export async function handleTelegramUpdate(
  telegram: TelegramConfig,
  update: TelegramUpdate,
): Promise<boolean> {
  const message = update.message;
  if (!message?.text) {
    return false;
  }

  const text = normalizeCommandText(message.text);
  if (!text) {
    return false;
  }

  if (isWeatherCommand(text)) {
    await sendCurrentWeather(telegram, message.chat.id);
    return true;
  }

  if (text === "/start" || text === "/help") {
    await sendTelegramMessage(telegram, buildHelpMessage(), message.chat.id);
    return true;
  }

  return false;
}

function normalizeCommandText(text: string): string {
  return text.trim().split(/\s+/, 1)[0]?.toLowerCase() ?? "";
}

function isWeatherCommand(text: string): boolean {
  const command = text.split("@")[0] ?? "";
  return WEATHER_COMMANDS.has(command ?? "");
}

function buildHelpMessage(): string {
  return [
    "香港天文台天氣 Bot 指令：",
    "",
    "/weather - 立即取得現在天氣",
    "/now - 立即取得現在天氣",
    "/help - 顯示此說明",
  ].join("\n");
}
