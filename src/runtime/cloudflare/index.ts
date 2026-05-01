import { handleTelegramUpdate } from "../../core/commands";
import { checkWarnings, sendDailyWeather } from "../../core/weather-bot";
import type { StateStore, TelegramConfig, TelegramUpdate } from "../../core/types";

interface Env {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  TELEGRAM_WEBHOOK_SETUP_SECRET?: string;
  HKO_BOT_STATE: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/telegram/set-webhook") {
      if (request.method !== "POST") {
        return jsonResponse({ ok: false, error: "Method Not Allowed" }, 405);
      }
      return setTelegramWebhook(request, env);
    }

    if (request.method === "POST" && isTelegramWebhookPath(url.pathname)) {
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

    return new Response("HKO Weather Telegram Bot is running.\nWebhook path: /telegram/webhook\nSetup path: /telegram/set-webhook\n", {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduled(event.cron, env));
  },
};

function isTelegramWebhookPath(pathname: string): boolean {
  // Keep root POST compatible with older webhook setups.
  return pathname === "/" || pathname === "/telegram/webhook";
}

function isAuthorizedTelegramWebhook(request: Request, env: Env): boolean {
  if (!env.TELEGRAM_WEBHOOK_SECRET) {
    return true;
  }

  return request.headers.get("x-telegram-bot-api-secret-token") === env.TELEGRAM_WEBHOOK_SECRET;
}

async function setTelegramWebhook(request: Request, env: Env): Promise<Response> {
  if (!isAuthorizedWebhookSetup(request, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  const webhookUrl = new URL("/telegram/webhook", request.url).toString();
  const telegramUrl = new URL(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`);
  telegramUrl.searchParams.set("url", webhookUrl);
  telegramUrl.searchParams.set("allowed_updates", JSON.stringify(["message"]));
  if (env.TELEGRAM_WEBHOOK_SECRET) {
    telegramUrl.searchParams.set("secret_token", env.TELEGRAM_WEBHOOK_SECRET);
  }

  const response = await fetch(telegramUrl.toString());
  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    return jsonResponse({ ok: false, error: payload }, response.status);
  }

  return jsonResponse({ ok: true, webhookUrl, telegram: payload });
}

function isAuthorizedWebhookSetup(request: Request, env: Env): boolean {
  if (!env.TELEGRAM_WEBHOOK_SETUP_SECRET) {
    return false;
  }

  const url = new URL(request.url);
  const authorization = request.headers.get("authorization") ?? "";
  const bearerToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : null;
  const providedSecret =
    bearerToken ?? request.headers.get("x-webhook-setup-secret") ?? url.searchParams.get("secret");
  return providedSecret === env.TELEGRAM_WEBHOOK_SETUP_SECRET;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(`${JSON.stringify(payload)}\n`, {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
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
