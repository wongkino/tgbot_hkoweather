import type { CurrentWeather, WarningSnapshot } from "./types";

export function buildDailyWeatherMessage(weather: CurrentWeather): string {
  return [
    "香港天文台每日天氣報告",
    `更新時間：${weather.updateTime}`,
    "",
    `氣溫：${weather.temperature}`,
    `相對濕度：${weather.humidity}`,
    `紫外線指數：${weather.uvIndex}`,
    `雨量：${weather.rainfall}`,
    "",
    "特別天氣提示：",
    weather.warningMessage,
  ].join("\n");
}

export function buildWarningMessage(snapshot: WarningSnapshot): string {
  if (!snapshot.message) {
    return "香港天文台天氣警告已取消或暫無特別天氣提示。";
  }

  return ["香港天文台特別天氣警告更新", "", snapshot.message].join("\n");
}
