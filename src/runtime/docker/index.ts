import { LAST_WARNING_SIGNATURE_KEY } from "../../core/weather-bot";
import { loadDockerConfig } from "./config";
import { FileStateStore } from "./state";
import { scheduleDailyWeather, scheduleWarningPoll } from "./scheduler";

const config = loadDockerConfig();
const state = new FileStateStore(config.stateFile);
const dailyTimer = scheduleDailyWeather(config.telegram, config.dailyReportTime);
const warningTimer = scheduleWarningPoll(config.telegram, state, config.warningPollSeconds);

console.log(
  [
    "HKO Weather Telegram Bot started",
    `daily report at ${config.dailyReportTime} Asia/Hong_Kong`,
    `warning poll every ${config.warningPollSeconds} seconds`,
    `state file ${config.stateFile}`,
    `state key ${LAST_WARNING_SIGNATURE_KEY}`,
  ].join("; "),
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`Received ${signal}, shutting down`);
    clearTimeout(dailyTimer);
    clearInterval(warningTimer);
    process.exit(0);
  });
}
