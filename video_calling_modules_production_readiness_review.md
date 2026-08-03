# Video Calling Modules — Production Readiness Review

Scope: three video-calling surfaces sharing one Node/Express + Socket.IO backend
(`connect/backend/server.js`) —

1. **Web Video Consultation** — `connect/frontend/src/pages/VideoCall.jsx`, appointment-based, doctor/patient.
2. **Web Direct Video Call** — `connect/frontend/src/pages/DirectVideoCall.jsx`, ad-hoc link-based, no login.
3. **Flutter Video Call** — `connect-mobile/lib/controllers/video_call_controller.dart` +
   `lib/screens/video_call_screen.dart` + `lib/services/{call_foreground_service,ice_server_config,socket_service,notification_service}.dart`.

This is a review only — no code was changed as part of this report.

## Overall verdict

All three modules are in materially better shape than a typical first pass at
WebRTC + Socket.IO — perfect-negotiation offer/answer handling, bounded ICE
restart, short-lived TURN credentials, and guarded cleanup are present
*everywhere*, including the mobile app. The remaining issues are concentrated
in three places: **one concrete race condition in the Flutter controller
(High)**, **a handful of mobile-specific reliability gaps that make the app
slower/less resilient than the web equivalents (Medium)**, and **infrastructure/
scaling risks that don't affect correctness today but will bite if the
deployment ever changes shape (Medium)**. Nothing found rises to
"actively broken in normal use" for any of the three.

---

## 1. Flutter Video Call — findings

### Reliability-pattern parity vs. the (already-hardened) web modules

| Pattern | Status | Detail |
|---|---|---|
| Perfect-negotiation offer/answer correlation | **Present** | `video_call_controller.dart:320,326,1267-1268,1629-1637` — faithful port. |
| Offer/answer timeout self-heal | **Present** | `:61` `kOfferAnswerTimeoutMs=8000`, rollback+retry at `:1280-1309`. |
| Bounded ICE restart (cap/cooldown/peer-fallback) | **Partial** | Cap/cooldown/fallback present and numerically match web (`:54-55`), but the "first attempt fires immediately" optimization is missing — `_scheduleIceRestart` (`:1375-1404`) always applies the flat 2.5s delay, so **every** mobile recovery starts ~2.5s slower than web's. |
| Split first-handshake vs. mid-call watchdog timeout | **Missing** for the actual restart trigger | `_startConnectionWatchdog` (`:1313-1322`) always uses the flat 25s (`kConnectionFailTimeoutMs`) — there's no 12s fast-fail for a stuck *first* handshake the way web has (`INITIAL_CONNECTION_TIMEOUT_MS`). A separate UI-only stall banner *does* use differentiated delays, but it doesn't drive the restart — net effect, a stuck first connection on mobile takes **~2x longer** to trigger recovery than on web. |
| Remote-stream rebind after recovery | **Present** | `_refreshRemoteStreamBinding()` (`:963-980`), armed correctly on disconnect/failed. |
| App-lifecycle (foreground/background) recovery nudge | **Partial** | On resume (`:1431-1456`), only calls `_socket.connect()` — a no-op if the socket never actually dropped (plausible, since the foreground service keeps the process alive). If ICE/media silently died while the signaling socket stayed up, **resuming the app does not nudge ICE recovery** the way web's `visibilitychange` handler does. The separate connectivity-*change* handler (`:491-493`) does correctly nudge ICE directly — the gap is specific to the app-resume path. |
| Guarded single-run cleanup | **Present** | `performCleanup()` (`:2569-2580`), `_completedFlag` set before any `await`. |
| Tightened reconnection backoff during a call | **Missing** | `socket_service.dart:60-61` sets `reconnectionDelayMax(30000)` once, statically. Nothing calls the mobile equivalent of tightening it during an active call. An active mobile call can back off up to 30s between reconnect attempts — on cellular, the network type most prone to drops, and exactly the window web deliberately tightened to 8s. |
| Short-lived, per-session TURN credentials | **Present, well implemented** | `ice_server_config.dart:88-166` fetches fresh per session, validates TURN entries carry credentials, no hardcoded fallback. |

### Bugs / edge cases

- **[High] Race condition in local-media readiness gate.** `_localReady` (a `Completer<bool>`) is an **instance field**, reset on every `startCallSession()`/`forceReconnect()` (`:647`). `_acquireLocalMedia()` is fire-and-forget (`unawaited`) and completes `_localReady` by reading that same instance field after its `await`s (`:724, :750, :760`). If a reconnect starts while a slow/stuck previous `_acquireLocalMedia` call is still in flight, the stale call can complete the **new** session's completer (e.g. with `false`) before the new acquisition attempt gets a chance to. Concrete symptom: `_handleOffer` (`:1583`) can see a false negative and show "Allow camera or microphone access, then retry" even though real media access is about to succeed — a false permission error surfacing mid-reconnect, in exactly the self-healing path the rest of the code protects carefully. *(The equivalent web code avoids this entirely — `VideoCall.jsx` creates a fresh `localReadyPromise`/`resolveLocalReady` pair as a **local closure variable** on every effect run, not a shared instance field, so a stale run's resolution can never touch the new run's promise. This is a porting gap, not a web-side issue to also fix.)*
- **[Medium] `dispose()` doesn't await or guard its own cleanup.** `:497-510` fires `unawaited(performCleanup())` then immediately disposes the renderers; `performCleanup()`'s track-stop loop (`:2575-2578`) has no try/catch, so a `track.stop()` throwing on some device/OEM after the widget is gone becomes an unhandled rejection.
- **[Low/Medium] `forceReconnect()`/`startCallSession()` only guard on `_disposed`, not `_completedFlag`.** A stray call in the narrow window between "call logically ended" and "widget actually disposed" (e.g. mid `Navigator.pop()` transition) could restart signaling on a session that already considers itself finished.
- **[Medium] No wake-lock.** No `wakelock`/`wakelock_plus` package anywhere in `pubspec.yaml`/`lock`. Keep-alive relies solely on the Android foreground service + iOS's `audio` background mode — reasonable for process survival, but doesn't guarantee the CPU/screen stay awake the way an explicit wake lock does; some OEM battery managers still throttle foreground-service apps without one.
- **[Medium, product gap] No CallKit/PushKit (iOS) or ConnectionService (Android).** Incoming-call handling is a standard FCM data/notification flow (`notification_service.dart`) with tap-to-navigate — no VoIP push integration. If the app is fully killed (not just backgrounded) when a call notification arrives, there's no OS-level wake-and-ring guarantee, particularly on iOS where a regular remote notification can be delayed/coalesced.
- **[Medium] Reconnect-stall banner armed on the wrong signal.** It's gated on `inCall`, which `_markInCall()` sets right after the SDP exchange completes (inside `_handleOffer`/`_handleAnswer`, `:1603, :1649`) — **before** ICE has actually reached "connected". Web gates the equivalent on `hasConnectedOnceRef`, true only after a genuine "connected" transition. Net effect: an ordinary (if slow) first-time connect can trigger the mid-call 12s "Retry" banner meant for post-connection drops, instead of the more patient first-connect window.
- **[Low] `retryMediaPermissions()` doesn't re-validate peer-connection identity after its awaits.** Unlike `_acquireLocalMedia` (which checks `_pc != pc` post-await, `:720`), a concurrent `forceReconnect()` mid-retry could leave this acting on a stale, already-closed `pc`.

### Security
No hardcoded TURN or signaling credentials anywhere in `connect-mobile/lib` or its `.env*` files — TURN credentials are fetched fresh per session and validated; the socket auth token is read from secure storage on every (re)connect. Clean.

---

## 2. Web Video Consultation (`VideoCall.jsx`) — findings

Already hardened extensively (perfect negotiation, bounded ICE restart with the
immediate-first-attempt fix, split watchdog timeouts, `visibilitychange` +
Network Information API nudges, tightened reconnection backoff during a call,
authenticated short-lived TURN credentials). Residual items:

- **[Low, by design] Doctor never self-initiates an ICE-restart offer** — `scheduleIceRestart`'s `if (isDoctor) { requestPeerIceRestart(); return; }` means doctor-side recovery always costs one extra round trip (ask the patient to restart, wait for their offer) versus a symmetric design. This is a deliberate collision-avoidance simplification (documented in the code's own comments), not a bug — flagging only because it's a real, measurable extra latency source specific to this module that Direct Video Call's symmetric design doesn't share.
- **[Low, code quality, pre-existing]** `npx eslint` reports 5 errors + 1 warning, all confirmed present in the last committed version of the file (verified via `git show HEAD:...`) and therefore unrelated to any work in this engagement: two `catch (_) {}` empty-block/unused-var pairs (`setTrackHint`, `tuneSenderQuality`), an unused `connectionState` state variable, and a `react-hooks/exhaustive-deps` warning on the main effect (missing `navigate`, `startStatsCollection`). Worth a cleanup pass but not a functional risk.
- No XSS surface found — chat message rendering uses plain JSX text interpolation throughout, no `dangerouslySetInnerHTML`/`innerHTML`/`eval` anywhere in the file.

---

## 3. Web Direct Video Call (`DirectVideoCall.jsx`) — findings

Same hardening as above, plus its own guest-specific reliability additions
(ICE config fetch+fallback, in-call media retry, connection-quality badge).
Residual items, all low severity:

- **[Low, by design]** The `attemptRecoveryNudge` triggered by `online`/`visibilitychange`/Network-Information-API events calls `createAndSendOffer` directly, bypassing `scheduleIceRestart`'s attempt-counter/cooldown. This is intentional (event-triggered, not a timed loop) and is still bounded in practice by `createAndSendOffer`'s own overlap guards plus server-side rate limiting (`directSdpLimiter`, 2/second) — but worth documenting so it isn't mistaken for an oversight later.
- **[Low]** A room's `expiresAt` is only checked at join time, not enforced continuously — a call already in progress when the nominal expiry passes is not forcibly ended. Likely fine for this use case (no real business-critical urgency), just confirming the actual behavior.
- Automatic recovery does eventually stop retrying (it is not an infinite tight loop) if no further connectivity/visibility/online signal ever fires — the final fallback in that scenario is the manual "Reconnect" button, which is armed correctly on both first-connect and post-connect-drop paths.
- No XSS surface found (same check as above, clean).

---

## 4. Shared backend / infrastructure — findings

- **[Medium — Low today, High if you ever scale horizontally] No Redis (or other shared-store) Socket.IO adapter.** `onlineUsers`, `socketRooms`, `directRoomSockets`, `directRoomRoles`, `roomActivated`, and all the rate limiters in `socketRateLimit.js` are plain in-process `Map`s (the file's own comment already flags this: *"if this backend ever scales horizontally, this needs to move to a shared store (Redis)"*). Confirmed via `package.json`/grep: no `@socket.io/redis-adapter` or clustering dependency exists. Today, with a single Node process, this is fine. The moment this backend runs as more than one process (PM2 cluster mode, multiple containers behind a load balancer), Socket.IO rooms/broadcasts break across instances entirely — a doctor on instance A and a patient on instance B would never see each other's signaling events at all, not just slowly. Flagging now so it's a planned migration rather than a surprise outage during a scaling event.
- **[Medium] `DirectVideoRoom.expiresAt` has a regular index, not a TTL index.** Confirmed in `models/DirectVideoRoom.js:20` — `index: true`, no `expires`/`expireAfterSeconds`. No cron job or scheduled cleanup references this model anywhere in the backend (grepped all 4 files that touch `DirectVideoRoom`). Every room ever created — active, closed, or expired — stays in MongoDB forever. The admin list endpoint stays fast (`.limit(200)`), so this isn't user-visible yet, but the collection grows unbounded indefinitely with no retention policy.
- **CORS/origin allowlisting is properly configured** — driven by `FRONTEND_URL` env var, not a wildcard, for both the HTTP API and the Socket.IO handshake. The Socket.IO CORS check allows requests with no `Origin` header unconditionally, which is necessary to support native (Flutter) client connections and is not a gap.

---

## Prioritized action list

**High**
1. Fix the Flutter `_localReady` completer race (use a per-attempt local variable instead of a reused instance field, mirroring the web pattern) — this is the one finding that can visibly break a real call (false "camera/mic denied" prompt during an otherwise-successful reconnect).

**Medium**
2. Flutter: tighten `reconnectionDelayMax` while a call is active (mirror web's 30s→8s pattern).
3. Flutter: split the connection-watchdog timeout (short first-handshake vs. longer mid-call recheck), and drive it from the same signal web uses (`hasConnectedOnce`-equivalent), not the currently-too-early `inCall` flag.
4. Flutter: make the app-resume handler directly nudge ICE recovery (not just reconnect the socket).
5. Flutter: add explicit wake-lock handling for the duration of a call.
6. Decide on a VoIP-push (CallKit/PushKit + ConnectionService) strategy for incoming calls if reliable ringing while the app is fully killed matters for the product.
7. Add a TTL index (or a scheduled cleanup job) for `DirectVideoRoom` so old rooms don't accumulate forever.
8. Plan the Redis-adapter migration path before any horizontal-scaling deployment change, even if it's not needed today.
9. `dispose()` in Flutter should await and guard its own cleanup instead of firing-and-forgetting it.

**Low**
10. Flutter: immediate-first-ICE-restart-attempt optimization (mirrors the web fix), the `_completedFlag` guard on `forceReconnect`/`startCallSession`, and re-validating peer-connection identity in `retryMediaPermissions()` after its awaits.
11. Web: clean up the 5 pre-existing lint errors in `VideoCall.jsx` (unrelated to recent work, just hygiene).

Nothing above requires an architectural change to any of the three modules — every item is a contained, local fix.
