import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  LAST_WARNING_SIGNATURE_KEY,
  checkWarnings,
  sendDailyWeather,
  type StateStore,
  type TelegramConfig,
} from "./bot";

interface DockerConfig {
  telegramBotToken: string;
  telegramChatId: string;
  dailyReportTime: string;
  warningPollSeconds: number;
  stateFile: string;
}

class FileStateStore implements StateStore {
  constructor(private readonly path: string) {}

  async get(key: string): Promise<string | null> {
    const state = await this.readState();
    return state[key] ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    const state = await this.readState();
    state[key] = value;
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  private async readState(): Promise<Record<string, string>> {
    try {
      const data = JSON.parse(await readFile(this.path, "utf8")) as unknown;
      return isStringRecord(data) ? data : {};
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        return {};
      }
      throw error;
    }
  }
}

function loadConfig(): DockerConfig {
  const telegramBotToken = requiredEnv("TELEGRAM_BOT_TOKEN");
  const telegramChatId = requiredEnv("TELEGRAM_CHAT_ID");
  const warningPollSeconds = Number.parseInt(process.env.WARNING_POLL_SECONDS ?? "300", 10);

  if (!Number.isInteger(warningPollSeconds) || warningPollSeconds <= 0) {
    throw new Error("WARNING_POLL_SECONDS must be a positive integer.");
  }

  return {
    telegramBotToken,
    telegramChatId,
    dailyReportTime: process.env.DAILY_REPORT_TIME || "07:00",
    warningPollSeconds,
    stateFile: process.env.STATE_FILE || ".hkoweather_bot_state.json",
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name} environment variable.`);
  }
  return value;
}

function telegramConfig(config: DockerConfig): TelegramConfig {
  return {
    botToken: config.telegramBotToken,
    chatId: config.telegramChatId,
  };
}

function millisecondsUntilDailyRun(time: string): number {
  const [hourText, minuteText] = time.split(":", 2);
  const hour = Number.parseInt(hourText ?? "", 10);
  const minute = Number.parseInt(minuteText ?? "", 10);

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
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
  const next = new Date(`${year}-${month}-${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`);

  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next.getTime() - now.getTime();
}

function scheduleDailyWeather(telegram: TelegramConfig, dailyReportTime: string): NodeJS.Timeout {
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

function scheduleWarningPoll(
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

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === "string")
  );
}

const config = loadConfig();
const telegram = telegramConfig(config);
const state = new FileStateStore(config.stateFile);
const dailyTimer = scheduleDailyWeather(telegram, config.dailyReportTime);
const warningTimer = scheduleWarningPoll(telegram, state, config.warningPollSeconds);

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
