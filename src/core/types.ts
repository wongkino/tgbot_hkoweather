export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
}

export interface TelegramKeyboardButton {
  text: string;
}

export interface TelegramReplyKeyboardMarkup {
  keyboard: TelegramKeyboardButton[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  is_persistent?: boolean;
}

export interface TelegramMessageOptions {
  chatId?: TelegramChatId;
  replyMarkup?: TelegramReplyKeyboardMarkup;
}

export interface StateStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export type TelegramChatId = number | string;

export interface TelegramChat {
  id: TelegramChatId;
}

export interface TelegramMessage {
  chat: TelegramChat;
  text?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export interface TelegramCommand {
  chatId: TelegramChatId;
  text: string;
}

export interface CurrentWeather {
  temperature: string;
  humidity: string;
  uvIndex: string;
  rainfall: string;
  updateTime: string;
  warningMessage: string;
}

export interface WarningSnapshot {
  signature: string;
  message: string;
  hasNotification: boolean;
}

export interface LocalForecast {
  generalSituation: string;
  tcInfo: string;
  fireDangerWarning: string;
  forecastPeriod: string;
  forecastDesc: string;
  outlook: string;
  updateTime: string;
}

export interface StationReading {
  place: string;
  value: string;
}

export interface DetailedCurrentWeather {
  updateTime: string;
  temperatures: StationReading[];
  humidity: StationReading[];
  uvIndex: string;
  rainfallByDistrict: StationReading[];
  rainfallPeriod: string;
  warningMessage: string;
  tropicalCycloneMessage: string;
  weatherIconUpdateTime: string;
}

export interface NineDayForecastOverview {
  generalSituation: string;
  seaTemperature: string;
  soilTemperature: string;
  updateTime: string;
  today: DayForecast | null;
  upcomingDays: DayForecast[];
}

export interface SpecialWeatherTips {
  tips: string[];
  updateTime: string;
}

export interface DailyDetailedContext {
  current: DetailedCurrentWeather;
  localForecast: LocalForecast;
  nineDay: NineDayForecastOverview;
  specialTips: SpecialWeatherTips;
  warnings: WarningSnapshot;
}

export interface DayForecast {
  date: string;
  week: string;
  weather: string;
  minTemp: string;
  maxTemp: string;
  minRh: string;
  maxRh: string;
  wind: string;
  rainProbability: string;
}

export interface DailyWeatherContext {
  current: CurrentWeather;
  localForecast: LocalForecast;
  todayForecast: DayForecast | null;
  warnings: WarningSnapshot;
}
