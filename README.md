# HKO Weather Telegram Bot

一個使用香港天文台 Open Data API 的 Telegram bot：

- 每日香港時間 07:00 發送即時天氣報告
- 定期輪詢香港天文台天氣警告
- 有新警告、警告內容更新或警告取消時，即時傳送 Telegram 訊息

## 需求

- Python 3.11+
- Telegram bot token
- 你的 Telegram chat id

## 建立 Telegram bot

1. 在 Telegram 找 `@BotFather`
2. 使用 `/newbot` 建立 bot
3. 複製 BotFather 給你的 token
4. 向你的 bot 發送一則訊息
5. 打開以下網址取得 `chat.id`：

   ```text
   https://api.telegram.org/bot<你的_bot_token>/getUpdates
   ```

## 本機啟動

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

編輯 `.env`：

```env
TELEGRAM_BOT_TOKEN=123456789:replace_with_your_bot_token
TELEGRAM_CHAT_ID=replace_with_your_chat_id
```

啟動：

```bash
python3 -m hkoweather_bot.main
```

## 設定

| 變數 | 預設值 | 說明 |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | 必填 | Telegram bot token |
| `TELEGRAM_CHAT_ID` | 必填 | 接收訊息的 chat id |
| `TZ` | `Asia/Hong_Kong` | 排程時區 |
| `DAILY_REPORT_TIME` | `07:00` | 每日天氣報告時間，格式 `HH:MM` |
| `WARNING_POLL_SECONDS` | `300` | 天氣警告輪詢秒數 |
| `STATE_FILE` | `.hkoweather_bot_state.json` | 記錄上一個警告狀態，避免重複發送 |

## 測試

```bash
pytest
```