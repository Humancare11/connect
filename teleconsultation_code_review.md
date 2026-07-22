# Teleconsultation Module Review

**Scope reviewed** (full read, line-by-line):

| File | Lines | Role |
|---|---|---|
| `frontend/src/pages/VideoCall.jsx` | 3,505 | Appointment-based video consultation (doctor ⇄ patient) |
| `frontend/src/pages/DirectVideoCall.jsx` | 768 | Ad-hoc, link-based guest video call |
| `frontend/src/socket.js` | 84 | Shared Socket.IO client singleton |
| `frontend/src/utils/rtcIceConfig.js` | 167 | Direct-call ICE config builder |
| `backend/server.js` (socket handlers + auth middleware, L270–1498) | ~500 relevant | Signaling server, room membership, chat persistence |
| `backend/routes/rtc.js`, `backend/utils/turnCredentials.js` | 113 | Short-lived TURN credential minting |
| `backend/controllers/directVideoRoomController.js` | 159 | Direct-room lifecycle (create/close/status) |
| `frontend/src/api.js` (auth token plumbing, relevant excerpt) | — | Per-role token storage used by both REST and socket auth |

`videocall.css` / `directvideocall.css` (2,600+ lines) were **not** reviewed for visual/logic bugs — out of scope for a functional review; flag separately if a UI/visual audit is wanted.

---

## Executive Summary

**Overall health score: 78 / 100 (Good, with real gaps)**
**Risk Level: Medium**
**Total Issues Found: 18** (3 Critical, 5 High, 7 Medium, 3 Low)

This is not a sloppy module. It's clearly been iterated on — the code is full of comments explaining *why* a defensive check exists (e.g. the perfect-negotiation glare handling, the `resumedCall` vs first-handshake distinction, the socket-room bookkeeping repair after `connectionStateRecovery`, the short-lived TURN credential rationale). Perfect-negotiation, ICE-restart backoff with a cooldown, seat-limiting by unique user (not raw socket), and duplicate-session eviction are all implemented correctly and thoughtfully.

The real risk is concentrated in a few places: **there's no error boundary anywhere in the app**, so any of the several unguarded WebRTC calls can crash to a blank screen; **the "stuck reconnecting" escape hatch only works before the first successful connection**, so a mid-call drop can leave a user staring at a spinner forever; and **there's no rate limiting on any Socket.IO event**, which is an open abuse/DoS surface for a healthcare app that also persists chat to a database on every message.

---

## Critical Issues

### Issue 1 — No error boundary anywhere in the app; several unguarded WebRTC calls can crash to a blank screen
**Location:** `frontend/src/pages/VideoCall.jsx:1264` (`new RTCPeerConnection(iceConfig)`), `frontend/src/pages/DirectVideoCall.jsx:395`; confirmed no `ErrorBoundary`/`componentDidCatch` exists anywhere under `frontend/src`.

**Problem:** `new RTCPeerConnection(iceConfig)` and other WebRTC/DOM API calls inside the main `useEffect` are not wrapped in `try/catch`. If construction throws — unsupported browser, a hardened corporate browser policy, an extension that shims `RTCPeerConnection` incorrectly, or simply an old device — the exception propagates out of a `useEffect` with nothing to catch it.

**Why it happens:** The module assumes `RTCPeerConnection`/`getUserMedia` always exist once you've reached the call page (they're gated behind login + appointment status, not behind a capability check).

**Impact:** A patient or doctor on an unsupported browser sees a **white/blank screen** with zero explanation, instead of "Your browser doesn't support video calls — please use Chrome, Edge, Firefox, or Safari." For a healthcare product this is a hard stop with no recovery path and no telemetry (the crash never reaches `logVideoEvent`, since that itself depends on the socket already having reached this point).

**Recommended Fix:** Add a route-level `ErrorBoundary` around both call pages, and explicitly feature-detect before entering the WebRTC setup path.

**Code Example (Before)**
```jsx
// VideoCall.jsx — inside the main effect, no guard
const pc = new RTCPeerConnection(iceConfig);
pcRef.current = pc;
```

**Code Example (After)**
```jsx
// frontend/src/components/CallErrorBoundary.jsx (new)
class CallErrorBoundary extends React.Component {
  state = { crashed: false };
  static getDerivedStateFromError() { return { crashed: true }; }
  componentDidCatch(err, info) {
    console.error("[video-call] fatal render error", err, info);
  }
  render() {
    if (this.state.crashed) {
      return (
        <div className="hc-vc__gate">
          <h2>Something went wrong</h2>
          <p>The video call crashed unexpectedly. Please reload the page.</p>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// App.jsx — wrap the route
<Route path="/video-call/:appointmentId" element={
  <CallErrorBoundary><VideoCall /></CallErrorBoundary>
} />
```
```jsx
// VideoCall.jsx — feature-detect before doing anything else
if (!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) {
  setApptError("Your browser doesn't support video calls. Please use a recent version of Chrome, Edge, Firefox, or Safari.");
  return;
}
let pc;
try {
  pc = new RTCPeerConnection(iceConfig);
} catch (err) {
  setApptError("Could not start the video call on this browser/device.");
  return;
}
pcRef.current = pc;
```
**Side effects:** None — an error boundary only changes behavior on an otherwise-fatal path. The capability check adds one more gate screen, consistent with the existing `apptLoading`/`apptError` pattern.

---

### Issue 2 — "Stuck reconnecting" manual retry is unreachable once a call has connected at least once
**Location:** `frontend/src/pages/VideoCall.jsx:1348–1444` (`startConnectionWatchdog`, `scheduleIceRestart`), `:1764–1766` (`startReconnectStallWatch` call site), `:3004–3018` (the `reconnectStalled` UI banner).

**Problem:** `startReconnectStallWatch()` — which arms the `reconnectStalled` state that renders the "Reconnection is taking longer than expected — [Retry]" banner — is called from exactly one place: `handlePeerJoined`, gated by `isReadyRef.current && !inCallRef.current`. Once `inCallRef.current` becomes `true` (the call connected once), that gate can never pass again. Meanwhile `scheduleIceRestart()` — which *is* re-invoked on every later `disconnected`/`failed` state — never calls `startReconnectStallWatch()` itself.

**Why it happens:** The stall watch was designed for the initial-handshake case (per the comment at L1758–1766 distinguishing `resumedCall` from a first-time connect) and was never wired into the later, ongoing-call disconnection path.

**Impact:** If a call that has already connected drops (Wi-Fi blip, NAT rebinding, TURN relay hiccup) and automatic ICE recovery doesn't succeed within the retry budget, the user only ever sees the passive "Reconnecting..." waiting-overlay text (L2988–2991) — there is **no visible "Retry" button, ever, for this path**. The only recovery is a manual page refresh, which the user isn't told to do. For a medical consultation, an indefinite silent hang is a serious reliability gap.

**Recommended Fix:** Arm the same stall watch whenever the connection transitions away from "connected" after having been connected once, not only from the pre-connect `peer-joined` path.

**Code Example (Before)**
```jsx
} else if (s === "disconnected" || s === "failed") {
  logVideoEvent("peer_connection_unhealthy", { state: s, iceConnectionState: pc.iceConnectionState });
  setConnectionState("disconnected");
  setIsRemoteConnected(false);
  scheduleIceRestart();
}
```

**Code Example (After)**
```jsx
} else if (s === "disconnected" || s === "failed") {
  logVideoEvent("peer_connection_unhealthy", { state: s, iceConnectionState: pc.iceConnectionState });
  setConnectionState("disconnected");
  setIsRemoteConnected(false);
  scheduleIceRestart();
  if (hasConnectedOnceRef.current) startReconnectStallWatch(12000); // mid-call drop: don't make them wait as long as a first connect
}
```
(Mirror the same addition in `oniceconnectionstatechange`'s `"failed"`/`"disconnected"` branches.)

**Side effects:** None functionally — `startReconnectStallWatch` already no-ops if a timer is already running (`if (reconnectStallTimerRef.current) return;`), and it's cleared on the next successful `connected` transition, same as today.

---

### Issue 3 — No rate limiting on any Socket.IO event (signaling or chat)
**Location:** `backend/server.js:1153–1277` (`appointment-message`, `video-offer`, `video-answer`, `ice-candidate`, `ice-restart-request`, `video-telemetry`), `:1437–1474` (`direct-video-offer/answer`, `direct-ice-candidate`, `direct-room-message`). Confirmed: `backend/middleware/rateLimiters.js` has no socket-related entries at all — every limiter in that file is REST/Express-only.

**Problem:** Every socket event handler executes unconditionally as fast as a client can emit it. `appointment-message` triggers a MongoDB write (`ChatMessage.create`) and a broadcast to the whole room on every single call, with no per-socket or per-appointment throttling.

**Why it happens:** Rate limiting was built for the REST layer (login, OTP, etc.) but was never extended to the WebSocket layer, which is a different attack surface entirely (bypasses Express middleware).

**Impact:** A compromised or simply buggy client (or a malicious participant, since patients/guests are also socket clients) can flood the DB with `ChatMessage` writes, spam the other participant's chat feed, or flood `video-offer`/`ice-candidate` relays to waste CPU/bandwidth on both peers — degrading or denying service for that consultation, and at volume, for the server generally. This is a PHI-adjacent system (chat is already encrypted at rest — good — but the encryption doesn't protect against volume-based abuse).

**Recommended Fix:** Add a lightweight per-socket token-bucket for at least: `appointment-message` (e.g. 1/sec, burst 5), `video-offer`/`video-answer` (e.g. 2/sec), `ice-candidate` (e.g. 20/sec — these are legitimately bursty), `direct-room-message`.

**Code Example (Before)**
```js
socket.on("appointment-message", ({ appointmentId, senderId, senderName, text, fileUrl, fileName, fileType }) => {
  if (!appointmentId || (!text && !fileUrl)) return;
  if (!isSocketInAppointmentRoom(socket, appointmentId)) return;
  // ...ChatMessage.create + broadcast, no throttling
});
```

**Code Example (After)**
```js
// utils/socketRateLimit.js (new)
function makeSocketLimiter({ windowMs, max }) {
  const hits = new Map(); // socket.id -> { count, resetAt }
  return function allow(socketId) {
    const now = Date.now();
    const entry = hits.get(socketId);
    if (!entry || now > entry.resetAt) {
      hits.set(socketId, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.count >= max) return false;
    entry.count += 1;
    return true;
  };
}
module.exports = { makeSocketLimiter };

// server.js
const { makeSocketLimiter } = require("./utils/socketRateLimit");
const chatLimiter = makeSocketLimiter({ windowMs: 1000, max: 5 });

socket.on("appointment-message", (payload = {}) => {
  if (!chatLimiter(socket.id)) return; // silently drop; client already shows its own optimistic state
  const { appointmentId, text, fileUrl } = payload;
  if (!appointmentId || (!text && !fileUrl)) return;
  if (!isSocketInAppointmentRoom(socket, appointmentId)) return;
  // ...unchanged
});
```
**Side effects:** A legitimate fast typist sending several short messages back-to-back could theoretically hit the burst cap — tune `max` generously (5–10/sec is far above any human typing rate) to avoid false positives. In-memory limiter state is per-process; if the backend ever scales horizontally this needs to move to Redis, same caveat as any other in-memory map already used in this file (`onlineUsers`, `socketRooms`, etc.).

---

## High Priority Issues

### Issue 4 — Socket handshake bearer-token auth silently defaults to the "user" role
**Location:** `frontend/src/socket.js:14–30` (initial `auth: { token: getUserAuthToken() }`), `:62–70` (`reconnect_attempt` refresh), `frontend/src/api.js:98` (`getUserAuthToken(role = activeAuthRole || "user")`).

**Problem:** The shared socket singleton is created once at module load and calls `getUserAuthToken()` with **no role argument**, which resolves to whichever role is `activeAuthRole` at that instant, falling back to `"user"`. For a doctor-only session where `activeAuthRole` hasn't been set to `"doctor"` yet (or a tab where only the doctor is logged in), this pulls the (empty) user-role token, not the doctor's. The same happens again on every `reconnect_attempt`.

**Why it happens:** `getUserAuthToken` is role-aware everywhere else in the codebase (`VideoCall.jsx` explicitly passes `getUserAuthToken(activeRole)` per emit — see L1092) but `socket.js` predates that pattern and was never updated to match.

**Impact:** Today this is masked because HttpOnly cookies are the primary auth channel server-side, and the appointment-room join/identity checks re-resolve identity from an explicit per-emit `token` field rather than the handshake token. But **any environment where cookies aren't available** (Safari ITP/third-party-cookie blocking, an embedded WebView, a future native app) falls back entirely to this handshake token — and for a doctor session it will silently carry the wrong (or empty) credential, causing socket-level auth to fail with no clear error surfaced to the doctor.

**Recommended Fix:** Make the socket module role-aware, updated whenever the active role changes (login/logout), not just at import time.

**Code Example (Before)**
```js
const socket = io(socketUrl, {
  // ...
  auth: { token: getUserAuthToken() },
});
// ...
socket.io.on("reconnect_attempt", () => {
  socket.auth = { token: getUserAuthToken() };
});
```

**Code Example (After)**
```js
// socket.js
export function setSocketAuthRole(role) {
  socket.auth = { token: getUserAuthToken(role) };
}
// call setSocketAuthRole("doctor") / ("user") from AuthContext/DoctorAuthContext right after login succeeds,
// and from socket.io's reconnect_attempt using the same role that VideoCall.jsx already tracks via `isDoctor`.
```
**Side effects:** Requires threading the current role into `socket.js` from the auth contexts (a small, additive change) — no behavior change for the cookie-based path that already works today.

---

### Issue 5 — WebRTC connection-quality stats are collected but never shown to the user
**Location:** `frontend/src/pages/VideoCall.jsx:1010–1077` (`startStatsCollection`) — RTT, packet loss, bytes sent/received, and local/remote candidate type are gathered every `STATS_INTERVAL_MS` (30s default) and only ever `console.info`'d and sent to `logVideoEvent` telemetry.

**Problem/Impact:** The exact data needed to show "Your connection is unstable" (RTT > threshold, `selectedPairState !== "succeeded"`, rising `packetsLost`) already exists in this function and is thrown away after logging. Users get zero warning before a call degrades or drops.

**Recommended Fix:** Derive a simple `connectionQuality` state (`good` / `weak` / `poor`) from `diagnostics.rtt` and `packetsLost` deltas between polls, and render a small indicator in the control bar (see UX section below for the exact component).

---

### Issue 6 — Chat/direct-room messages have no client-side flood guard
**Location:** `frontend/src/pages/VideoCall.jsx:2488–2498` (`sendMessage`), `frontend/src/pages/DirectVideoCall.jsx:579–592` (`sendChatMessage`).

**Problem:** `sendMessage` only checks `if (!text) return` — nothing stops a user (or a stuck key/paste-loop) from emitting dozens of messages a second. Pairs with Issue 3: right now nothing anywhere in the stack throttles this.

**Recommended Fix:** Add a simple client-side debounce/cooldown (disable the send button for ~300ms after each send) as a first line of defense in front of the server-side limiter from Issue 3.

---

### Issue 7 — `DirectVideoCall`'s call-setup effect can never re-run once `stage` cycles back to `"call"`
**Location:** `frontend/src/pages/DirectVideoCall.jsx:276–279` (`if (startedRef.current) return; startedRef.current = true;`).

**Problem:** `startedRef` is set once and never reset. The effect depends on `[stage, roomId]`, so if any future flow transitions `stage` away from `"call"` and back to `"call"` again (e.g., a "reconnect after room error" retry, which doesn't exist today but is a very natural next feature given the "Retry Camera/Mic" pattern already present at the pre-join step), the setup logic silently no-ops on the second entry — no peer connection, no socket listeners, a call screen with nothing wired up.

**Recommended Fix:** Reset `startedRef.current = false` in the effect's cleanup, not just rely on it as a one-time StrictMode guard; or better, gate the "already started" check on `roomId` changing rather than a boolean latch, so intent is explicit.

---

### Issue 8 — `handleApptUpdated` only redirects the patient, never the doctor, on out-of-band completion
**Location:** `frontend/src/pages/VideoCall.jsx:1827–1833`.

```js
const handleApptUpdated = ({ status }) => {
  if (!mounted) return;
  if (["complete", "completed"].includes(status) && !isDoctor) {
    setShowCompletedOverlay(true);
    setTimeout(() => navigate("/user/dashboard", { replace: true }), 4000);
  }
};
```

**Problem/Impact:** If an admin (or a backend job) marks the appointment complete/cancelled while the **doctor** is still in the call — the doctor normally drives completion themselves via `completeAppointment()`, but this is an out-of-band path — the doctor's client receives the same `appointment-updated` event and does nothing with it. The doctor is left in a call for an appointment that's already been closed out server-side, with no reconciliation.

**Recommended Fix:** Show the doctor an inline notice ("This appointment was completed by an administrator") and offer a "Leave call" affordance, without an auto-redirect (the doctor may still want to wrap up the conversation first).

---

## Medium Priority Issues

### Issue 9 — Chat messages keyed by array index
**Location:** `VideoCall.jsx:3153` (`messages.map((msg, i) => <div key={i} ...>`), `DirectVideoCall.jsx` (`messages.map((msg, idx) => ... key={idx}`).
Safe today because messages are strictly appended, but it's a landmine for any future edit (optimistic-send-then-reconcile, message deletion, pagination). Use `msg._id` (server-persisted messages already have one) or a locally-generated id for optimistic entries.

### Issue 10 — No `navigator.onLine` / `online`/`offline` listeners anywhere in the module
A fully offline device currently only discovers the problem indirectly, once the socket or ICE timeout fires (many seconds later). A same-tick `window.addEventListener("offline", ...)` could show "You're offline" immediately.

### Issue 11 — No pre-flight browser/feature support check
See Issue 1's fix — folding a capability check in earlier (before even attempting `getUserMedia`) gives a much clearer error message than whatever `getUserMedia`/`RTCPeerConnection` throw natively on an unsupported target.

### Issue 12 — Screen-share error messaging is one-size-fits-all
**Location:** `VideoCall.jsx:2186–2211` (`startScreenShare` catch block). Every failure except a user-cancelled picker (`NotAllowedError`) shows the same "Screen sharing could not be started on this device" — a permissions-policy block, a getDisplayMedia-unsupported browser, and a mid-share device error all read identically. Low cost to special-case the unsupported-API check (already exists as `canUseScreenShare()`) vs. a genuine runtime failure.

### Issue 13 — Direct Video Room identity is fully client-trusted, by design — worth an explicit sign-off
**Location:** `backend/server.js:800–835`, `directVideoRoomController.js`. `guestId` is a client-generated UUID persisted in `sessionStorage` with no server-side identity verification — the code comments make clear this is an intentional "anyone with the link" trust model (like a Google Meet link). That's a reasonable product decision for ad-hoc consult links, but there is **no audit trail of who actually joined** (no name/IP/timestamp persisted per participant beyond `lastActivityAt`/`firstJoinedAt` on the room). For a healthcare product, confirm with compliance/legal whether "no identity, no audit log" is acceptable for this call type, since it differs from the authenticated-appointment flow's participant-ID access control.

### Issue 14 — In-call prescription save has no offline/retry queue
**Location:** `VideoCall.jsx:50–78` (`InCallPrescriptionModal.submit`). A network blip during `api.post("/api/medical/prescriptions", ...)` mid-call shows an inline error and lets the doctor retry manually (fine), but there's no draft-preservation if the doctor navigates away or the modal unmounts before retrying — the diagnosis/medicines state is lost.

### Issue 15 — `logVideoEvent` silently drops telemetry when the socket is disconnected
**Location:** `VideoCall.jsx:982–1003`. `if (socket.connected && appointmentId) socket.emit(...)` — reasonable to not queue-and-replay every event, but it means the most interesting diagnostics (the events right around a disconnect) are exactly the ones most likely to be dropped. A small ring-buffer flushed on reconnect would materially improve post-incident debugging.

---

## Low Priority Issues

### Issue 16 — Inline styles for the End-Call/Leave-confirm/Cam-error UI
**Location:** `VideoCall.jsx:2683–2917` (`endCallConfirm`/`leaveConfirm` modals). The rest of the file consistently uses the `hc-vc__*` BEM class convention (defined in `videocall.css`); these three blocks instead use large inline `style={{...}}` objects. Cosmetic/maintainability nit, not a bug.

### Issue 17 — Verbose, ungated production console logging
**Location:** throughout `VideoCall.jsx` (`console.info("[webrtc-stats]", ...)` every 30s, `console.info("WebRTC peer connection created", ...)`, etc.) — gated by `import.meta.env.DEV` in exactly one place (`logVideoEvent`'s own `console.info` branch, L992), everywhere else it's unconditional. Minor perf/hygiene nit; also means network topology/candidate-type details are visible in a shared/public computer's devtools console during production use.

### Issue 18 — Dead, commented-out JSX left in place
**Location:** `VideoCall.jsx:2669–2679` (status pill / info chips), `:2937–2958` (prescription notif banner, Rx-saved toast), `:3443–3452` (Rx button). Either restore or delete — commented-out UI accumulates and makes it hard to tell what's actually planned vs. abandoned.

---

## Performance Improvements

1. **Surface the already-collected `getStats()` data** (Issue 5) instead of only logging it — this is the single highest-value, lowest-effort improvement in the whole review.
2. **`STATS_INTERVAL_MS` default (30s)** is reasonable, but consider tightening to 5–10s only while `connectionState !== "connected"` (to react faster to a struggling initial handshake) and relaxing back to 30s once stable — cheap to add, reduces both wasted `getStats()` calls and unnecessary telemetry volume.
3. **`ensureMediaTransceivers`/`tuneSenderQuality`** already do real adaptive-bitrate work (good) — consider also reacting to the `connectionQuality` signal from Issue 5 by dynamically lowering `maxBitrate`/`scaleResolutionDownBy` when the connection is flagged "weak," rather than only tuning once at attach time.
4. **`videocall.css` at 2,623 lines** is loaded for every render of the call page; if it isn't already code-split per-route (verify in the Vite build config), that's dead weight on every other route's initial bundle.

## Security Improvements

1. **Add Socket.IO rate limiting** (Issue 3) — highest-priority security gap found.
2. **Fix the socket auth role default** (Issue 4) so a non-cookie environment can't silently downgrade a doctor session.
3. **Confirm the Direct Video Room trust model with compliance** (Issue 13) — not a code bug, but worth an explicit written sign-off given this is a healthcare product.
4. Everything else checked out well: chat text is rendered via React text nodes (no `dangerouslySetInnerHTML` anywhere in the module — safe from stored/reflected XSS via chat), file URLs are server-reconstructed through `uploadAccessPath`/`keyFromStoredValue` rather than reflecting client-supplied strings verbatim (closes off a `javascript:`-URI vector even though the client *could* emit an arbitrary `fileUrl`), TURN credentials are short-lived and per-request rather than baked into the client bundle, and appointment-room access control is participant-ID based and re-validated per socket event (`isSocketInAppointmentRoom`) rather than trusted once at join time.

## Code Quality Improvements

1. Replace array-index React keys in both chat lists (Issue 9).
2. Reset `startedRef` in `DirectVideoCall`'s cleanup (Issue 7) so the guard expresses "already started for this stage/roomId" rather than "started, ever."
3. Remove or gate all remaining unconditional `console.*` calls behind `import.meta.env.DEV` (Issue 17), matching the pattern already used in `logVideoEvent`.
4. Delete the four blocks of commented-out JSX (Issue 18) — either ship them behind a feature check or remove them; git history already preserves them if needed later.
5. Extract the End-Call/Leave-confirm modal inline styles into the existing `hc-vc__` class system (Issue 16) for consistency with the rest of the file.

---

## Error Handling & User-Friendly Messaging Matrix

For each scenario: **When it occurs → User message → Severity → UI → Retry? → Recovery action.** Current-state column notes whether this is already implemented, partially implemented, or missing (✅ / 🟡 / ❌), based on what's actually in the code reviewed above.

### Slow Internet Connection
- **Trigger:** RTT rising / `packetsLost` increasing in `getStats()` polling (already collected, Issue 5).
- **Message:** "Your connection is unstable. Video quality may drop."
- **Severity:** Warning · **UI:** Warning banner (top of stage) · **Retry:** Auto (bitrate already adapts via `tuneSenderQuality`) · **Show:** Persistent network-quality dot in the control bar.
- **Current state:** ❌ Data collected, never surfaced.

### No Internet Connection
- **Trigger:** `window` `offline` event / `navigator.onLine === false`.
- **Message:** "You're offline. Reconnecting once your internet is back."
- **Severity:** Error · **UI:** Full-width banner, blocks controls except "Leave" · **Retry:** Auto, on `online` event · **Show:** Spinner + elapsed-offline timer.
- **Current state:** ❌ Not listened for at all (Issue 10) — currently only inferred indirectly via socket/ICE timeouts.

### WebRTC Connection Lost (mid-call)
- **Trigger:** `pc.connectionState` → `disconnected`/`failed` after `hasConnectedOnceRef.current === true`.
- **Message:** "Reconnecting to the call…" then, if it drags on: "Still trying to reconnect — [Retry]".
- **Severity:** Warning → Error if it persists · **UI:** Waiting overlay text, escalating to the stalled-banner · **Retry:** Auto first (ICE restart), manual after ~12s.
- **Current state:** 🟡 Auto-recovery exists and is solid; the manual escalation is the exact gap in **Issue 2**.

### ICE Connection Failed
- **Trigger:** `iceConnectionState === "failed"`.
- **Message:** "Connection lost. Trying to reconnect…" — if `ICE_MAX_RECOVERY_ATTEMPTS` exhausted and no TURN relay is viable: "We couldn't restore the connection. Please check your network or try again."
- **Severity:** Error · **UI:** Banner + Retry button · **Retry:** Auto, capped, then manual.
- **Current state:** 🟡 Recovery loop exists (`scheduleIceRestart`) but never truly "gives up" with a clear terminal message — it just keeps asking the peer to ICE-restart forever behind the scenes (see Issue 2 analysis).

### Signaling Server Disconnected
- **Trigger:** `socket.on("disconnect")`.
- **Message:** "Reconnecting to the server…"
- **Severity:** Warning · **UI:** Small banner, non-blocking (socket.io itself is already set to auto-reconnect indefinitely — `reconnectionAttempts: Infinity` in `socket.js:22`) · **Retry:** Automatic.
- **Current state:** ✅ Handled (`handleSocketDisconnect`/`handleSocketReconnect`, L1876–1921) — connectionState is updated but no dedicated banner text distinguishes "socket dropped" from "peer connection dropped"; both currently show the same generic waiting/reconnecting copy. Minor polish opportunity, not a gap.

### Camera Permission Denied
- **Trigger:** `getUserMedia` → `NotAllowedError`.
- **Message:** "Camera/microphone permission was denied. Click the camera icon in the address bar and allow access, then retry." *(exact copy already in code)*
- **Severity:** Error · **UI:** Error bar with Retry button · **Retry:** Manual (`retryMediaPermissions`).
- **Current state:** ✅ Fully implemented, well-written (`mediaErrorMessage`, `VideoCall.jsx:295–312`).

### Microphone Permission Denied
- Same handler/message family as above (permission errors aren't split by device). **Current state:** ✅ (grouped with camera, acceptable).

### Camera Not Found
- **Trigger:** `NotFoundError`/`DevicesNotFoundError`.
- **Message:** "No camera or microphone was found on this device." · **Current state:** ✅ implemented; falls back to audio-only via `getConsultationMediaStream`'s cascading fallback (L314–364) — genuinely good UX already.

### Microphone Not Found
- Same as above; falls back to video-only. **Current state:** ✅.

### Browser Not Supported
- **Trigger:** missing `RTCPeerConnection`/`getUserMedia`.
- **Message:** "Your browser doesn't support video calls. Please use a recent Chrome, Edge, Firefox, or Safari."
- **Severity:** Error · **UI:** Full gate screen (same pattern as `apptError`) · **Retry:** N/A — direct them to switch browsers.
- **Current state:** ❌ Missing (Issue 1/11) — currently would surface as whatever native error `getUserMedia` throws, or a blank crash if `RTCPeerConnection` itself is missing.

### Session Expired / Token Expired
- **Trigger:** access token TTL elapses mid-call.
- **Message:** "Your session is about to expire — reconnecting to keep you signed in." (should be invisible to the user in the happy path.)
- **Severity:** Info → Error if refresh fails · **UI:** none in the happy path; Error banner if refresh genuinely fails.
- **Current state:** ✅ Proactively handled — a 4-minute heartbeat calls `/api/auth/refresh` for the whole duration of the call specifically to prevent this (`VideoCall.jsx:2033–2046`), with a comment explaining exactly this failure mode. One gap: the `.catch(() => {})` on the heartbeat (L2041) swallows a genuine refresh failure silently — if the refresh token itself has expired, the user gets no warning until their *next* authenticated action fails. **Recommend:** on heartbeat failure, show a one-time inline warning ("Your session may expire soon — save any unsaved notes").

### Authentication Failed
- **Trigger:** appointment fetch returns 401/403.
- **Message:** "Please login to access this appointment." *(exact copy in code, `apptError` gate, L859–863)*.
- **Current state:** ✅.

### Video Stream Unavailable
- **Trigger:** `ontrack` never fires / remote stream has no live tracks.
- **Message:** covered today by the general "Waiting for {role}... / Establishing secure connection..." overlay — there's no *specific* "their video didn't come through" message distinct from "they haven't joined yet."
- **Current state:** 🟡 Partial — the generic waiting overlay covers this reasonably but doesn't distinguish "peer never sent video" from "peer hasn't joined."

### Doctor / Patient Disconnected
- **Trigger:** `participant-left` socket event.
- **Message:** "{Doctor/Patient} has left the call." *(exact copy in code, `hc-vc__peer-left-notice`, L3030–3040)*.
- **Current state:** ✅ implemented, including the grace-period logic server-side (`SOCKET_LEAVE_GRACE_MS`) so a brief mobile-background blip doesn't falsely announce a departure.

### Network Timeout (API)
- **Trigger:** any `api.*` call exceeding its timeout.
- **Message:** generic `err.response?.data?.msg || "..."` fallback strings exist per-call-site (e.g., appointment fetch, notes, prescriptions) — consistent and reasonable.
- **Current state:** ✅ acceptable pattern throughout; no dedicated "slow network, still trying" distinct message, but not a real gap given the per-action error messages already shown.

### API Request Failed / Server Unavailable (500)
- **Current state:** ✅ — every REST call site reviewed (`appt` fetch, ICE config fetch, notes, prescriptions) has a `.catch` with a user-facing fallback string, and the ICE-config fetch specifically retries transient failures twice before giving up (L883–931) — a genuinely good, deliberate pattern.

### Invalid Meeting ID (Direct Call)
- **Trigger:** `/api/direct-video-room/:id/status` returns `valid: false`.
- **Message:** "This meeting link is invalid." *(exact copy, `ROOM_ERROR_MESSAGES`, `DirectVideoCall.jsx:85–92`)*.
- **Current state:** ✅.

### Meeting Already Ended
- **Message:** "This meeting has ended." · **Current state:** ✅ (`closed` reason in `ROOM_ERROR_MESSAGES`).

### Waiting for Doctor / Waiting for Patient
- **Message:** "Waiting for {patient/doctor}... Share the appointment link with the other person to begin." · **Current state:** ✅ well-implemented, including a distinct sub-message once the peer has joined but hasn't connected yet.

### Screen Sharing Failed
- **Current state:** 🟡 implemented but generic (Issue 12).

### File Upload Failed
- **Message:** `err.response?.data?.msg || err.message || "File upload failed."` · **Current state:** ✅ reasonable generic fallback; no distinct message for "file too large" (already validated client-side before upload, L2515–2518) vs. a genuine network failure — acceptable as-is.

### Recording Failed
- **Not applicable** — no call-recording feature exists anywhere in the reviewed code. If this is planned, it needs to be built from scratch (no partial implementation to critique).

---

## Refresh & Retry Recommendations

| Situation | Recommended action | Why |
|---|---|---|
| Video not loading / black screen (peer connected but no frames) | **Auto-detect** via `ontrack` firing but `videoWidth`/`videoHeight` staying 0 for >5s → show inline "Video isn't showing — [Reconnect]" using the existing `forceReconnect()` | The plumbing (`forceReconnect`) already exists for the "stalled" case (Issue 2) — reuse it here instead of building something new. |
| Socket disconnected | **Reconnect automatically** — already correct (`reconnectionAttempts: Infinity`). Don't add a manual button here; it would just fight the automatic reconnect. | Already optimal. |
| ICE negotiation failed (exhausted recovery attempts) | **Offer manual "Retry"** → calls `forceReconnect()`. Never silently loop forever without telling the user (current gap, Issue 2). | Users need an honest signal that automatic recovery isn't working. |
| Call stuck on "Connecting..." past ~20–25s | **Show the stalled banner + Retry**, which the code already does for the *pre-connect* case — just extend it to the *post-connect-drop* case (Issue 2's fix). | Consistency; don't make the user guess whether anything is happening. |
| Media device initialization failed | **Retry button**, not a page refresh — `retryMediaPermissions()` already re-runs the whole device-check + attach flow without tearing down the peer connection. | Refreshing would also drop the signaling state for no reason; the existing retry path is strictly better. |
| Token expired mid-call | **Reconnect automatically** via the existing 4-minute heartbeat refresh (already implemented) — only escalate to a user-visible warning if the refresh itself fails (currently swallowed, see the Session Expired row above). | Should be invisible in the happy path; only surface the failure case. |
| API timeout on a non-critical action (notes autosave, telemetry) | **Silent retry / drop**, already the pattern (`.catch(() => {})` for the heartbeat, silent for telemetry) | Correct — these shouldn't interrupt the call. |
| API timeout on a critical action (appointment fetch, prescription save) | **Inline error + explicit Retry button**, already the pattern everywhere reviewed. | Correct as-is. |
| Peer connection genuinely un-recoverable (browser crashed, extension broke WebRTC) | **Redirect to dashboard** with a clear "The call could not be completed" message, rather than an indefinite spinner. | Currently the closest thing is the manual `leaveCall()`/`Leave Call` button — acceptable, but only if the Retry-button gap (Issue 2) is also closed so users aren't stuck before they think to leave. |

---

## Improve User Experience — Recommendations

- **Network-quality indicator** (new): small colored dot + tooltip in the control bar driven by the already-collected `getStats()` data (ties directly to Issue 5). This is the single most impactful UX addition available given how much of the underlying plumbing already exists.
- **Microphone/camera live-status icons**: already exist as button states (`isMuted`/`isCamOff`) — good. Consider also showing the *peer's* mute/cam-off state (would require a small signaling addition — e.g. piggyback on `video-telemetry` or a new lightweight event) so each side knows if the other muted, rather than just guessing from a frozen video frame.
- **Reconnecting animation**: the waiting-ring/spinner already exists (`hc-vc__waiting-ring`) — good, reuse it consistently for the mid-call reconnect case (ties to Issue 2).
- **Retry button**: exists for camera/mic and for the pre-connect stall; extend to the mid-call stall (Issue 2).
- **Leave-meeting confirmation**: already implemented thoughtfully, including a doctor-specific "Leave vs. Complete Appointment" branch (`endCallConfirm` modal) — no changes needed.
- **Call duration timer**: already implemented (`fmtDuration`, doctor-only display) — consider also showing it to the patient; there's no clear reason it's currently gated to `isDoctor` only (`VideoCall.jsx:2662`).
- **Participant connection status**: the "{Patient/Doctor} joined - connecting..." toast already exists (L3114–3119) — good.
- **Empty states**: chat empty state exists and is well-written ("No messages yet. Share notes or files here during the call.") — good, no changes needed.
- **Disabled button states**: consistently implemented (`disabled={!isReady}`, `disabled={completing}`, `disabled={!chatInput.trim()}`, etc.) — good.
- **Success notifications**: prescription-saved toast exists but is currently **commented out** (`rxSavedToast`, L2953–2958 / L3443–3452) — either re-enable it or remove the dead state (`showRxModal`, `rxSavedToast`) entirely (Issue 18).
- **Skeleton screens**: the appointment-loading gate uses a simple spinner (`hc-vc__gate-spinner`) rather than a skeleton of the call UI — low priority, spinner is adequate for a single async fetch.

---

## Prioritization Summary

| # | Issue | Priority | Time to Fix | Complexity | Risk of Fix |
|---|---|---|---|---|---|
| 1 | No error boundary / unguarded WebRTC construction | 🔴 Critical | 2–4h | Low | Low |
| 2 | Reconnect-stalled banner unreachable mid-call | 🔴 Critical | 1–2h | Low | Low |
| 3 | No Socket.IO rate limiting | 🔴 Critical | 4–8h | Medium | Low |
| 4 | Socket auth defaults to "user" role | 🟠 High | 2–4h | Low | Low |
| 5 | Connection stats collected but not shown | 🟠 High | 4–6h | Medium | Low |
| 6 | No client-side chat flood guard | 🟠 High | 1h | Low | Low |
| 7 | `DirectVideoCall` `startedRef` permanent latch | 🟠 High | 1h | Low | Low |
| 8 | Doctor not notified on out-of-band completion | 🟠 High | 2h | Low | Low |
| 9 | Array-index React keys in chat | 🟡 Medium | 30m | Low | Low |
| 10 | No offline/online listeners | 🟡 Medium | 1–2h | Low | Low |
| 11 | No pre-flight browser support check | 🟡 Medium | 1h | Low | Low |
| 12 | Generic screen-share error messaging | 🟡 Medium | 1h | Low | Low |
| 13 | Direct room trust model — compliance sign-off | 🟡 Medium | N/A (policy, not code) | — | — |
| 14 | No draft-preservation for in-call prescription | 🟡 Medium | 2–3h | Medium | Low |
| 15 | Telemetry dropped when socket disconnected | 🟡 Medium | 3–4h | Medium | Low |
| 16 | Inline styles vs. BEM classes | 🟢 Low | 1–2h | Low | Low |
| 17 | Ungated production console logging | 🟢 Low | 1h | Low | Low |
| 18 | Dead commented-out JSX | 🟢 Low | 30m | Low | Low |

---

## Final Recommendations / Implementation Roadmap

**Phase 1 — Reliability guardrails (do first, ~1–2 days):**
Issues 1, 2, 11 (error boundary + browser capability gate + wire the stalled-reconnect banner into the mid-call path). These three together close the "user is stuck with no explanation and no way out" failure class, which is the most damaging thing this review found.

**Phase 2 — Abuse/security hardening (~2–3 days):**
Issues 3, 4, 6 (socket rate limiting, fix the role-default auth bug, client-side send throttling). None of these are currently being exploited as far as this review can tell, but they're the kind of gap that gets found the hard way in production.

**Phase 3 — Visible connection quality (~1–2 days):**
Issue 5 (surface the already-collected stats) plus the network-quality indicator from the UX section — high user-perceived value for relatively low effort since the data pipeline already exists end-to-end.

**Phase 4 — Correctness/edge-case cleanup (~1 day):**
Issues 7, 8, 9, 10, 12, 14, 15 — smaller, independent fixes; safe to batch into one PR.

**Phase 5 — Housekeeping (~half a day):**
Issues 16, 17, 18 — no functional risk, do whenever convenient (e.g., alongside the next unrelated PR that touches these files).

**Not recommended:** don't rewrite the perfect-negotiation/ICE-restart machinery, the device-fallback cascade in `getConsultationMediaStream`, the seat-limiting/duplicate-session eviction logic, or the TURN-credential minting — all four are already correct, already handle real edge cases the comments show were hit in production, and touching them without a specific bug driving the change would be pure risk for no reward.
