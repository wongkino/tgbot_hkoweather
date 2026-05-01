import { handleTelegramUpdate } from "../../core/commands";
import { checkWarnings, sendDailyWeather } from "../../core/weather-bot";
import type { StateStore, TelegramConfig, TelegramUpdate } from "../../core/types";

interface Env {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  HKO_BOT_STATE: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === "POST") {
      if (!isAuthorizedTelegramWebhook(request, env)) {
        return new Response("Unauthorized\n", {
          status: 401,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }

      const update = (await request.json()) as TelegramUpdate;
      ctx.waitUntil(handleTelegramUpdate(telegramConfig(env), update));
      return new Response("OK\n", {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    return new Response("HKO Weather Telegram Bot is running. Configure Telegram webhook to this URL.\n", {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduled(event.cron, env));
  },
};

function isAuthorizedTelegramWebhook(request: Request, env: Env): boolean {
  if (!env.TELEGRAM_WEBHOOK_SECRET) {
    return true;
  }

  return request.headers.get("x-telegram-bot-api-secret-token") === env.TELEGRAM_WEBHOOK_SECRET;
}

async function handleScheduled(cron: string, env: Env): Promise<void> {
  const telegram = telegramConfig(env);
  const state = kvStateStore(env.HKO_BOT_STATE);

  if (cron === "0 23 * * *") {
    await sendDailyWeather(telegram);
    return;
  }

  await checkWarnings(telegram, state);
}

function telegramConfig(env: Env): TelegramConfig {
  return {
    botToken: env.TELEGRAM_BOT_TOKEN,
    chatId: env.TELEGRAM_CHAT_ID,
  };
}

function kvStateStore(kv: KVNamespace): StateStore {
  return {
    get: (key) => kv.get(key),
    put: (key, value) => kv.put(key, value),
  };
}
