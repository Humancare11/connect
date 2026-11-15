# Live transcript / translation: progress report

Branch: `currency` (local only, nothing pushed). Report is untracked on purpose (docs/translation/ is never committed).
Rules followed for every step: only `currency`, flag OFF by default, no push, no deploy, no real .env touched, no transcript text / Azure key / tokens in any log.

The 2 known unrelated failing tests (ignore them): `liveChatWidgetStatic` ("the old H logo launcher and the greeting bubble are gone") and search-taxonomy `applyPreflight` ("plan integrity: ... Source 'appRoutes' changed").

---

## Step 1: speech token endpoint: DONE, committed `35f12fd0`
- `GET /api/speech-token?appointmentId=` (flag `TRANSCRIPTION_ENABLED`, off = 404). Patient or doctor of a confirmed, unfinished booking only. Azure key stays on the server; token cached 4 min, per-person cap, rate limit.
- 7 files, 25 new tests.

## Step 2: "This call is being transcribed" notice record: DONE, committed `5354919b`
- `POST /api/appointments/:id/transcript-notice`. Stores user id, server time, version, device and IP per person on the booking (hidden field). Never refused because of the version (unknown versions are saved cleaned and flagged `versionUnrecognized`). First write wins.
- 7 files, 38 tests.

## Step 3: saved transcript (write / read / delete) + audit: DONE, committed `a7eb25db`
- `POST/GET/DELETE /api/appointments/:id/transcript`. Lines always accepted (also after the call ended). Marks: `noticePending`, `lateUpload` (more than `TRANSCRIPT_LATE_UPLOAD_MINUTES`, default 30, after the booking ended). Words encrypted. Doctor of the booking + admin read; admin/superadmin delete with a reason; every read/delete audited in `TranscriptAccessLog` (fail closed). Read and delete keep working with the flag OFF; the flag only controls the live parts.
- Notice record also keeps `clientShownAt` (the browser's own claim, untrusted, informational only).
- 12 files, +61 new tests, full backend suite 3205 tests, only the 2 known failures; 51 socket integration tests pass (50 + 1 skipped).
- Decision to check: "ended time" of a booking = `cancelledAt` for a cancellation, otherwise the booking's `updatedAt` (bookings have no `completedAt`). `updatedAt` can be later than the real end, so a late upload can be UNDER-flagged, never over-flagged. Adding a real `completedAt` stamp in `utils/appointmentLifecycle.js` would make it exact.

## Step 4: settings (flag + notice/consent mode): DONE, committed `9d86d713`
- Backend: `TRANSCRIPT_MODE` (`notice` default, `consent` reserved). Today it only LABELS the data (stored on every notice, with the person's consent choice only in consent mode, and as `captureMode` on every saved row) and blocks nothing. `GET /api/transcription/config` (signed-in users) answers `{ enabled, mode, noticeVersion }`, also when the feature is off.
- Frontend: `src/features/translation/featureFlag.js`. Build flag `VITE_TRANSCRIPTION_ENABLED` (unset = off) AND the server switch must both be on. Build flag off = no network request at all.
- Files: 13 (+518/-6). New tests: 16 backend + 10 frontend. Full backend suite 3221 tests, only the 2 known failures. Frontend lint clean. 17 deliberate breakages of the code were all caught by the tests.
- Check / decide: nothing needed.
- Decisions I made for you:
  - A `TRANSCRIPT_MODE` value that is neither `notice` nor `consent` (for example a typo `concent`) is treated as `notice`, with one warning in the log. Reason: the system really only does notice today, and the stored label must never claim consent that is not there. If you want the stricter reading (typo = consent) it is a one-line change in `getTranscriptMode`.
  - No frontend build was run for this step (the new module is not imported by anything yet); the build is run in step 8 when VideoCall.jsx is touched.

## Step 5: socket events (`lang-changed`, `caption`): DONE, committed `ae065dee`
- Two Socket.IO events between the two people of a call, ignored completely unless `TRANSCRIPTION_ENABLED=true` (then the server behaves like an unknown event: no reply, no log).
- Rules: sender must be in the appointment room and be its patient or doctor; the `from` label comes from the socket's login, never the payload; only known fields are relayed (text max 2000 characters, max 3 translations, 8 KB per message); 12 captions/second and 8 language changes/5 seconds per socket; sender never gets its own caption back; nothing stored; no replay for a late joiner (the saved transcript is the record).
- Never logged: a refusal is logged by `rejectSignal` as event name + code only; the relay module has no `console` call; a real-process test scans the actual server output for caption text.
- Files: 4 (+549). New tests: 20 unit + 10 real-process (two people, stranger, admin, rate limit, flag on and off). Full integration suite: 61 tests, 60 pass, 0 fail, 1 skipped. 16 deliberate breakages of the code were all caught.
- Full backend suite: 3 runs gave 3205+ tests with only the 2 known failures once, then 2 DIFFERENT one-off failures in 2 later runs (see "Flaky tests" below).
- Decisions I made for you:
  - The `lang-changed` payload is `{ appointmentId, lang }` where `lang` is the language the sender READS/HEARS (`none` = Real voice). The other browser's recognizer adds/removes that translation target.
  - A caption longer than 2000 characters is cut to 2000 (live captions are best-effort); longer than 4000 is refused. The saved transcript keeps full rows separately.
  - Silent when the flag is off (no `signaling-error` reply), so the flag-off app behaves exactly as before.

### Flaky tests seen (not caused by this work)
- In the step 5 full-suite runs two unrelated tests failed once each and then passed: `adminNotificationsDoctorDecision.test.js` (file-level "test failed", 7 s in) and `secureLinks.test.js` "a real download is counted" (`Cannot read properties of null (reading 'counted')`: it reads a fire-and-forget write before it is finished). Both passed 4/4 and 3/3 when run alone, and neither involves any file changed by this feature. I treated them as timing flakes under the load of the full suite and did NOT stop. If they keep appearing, they are worth a look by whoever owns those tests.

## Step 6: engine and hook (`frontend/src/features/translation/`): DONE, committed (see git log: "live transcript engine")
- 17 small modules + a thin React hook `useTranscription`. Nothing in the app uses them yet (step 8 does). With the flag off no engine is created, nothing is loaded, no request is made.
- Done as specified: own-mic push stream; 10-slot candidate builder (browser locales, English, profile country, common languages; Hindi + Indian languages included; never two locales of one language); continuous detection; targets added/removed on the RUNNING recognizer; restarts only at a pause with the new session getting the audio first; confidence tiers; echo filter v2 + circuit breaker; stall/interruption/hidden-tab/track-ended detection with recovery and gap records; mute gate with a gap record; token refresh ~60 s before expiry; "reconnecting" with backoff; caption sender (partials ~4/s) and receiver; doctor hint; one-at-a-time voice queue through our own unlocked audio context; clipping telemetry (`engine.diagnostics()`); notice retry with backoff; transcript upload (25 per batch, halve on 413, retry, final flush).
- Speech SDK `microsoft-cognitiveservices-speech-sdk` 1.53.0 added to frontend/package.json (+ lock file), loaded ONLY by a dynamic `import()` in `loadSpeechSdk.js`.
- Also: `GET /api/transcription/config` now returns `confidence: { unclearBelow, lowBelow }` so what is shown live and what the server stores always agree.
- Tests: 140 new frontend tests (languages 19, retry/uploader 28, audio 42, recognizer 19, engine 31, flag 10 incl. earlier) + 1 backend. Everything with the Azure SDK, socket, HTTP, audio and clock faked. Mutation check: 47 deliberate breakages of the code, 46 caught; the one not caught is an equivalent change (a redundant guard). Full backend suite 3242 tests, only the 2 known failures. All frontend tests: 469, 1 failing = the known live-chat launcher static check (same family as the backend one). Frontend lint clean.
- Decisions I made for you:
  1. iPhone ducking: an iPhone ignores `audio.volume`, and routing the other person's WebRTC audio through a Web Audio gain node can come out SILENT on Safari (which would mean the patient stops hearing the doctor). The gain route is implemented and tested but OFF by default (`allowGainDucking` false). Result: on an iPhone the real voice is NOT lowered while the translation plays. To be tried on a real iPhone (manual test list at the end) before turning on.
  2. `package-lock.json` grew by 280 lines: the SDK and its dependencies, plus entries npm added for Tailwind's optional WebAssembly packages (npm regenerates them when it touches the lock file). `npm install` itself failed on a broken optional folder in your local `node_modules` (`@tailwindcss/oxide-wasm32-wasi`), so I updated the lock with `--package-lock-only` and copied the tested SDK files into `node_modules`. On a clean machine `npm ci` will install it normally; please run `npm ci` once on staging/CI to confirm.
  3. The transcript upload keeps rows only in memory (never localStorage): the words are health information. If the person closes the tab with the network down, rows not yet sent are lost; the final flush on leaving uses a `keepalive` request to reduce that.
  4. When a language is picked the person's recognizer switches to that single language at the next pause. If it keeps producing low-confidence nonsense (2 of the last 3 sentences under 0.4) it falls back to detection (and the saved lines say `auto`, not `declared`).


## Step 7: screens (language panel, subtitles, notice, transcript panel): DONE, committed `86dbd512`
- New components in `frontend/src/features/translation/`: `ControlButtons.jsx` (LANGUAGE and TRANSCRIPT buttons, same classes as MUTE/CAM), `LanguagePanel.jsx` ("Real voice (no translation)" first and default, search over 95 languages, "Show subtitles" and "Hear translated voice", notes for languages without speech/voice, scroll list has `data-lenis-prevent`), `TranscriptPanel.jsx` (speaker, time, original, translation; echo and unclear lines are saved but not listed), `TranscriptionOverlay.jsx` (badge "Transcribing", closable notice "This call is being transcribed.", "Subtitles unavailable, reconnecting…", doctor hint "Patient is speaking X. Turn on translation?", doctor banner "Patient's speech in this language cannot be transcribed.", subtitles with a lighter style for unclear text and "Machine-translated, may contain errors"), `uiModel.js` (pure logic), `translation.css` (own `hc-tr__` prefix; on screens up to 720 px the panels slide up from the bottom).
- Engine/hook: new setting `subtitlesEnabled` (on by default) with `setSubtitlesEnabled`.
- Nothing is on the call screen yet (step 8). The overlay draws nothing unless the engine is running, so flag off = today's screen (tested).
- Tests: 12 new UI tests (pure logic + components rendered to HTML) and 1 engine test. 6 deliberate breakages (Real voice not first, doctor banner for the wrong role, overlay showing when not running, hint shown to the patient, unclear lines listed, scroll guard removed) were all caught. Lint clean. Frontend suite 482 tests, only the known live-chat launcher check fails; backend 3242, only the 2 known failures plus one unrelated one-off (`secureLinks.test.js`, passes alone 35/35: same flake as noted in step 5).
- Decisions I made for you:
  1. The doctor's "Turn on" in the hint picks the doctor's own browser language (English if unknown) and unlocks audio in that tap.
  2. When the translated voice is switched off by the echo breaker, the panel says so in words and the checkbox shows unchecked until the person switches it on again.
  3. Notice can be closed, the "Transcribing" badge cannot.
- Test environment note: the frontend tests that render pages (payment step, live chat) FAIL if started from Git Bash (two copies of React, because of the `/c/...` path form) and PASS from PowerShell/cmd. This is not caused by this feature (they pass on the commit before it). Run frontend tests from PowerShell or cmd.

## Step 8: appointment call screen (`frontend/src/pages/VideoCall.jsx`): DONE, committed `81428c3d`
- About 85 added lines in VideoCall.jsx, nothing removed except one `className` line widened. CallMoreMenu.jsx needed NO change (it already takes the buttons as children).
- What was added: the config check (`loadTranscriptionConfig`: no request at all when `VITE_TRANSCRIPTION_ENABLED` is not `true`); `useTranscription(...)`; LANGUAGE and TRANSCRIPT buttons in the control bar (desktop) or the "More" drawer (phones); the overlay (badge, notice, subtitles, hints) on the video stage; the two panels next to the chat panel (bottom sheets on phones).
- The engine is fed by: call connected (`inCall`) -> `start()`; MUTE -> `setMuted` (pauses the recognizer, records a gap); a new local stream (camera/mic retry, device change, `attachLocalMediaStream`) -> `swapMicStream`; `peer-joined` -> `onPeerJoined`; socket reconnect -> `onSocketReconnected` (both re-send my language to the other side). Leaving the call stops the engine (final flush of unsent lines).
- Requests from the engine use the caller's own login (`authRole` doctor / user), like the rest of the call screen.
- Flag off = today's call screen: no request, no component rendered, `useTranscription` returns a fixed off state (all checked in tests).
- Tests: 8 static wiring tests (guards, feeding events, role, size, no logging of text, DirectVideoCall untouched); 4 deliberate breakages all caught. Lint: VideoCall.jsx has the same warnings as before (16 existing errors from rules newer than the file; compared with HEAD: identical set, none new). `npm run build` passes (419 pages prerendered, SEO check passed); the Speech SDK is its own lazy chunk (`microsoft.cognitiveservices.speech.sdk-*.js`), not in the main bundle.
- Full frontend suite: 477 tests; the known live-chat launcher check fails; `paymentStepCurrency.test.mjs` failed once as a whole file under load (31 s) and passes alone (14/14, run twice) and in the earlier full run.
- NOT done in this step (by design): DirectVideoCall (direct bookings) is untouched; I did not run a real browser call (needs Azure keys and the staging server: see step 10 checklist).
- Decisions I made for you:
  1. Only the appointment call screen is wired (as agreed). A direct-booking call shows nothing of this feature.
  2. The transcript upload `keepalive` flag is passed to the HTTP client but axios ignores it, so the final flush when the tab closes is best-effort (known; the lines are retried while the page lives).
  3. LANGUAGE / TRANSCRIPT panels may be open at the same time as the chat panel on desktop; on phones they are bottom sheets and the latest one is on top.

## Step 9: saved transcript in the dashboards: DONE, committed `139dfa40`
- New: `TranscriptViewer.jsx` (button "Transcript" -> dialog) and `transcriptViewModel.js` (pure logic + the two requests). Mounted in `DoctorAppointments.jsx` (started/finished appointments; doctor's own login; READ ONLY) and `AdminAppointmentDetails.jsx` (next to "View call report"; admin and superadmin; with delete).
- Both mounts exist only when `VITE_TRANSCRIPTION_ENABLED=true` in the build; with it off the dashboards are unchanged. Nothing is requested until the button is pressed (every open is an audited read on the server, so no automatic reads). The patient screens never use it (tested by scanning all of `src`).
- Shown: speaker, date/time, language name, original words, English record (when different), marks: Unclear, Low confidence, Possible echo, Language not supported for transcription, Recorded before the notice was confirmed (noticePending), Uploaded late (lateUpload), Language detected automatically, Could not be read; gaps with a reason in words (muted, recognition unavailable, microphone stopped, app in background, interrupted). Unclear and echo lines ARE listed here (the record), marked, although the live panel hides them. A yellow box above lists what a reader must know (notice not confirmed on both sides, counts of pending/hidden/late lines and gaps, truncated).
- Delete (admin/superadmin only): "Delete transcript…" -> a confirmation box with a required reason (3 to 300 characters; no request is sent without it) -> "Yes, delete it". The server writes the audit row first (who, why, IP) and then removes the lines; the screen says the deletion and the reason are recorded. Doctors do not see the button; the server also refuses them.
- Failures are worded for people (no access / try again / too many requests); the server's own text is never shown.
- Tests: 17 new (view model, both requests with a fake client, rendering, mounts). 9 deliberate breakages, all caught (the one first missed, the Delete-button gate, now has a test). Frontend suite 505 tests, only the known live-chat launcher check fails; `npm run build` passes; lint: the two dashboard files have exactly the same single pre-existing finding as before.
- Decisions I made for you:
  1. The doctor sees the saved transcript for `confirmed`, `complete` and `completed` appointments (so a doctor can reopen it right after the call and later).
  2. The admin view is on the appointment details page, not in the list, so it is one deliberate click per appointment.
  3. Dashboard "flags" use words, not codes, and the machine-translation note is always printed at the bottom.
  4. Not done: direct-booking (CategoryConsultation) rows in the doctor list use the same appointment id in the same route (the server accepts both kinds) but their call screen is not wired, so they will normally have no transcript.

## Step 10: automated tests: DONE, committed `52a31899`
- NEW browser end-to-end test `npm run test:e2e:transcription` (from `frontend/`, in PowerShell or cmd): two real Chromium tabs (doctor and patient) with Chrome's fake microphone, the REAL hook, engine, panels and buttons, a fake Azure SDK (Vite alias, so the real SDK loader runs) and a fake call socket between the tabs. 7 tests, all pass, run 3 times without a flake; 2 deliberate breakages of the engine (mute not reaching the audio gate; the other side's language ignored) were caught.
  1. Flag off: no request, no audio context, no element on the page, no message to the other side.
  2. Notice on both sides, one notice record from each, notice closable, badge stays.
  3. Doctor picks German in the LANGUAGE panel ("Real voice (no translation)" is the default and first); the patient's recognizer gets German added while running; the patient (Hindi) speaks; the doctor reads the German subtitle with "Machine-translated, may contain errors" and sees the line in the TRANSCRIPT panel; the patient's browser uploads the original Hindi + the English record (and the German text the doctor was reading).
  4. Mute stops audio to Azure (no audio chunks while muted, they resume after), and a `muted` gap is uploaded.
  5. A reloaded tab is told the other side's language again.
  6. Azure unreachable: call goes on, badge and notice stay, notice still recorded, no page error.
  7. No page error in any test.
- What is covered where (so nothing is double-claimed):
  - Backend API (real routes, in-memory DB; 3242 backend tests in total, only the 2 known failures): the patient can never read; only the doctor of that booking; admin/superadmin read and delete; every read and delete audited (who, role, when, count, IP, reason); audit failure = nothing returned / nothing deleted; flag off keeps read and delete working; both booking kinds (appointment and category/direct) for notice, read and delete; late-upload and noticePending flags; limits; no text in logs.
  - Real-process socket test (`integration/captions.itest.js`): two people, stranger, admin, rate limit, flag on and off.
  - Engine (fakes, 32 tests): token expiry and refresh, retry and backoff, 413 halving, recognizer restart, reconnect, echo filter and breaker, stall, hidden tab, gaps, safety net.
  - NOT covered by any automatic test (needs real devices and a real Azure key): the real Azure service, real speech accuracy, the translated voice through real speakers, iPhone Safari audio rules, echo between two real devices in one room.
- Full suites at the end: backend 3242 tests (2 known failures: live-chat greeter, plan integrity); frontend 505 tests (1 known failure: live-chat launcher check); `npm run build` passes. `git status` is clean except `docs/translation/`.
- Decision I made for you: the e2e test accepts that a line saved by the patient's browser also carries the translation in the language the doctor was reading (up to 3 translations are allowed by the server), next to the English record. If you want ONLY English saved, it is a one-line change in the engine's `onFinal` plus this test.

---------------------------------------------------------------------
## WHAT IS LEFT FOR YOU: manual tests on real devices
Do these on STAGING after turning the feature on (steps below). Use two devices for every test: one is the doctor, one is the patient. Use a test appointment, not a real patient.

### Before you start (5 minutes)
1. Open the staging site on both devices, log in as the doctor and as the patient, start the appointment call. You should see, on BOTH screens: a small "Transcribing" badge, the notice "This call is being transcribed. Please keep the call in a quiet place. Other voices nearby may be transcribed.", and two new buttons: Language and Transcript (on a phone they are inside "More").
2. If the buttons are missing: the build flag or the server flag is off (see "Turning it on").
3. Open the browser console on the laptop. There must be NO red "Content-Security-Policy" messages. (The page policy already allows `https:` and `wss:` connections, so Azure should be allowed. If you see one, send me the exact text.)

### A. Laptop (Chrome, then Edge or Firefox if you have time)
1. Language panel: the first row is "Real voice (no translation)" and it is selected. Search "ger" and pick German. The list scrolls with the mouse wheel.
2. Doctor picks German, patient speaks English or Hindi: within 1 to 2 seconds the doctor sees German subtitles under the video and hears a German voice. Both people should still be able to hear each other's real voice (quieter while the translated voice plays, on laptops).
3. Switch off "Hear translated voice": subtitles stay, voice stops. Switch off "Show subtitles": subtitles disappear, voice stays.
4. Mute yourself, speak, unmute: nothing said while muted appears. After the call, the doctor dashboard transcript shows the line "Microphone muted" as a gap.
5. Open the Transcript panel: lines have Doctor/Patient, time, the original words and the translation. Unclear lines are not listed there.
6. Refresh one side in the middle of the call: after a few seconds subtitles work again and the other side's language is remembered.

### B. iPhone (Safari) as the PATIENT (the most important one)
1. Join the call on the iPhone. Tap Language (inside More) and pick a language. This tap is what allows sound to play on an iPhone, so always pick the language by tapping.
2. Speak (Hindi and English): the doctor's laptop must show the captions. If the iPhone user talks and nothing appears on the laptop, note the iOS version and tell me.
3. The doctor speaks: the iPhone shows subtitles and plays the translated voice. Expected on iPhone: the doctor's real voice is NOT made quieter while the translation plays (known limit, step 6 decision 1). Check that the doctor's real voice stays audible at all times (it must).
4. Lock the screen for 10 seconds, unlock: the call must recover; the doctor's dashboard transcript shows a gap "App was in the background". If you can, take a phone call: gap "Interrupted".
5. Rotate the phone; check that the panels are bottom sheets and the buttons are reachable.

### C. Android (Chrome) as the PATIENT
Same as B. Also switch from Wi-Fi to mobile data in the middle of the call: "Subtitles unavailable, reconnecting…" should appear and then go away by itself; the call itself must not drop because of this feature.

### D. Dashboards (after the call)
1. Doctor dashboard > Appointments: on that appointment press "Transcript": lines, language, English record, marks. The patient never sees it.
2. Admin: Appointment details > "Transcript": same, plus "Delete transcript…": asks for a reason (at least 3 characters) and a second confirmation. After deleting, the transcript is empty.
3. Database, collection `transcriptaccesslogs`: one row per open and one per delete, with the reason. It never contains the words.

### E. Echo / quiet room (two devices in the SAME room)
Put both devices in one room with the speakers on. Speak: lines caused by the other device's voice should be marked "Possible echo" in the dashboard and not shown in the live panel. If the translated voice keeps being picked up, it switches itself off, with a message in the Language panel.

## TURNING IT ON IN STAGING (exact steps; nothing was deployed by me)
1. Backend environment (staging server `.env`, NEVER committed):
   - `TRANSCRIPTION_ENABLED=true`
   - `AZURE_SPEECH_KEY=<key of the connect-speech resource>`
   - `AZURE_SPEECH_REGION=eastus`
   - Optional: `TRANSCRIPT_MODE=notice` (default), `TRANSCRIPT_UNCLEAR_BELOW=0.4`, `TRANSCRIPT_LOW_BELOW=0.7`, `TRANSCRIPT_LATE_UPLOAD_MINUTES=30`, `SPEECH_TOKEN_MAX_PER_APPOINTMENT` (leave empty for the default).
   - Restart the backend the way you normally do.
2. Frontend: add `VITE_TRANSCRIPTION_ENABLED=true` to the env used for the staging build (for example `frontend/.env.production` on the build machine), run `npm ci` once (the Speech SDK was added to package.json and package-lock.json), then `npm run build` and publish `dist` the usual way. The flag is read at BUILD time, so a rebuild is required.
3. Check: `GET https://<staging>/api/transcription/config` while logged in answers `{"enabled":true,"mode":"notice",...}`. A call screen then shows the badge and the buttons.
4. To turn it off again: set `TRANSCRIPTION_ENABLED=false` and restart the backend. The call screens return to normal for everyone; saved transcripts stay readable and deletable by doctor/admin.
5. Do NOT turn it on in production before sections A to E are done and whoever signs off privacy has agreed the notice wording. Production also needs a real data-retention decision: transcripts are kept until an admin deletes them (there is no automatic expiry).

## Things I could not do / you should know
- No real Azure call was made (no key here). Everything with Azure was tested against a faithful fake.
- Direct-booking calls (DirectVideoCall) are NOT wired yet (agreed: later).
- `package-lock.json`: see step 6 decision 2 (run `npm ci` once).
- Frontend tests that render pages must be started from PowerShell/cmd, not Git Bash (see the step 7 note).
- Known unrelated failures: backend live-chat greeter + plan integrity; frontend live-chat launcher check. One-off flakes seen under load: `secureLinks.test.js`, `adminNotificationsDoctorDecision.test.js`, `paymentStepCurrency.test.mjs` (all pass when run alone).

---------------------------------------------------------------------
## PHI encryption key + resilient lists (separate from the transcript steps)

What changed: (a) a bad record or a missing S3 setting no longer breaks a whole list; (b) read-only script `npm run phi:decrypt-check`; (c) startup check of `PHI_ENCRYPTION_KEY` that only WARNS until you switch on `PHI_KEY_REQUIRED=true`; plus `npm run phi:fallback-key`.

### How the key works (important)
- If `PHI_ENCRYPTION_KEY` is missing (or malformed), the code uses `sha256(JWT_SECRET + ":phi")`. So two environments (or a laptop on the same database) can read each other's records ONLY if their JWT_SECRET is identical. That is what broke `my-prescriptions` / `my-certificates` on staging.
- NEVER invent a new random key on an environment that already holds data: all its existing records would become unreadable.

### Checklist, per environment (staging, uat, production), in this order
1. Look: restart or deploy with this change. The log shows ONE line at startup: either `PHI_ENCRYPTION_KEY is set (fingerprint xxxxxxxx)` or `WARNING ... Using the JWT_SECRET fallback key (fingerprint xxxxxxxx)`. Only the fingerprint is shown. Nothing refuses to start at this point.
2. If it says fallback: on THAT server's terminal, with that environment's env file (`NODE_ENV=production|uat|staging`; staging and development read `.env`), run `npm run phi:fallback-key`. It prints `PHI_ENCRYPTION_KEY=<64 hex>` on the terminal only (the fingerprint goes to stderr). Do not paste it into chat, tickets or logs.
3. Put that exact line into that environment's env file (`.env.production`, `.env.uat`, `.env`), restart, and check the startup line now says `is set` with THE SAME fingerprint as in step 1/2. Same fingerprint = nothing changed for existing data.
4. Run `npm run phi:decrypt-check` there. It prints the key fingerprint and, per collection, how many encrypted records exist and the IDS of any that cannot be decrypted. Nothing is written.
5. Shared database (laptop + staging): the laptop must use the SAME `PHI_ENCRYPTION_KEY` as staging. Records written earlier by the laptop on its own fallback key are the "cannot be decrypted" ones: the list from step 4 shows their ids; decide per record to delete or leave them (the app now shows "This record can't be displayed right now. Please contact support." for them instead of failing).
6. Only after steps 1 to 4 are clean on an environment: add `PHI_KEY_REQUIRED=true` to its env file. From then on it refuses to start without a valid key, so a missing key can never go unnoticed again. Do production last.
7. Compare environments by fingerprint only: two environments that share a database must show the SAME fingerprint.

### What the app shows now
- `GET /api/appointments/mine` and `/doctor`: with no S3 configured the list loads; a booking's attached file has `url: null` and `urlUnavailable: true` (no link); only the booking id is logged.
- `my-prescriptions`, `my-certificates`, the doctor's patient history: an unreadable record comes back with `unreadable: true`, empty protected fields and the message; screens show "This record can't be displayed right now. Please contact support." and no open/download button. Only the record id is logged.
- Report amendments get the same treatment. NOT changed on purpose: visit-note editing (`readFields` in the save path). Making it tolerant there would let a failed decrypt overwrite a note with blanks, so it still fails loudly.

### Tests
Backend: 23 new (key status, startup levels per environment, refuse switch, no secret in any message, fallback compatibility, script output, decrypt checker, resilient lists). Frontend: 4 new. 8 + 0 deliberate breakages of the backend code were all caught. Full backend 3265 tests (2 known failures), frontend 509 (1 known failure), build passes.


---------------------------------------------------------------------
## 13 Nov evening

Branch `currency`, nothing pushed, nothing deployed, no `.env` file read or changed. Commits of this section (oldest first):
`9318e553` one voice (deployed earlier) · `2c210ba2` lost-sentence safety · `82e187cf` backend lock file · `2ddc9b10` real two-browser call test.

### URGENT 1: doctor and patient video call not connecting on staging
**Status: our code does NOT break the call. Not reproducible locally. The cause is most likely on the server / HTTPS side (checklist below).**

**What I checked (every change we made that touches the call):**
- `frontend/src/pages/VideoCall.jsx` (86 lines changed vs `main`): imports, the config request, the `useTranscription` hook, start-on-connected, three one-line calls (`swapMicStream`, `onPeerJoined`, `onSocketReconnected`), `setMuted`, the overlay and the two buttons. With the flags off the hook creates nothing and returns no-op actions. It never calls `getUserMedia`, never touches tracks, `RTCPeerConnection` or signaling.
- `backend/server.js` (35 lines vs `main`): two routers, one rate limiter pair, the `lang-changed` / `caption` handlers (and now `tr-status`), and the PHI key check at startup. The PHI check only WARNS unless `PHI_KEY_REQUIRED=true`, so it cannot stop the server. The transcript handlers do nothing at all when `TRANSCRIPTION_ENABLED` is not `true`. None of these touch `join-appointment-room`, `offer`, `answer`, `ice-candidate` or `peer-joined`.
- The remote-audio muting (`9318e553`): only acts when BOTH people picked a language and the languages differ (`realVoiceGuard.js`). By default nothing is muted. It sets `element.muted` on the one `<audio>` element only; it never touches the WebRTC track.
- The transcription engine uses its own `AudioContext` and its own `createMediaStreamSource` on the local stream (read only). It does not replace or stop any track.

**Proof (real browsers, real backend):** new test `frontend/tests/e2e/videoCall/videoCall.e2e.test.mjs` (`npm run test:e2e:video-call`). It starts the real backend (`node server.js` + in-memory MongoDB + Socket.IO), the real app, two Chromium browsers with fake camera and microphone, logs in as the seeded doctor and patient and opens the real `/video-call/:id` page. Result:
- flags OFF: both sides get live remote audio, nothing muted, no page errors, no transcript UI, no transcript requests: PASS (about 8 s to connect).
- flags ON (`TRANSCRIPTION_ENABLED=true`, `VITE_TRANSCRIPTION_ENABLED=true`): both sides connect, LANGUAGE button present, call stays connected: PASS (about 8 s).
- Only page error in both modes: `Uncaught (in promise) Error: License expired` (a third-party library on the page; also present with the flag off; unrelated). The test names it explicitly.

**Not code, check these on the staging server (you cannot be sure from here). Exact steps:**
1. **Microphone/camera need HTTPS.** `http://54.82.47.239` is NOT a secure context: the browser hides `navigator.mediaDevices`, so the call cannot start. Open `https://54.82.47.239/` and make sure the address bar shows a valid lock. In the browser console run `window.isSecureContext` (must be `true`) and `!!navigator.mediaDevices` (must be `true`). If either is false you are on http or an invalid certificate.
2. **Let's Encrypt on a bare IP** (short-lived certificate): `echo | openssl s_client -connect 54.82.47.239:443 -servername 54.82.47.239 2>/dev/null | openssl x509 -noout -dates -subject` — expect `notAfter` in the future. If the certificate expired, the browser blocks `wss://` (sockets) and `getUserMedia` silently.
3. **nginx must pass WebSocket upgrades** on `/socket.io/`: `sudo nginx -T | grep -A12 "location /socket.io"` — expect `proxy_http_version 1.1;`, `proxy_set_header Upgrade $http_upgrade;`, `proxy_set_header Connection "upgrade";`, `proxy_set_header Host $host;`, `proxy_set_header X-Forwarded-Proto $scheme;`, `proxy_read_timeout` of at least 60s (longer is better). Quick test: `curl -sk "https://54.82.47.239/socket.io/?EIO=4&transport=polling" | head -c 200` — expect text starting with `0{"sid":`. A 400/403/502 means nginx or CORS.
4. **Socket origin check.** The backend allows only the origins in `FRONTEND_URL` + `CORS_ALLOWED_ORIGINS` (`isOriginAllowed`, same list for REST and Socket.IO). The browser sends `Origin: https://54.82.47.239`. Check: `curl -sk -H "Origin: https://54.82.47.239" -i "https://54.82.47.239/socket.io/?EIO=4&transport=polling" | head -12` — expect `Access-Control-Allow-Origin: https://54.82.47.239` and `Access-Control-Allow-Credentials: true`. Repeat with `-H "Origin: http://54.82.47.239"`. No `Access-Control-Allow-Origin` header = the origin is not in the list (restart the backend after changing it; no trailing slash, no path).
5. **Cookies / proxy trust.** Behind nginx the backend should trust the proxy so `Secure` cookies and the client IP work: check `TRUST_PROXY` is set (for one nginx in front: `TRUST_PROXY=1`) with `pm2 env <id> | grep TRUST_PROXY` (do not paste other variables into chat). Without it login cookies/refresh can fail on https and the call page redirects to login.
6. **FRONTEND_URL still `http://...`** only matters for links the server builds (e-mails, payment return URLs), not for the call. Still set it to the https origin when you move to https for real.
7. **TURN / ICE.** The server refuses to start without TURN settings, so they exist. Test the credentials endpoint is reachable when logged in (browser console on the https site): `fetch('/api/rtc/ice-servers',{credentials:'include'}).then(r=>r.json()).then(j=>console.log(j.iceServers.map(s=>s.urls)))`. Expect STUN and `turn:` / `turns:` URLs with your TURN host, not `127.0.0.1`. Then check the TURN server is reachable from outside: `nc -vzu <turn-host> 3478` and `nc -vz <turn-host> 3478` (and 5349 for `turns`), and the AWS security group / firewall allows UDP and TCP 3478 and the relay port range (default 49152-65535 UDP). With a symmetric NAT or office network and no working TURN, signaling works but the call never shows video ("connecting").
8. **CSP / mixed content.** Helmet's CSP is disabled in the backend (commented out). If nginx adds a `Content-Security-Policy` header, `connect-src` must contain `wss://54.82.47.239` and `https://54.82.47.239`, and `media-src`/`img-src` must allow `blob:`. In the browser console, any "Mixed Content" or "Refused to connect" line points at this. Check nginx: `sudo nginx -T | grep -i "content-security-policy"`.
9. **Frontend build points at the right place.** The API/socket URL is baked in at build time. If `VITE_API_URL` / `VITE_SOCKET_URL` in the staging build env point to `http://...`, the https page cannot call them (mixed content). Empty values (same origin) are the simplest setting for the nginx setup.

**Diagnostics already in the code (no change needed, no text or secrets in them):** the call page and the socket already log the exact step. Tomorrow, on the staging call page open DevTools > Console (tick "Preserve log"), reproduce, and send me:
- the lines starting with `[socket]` (`connected`, `connect_error` with `message`/`description`, `disconnected`, `reconnect_attempt`),
- the lines starting with `[video-call]` (for example `join_denied`, `socket_reconnected_during_call`, `ice_*`, `peer_connection_state`, `media_*`),
- any red line mentioning `getUserMedia`, `NotAllowedError`, `NotFoundError`, `Mixed Content`, `CORS`, `WebSocket connection to`,
- in DevTools > Network (filter "WS"): the status of the `socket.io` request (101 = good),
- `chrome://webrtc-internals` > the connection > "ICE connection state" and the list of "ICE candidate pair" rows (`relay` candidates present means TURN works),
- on the server: `pm2 logs hc-backend --lines 200 --nostream | grep -iE "socket|origin|cors|join|denied|rejected|signaling|turn"` (these log lines never contain transcript text).

### 2. Patient-safety and proof fixes — commit `2c210ba2`
**Status: done and committed; backend + frontend.**
- a) **Unclear / not understood.** Listener sees "Didn't catch that - please ask them to repeat" and the real voice comes back for 6 s; speaker sees "Not understood - please repeat"; the unclear text, if any, is shown as a light subtitle marked "(unclear)". To make this possible, an unclear sentence is now SENT to the other device (it is hidden there, never spoken).
- b) **No-match stretches** (Azure heard sound but returned no words) while the speaker's microphone is clearly loud (peak above 0.1) are saved as ONE gap row "Speech not recognised" with start and duration. New gap reason `not_recognised` (backend model + save path + transcript view label).
- c) **Wrong-language safety net:** 3 loud no-match results within 30 s with a picked language switch to automatic detection (same mechanism as the low-confidence route) and show "You may be speaking a different language than selected". Quiet no-match, slow ones, and people already on detection do not trigger it.
- d) **Peer gaps:** new socket event `tr-status` (`ok | no_match | stalled | backgrounded | interrupted | down`), sent by the SPEAKER only on change (and again when the other person joins or the socket reconnects). Listener unmutes the real voice at once and shows "Translation unavailable - you are hearing the original voice"; `ok` mutes again. Backend: `captionRelay.js` (`onStatus`, strict payload check, role from the socket, flag gated, nothing logged), own rate limiter `trStatusLimiter` (10 per 5 s per socket, cleaned up on disconnect), registered in `server.js`.
- Files: backend `utils/speech/captionRelay.js`, `server.js`, `models/TranscriptSegment.js`, `utils/speech/transcriptSegments.js`; frontend `features/translation/{engine,captionProtocol,micPipeline,recognizerController,realVoiceGuard,uiModel,TranscriptionOverlay,transcriptViewModel,useTranscription}`.
- Tests: new `transcriptionSafetyNet.test.mjs` (21), overlay render test, backend `captionRelay.test.js` (+5). Five deliberate breakages of the engine were all caught. Frontend 555 pass / 1 known failure (live-chat launcher). Backend 3246 pass; the only failures are the two known ones (live-chat greeter, plan integrity) plus live-chat/secure-links tests that fail only under heavy machine load and pass alone. Frontend build passes.
- Check on staging: with the speaker mute their own microphone: the listener must NOT get any message. Cover the doctor's microphone with a cloth while speaking loudly: speaker sees "Not understood"; listener sees "Didn't catch that". Put the speaker's tab in the background (phone: lock screen): within 1-2 s the listener hears the real voice and sees the unavailable message.
- Decisions: `no_match` is announced for EVERY loud no-match (each is an event); other statuses only on change. Quiet no-match is ignored (normal silence). The 8-second rule stays as a second safety net. One limit remains: the sentence that was lost while the real voice was muted cannot be recovered; the 6 s unmute protects the next words.

### 3. Backend lock file — commit `82e187cf`
**Status: done.** `npm ci` failed on staging with "Missing: gcp-metadata@7.0.1 from lock file". Cause: `package-lock.json` was written by npm 11, which leaves out the OPTIONAL peer dependency `gcp-metadata` of `mongoose` and `mongodb-memory-server-core`; staging's npm 10 demands it. It is NOT caused by the currency work: the same lock on `main` (and back to the first commit) fails with npm 10. I reproduced the error with `npx npm@10 ci --dry-run`, ran `npm@10 install --package-lock-only` (33 lines added, two `gcp-metadata@7.0.1` optional-peer entries, no version changes, `package.json` untouched) and confirmed `npm ci --dry-run` now passes with npm 10 and npm 11. Only the lock file is in the commit. Backend tests: see section 2.

### EXACT deploy steps for tomorrow
Everything below is already on `currency` (nothing pushed yet — push/merge as you normally do).
- **Backend: YES** (new `tr-status` relay event, new gap reason `not_recognised`, new lock file, earlier PHI key check):
  1. `git pull` the branch on the server, `cd backend`
  2. `npm ci` (now passes on npm 10)
  3. `pm2 restart hc-backend`
  4. Check the startup log shows ONE `PHI_ENCRYPTION_KEY` line (see the PHI checklist above in this report); `TRANSCRIPTION_ENABLED=true` stays as is.
- **Frontend: YES** (one voice, lost-sentence messages, tr-status, hint texts):
  `cd frontend && VITE_TRANSCRIPTION_ENABLED=true npm run build:uat`, then publish the new `dist` as usual (clear the CDN/browser cache; ask both testers to hard-reload).
- Deploy backend FIRST, then the frontend (an old frontend simply never sends or understands `tr-status`; an old backend simply ignores the unknown event, so nothing breaks in either order).
- Both people in a test call must have the new frontend.
- For the call-not-connecting problem: do the server checklist at the top of this section BEFORE deploying; an update will not fix an HTTPS/nginx/TURN problem.
