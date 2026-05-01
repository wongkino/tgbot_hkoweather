import { sendCurrentWeather } from "./weather-bot";
import { sendTelegramMessage } from "./telegram";
import type { TelegramConfig, TelegramUpdate } from "./types";

const WEATHER_COMMANDS = new Set(["/weather", "/now"]);
const WEATHER_BUTTON_TEXT = "現在天氣";
const HELP_BUTTON_TEXT = "說明";
const MAIN_KEYBOARD = {
  keyboard: [[{ text: WEATHER_BUTTON_TEXT }], [{ text: HELP_BUTTON_TEXT }]],
  resize_keyboard: true,
  is_persistent: true,
};

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

  if (isWeatherCommand(text) || text === WEATHER_BUTTON_TEXT.toLowerCase()) {
    await sendCurrentWeather(telegram, message.chat.id);
    return true;
  }

  if (text === "/start" || text === "/help" || text === HELP_BUTTON_TEXT.toLowerCase()) {
    await sendTelegramMessage(telegram, buildHelpMessage(), {
      chatId: message.chat.id,
      replyMarkup: MAIN_KEYBOARD,
    });
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
    "香港天文台天氣 Bot：",
    "",
    `按「${WEATHER_BUTTON_TEXT}」即可立即取得現在天氣。`,
    "",
    "也可輸入：",
    "/weather 或 /now - 立即取得現在天氣",
    "/help - 顯示此說明和鍵盤",
  ].join("\n");
}
