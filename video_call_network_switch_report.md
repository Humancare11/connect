# Video Call — Remote Video Lost After Network Switch (Wi-Fi ↔ Mobile Data)

**Scope:** Why remote video sometimes fails to reappear after a participant
switches networks mid-call (Wi-Fi → mobile data or vice versa) and the
connection recovers, requiring both participants to refresh the page to
restore video.

**Method:** Full static read of the appointment video call flow
(`frontend/src/pages/VideoCall.jsx`), the ad-hoc/guest call flow
(`frontend/src/pages/DirectVideoCall.jsx`), the shared socket client
(`frontend/src/socket.js`), and the signaling server
(`backend/server.js`), plus a comparative check of the Flutter mobile
client (`connect-mobile/lib/controllers/video_call_controller.dart`) to see
whether the same defect class is shared cross-platform. No code was
modified. All claims are cited to file and line.

This is a different investigation from the earlier
`video_call_connectivity_report.md` (which covered calls that never connect
at all, root-caused to a TURN config defect). This report covers a call
that **did** connect and then loses remote video after a network change
during an active call — a distinct failure mode with a distinct cause.

---

## 1. Executive summary

- **Root cause found and verified by static analysis**: when the WebRTC
  connection recovers from a network switch — whether recovered passively
  by the browser's own ICE agent, or recovered actively via this app's own
  ICE-restart offer/answer renegotiation — **nothing re-attaches or
  refreshes the `<video>` element's `srcObject`** unless `pc.ontrack` fires
  again with a genuinely new `MediaStreamTrack`. `ontrack` does **not**
  fire again on an ICE restart or on passive ICE recovery — the same
  transceiver and the same track survive across both. The remote stream
  object bound to the video element is therefore left completely untouched
  across the whole disconnect → recover cycle.
- This matches a well-known, cross-browser WebRTC/`<video>` element quirk:
  a `<video>` element's decode/render pipeline can fail to resume painting
  a track that stalled for a stretch of time, even though the underlying
  `MediaStreamTrack` and `MediaStream` object references never changed and
  media is flowing again at the transport level. The standard mitigation is
  to force a fresh `srcObject` assignment (or a fresh `MediaStream`
  wrapper) once connectivity is restored — **the codebase already
  implements exactly this mitigation for one specific trigger (a replaced
  track — see `VideoCall.jsx:1888-1902`) but never applies it for a plain
  ICE-restart recovery**, which is the actual trigger that occurs on a
  network switch.
- **This explains the reported symptom precisely**: audio keeps working
  (continuous playback has no comparable per-frame pipeline to get stuck),
  video freezes/blanks, it's intermittent (depends on how long the gap was
  and browser-specific decoder behavior), it affects **both** participants
  in many cases (a single shared peer connection breaking affects both
  inbound video elements independently), and only a full page reload fixes
  it (reload is the only code path that rebuilds the peer connection from
  scratch and re-fires `ontrack`).
- **No in-app recovery or even user-facing indication exists for this
  specific failure mode.** The one manual escape hatch already in the UI
  (`reconnectStalled` → "Retry" button) is gated on the peer connection
  *not* being connected — but in this failure mode `connectionState` **is**
  `"connected"`, so that banner never appears. The user is left with a
  frozen/blank video and zero explanation, until they think to reload.
- A secondary, compounding gap: the app already listens for the browser's
  `online`/`offline` events, but only to drive a passive "You're offline"
  banner — it never uses `online` to proactively kick off recovery. All
  recovery is instead gated purely on `RTCPeerConnection`
  connection/ICE-state transitions, which are known to fire late or
  inconsistently around OS-level network interface changes (especially on
  mobile browsers), adding avoidable delay/unreliability on top of the
  primary defect above.
- The ad-hoc/guest call flow (`DirectVideoCall.jsx`) has the same missing
  re-attach gap, plus a **weaker** recovery path than the appointment flow:
  it only requests an ICE restart once `connectionState` reaches
  `"failed"`, never on `"disconnected"` (§5).
- The Flutter mobile client's connection-state handlers are a close port of
  the web client's and show the same pattern — no renderer re-attach on
  recovery (§6) — so this is a structural gap in the shared design, not a
  browser-specific accident.

---

## 2. How remote video actually gets onto the screen (baseline)

`VideoCall.jsx` keeps one mutable `remoteStream` (a `MediaStream`) per call,
created once per `RTCPeerConnection` setup (`VideoCall.jsx:1579-1580`) and
mirrored into `remoteStreamRef.current`. The **only** function that ever
assigns it to a `<video>` element is `assignStreams()`
(`VideoCall.jsx:1439-1457`), and the only code paths that ever call it are:

| Call site | When it runs |
|---|---|
| `VideoCall.jsx:1505` (`attachLocalMediaStream`) | Local media (camera/mic) becomes ready — irrelevant to remote video |
| `VideoCall.jsx:1915` (`pc.ontrack`) | A track is added/replaced on the peer connection |
| `VideoCall.jsx:2615` (`restoreCameraAfterScreenShare`) | Local screen-share ends — irrelevant to remote video |
| `VideoCall.jsx:2754`, `2772` (swap main/PiP view) | User clicks the swap-view control — a manual UI action, not a network event |

**`pc.ontrack` (`VideoCall.jsx:1856-1920`) is therefore the single path
responsible for ever making a *remote* stream visible.** It only fires when
the browser adds a new track to a transceiver (first-time negotiation) or
when the remote side literally sends a track with a different `track.id`
(e.g. the peer's page reloaded and its whole `RTCPeerConnection`, and thus
its tracks, are brand new — see the `trackWasReplaced` branch,
`VideoCall.jsx:1876-1902`, which explicitly rebuilds `remoteStream` as a
new `MediaStream` object specifically because "some browsers don't
reliably rebind a `<video>` element's decode/render pipeline to a track
that was swapped into a `MediaStream` it's already displaying").

## 3. What actually happens on a network switch — and where the gap is

A Wi-Fi ↔ mobile-data switch changes the device's local IP/interface. This
invalidates the existing ICE candidate pair (and, if a relay was in use,
the TURN allocation bound to the old 5-tuple), and typically also drops the
Socket.IO WebSocket. Two independent recovery mechanisms exist in this
codebase, and **neither of them ever calls `assignStreams()` /
`playAssignedVideos()` again**:

1. **Passive ICE self-healing** — modern browsers automatically re-gather
   local candidates when the OS reports an interface change and trickle
   them to the peer via the existing `pc.onicecandidate` → `ice-candidate`
   socket relay (`VideoCall.jsx:1922-1930`, `server.js:1343-1351`), without
   any SDP renegotiation. If a new candidate pair succeeds, `connectionState`
   /`iceConnectionState` goes `disconnected` → `connected` **with the same
   transceiver and the same track** — `ontrack` never fires again.
2. **Active ICE-restart renegotiation** — if passive recovery doesn't
   happen fast enough, `onconnectionstatechange`/`oniceconnectionstatechange`
   (`VideoCall.jsx:1932-2015`) detect `"disconnected"`/`"failed"` and call
   `scheduleIceRestart()` (`VideoCall.jsx:1756-1797`), which eventually
   calls `createAndSendOffer({ iceRestart: true })`
   (`VideoCall.jsx:1611-1699`) or asks the peer to do so via
   `ice-restart-request` (`VideoCall.jsx:1743-1754`,
   `2169-2193`). This renegotiates ICE parameters (new ufrag/pwd, new
   candidates) on the **existing** `m=` line/transceiver — by design, an
   ICE restart does not create a new track or re-fire `ontrack` either.

In both cases, the moment `connectionState` flips back to `"connected"`
(handled at `VideoCall.jsx:1932-1949` and `1972-1989`), the code:

```js
if (s === "connected") {
  clearTimeout(iceRestartTimerRef.current);
  clearTimeout(connectionFailTimerRef.current);
  ...
  setConnectionState("connected");
  setIsRemoteConnected(true);
  ...
  startStatsCollection(pc);
}
```

only clears timers, flips React state, and starts stats polling. It never
calls `assignStreams()` (or forces a fresh `MediaStream`/`srcObject`
assignment the way `pc.ontrack`'s `trackWasReplaced` branch already knows
how to do). Likewise, neither `handleAnswer` (`VideoCall.jsx:2089-2141`)
nor `handleOffer` (`VideoCall.jsx:2018-2087`) — the two functions that
actually complete an ICE-restart renegotiation — ever call it either.

**Net effect:** the `<video>` element keeps referencing the same
`MediaStream`/`MediaStreamTrack` object it had before the network switch.
On networks/browsers where the render pipeline resumes painting on its own
once RTP packets resume, video recovers fine — which is why this is
**intermittent** rather than a 100%-reproducible break. On the browsers/
situations where it doesn't self-resume (a well-documented WebRTC/`<video>`
quirk after a stall — the same one the code's own `trackWasReplaced`
comment describes), the video stays frozen or blank indefinitely, even
though `connectionState` correctly reports `"connected"` and audio and
`webrtc_stats` telemetry (`VideoCall.jsx:1337-1352`, logged every
`STATS_INTERVAL_MS`) would show bytes/packets actively flowing.

## 4. Why the user sees "nothing" and has to refresh both sides

Two UI escape hatches already exist, and **neither covers this case**:

- **`reconnectStalled` "Retry" banner** (`VideoCall.jsx:1728-1741`,
  rendered at `3461-3475`): only arms when the peer connection is **not**
  `"connected"`/`"completed"` after a delay. In this failure mode the
  connection genuinely *is* `"connected"` — so this banner never appears.
- **`playbackBlocked` "Tap to resume audio/video" button**
  (`VideoCall.jsx:3477-3485`): only becomes true inside
  `playAssignedVideos()` (`VideoCall.jsx:1428-1437`) when the browser
  blocks autoplay. Since nothing calls `playAssignedVideos()` again after
  reconnection, this flag is never (re)computed for the freeze case either
  — the button that would otherwise give the user a one-tap manual fix
  never shows up.

Because a single `RTCPeerConnection` carries media in both directions, a
network change on **either** participant's side can stall **both**
participants' inbound video simultaneously (each side's own `<video>`
element, showing the *other* party, is independently susceptible to the
same un-rebound pipeline). This matches "in many cases, both participants
have to refresh the page" exactly: a full reload is the only code path that
tears down and rebuilds `RTCPeerConnection` from scratch
(`VideoCall.jsx:1552-1564`) and thus the only path that guarantees a fresh
`pc.ontrack` firing and a fresh `assignStreams()` call.

## 5. Secondary/contributing gaps

- **`online`/`offline` browser events are captured but not actionable**
  (`VideoCall.jsx:965-977`, state at `869-871`, banner at `3218-3224`).
  `handleOnline`/`handleOffline` only toggle `isOffline` for the banner —
  they never trigger `scheduleIceRestart()`, a proactive
  `createAndSendOffer({iceRestart:true})`, or `forceReconnect()`. Recovery
  is entirely dependent on `RTCPeerConnection`'s own state transitions,
  which are known to fire late or inconsistently around real OS-level
  network changes (particularly on mobile Safari/Chrome when the tab is
  backgrounded during the switch, which is common — the user switches apps
  to toggle Wi-Fi/cellular). Wiring the `online` event to at least attempt
  a nudge (a cheap, idempotent call is already available in
  `scheduleIceRestart`'s guarded logic) would shorten recovery time and
  make it less dependent on browser-specific ICE-state timing, independent
  of fixing §3.
- **No `track.onmute`/`onunmute` listeners** on remote tracks. Browsers
  expose exactly this kind of "receiving nothing right now" signal per
  track, independent of overall `connectionState`; it isn't used here at
  all, so the app has no lower-level signal to detect "connected but this
  specific track stalled" (which is precisely what's happening in §3)
  short of the coarse `connectionState`/`iceConnectionState`.
- **`DirectVideoCall.jsx` (ad-hoc/guest calls) has the same core gap, plus
  a weaker recovery path**: its `pc.ontrack` (`DirectVideoCall.jsx:463-478`)
  is likewise the only place `remoteVideoRef.current.srcObject` is ever
  set, and its `onconnectionstatechange` (`492-504`) does nothing to
  reattach it either. Additionally, unlike the appointment flow, it takes
  **no self-initiated recovery action at all on `"disconnected"`** — only
  `setCallStatus("reconnecting")` (a passive UI label). It only emits
  `direct-ice-restart-request` once the state reaches `"failed"`
  (`DirectVideoCall.jsx:500-503`), which is a strictly later, harder-to-reach
  state than `"disconnected"` — meaning ad-hoc calls both recover more
  slowly/less reliably from a network switch than appointment calls *and*
  share the same missing-video-rebind defect once they do recover.

## 6. Mobile (Flutter) client — same defect class

`connect-mobile/lib/controllers/video_call_controller.dart`'s
`_handleConnectionStateChange`/`_handleIceConnectionStateChange`
(lines 951-1020) are a close port of the web client's
`onconnectionstatechange`/`oniceconnectionstatechange` and show the exact
same shape: on the `"connected"` transition they cancel timers, flip state,
and start stats collection — nothing re-attaches the remote
`RTCVideoRenderer`'s stream. `flutter_webrtc`'s renderer has documented
issues analogous to the `<video>` element's (frozen frame after a stream
handover) for the same reason. This was not investigated to the same depth
as the web client (out of scope for this pass — flagged for a follow-up),
but the pattern strongly suggests the mobile app is exposed to the same
failure mode, consistent with the earlier report's finding that this file
is a deliberate 1:1 port of `VideoCall.jsx`.

## 7. What was checked and ruled out

| Candidate | Status |
|---|---|
| Signaling contract / offer-answer correlation (`offerId`, stale-answer rejection) | **Not the cause.** Verified correct — this machinery (`VideoCall.jsx:786-798, 2099-2119`) is specifically designed to reject stale/replayed answers from `connectionStateRecovery`, and does so correctly. |
| ICE candidate queuing before `remoteDescription` is set | **Not the cause.** `flushPendingIceCandidates` (`VideoCall.jsx:1599-1609`) correctly queues and flushes; not implicated in a post-*connected* freeze. |
| Backend room/presence bookkeeping across a reconnect (`socketRooms` repair, grace period, `connectionStateRecovery` window) | **Not the cause, and in fact carefully designed** — `server.js:1097-1122` explicitly repairs `socketRooms` for exactly the "Wi-Fi ↔ mobile data switch" scenario (see the comment there), and `SOCKET_LEAVE_GRACE_MS`/`connectionStateRecovery.maxDisconnectionDuration` are deliberately kept in sync (`server.js:569-613`) to avoid a false "participant left" during a brief reconnect. |
| Perfect-negotiation (polite/impolite) collision handling surviving a mid-call renegotiation | **Not the cause.** Reviewed `handleOffer`/`handleAnswer`/`createAndSendOffer` collision paths (`VideoCall.jsx:1611-2141`) — correct and symmetric between doctor/patient roles. |
| Socket.IO reconnection config (backoff, infinite retries) | **Not the cause.** `socket.js:23-39` is reasonable and consistent with the Flutter client. |
| `iceRecoveryAttemptsRef`/cooldown/max-attempts exhaustion logic | **Not the cause of the reported symptom** — this governs *whether ICE reconnects at all*, not what happens to the `<video>` element once it does. Reviewed (`VideoCall.jsx:1743-1797`) and internally consistent. |

## 8. Diagnostic steps to confirm live (before implementing a fix)

1. Reproduce one network-switch drop with devtools open on both peers.
   Watch for `[video-call] webrtc_stats` telemetry
   (`VideoCall.jsx:1337-1352`, logged every `STATS_INTERVAL_MS`) showing
   `bytesReceived`/`packetsSent` **increasing** on the side with frozen
   video, at the same time `connectionState`/`iceConnectionState` reads
   `"connected"`/`"completed"` — this is the direct signature of §3 (media
   flowing, renderer not repainting) and distinguishes it cleanly from a
   genuine renegotiation failure (which would show no bytes moving and/or
   `connectionState` stuck at `"disconnected"`/`"failed"`, in which case
   the `reconnectStalled` banner *would* have appeared).
2. In the same repro, confirm `pc.ontrack` does **not** fire again after
   the reconnect (add a temporary `console.trace()` or check DevTools
   Sources breakpoint) — confirming the render path truly never
   re-executes.
3. Confirm the fix hypothesis directly in a live frozen session via the
   DevTools console: `document.querySelector('video').srcObject =
   document.querySelector('video').srcObject` (or reassigning to a fresh
   `new MediaStream(remoteStreamRef.current.getTracks())`) should
   immediately un-freeze the picture without any network activity — this
   would conclusively confirm §3 without needing a code change.

## 9. Suggested fix direction (not applied — report only, per instructions)

Not prescribing exact code, per the request not to modify anything, but
the shape of a fix based on the above:

- In `onconnectionstatechange`/`oniceconnectionstatechange`'s `"connected"`/
  `"completed"` branches (`VideoCall.jsx:1932-1949`, `1972-1989`), and/or at
  the end of `handleAnswer`/`handleOffer`'s successful renegotiation paths,
  re-run the same "force a fresh `MediaStream` wrapper and reassign
  `srcObject`" logic that `pc.ontrack`'s `trackWasReplaced` branch
  (`VideoCall.jsx:1888-1902`) already implements — this is the narrowest
  change that directly targets the confirmed gap, and reuses a pattern the
  codebase already trusts for the sibling case.
- Wire the existing `online` window event (`VideoCall.jsx:969-972`) to also
  invoke the existing recovery primitives (e.g. a guarded call into the
  same logic `scheduleIceRestart`/`forceReconnect` use) rather than only
  toggling a banner, to reduce dependence on browser-specific ICE-state
  timing.
- Apply the equivalent of both fixes to `DirectVideoCall.jsx`, which also
  needs its `"disconnected"` branch to actually attempt recovery (not just
  relabel the UI), not only the `"failed"` branch.
- Once confirmed applicable (§8), consider the Flutter renderer for the
  same treatment, as a follow-up.

---

## Files read in full or in detailed part for this investigation

- `frontend/src/pages/VideoCall.jsx` (all ~3995 lines)
- `frontend/src/pages/DirectVideoCall.jsx` (connection-state/track sections)
- `frontend/src/socket.js` (full file)
- `backend/server.js` (socket auth, room join/leave, disconnect grace
  period, `connectionStateRecovery` config, signaling relay handlers)
- `connect-mobile/lib/controllers/video_call_controller.dart` (connection-
  state handler sections, for cross-platform comparison)
- `connect/video_call_connectivity_report.md` (prior investigation, for
  context and to confirm this is a distinct issue)
