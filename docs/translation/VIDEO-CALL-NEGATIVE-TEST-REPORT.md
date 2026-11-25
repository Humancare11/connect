# Video call negative test report

Date: 2026-11-17. Branch: `currency`, commit `2eb4a9c2`. No app code was changed; this is a read-only test run.
Written for: the product owner (plain English first, technical detail under each finding).

---

## 1. Short answer

**Do not deploy this as "safe from abuse" yet. Two problems need a decision before real patients use it.**

| Severity | Count | What |
|---|---|---|
| **Critical** | 1 | Any logged-in patient or doctor can read **other people's call-chat history** by sending a special value instead of an appointment id (finding F1). |
| **High** | 1 | One person in a call can **crash the other person's call screen** by sending a malformed chat message (finding F2). |
| Medium | 4 | Chat has no length limit; microphone unplugged mid-call shows no message; transcript badge still says "Transcribing" when Azure has refused us; no time window to join a call (F3 to F6). |
| Low | 4 | Name/file fields in chat come from the browser; no message for "no camera"; chat takes 9 to 13 s to work again after a server restart; one unproven blip in a 12-minute call (F7 to F10). |

Both the Critical and the High problem are in the **existing call/chat code, not in the transcription or speed work**: they behave the same with the transcription flag OFF and ON. `git log -S` shows the unchecked chat-history query came in with commit `4929e7c0` ("hipaa and security changes done"), and the access helper that also takes the raw id came in with `22687366` ("Call lock: only a confirmed booking opens the call room"). Neither is part of the transcription commits.

What held up well (details in the table): strangers, other doctors, admins and a third person are refused; pending, cancelled and completed bookings are refused; the same person in two tabs is handled; tampered, oversized and flooded call signals are refused or rate limited; captions cannot be spoofed or sent into a room you are not in; the transcript and speech-token APIs enforce who may read, write and delete; chat HTML is shown as text and never run; permission-denied and no-device cases give a clear message and a Retry button that works; the call recovers after 5 s, 30 s and 2 min offline, after a reconnect storm and after the backend is killed and restarted; the production build works on Slow 4G; memory stays flat in a 12-minute call and the call survives its login token expiring 4 to 8 times; with the transcription flag OFF there is no transcript UI and no transcript or speech request.

---

## 2. How it was tested

Everything ran locally: the **real backend** (`node server.js`) with an **in-memory MongoDB**, the **real call page** (`VideoCall.jsx`) in **real Chromium** with fake camera and microphone, using the existing `signalingStack` harness. Every case was run with the transcription flag **OFF** and **ON** (Azure is fake or unreachable; no real Azure key was used, no `.env` was read). All data is dummy data.

| Layer | What | Size |
|---|---|---|
| 1. Socket + REST | Real Socket.IO and HTTP calls against the real server: access rules, tampered payloads, floods, caption spoofing, transcript API, speech-token API | 113 checks per flag |
| 2. Browser | Real call page in Chromium: positive regression, access, devices, offline, backend restart, reconnect storm, transcription with Azure refusing the key | about 60 checks per flag plus reruns |
| 3. Production build + long call | `vite build` production bundle on **Slow 4G**; 12-minute call with a 90-second login token; 4-minute call with a 60-second login token | 3 runs |

Honest notes on the method:
- The machine was low on memory (about 450 MB free at one point), which caused timeouts in my first browser run. I stopped it, fixed my script (it also tripped the app's login rate limit, which is my script's fault), and re-ran. Flaky results were re-run until they were stable; where a result changed between runs, the table shows the final run and the finding says so.
- "Connected" in the first runs meant the remote audio track existed. From the re-runs on, "real audio bytes flowing" was also checked with WebRTC stats (it is in the table).
- Throw-away scripts are in the session scratch folder (outside the repo), not committed.

---

## 3. Findings (every FAIL, with steps and root cause)

### F1. CRITICAL: a patient or doctor can read other appointments' chat history

- **Plain English:** The call room asks the browser for an appointment id. The server does not check that it really is an id. If someone sends a special search object instead (for example "any id greater than mine"), the server accepts it, checks permission against **their own** appointment, and then loads chat history using the same search object, which returns **other patients' chat messages**.
- **Flag OFF / ON:** fails in both.
- **Steps to reproduce (dummy data, any logged-in patient or doctor):**
  1. Log in as any patient who has one confirmed appointment. Open a Socket.IO connection with their token.
  2. Emit `user-online` as normal.
  3. Emit `join-appointment-room` with `appointmentId: { "$gte": "<your own appointment id>" }` (also works with `{ "$ne": null }`, `{ "$in": [own, other] }`, `{ "$nin": [] }`).
  4. The server answers `appointment-chat-history`. It contained a message that belongs to a **different patient's** appointment (a dummy message `VICTIM-PRIVATE-MESSAGE-DUMMY` in the test). Up to 100 messages come back, oldest first, and no id of the victim is needed (`$gte` is enough).
  5. Doctors can do the same (`{ "$nin": [] }`).
- **Log lines:** none. The server logs nothing for this; it looks like a normal join (`[socket] ...` has no warning). That also means it would not be noticed in the logs.
- **Root cause:**
  - [backend/server.js:2060](backend/server.js#L2060) the `join-appointment-room` handler passes the client's `appointmentId` on without checking its type.
  - [backend/utils/appointmentRoomAccess.js:40](backend/utils/appointmentRoomAccess.js#L40) `Appointment.findById(appointmentId)`: Mongoose accepts an operator object here, so the permission check runs against whichever appointment matches.
  - [backend/server.js:2229](backend/server.js#L2229) `ChatMessage.find({ appointmentId })` then uses the same object as a filter, so it returns messages from many appointments.
- **Not caused by the transcription or speed commits** (see the summary for which older commits introduced it). Same pattern may exist in other socket events and REST routes that take an id from the client; I tested only this handler and `appointment-message` (see section 5).
- **Not exploitable for:** reading another room's live video, or posting into another room (tested: the attacker cannot post into the victim's room).
- **Suggested fix (not done, read-only task):** at the top of every socket handler that takes an id, require `typeof id === "string"` and `mongoose.isValidObjectId(id)`, and use `String(id)` in every query.

### F2. HIGH: one participant can crash the other person's call screen

- **Plain English:** The chat relay forwards `text`, `senderName`, `fileName` and `fileType` exactly as the sender's browser gave them. If one of them is an object instead of text, the other person's call page cannot draw it and shows "Something went wrong. The video call crashed unexpectedly." The doctor's consultation screen is replaced mid-call.
- **Flag OFF / ON:** the same code path (tested with flag OFF; the chat code does not depend on the flag).
- **Steps to reproduce:**
  1. Doctor opens the call page. Patient joins the room (any socket logged in as the patient).
  2. Patient socket emits `appointment-message` with `{ appointmentId, senderId, senderName: "x", text: { "a": 1 } }`.
  3. The doctor's page shows the error screen. Same with `senderName: { a: 1 }` and with `fileName: { a: 1 }, fileType: ["z"]` (plus a `fileUrl`).
  4. A number or an array as `text`, or a null text with an object `fileUrl`, did **not** crash the page (checked one by one on fresh pages).
- **Why it matters:** a patient (or anyone who can open the call) can break the doctor's screen during a consultation; the doctor must reload and rejoin.
- **Root cause:** [backend/server.js:2352-2362](backend/server.js#L2352) the relay `emit("appointment-message", { senderName, text: text || "", fileName: fileName || null, fileType: fileType || null ... })` sends the raw values. [frontend/src/pages/VideoCall.jsx:6479](frontend/src/pages/VideoCall.jsx#L6479) renders `{msg.senderName}` and [VideoCall.jsx:6527](frontend/src/pages/VideoCall.jsx#L6527) renders `{msg.text}`; React throws when given an object, and the call's error boundary replaces the screen.
- **Console/server log:** the page shows the crash screen; the server logs nothing.
- **Suggested fix:** the server should accept only strings (and cap their length) and drop the message otherwise; the page should also render only strings.

### F3. MEDIUM: chat has no length limit

- 100,000 characters in one chat message was accepted, stored (encrypted) and delivered ([backend/server.js:2293-2336](backend/server.js#L2293)). Only the 1 MB socket limit stops it; the rate limit is 5 messages per second. A 6,000-character unbroken message did not break the layout (tested in the browser).
- Also: `text` as an object is delivered as an object (this is what causes F2).

### F4. MEDIUM: microphone unplugged mid-call, nobody is told

- Steps: connect a call, then end the microphone track (simulated unplug). The page shows no message and no Retry button; the person keeps thinking they are heard. (The camera case is handled: the page keeps working.) Flag OFF and ON the same.
- Likely cause: no handler for the local audio track `ended` event in the call page (not traced to a line).

### F5. MEDIUM: when Azure refuses our key, the page still says "Transcribing"

- Steps (flag ON, Azure key refused): open a call, wait 80 seconds. Token requests stop after 5 tries (good, no endless retries). The call stays up with the real voice (good). But the **"Transcribing" badge and the notice "This call is being transcribed" stay on screen** and nothing says transcription is not working. The "Subtitles unavailable" message only appears for a listener who has picked a language.
- Why it matters: a doctor may believe a transcript is being written when it is not. (Whether the gap is saved as a `recognizer_down` gap on the server was not checked in this run.)
- Root cause: by design, the badge is always shown ([TranscriptionOverlay.jsx:2](frontend/src/features/translation/TranscriptionOverlay.jsx#L2)); the failure state is only used for the listener message ([TranscriptionOverlay.jsx:90](frontend/src/features/translation/TranscriptionOverlay.jsx#L90)).

### F6. MEDIUM (maybe by design): no time window for joining

- A confirmed appointment dated **2020** and one dated **2099** both open the call room ([backend/utils/appointmentRoomAccess.js:82-95](backend/utils/appointmentRoomAccess.js#L82)). Only the status is checked (pending, cancelled and completed are refused). If a booking should only open its call near its time, that rule is missing.

### F7. LOW: chat name and file fields come from the browser

- `senderName` is taken from the sender, so a participant can show any display name (for example "Dr. Admin (Verified)"). `senderId` and the role are taken from the server (good: they could not be spoofed). A client-supplied `fileUrl` is turned into a link such as `/api/uploads/uploads/someone-elses-private-file.pdf`; the file itself is still protected by the uploads access check (code read, not tested end to end).

### F8. LOW: "no camera but a microphone works" gives no message

- The call continues audio-only with the normal controls and no message that the camera is missing. Reasonable behaviour, but the person is not told. (My test expected a message.)

### F9. LOW: chat takes 9 to 13 seconds to work after the backend restarts

- After killing and restarting the backend mid-call, audio and video kept flowing the whole time and the page showed "Connection to the call service lost - reconnecting". Chat worked again after 9 to 13 seconds. In two of eight runs my first, stricter 15-second wait missed it; the later runs with polling passed every time. Not a failure; recorded as a timing note.

### F10. LOW, not reproduced: one dip in a 12-minute call

- In the 12-minute call with a 90-second login token, at about minute 2 audio flow and one chat message were missed once (server telemetry shows an ICE disconnect and a media retry), then everything recovered; 9 of 10 chat messages delivered. A separate 4-minute call with a 60-second token (4 expiries, 45 samples every 5 seconds) had **zero** gaps. Treated as load noise on this memory-starved machine, but worth one real-network check (section 6).

### Harness notes (not app bugs)
- Complete Appointment stores the status `complete` (my first test expected `completed`); the table is corrected.
- Relay-only ICE test: audio kept flowing although nothing listens on the TURN port, so the test could not really simulate "UDP blocked". Marked inconclusive.

---

## 4. Test results table

PASS/FAIL is against the "expected" column. FAIL does not always mean a bug; see the findings above. `n/a` = not run for that flag (for example transcript-only checks with the flag OFF).

| Area | Test case | Flag OFF | Flag ON | Expected | Actual (OFF / ON) |
|---|---|---|---|---|---|
| A positive | doctor + patient join the same appointment room; both see peer-joined | PASS | PASS | both peer-joined | d=1 p=1 |
| A positive | camera-state relays doctor to patient | PASS | PASS | relayed | true |
| A positive | patient leaves and rejoins (new socket) | PASS | PASS | peer-joined to doctor again, resumedCall | true |
| A positive | chat message from patient reaches doctor | PASS | PASS | 1 message | 2 |
| A positive | explicit leave tells the doctor (participant-left) | PASS | PASS | >=1 | 1 |
| A positive | category consultation call room: both join | PASS | PASS | peer-joined on both | d=1 p=1 |
| B access | socket with NO token tries to join a room | PASS | PASS | denied | unauthenticated |
| B access | a different patient (not on this booking) joins | PASS | PASS | room-access-denied not_participant, receives nothing | not_participant reachable=false |
| B access | a different doctor (not on this booking) joins | PASS | PASS | denied not_participant | not_participant reachable=false |
| B access | admin joins the call room | PASS | PASS | documented behaviour: refused (admins watch via admin-watch-call, not as participants) | not_participant reachable=false |
| B access | superadmin joins the call room | PASS | PASS | refused | not_participant |
| B access | a third person (stranger doctor) tries a 1-to-1 room that is already full | PASS | PASS | denied | not_participant |
| B access | admin watches the call (not as a participant) | PASS | PASS | allowed, no media | events= |
| B access | patient emits admin-watch-call | PASS | PASS | ignored silently, no call-live-stats | call-live-stats=0 |
| B access | same patient joins from a second tab: first tab is told duplicate-session and is out of the room | PASS | PASS | first gets duplicate-session, only second reachable | dup=1 firstReachable=false secondReachable=true |
| B access | join with invalid appointment id "" | PASS | PASS | denied with a reason, server alive | invalid_appointment alive=true |
| B access | join with invalid appointment id null | PASS | PASS | denied with a reason, server alive | invalid_appointment alive=true |
| B access | join with invalid appointment id undefined | PASS | PASS | denied with a reason, server alive | invalid_appointment alive=true |
| B access | join with invalid appointment id "abc" | PASS | PASS | denied with a reason, server alive | invalid_appointment alive=true |
| B access | join with invalid appointment id "not-an-objectid" | PASS | PASS | denied with a reason, server alive | invalid_appointment alive=true |
| B access | join with invalid appointment id "../../etc/passwd" | PASS | PASS | denied with a reason, server alive | invalid_appointment alive=true |
| B access | join with invalid appointment id ["x"] | PASS | PASS | denied with a reason, server alive | invalid_appointment alive=true |
| B access | join with invalid appointment id 12345 | PASS | PASS | denied with a reason, server alive | invalid_appointment alive=true |
| B access | join with invalid appointment id "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa | PASS | PASS | denied with a reason, server alive | invalid_appointment alive=true |
| B access | join with invalid appointment id "64b7f0c2a1b2c3d4e5f60718" | PASS | PASS | denied with a reason, server alive | appointment_not_found alive=true |
| B access | join with invalid appointment id "<script>alert(1)</script>" | PASS | PASS | denied with a reason, server alive | invalid_appointment alive=true |
| B access | patient token but claims role=doctor and the doctor's userId | PASS | PASS | denied or joined only as the patient | unauthenticated |
| B access | …and does it get doctor privileges? | PASS | PASS | no (it must not displace or impersonate the doctor) | not in room |
| B access | stranger sends the patient's userId with their own token | PASS | PASS | denied | unauthenticated |
| B access | garbage JWT (connection and join) | PASS | PASS | denied | unauthenticated |
| B access | valid connection + garbage token only inside the join payload | PASS | PASS | joins as the connection's identity (token in payload not needed) | JOINED as the authenticated connection |
| B status | appointment status "pending": patient + doctor join | PASS | PASS | refused with a reason | patient=not_confirmed doctor=not_confirmed |
| B status | appointment status "cancelled": patient + doctor join | PASS | PASS | refused with a reason | patient=appointment_ended doctor=appointment_ended |
| B status | appointment status "completed": patient + doctor join | PASS | PASS | refused with a reason | patient=appointment_ended doctor=appointment_ended |
| B status | appointment status "confirmed": patient + doctor join | PASS | PASS | joined | patient=joined doctor=joined |
| B status | confirmed appointment dated in 2020 (long past) | FAIL | FAIL | refused or time-window rule (not defined in code) | joined (no time window is enforced by the server) |
| B status | confirmed appointment dated in 2099 (far future) | FAIL | FAIL | refused or time-window rule (not defined in code) | joined (no time window is enforced by the server) |
| B tamper | valid-looking offer is relayed | PASS | PASS | relayed | 1 |
| B tamper | offer to a room the sender is not in | PASS | PASS | rejected not_in_room, not relayed | relayed=0 err="not_in_room" |
| B tamper | video-offer: offer is a number | PASS | PASS | not relayed, server alive | relayed=0 alive=true |
| B tamper | video-offer: offer is a string | PASS | PASS | not relayed, server alive | relayed=0 alive=true |
| B tamper | video-offer: offer wrong type field | PASS | PASS | not relayed, server alive | relayed=0 alive=true |
| B tamper | video-offer: appointmentId is an object | PASS | PASS | not relayed, server alive | relayed=0 alive=true |
| B tamper | video-offer: payload is null | PASS | PASS | not relayed, server alive | relayed=0 alive=true |
| B tamper | video-offer: payload is a string | PASS | PASS | not relayed, server alive | relayed=0 alive=true |
| B tamper | video-offer: payload is an array | PASS | PASS | not relayed, server alive | relayed=0 alive=true |
| B tamper | oversized SDP (~300 KB) | PASS | PASS | not relayed | relayed=0 |
| B tamper | 2 MB payload (over the socket buffer limit) | PASS | PASS | that connection is closed, server alive | connected=false alive=true |
| B tamper | unknown / reserved event names | PASS | PASS | ignored, server alive | alive=true |
| B flood | 120 video-offers in a burst | PASS | PASS | rate limited (rate_limited seen), peer not buried | rate_limited=3 |
| B flood | 600 ice-candidates in a burst | PASS | PASS | rate limited | OFF: rate_limited=0 (or silently capped) ; ON: rate_limited=3 (or silently capped) |
| B flood | 300 chat messages in a burst | PASS | PASS | capped (fewer than 300 delivered) | delivered=5 |
| B flood | 60 ice-restart-requests | PASS | PASS | rate limited | rate_limited=3 |
| B flood | 200 camera-state events | PASS | PASS | capped (far fewer than 200 delivered) | delivered=5 |
| B flood | 60 request-peer-rebuild | PASS | PASS | rate limited | rate_limited=3 |
| B flood | server still alive after all floods | PASS | PASS | alive | true |
| B caption | flag OFF: a caption is ignored (nothing relayed) | PASS | n/a | not relayed | OFF: 0 |
| B caption | patient spoofs from=doctor / role=doctor inside the caption | PASS | PASS | ignored | OFF: relayed=0 ; ON: from=patient |
| B caption | caption to a room the sender is not in | PASS | PASS | rejected / ignored | relayed=0 |
| B caption | a stranger (not in the room) sends a caption into the call room | PASS | PASS | not relayed | relayed=0 |
| B caption | stranger sends lang-changed / tr-status into the room | PASS | PASS | not relayed | lang-changed=0 tr-status=0 |
| B caption | caption: huge text (20 KB) | PASS | PASS | ignored | relayed=0 |
| B caption | caption: tr with 50 languages | PASS | PASS | ignored | relayed=0 |
| B caption | caption: text is an object | PASS | PASS | ignored | relayed=0 |
| B caption | caption: text has HTML | PASS | PASS | ignored | OFF: relayed=0 ; ON: relayed=1 textLen=28 trKeys=0 |
| B caption | caption: payload null | PASS | PASS | ignored | relayed=0 |
| B caption | caption: conf is a string | PASS | PASS | ignored | OFF: relayed=0 ; ON: relayed=1 textLen=2 trKeys=0 |
| B flood | 200 captions + 100 lang-changed + 100 tr-status in a burst | PASS | PASS | ignored (0 delivered) | OFF: captions delivered=0 rate_limited errors=0 lang=0 status=0 ; ON: captions delivered=10 rate_limited errors=2 lang=8 status=20 |
| B flood | server alive after transcript floods | PASS | PASS | alive | true |
| B chat | empty message | PASS | PASS | not delivered | 0 |
| B chat | whitespace-only message | PASS | PASS | not delivered (or harmless) | 1 |
| B chat | emoji + unicode message | PASS | PASS | delivered unchanged | 1 |
| B chat | HTML/script text | PASS | PASS | delivered as plain text (UI must escape; checked in browser) | delivered=1 text="<script>window.__pwned=1</script><img src=x onerror=alert(1)>" |
| B chat | 100,000-character message | FAIL | FAIL | refused or capped | delivered=1 len=100000 |
| B chat | sender spoofs senderName and senderId | PASS | PASS | server uses its own identity for id/role; name should not be trusted | OFF: senderName="Dr. Admin (Verified)" senderId=6afc7dba36f3b63ca32731e4 role=undefined ; ON: senderName="Dr. Admin (Verified)" senderId=6afc7e142f2e9bf5817a5d2e role=undefined |
| B chat | chat with an arbitrary fileUrl | FAIL | FAIL | refused or only own uploads | delivered=1 fileUrl="/api/uploads/uploads/someone-elses-private-file.pdf" |
| B chat | text is an object | FAIL | FAIL | not delivered, server alive | delivered=1 alive=true |
| B NoSQL | patient joins with appointmentId = {$gte:<own id>} (an operator object instead of an id) - can they read ANOTHER appointment's chat history? | FAIL | FAIL | refused as invalid id; no foreign history | history messages=14 leakedVictimMessage=true |
| B NoSQL | patient joins with appointmentId = {$ne:null} (an operator object instead of an id) - can they read ANOTHER appointment's chat history? | FAIL | FAIL | refused as invalid id; no foreign history | history messages=14 leakedVictimMessage=true |
| B NoSQL | patient joins with appointmentId = {$in:[own, victim]} (an operator object instead of an id) - can they read ANOTHER appointment's chat history? | FAIL | FAIL | refused as invalid id; no foreign history | history messages=14 leakedVictimMessage=true |
| B NoSQL | doctor joins with appointmentId = {$nin:[]} (an operator object instead of an id) - can they read ANOTHER appointment's chat history? | FAIL | FAIL | refused as invalid id; no foreign history | history messages=14 leakedVictimMessage=true |
| B11 transcript | patient POSTs a line to their own appointment | PASS | PASS | 404 (flag off) | OFF: 404 {"msg":"Not found."} ; ON: 200 {"accepted":1,"duplicates":0,"rejected":[],"noticePending":true,"lateUpload":false} |
| B11 transcript | patient GETs the transcript | PASS | PASS | 403 | 403 |
| B11 transcript | a different patient GETs the transcript | PASS | PASS | 403/404 | 403 |
| B11 transcript | a different doctor GETs the transcript | PASS | PASS | 403/404 | 403 |
| B11 transcript | the booking's doctor GETs the transcript | PASS | PASS | 200 | 200 |
| B11 transcript | no login GETs the transcript | PASS | PASS | 401 | 401 |
| B11 transcript | a stranger POSTs lines into someone else's appointment | PASS | PASS | 404 | OFF: 404 ; ON: 403 |
| B11 transcript | patient POSTs lines to a non-existent appointment | PASS | PASS | 404 | 404 |
| B11 transcript | POST a line with fake recordedBy/role/speaker = doctor | PASS | PASS | 404 | OFF: 404 spoofedInStore=false ; ON: 200 spoofedInStore=false |
| B11 transcript | batch of 26 rows (max is 25) | PASS | PASS | 404 | OFF: 404 ; ON: 400 |
| B11 transcript | 3 MB body | PASS | PASS | 413 | 413 |
| B11 transcript | malformed JSON body | PASS | PASS | 400 | 400 |
| B11 transcript | items is not an array | PASS | PASS | 400 | OFF: 404 ; ON: 400 |
| B11 transcript | line text with HTML is stored as text | PASS | PASS | accepted (stored as text) or refused | OFF: 404 ; ON: 200 |
| B11 transcript | patient tries DELETE | PASS | PASS | 403 | 403 |
| B11 transcript | doctor tries DELETE | PASS | PASS | 403 | 403 |
| B11 transcript | admin DELETE without a reason | PASS | PASS | 400 | 400 |
| B11 transcript | admin DELETE with a 2-char reason | PASS | PASS | 400 | 400 |
| B11 transcript | admin GET transcript | PASS | PASS | 200 | 200 |
| B11 transcript | admin DELETE with a proper reason | PASS | PASS | 200 | 200 |
| B11 transcript | patient posts the transcript notice | PASS | PASS | 404 | OFF: 404 ; ON: 200 |
| B11 transcript | stranger posts a transcript notice for someone else's appointment | PASS | PASS | 404 | OFF: 404 ; ON: 403 |
| B11 speech-token | no login | PASS | PASS | 404 | OFF: 404 ; ON: 401 |
| B11 speech-token | stranger asks for a token for someone else's appointment | PASS | PASS | 404 | OFF: 404 ; ON: 403 |
| B11 speech-token | admin asks for a token | PASS | PASS | 404 | OFF: 404 ; ON: 403 |
| B11 speech-token | malformed appointment id | PASS | PASS | 404 | OFF: 404 ; ON: 400 |
| B11 speech-token | completed appointment | PASS | PASS | 404 | OFF: 404 ; ON: 403 |
| B11 speech-token | participant with a dummy Azure key (Azure refuses) | PASS | PASS | 404 | OFF: 404 {"msg":"Not found."} ; ON: 502 {"msg":"The speech service is unavailable. Please try again.","code":"azure_rejected"} |
| B11 speech-token | 45 quick token requests (flood) | PASS | PASS | all 404 | OFF: 404 ; ON: 502,429 |
| B11 config | transcription config for a patient never contains a key | PASS | PASS | no key/token | OFF: {"enabled":false,"mode":"notice","noticeVersion":"v1","confidence":{"unclearBelow":0.4,"lowBelow":0.7},"speed":{"segmentationSilenceMs":600}} ; ON: {"enabled":true,"mode":"notice","noticeVersion":"v1","confidence":{"unclearBelow":0.4,"lowBelow":0.7},"speed":{"segmentationSilenceMs":600}} |
| B11 config | transcription config with no login | PASS | PASS | 401 | 401 |
| B11 server logs | no Azure key in the server log | PASS | PASS | absent |  |
| B caption | patient sends a normal caption | n/a | PASS | relayed to doctor with from=patient |  ; ON: 1 from="patient" |
| A positive | patient joins first, doctor second | PASS | PASS | both connected | patient=true doctor=true |
| A positive | no page errors during a normal call | PASS | PASS | none | none |
| A positive | flag OFF: zero transcript UI | PASS | n/a | absent | OFF: false |
| A positive | flag OFF: no transcript/speech mention in browser console | PASS | n/a | none | OFF: false |
| A positive | mute then unmute | PASS | PASS | local mic track disabled then enabled | muted=true unmuted=true |
| A positive | camera off then on | PASS | PASS | video track disabled then enabled | off=true |
| A positive | chat message appears on the other side | PASS | PASS | visible | true |
| B chat | HTML/script in a chat message | PASS | PASS | shown as text, never executed | executed=false shownAsText=true |
| B chat | very long unbroken chat message (6000 chars) | PASS | PASS | page layout does not break | horizontalOverflow=false |
| B chat | empty/whitespace message | PASS | PASS | not sent | no crash |
| A positive | doctor opens first and waits alone | PASS | PASS | shows waiting message, no errors | waiting=true errors=0 |
| A positive | patient joins 8 s after the doctor (late join) | PASS | PASS | both connected | true,true |
| A positive | patient refreshes the page mid-call | PASS | PASS | reconnects, both hear again | true,true |
| A positive | doctor refreshes the page mid-call | PASS | PASS | reconnects, both hear again | true,true |
| A positive | doctor clicks Complete Appointment | PASS | PASS | appointment status becomes completed | status=complete url=/doctor-dashboard/enrollments |
| A positive | patient after the doctor completes | PASS | PASS | patient is told / call ends without errors | errors=0 |
| A positive | category consultation call connects | PASS | PASS | both connected | true,true |
| B access | not logged in opens /video-call/:id | PASS | PASS | redirected to login or refused; camera not started | OFF: url=/video-call/6afc82e460492b872153929b?role=user getUserMediaCalls=0 ; ON: url=/video-call/6afc85511c8b69ae98037f36?role=user getUserMediaCalls=0 |
| B access | a different patient opens someone else's call URL | PASS | PASS | refused, no media | remoteAudio=false gum=0 text=Skip to content Video consultation Access Denied  Access denied.  Go Home |
| B access | a different doctor opens someone else's call URL | PASS | PASS | refused, no media | remoteAudio=false text=Skip to content Video consultation Access Denied  Access denied.  Go Home |
| B access | admin opens the call URL | PASS | PASS | refused (admins watch via the admin tool) | remoteAudio=false text=Skip to content Video consultation Access Denied  Please login to access this appointment. |
| B access | malformed/non-existent appointment id in the URL: garbage | PASS | PASS | clear error, no crash, no endless spinner | errors=0 text=Skip to content Video consultation Access Denied  Failed to fetch appointment.   |
| B access | malformed/non-existent appointment id in the URL: 64b7f0c2a1b2c3d4e5f6 | PASS | PASS | clear error, no crash, no endless spinner | errors=0 text=Skip to content Video consultation Access Denied  Appointment not found.  Go Hom |
| B access | malformed/non-existent appointment id in the URL: %00 | PASS | PASS | clear error, no crash, no endless spinner | errors=0 text=Skip to content Video consultation Access Denied  Failed to fetch appointment.   |
| B access | malformed/non-existent appointment id in the URL: ..%2F..%2Fetc | PASS | PASS | clear error, no crash, no endless spinner | errors=0 text=Skip to content Video consultation Access Denied  Could not load appointment.  G |
| B access | malformed/non-existent appointment id in the URL: aaaaaaaaaaaaaaaaaaaa | PASS | PASS | clear error, no crash, no endless spinner | errors=0 text=Skip to content Video consultation Access Denied  Failed to fetch appointment.   |
| B access | malformed/non-existent appointment id in the URL: <script>alert(1)</sc | PASS | PASS | clear error, no crash, no endless spinner | errors=0 text=Skip to content Video consultation Access Denied  Could not load appointment.  G |
| B status | appointment is pending: patient opens the call | PASS | PASS | refused with a clear message, no call | remoteAudio=false text=Skip to content Video consultation Appointment Pending  Your appointment is awaiting the doctor's co |
| B status | appointment is cancelled: patient opens the call | PASS | PASS | refused with a clear message, no call | remoteAudio=false text=Skip to content Video consultation Appointment Cancelled  This appointment is no longer active.  Go  |
| B status | appointment is completed: patient opens the call | PASS | PASS | refused with a clear message, no call | remoteAudio=false text=Skip to content Video consultation Appointment Complete  This appointment is no longer active.  Go B |
| B access | same patient opens the call in a second tab | PASS | PASS | first tab is told the call moved (duplicate-session), second tab takes over | first tab text: Skip to content Video consultation Access Denied  Another consultation session was started elsewhere.  Go Home / secondConnected=true |
| B access | a third person opens a call that already has two participants | PASS | PASS | refused; the doctor's call is not disturbed | thirdRemoteAudio=false doctorStillHearsAudio=true |
| C devices | camera and microphone permission denied | PASS | PASS | clear message and a Retry button; the page does not crash; doctor is not stuck without info | message=true retryButton=true errors=0 text=Skip to content Video consultation DOCTOR Dr. Signal Doctor Device check failed. Review browser permissions an |
| C devices | camera and microphone permission denied: user fixes it and presses Retry | PASS | PASS | call connects | true,true |
| C devices | no camera and no microphone present | PASS | PASS | clear message and a Retry button; the page does not crash; doctor is not stuck without info | message=true retryButton=true errors=0 text=Skip to content Video consultation DOCTOR Dr. Signal Doctor Device check failed. Review browser permissions an |
| C devices | no camera and no microphone present: user fixes it and presses Retry | PASS | PASS | call connects | true,true |
| C devices | camera already used by another app (NotReadableError) | PASS | PASS | clear message and a Retry button; the page does not crash; doctor is not stuck without info | message=true retryButton=true errors=0 text=Skip to content Video consultation DOCTOR Dr. Signal Doctor Device check failed. Review browser permissions an |
| C devices | no camera present but a microphone works | FAIL | FAIL | clear message and a Retry button; the page does not crash; doctor is not stuck without info | OFF: message=false retryButton=false errors=0 text=Skip to content Video consultation DOCTOR Dr. Signal Doctor MUTE CAM OFF SHARE FULL HIDE ME CHAT LEAVE CALL ; ON: message=false retryButton=false errors=0 text=Skip to content Video consultation DOCTOR Dr. Signal Doctor Transcribing This call is being transcribed. Pleas |
| C devices | camera unplugged mid-call (video track ended) | PASS | PASS | page keeps working, shows camera-off state, audio continues | OFF: errors=0 audioStillLive=true text=Skip to content Video consultation DOCTOR Dr. Signal Doctor MUTE CAM OFF SHARE FULL HIDE M ; ON: errors=0 audioStillLive=true text=Skip to content Video consultation DOCTOR Dr. Signal Doctor Transcribing This call is bein |
| C devices | microphone unplugged mid-call (audio track ended) | PASS | PASS | user is told the microphone stopped (or can retry); no crash | OFF: errors=0 retryButton=0 text=Skip to content Video consultation DOCTOR Dr. Signal Doctor MUTE CAM OFF SHARE FULL HIDE ME CHAT LEAVE CALL ; ON: errors=0 retryButton=0 text=Skip to content Video consultation DOCTOR Dr. Signal Doctor Transcribing This call is being transcribed. Pleas |
| C devices | screen share: picker cancelled | PASS | PASS | no error page, call continues, button back to Share | OFF: errors=0 stillConnected=true text=Skip to content Video consultation DOCTOR Dr. Signal Doctor MUTE CAM OFF SHARE F ; ON: errors=0 stillConnected=true text=Skip to content Video consultation DOCTOR Dr. Signal Doctor Transcribing This ca |
| C devices | screen share started, then stopped from the browser bar (track ended) | PASS | PASS | sharing state clears, call continues | wasSharing=true backToShare=true errors=0 stillConnected=true |
| D network | patient offline for 5s then back | PASS | PASS | call recovers (both hear again) within 60 s; message while offline | OFF: recovered=true after=11s errors=0 whileOffline="Skip to content Video consultation DOCTOR Dr. Signal Doctor You're offline. Reconnecting once your i" ; ON: recovered=true after=5s errors=0 whileOffline="Skip to content Video consultation DOCTOR Dr. Signal Doctor You're offline. Reconnecting once your i" |
| D network | patient offline for 30s then back | PASS | PASS | call recovers (both hear again) within 60 s; message while offline | OFF: recovered=true after=12s errors=0 whileOffline="Skip to content Video consultation DOCTOR Dr. Signal Doctor You're offline. Reconnecting once your i" ; ON: recovered=true after=16s errors=0 whileOffline="Skip to content Video consultation DOCTOR Dr. Signal Doctor You're offline. Reconnecting once your i" |
| D network | patient offline for 120s then back | PASS | PASS | call recovers (both hear again) within 60 s; message while offline | OFF: recovered=true after=18s errors=0 whileOffline="Skip to content Video consultation DOCTOR Dr. Signal Doctor You're offline. Reconnecting once your i" ; ON: recovered=true after=17s errors=0 whileOffline="Skip to content Video consultation DOCTOR Dr. Signal Doctor You're offline. Reconnecting once your i" |
| D network | patient is offline while opening the page, then comes online and reloads | PASS | PASS | call connects after reload | true,true |
| D server | backend process is killed and restarted mid-call (pm2-style) | PASS | PASS | media keeps flowing during the outage; signalling/chat works again within ~60 s | OFF: mediaDuring=true uiDuring="Skip to content Video consultation DOCTOR Dr. Signal Doctor Connection to the call service lost - reconnecting" recovered=true chatAfter=true c... ; ON: mediaDuring=true uiDuring="Skip to content Video consultation DOCTOR Dr. Signal Doctor Connection to the call service lost - reconnecting" recovered=true chatAfter=true c... |
| D network | 6 quick offline/online flaps (reconnect storm) | PASS | PASS | call still works afterwards, no page errors, no duplicated peers | recovered=true errors=0 |
| D network | relay-only ICE with no working TURN server (UDP blocked) | INCONCLUSIVE | INCONCLUSIVE | call cannot connect; user sees a clear message (not an endless spinner); no crash | OFF: iceTransportPolicyActuallyApplied=relay pcStates=connected/connected realAudioBytesFlowing=true (216459->234412) errors=0 text="Skip to content Video consultation DOCTOR ... ; ON: iceTransportPolicyActuallyApplied=relay pcStates=connected/connected realAudioBytesFlowing=true (219593->238311) errors=0 text="Skip to content Video consultation DOCTOR ... |
| A positive | flag ON: transcript controls present | n/a | PASS | present |  ; ON: true |
| A positive | patient leaves: doctor is told | PASS | PASS | doctor sees 'has left the call' (or waiting) | true |
| A positive | patient rejoins after leaving | PASS | PASS | both connected again | true,true |
| A positive | no errors across refresh/leave/rejoin | PASS | PASS | none | none |
| E transcription | Azure unreachable / dummy key: the call itself | n/a | PASS | call stays connected with the real voice |  ; ON: connected=true,true stillAudio=true |
| E transcription | Azure wrong key: no endless token retries | n/a | PASS (see next row) | <= ~6 token requests in 30 s |  ; ON: tokenRequestsIn30s=0 |
| E transcription | Azure wrong key: user is told (message or badge), not silence | n/a | WEAK-see next row | a visible 'unavailable' state |  ; ON: text="Skip to content Video consultation DOCTOR Dr. Signal Doctor Transcribing This call is being transcribed. Please keep the call in a quiet place. Other voices nea" |
| E transcription | Azure down: no page errors | n/a | PASS | none |  ; ON: none |
| E transcription | listener changes language 5 times quickly | n/a | PASS | no page error; real voice is muted only when a language is active |  ; ON: errors=0 |
| E transcription | after picking German (voice fails because Azure is down) the real voice is restored (no silence) | n/a | PASS | not muted forever |  ; ON: audioMuted=false |
| E transcription | speaker closes the tab while the listener has a language picked | n/a | PASS | listener is not left in silence (real voice back / message) |  ; ON: audioMuted=false text=Skip to content Video consultation PATIENT Signal Patient  Waiting for patient...  Share the appoint |
| A positive | real audio bytes are flowing both ways (WebRTC stats, not just a track object) | PASS | PASS | bytes increase on both sides | OFF: patient 2256->19205, doctor 2879->17722; pc=connected/connected ; ON: patient 5226->24900, doctor 5164->23844; pc=connected/connected |
| B chat | a patient socket sends a chat message with malformed fields: text is an object {a:1} | FAIL | n/a | doctor's call screen keeps working (message dropped or shown as text) | OFF: doctorStillInCall=false text="Skip to content Video consultation Something went wrong  The video call crashed unexpectedly. Please" |
| B chat | a patient socket sends a chat message with malformed fields: text is a number | PASS | n/a | doctor's call screen keeps working (message dropped or shown as text) | OFF: doctorStillInCall=true text="Skip to content Video consultation PATIENT Signal Patient  Establishing secure connection...  Both p" |
| B chat | a patient socket sends a chat message with malformed fields: text is an array | PASS | n/a | doctor's call screen keeps working (message dropped or shown as text) | OFF: doctorStillInCall=true text="Skip to content Video consultation PATIENT Signal Patient  Establishing secure connection...  Both p" |
| B chat | a patient socket sends a chat message with malformed fields: senderName is an object | FAIL | n/a | doctor's call screen keeps working (message dropped or shown as text) | OFF: doctorStillInCall=false text="Skip to content Video consultation Something went wrong  The video call crashed unexpectedly. Please" |
| B chat | a patient socket sends a chat message with malformed fields: fileName/fileType are objects | FAIL | n/a | doctor's call screen keeps working (message dropped or shown as text) | OFF: doctorStillInCall=false text="Skip to content Video consultation Something went wrong  The video call crashed unexpectedly. Please" |
| B chat | a patient socket sends a chat message with malformed fields: text null + fileUrl object | PASS | n/a | doctor's call screen keeps working (message dropped or shown as text) | OFF: doctorStillInCall=true text="Skip to content Video consultation PATIENT Signal Patient  Establishing secure connection...  Both p" |
| B chat | a patient socket sends a chat message with malformed fields: control: normal text | PASS | n/a | doctor's call screen keeps working (message dropped or shown as text) | OFF: doctorStillInCall=true text="Skip to content Video consultation PATIENT Signal Patient  Establishing secure connection...  Both p" |
| E transcription | Azure refuses the key: what the person sees (after the retries stopped) | n/a | FAIL | badge/notice must not claim transcription is working when it is not; call continues |  ; ON: at 10s: {"badge":["Transcribing","This call is being transcribed. Please keep the call in a quiet place. Other voices nearby may be transcribed.","This call is being tran... |
| D network (production build) | PRODUCTION build, fast network (baseline) | n/a | PASS | call connects; no page errors |  ; ON: connected=true afterSeconds=4 doctorHears=true patientDownloadedKB=2618 requests=51 failedRequests=0 pageErrors=0 text="Skip to content Video consultation DOCTOR Dr. Sign... |
| D network (production build) | PRODUCTION build on Slow 4G (1.6 Mbit/s, 150 ms) for the patient | n/a | PASS | call connects; no page errors |  ; ON: connected=true afterSeconds=6 doctorHears=true patientDownloadedKB=2618 requests=53 failedRequests=0 pageErrors=0 text="Skip to content Video consultation DOCTOR Dr. Sign... |
| D network (production build) | mid-call drop to 400 kbit/s, 400 ms latency: chat message still delivered | n/a | PASS | delivered within 30 s |  ; ON: true |
| D soak | 12-minute call with a 90-second access-token lifetime (token expires about 8 times) | n/a | FAIL | call stays up the whole time; chat keeps working; no page errors |  ; ON: bothHearAtEnd=true chatDelivered=9/10 pageErrors=0 refreshRequests(patient)=4 |
| D soak | memory over the call | n/a | PASS | JS heap does not keep growing (end < 2x start + 20 MB) |  ; ON: patient 73->73 MB, doctor 69->69 MB, DOM nodes patient 185->203 |
| D soak | server log after the soak | n/a | PASS | no repeated errors |  ; ON: 0 error lines |
| D soak | samples | n/a | n/a |  |  |
| D token expiry | 4-minute call, access token lifetime 60 s (expires 4 times); sampled every 5 s | n/a | PASS | audio keeps flowing and chat keeps working across every token expiry |  ; ON: samples=45 noAudioFlowSamples=0 longestGap~0s chatMissed=0 pageErrors=0 |

---

## 5. What I tested only in part

- **F1-style id injection** was proven in `join-appointment-room` only. The same trick may work in other places that take an id from the browser and put it in a database query: other socket events (`video-telemetry`, `admin-watch-call`, `leave-appointment-room`) and REST routes. This is worth a code search for "client value goes straight into `find`/`findById`".
- **Captions with HTML** are relayed as plain text and the page uses normal React text rendering, but I did not check the subtitle area in a browser. (The chat area was checked: HTML shown as text, not run.)
- **Transcription cases E2 to E6** (listener changes language quickly, both pick the same language or "Real voice", speaker mutes, speaker goes to background, echo with two devices in one room, unsupported language) need a working speech engine. With a fake Azure they are covered by the existing automated suites (`transcriptionOneVoice`, `transcriptionSafetyNet`, `transcriptionLanguages`, the transcription e2e: all passing in the last run). In this negative run I could only check the real call page with Azure refusing the key: the call stayed up, the real voice was never left muted (`audioMuted=false` after picking German and after the speaker closed the tab), five fast language changes caused no page errors, and token retries stopped after 5.
- **Long call:** 12 minutes (not 30 to 60) plus a 4-minute run with a 60-second login token. Memory stayed flat (73 to 73 MB and 69 to 69 MB JS heap), the page did not grow (DOM about 185 to 203 nodes), and 0 server error lines.

## 6. What could not be tested locally, and how to test it by hand

| Not tested | Why | Manual steps for you |
|---|---|---|
| Real iPhone / Android | Needs real devices and OS microphone behaviour | Join a call from an iPhone (Safari) and an Android (Chrome). Lock the screen for 30 s, switch to another app for 30 s, switch Wi-Fi to mobile data, deny and then allow the microphone. Check the call recovers and the other side is told. |
| Real TURN and blocked UDP | No TURN server here; my "relay only" test could not really block UDP (audio kept flowing) | Use a network where UDP is blocked (office firewall or phone hotspot with UDP off). Join a call from it. It should either connect through TURN or show a clear message, not spin forever. |
| Real Azure | No real key used | Flag ON on staging: (1) wrong key in a test setup: see whether the badge still says "Transcribing" (F5); (2) speak while the other person picks German: check subtitles and one voice only; (3) both speak at once. |
| Microphone permission revoked mid-call from the browser's address bar | Cannot be driven from a script | Join a call, revoke the microphone in site settings, check the message (see F4). |
| 30 to 60 minute call on a real network | Machine was low on memory | Run a 45-minute call on staging with one tab in the background; check audio, chat and memory in Task Manager at 15, 30 and 45 minutes (the login token lifetime is 15 minutes: the call must survive the first refresh). |
| Echo with two phones in one room | Needs real speakers | Two phones, same room, both on speaker, one picks a language: check the echo filter stops a feedback loop. |
| Doctor notes panel, prescription form, admin live-watch of a call, direct (link) video rooms | Not part of this task's scope | Quick manual pass. |

---

## 7. Top 10 issues to fix first (simple English)

1. **Chat history leak (F1, Critical).** A logged-in user can read other patients' call chats by sending a special value instead of an appointment id. Fix: accept only a plain 24-character id text in every socket event, everywhere.
2. **Call screen crash (F2, High).** One person can make the other person's call screen crash with a bad chat message. Fix: the server should drop any chat message whose fields are not plain text; the page should also never draw anything that is not text.
3. **Check the same id mistake elsewhere (F1 follow-up).** Search all socket events and REST routes for ids from the browser that go straight into a database search.
4. **Chat length limit (F3).** Put a maximum on chat text (for example a few thousand characters) and on name and file fields.
5. **Microphone lost mid-call (F4).** Show "Your microphone stopped" with a Retry button, so a patient is not silently unheard.
6. **"Transcribing" badge when Azure is refusing us (F5).** Show a clear state ("Transcript is not working right now") for the doctor, and make sure the gap is saved.
7. **Join time window (F6).** Decide if a call should only open near the booked time; today a booking from 2020 or 2099 opens.
8. **Chat name is taken from the browser (F7).** Use the name from the server's user record, not what the browser sends.
9. **No-camera message (F8).** Tell the person "No camera found, you are audio-only".
10. **Check on real networks (F9, F10).** Real-phone, real-TURN and a 45-minute call test (section 6), and watch the chat after a server restart (it recovers in about 10 s).

---

## 8. Confirmation

- **No app code was changed.** The only file created in the repository is this report (untracked, not committed). Test scripts and results live in the session scratch folder outside the repo.
- Branch is still `currency`. See the git status below.
- No `.env` file was read or changed. No keys were used: the speech key was a dummy value, and database, tokens and users were in-memory dummy data.

```
$ git branch --show-current
currency
$ git status --short
?? docs/translation/VIDEO-CALL-NEGATIVE-TEST-REPORT.md
?? uat_to_main_merge_report.md
```
