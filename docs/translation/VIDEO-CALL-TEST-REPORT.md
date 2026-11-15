# Video call test report (read-only), 13 Nov 2026

Branch `currency` at `2ddc9b10`. Nothing was changed, fixed or committed for this report (only this file). The test scripts were throw-away scratch files outside the repo.

## How it was tested
- The REAL call page (`frontend/src/pages/VideoCall.jsx`) in two real Chromium browsers (a doctor and a patient, each with their own login), with Chromium's fake camera and microphone.
- The REAL backend (`node server.js`, in-memory MongoDB, Socket.IO), the app served by the Vite dev server with `/api` and `/socket.io` proxied. Both modes: transcription OFF (`TRANSCRIPTION_ENABLED=false`, `VITE_TRANSCRIPTION_ENABLED=false`) and ON (both `true`, a dummy Azure key).
- Everything ran on one computer (same network for both browsers, no real TURN). A first run had harness mistakes (the "call ending" case completed the appointment so later cases could not join; wrong chat selector). Those were fixed in a second run, and only the second run is reported below. One ON-only video failure in the second run was re-run 4 times and did not repeat (timing in my check).
- Same call test is also in the repo as `npm run test:e2e:video-call` (connect-only, flag OFF and ON).

## Results (PASS = behaved correctly)

| # | Test case | Flag OFF | Flag ON | Notes |
|---|---|---|---|---|
| 1 | Join: patient first, doctor 1.5 s later | PASS (7.3 s) | PASS (7.2 s) | video both ways |
| 2 | Join: doctor first, patient 1.5 s later | PASS | PASS (3 of 4 repeats; 1 early check missed the doctor's video by a moment, then fine) | see problem 3: the doctor's tab "load" never finishes while waiting alone |
| 3 | Join: both at once | PASS (3.0 s) | PASS (3.1 s) | fastest case |
| 4 | Late join (second person 20 s later) | PASS | PASS | |
| 5 | Category consultation call (same page, other id) | PASS (2.6 s) | PASS (3.8 s) | |
| 6 | Refresh by patient mid-call | PASS (reconnected in 2.6 s) | PASS (1.9 s) | |
| 7 | Refresh by doctor mid-call | PASS (9.0 s) | PASS (3.2 s) | OFF took longest here |
| 8 | Leave (patient) then rejoin | PASS (rejoined in 1.6 s) | PASS (1.8 s) | patient goes to `/user/dashboard` after leaving |
| 9 | Mute / unmute microphone | PASS | PASS | local audio track really disabled while muted |
| 10 | Camera off / on | PASS | PASS | call stays connected |
| 11 | Hide me / show me (self view) | PASS | PASS | two "Show self view" buttons exist in the page (desktop + mobile copy) |
| 12 | Full screen button | PASS (button works, headless Chromium does not enter full screen) | same | needs a real browser to confirm |
| 13 | Screen share button | PASS (call stays connected) | PASS | fake picker only; real sharing needs a manual test |
| 14 | Switch microphone / camera | NOT TESTED | NOT TESTED | fake device has one mic and one camera (manual steps below) |
| 15 | Chat both ways | PASS | PASS | |
| 16 | Notes panel (doctor) and call timer | PASS (timer ran) | PASS | |
| 17 | Network: offline 6 s then back | PASS (video back in 3.1 s) | PASS (3.1 s) | |
| 18 | Network: offline 25 s then back | PASS (back in 2.0 s) | PASS (2.0 s) | |
| 19 | Network: slow (400 ms latency, 150 kB/s) | INCONCLUSIVE | INCONCLUSIVE | the page itself did not finish loading in 30 s: the Vite dev server sends hundreds of unbundled files. Needs a test against a production build (manual steps below) |
| 20 | Mobile layout 390x844 | PASS | PASS | bar: Mute, Camera, Chat, Leave, More. More drawer OFF: Full screen, Minimize self view, Notes. ON adds: "Language: read and hear the other person in your language" and "Live transcript of this call". No horizontal overflow. Screenshots: `mobile-OFF.png`, `mobile-ON.png` in the scratch folder |
| 21 | Call ending: doctor completes, patient told | PASS | PASS | patient sees "Consultation Completed" |
| 22 | OFF: no transcript UI, no transcript/speech requests | PASS | n/a | no "Transcribing" text, no `/transcript` or `/speech-token` request |
| 23 | ON: notice, badge, language panel | n/a | PASS | "This call is being transcribed", "Transcribing" badge, new panel help text present, picking German keeps the call connected, the other person's voice stays unmuted when the other person picked nothing |
| 24 | ON: patient cannot read the transcript; doctor and admin can | n/a | PASS | doctor GET transcript 200, patient 403, admin login 200 |
| 25 | ON: captions both ways, one-voice mute, each fallback, transcript saved with real speech | n/a | NOT TESTABLE LOCALLY | needs real Azure Speech. Covered by tests with a fake Azure: `transcriptionOneVoice` (25), `transcriptionSafetyNet` (21), `test:e2e:transcription` (browser, fake Azure), backend transcript tests |
| 26 | Console / network / server log errors | see "Errors seen" | see below | |

## Errors seen during the calls (both modes unless noted)
- `Uncaught (in promise) Error: License expired` page error on both sides, both modes. A third-party library on the page; not the call. I could not find which one (not in our `src` search).
- `401` on `/api/doctor/me` and `/api/auth/me` + `401 /api/auth/refresh`: normal, the page checks the other role's login first.
- `[video-call] Video playback was blocked: The play() request was interrupted by a new load request`: warning, both modes, video still plays (existing behaviour).
- `[video-call] ICE connection disconnected`: only during my deliberate offline tests.
- ON only: `The ScriptProcessorNode is deprecated` warning (see problem 5).
- ON only: `502` then `429` on `/api/speech-token` (see problem 2). With the dummy Azure key this is expected.
- ON only, after the offline tests: `signaling-error` for `lang-changed` and `tr-status` with `not_in_room` (see problem 4).
- Failed requests: only Google Analytics and `socket.io` polling while I had the browser set offline, and `speech-token` aborted at page close.
- Server log: only a missing GeoIP database warning (local machine) and a Mongoose deprecation warning. No errors, no transcript text, no tokens.

## Problems found (steps, cause)

**1. [Not a bug in the call, but must be checked on staging] The call needs HTTPS and a working TURN.** Everything here connects on localhost, which the browser treats as secure and which needs no relay. On `http://54.82.47.239` the camera and microphone are blocked by the browser. See the checklist in `PROGRESS-REPORT.md` section "13 Nov evening" > URGENT 1.

**2. Speech-token requests repeat until the per-appointment limit (ON only).** Steps: flag ON with a wrong/missing Azure key, open a call. Result: `GET /api/speech-token` answers `502`, the app retries, and later gets `429` (the per-appointment cap). The call is not affected (the app shows "Subtitles unavailable" and the call carries on), but it is wasted requests and, with a wrong key on staging, the cap is used up. Likely place: `frontend/src/features/translation/tokenManager.js` (retry/backoff) and `backend/routes/speechToken.js` (cap). Suggested: treat a `502` from the server like a permanent failure after a few tries.

**3. The doctor's tab never finishes "loading" while waiting alone (both modes).** Steps: doctor opens the call first and waits. The browser `load` event does not fire within 15 s (it fires immediately once the patient is there, or when the patient opens first). The call works; this likely shows as a permanent loading spinner in the tab and makes tools that wait for "load" time out (which is how my first run failed). Likely cause: something on the waiting screen keeps a resource open (a media element or image waiting for the other person). I did not find which one.

**4. After a socket reconnect, `lang-changed` / `tr-status` are sent before the room is joined again (ON only).** Steps: both in a translated call, one side loses the network for a few seconds. Console: `[socket] signaling-error {event: lang-changed, code: not_in_room}` and the same for `tr-status`. The server refuses them (the sender has not rejoined the room yet), so the other person may keep an old idea of my language or health until the next `peer-joined`. Safe direction (the real voice is not muted wrongly) but it can hide a stall. Place: `frontend/src/features/translation/engine.js` line 410 (`listen("connect", ...)`) and `VideoCall.jsx` line 4462 (`handleSocketReconnect`) call the resend before `join-appointment-room` completes. Suggested: resend after the room join is confirmed.

**5. `ScriptProcessorNode` is deprecated (ON only).** `frontend/src/features/translation/micPipeline.js` line 134 uses `createScriptProcessor`. Works today in current Chrome, Safari and Firefox; a future browser version could remove it, and then live transcription would stop (the call would not).

**6. Slow network could not be judged.** See case 19.

## What could NOT be tested here, and exact manual steps
1. **Real iPhone / Safari (one-voice muting, audio unlock, background):** iPhone with the patient link on HTTPS staging, the doctor on a laptop. Patient: tap LANGUAGE, pick German (inside this tap sound is unlocked). Doctor: LANGUAGE, English. Doctor says a sentence: the patient must hear ONLY the German voice after 1-3 s and see the German subtitle. Then lock the iPhone screen for 10 s while the doctor speaks: the doctor's tab must show "Translation unavailable" within 1-2 s on the doctor's side if the iPhone is the speaker, and the iPhone must hear the doctor's real voice if the doctor's recognizer stalls (cover the doctor's microphone with a cloth: patient sees "Didn't catch that - please ask them to repeat"). Switch to another app on the iPhone and back: the call must resume.
2. **Real Azure Speech:** the staging key and region set, `TRANSCRIPTION_ENABLED=true`: speak 3 sentences each way, then open the doctor's appointment > transcript: every sentence must be listed, unclear ones marked "Unclear", no-match stretches as "Speech not recognised". Log in as the patient and open the same transcript URL: must be refused (403).
3. **Real network / slow network:** open the production build (not the dev server) on a phone on mobile data; in Chrome DevTools use "Slow 4G" on the laptop. Time from opening the page to seeing the other person.
4. **Real TURN:** `chrome://webrtc-internals` during a call from two different networks (phone on mobile data, laptop on office Wi-Fi). Under the connection's candidate pairs one pair must be "succeeded"; `relay` appears if TURN was needed. If a call from two networks never shows video, TURN or its firewall ports are the problem.
5. **Switching microphone / camera:** during a call, plug in a headset (or use the browser's own microphone selector). The other person must still hear you; the transcript (flag ON) must keep going.
6. **Real full screen and screen share:** click Full screen (page fills the screen, Esc exits); click Share screen and pick a window (the other person sees it; stop sharing returns the camera).

## Top 5 problems to fix first (simple English)
1. **Check the server for HTTPS, nginx WebSocket and TURN first.** The call code is fine; the staging call most likely fails because of the server setup (steps in the other report).
2. **Stop asking for speech tokens again and again when Azure says no.** It wastes the limit for that appointment.
3. **Fix the "send my language again" after a reconnect.** Right now the first try is refused because the person is not back in the room yet.
4. **Find out why the doctor's tab keeps "loading" while waiting alone.** The call works, but it looks unfinished and breaks test tools.
5. **Plan to replace the old microphone processing (`ScriptProcessorNode`).** It works today; one day a browser may remove it and live transcription would stop.
