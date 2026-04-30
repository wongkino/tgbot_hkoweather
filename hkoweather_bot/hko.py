from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import requests

LOGGER = logging.getLogger(__name__)


class HkoClientError(RuntimeError):
    """Raised when Hong Kong Observatory data cannot be fetched."""


@dataclass(frozen=True)
class CurrentWeather:
    temperature: str
    humidity: str
    uv_index: str
    rainfall: str
    update_time: str
    warning_message: str


@dataclass(frozen=True)
class WarningSnapshot:
    signature: str
    message: str
    has_notification: bool


class HkoClient:
    BASE_URL = "https://data.weather.gov.hk/weatherAPI/opendata"

    def __init__(self, language: str = "tc", timeout_seconds: int = 15) -> None:
        self.language = language
        self.timeout_seconds = timeout_seconds

    def _get_json(self, endpoint: str, params: dict[str, str] | None = None) -> dict[str, Any]:
        merged_params = {"lang": self.language}
        if params:
            merged_params.update(params)

        try:
            response = requests.get(
                f"{self.BASE_URL}/{endpoint}",
                params=merged_params,
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
            return response.json()
        except requests.RequestException as exc:
            raise HkoClientError(f"Failed to fetch HKO endpoint {endpoint}: {exc}") from exc
        except ValueError as exc:
            raise HkoClientError(f"HKO endpoint {endpoint} returned invalid JSON") from exc

    def get_current_weather(self) -> CurrentWeather:
        data = self._get_json("weather.php", {"dataType": "rhrread"})

        temperature = self._format_temperature(data.get("temperature"))
        humidity = self._format_humidity(data.get("humidity"))
        uv_index = self._format_uv_index(data.get("uvindex"))
        rainfall = self._format_rainfall(data.get("rainfall"))
        update_time = self._format_update_time(data.get("updateTime"))
        warning_message = self._format_warning_message(data)

        return CurrentWeather(
            temperature=temperature,
            humidity=humidity,
            uv_index=uv_index,
            rainfall=rainfall,
            update_time=update_time,
            warning_message=warning_message,
        )

    def get_warning_snapshot(self) -> WarningSnapshot:
        active_warnings = self._get_json("weather.php", {"dataType": "warnsum"})
        warning_info = self._get_json("weather.php", {"dataType": "warningInfo"})

        lines: list[str] = []
        signature_parts: list[str] = []

        if active_warnings:
            lines.append("現正生效天氣警告：")
            for code in sorted(active_warnings):
                item = active_warnings.get(code)
                if not isinstance(item, dict):
                    continue
                name = str(item.get("name") or code)
                action_code = str(item.get("actionCode") or "")
                issue_time = str(item.get("issueTime") or "")
                expire_time = str(item.get("expireTime") or "")
                lines.append(f"- {name}")
                if issue_time:
                    lines.append(f"  發出時間：{self._format_datetime(issue_time)}")
                if expire_time:
                    lines.append(f"  到期時間：{self._format_datetime(expire_time)}")
                signature_parts.append(f"{code}:{name}:{action_code}:{issue_time}:{expire_time}")

        details = warning_info.get("details")
        if isinstance(details, list):
            for detail in details:
                if not isinstance(detail, dict):
                    continue
                contents = detail.get("contents")
                if not isinstance(contents, list) or not contents:
                    continue
                warning_statement_code = str(detail.get("warningStatementCode") or "")
                update_time = str(detail.get("updateTime") or "")
                text = "\n".join(str(content).strip() for content in contents if str(content).strip())
                if not text:
                    continue
                if lines:
                    lines.append("")
                lines.append(text)
                signature_parts.append(f"{warning_statement_code}:{update_time}:{text}")

        signature = "|".join(signature_parts)
        return WarningSnapshot(
            signature=signature,
            message="\n".join(lines).strip(),
            has_notification=bool(signature_parts),
        )

    @staticmethod
    def _format_temperature(raw: Any) -> str:
        records = raw.get("data") if isinstance(raw, dict) else None
        if not isinstance(records, list):
            return "未能取得"

        hko_record = _find_record(records, place="香港天文台")
        if hko_record is None and records:
            hko_record = records[0] if isinstance(records[0], dict) else None
        if not hko_record:
            return "未能取得"

        value = hko_record.get("value")
        unit = raw.get("unit", "C") if isinstance(raw, dict) else "C"
        place = hko_record.get("place", "香港")
        return f"{place} {value}°{unit}" if value is not None else "未能取得"

    @staticmethod
    def _format_humidity(raw: Any) -> str:
        records = raw.get("data") if isinstance(raw, dict) else None
        if not isinstance(records, list) or not records:
            return "未能取得"
        record = records[0] if isinstance(records[0], dict) else {}
        value = record.get("value")
        unit = raw.get("unit", "%") if isinstance(raw, dict) else "%"
        return f"{value}{unit}" if value is not None else "未能取得"

    @staticmethod
    def _format_uv_index(raw: Any) -> str:
        records = raw.get("data") if isinstance(raw, dict) else None
        if not isinstance(records, list) or not records:
            return "未能取得"
        record = records[0] if isinstance(records[0], dict) else {}
        value = record.get("value")
        desc = record.get("desc")
        if value is None:
            return "未能取得"
        return f"{value}（{desc}）" if desc else str(value)

    @staticmethod
    def _format_rainfall(raw: Any) -> str:
        records = raw.get("data") if isinstance(raw, dict) else None
        if not isinstance(records, list):
            return "未能取得"

        rainy_records = [
            record
            for record in records
            if isinstance(record, dict) and record.get("max", 0) not in (0, "0", None)
        ]
        if not rainy_records:
            return "過去一小時大部分地區沒有錄得雨量"

        unit = raw.get("unit", "mm") if isinstance(raw, dict) else "mm"
        formatted = []
        for record in rainy_records[:5]:
            place = record.get("place", "未知地區")
            minimum = record.get("min")
            maximum = record.get("max")
            if minimum == maximum or minimum in (None, ""):
                formatted.append(f"{place} {maximum}{unit}")
            else:
                formatted.append(f"{place} {minimum}-{maximum}{unit}")
        return "；".join(formatted)

    @staticmethod
    def _format_warning_message(data: dict[str, Any]) -> str:
        warning_message = data.get("warningMessage")
        if isinstance(warning_message, list) and warning_message:
            return "\n".join(str(item).strip() for item in warning_message if str(item).strip())
        return "沒有特別天氣提示"

    @staticmethod
    def _format_update_time(raw: Any) -> str:
        if not raw:
            return "未知"
        return HkoClient._format_datetime(str(raw))

    @staticmethod
    def _format_datetime(raw: str) -> str:
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00")).strftime("%Y-%m-%d %H:%M")
        except ValueError:
            LOGGER.debug("Unable to parse datetime from HKO payload: %s", raw)
            return raw


def _find_record(records: list[Any], **criteria: str) -> dict[str, Any] | None:
    for record in records:
        if not isinstance(record, dict):
            continue
        if all(record.get(key) == value for key, value in criteria.items()):
            return record
    return None
