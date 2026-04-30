from __future__ import annotations

import requests


class TelegramClient:
    def __init__(self, token: str, chat_id: str) -> None:
        self._chat_id = chat_id
        self._base_url = f"https://api.telegram.org/bot{token}"

    def send_message(self, text: str) -> None:
        response = requests.post(
            f"{self._base_url}/sendMessage",
            json={
                "chat_id": self._chat_id,
                "text": text,
                "disable_web_page_preview": True,
            },
            timeout=20,
        )
        response.raise_for_status()
