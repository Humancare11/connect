import { useEffect } from "react";
import { io } from "socket.io-client";
import { getUserAuthToken } from "../../api";
import { onTabMessage, postToTabs } from "../../utils/crossTab";
import { speakPhrase } from "./livechat/voiceAlerts";
import { createRegistrationVoice } from "./registrationVoice";

// Speaks "New patient registered" on every admin dashboard page (see registrationVoice.js for the rules).
// Own small connection to the main Socket.IO server, like the Email page's: it never touches the shared socket the
// video call pages use, and a refused or failed connection only means no voice. One connection per browser tab, kept
// across page changes (each admin page mounts its own AdminLayout) and closed a few seconds after the last one goes.
const parseTransports = (value) => {
  const list = String(value || "").split(",").map((t) => t.trim()).filter(Boolean);
  return list.length ? list : ["polling", "websocket"];
};
const adminToken = () => getUserAuthToken("admin") || getUserAuthToken("superadmin") || "";

let refs = 0;
let releaseTimer = null;
let socket = null;
let offTabs = null;
let voice = null;

function connect() {
  if (socket) return;
  voice = voice || createRegistrationVoice({
    speak: (text, options) => speakPhrase(text, options),
    post: postToTabs,
    isVisible: () => typeof document === "undefined" || document.visibilityState === "visible",
    isActivated: () => (typeof navigator !== "undefined" && navigator.userActivation ? navigator.userActivation.hasBeenActive : true),
  });
  offTabs = onTabMessage((message) => voice.handleTabMessage(message));
  const url = import.meta.env.VITE_SOCKET_URL || window.location.origin;
  socket = io(url, {
    path: "/socket.io/",
    transports: parseTransports(import.meta.env.VITE_SOCKET_TRANSPORTS),
    withCredentials: true,
    reconnection: true,
    reconnectionDelayMax: 30000,
    // A function, so every (re)connect sends the current token.
    auth: (cb) => cb({ token: adminToken() }),
  });
  socket.on("connect", () => socket.emit("admin-alerts-watch", { token: adminToken() }));
  socket.on("admin-user-registered", (payload) => {
    try {
      voice.handleEvent(payload);
    } catch {
      /* a voice problem must never affect the dashboard */
    }
  });
}

function disconnect() {
  offTabs?.();
  offTabs = null;
  socket?.off();
  socket?.disconnect();
  socket = null;
}

export function useAdminRegistrationVoice(user) {
  const allowed = Boolean(user) && ["admin", "superadmin"].includes(user.role);
  useEffect(() => {
    if (!allowed) return undefined;
    refs += 1;
    clearTimeout(releaseTimer);
    connect();
    return () => {
      refs -= 1;
      if (refs <= 0) releaseTimer = setTimeout(() => refs <= 0 && disconnect(), 3000);
    };
  }, [allowed]);
}
