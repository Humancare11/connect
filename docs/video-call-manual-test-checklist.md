# Video call - manual test checklist (things automation cannot cover)

The automated suites (`backend npm run test:integration`, `e2e` resilience specs,
mobile `flutter test`) run on one machine with a fake camera and a local TURN.
These cases need real devices / networks. Tick each on a **staging** build; none
should need the user to do anything but wait, except where a Retry button is named.

Legend: **W** = web (Chrome/Safari), **A** = Android patient app, **I** = iOS patient app
(if/when shipped), **D** = doctor web.

## 0. Setup
- Staging backend with REAL TURN configured (`RTC_TURN_URLS`, `TURN_STATIC_AUTH_SECRET`), `/api/rtc/ice-servers` returns no `warning`.
- A confirmed appointment (doctor on web, patient on the app) and a direct-call link.
- Open logs: backend (`[socket]`, `signaling event rejected`), browser console, `adb logcat | grep video-call`.

## 1. Cross-platform pairs (cannot be automated here)
| # | Pair | Steps | Expect |
|---|------|-------|--------|
| 1.1 | D <-> A | Join; talk 2 min | Both see/hear each other; no rebuild loop in logs |
| 1.2 | D <-> A | Patient app: Wi-Fi off (mobile data stays) | Video continues or recovers < 15 s, no user action |
| 1.3 | D <-> A | Patient app: mobile data off + Wi-Fi on mid-call | same |
| 1.4 | D <-> A | Airplane mode 10 s / 40 s / 90 s then off | <= 30 s drop: silent recovery. > 30 s: doctor sees "patient left", then call resumes on return without taps |
| 1.5 | D <-> A | Lock the phone 30 s / 3 min, unlock | Call recovers < 15 s; no "Access Denied" |
| 1.6 | D <-> A | Switch to another app for 1 min, return | same; remote video repaints (not frozen) |
| 1.7 | D <-> A | Force-stop the app, reopen, rejoin | Resumes; doctor sees left -> back |
| 1.8 | D <-> A | Deny camera, then grant in Settings and return | Call joins audio-only/receive-only with a clear banner; after granting, media attaches (Retry banner works) |
| 1.9 | D <-> A | Unplug/connect Bluetooth headset mid-call | Audio route follows; if the mic dies the app re-acquires it automatically |
| 1.10 | D <-> A | Toggle speaker / switch camera repeatedly | no freeze |
| 1.11 | W-patient <-> A-doctor-app (doctorapp is OUT of this branch's scope) | - | not covered |

## 2. Real networks / carriers
- 2.1 Both sides on different carriers' 4G/5G (CGNAT): call must connect (needs TURN). Check `selectedCandidatePair` = relay in `chrome://webrtc-internals`.
- 2.2 Corporate/hotel Wi-Fi that blocks UDP: call must connect over TURN/TCP/TLS 443 (verify the production TURN actually listens on 443/TLS).
- 2.3 Network that blocks WebSockets: web falls back to polling and works. **The Android app uses WebSocket only** - on such a network signaling cannot connect (known limitation; see report M9).
- 2.4 Walk between Wi-Fi access points / lift / tunnel while calling: recovery without taps.
- 2.5 Throttle to 3G / 5% loss (Network Link Conditioner on macOS, or router QoS): call stays up, quality drops, no rebuild loop.
- 2.6 VPN on/off mid-call.

## 3. Production TURN (cannot be reached from CI)
- 3.1 Credentials: `/api/rtc/ice-servers` -> `username` is `<expiry>:<id>`; TURN accepts it; rejects after expiry.
- 3.2 Region 2 (if configured) reachable; killing region 1 still connects via region 2.
- 3.3 Relay bandwidth: two 720p calls relayed concurrently stay stable.
- 3.4 `total-quota` / `user-quota` in coturn are not exhausted by repeated ICE restarts (watch `turnserver.log`).
- 3.5 Time skew: TURN host clock within 1 min of the API host (REST credentials depend on it).

## 4. Browsers / devices
- Safari iOS and Chrome Android: background the tab 1 min, return -> camera/mic still live or auto-re-acquired (iOS may end tracks).
- Desktop Safari/Firefox: join, reload, second tab (old tab must show the "another session" message, not a blank page).
- In-app browsers (WhatsApp/Instagram) for direct links: banner shown, call connects.

## 5. Server operations
- Deploy/restart the backend mid-call (rolling): calls recover without errors; with >1 instance a call must stay on one node (in-memory room state is per process - **do not scale horizontally without a Socket.IO adapter**).
- SIGTERM: log shows "Graceful shutdown complete", no ERR_SERVER_NOT_RUNNING.
- MongoDB primary failover during a call: joins answer `server_error` and clients retry; no process crash.
