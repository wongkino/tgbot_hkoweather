import { checkWarnings, sendDailyWeather } from "../../core/weather-bot";
import type { StateStore, TelegramConfig } from "../../core/types";

export function millisecondsUntilDailyRun(time: string): number {
  const [hourText, minuteText] = time.split(":", 2);
  const hour = Number.parseInt(hourText ?? "", 10);
  const minute = Number.parseInt(minuteText ?? "", 10);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error("DAILY_REPORT_TIME must use HH:MM 24-hour format.");
  }

  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [{ value: year }, , { value: month }, , { value: day }] = formatter.formatToParts(now);
  const next = new Date(
    `${year}-${month}-${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`,
  );

  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next.getTime() - now.getTime();
}

export function scheduleDailyWeather(
  telegram: TelegramConfig,
  dailyReportTime: string,
): NodeJS.Timeout {
  let timer: NodeJS.Timeout;

  const scheduleNext = () => {
    timer = setTimeout(async () => {
      await runSafely("daily weather report", () => sendDailyWeather(telegram));
      scheduleNext();
    }, millisecondsUntilDailyRun(dailyReportTime));
  };

  scheduleNext();
  return timer!;
}

export function scheduleWarningPoll(
  telegram: TelegramConfig,
  state: StateStore,
  warningPollSeconds: number,
): NodeJS.Timeout {
  void runSafely("initial warning check", () => checkWarnings(telegram, state));
  return setInterval(
    () => void runSafely("warning check", () => checkWarnings(telegram, state)),
    warningPollSeconds * 1000,
  );
}

async function runSafely(label: string, task: () => Promise<void>): Promise<void> {
  try {
    await task();
    console.log(`${new Date().toISOString()} completed ${label}`);
  } catch (error) {
    console.error(`${new Date().toISOString()} failed ${label}`, error);
  }
}
