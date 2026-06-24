import type { OpenRouterConfig } from "./types";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export type WeatherAnalysisMode = "daily" | "current";

export async function analyzeDailyWeatherWithOpenRouter(
  config: OpenRouterConfig,
  briefing: string,
): Promise<string> {
  return requestOpenRouterAnalysis(config, buildDailySystemPrompt(), briefing);
}

export async function analyzeCurrentWeatherWithOpenRouter(
  config: OpenRouterConfig,
  briefing: string,
): Promise<string> {
  return requestOpenRouterAnalysis(config, buildCurrentSystemPrompt(), briefing);
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
    "你是香港天氣助理。根據香港天文台提供的現時天氣資料，只輸出以下兩個部分，不要加入其他標題或前言：",
    "",
    "【天氣狀況】",
    "（在此撰寫現時天氣狀況）",
    "",
    "【外出建議】",
    "（在此撰寫外出建議）",
    "",
    "【天氣狀況】須說明：現時各區氣溫與濕度、紫外線、雨量、熱帶氣旋、特別天氣消息、生效警告，以及下午/今晚天氣走勢。",
    "【外出建議】須針對「現在出門」給出具體建議，例如帶雨傘、防曬、補充水分、穿衣、戶外活動是否適宜。",
    "聚焦現時及稍後數小時，不要預測遙遠未來。",
    "只可根據提供的資料分析，不可捏造未提供的數據。",
    "請使用繁體中文，語氣清晰友善，全文不超過 400 字。",
  ].join("\n");
}
