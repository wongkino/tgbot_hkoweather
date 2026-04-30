# HKO Weather Telegram Bot

一個使用香港天文台 Open Data API 的 Telegram bot：

- 每日香港時間 07:00 發送即時天氣報告
- 定期輪詢香港天文台天氣警告
- 有新警告、警告內容更新或警告取消時，即時傳送 Telegram 訊息

## 部署方式

這個 repo 同時支援：

- **Cloudflare Workers**：用 Cron Triggers 定時執行，KV 儲存上一個警告狀態
- **Docker / Docker Compose**：跑 Python 長駐服務，適合 VPS、NAS 或任何 container 平台

## 需求

- Telegram bot token
- 你的 Telegram chat id
- Docker 用法：Python 3.11+ 或 Docker
- Cloudflare 用法：Node.js 20+、Wrangler、Cloudflare KV namespace

## 建立 Telegram bot

1. 在 Telegram 找 `@BotFather`
2. 使用 `/newbot` 建立 bot
3. 複製 BotFather 給你的 token
4. 向你的 bot 發送一則訊息
5. 打開以下網址取得 `chat.id`：

   ```text
   https://api.telegram.org/bot<你的_bot_token>/getUpdates
   ```

## Docker / Python 版

Python 版會長駐執行：

- 每日香港時間 07:00 發送天氣報告
- 按 `WARNING_POLL_SECONDS` 輪詢天氣警告
- 用 `STATE_FILE` 記錄上一個警告狀態，避免重複發送

### 本機啟動

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
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
python3 -m pytest
```

### Docker Compose

```bash
cp .env.example .env
docker compose up -d --build
```

查看 log：

```bash
docker compose logs -f hkoweather-bot
```

### Docker

```bash
docker build -t hko-weather-telegram-bot .
docker run -d --name hko-weather-telegram-bot \
  --env-file .env \
  -v hko-weather-state:/app/state \
  -e STATE_FILE=/app/state/.hkoweather_bot_state.json \
  --restart unless-stopped \
  hko-weather-telegram-bot
```

## Cloudflare Workers 版

Cloudflare Worker 不會長駐，而是靠 Cron Triggers 執行：

- `0 23 * * *`：UTC 23:00，即香港時間每日 07:00，發送每日天氣報告
- `*/5 * * * *`：每 5 分鐘檢查一次天氣警告

### 安裝工具

```bash
npm install
```

### 建立 KV namespace

```bash
npx wrangler kv namespace create HKO_BOT_STATE
```

把輸出的 `id` 填入 `wrangler.toml`：

```toml
[[kv_namespaces]]
binding = "HKO_BOT_STATE"
id = "你的_kv_namespace_id"
```

### 設定 Telegram secret

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
```

`TELEGRAM_CHAT_ID` 可直接放在 `wrangler.toml` 的 `[vars]`，或你也可以改用 secret：

```bash
npx wrangler secret put TELEGRAM_CHAT_ID
```

### 檢查與部署

```bash
npm run worker:typecheck
npm run worker:deploy
```