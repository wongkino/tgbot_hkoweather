"""Simple JSON-backed state storage."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class StateStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self._state: dict[str, Any] = self._load()

    def get(self, key: str, default: Any = None) -> Any:
        return self._state.get(key, default)

    def set(self, key: str, value: Any) -> None:
        self._state[key] = value
        self.save()

    def _load(self) -> dict[str, Any]:
        if not self.path.exists():
            return {}

        with self.path.open("r", encoding="utf-8") as state_file:
            data = json.load(state_file)

        if not isinstance(data, dict):
            raise ValueError(f"State file must contain a JSON object: {self.path}")

        return data

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = self.path.with_suffix(f"{self.path.suffix}.tmp")
        with tmp_path.open("w", encoding="utf-8") as state_file:
            json.dump(self._state, state_file, ensure_ascii=False, indent=2, sort_keys=True)
            state_file.write("\n")
        tmp_path.replace(self.path)
