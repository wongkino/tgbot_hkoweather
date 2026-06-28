# AGENTS.md

## Cursor Cloud specific instructions

This repo is a **Bun + TypeScript** Telegram bot for Hong Kong Observatory (HKO) weather.
There is **no test suite**; the only static check is `bun run typecheck` (`tsc --noEmit`).
See `README.md` for full command reference and configuration variables.

### Toolchain

- Runtime/package manager is **Bun** (`package.json` `packageManager: bun@1.3.13`). Bun is not part of the
  base image; it is installed during environment setup and is on `PATH` via `/usr/local/bin/bun`
  (symlinked to `~/.bun/bin/bun`). The startup update script runs `bun install`.
- Node is also present but the app is meant to run under Bun.

### Services / how to run

There is a single app with two interchangeable runtimes (no database; state is a KV namespace or a JSON file):

- **Docker / long-running Bun runtime** (`src/runtime/docker`): `bun run start` (or `bun run start:watch`
  for hot reload). It is a long-lived process: schedules the daily report, polls HKO warnings, and polls
  Telegram for commands. It requires `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` or it throws on startup.
- **Cloudflare Workers runtime** (`src/runtime/cloudflare`): `bun run worker:dev` (i.e. `wrangler dev`)
  serves locally on `127.0.0.1:8787`. Cron-driven in production; `wrangler dev` runs with a **local** KV
  binding and does **not** auto-trigger scheduled events (trigger manually via
  `curl http://127.0.0.1:8787/cdn-cgi/handler/scheduled`).

### Non-obvious caveats

- The **HKO Open Data API is public** (no key), so the core data-fetch + report-formatting path can be
  exercised end-to-end without any secrets (e.g. import `buildWeatherReportMessage` from
  `src/core/weather-context.ts`). This is the best way to validate core logic offline from Telegram.
- **Telegram sending/polling needs real credentials.** With a placeholder `TELEGRAM_BOT_TOKEN` the Docker
  runtime still boots and keeps running — Telegram API calls just fail with `401`, and `runSafely`
  (`src/runtime/docker/scheduler.ts`) swallows the errors so the process stays alive. So a 401 from
  `getUpdates`/`sendMessage` during local runs only means the token is missing, not that the app is broken.
- `OPENROUTER_API_KEY` is optional; without it the bot sends the raw HKO report instead of an AI summary.
- `wrangler.toml` ships a placeholder KV namespace id (`replace_with_your_kv_namespace_id`); this is fine
  for `wrangler dev` (local KV) but real deploys use `scripts/cloudflare-ci.mjs` which writes
  `wrangler.ci.toml` with the real id.
