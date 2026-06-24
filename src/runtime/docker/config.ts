import type { OpenRouterConfig } from "../../core/types";

export interface DockerConfig {
  telegram: {
    botToken: string;
    chatId: string;
  };
  openRouter?: OpenRouterConfig;
  dailyReportTime: string;
  warningPollSeconds: number;
  stateFile: string;
}

export function loadDockerConfig(): DockerConfig {
  const telegramBotToken = requiredEnv("TELEGRAM_BOT_TOKEN");
  const telegramChatId = requiredEnv("TELEGRAM_CHAT_ID");
  const warningPollSeconds = Number.parseInt(process.env.WARNING_POLL_SECONDS ?? "300", 10);

  if (!Number.isInteger(warningPollSeconds) || warningPollSeconds <= 0) {
    throw new Error("WARNING_POLL_SECONDS must be a positive integer.");
  }

  return {
    telegram: {
      botToken: telegramBotToken,
      chatId: telegramChatId,
    },
    openRouter: loadOptionalOpenRouterConfig(),
    dailyReportTime: process.env.DAILY_REPORT_TIME || "07:00",
    warningPollSeconds,
    stateFile: process.env.STATE_FILE || ".hkoweather_bot_state.json",
  };
}

function loadOptionalOpenRouterConfig(): OpenRouterConfig | undefined {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    return undefined;
  }

  return {
    apiKey,
    model: process.env.OPENROUTER_MODEL?.trim() || "openrouter/free",
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name} environment variable.`);
  }
  return value;
}
