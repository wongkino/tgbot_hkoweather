import type { DailyWeatherContext, OpenRouterConfig } from "./types";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export type WeatherAnalysisMode = "daily" | "current";

export async function analyzeWeatherWithOpenRouter(
  config: OpenRouterConfig,
  context: DailyWeatherContext,
  mode: WeatherAnalysisMode,
): Promise<string> {
  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/wongkino/tgbot_hkoweather",
      "X-Title": "HKO Weather Telegram Bot",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: buildSystemPrompt(mode) },
        { role: "user", content: buildUserPrompt(context, mode) },
      ],
      temperature: 0.4,
      max_tokens: 600,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API failed with ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (payload.error?.message) {
    throw new Error(payload.error.message);
  }

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("OpenRouter API returned empty content.");
  }

  return content;
}

function buildSystemPrompt(mode: WeatherAnalysisMode): string {
  if (mode === "daily") {
    return [
      "你是香港天氣助理，根據香港天文台提供的資料撰寫當日天氣報告。",
      "請使用繁體中文，語氣清晰友善。",
      "內容須包含：今日天氣概況、氣溫與濕度重點、紫外線或雨量提示、生效中的天氣警告、外出建議（例如帶傘、防曬、穿衣）。",
      "只可根據提供的資料分析，不可捏造未提供的數據。",
      "全文控制在 500 字以內，適合在 Telegram 閱讀。",
      "不要使用 Markdown 標題符號（#），可用簡短分段。",
    ].join("\n");
  }

  return [
    "你是香港天氣助理，根據香港天文台提供的資料撰寫現時天氣摘要。",
    "請使用繁體中文，語氣清晰友善。",
    "內容須包含：現時天氣狀況、氣溫濕度重點、紫外線或雨量、生效警告、簡短外出建議。",
    "只可根據提供的資料分析，不可捏造未提供的數據。",
    "全文控制在 350 字以內。",
    "不要使用 Markdown 標題符號（#）。",
  ].join("\n");
}

function buildUserPrompt(context: DailyWeatherContext, mode: WeatherAnalysisMode): string {
  const lines = [
    mode === "daily" ? "請根據以下香港天文台資料，撰寫今日天氣報告：" : "請根據以下香港天文台資料，撰寫現時天氣摘要：",
    "",
    "【現時天氣】",
    `更新時間：${context.current.updateTime}`,
    `氣溫：${context.current.temperature}`,
    `相對濕度：${context.current.humidity}`,
    `紫外線指數：${context.current.uvIndex}`,
    `雨量：${context.current.rainfall}`,
    `特別天氣提示：${context.current.warningMessage}`,
    "",
    "【本港地區天氣預測】",
    `更新時間：${context.localForecast.updateTime}`,
    `概況：${context.localForecast.generalSituation || "無"}`,
    `熱帶氣旋資訊：${context.localForecast.tcInfo || "無"}`,
    `${context.localForecast.forecastPeriod || "預測"}：${context.localForecast.forecastDesc || "無"}`,
    `展望：${context.localForecast.outlook || "無"}`,
  ];

  if (context.todayForecast) {
    lines.push(
      "",
      "【今日九天天氣預報條目】",
      `日期：${context.todayForecast.date}（${context.todayForecast.week}）`,
      `天氣：${context.todayForecast.weather}`,
      `氣溫：${context.todayForecast.minTemp} - ${context.todayForecast.maxTemp}`,
      `相對濕度：${context.todayForecast.minRh} - ${context.todayForecast.maxRh}`,
      `風向風速：${context.todayForecast.wind}`,
      `降雨概率：${context.todayForecast.rainProbability || "無"}`,
    );
  }

  if (context.warnings.hasNotification && context.warnings.message) {
    lines.push("", "【生效天氣警告】", context.warnings.message);
  }

  return lines.join("\n");
}
