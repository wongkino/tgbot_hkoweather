import { getCurrentWeather, getWarningSnapshot } from "./hko";
import { buildDailyWeatherMessage, buildWarningMessage } from "./messages";
import { sendTelegramMessage } from "./telegram";
import type { StateStore, TelegramConfig, TelegramChatId } from "./types";

export const LAST_WARNING_SIGNATURE_KEY = "last_warning_signature";

export async function sendDailyWeather(telegram: TelegramConfig): Promise<void> {
  const weather = await getCurrentWeather();
  await sendTelegramMessage(telegram, buildDailyWeatherMessage(weather));
}

export async function sendCurrentWeather(
  telegram: TelegramConfig,
  chatId: TelegramChatId,
): Promise<void> {
  const weather = await getCurrentWeather();
  await sendTelegramMessage(telegram, buildDailyWeatherMessage(weather), { chatId });
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
