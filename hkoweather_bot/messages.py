from __future__ import annotations

from .hko import CurrentWeather, WarningSnapshot


def build_daily_weather_message(weather: CurrentWeather) -> str:
    return "\n".join(
        [
            "香港天文台每日天氣報告",
            f"更新時間：{weather.update_time}",
            "",
            f"氣溫：{weather.temperature}",
            f"相對濕度：{weather.humidity}",
            f"紫外線指數：{weather.uv_index}",
            f"雨量：{weather.rainfall}",
            "",
            "特別天氣提示：",
            weather.warning_message,
        ]
    )


def build_warning_message(snapshot: WarningSnapshot) -> str:
    if not snapshot.message:
        return "香港天文台天氣警告已取消或暫無特別天氣提示。"

    return "\n".join(
        [
            "香港天文台特別天氣警告更新",
            "",
            snapshot.message,
        ]
    )
