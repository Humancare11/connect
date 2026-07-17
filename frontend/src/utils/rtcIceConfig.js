// Shared WebRTC ICE server configuration builder — same STUN/TURN resolution
// logic used by the appointment-based VideoCall page, kept as an independent
// module so the Direct Video Call flow can reuse it without importing from
// (or risking any change to) VideoCall.jsx.

const FALLBACK_STUN_URLS = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
  "stun:stun2.l.google.com:19302",
  "stun:stun3.l.google.com:19302",
  "stun:stun4.l.google.com:19302",
];

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

const sanitizeIceServers = (iceServers) => {
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

const validateIceServers = (iceServers) => {
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

const hasTurnServer = (iceServers) =>
  Array.isArray(iceServers) &&
  iceServers.some((server) => normalizeIceUrls(server?.urls).some(isTurnUrl));

const buildIceServerConfig = () => {
  const jsonConfig = import.meta.env.VITE_RTC_ICE_SERVERS_JSON;
  if (jsonConfig) {
    try {
      const parsed = JSON.parse(jsonConfig);
      const iceServers = sanitizeIceServers(
        Array.isArray(parsed) ? parsed : parsed?.iceServers,
      );
      if (Array.isArray(iceServers) && iceServers.length) {
        const error = validateIceServers(iceServers);
        if (import.meta.env.PROD && !hasTurnServer(iceServers)) {
          console.warn(
            "No TURN server configured. Same-network calls may work, but calls across strict NATs can fail.",
          );
        }
        return {
          config: {
            iceServers,
            iceCandidatePoolSize: Number(
              import.meta.env.VITE_RTC_ICE_CANDIDATE_POOL_SIZE || 10,
            ),
            bundlePolicy: "max-bundle",
            rtcpMuxPolicy: "require",
          },
          error,
        };
      }
      console.warn("VITE_RTC_ICE_SERVERS_JSON did not contain iceServers.");
    } catch (err) {
      return {
        config: null,
        error: `Invalid VITE_RTC_ICE_SERVERS_JSON: ${err.message}`,
      };
    }
  }

  const stunUrls = parseCsv(import.meta.env.VITE_RTC_STUN_URLS);
  const turnUrls = parseCsv(import.meta.env.VITE_RTC_TURN_URLS);
  const turnUsername = import.meta.env.VITE_RTC_TURN_USERNAME || "";
  const turnCredential = import.meta.env.VITE_RTC_TURN_CREDENTIAL || "";

  const iceServers = [
    ...(stunUrls.length ? stunUrls : FALLBACK_STUN_URLS).map((urls) => ({
      urls,
    })),
  ];

  if (turnUrls.length && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnUrls,
      username: turnUsername,
      credential: turnCredential,
    });
  } else if (turnUrls.length) {
    console.warn(
      "VITE_RTC_TURN_URLS is set, but TURN username/credential is missing. Continuing with STUN-only ICE.",
    );
  }

  const error = validateIceServers(iceServers);
  if (import.meta.env.PROD && !hasTurnServer(iceServers)) {
    console.warn(
      "No TURN server configured. Same-network calls may work, but calls across strict NATs can fail.",
    );
  }

  return {
    config: {
      iceServers,
      iceCandidatePoolSize: Number(
        import.meta.env.VITE_RTC_ICE_CANDIDATE_POOL_SIZE || 10,
      ),
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    },
    error,
  };
};

const RTC_SETUP = buildIceServerConfig();
export const RTC_CONFIG = RTC_SETUP.config;
export const RTC_CONFIG_ERROR = RTC_SETUP.error;
