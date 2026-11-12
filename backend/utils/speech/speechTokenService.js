// Mints short-lived Azure Speech tokens so the browser never sees the key.
//
//   • The Azure token lives 10 minutes. We cache one for 4 minutes and share it, so every caller gets a token with at least
//     about 6 minutes left, and a call with many refreshes does not hit Azure each time.
//   • Concurrent requests share one Azure call (no stampede after the cache expires).
//   • A per-person, per-appointment counter bounds how many tokens one call can fetch (cost cap for a call left open).
//   • Neither the key nor a token is ever logged; failures log the HTTP status or the error name only.
const { getSpeechConfig } = require("./config");

const TOKEN_LIFETIME_MS = 10 * 60 * 1000;
const CACHE_MS = 4 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const COUNTER_TTL_MS = 24 * 60 * 60 * 1000;

class SpeechTokenError extends Error {
  constructor(code, httpStatus) {
    super(code);
    this.name = "SpeechTokenError";
    this.code = code; // not_configured | azure_rejected | azure_unreachable
    this.httpStatus = httpStatus;
  }
}

function createSpeechTokenService({
  fetchFn = (...args) => fetch(...args),
  now = () => Date.now(),
  getConfig = () => getSpeechConfig(),
} = {}) {
  let cached = null; // { token, region, issuedAt }
  let inflight = null;
  const counters = new Map(); // "appointmentId:userId" -> { count, firstAt }

  async function requestFromAzure(cfg) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetchFn(`https://${cfg.region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
        method: "POST",
        headers: { "Ocp-Apim-Subscription-Key": cfg.key, "Content-Length": "0" },
        signal: controller.signal,
      });
      if (!res.ok) {
        console.warn(`[speech-token] Azure refused the token request (HTTP ${res.status}).`);
        throw new SpeechTokenError("azure_rejected", 502);
      }
      const token = String(await res.text()).trim();
      if (!token) throw new SpeechTokenError("azure_rejected", 502);
      return { token, region: cfg.region, issuedAt: now() };
    } catch (err) {
      if (err instanceof SpeechTokenError) throw err;
      console.warn(`[speech-token] Azure token request failed (${err?.name || "error"}).`);
      throw new SpeechTokenError("azure_unreachable", 502);
    } finally {
      clearTimeout(timer);
    }
  }

  const view = (c) => ({
    token: c.token,
    region: c.region,
    expiresInSeconds: Math.max(0, Math.floor((c.issuedAt + TOKEN_LIFETIME_MS - now()) / 1000)),
  });

  async function getToken() {
    const cfg = getConfig();
    if (!cfg.ok) throw new SpeechTokenError("not_configured", 503);
    if (cached && cached.region === cfg.region && now() - cached.issuedAt < CACHE_MS) return view(cached);
    if (!inflight) {
      inflight = requestFromAzure(cfg)
        .then((fresh) => { cached = fresh; return fresh; })
        .finally(() => { inflight = null; });
    }
    return view(await inflight);
  }

  // Counts one token fetch for this person on this appointment. Returns false once the cap is reached.
  function allowForAppointment(appointmentId, userId, max) {
    const t = now();
    for (const [k, v] of counters) if (t - v.firstAt > COUNTER_TTL_MS) counters.delete(k);
    const key = `${appointmentId}:${userId}`;
    const entry = counters.get(key) || { count: 0, firstAt: t };
    if (entry.count >= max) return false;
    entry.count += 1;
    counters.set(key, entry);
    return true;
  }

  return { getToken, allowForAppointment, _reset() { cached = null; inflight = null; counters.clear(); } };
}

module.exports = { createSpeechTokenService, SpeechTokenError, TOKEN_LIFETIME_MS, CACHE_MS };
