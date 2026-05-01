import { checkWarnings, sendDailyWeather, type StateStore } from "../../src/bot";

interface Env {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  HKO_BOT_STATE: KVNamespace;
}

export default {
  async fetch(): Promise<Response> {
    return new Response("HKO Weather Telegram Bot is running.\n", {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduled(event.cron, env));
  },
};

async function handleScheduled(cron: string, env: Env): Promise<void> {
  const telegram = {
    botToken: env.TELEGRAM_BOT_TOKEN,
    chatId: env.TELEGRAM_CHAT_ID,
  };
  const state = kvStateStore(env.HKO_BOT_STATE);

  if (cron === "0 23 * * *") {
    await sendDailyWeather(telegram);
    return;
  }

  await checkWarnings(telegram, state);
}

function kvStateStore(kv: KVNamespace): StateStore {
  return {
    get: (key) => kv.get(key),
    put: (key, value) => kv.put(key, value),
  };
}
