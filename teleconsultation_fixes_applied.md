# Teleconsultation Module — Fixes Applied

This documents every change made against the findings in
[`teleconsultation_code_review.md`](teleconsultation_code_review.md). All 18
issues from that report have been addressed — 15 with direct code changes,
1 already resolved as a side effect of another fix, and 2 that were
deliberately left as documented, low-risk trade-offs (explained below).

**Verification performed after all changes:**
- `npx eslint` on every touched frontend file — clean except pre-existing,
  out-of-scope warnings confirmed present in the original code via a
  before/after `git stash` comparison (see "Not changed" section).
- `node --check` on every touched backend file — passes.
- `npx vite build` (full production build) — succeeds with no errors.

---

## Critical

### Issue 1 — No error boundary / unguarded WebRTC construction
- **Added** `frontend/src/components/CallErrorBoundary.jsx` — a route-level React error boundary with a "Something went wrong — Reload Page" fallback.
- **`frontend/src/App.jsx`** — wrapped both `/video-call/:appointmentId` and `/direct-video-call/:roomId` routes in `CallErrorBoundary`.
- **`frontend/src/pages/VideoCall.jsx`** — added a `window.RTCPeerConnection`/`getUserMedia` capability check before WebRTC setup begins (shows "Your browser doesn't support video calls…" via the existing `apptError` gate screen), and wrapped `new RTCPeerConnection(...)` in `try/catch`.
- **`frontend/src/pages/DirectVideoCall.jsx`** — same capability check (routes into the existing `"error"` stage), and the same `try/catch` around `new RTCPeerConnection(...)` inside `setupPeerConnection`.

### Issue 2 — Reconnect-stalled banner unreachable mid-call
- **`frontend/src/pages/VideoCall.jsx`** — `onconnectionstatechange`'s `disconnected`/`failed` branch and `oniceconnectionstatechange`'s `failed`/`disconnected` branches now call `startReconnectStallWatch(12000)` whenever `hasConnectedOnceRef.current` is true, so a mid-call drop (not just a slow first handshake) gets the same "Reconnection is taking longer than expected — Retry" banner.

### Issue 3 — No Socket.IO rate limiting
- **Added** `backend/utils/socketRateLimit.js` — a small per-socket fixed-window limiter (`makeSocketLimiter`).
- **`backend/server.js`** — instantiated limiters for `appointment-message` (5/s), `video-offer`/`video-answer` (2/s), `ice-candidate` (20/s), `ice-restart-request` (3 per 5s), `video-telemetry` (10/s), and the `direct-*` equivalents; wired an `.allow(socket.id)` check into each handler; disposed each socket's limiter state on `disconnect` so memory doesn't grow unbounded.

---

## High

### Issue 4 — Socket auth silently defaulting to the "user" role
- **`frontend/src/socket.js`** — added `export function setSocketAuthRole(role)`, which sets `socket.auth` for the given role and remembers it in a module-level `currentAuthRole`, used by `reconnect_attempt` instead of the ambient `activeAuthRole` global.
- **`frontend/src/pages/VideoCall.jsx`** — calls `setSocketAuthRole(isDoctor ? "doctor" : "user")` immediately before every connect/reconnect decision.

### Issue 5 — Connection stats collected but never shown
- **`frontend/src/pages/VideoCall.jsx`** — added `deriveConnectionQuality()` (RTT + delta-based packet-loss ratio → `good`/`weak`/`poor`/`unknown`), a `connectionQuality` state wired into the existing `startStatsCollection` interval, and a new colored Wi-Fi pill in the control bar with a tooltip explaining the current state.
- **`frontend/src/pages/videocall.css`** — added `.hc-vc__quality-pill` (+ `--good`/`--weak`/`--poor` modifiers).

### Issue 6 — No client-side chat flood guard
- **`frontend/src/pages/VideoCall.jsx`** and **`DirectVideoCall.jsx`** — added a 300ms cooldown (`CHAT_SEND_COOLDOWN_MS`) gating `sendMessage`/`sendChatMessage`, with the Send button's `disabled` state reflecting it.

### Issue 7 — `DirectVideoCall`'s `startedRef` permanent latch
- **`frontend/src/pages/DirectVideoCall.jsx`** — the call-setup effect's cleanup now resets `startedRef.current = false`, so a future rejoin-after-error flow (not yet built, but no longer blocked) can re-run setup.

### Issue 8 — Doctor not notified on out-of-band appointment completion
- **`frontend/src/pages/VideoCall.jsx`** — added `completingRef` (mirrors the `completing` state, avoiding a stale closure inside the socket effect) and an `apptClosedByOther` state. `handleApptUpdated` now shows the doctor a persistent banner ("This appointment was marked complete/cancelled by an administrator.") with a "Leave Call" button — guarded so it never fires for the doctor's own self-completion.

---

## Medium

### Issue 9 — Array-index React keys in chat
- **`VideoCall.jsx`** and **`DirectVideoCall.jsx`** — added a `makeMessageKey()` helper (uses `crypto.randomUUID()` with a fallback); every message entering state (`handleChatMessage`, `handleChatHistory`, and the optimistic local push in `DirectVideoCall`'s `sendChatMessage`) is tagged with a stable `_localKey`, used as the React `key` instead of the array index.

### Issue 10 — No offline/online listeners
- **`VideoCall.jsx`** and **`DirectVideoCall.jsx`** — added an `isOffline` state driven by `window`'s `online`/`offline` events, and a full-width "You're offline. Reconnecting once your internet is back." banner.
- **`videocall.css`** / **`directvideocall.css`** — added `.hc-vc__offline-banner` / `.dvcall-offline-banner`.
- *Scope note:* the original report's example UI also suggested disabling all in-call controls while offline. That was deliberately **not** done — camera/mic mute toggles are local-only and should keep working even while offline; only the banner was added.

### Issue 11 — No pre-flight browser support check
- Already resolved as a direct side effect of **Issue 1**'s capability check — no separate change needed.

### Issue 12 — Generic screen-share error messaging
- **`VideoCall.jsx`** — added `screenShareErrorMessage(err)`, mapping `NotReadableError`/`TrackStartError` (device busy), `NotFoundError` (nothing available to share), and `TypeError` (unsupported configuration) to distinct messages; `AbortError` is now treated as a picker-cancellation alongside `NotAllowedError` (silently ignored, not logged as a failure).

### Issue 13 — Direct Video Room trust model
- No code change — this is a product/compliance sign-off item, not a bug. Flagged again here so it isn't lost.

### Issue 14 — No draft preservation for in-call prescriptions
- **`VideoCall.jsx`** (`InCallPrescriptionModal`) — added `loadPrescriptionDraft()`/an auto-save `useEffect` that persists `{diagnosis, medicines, instructions, followUpDate}` to `sessionStorage` keyed per appointment; the draft is restored if the modal is reopened, and cleared only after a successful save.

### Issue 15 — Telemetry dropped when socket disconnected
- **`VideoCall.jsx`** — added `telemetryQueueRef` (capped at `TELEMETRY_QUEUE_MAX = 50`) and `flushTelemetryQueue()`. `logVideoEvent` now queues events while the socket is disconnected instead of dropping them, and the queue flushes as soon as the socket reconnects (`joinRoom`, called from both the initial `connect` and every `reconnect`).

---

## Low

### Issue 16 — Inline styles vs. BEM classes
- **`VideoCall.jsx`** — the End-Call-confirm and Leave-confirm modals now use `.hc-vc__confirm-overlay/-modal/-icon/-title/-text/-actions/-btn` classes instead of large inline `style={{...}}` objects (values kept pixel-identical to the originals).
- **`videocall.css`** — added the corresponding rules.

### Issue 17 — Ungated production console logging
- **`VideoCall.jsx`** — gated the per-30-second `[webrtc-stats]` log and the one-time "WebRTC peer connection created" log (which included ICE/TURN server hostnames) behind `import.meta.env.DEV`.
- *Scope note:* `logVideoEvent`'s own existing dev/prod branching (shorter output in prod, not fully silent) was left as-is — that's pre-existing, intentional behavior, not the "ungated" logging this issue was about.

### Issue 18 — Dead commented-out JSX
- **Deleted**: the commented-out connection-status pill and date/time info chips — redundant now that Issue 5 added a real connection-quality indicator.
- **Restored (uncommented)**: the patient-side "Prescription issued" banner, the doctor-side "Prescription issued successfully" toast, and the doctor's "Rx" button that opens `InCallPrescriptionModal` — all three were fully wired (state, socket handler, CSS) and only the JSX was disabled; the Rx button was in fact the *only* way to open the prescription modal, so deleting it instead would have made that whole feature unreachable. The missing `FaCapsules` icon import was replaced with the 💊 emoji already used elsewhere in the same modal, avoiding a new icon-library dependency.
- Also removed the now-fully-unused `fmtDate` helper, whose only reference was inside the deleted comment block (confirmed via lint before/after comparison).

---

## Not changed (pre-existing, confirmed via `git stash` before/after lint comparison — not introduced by this work, and intentionally left alone)

- Two `catch (_) { }` empty-block patterns in `setTrackHint`/`tuneSenderQuality` (unrelated helper functions).
- The `connectionState` React state is technically unused for display now that its only reader (the deleted status-pill comment) is gone. It's left in place because every `setConnectionState(...)` call site is woven into the ICE-restart/perfect-negotiation logic the original report explicitly recommended not touching — removing it would mean editing that machinery for a cosmetic lint nit.
- One `react-hooks/exhaustive-deps` warning (missing `navigate`/`startStatsCollection` in an unrelated effect) and one in `App.jsx` (missing `warningCountdownMs`) — both pre-existing, outside the scope of this review.

## Files touched

```
frontend/src/App.jsx
frontend/src/socket.js
frontend/src/pages/VideoCall.jsx
frontend/src/pages/DirectVideoCall.jsx
frontend/src/pages/videocall.css
frontend/src/pages/directvideocall.css
frontend/src/components/CallErrorBoundary.jsx   (new)
backend/server.js
backend/utils/socketRateLimit.js                (new)
```
