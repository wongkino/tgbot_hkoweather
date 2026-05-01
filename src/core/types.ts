export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export interface StateStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
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
