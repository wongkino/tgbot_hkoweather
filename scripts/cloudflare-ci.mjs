import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const KV_NAMESPACE_NAME = process.env.HKO_BOT_STATE_KV_NAMESPACE_NAME ?? "tgbot_hkoweather";
const WORKER_NAME = process.env.CLOUDFLARE_WORKER_NAME ?? "hko-weather-telegram-bot";
const WRANGLER_CONFIG = process.env.WRANGLER_CONFIG ?? "wrangler.ci.toml";

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name} environment variable.`);
  }
  return value;
}

function wrangler(args) {
  return execFileSync("bunx", ["wrangler", ...args], {
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function ensureKvNamespaceId() {
  const namespaces = JSON.parse(wrangler(["kv", "namespace", "list"]));
  const existing = namespaces.find((item) => item.title === KV_NAMESPACE_NAME);
  if (existing?.id) {
    return existing.id;
  }

  wrangler(["kv", "namespace", "create", KV_NAMESPACE_NAME, "--binding", "HKO_BOT_STATE"]);
  const refreshed = JSON.parse(wrangler(["kv", "namespace", "list"]));
  const created = refreshed.find((item) => item.title === KV_NAMESPACE_NAME);
  if (!created?.id) {
    throw new Error(`Unable to determine KV namespace id for ${KV_NAMESPACE_NAME}.`);
  }
  return created.id;
}

function writeWranglerCiConfig(kvId) {
  const template = readFileSync("wrangler.toml", "utf8");
  const config = template.replace("replace_with_your_kv_namespace_id", kvId);
  writeFileSync(WRANGLER_CONFIG, config);
}

function writeSecretsFile(webhookSetupSecret) {
  const lines = [
    `TELEGRAM_BOT_TOKEN=${requiredEnv("TELEGRAM_BOT_TOKEN")}`,
    `TELEGRAM_CHAT_ID=${requiredEnv("TELEGRAM_CHAT_ID")}`,
    `TELEGRAM_WEBHOOK_SETUP_SECRET=${webhookSetupSecret}`,
  ];

  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (webhookSecret) {
    lines.push(`TELEGRAM_WEBHOOK_SECRET=${webhookSecret}`);
  }

  const openRouterApiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openRouterApiKey) {
    lines.push(`OPENROUTER_API_KEY=${openRouterApiKey}`);
  }

  writeFileSync("wrangler.ci.secrets.env", `${lines.join("\n")}\n`);
}

async function resolveWorkerUrl() {
  const accountId = requiredEnv("CLOUDFLARE_ACCOUNT_ID");
  const apiToken = requiredEnv("CLOUDFLARE_API_TOKEN");

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`,
    {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(`Failed to resolve workers.dev subdomain: ${JSON.stringify(payload)}`);
  }

  const subdomain = payload.result?.subdomain?.trim();
  if (!subdomain) {
    throw new Error("Cloudflare API returned an empty workers.dev subdomain.");
  }

  return `https://${WORKER_NAME}.${subdomain}.workers.dev`;
}

function deployWorker() {
  wrangler(["deploy", "--config", WRANGLER_CONFIG, "--secrets-file", "wrangler.ci.secrets.env"]);
}

async function setTelegramWebhook(workerUrl, webhookSetupSecret) {
  const response = await fetch(`${workerUrl}/telegram/set-webhook`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${webhookSetupSecret}`,
      "content-type": "application/json",
    },
    body: "{}",
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Telegram webhook setup failed (${response.status}): ${body}`);
  }
}

const command = process.argv[2] ?? "deploy";

if (command === "deploy") {
  const kvId = ensureKvNamespaceId();
  writeWranglerCiConfig(kvId);

  const webhookSetupSecret = randomBytes(32).toString("hex");
  writeSecretsFile(webhookSetupSecret);
  deployWorker();

  const workerUrl = await resolveWorkerUrl();
  await setTelegramWebhook(workerUrl, webhookSetupSecret);

  console.log(`Deployed ${WORKER_NAME} to ${workerUrl}`);
} else {
  throw new Error(`Unknown command: ${command}`);
}
