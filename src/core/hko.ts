import type {
  CurrentWeather,
  DailyDetailedContext,
  DailyWeatherContext,
  DayForecast,
  DetailedCurrentWeather,
  LocalForecast,
  NineDayForecastOverview,
  SpecialWeatherTips,
  StationReading,
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
    fireDangerWarning: String(data.fireDangerWarning || "").trim(),
    forecastPeriod: String(data.forecastPeriod || "").trim(),
    forecastDesc: String(data.forecastDesc || "").trim(),
    outlook: String(data.outlook || "").trim(),
    updateTime: formatUpdateTime(data.updateTime),
  };
}

export async function getDetailedCurrentWeather(): Promise<DetailedCurrentWeather> {
  const data = await hkoJson<Record<string, unknown>>("rhrread");
  const rainfall = asRecord(data.rainfall);

  return {
    updateTime: formatUpdateTime(data.updateTime),
    temperatures: formatStationReadings(data.temperature),
    humidity: formatStationReadings(data.humidity),
    uvIndex: formatUvIndex(data.uvindex),
    rainfallByDistrict: formatRainfallByDistrict(rainfall),
    rainfallPeriod: formatRainfallPeriod(rainfall),
    warningMessage: formatWeatherWarningMessage(data.warningMessage),
    tropicalCycloneMessage: formatTextList(data.tcmessage),
    weatherIconUpdateTime: formatUpdateTime(data.iconUpdateTime),
  };
}

export async function getSpecialWeatherTips(): Promise<SpecialWeatherTips> {
  const data = await hkoJson<Record<string, unknown>>("swt");
  const entries = Array.isArray(data.swt) ? data.swt : [];
  const tips: string[] = [];

  for (const raw of entries) {
    const item = asRecord(raw);
    const desc = String(item?.desc || "").trim();
    if (desc) {
      tips.push(desc);
    }
  }

  const first = asRecord(entries[0]);
  return {
    tips,
    updateTime: formatUpdateTime(first?.updateTime),
  };
}

export async function getNineDayForecastOverview(): Promise<NineDayForecastOverview> {
  const data = await hkoJson<Record<string, unknown>>("fnd");
  const forecasts = Array.isArray(data.weatherForecast) ? data.weatherForecast : [];
  const today = todayInHongKong();
  const dayForecasts = forecasts
    .map((raw) => asRecord(raw))
    .filter((item): item is Record<string, unknown> => item !== undefined)
    .map((item) => formatDayForecast(item));

  const todayForecast = dayForecasts.find((item) => item.date === today) ?? dayForecasts[0] ?? null;
  const upcomingDays = dayForecasts.filter((item) => item.date !== todayForecast?.date).slice(0, 3);

  return {
    generalSituation: String(data.generalSituation || "").trim(),
    seaTemperature: formatSeaTemperature(data.seaTemp),
    soilTemperature: formatSoilTemperature(data.soilTemp),
    updateTime: formatUpdateTime(data.updateTime),
    today: todayForecast,
    upcomingDays,
  };
}

export async function getDetailedDailyWeatherContext(): Promise<DailyDetailedContext> {
  const [current, localForecast, nineDay, specialTips, warnings] = await Promise.all([
    getDetailedCurrentWeather(),
    getLocalForecast(),
    getNineDayForecastOverview(),
    getSpecialWeatherTips(),
    getWarningSnapshot(),
  ]);

  return {
    current,
    localForecast,
    nineDay,
    specialTips,
    warnings,
  };
}

export function buildDetailedDailyBriefing(context: DailyDetailedContext): string {
  const lines: string[] = ["以下為香港天文台詳盡天氣資料：", ""];
  const { current, localForecast, nineDay, specialTips, warnings } = context;

  lines.push(
    "【現時天氣報告】",
    `更新時間：${current.updateTime}`,
    `各區氣溫：${formatStationList(current.temperatures)}`,
    `相對濕度：${formatStationList(current.humidity)}`,
    `紫外線指數：${current.uvIndex}`,
    `過去一小時雨量（${current.rainfallPeriod}）：${formatStationList(current.rainfallByDistrict)}`,
    `天氣圖示更新時間：${current.weatherIconUpdateTime}`,
    `特別天氣提示：${current.warningMessage}`,
  );

  if (current.tropicalCycloneMessage) {
    lines.push(`熱帶氣旋相關消息：${current.tropicalCycloneMessage}`);
  }

  lines.push(
    "",
    "【本港地區天氣預測】",
    `更新時間：${localForecast.updateTime}`,
    `天氣概況：${localForecast.generalSituation || "無"}`,
    `熱帶氣旋資訊：${localForecast.tcInfo || "無"}`,
    `火災危險警告：${localForecast.fireDangerWarning || "無"}`,
    `${localForecast.forecastPeriod || "預測"}：${localForecast.forecastDesc || "無"}`,
    `展望：${localForecast.outlook || "無"}`,
  );

  lines.push(
    "",
    "【九天天氣預報概況】",
    `更新時間：${nineDay.updateTime}`,
    `天氣概況：${nineDay.generalSituation || "無"}`,
    `海水溫度：${nineDay.seaTemperature}`,
    `土壤溫度：${nineDay.soilTemperature}`,
  );

  if (nineDay.today) {
    lines.push("", formatDayForecastBlock("今日預報", nineDay.today));
  }

  for (const day of nineDay.upcomingDays) {
    lines.push("", formatDayForecastBlock("短期預報", day));
  }

  if (specialTips.tips.length > 0) {
    lines.push("", "【特別天氣消息】", `更新時間：${specialTips.updateTime}`);
    for (const tip of specialTips.tips) {
      lines.push(`- ${tip}`);
    }
  }

  if (warnings.hasNotification && warnings.message) {
    lines.push("", "【生效天氣警告】", warnings.message);
  }

  return lines.join("\n");
}

export function buildDetailedCurrentBriefing(context: DailyDetailedContext): string {
  const lines: string[] = ["以下為香港天文台現時及相關天氣資料：", ""];
  const { current, localForecast, nineDay, specialTips, warnings } = context;

  lines.push(
    "【現時天氣報告】",
    `更新時間：${current.updateTime}`,
    `各區氣溫：${formatStationList(current.temperatures)}`,
    `相對濕度：${formatStationList(current.humidity)}`,
    `紫外線指數：${current.uvIndex}`,
    `過去一小時雨量（${current.rainfallPeriod}）：${formatStationList(current.rainfallByDistrict)}`,
    `天氣圖示更新時間：${current.weatherIconUpdateTime}`,
    `特別天氣提示：${current.warningMessage}`,
  );

  if (current.tropicalCycloneMessage) {
    lines.push(`熱帶氣旋相關消息：${current.tropicalCycloneMessage}`);
  }

  lines.push(
    "",
    "【本港地區天氣預測】",
    `更新時間：${localForecast.updateTime}`,
    `天氣概況：${localForecast.generalSituation || "無"}`,
    `熱帶氣旋資訊：${localForecast.tcInfo || "無"}`,
    `火災危險警告：${localForecast.fireDangerWarning || "無"}`,
    `${localForecast.forecastPeriod || "預測"}：${localForecast.forecastDesc || "無"}`,
    `展望：${localForecast.outlook || "無"}`,
  );

  if (nineDay.today) {
    lines.push("", formatDayForecastBlock("今日餘下時間參考", nineDay.today));
  }

  if (specialTips.tips.length > 0) {
    lines.push("", "【特別天氣消息】", `更新時間：${specialTips.updateTime}`);
    for (const tip of specialTips.tips) {
      lines.push(`- ${tip}`);
    }
  }

  if (warnings.hasNotification && warnings.message) {
    lines.push("", "【生效天氣警告】", warnings.message);
  }

  return lines.join("\n");
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

function formatStationReadings(raw: unknown, valueSuffix = ""): StationReading[] {
  const container = asRecord(raw);
  const records = Array.isArray(container?.data) ? container.data : [];
  const unit = String(container?.unit || "");

  return records
    .map((record) => {
      const item = asRecord(record);
      if (!item || item.value === undefined || item.value === null) {
        return null;
      }

      const place = String(item.place || "未知地區");
      let valueText = String(item.value);
      if (unit === "C") {
        valueText = `${valueText}°C`;
      } else if (unit === "percent") {
        valueText = `${valueText}%`;
      } else if (unit) {
        valueText = `${valueText}${unit}`;
      } else if (valueSuffix) {
        valueText = `${valueText}${valueSuffix}`;
      }

      return { place, value: valueText };
    })
    .filter((item): item is StationReading => item !== null);
}

function formatStationList(readings: StationReading[]): string {
  if (readings.length === 0) {
    return "未能取得";
  }

  return readings.map((reading) => `${reading.place} ${reading.value}`).join("；");
}

function formatRainfallByDistrict(container: Record<string, unknown> | undefined): StationReading[] {
  const records = Array.isArray(container?.data) ? container.data.filter(isRecord) : [];
  const unit = String(container?.unit || "mm");

  return records.map((record) => ({
    place: String(record.place || "未知地區"),
    value: `${String(record.max ?? 0)}${unit}`,
  }));
}

function formatRainfallPeriod(container: Record<string, unknown> | undefined): string {
  const start = container?.startTime ? formatDateTime(String(container.startTime)) : "";
  const end = container?.endTime ? formatDateTime(String(container.endTime)) : "";
  if (start && end) {
    return `${start} 至 ${end}`;
  }
  return "未知";
}

function formatSeaTemperature(raw: unknown): string {
  const record = asRecord(raw);
  if (!record || record.value === undefined || record.value === null) {
    return "未能取得";
  }

  const place = String(record.place || "未知地點");
  const unit = String(record.unit || "C");
  const time = record.recordTime ? formatDateTime(String(record.recordTime)) : "";
  const value = `${place} ${String(record.value)}°${unit}`;
  return time ? `${value}（${time}）` : value;
}

function formatSoilTemperature(raw: unknown): string {
  if (!Array.isArray(raw) || raw.length === 0) {
    return "未能取得";
  }

  return raw
    .map((item) => {
      const record = asRecord(item);
      if (!record || record.value === undefined || record.value === null) {
        return null;
      }

      const place = String(record.place || "未知地點");
      const depth = asRecord(record.depth);
      const depthValue = depth?.value !== undefined ? `${String(depth.value)}${String(depth.unit || "m")}` : "";
      const unit = String(record.unit || "C");
      const depthLabel = depthValue ? ` 深度${depthValue}` : "";
      return `${place}${depthLabel} ${String(record.value)}°${unit}`;
    })
    .filter(Boolean)
    .join("；");
}

function formatTextList(raw: unknown): string {
  if (!Array.isArray(raw) || raw.length === 0) {
    return "";
  }

  return raw
    .map((item) => String(item).trim())
    .filter(Boolean)
    .join("\n");
}

function formatDayForecastBlock(label: string, day: DayForecast): string {
  return [
    `【${label}：${day.date}（${day.week}）】`,
    `天氣：${day.weather}`,
    `氣溫：${day.minTemp} - ${day.maxTemp}`,
    `相對濕度：${day.minRh} - ${day.maxRh}`,
    `風向風速：${day.wind}`,
    `降雨概率：${day.rainProbability || "無"}`,
  ].join("\n");
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
