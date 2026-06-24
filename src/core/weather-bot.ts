import { buildWeatherReportMessage } from "./weather-context";
import { getWarningSnapshot } from "./hko";
import { buildWarningMessage } from "./messages";
import { sendTelegramMessage } from "./telegram";
import type { OpenRouterConfig, StateStore, TelegramConfig, TelegramChatId } from "./types";

export const LAST_WARNING_SIGNATURE_KEY = "last_warning_signature";

export async function sendDailyWeather(
  telegram: TelegramConfig,
  openRouter?: OpenRouterConfig,
): Promise<void> {
  const message = await buildWeatherReportMessage(openRouter, "daily");
  await sendTelegramMessage(telegram, message);
}

export async function sendCurrentWeather(
  telegram: TelegramConfig,
  chatId: TelegramChatId,
  openRouter?: OpenRouterConfig,
): Promise<void> {
  const message = await buildWeatherReportMessage(openRouter, "current");
  await sendTelegramMessage(telegram, message, { chatId });
}

export async function checkWarnings(
  telegram: TelegramConfig,
  state: StateStore,
): Promise<void> {
  const snapshot = await getWarningSnapshot();
  const lastSignature = (await state.get(LAST_WARNING_SIGNATURE_KEY)) ?? "";

  if (snapshot.signature === lastSignature) {
    return;
  }

  await state.put(LAST_WARNING_SIGNATURE_KEY, snapshot.signature);
  if (snapshot.hasNotification) {
    await sendTelegramMessage(telegram, buildWarningMessage(snapshot));
  } else {
    await sendTelegramMessage(telegram, "香港天文台特別天氣警告已取消。");
  }
}
