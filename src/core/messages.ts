import type { DailyWeatherContext, CurrentWeather, WarningSnapshot } from "./types";
import type { WeatherAnalysisMode } from "./openrouter";

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

export function buildAiWeatherMessage(
  context: DailyWeatherContext,
  analysis: string,
  mode: WeatherAnalysisMode,
): string {
  const title = mode === "daily" ? "香港今日天氣報告" : "香港現時天氣分析";
  const updateTime = context.current.updateTime;

  return [
    title,
    `更新時間：${updateTime}`,
    "",
    analysis.trim(),
    "",
    "—",
    "資料來源：香港天文台 · 分析由 OpenRouter 免費模型生成",
  ].join("\n");
}

export function buildWarningMessage(snapshot: WarningSnapshot): string {
  if (!snapshot.message) {
    return "香港天文台天氣警告已取消或暫無特別天氣提示。";
  }

  return ["香港天文台特別天氣警告更新", "", snapshot.message].join("\n");
}
