import type { OpenRouterConfig } from "./types";
import { getDailyWeatherContext } from "./hko";
import { analyzeWeatherWithOpenRouter, type WeatherAnalysisMode } from "./openrouter";
import { buildAiWeatherMessage, buildDailyWeatherMessage } from "./messages";

export async function buildWeatherReportMessage(
  openRouter: OpenRouterConfig | undefined,
  mode: WeatherAnalysisMode,
): Promise<string> {
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
