from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


@dataclass(frozen=True)
class Config:
    telegram_bot_token: str
    telegram_chat_id: str
    timezone: str = "Asia/Hong_Kong"
    daily_report_time: str = "07:00"
    warning_poll_seconds: int = 300
    state_file: Path = Path(".hkoweather_bot_state.json")


def load_config() -> Config:
    load_dotenv()

    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    if not token:
        raise RuntimeError("Missing TELEGRAM_BOT_TOKEN environment variable.")
    if not chat_id:
        raise RuntimeError("Missing TELEGRAM_CHAT_ID environment variable.")

    warning_poll_seconds = int(os.getenv("WARNING_POLL_SECONDS", "300"))
    if warning_poll_seconds <= 0:
        raise ValueError("WARNING_POLL_SECONDS must be greater than zero.")

    return Config(
        telegram_bot_token=token,
        telegram_chat_id=chat_id,
        timezone=os.getenv("TZ", "Asia/Hong_Kong").strip() or "Asia/Hong_Kong",
        daily_report_time=os.getenv("DAILY_REPORT_TIME", "07:00").strip() or "07:00",
        warning_poll_seconds=warning_poll_seconds,
        state_file=Path(os.getenv("STATE_FILE", ".hkoweather_bot_state.json")),
    )
