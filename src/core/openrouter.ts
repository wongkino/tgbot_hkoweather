import type { DailyWeatherContext, OpenRouterConfig } from "./types";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export type WeatherAnalysisMode = "daily" | "current";

export async function analyzeDailyWeatherWithOpenRouter(
  config: OpenRouterConfig,
  briefing: string,
): Promise<string> {
  return requestOpenRouterAnalysis(config, buildDailySystemPrompt(), briefing);
}

export async function analyzeWeatherWithOpenRouter(
  config: OpenRouterConfig,
  context: DailyWeatherContext,
  mode: WeatherAnalysisMode,
): Promise<string> {
  if (mode === "daily") {
    throw new Error("Use analyzeDailyWeatherWithOpenRouter for daily mode.");
  }

  return requestOpenRouterAnalysis(config, buildCurrentSystemPrompt(), buildCurrentUserPrompt(context));
}

async function requestOpenRouterAnalysis(
  config: OpenRouterConfig,
  systemPrompt: string,
  userPrompt: string,
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
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 700,
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

function buildDailySystemPrompt(): string {
  return [
    "你是香港天氣助理。根據香港天文台提供的詳盡資料，只輸出以下兩個部分，不要加入其他標題或前言：",
    "",
    "【天氣狀況】",
    "（在此撰寫今日整體天氣狀況）",
    "",
    "【外出建議】",
    "（在此撰寫外出建議）",
    "",
    "【天氣狀況】須綜合說明：整體天氣、各區氣溫與濕度重點、紫外線、雨量、熱帶氣旋、特別天氣消息、生效警告、今日及短期預報。",
    "【外出建議】須具體實用，例如：是否帶雨傘、防曬、補充水分、穿衣、戶外活動、長者與兒童注意事項。",
    "只可根據提供的資料分析，不可捏造未提供的數據。",
    "請使用繁體中文，語氣清晰友善，全文不超過 500 字。",
  ].join("\n");
}

function buildCurrentSystemPrompt(): string {
  return [
    "你是香港天氣助理，根據香港天文台提供的資料撰寫現時天氣摘要。",
    "請使用繁體中文，語氣清晰友善。",
    "內容須包含：現時天氣狀況、氣溫濕度重點、紫外線或雨量、生效警告、簡短外出建議。",
    "只可根據提供的資料分析，不可捏造未提供的數據。",
    "全文控制在 350 字以內。",
    "不要使用 Markdown 標題符號（#）。",
  ].join("\n");
}

function buildCurrentUserPrompt(context: DailyWeatherContext): string {
  const lines = [
    "請根據以下香港天文台資料，撰寫現時天氣摘要：",
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
