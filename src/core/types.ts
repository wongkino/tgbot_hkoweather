export interface TelegramConfig {
  botToken: string;
  chatId: string;
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
