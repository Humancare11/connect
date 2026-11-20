const { normalizeBaseUrl } = require("../email/emailSettings");

// Email Marketing settings, all from the environment and read on every call (so tests and a restart-free
// change in dev see current values). Nothing here is a secret except the unsubscribe secret, which is only
// ever used to sign, never printed or logged.
const positive = (value, fallback) => (Number(value) > 0 ? Number(value) : fallback);

function marketingConfig(env = process.env) {
  return {
    // Master switch. Off: no admin API, no sending worker. (Unsubscribe links, tracking links and the SES
    // event endpoint of mail that is already out keep working.)
    enabled: env.MARKETING_ENABLED === "true",
    region: String(env.SES_REGION || "ap-south-1").trim(),
    configurationSet: String(env.SES_CONFIGURATION_SET || "").trim(),
    snsTopicArn: String(env.SES_SNS_TOPIC_ARN || "").trim(),
    // Sends per second. Keep it below the account's SES limit (1 per second in the sandbox).
    sendRatePerSecond: positive(env.SES_MAX_SEND_RATE, 1),
    dailyCap: Math.floor(positive(env.MARKETING_DAILY_CAP, 500)),
    maxRecipients: Math.floor(positive(env.MARKETING_MAX_RECIPIENTS, 2000)),
    leaseSeconds: Math.floor(positive(env.MARKETING_LEASE_SECONDS, 120)),
    retentionMonths: Math.floor(positive(env.MARKETING_RETENTION_MONTHS, 12)),
    tickMs: Math.floor(positive(env.MARKETING_TICK_MS, 1000)),
    unsubscribeSecret: String(env.MARKETING_UNSUB_SECRET || ""),
    footerAddress: String(env.MARKETING_FOOTER_ADDRESS || "").replace(/[\r\n]+/g, " ").trim(),
    // Unsubscribe and tracking links share the host of the existing tracking links.
    baseUrl: normalizeBaseUrl(env.PUBLIC_TRACKING_BASE_URL),
    // Extra hosts (comma separated) whose pages report the "?r=" click code. humancareconnect.co, www. and the host
    // of PUBLIC_TRACKING_BASE_URL are always included.
    siteHosts: String(env.MARKETING_SITE_HOSTS || ""),
    testsPer10Min: Math.floor(positive(env.MARKETING_TESTS_PER_10_MIN, 10)),
  };
}

// What is still missing before a real send may start. Names only, never values.
function sendReadiness(cfg = marketingConfig()) {
  const missing = [];
  if (cfg.unsubscribeSecret.length < 32) missing.push("MARKETING_UNSUB_SECRET (at least 32 characters)");
  if (!cfg.footerAddress) missing.push("MARKETING_FOOTER_ADDRESS");
  if (!cfg.configurationSet) missing.push("SES_CONFIGURATION_SET");
  if (!cfg.baseUrl) missing.push("PUBLIC_TRACKING_BASE_URL (public https URL)");
  return missing;
}

module.exports = { marketingConfig, sendReadiness };
