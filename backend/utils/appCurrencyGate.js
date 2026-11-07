// utils/appCurrencyGate.js
//
// Keeps mobile-app builds that cannot handle EUR / GBP / INR on exactly today's behaviour: USD, charged through the same gateways as
// before. The old patient app compares every Stripe intent against the USD price it displays and refuses anything else ("The price for
// this appointment changed"), shows "$" everywhere and has no Razorpay, so a non-USD answer would block its bookings.
// Only the CURRENCY is decided here. Gateways are not touched: USD is still taken by Stripe or PayPal, as it is today.
//
// Who is an app, and which build:
//   - A build from +16 on declares itself: X-Client-Platform: android|ios and X-App-Version: 1.0.0+17 (see utils/clientInfo.js and
//     utils/appVersion.js), and its HTTP stack's User-Agent is a native one (Dart / okhttp / CFNetwork).
//   - Older builds send nothing, but their native User-Agent gives them away ("inferred"): no build is known, so they are treated as
//     the oldest build.
//   - Everything else (browsers, curl, anything without a User-Agent) is not an app and is never touched by this file. App headers
//     that arrive on a User-Agent that is NOT a native one (a browser or script claiming to be the app) are treated as web too:
//     "suspect". A real app never looks like that, and it would otherwise let a browser pick the USD price.
//
// Rule for an app request:
//   - inferred (no headers)                         -> USD
//   - declared, but no readable build               -> USD
//   - declared, APP_MIN_CURRENCY_BUILD_<P> unset/0  -> USD   (safe default: until the currency release is named, every app is USD)
//   - declared, build below APP_MIN_CURRENCY_BUILD  -> USD
//   - declared, build at or above it                -> the normal decision; INR only if the build also sends
//                                                      X-Client-Capabilities: razorpay (the app can pay rupees), else USD.
//
// This only picks a currency. It is NOT access control: every input is client-chosen. A script that fakes a native User-Agent AND
// the headers can still get the USD price. Every change the gate makes to an answer is logged as [APP_GATE_USED].
const { detectRegistrationClient, inferNativeApp } = require("./clientInfo");
const { parseBuild } = require("./appVersion");

const PLATFORM_SUFFIX = { android: "ANDROID", ios: "IOS" };

const header = (req, name) => {
  const raw = req?.headers?.[name];
  return String(Array.isArray(raw) ? raw[0] : raw || "").trim();
};

// APP_MIN_CURRENCY_BUILD_<P>: the first app build that may be priced in EUR / GBP / INR. 0 = not set.
function minCurrencyBuild(platform, env = process.env) {
  const suffix = PLATFORM_SUFFIX[platform];
  if (!suffix) return 0;
  const n = Number.parseInt(String(env[`APP_MIN_CURRENCY_BUILD_${suffix}`] ?? "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Does this app build say it can pay in rupees (the Razorpay checkout)? "X-Client-Capabilities: razorpay" (comma separated list).
function hasRazorpayCapability(req) {
  return header(req, "x-client-capabilities")
    .toLowerCase()
    .split(",")
    .some((item) => item.trim() === "razorpay");
}

// -> { isApp, usdOnly, noInr, reason, platform, build, source, suspect }
//   usdOnly: price and charge this request in USD, whatever its IP says.
//   noInr:   an allowed app that cannot pay rupees: India resolves to USD instead of INR.
//   suspect: app headers on a non-native User-Agent; the request is treated as web (isApp false).
function evaluateAppCurrencyGate(req, env = process.env) {
  const none = { isApp: false, usdOnly: false, noInr: false, reason: "not-app", platform: "", build: null, source: "", suspect: false };

  const client = detectRegistrationClient(req);
  if (client.registrationPlatform !== "app") return none;

  const source = client.registrationPlatformSource; // "header" | "inferred"
  const platform = client.registrationSubType; // android | ios | unknown
  const build = parseBuild(client.registrationAppVersion);

  if (source === "header" && !inferNativeApp(header(req, "user-agent"))) {
    return { ...none, reason: "suspect-web", platform, build, source, suspect: true };
  }

  const base = { isApp: true, noInr: false, platform, build, source, suspect: false };

  if (source === "inferred") return { ...base, usdOnly: true, reason: "inferred" };
  if (build === null) return { ...base, usdOnly: true, reason: "no-build" };

  const min = minCurrencyBuild(platform, env);
  if (min <= 0) return { ...base, usdOnly: true, reason: "min-unset" };
  if (build < min) return { ...base, usdOnly: true, reason: "below-min" };

  return { ...base, usdOnly: false, noInr: !hasRazorpayCapability(req), reason: "allowed" };
}

const clean = (value, max) =>
  String(value || "")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/"/g, "'")
    .slice(0, max);

// [APP_GATE_USED] is written whenever the gate changes an answer (a request that would have been priced in another currency, or
// rupees an app cannot pay) or refuses to believe app headers (suspect=true). A spike, or a browser User-Agent among them, is easy to
// find. `from` / `to` say what changed, e.g. "local" -> "USD".
function logAppGateUsed(req, gate, { from, to, logger = console.warn } = {}) {
  logger(
    `[APP_GATE_USED] reason=${gate.reason} from=${from} to=${to} platform=${gate.platform || "-"} build=${gate.build ?? "-"} ` +
      `source=${gate.source || "-"} suspect=${gate.suspect} path=${clean(req?.originalUrl || req?.url, 80) || "-"} ` +
      `ua="${clean(header(req, "user-agent"), 160)}"`,
  );
}

module.exports = { evaluateAppCurrencyGate, hasRazorpayCapability, minCurrencyBuild, logAppGateUsed };
