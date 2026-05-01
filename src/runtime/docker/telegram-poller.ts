import { handleTelegramUpdate } from "../../core/commands";
import { getTelegramUpdates } from "../../core/telegram";
import type { TelegramConfig } from "../../core/types";

export interface TelegramCommandPolling {
  stop(): void;
}

export function startTelegramCommandPolling(
  telegram: TelegramConfig,
  intervalMs = 3_000,
): TelegramCommandPolling {
  let offset = 0;
  let isPolling = false;

  const poll = async () => {
    if (isPolling) {
      return;
    }

    isPolling = true;
    try {
      const updates = await getTelegramUpdates(telegram, offset);
      for (const update of updates) {
        offset = Math.max(offset, update.update_id + 1);
        await handleTelegramUpdate(telegram, update);
      }
    } catch (error) {
      console.error(`${new Date().toISOString()} failed Telegram command poll`, error);
    } finally {
      isPolling = false;
    }
  };

  void poll();
  const timer = setInterval(() => void poll(), intervalMs);
  return {
    stop: () => clearInterval(timer),
  };
}
