# Video Call Connectivity Investigation — Flutter Patient ↔ Web Doctor

**Scope:** Why a video call between a patient on the `connect-mobile` (Flutter)
app and a doctor on the `connect/frontend` (React web) app fails to connect,
against the shared `connect/backend` (Node/Express + Socket.IO) signaling
server.

**Method:** Full static read of the signaling, WebRTC, ICE/TURN, and
reconnection code on all three sides (backend, web, Flutter), cross-checked
event-by-event and field-by-field for contract mismatches, plus live
network/reachability checks against the actual UAT infrastructure the
`connect-mobile/.env` points at. No code was modified. Every claim below is
cited to a file and line; where something could not be verified without a
live failed-call reproduction (device console / backend logs during an
actual attempt), that is stated explicitly rather than inferred.

---

## 1. Executive summary

- The **signaling contract, WebRTC negotiation roles, and ICE-restart/
  reconnection logic are consistent** between the Flutter app and the web
  app. This was ported deliberately and carefully (`video_call_controller.dart`
  is a 1:1 port of `VideoCall.jsx`, per its own header comment), and no
  mismatch was found in event names, payload shapes, or the polite/impolite
  offer-initiation rule. This rules out the most common cause of
  cross-platform WebRTC failures (protocol mismatch).
- One **concrete, verified misconfiguration** was found in
  `backend/.env.production`: `RTC_TURN_URLS` is defined **twice**, and the
  second definition silently overwrites the first, permanently dropping the
  `turns:turn.humancareconnect.co:443` (TLS-over-443) relay entry. Only the
  `:3478` UDP/TCP entries are actually served to clients from that file. A
  live check confirms port 443 on the TURN host **is** open and listening —
  the capability exists, it's just not being advertised to clients from that
  config file.
- **This is the strongest verified, fixable lead**, and it fits the reported
  symptom pattern well: a `turns:` port-443 fallback is specifically what
  lets a TURN relay survive restrictive networks (cellular carrier NAT/
  firewalls, corporate proxies that block non-standard UDP/TCP ports) — the
  exact kind of network a phone is disproportionately likely to be on
  compared to a doctor's office/home Wi-Fi web session. Losing it doesn't
  break every call, only ones where a peer is behind a network that blocks
  port 3478.
- **This could not be confirmed as *the* live root cause**, for one specific,
  named reason: the environment the mobile app actually talks to
  (`uat-api.humancareconnect.co`, per `connect-mobile/.env`) loads
  `backend/.env.uat` at boot (`server.js:5-12`), and that file is
  git-ignored (`backend/.gitignore:22`) — it exists only on the live server,
  not in this repository checkout. **I cannot see its TURN configuration.**
  It may have the same duplicate-key defect, a different one, or none at
  all. This must be checked directly on the server (or reproduced via the
  diagnostic steps in §7) before treating §1's TURN finding as confirmed.
- No other verified code-level defect was found. Two lower-confidence,
  unverifiable-without-live-logs candidates are listed in §6 for
  completeness.

---

## 2. Signaling contract — verified consistent

All three sides agree on room naming, event names, and payload shapes for
the appointment call flow.

| Concern | Backend (`backend/server.js`) | Web (`frontend/src/pages/VideoCall.jsx`) | Flutter (`lib/controllers/video_call_controller.dart`) |
|---|---|---|---|
| Room name | `` `appointment_${appointmentId}` `` — `server.js:668-670`, identity-based access only, no platform branching (verified via full-file grep for `platform`/`user-agent`/`flutter`) | joins via `join-appointment-room` | joins via `join-appointment-room` |
| `join-appointment-room` payload | `{ appointmentId, userId, role, token }` expected — `server.js:1030` | `{ appointmentId, userId, role, token }` — `VideoCall.jsx:1359-1364` | `{ appointmentId, userId, role, token }` — `video_call_controller.dart:1771-1776` |
| `role` literal | checked as `"user"` \| `"doctor"` — `server.js:795-807` | sends `"doctor"`/`"user"` — `VideoCall.jsx:1344` | sends `"doctor"`/`"user"` (always `"user"`, app is patient-only) — `video_call_controller.dart:1731` |
| `video-offer` | pure relay, `{offer, offerId}` — `server.js:1272-1281` | `{appointmentId, offer, offerId}` — `VideoCall.jsx:1614-1618` | `{appointmentId, offer: {sdp,type}, offerId}` — `video_call_controller.dart:1097-1101` |
| `video-answer` | pure relay, `{answer, offerId}` — `server.js:1284-1291` | `{appointmentId, answer, offerId: incomingOfferId}` — `VideoCall.jsx:2055-2059` | `{appointmentId, answer: {sdp,type}, offerId}` — `video_call_controller.dart:1424-1427` |
| `ice-candidate` | relay, strips `appointmentId` — `server.js:1294-1301` | `{appointmentId, candidate: e.candidate}` — `VideoCall.jsx:1906` | `{appointmentId, candidate: candidate.toMap()}` — `video_call_controller.dart:881-884` |
| `ice-restart-request` | bare relay, no payload — `server.js:1304-1311` | emits `{appointmentId}` — `VideoCall.jsx:1726` | emits `{appointmentId}` — `video_call_controller.dart:1223` |
| `peer-joined` on late join | server explicitly re-emits `peer-joined` **to the joining socket itself** if a peer is already in the room (`if (peerPresent) socket.emit("peer-joined", ...)` — `server.js:1071, 1162`), so join-order (patient-first vs doctor-first) cannot deadlock the "who offers" logic | listens `peer-joined` — `VideoCall.jsx:2307-2318` | listens `peer-joined` → `_handlePeerJoined` — `video_call_controller.dart:1685` |

**Auth transport**: the backend's socket middleware (`server.js:887-960`)
authenticates via HttpOnly cookie first, and explicitly documents (comment,
`server.js:904-907`) a fallback to `socket.handshake.auth.token` /
`Authorization: Bearer` specifically for non-browser clients. The Flutter
socket client sends the access token via `setAuthFn` on every connect/
reconnect (`socket_service.dart:64-70`) and again per-event in the
`join-appointment-room`/`user-online` payloads (`video_call_controller.dart:
1765-1776`) — this matches the documented mobile path and was implemented
specifically to fix an earlier version of this file that omitted it (see the
file's own header comment, `socket_service.dart:1-15`). **Conclusion: socket
auth is correctly wired for the Flutter client**, assuming the token itself
is a valid, unexpired, unrevoked JWT for the patient account (not
independently testable without a live token).

---

## 3. WebRTC negotiation — verified consistent ("perfect negotiation")

Both `VideoCall.jsx` and `video_call_controller.dart` implement the same
polite/impolite scheme, with the same non-standard hardening on top:

- **Doctor = polite, never self-initiates an offer.** It only answers
  incoming offers, or — on reconnect/resume — emits `ice-restart-request`
  and waits for the patient to re-offer. Web: `VideoCall.jsx:1806-1818,
  2191-2221, 1771-1773`. Flutter (always the patient in this app —
  `isDoctor` is hardcoded reachable-false via `_hasDoctorIdentity`,
  `video_call_controller.dart:178`) implements the mirror-image doctor
  branch identically at `video_call_controller.dart:1253-1257`, so the
  behavior this app would show *if* it were ever a doctor matches the web
  doctor's behavior exactly — confirming the two were built to the same
  contract, not independently guessed.
- **Patient = impolite, sole offer-initiator.** On local-media-ready +
  peer-already-present, and again on receiving `peer-joined`, only the
  non-doctor side sends the first offer. Web: `VideoCall.jsx:1806-1818,
  2191-2202`. Flutter: `video_call_controller.dart:619-625, 1550-1556`.
- **Offer/answer collision handling** (both sides can race an offer at
  once): impolite peer ignores the incoming colliding offer
  (`shouldIgnoreOffer = !isPolitePeer && offerCollision`); polite peer rolls
  back its own local offer and accepts the incoming one instead. Identical
  logic, web `VideoCall.jsx:1998-2027`, Flutter `video_call_controller.dart:
  1356-1433`.
- **Offer/answer correlation via app-level `offerId`** (not standard WebRTC —
  a custom addition to reject stale/replayed answers, relevant because
  Socket.IO's `connectionStateRecovery` can redeliver buffered events):
  identical on both sides — web `VideoCall.jsx:2085-2099`, Flutter
  `video_call_controller.dart:1450-1463`.
- **ICE candidate queuing**: candidates arriving before `remoteDescription`
  is set are queued and flushed after `setRemoteDescription` succeeds, on
  both sides (web `VideoCall.jsx:2123-2147, 1579-1589`; Flutter
  `video_call_controller.dart:1484-1514, 1032-1050`). Neither side filters
  candidates by type (no mDNS/host dropping) — all candidate types are
  forwarded and applied as gathered.
- **ICE-restart backoff**: same constants and same debounce/cooldown/max-
  attempts scheme, same "hand off to peer via `ice-restart-request` once
  local attempts are exhausted" behavior on both sides (web
  `VideoCall.jsx:1736-1777`; Flutter `video_call_controller.dart:1230-1259`).

**Conclusion: the negotiation protocol itself is not the problem.** A
mismatch here (e.g. both sides expecting the other to offer first, or
disagreeing on politeness) would produce a very specific, testable symptom —
both peers' `RTCPeerConnection.signalingState` staying `"stable"` forever
with zero `video-offer` ever sent — and the code was verified not to have
that mismatch.

---

## 4. TURN/STUN configuration — the verified defect

### 4.1 How ICE servers reach each client

Neither client hardcodes STUN/TURN. Both fetch `GET /api/rtc/ice-servers`
at call start (web: `VideoCall.jsx:1106`; Flutter:
`ice_server_config.dart:126`), which mints short-lived, per-request TURN
credentials server-side using the coturn "TURN REST API" convention
(`backend/utils/turnCredentials.js:17-35`, `backend/routes/rtc.js:42-73`).
Both clients validate the response the same way (reject if a `turn:`/
`turns:` entry is missing `username`/`credential`; both fail loudly if the
list is empty) and build an identical `RTCConfiguration`:
`{ iceServers, iceCandidatePoolSize: 10, bundlePolicy: "max-bundle",
rtcpMuxPolicy: "require" }` (web `VideoCall.jsx:1115-1120`; Flutter
`ice_server_config.dart:143-149`). Neither sets `iceTransportPolicy`, so
both use the WebRTC default (`"all"` — host, srflx, and relay candidates
all gathered).

One asymmetry worth noting, not a bug: Flutter treats a **TURN-less**
response (STUN only) as non-fatal — it proceeds with a warning
(`ice_server_config.dart:136-140`, *"No TURN server configured. Same-network
calls may work, but calls across strict NATs can fail."*). This means if
TURN silently drops out entirely (not the case found here — see below), the
Flutter app would still *attempt* the call and fail only during ICE
connectivity checks, not at setup — consistent with a call that "doesn't
connect" rather than one that errors immediately.

### 4.2 The defect: duplicate `RTC_TURN_URLS`/`TURN_STATIC_AUTH_SECRET` keys in `.env.production`

`backend/.env.production`:

```
28  RTC_STUN_URLS=stun:stun.l.google.com:19302
29  RTC_TURN_URLS=turn:turn.humancareconnect.co:3478,turn:turn.humancareconnect.co:3478?transport=tcp,turns:turn.humancareconnect.co:443
30  TURN_STATIC_AUTH_SECRET=d5f2fbbc123d8a1e9b58db22ad5207aadbd93de46dca9a68ba41aad625ee731b
31
32  TURN_SHARED_SECRET=d5f2fbbc123d8a1e9b58db22ad5207aadbd93de46dca9a68ba41aad625ee731b   ← unused by any code (grepped)
33  TURN_REALM=turn.humancareconnect.co                                                   ← unused by any code (grepped)
34  TURN_HOST=turn.humancareconnect.co                                                     ← unused by any code (grepped)
35  TURN_STATIC_AUTH_SECRET=d5f2fbbc123d8a1e9b58db22ad5207aadbd93de46dca9a68ba41aad625ee731b   ← duplicate, same value (harmless)
36  RTC_TURN_URLS=turn:turn.humancareconnect.co:3478?transport=udp,turn:turn.humancareconnect.co:3478?transport=tcp   ← duplicate, DIFFERENT value
37  RTC_TURN_URLS_2=turn:turn2.humancareconnect.co:3478?transport=udp,turn:turn2.humancareconnect.co:3478?transport=tcp
38  TURN_STATIC_AUTH_SECRET_2=d5f2fbbc123d8a1e9b58db22ad5207aadbd93de46dca9a68ba41aad625ee731b
```

`dotenv` parses a file top-to-bottom into a plain object, so within a single
file the **last** occurrence of a key wins. `TURN_STATIC_AUTH_SECRET` is
duplicated but with an identical value both times, so that part is harmless.
**`RTC_TURN_URLS` is duplicated with a *different* value** — line 36 wins,
and it silently drops the `turns:turn.humancareconnect.co:443` entry that
was present at line 29. The effective, live config from this file serves
clients only:

```
turn:turn.humancareconnect.co:3478?transport=udp
turn:turn.humancareconnect.co:3478?transport=tcp
```

`backend/dev .env` (loaded when `NODE_ENV` is unset/`development`) never
defines the `turns:443` variant at all — same end state, one definition.

`routes/rtc.js:31-34` treats `RTC_TURN_URLS`/`TURN_STATIC_AUTH_SECRET` as one
atomic "region" — there is no mechanism to recover the dropped `turns:443`
URL by any other config path; it is simply gone.

### 4.3 Why this specific loss matters for phone ↔ web calls

Port `3478` (both UDP and plain TCP) is a non-standard port that carrier
NATs, corporate proxies, and some public Wi-Fi networks are meaningfully
more likely to block or throttle than **port 443**, which every network has
to keep open for ordinary HTTPS traffic. `turns:host:443` (TURN-over-TLS on
443) exists specifically as the fallback for exactly this situation. A
mobile client on a cellular data connection is disproportionately likely to
need that fallback compared to a desktop browser on office/home Wi-Fi — the
exact doctor/patient split described. Losing the `turns:443` entry doesn't
break every call (calls where neither side needs TURN, or where 3478 isn't
blocked, still work), which is consistent with "the call doesn't connect"
being a real, reported, non-universal symptom rather than a total outage.

### 4.4 Live verification performed

From this environment, against the actual UAT hosts referenced in
`connect-mobile/.env`:

| Check | Result |
|---|---|
| `GET https://uat-api.humancareconnect.co/socket.io/?EIO=4&transport=polling` | `HTTP 200` — Engine.IO handshake responds, backend is reachable |
| `GET https://uat-api.humancareconnect.co/api/rtc/ice-servers` (no token) | `HTTP 401` — route exists, auth is enforced as expected |
| `GET https://uat.humancareconnect.co` (web frontend) | `HTTP 200` |
| TCP to `turn.humancareconnect.co:3478` | **open** |
| TCP to `turn.humancareconnect.co:443` | **open** — the TLS-TURN listener this bug hides *is* actually running |
| TCP to `turn2.humancareconnect.co:3478` | **open** |

This confirms the backend and TURN infrastructure are both live and were not
simply down, and specifically confirms the coturn server **is** listening on
443 — the capacity to serve `turns:443` exists, it's just not being handed
out to clients from `.env.production`/`.env` due to the key-duplication bug.
(UDP reachability on 3478, and reachability from an actual mobile carrier
network rather than this environment's network, could not be tested from
here — see §7.)

### 4.5 What could **not** be verified: `.env.uat`

`connect-mobile/.env` points at `uat-api.humancareconnect.co`. `server.js:
5-12` loads `backend/.env.uat` when `NODE_ENV=uat`. That file is listed in
`backend/.gitignore:22` and **does not exist in this repository checkout**
— it exists only on the live server. **I cannot confirm whether the same
duplicate-key defect (or a different TURN misconfiguration, or none) is
present in the file actually governing the UAT server the mobile app talks
to.** This is the single most important open item before treating §4.2 as
the confirmed root cause rather than the most likely one. It must be
checked directly on the server, or confirmed indirectly via §7.

---

## 5. Reconnection logic — verified consistent

Both clients implement matching reconnection behavior, layered at two
levels:

- **Socket.IO transport reconnection**: `reconnection: true`,
  `reconnectionAttempts: Infinity`, `reconnectionDelay: 1000`,
  `reconnectionDelayMax: 30000`, `randomizationFactor: 0.5` — identical on
  both (web `socket.js:27-32`; Flutter `socket_service.dart:58-63`).
- **WebRTC-level ICE-restart watchdogs**: connection-establishment timeout
  (25s), ICE-restart debounce (2.5s), max local recovery attempts (4) before
  handing off to the peer via `ice-restart-request`, and a UI-level
  "reconnect stalled" banner with a manual retry affordance (`forceReconnect()`
  in Flutter, matching a "Retry" button already fixed on web per
  `teleconsultation_fixes_applied.md` Issue 2). Same constants, same
  structure, both sides (§3 above).
- **One Flutter-specific fix already present and correctly implemented**:
  native (non-web) builds request the `websocket` transport only, never
  `polling` (`socket_service.dart:40-56`). The code comment explains why:
  the underlying `socket_io_client` native transport factory always opens a
  raw WebSocket regardless of which transport name is requested, but still
  labels the handshake's `transport` query parameter with whichever name was
  requested *first* — so requesting `polling` first on native mislabels a
  real WebSocket upgrade, and the Engine.IO handshake never completes. This
  is a genuine, already-fixed bug class; it is called out here only to
  confirm it does **not** currently affect the app (native already requests
  `websocket` only) — not as an active problem.

**Conclusion: reconnection logic is not the problem** for an initial call
that never connects in the first place (as opposed to one that connects and
later drops) — though the same 25s/4-attempt ICE-restart machinery would
also be the thing silently retrying-and-failing if §4's TURN gap is the
actual cause, since every restart attempt would fetch the same
under-configured ICE server list.

---

## 6. Other candidates checked and their status

| Candidate | Status |
|---|---|
| Backend room/auth logic branching by platform (web vs. mobile) | **Ruled out.** Full grep across `backend/**/*.js` for platform/user-agent/flutter/mobile found only FCM push-token storage and audit logging — nothing in room naming, seat limits, or event authorization. |
| Socket auth token resolution race conditions | **Ruled out as a code defect.** `resolveSocketIdentity`/`canSocketAccessAppointment` (`server.js:728-825`) is explicitly written to be race-free across independently-ordered events, with inline comments documenting the exact race it was written to avoid. |
| Late-joiner deadlock (patient joins before doctor, or vice versa, and the offer never fires) | **Ruled out.** Backend explicitly re-emits `peer-joined` to a joining socket if a peer is already present (`server.js:1071, 1162` — see §2 table), so join order cannot cause both sides to wait forever. |
| ICE-candidate / SDP payload shape incompatibility (Flutter's `flutter_webrtc` vs. browser `RTCPeerConnection`) | **Ruled out at the protocol level.** Both produce/consume the standard `{candidate, sdpMid, sdpMLineIndex}` / `{sdp, type}` shapes; the backend relays them opaquely without transformation, so this is a standard, well-trodden interop path. |
| Backend visibility into a failed offer/answer/candidate relay | **Confirmed gap, not itself a cause.** `video-offer`, `video-answer`, `ice-candidate`, and `ice-restart-request` handlers have **zero** `console.*` logging on either the success or the rejection path (`server.js:1272-1312`) — only `join-appointment-room` failures are logged (`[socket] appointment room access denied`, `server.js:1038-1044`). If a real failed call is reproduced, the backend logs alone will **not** show a dropped offer/answer/candidate; this needs either added logging or reliance on the `video-telemetry` events already emitted by both clients (logged server-side as `[video-telemetry]`, `server.js:1262-1269`) or the clients' own debug console output. |
| `VITE_SOCKET_URL` defined but never read by the Flutter app | **Verified as dead config, not currently a bug.** The Flutter socket client derives its origin from `API_BASE_URL`/`BACKEND_URL` instead (`socket_service.dart:32-35`); in the current `.env` files this happens to resolve to the same host as `VITE_SOCKET_URL`, so there's no live discrepancy today. Flagged only because it would silently break if Socket.IO and the REST API are ever split onto different hosts. |

---

## 7. Diagnostic steps to definitively confirm before implementing a fix

Because §4.5 leaves the live UAT TURN config unverified, the following would
turn "most likely cause" into "confirmed cause" without guessing:

1. **On the UAT server**, read `backend/.env.uat` and check whether
   `RTC_TURN_URLS` is defined more than once, and whether a `turns:...:443`
   entry survives to the last definition. This is the single fastest way to
   confirm or rule out §4.
2. **Reproduce one failed call** with the Flutter app's debug console open
   (`debugPrint` calls already exist throughout `video_call_controller.dart`
   and `socket_service.dart`) and capture: whether `connect`/`connect_error`
   fires, whether `room-access-denied` fires, and — most diagnostic of all —
   the `ice_candidate_gathered` telemetry events' `type` field
   (`video_call_controller.dart:880`, categorizes `host`/`srflx`/`relay`/
   `prflx`). **If no `relay` candidate is ever gathered on the Flutter side,
   TURN allocation is failing** — that's the direct signature of §4, and
   distinguishes it cleanly from a signaling/auth failure (which would show
   no offer/answer exchange at all, with candidate gathering never even
   being reached).
3. Cross-reference the same call attempt against backend logs for
   `[socket] connection_error` (`server.js:604-610`) and `[video-telemetry]`
   (`server.js:1262-1269`) entries, keyed by the appointment ID and
   approximate timestamp.
4. If step 2 shows offers/answers/candidates being exchanged fine but the
   connection still never reaches `connected`, that further isolates the
   problem to ICE connectivity (almost certainly TURN reachability) rather
   than signaling.

---

## 8. Required fix (pending confirmation via §7)

**Not applied — report only, per current instructions.**

1. **`backend/.env.production`** (and, once its contents are confirmed,
   `.env.uat` on the live server if it has the same pattern): remove the
   duplicate `RTC_TURN_URLS`/`TURN_STATIC_AUTH_SECRET` block (lines 32-38's
   redundant re-definitions) and keep a single `RTC_TURN_URLS` definition
   that includes all three entries — the two `:3478` (UDP/TCP) entries and
   the `turns:...:443` (TLS) entry:
   ```
   RTC_TURN_URLS=turn:turn.humancareconnect.co:3478?transport=udp,turn:turn.humancareconnect.co:3478?transport=tcp,turns:turn.humancareconnect.co:443
   ```
   Also remove the unused `TURN_SHARED_SECRET`/`TURN_REALM`/`TURN_HOST` keys
   (dead — no code reads them) to prevent this exact class of confusion from
   recurring.
2. This is a **backend config change only** — no Flutter (or web) code
   change is implied by this fix, since both clients already correctly
   consume whatever `iceServers` list `/api/rtc/ice-servers` returns. Once
   the config is corrected, no app rebuild/redeploy of `connect-mobile` is
   needed for this specific fix to take effect.
3. If §7's reproduction instead points at something else (e.g. an expired/
   invalid token causing `room-access-denied`, or a genuine UDP-3478 block
   even after the 443 fallback is restored), the fix target changes
   accordingly — this report intentionally stops short of prescribing a
   Flutter code change, since nothing in the Flutter code itself was found
   to be defective relative to the web client it was ported from (§2, §3,
   §5).

---

## Files read in full for this investigation

- `backend/server.js`, `backend/routes/rtc.js`, `backend/utils/turnCredentials.js`, `backend/utils/socketRateLimit.js`, `backend/.env`, `backend/.env.production`, `backend/.gitignore`
- `frontend/src/pages/VideoCall.jsx`, `frontend/src/pages/DirectVideoCall.jsx`, `frontend/src/socket.js`, `frontend/src/utils/rtcIceConfig.js`
- `connect-mobile/lib/controllers/video_call_controller.dart`, `connect-mobile/lib/services/socket_service.dart`, `connect-mobile/lib/services/ice_server_config.dart`, `connect-mobile/lib/services/call_foreground_service.dart`, `connect-mobile/lib/screens/video_call_screen.dart`, `connect-mobile/lib/config/api_config.dart`, `connect-mobile/.env`
- `connect/teleconsultation_code_review.md`, `connect/teleconsultation_fixes_applied.md` (prior review context)
