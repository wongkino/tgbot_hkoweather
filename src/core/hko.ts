import type {
  CurrentWeather,
  DailyWeatherContext,
  DayForecast,
  LocalForecast,
  WarningSnapshot,
} from "./types";

const HKO_BASE_URL = "https://data.weather.gov.hk/weatherAPI/opendata/weather.php";

export async function getCurrentWeather(): Promise<CurrentWeather> {
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

export async function getWarningSnapshot(): Promise<WarningSnapshot> {
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

    const text = detail.contents
      .map((content) => String(content).trim())
      .filter(Boolean)
      .join("\n");
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

export async function getLocalForecast(): Promise<LocalForecast> {
  const data = await hkoJson<Record<string, unknown>>("flw");

  return {
    generalSituation: String(data.generalSituation || "").trim(),
    tcInfo: String(data.tcInfo || "").trim(),
    forecastPeriod: String(data.forecastPeriod || "").trim(),
    forecastDesc: String(data.forecastDesc || "").trim(),
    outlook: String(data.outlook || "").trim(),
    updateTime: formatUpdateTime(data.updateTime),
  };
}

export async function getTodayDayForecast(): Promise<DayForecast | null> {
  const data = await hkoJson<Record<string, unknown>>("fnd");
  const forecasts = Array.isArray(data.weatherForecast) ? data.weatherForecast : [];
  const today = todayInHongKong();

  for (const raw of forecasts) {
    const item = asRecord(raw);
    if (!item || String(item.forecastDate || "") !== today) {
      continue;
    }

    return formatDayForecast(item);
  }

  const first = asRecord(forecasts[0]);
  return first ? formatDayForecast(first) : null;
}

export async function getDailyWeatherContext(): Promise<DailyWeatherContext> {
  const [current, localForecast, todayForecast, warnings] = await Promise.all([
    getCurrentWeather(),
    getLocalForecast(),
    getTodayDayForecast(),
    getWarningSnapshot(),
  ]);

  return {
    current,
    localForecast,
    todayForecast,
    warnings,
  };
}

function formatDayForecast(item: Record<string, unknown>): DayForecast {
  const maxTemp = asRecord(item.forecastMaxtemp);
  const minTemp = asRecord(item.forecastMintemp);
  const maxRh = asRecord(item.forecastMaxrh);
  const minRh = asRecord(item.forecastMinrh);

  return {
    date: String(item.forecastDate || ""),
    week: String(item.week || ""),
    weather: String(item.forecastWeather || "").trim(),
    minTemp: formatTempValue(minTemp),
    maxTemp: formatTempValue(maxTemp),
    minRh: formatPercentValue(minRh),
    maxRh: formatPercentValue(maxRh),
    wind: String(item.forecastWind || "").trim(),
    rainProbability: String(item.PSR || "").trim(),
  };
}

function formatTempValue(record: Record<string, unknown> | undefined): string {
  if (!record || record.value === undefined || record.value === null) {
    return "未能取得";
  }

  return `${String(record.value)}°${String(record.unit || "C")}`;
}

function formatPercentValue(record: Record<string, unknown> | undefined): string {
  if (!record || record.value === undefined || record.value === null) {
    return "未能取得";
  }

  const unit = String(record.unit || "percent");
  return unit === "percent" ? `${String(record.value)}%` : `${String(record.value)}${unit}`;
}

function todayInHongKong(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date()).replace(/-/g, "");
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

  const text = raw
    .map((item) => String(item).trim())
    .filter(Boolean)
    .join("\n");
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
