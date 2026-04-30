from __future__ import annotations

import logging
import signal
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from hkoweather_bot.config import Config, load_config
from hkoweather_bot.hko import HkoClient
from hkoweather_bot.messages import build_daily_weather_message, build_warning_message
from hkoweather_bot.state import StateStore
from hkoweather_bot.telegram import TelegramClient

LOGGER = logging.getLogger(__name__)


@dataclass
class WeatherBot:
    config: Config
    hko: HkoClient
    telegram: TelegramClient
    state: StateStore

    def send_daily_weather(self) -> None:
        LOGGER.info("Sending daily weather report")
        weather = self.hko.get_current_weather()
        self.telegram.send_message(build_daily_weather_message(weather))

    def check_warnings(self) -> None:
        LOGGER.info("Checking HKO weather warnings")
        snapshot = self.hko.get_warning_snapshot()
        last_signature = self.state.get("last_warning_signature", "")

        if snapshot.signature == last_signature:
            return

        self.state.set("last_warning_signature", snapshot.signature)
        if snapshot.has_notification:
            self.telegram.send_message(build_warning_message(snapshot))
        else:
            self.telegram.send_message("香港天文台特別天氣警告已取消。")


def create_bot(config: Config) -> WeatherBot:
    return WeatherBot(
        config=config,
        hko=HkoClient(),
        telegram=TelegramClient(config.telegram_bot_token, config.telegram_chat_id),
        state=StateStore(config.state_file),
    )


def _parse_daily_time(value: str) -> tuple[int, int]:
    try:
        hour_text, minute_text = value.split(":", maxsplit=1)
        hour = int(hour_text)
        minute = int(minute_text)
    except ValueError as exc:
        raise ValueError("DAILY_REPORT_TIME must use HH:MM format.") from exc

    if hour not in range(24) or minute not in range(60):
        raise ValueError("DAILY_REPORT_TIME must be a valid 24-hour time.")
    return hour, minute


def run() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )

    config = load_config()
    timezone = ZoneInfo(config.timezone)
    hour, minute = _parse_daily_time(config.daily_report_time)
    bot = create_bot(config)

    scheduler = BackgroundScheduler(timezone=timezone)
    scheduler.add_job(
        bot.send_daily_weather,
        CronTrigger(hour=hour, minute=minute, timezone=timezone),
        id="daily-weather-report",
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        bot.check_warnings,
        IntervalTrigger(seconds=config.warning_poll_seconds, timezone=timezone),
        id="warning-poll",
        max_instances=1,
        coalesce=True,
        next_run_time=datetime.now(timezone),
    )
    scheduler.start()

    LOGGER.info(
        "HKO Telegram bot started; daily report at %s %s; warning poll every %s seconds",
        config.daily_report_time,
        config.timezone,
        config.warning_poll_seconds,
    )

    should_stop = False

    def _request_shutdown(signum: int, _frame: object) -> None:
        nonlocal should_stop
        LOGGER.info("Received signal %s, shutting down", signum)
        should_stop = True

    signal.signal(signal.SIGTERM, _request_shutdown)
    signal.signal(signal.SIGINT, _request_shutdown)

    try:
        while not should_stop:
            time.sleep(1)
    finally:
        scheduler.shutdown(wait=False)


if __name__ == "__main__":
    run()
