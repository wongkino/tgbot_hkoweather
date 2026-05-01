# HKO Weather Telegram Bot

一個使用香港天文台 Open Data API 的 Telegram bot，以 Bun + TypeScript 開發：

- 每日香港時間 07:00 發送即時天氣報告
- 定期輪詢香港天文台天氣警告
- 有新警告、警告內容更新或警告取消時，即時傳送 Telegram 訊息
- 支援 Telegram 指令手動查詢現在天氣

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

## 檔案結構

```text
src/
  core/                 # 共用 bot 邏輯，Cloudflare 與 Docker 都會使用
    hko.ts              # 香港天文台 Open Data API 讀取與格式化
    messages.ts         # Telegram 訊息內容
    telegram.ts         # Telegram Bot API 發送
    types.ts            # 共用型別與 state store 介面
    weather-bot.ts      # 每日天氣與警告通知流程
  runtime/
    cloudflare/         # Cloudflare Workers 入口
    docker/             # Bun 長駐 / Docker 入口、設定、排程與檔案 state
```

## 設定

| 變數 | 預設值 | 說明 |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | 必填 | Telegram bot token |
| `TELEGRAM_CHAT_ID` | 必填 | 接收訊息的 chat id |
| `DAILY_REPORT_TIME` | `07:00` | Docker 長駐模式每日天氣報告時間，格式 `HH:MM`，香港時間 |
| `WARNING_POLL_SECONDS` | `300` | Docker 長駐模式天氣警告輪詢秒數 |
| `STATE_FILE` | `.hkoweather_bot_state.json` | Docker 長駐模式記錄上一個警告狀態 |

## Telegram 指令

| 指令 | 說明 |
| --- | --- |
| `/weather` | 立即推送現在天氣 |
| `/now` | 立即推送現在天氣 |
| `/help` | 顯示可用指令 |

Docker / Bun 長駐模式會自動用 Telegram `getUpdates` 輪詢指令。

你也可以在 BotFather 用 `/setcommands` 加入：

```text
weather - 立即取得現在天氣
now - 立即取得現在天氣
help - 顯示可用指令
```

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

### Docker Compose 熱啟動 / 開發模式

熱啟動模式會把本機專案掛載到 container，並用 `bun --watch` 監聽 `src/` 變更後自動重啟。

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up --build
```

查看 log：

```bash
docker compose -f docker-compose.dev.yml logs -f hkoweather-bot
```

停止：

```bash
docker compose -f docker-compose.dev.yml down
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

本機熱啟動：

```bash
bun run start:watch
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
bunx wrangler secret put TELEGRAM_CHAT_ID
```

### GitHub Actions 自動部署

push 到 `main` 時會自動部署到 Cloudflare Workers。你需要先在 GitHub repo 設定以下 secrets：

| Secret | 說明 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token，需要 Workers deploy 權限 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account id |
| `HKO_BOT_STATE_KV_NAMESPACE_ID` | `HKO_BOT_STATE` KV namespace id |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token，workflow 會寫入 Worker secret |
| `TELEGRAM_CHAT_ID` | 接收訊息的 Telegram chat id，workflow 會寫入 Worker secret |

workflow 會執行：

1. `bun install --frozen-lockfile`
2. `bun run typecheck`
3. 生成 CI 用 Wrangler config
4. 部署 Worker
5. 用 `wrangler secret put` 更新 Telegram secrets

### 設定 Telegram webhook

Cloudflare Workers 版要接收 `/weather` 指令，需要把 Telegram webhook 指向 Worker URL：

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<你的_worker_url>"
```

你也可以在 BotFather 用 `/setcommands` 加入：

```text
weather - 立即取得現在天氣
now - 立即取得現在天氣
help - 顯示可用指令
```

### 本機 Worker 開發

```bash
bun run worker:dev
```

### 部署

```bash
bun run worker:deploy
```