import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

// Live Chat visitor tracker (Phase 1: presence only, no chat UI yet).
//
// Privacy / performance rules:
//   - Does nothing unless VITE_LIVECHAT_ENABLED === "true" (build-time kill switch for the browser side; the
//     server has its own LIVECHAT_ENABLED).
//   - Starts only when localStorage.cookieConsent === "accepted". No consent, no visitor id, no connection.
//   - Client-side only and after the browser is idle, so prerendering, SEO and LCP are unaffected. The Socket.IO
//     client is loaded with a dynamic import at that moment, not in the main bundle.
//   - Only the page path (no query string or hash), page title and referrer are sent. The server adds IP and
//     location, and parses the user agent.
//   - Never runs on admin, login, payment, patient-dashboard or video-call pages.

const ENABLED = import.meta.env.VITE_LIVECHAT_ENABLED === "true";
const VISITOR_KEY = "hcLiveChatVisitorId";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (typeof window !== "undefined" ? window.location.origin : "");

// Keep in sync with UNTRACKED_PREFIXES in backend/services/liveChat/visitorNamespace.js (the server enforces it too).
const UNTRACKED_PREFIXES = [
  "/admin", "/adminauth", "/superadmin", "/payment-admin", "/employee", "/partner", "/doctor-dashboard",
  "/doctor-login", "/login", "/user", "/pay", "/payment", "/video-call", "/direct-video-call",
];

// Errors that mean "stop trying" rather than "retry later".
const FATAL_ERRORS = ["Invalid namespace", "consent_required", "invalid_visitor", "blocked"];

const HEARTBEAT_MS = 25_000;
const CONSENT_POLL_MS = 4_000;

export const isTrackablePath = (pathname) => {
  const lower = String(pathname || "/").toLowerCase();
  return !UNTRACKED_PREFIXES.some((prefix) => lower === prefix || lower.startsWith(`${prefix}/`) || lower.startsWith(`${prefix}-`));
};

const consentAccepted = () => {
  try {
    return localStorage.getItem("cookieConsent") === "accepted";
  } catch {
    return false;
  }
};

function getVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
      id = (crypto.randomUUID && crypto.randomUUID()) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

const whenIdle = (callback) => {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(callback, { timeout: 4000 });
    return () => window.cancelIdleCallback?.(handle);
  }
  const handle = window.setTimeout(callback, 2500);
  return () => window.clearTimeout(handle);
};

export default function useVisitorTracker() {
  const { pathname } = useLocation();
  const socketRef = useRef(null);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const reportPage = () => {
    const socket = socketRef.current;
    const path = pathRef.current;
    if (!socket?.connected || !isTrackablePath(path)) return;
    socket.emit("visitor:page", { path, title: document.title || "" });
  };

  // Start (once consent is given) and stop (if consent is withdrawn).
  useEffect(() => {
    if (!ENABLED || typeof window === "undefined") return undefined;

    let cancelIdle = null;
    let pollTimer = null;
    let heartbeatTimer = null;
    let disposed = false;

    const stop = () => {
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
      socketRef.current?.close();
      socketRef.current = null;
    };

    const start = async () => {
      if (disposed || socketRef.current || !consentAccepted() || !isTrackablePath(pathRef.current)) return;
      const visitorId = getVisitorId();
      if (!visitorId) return;
      const { io } = await import("socket.io-client");
      if (disposed || socketRef.current || !consentAccepted()) return;

      const socket = io(`${SOCKET_URL}/livechat`, {
        path: "/socket.io/",
        transports: ["websocket", "polling"],
        auth: { visitorId, consent: true, referrer: document.referrer || "" },
        withCredentials: false,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 30_000,
        reconnectionAttempts: 10,
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        // A short wait lets the page title settle after the route renders.
        window.setTimeout(reportPage, 400);
      });
      socket.on("connect_error", (err) => {
        if (FATAL_ERRORS.some((message) => String(err?.message).includes(message))) stop();
      });

      heartbeatTimer = window.setInterval(() => {
        if (document.visibilityState === "visible") socket.emit("visitor:heartbeat");
      }, HEARTBEAT_MS);
    };

    const schedule = () => {
      cancelIdle?.();
      cancelIdle = whenIdle(start);
    };

    const check = () => {
      if (consentAccepted()) {
        window.clearInterval(pollTimer);
        pollTimer = null;
        if (!socketRef.current) schedule();
      } else if (socketRef.current) {
        stop(); // consent withdrawn
      }
    };

    check();
    // The cookie banner lives in the same tab and does not announce its choice, so while the visitor has not
    // decided yet, look again every few seconds. Stops as soon as a choice exists.
    const undecided = () => {
      try {
        return !localStorage.getItem("cookieConsent");
      } catch {
        return false;
      }
    };
    if (!consentAccepted() && undecided()) {
      pollTimer = window.setInterval(() => {
        if (!undecided()) window.clearInterval(pollTimer);
        check();
      }, CONSENT_POLL_MS);
    }

    // Closing or leaving the tab: tell the server right away (it still waits its grace period before removing
    // the visitor). A page restored from the back/forward cache reconnects.
    const onPageHide = () => socketRef.current?.disconnect();
    const onPageShow = (event) => {
      if (event.persisted && consentAccepted()) socketRef.current?.connect();
    };
    const onStorage = (event) => {
      if (event.key === "cookieConsent") check();
    };
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("storage", onStorage);

    return () => {
      disposed = true;
      cancelIdle?.();
      window.clearInterval(pollTimer);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("storage", onStorage);
      stop();
    };
  }, []);

  // Report every page change (the first report is sent on connect).
  useEffect(() => {
    if (!ENABLED) return undefined;
    const timer = window.setTimeout(() => {
      if (!consentAccepted() && socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
        return;
      }
      reportPage();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [pathname]);
}
