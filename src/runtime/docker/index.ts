import { LAST_WARNING_SIGNATURE_KEY } from "../../core/weather-bot";
import { loadDockerConfig } from "./config";
import { FileStateStore } from "./state";
import { scheduleDailyWeather, scheduleWarningPoll } from "./scheduler";
import { startTelegramCommandPolling } from "./telegram-poller";

const config = loadDockerConfig();
const state = new FileStateStore(config.stateFile);
const dailyTimer = scheduleDailyWeather(
  config.telegram,
  config.dailyReportTime,
  config.openRouter,
);
const warningTimer = scheduleWarningPoll(config.telegram, state, config.warningPollSeconds);
const commandPolling = startTelegramCommandPolling(config.telegram, config.openRouter);

console.log(
  [
    "HKO Weather Telegram Bot started",
    `daily report at ${config.dailyReportTime} Asia/Hong_Kong`,
    `warning poll every ${config.warningPollSeconds} seconds`,
    "Telegram command polling enabled",
    `state file ${config.stateFile}`,
    `state key ${LAST_WARNING_SIGNATURE_KEY}`,
    config.openRouter
      ? `OpenRouter model ${config.openRouter.model}`
      : "OpenRouter disabled (set OPENROUTER_API_KEY to enable AI reports)",
  ].join("; "),
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`Received ${signal}, shutting down`);
    clearTimeout(dailyTimer);
    clearInterval(warningTimer);
    commandPolling.stop();
    process.exit(0);
  });
}
