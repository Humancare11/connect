After you finish the step 3 changes I asked for (admin/doctor read + admin delete work even when the flag is off, clientShownAt, lateUpload) and commit step 3, CONTINUE WITH STEPS 4 TO 10 WITHOUT WAITING FOR ME. I am away until tomorrow. Work through them one after another.

=====================================================================
RULES FOR EVERY STEP (do not break these)
=====================================================================
1. Branch: only `currency`. Before each step run `git branch --show-current`. If it is not `currency`, STOP everything and write it in the report.
2. Never create, switch, checkout, merge, rebase or delete a branch. Never push, never open a PR.
3. After each step: run the new tests + the full backend suite (and frontend tests/build when you touched the frontend). If the step's own tests pass, COMMIT that step locally (only that step's files; never docs/translation/, never backend/.env or any .env). Then go to the next step.
4. If a step's own tests fail and you cannot fix them in a reasonable time: do NOT commit it, write exactly what is wrong in the report, and STOP. Do not start the next step on top of broken work.
5. The 2 known unrelated failures (liveChatWidgetStatic, search-taxonomy plan integrity) are fine. Any NEW failure outside our feature means STOP and report.
6. Everything stays behind the feature flag, OFF by default (backend TRANSCRIPTION_ENABLED and the frontend flag). With the flag off, the app must behave exactly as today. Prove this with tests.
7. Never log caption text, transcript text, the Azure key or tokens. Keep the log-scan tests.
8. Do not deploy anything, do not touch any server, do not run database migrations against real databases, do not change the real .env.
9. If you need a decision from me: choose the SAFEST option that follows the decisions below (rule of thumb: "always save the data, add a flag, never lose proof"), write the decision and the reason in the report under "Decisions I made for you", and continue.
10. Keep VideoCall.jsx changes small and isolated (hooks/components in src/features/translation/). Do not refactor unrelated code. DirectVideoCall.jsx is out of scope.

=====================================================================
REPORT FILE (I will read this tomorrow)
=====================================================================
Keep updating docs/translation/PROGRESS-REPORT.md (it is untracked, do not commit it). For each step write:
- status (done + committed / stopped), commit hash
- files added/changed (short diffstat)
- tests: new tests count, full suite numbers, frontend build result
- what I should check or decide (in simple English)
- "Decisions I made for you" with reasons
At the end add: what is left for manual testing on real devices (iPhone, Android, laptop) with step-by-step instructions, and the exact way to turn the feature on in staging.

=====================================================================
DECISIONS ALREADY MADE (follow all of them)
=====================================================================
- Speaker-side recognition: each browser recognizes ITS OWN mic, sends captions over the socket. No remote-stream recognition.
- Azure Speech Translation only (Option A), continuous language detection only, recognizer starts at call join and is never restarted mid-speech. Targets are added/removed on the running recognizer.
- Default for everyone: "Real voice (no translation)": original voice, no subtitles, no translated voice. Subtitles + translated voice only after a person picks a language in the LANGUAGE panel.
- Transcript is ALWAYS recorded in the background (our proof), also when subtitles/voice are off. Record language is English (original + English version).
- Candidate builder: always fill 10 slots: browser languages (exact locale, e.g. en-IN), the picked language, patient profile country, then common languages (include hi-IN and other Indian languages). Never two locales of the same language. Low-confidence safety net switches a wrongly set language to detection.
- Confidence tiers: >=0.7 normal; 0.4-0.7 saved and shown live as lighter "unclear" subtitle; <0.4 saved and flagged, not shown live, not spoken. Thresholds from env.
- Language outside the list / one of the 15 languages without speech support: keep them in the list, flag the line, doctor sees "Patient's speech in this language cannot be transcribed." Remove jv (Javanese) as a target.
- No automatic mic pause. Mute pauses the recognizer (gate, no restart) and records a gap. Never override the user's own MUTE.
- Echo: echoCancellation on, echo filter v2 (character trigrams, keep combining marks, overlap with own voice playing + match or conf <0.5), echo lines saved flagged and hidden, never deleted. Echo circuit breaker turns off that listener's translated voice if many echo lines appear. No "use headphones" hint.
- Stall detector (no audio chunks >2 s while not muted), audio-context interrupted, track mute/ended, page visibility: record as gap with reason, auto-recover where possible.
- Voice: one-at-a-time queue, never overlapping, drop stale items; played through our audio context unlocked when the language is picked; duck the other person's real voice with a gain node (iPhone ignores audio.volume).
- Token: refresh ~60 s before expiresInSeconds runs out, never per sentence.
- Speech SDK from npm (microsoft-cognitiveservices-speech-sdk), lazy-loaded with dynamic import() only when needed (CSP blocks CDNs). No blob: audio elements.
- Notice: shown to both when the call starts: "This call is being transcribed." plus "Please keep the call in a quiet place. Other voices nearby may be transcribed." Notice POST retries with exponential backoff, stops on 403/404/flag off, restarts on reload. Notice/consent switch stays "notice".
- Small always-visible "Transcribing" badge. "Machine-translated, may contain errors" on screen and in saved transcript.
- Doctor hint: when the patient's caption language is not the doctor's language: "Patient is speaking <language>. Turn on translation?"
- "Subtitles unavailable, reconnecting…" when Azure drops; call continues; gap recorded.
- Transcript visible ONLY in the doctor dashboard (that booking's doctor) and admin dashboard. Never to patients. Admin/superadmin delete with reason. Audit every read/delete (TranscriptAccessLog).
- Transcript upload: batches of max 25 rows, halve on 413, retry with backoff, final flush on leave. Never lose lines.
- Both booking types (Appointment + CategoryConsultation). Web only. Mobile app later.
- Captions and lang-changed over Socket.IO: validated (size, rate, room), sender identity from the socket, never logged. Re-send language on peer-joined and reconnect.
- LANGUAGE and TRANSCRIPT buttons in the desktop control bar and in the mobile drawer (CallMoreMenu.jsx). Match the existing dark theme and hc-vc__btn styles.

=====================================================================
STEPS (in this order)
=====================================================================
STEP 4 - Settings: backend + frontend feature flag (off by default) and the notice/consent switch (notice). Tests that flag off = today's behavior.
STEP 5 - Socket events: lang-changed and caption (partial + final), validation, rate limits, room check, never logged, log-scan test.
STEP 6 - Engine and hook in src/features/translation/: own-mic push stream, candidate builder, continuous detection, targets add/remove without restart, confidence tiers, echo filter v2 + circuit breaker, stall detector + recovery + gap events, mute gate, token refresh, reconnect message, caption sender/receiver, voice queue + ducking, clipping telemetry, notice retry, batched transcript upload. Unit tests with the SDK mocked.
STEP 7 - UI: LanguageButton, LanguagePanel ("Real voice (no translation)" first and default, search, toggles, unsupported-language note), Subtitles (lighter "unclear" style), notice, Transcribing badge, disclaimer, doctor hint, reconnecting message. Component tests.
STEP 8 - Call screen integration in VideoCall.jsx and CallMoreMenu.jsx: local mic into the recognizer, MUTE hook, mic track swaps, socket wiring. Everything only when the flag is on. Tests + frontend build.
STEP 9 - Dashboards: read-only transcript view in the doctor dashboard and admin dashboard (flags shown: unclear, echo, noticePending, lateUpload, gaps, language not supported), admin delete with reason and confirmation.
STEP 10 - Automated testing: unit, API, e2e with the existing Playwright call harness (two browsers, different languages, Chrome fake audio), both booking types, patient access denied, audit entries, flag off = no change, Azure-down/token-expiry/peer-refresh cases. Then write the manual device test checklist (iPhone, Android, laptop) and the staging enable steps into the report.

When all steps are done (or you stopped), make sure PROGRESS-REPORT.md is complete and `git status` is clean except docs/translation/.
