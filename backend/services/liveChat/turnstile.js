// Cloudflare Turnstile verification for the contact form.
//
// Secret: TURNSTILE_SECRET_KEY. Outside production a missing secret falls back to Cloudflare's published
// "always passes" test key, so local development works; in production a missing secret refuses the form (fail
// closed). Network errors also fail closed.
const { readTurnstileSecret } = require("../../utils/liveChat/config");

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

async function verifyTurnstile({ token, ip, env = process.env, fetchImpl = fetch, timeoutMs = 5000 }) {
  const secret = readTurnstileSecret(env);
  if (!secret) return { ok: false, reason: "not_configured" };
  if (!token || typeof token !== "string" || token.length > 2048) return { ok: false, reason: "missing_token" };

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetchImpl(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { ok: false, reason: "verify_unavailable" };
    const data = await res.json();
    return data?.success === true ? { ok: true } : { ok: false, reason: "failed" };
  } catch {
    return { ok: false, reason: "verify_unavailable" };
  }
}

module.exports = { verifyTurnstile, VERIFY_URL };
