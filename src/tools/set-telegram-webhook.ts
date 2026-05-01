const botToken = requiredEnv("TELEGRAM_BOT_TOKEN");
const webhookUrl = requiredEnv("TELEGRAM_WEBHOOK_URL");
const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

const url = new URL(`https://api.telegram.org/bot${botToken}/setWebhook`);
url.searchParams.set("url", webhookUrl);
url.searchParams.set("allowed_updates", JSON.stringify(["message"]));
if (secretToken) {
  url.searchParams.set("secret_token", secretToken);
}

const response = await fetch(url.toString());
const body = await response.text();
if (!response.ok) {
  throw new Error(`Telegram setWebhook failed with ${response.status}: ${body}`);
}

const payload = JSON.parse(body) as { ok?: boolean; description?: string };
if (!payload.ok) {
  throw new Error(`Telegram setWebhook failed: ${payload.description ?? body}`);
}

console.log(payload.description ?? "Telegram webhook configured.");

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name} environment variable.`);
  }
  return value;
}

export {};
