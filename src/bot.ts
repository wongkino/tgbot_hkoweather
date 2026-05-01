export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export interface StateStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

interface CurrentWeather {
  temperature: string;
  humidity: string;
  uvIndex: string;
  rainfall: string;
  updateTime: string;
  warningMessage: string;
}

interface WarningSnapshot {
  signature: string;
  message: string;
  hasNotification: boolean;
}

const HKO_BASE_URL = "https://data.weather.gov.hk/weatherAPI/opendata/weather.php";
export const LAST_WARNING_SIGNATURE_KEY = "last_warning_signature";

export async function sendDailyWeather(telegram: TelegramConfig): Promise<void> {
  const weather = await getCurrentWeather();
  await sendTelegramMessage(telegram, buildDailyWeatherMessage(weather));
}

export async function checkWarnings(
  telegram: TelegramConfig,
  state: StateStore,
): Promise<void> {
  const snapshot = await getWarningSnapshot();
  const lastSignature = (await state.get(LAST_WARNING_SIGNATURE_KEY)) ?? "";

  if (snapshot.signature === lastSignature) {
    return;
  }

  await state.put(LAST_WARNING_SIGNATURE_KEY, snapshot.signature);
  if (snapshot.hasNotification) {
    await sendTelegramMessage(telegram, buildWarningMessage(snapshot));
  } else {
    await sendTelegramMessage(telegram, "香港天文台特別天氣警告已取消。");
  }
}

async function hkoJson<T>(dataType: string): Promise<T> {
  const url = new URL(HKO_BASE_URL);
  url.searchParams.set("dataType", dataType);
  url.searchParams.set("lang", "tc");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`HKO API ${dataType} failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function getCurrentWeather(): Promise<CurrentWeather> {
  const data = await hkoJson<Record<string, unknown>>("rhrread");

  return {
    temperature: formatTemperature(data.temperature),
    humidity: formatHumidity(data.humidity),
    uvIndex: formatUvIndex(data.uvindex),
    rainfall: formatRainfall(data.rainfall),
    updateTime: formatUpdateTime(data.updateTime),
    warningMessage: formatWeatherWarningMessage(data.warningMessage),
  };
}

async function getWarningSnapshot(): Promise<WarningSnapshot> {
  const activeWarnings = await hkoJson<Record<string, unknown>>("warnsum");
  const warningInfo = await hkoJson<Record<string, unknown>>("warningInfo");
  const lines: string[] = [];
  const signatureParts: string[] = [];

  if (Object.keys(activeWarnings).length > 0) {
    lines.push("現正生效天氣警告：");
    for (const code of Object.keys(activeWarnings).sort()) {
      const item = asRecord(activeWarnings[code]);
      if (!item) {
        continue;
      }
      const name = String(item.name || code);
      const actionCode = String(item.actionCode || "");
      const issueTime = String(item.issueTime || "");
      const expireTime = String(item.expireTime || "");

      lines.push(`- ${name}`);
      if (issueTime) {
        lines.push(`  發出時間：${formatDateTime(issueTime)}`);
      }
      if (expireTime) {
        lines.push(`  到期時間：${formatDateTime(expireTime)}`);
      }
      signatureParts.push(`${code}:${name}:${actionCode}:${issueTime}:${expireTime}`);
    }
  }

  const details = Array.isArray(warningInfo.details) ? warningInfo.details : [];
  for (const rawDetail of details) {
    const detail = asRecord(rawDetail);
    if (!detail || !Array.isArray(detail.contents)) {
      continue;
    }

    const text = detail.contents.map((content) => String(content).trim()).filter(Boolean).join("\n");
    if (!text) {
      continue;
    }

    if (lines.length > 0) {
      lines.push("");
    }
    lines.push(text);
    signatureParts.push(
      `${String(detail.warningStatementCode || "")}:${String(detail.updateTime || "")}:${text}`,
    );
  }

  return {
    signature: signatureParts.join("|"),
    message: lines.join("\n").trim(),
    hasNotification: signatureParts.length > 0,
  };
}

function buildDailyWeatherMessage(weather: CurrentWeather): string {
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

function buildWarningMessage(snapshot: WarningSnapshot): string {
  if (!snapshot.message) {
    return "香港天文台天氣警告已取消或暫無特別天氣提示。";
  }

  return ["香港天文台特別天氣警告更新", "", snapshot.message].join("\n");
}

async function sendTelegramMessage(config: TelegramConfig, text: string): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: config.chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Telegram sendMessage failed with ${response.status}: ${await response.text()}`);
  }
}

function formatTemperature(raw: unknown): string {
  const container = asRecord(raw);
  const records = Array.isArray(container?.data) ? container.data : [];
  const hkoRecord = records.map(asRecord).find((record) => record?.place === "香港天文台");
  const record = hkoRecord ?? asRecord(records[0]);

  if (!record || record.value === undefined || record.value === null) {
    return "未能取得";
  }

  const place = String(record.place || "香港");
  const unit = String(container?.unit || "C");
  return `${place} ${String(record.value)}°${unit}`;
}

function formatHumidity(raw: unknown): string {
  const container = asRecord(raw);
  const records = Array.isArray(container?.data) ? container.data : [];
  const record = asRecord(records[0]);
  if (!record || record.value === undefined || record.value === null) {
    return "未能取得";
  }

  return `${String(record.value)}${String(container?.unit || "%")}`;
}

function formatUvIndex(raw: unknown): string {
  const container = asRecord(raw);
  const records = Array.isArray(container?.data) ? container.data : [];
  const record = asRecord(records[0]);
  if (!record || record.value === undefined || record.value === null) {
    return "未能取得";
  }

  return record.desc ? `${String(record.value)}（${String(record.desc)}）` : String(record.value);
}

function formatRainfall(raw: unknown): string {
  const container = asRecord(raw);
  const records = Array.isArray(container?.data) ? container.data.filter(isRecord) : [];
  const rainyRecords = records.filter((record) => {
    const maximum = record.max;
    return maximum !== 0 && maximum !== "0" && maximum !== undefined && maximum !== null;
  });

  if (rainyRecords.length === 0) {
    return "過去一小時大部分地區沒有錄得雨量";
  }

  const unit = String(container?.unit || "mm");
  return rainyRecords
    .slice(0, 5)
    .map((record) => {
      const place = String(record.place || "未知地區");
      if (record.min === record.max || record.min === undefined || record.min === "") {
        return `${place} ${String(record.max)}${unit}`;
      }
      return `${place} ${String(record.min)}-${String(record.max)}${unit}`;
    })
    .join("；");
}

function formatWeatherWarningMessage(raw: unknown): string {
  if (!Array.isArray(raw) || raw.length === 0) {
    return "沒有特別天氣提示";
  }

  const text = raw.map((item) => String(item).trim()).filter(Boolean).join("\n");
  return text || "沒有特別天氣提示";
}

function formatUpdateTime(raw: unknown): string {
  return raw ? formatDateTime(String(raw)) : "未知";
}

function formatDateTime(raw: string): string {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return formatter.format(date);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
