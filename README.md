# HKO Weather Telegram Bot

一個使用香港天文台 Open Data API 的 Telegram bot，以 Bun + TypeScript 開發：

- 每日香港時間 07:00 發送即時天氣報告
- 定期輪詢香港天文台天氣警告
- 有新警告、警告內容更新或警告取消時，即時傳送 Telegram 訊息

## 啟動方式

這個 repo 只保留 Bun 版本，支援兩種部署：

- **Cloudflare Workers**：用 Cron Triggers 定時執行，KV 儲存上一個警告狀態
- **Bun Docker / Docker Compose**：用 Bun 長駐執行，檔案儲存上一個警告狀態

## 需求

- Bun
- Telegram bot token
- 你的 Telegram chat id
- Cloudflare 用法：Wrangler、Cloudflare KV namespace
- Docker 用法：Docker 或 Docker Compose

## 建立 Telegram bot

1. 在 Telegram 找 `@BotFather`
2. 使用 `/newbot` 建立 bot
3. 複製 BotFather 給你的 token
4. 向你的 bot 發送一則訊息
5. 打開以下網址取得 `chat.id`：

   ```text
   https://api.telegram.org/bot<你的_bot_token>/getUpdates
   ```

## 安裝與檢查

```bash
bun install
bun run typecheck
```

## 設定

| 變數 | 預設值 | 說明 |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | 必填 | Telegram bot token |
| `TELEGRAM_CHAT_ID` | 必填 | 接收訊息的 chat id |
| `DAILY_REPORT_TIME` | `07:00` | Docker 長駐模式每日天氣報告時間，格式 `HH:MM`，香港時間 |
| `WARNING_POLL_SECONDS` | `300` | Docker 長駐模式天氣警告輪詢秒數 |
| `STATE_FILE` | `.hkoweather_bot_state.json` | Docker 長駐模式記錄上一個警告狀態 |

## Bun Docker / Docker Compose

Docker 版會長駐執行：

- 每日香港時間 `DAILY_REPORT_TIME` 發送天氣報告
- 按 `WARNING_POLL_SECONDS` 輪詢天氣警告
- 用 `STATE_FILE` 記錄上一個警告狀態，避免重複發送

### Docker Compose

```bash
cp .env.example .env
```

編輯 `.env`：

```env
TELEGRAM_BOT_TOKEN=123456789:replace_with_your_bot_token
TELEGRAM_CHAT_ID=replace_with_your_chat_id
```

啟動：

```bash
docker compose up -d --build
```

查看 log：

```bash
docker compose logs -f hkoweather-bot
```

停止：

```bash
docker compose down
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

### 本機用 Bun 長駐啟動

```bash
cp .env.example .env
bun install
bun run start
```

## Cloudflare Workers

Cloudflare Worker 不會長駐，而是靠 Cron Triggers 執行：

- `0 23 * * *`：UTC 23:00，即香港時間每日 07:00，發送每日天氣報告
- `*/5 * * * *`：每 5 分鐘檢查一次天氣警告

### 建立 KV namespace

```bash
bunx wrangler kv namespace create HKO_BOT_STATE
```

把輸出的 `id` 填入 `wrangler.toml`：

```toml
[[kv_namespaces]]
binding = "HKO_BOT_STATE"
id = "你的_kv_namespace_id"
```

### 設定 Telegram secret

```bash
bunx wrangler secret put TELEGRAM_BOT_TOKEN
```

`TELEGRAM_CHAT_ID` 可直接放在 `wrangler.toml` 的 `[vars]`，或你也可以改用 secret：

```bash
bunx wrangler secret put TELEGRAM_CHAT_ID
```

### 本機 Worker 開發

```bash
bun run worker:dev
```

### 部署

```bash
bun run worker:deploy
```