from hkoweather_bot.hko import CurrentWeather, WarningSnapshot
from hkoweather_bot.messages import build_daily_weather_message, build_warning_message


def test_build_daily_weather_message() -> None:
    message = build_daily_weather_message(
        CurrentWeather(
            temperature="香港天文台 25°C",
            humidity="80%",
            uv_index="4",
            rainfall="沒有錄得雨量",
            update_time="2026-04-30 07:00",
            warning_message="沒有特別天氣提示",
        )
    )

    assert "香港天文台每日天氣報告" in message
    assert "氣溫：香港天文台 25°C" in message
    assert "特別天氣提示：" in message


def test_build_warning_message() -> None:
    message = build_warning_message(
        WarningSnapshot(
            signature="WFIRE:2026-04-30T07:00:00+08:00",
            message="紅色火災危險警告現正生效。",
            has_active_warning=True,
        )
    )

    assert message.startswith("香港天文台特別天氣警告更新")
    assert "紅色火災危險警告現正生效。" in message
