// Phase 4: admin alerts for direct-call rooms. Hooked into server.js's
// logDirectRoom() as a fire-and-forget side effect — see onEvent() below,
// which must never throw or block the socket handler that produced the
// event. All state here is in-memory only (same trust model as
// directRoomRoles/directRoomSockets elsewhere in server.js): a restart loses
// debounce/retry/connected bookkeeping, which is acceptable for a
// best-effort admin notification, not a source of truth.
const DEBOUNCE_MS = 10 * 60 * 1000; // max one alert per room per 10 minutes
const RETRY_WINDOW_MS = 5 * 60 * 1000;
const RETRY_THRESHOLD = 3; // taps on the Retry button
const AUTO_RETRY_THRESHOLD = 6; // reconnect requests the client sends by itself
const NEVER_CONNECTED_MS = 60 * 1000;

// ON in dev/e2e by default. In production, ON only when there's somewhere to
// email — DIRECT_CALL_ALERTS_ENABLED=true forces it on regardless (e.g. to
// use only the in-app badge without email), and =false always turns it off.
function alertsEnabled() {
  const explicit = String(process.env.DIRECT_CALL_ALERTS_ENABLED || "").toLowerCase();
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  if (process.env.NODE_ENV === "production") return !!process.env.DIRECT_CALL_ALERT_EMAILS;
  return true;
}

function alertRecipients() {
  return String(process.env.DIRECT_CALL_ALERT_EMAILS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Dependency-injected so unit tests can supply a fake model / mailer instead
// of touching Mongo or SMTP. server.js constructs the real one at startup.
function createAlertEngine({
  AlertModel,
  sendEmailFn,
  buildReportUrl,
  // Looked up only when an alert is actually about to be raised (rare —
  // after debounce), never on the hot per-event path, so a DB round trip
  // here can't add latency to every join/retry/etc.
  roomLookupFn,
  now = () => Date.now(),
  // Overridable only so tests can use short windows instead of the real
  // 10min/5min/60s — server.js always uses the module defaults.
  debounceMs = DEBOUNCE_MS,
  retryWindowMs = RETRY_WINDOW_MS,
  retryThreshold = RETRY_THRESHOLD,
  autoRetryThreshold = AUTO_RETRY_THRESHOLD,
  neverConnectedMs = NEVER_CONNECTED_MS,
} = {}) {
  const lastAlertAtByRoom = new Map();
  const retryTimestampsByRoom = new Map(); // manual taps
  const autoRetryTimestampsByRoom = new Map();
  const connectTimerByRoom = new Map();
  const connectedRooms = new Set();

  function isDebounced(roomId) {
    const last = lastAlertAtByRoom.get(roomId);
    return typeof last === "number" && now() - last < debounceMs;
  }

  // Persists the alert and sends the email. Awaits its own work (so tests
  // can assert on it deterministically) — every call site below invokes it
  // without awaiting, which is what makes it fire-and-forget in practice.
  async function raise(type, { roomId, doctorName = "", message, detail } = {}) {
    if (!roomId || isDebounced(roomId)) return false;
    lastAlertAtByRoom.set(roomId, now());

    let resolvedDoctorName = doctorName;
    if (!resolvedDoctorName && roomLookupFn) {
      try {
        resolvedDoctorName = (await roomLookupFn(roomId))?.doctorName || "";
      } catch {
        resolvedDoctorName = "";
      }
    }

    try {
      await AlertModel.create({ roomId, type, message, doctorName: resolvedDoctorName, detail });
    } catch (err) {
      console.warn("[direct-call-alerts] failed to persist alert:", err.message);
    }

    const recipients = alertRecipients();
    if (recipients.length && sendEmailFn) {
      const reportUrl = buildReportUrl ? buildReportUrl(roomId) : "";
      try {
        await sendEmailFn({
          to: recipients.join(","),
          subject: `Humancare Connect — Direct call alert: ${message}`,
          text: [
            message,
            `Room: ${roomId}`,
            resolvedDoctorName ? `Doctor: ${resolvedDoctorName}` : "",
            `Time: ${new Date(now()).toISOString()}`,
            reportUrl ? `Report: ${reportUrl}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        });
      } catch (err) {
        console.warn("[direct-call-alerts] failed to send alert email:", err.message);
      }
    }
    return true;
  }

  function clearNeverConnectedTimer(roomId) {
    const timer = connectTimerByRoom.get(roomId);
    if (timer) {
      clearTimeout(timer);
      connectTimerByRoom.delete(roomId);
    }
  }

  function cleanupRoom(roomId) {
    lastAlertAtByRoom.delete(roomId);
    retryTimestampsByRoom.delete(roomId);
    autoRetryTimestampsByRoom.delete(roomId);
    connectedRooms.delete(roomId);
    clearNeverConnectedTimer(roomId);
  }

  // ctx: { roomId, doctorName, seatCount, extra } — called for every
  // logDirectRoom() event. Never throws.
  function onEvent(type, ctx = {}) {
    if (!alertsEnabled()) return;
    const { roomId, extra = {}, doctorName = "", seatCount } = ctx;
    if (!roomId) return;

    try {
      if (type === "rejected" && (extra.reason === "full" || extra.reason === "full_toctou")) {
        void raise("room_full", {
          roomId,
          doctorName,
          message: "A join attempt was rejected because the meeting was full.",
          detail: { reason: extra.reason },
        });
        return;
      }

      if (type === "manual_retry" || type === "auto_reconnect") {
        const manual = type === "manual_retry";
        const byRoom = manual ? retryTimestampsByRoom : autoRetryTimestampsByRoom;
        const timestamps = (byRoom.get(roomId) || []).filter(
          (t) => now() - t < retryWindowMs,
        );
        timestamps.push(now());
        byRoom.set(roomId, timestamps);
        if (timestamps.length >= (manual ? retryThreshold : autoRetryThreshold)) {
          void raise("repeated_retries", {
            roomId,
            doctorName,
            message: manual
              ? `Retry tapped ${timestamps.length} times within 5 minutes.`
              : `${timestamps.length} automatic reconnect attempts within 5 minutes.`,
            detail: { retryCount: timestamps.length, trigger: manual ? "manual" : "automatic" },
          });
        }
        return;
      }

      if (type === "joined" && seatCount >= 2 && !connectedRooms.has(roomId) && !connectTimerByRoom.has(roomId)) {
        const timer = setTimeout(() => {
          connectTimerByRoom.delete(roomId);
          if (connectedRooms.has(roomId)) return;
          void raise("never_connected", {
            roomId,
            doctorName,
            message: "Both participants joined but the call never connected.",
            detail: { waitedMs: neverConnectedMs },
          });
        }, neverConnectedMs);
        timer.unref?.();
        connectTimerByRoom.set(roomId, timer);
        return;
      }

      if (type === "connected") {
        connectedRooms.add(roomId);
        clearNeverConnectedTimer(roomId);
        return;
      }

      // A participant leaving mid-wait shouldn't leave a stale timer ticking
      // toward an alert about a call nobody is still trying to have.
      if (type === "seat_reservation_expired" || type === "disconnected" || type === "seat_released") {
        clearNeverConnectedTimer(roomId);
      }
    } catch (err) {
      console.warn("[direct-call-alerts] onEvent failed:", err.message);
    }
  }

  return { onEvent, raise, cleanupRoom, alertsEnabled };
}

module.exports = {
  createAlertEngine,
  alertsEnabled,
  alertRecipients,
  DEBOUNCE_MS,
  RETRY_WINDOW_MS,
  RETRY_THRESHOLD,
  NEVER_CONNECTED_MS,
};
