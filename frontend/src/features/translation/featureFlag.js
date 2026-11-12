// Live transcript / translation: is the feature on for this build and this server?
//
// Two switches, BOTH must be on:
//   • the build flag   VITE_TRANSCRIPTION_ENABLED=true   (frontend/.env.*; default unset = off)
//   • the server flag  TRANSCRIPTION_ENABLED=true         (backend env; reported by GET /api/transcription/config)
//
// With the build flag off this module makes NO network request and the call screen is exactly what it was before the feature existed.
// With it on but the server off (or the server unreachable / answering nonsense) the result is "inactive" too: this never throws and
// never lets a problem here break a call.
//
// Pure functions with the HTTP client passed in, so they can be tested without a browser.

export const CONFIG_PATH = "/api/transcription/config";
const DEFAULT_NOTICE_VERSION = "v1";

export const INACTIVE = Object.freeze({
  active: false,
  buildEnabled: false,
  serverEnabled: false,
  mode: "notice",
  noticeVersion: DEFAULT_NOTICE_VERSION,
});

// import.meta.env only exists inside Vite; tests pass their own env.
function defaultEnv() {
  try {
    return (typeof import.meta !== "undefined" && import.meta.env) || {};
  } catch {
    return {};
  }
}

export function isTranscriptionBuildEnabled(env = defaultEnv()) {
  return String((env && env.VITE_TRANSCRIPTION_ENABLED) ?? "").trim().toLowerCase() === "true";
}

// Whatever the server said, reduced to the three things we use; garbage becomes the safe default.
export function normalizeServerConfig(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const noticeVersion =
    typeof data.noticeVersion === "string" && /^[A-Za-z0-9._-]{1,20}$/.test(data.noticeVersion) ? data.noticeVersion : DEFAULT_NOTICE_VERSION;
  return {
    serverEnabled: data.enabled === true,
    mode: data.mode === "consent" ? "consent" : "notice",
    noticeVersion,
  };
}

// http: an axios-like client ({ get(url, options) -> { data } }). Returns the INACTIVE shape unless both switches are on.
export async function loadTranscriptionConfig({ http, buildEnabled = isTranscriptionBuildEnabled(), signal } = {}) {
  if (!buildEnabled) return INACTIVE; // flag off: not even a request
  if (!http || typeof http.get !== "function") return { ...INACTIVE, buildEnabled: true };
  try {
    const res = await http.get(CONFIG_PATH, signal ? { signal } : undefined);
    const server = normalizeServerConfig(res && res.data);
    if (!server) return { ...INACTIVE, buildEnabled: true };
    return { active: server.serverEnabled, buildEnabled: true, ...server };
  } catch {
    return { ...INACTIVE, buildEnabled: true }; // unreachable server, 401, 429...: feature stays off, the call goes on
  }
}
