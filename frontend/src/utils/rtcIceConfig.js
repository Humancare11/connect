// ICE helpers for the Direct Video Call page, kept as an independent module so
// it never has to import from (or risk changing) VideoCall.jsx.
//
// No TURN server or TURN credential is ever configured here: anything in a
// VITE_* variable ends up readable in the public bundle. TURN always comes from
// the backend's /ice-servers endpoint, which mints short-lived credentials. The
// build-time config below is STUN only and is the fallback when that fails.

const parseCsv = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const isTurnUrl = (url) => /^turns?:/i.test(String(url || ""));

const normalizeIceUrls = (urls) =>
  Array.isArray(urls) ? urls : parseCsv(urls);

const isSupportedIceUrl = (url) =>
  /^(stun|stuns|turn|turns):/i.test(String(url || ""));

const sanitizeIceCredential = (value) =>
  typeof value === "string" ? value.trim() : value;

export const sanitizeIceServers = (iceServers) => {
  if (!Array.isArray(iceServers)) return [];

  return iceServers.reduce((servers, server) => {
    if (!server || typeof server !== "object") return servers;

    const urls = normalizeIceUrls(server.urls).filter(isSupportedIceUrl);
    if (!urls.length) return servers;

    const sanitized = {
      urls: urls.length === 1 ? urls[0] : urls,
    };
    const username = sanitizeIceCredential(server.username);
    const credential = sanitizeIceCredential(server.credential);

    if (username) sanitized.username = username;
    if (credential) sanitized.credential = credential;
    if (
      server.credentialType === "password" ||
      server.credentialType === "oauth"
    ) {
      sanitized.credentialType = server.credentialType;
    }

    servers.push(sanitized);
    return servers;
  }, []);
};

export const validateIceServers = (iceServers) => {
  if (!Array.isArray(iceServers) || iceServers.length === 0) {
    return "No ICE servers are configured.";
  }

  for (const server of iceServers) {
    const urls = normalizeIceUrls(server?.urls);
    if (!urls.length) return "An ICE server is missing urls.";

    for (const url of urls) {
      if (isTurnUrl(url)) {
        if (!server.username || !server.credential) {
          return "TURN servers require username and credential.";
        }
      }
    }
  }

  return "";
};

export const hasTurnServer = (iceServers) =>
  Array.isArray(iceServers) &&
  iceServers.some((server) => normalizeIceUrls(server?.urls).some(isTurnUrl));

const DEFAULT_STUN_URLS = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
];

// Only stun:/stuns: entries are accepted, so a TURN url left in the variable by
// mistake can never reach a build.
export const buildStunOnlyConfig = (stunUrlsCsv) => {
  const configured = parseCsv(stunUrlsCsv).filter((url) => /^stuns?:/i.test(url));
  return {
    iceServers: (configured.length ? configured : DEFAULT_STUN_URLS).map(
      (urls) => ({ urls }),
    ),
    iceCandidatePoolSize: 10,
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
  };
};

const configuredStunUrls = () => {
  try {
    // Replaced by Vite at build time; import.meta.env does not exist in Node.
    return import.meta.env.VITE_RTC_STUN_URLS;
  } catch {
    return "";
  }
};

export const STUN_ONLY_CONFIG = buildStunOnlyConfig(configuredStunUrls());
