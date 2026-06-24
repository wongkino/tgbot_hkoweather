import type { OpenRouterConfig } from "./types";
import {
  buildDetailedDailyBriefing,
  getDailyWeatherContext,
  getDetailedDailyWeatherContext,
} from "./hko";
import {
  analyzeDailyWeatherWithOpenRouter,
  analyzeWeatherWithOpenRouter,
  type WeatherAnalysisMode,
} from "./openrouter";
import {
  buildAiDailyWeatherMessage,
  buildAiWeatherMessage,
  buildDailyWeatherMessage,
} from "./messages";

export async function buildWeatherReportMessage(
  openRouter: OpenRouterConfig | undefined,
  mode: WeatherAnalysisMode,
): Promise<string> {
  if (mode === "daily") {
    const context = await getDetailedDailyWeatherContext();

    if (!openRouter) {
      return buildDailyWeatherMessage({
        temperature: formatSummaryTemperature(context.current.temperatures),
        humidity: formatSummaryHumidity(context.current.humidity),
        uvIndex: context.current.uvIndex,
        rainfall: formatSummaryRainfall(context.current.rainfallByDistrict),
        updateTime: context.current.updateTime,
        warningMessage: context.current.warningMessage,
      });
    }

    try {
      const briefing = buildDetailedDailyBriefing(context);
      const analysis = await analyzeDailyWeatherWithOpenRouter(openRouter, briefing);
      return buildAiDailyWeatherMessage(context.current.updateTime, analysis);
    } catch (error) {
      console.error("OpenRouter daily weather analysis failed, falling back to raw report", error);
      return buildDailyWeatherMessage({
        temperature: formatSummaryTemperature(context.current.temperatures),
        humidity: formatSummaryHumidity(context.current.humidity),
        uvIndex: context.current.uvIndex,
        rainfall: formatSummaryRainfall(context.current.rainfallByDistrict),
        updateTime: context.current.updateTime,
        warningMessage: context.current.warningMessage,
      });
    }
  }

  const context = await getDailyWeatherContext();

  if (!openRouter) {
    return buildDailyWeatherMessage(context.current);
  }

  try {
    const analysis = await analyzeWeatherWithOpenRouter(openRouter, context, mode);
    return buildAiWeatherMessage(context, analysis, mode);
  } catch (error) {
    console.error("OpenRouter weather analysis failed, falling back to raw report", error);
    return buildDailyWeatherMessage(context.current);
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
