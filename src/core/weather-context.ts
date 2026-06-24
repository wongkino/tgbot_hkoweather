import type { OpenRouterConfig } from "./types";
import {
  buildDetailedCurrentBriefing,
  buildDetailedDailyBriefing,
  getDetailedDailyWeatherContext,
} from "./hko";
import {
  analyzeCurrentWeatherWithOpenRouter,
  analyzeDailyWeatherWithOpenRouter,
  type WeatherAnalysisMode,
} from "./openrouter";
import {
  buildAiCurrentWeatherMessage,
  buildAiDailyWeatherMessage,
  buildDailyWeatherMessage,
} from "./messages";

export async function buildWeatherReportMessage(
  openRouter: OpenRouterConfig | undefined,
  mode: WeatherAnalysisMode,
): Promise<string> {
  const context = await getDetailedDailyWeatherContext();
  const fallbackMessage = buildDailyWeatherMessage({
    temperature: formatSummaryTemperature(context.current.temperatures),
    humidity: formatSummaryHumidity(context.current.humidity),
    uvIndex: context.current.uvIndex,
    rainfall: formatSummaryRainfall(context.current.rainfallByDistrict),
    updateTime: context.current.updateTime,
    warningMessage: context.current.warningMessage,
  });

  if (!openRouter) {
    return fallbackMessage;
  }

  if (mode === "daily") {
    try {
      const briefing = buildDetailedDailyBriefing(context);
      const analysis = await analyzeDailyWeatherWithOpenRouter(openRouter, briefing);
      return buildAiDailyWeatherMessage(context.current.updateTime, analysis);
    } catch (error) {
      console.error("OpenRouter daily weather analysis failed, falling back to raw report", error);
      return fallbackMessage;
    }
  }

  try {
    const briefing = buildDetailedCurrentBriefing(context);
    const analysis = await analyzeCurrentWeatherWithOpenRouter(openRouter, briefing);
    return buildAiCurrentWeatherMessage(context.current.updateTime, analysis);
  } catch (error) {
    console.error("OpenRouter current weather analysis failed, falling back to raw report", error);
    return fallbackMessage;
  }
}

function formatSummaryTemperature(readings: { place: string; value: string }[]): string {
  const hko = readings.find((item) => item.place === "香港天文台");
  return hko?.value ? `香港天文台 ${hko.value}` : formatReadingList(readings.slice(0, 3));
}

function formatSummaryHumidity(readings: { place: string; value: string }[]): string {
  return formatReadingList(readings);
}

function formatSummaryRainfall(readings: { place: string; value: string }[]): string {
  const rainy = readings.filter((item) => item.value !== "0mm");
  if (rainy.length === 0) {
    return "過去一小時大部分地區沒有錄得雨量";
  }
  return formatReadingList(rainy.slice(0, 5));
}

function formatReadingList(readings: { place: string; value: string }[]): string {
  if (readings.length === 0) {
    return "未能取得";
  }
  return readings.map((item) => `${item.place} ${item.value}`).join("；");
}
