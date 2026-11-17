// The live transcript / translation engine for ONE call. Plain JavaScript (the React hook is a thin wrapper), so it can be tested end to end.
//
// What it does for this person, for the whole call:
//   • shows the "this call is being transcribed" notice record to the server (retrying until it is recorded);
//   • listens to THEIR OWN microphone with Azure, translating into English (the record) and into the language the other person reads;
//   • sends each sentence to the other person as a caption, and saves it (with its English record) to the server, always;
//   • receives the other person's captions: subtitles and the translated voice, only if this person picked a language;
//   • records every stretch where nothing was transcribed (mute, stalled mic, Azure down) as a gap.
//
// Safe by construction: nothing here ever throws into the call, nothing is logged, nothing is kept in browser storage, and when the
// feature is off the engine is simply never created.
import { buildCandidateLocales } from "./candidates.js";
import { createCaptionReceiver, createCaptionSender, createLangAnnouncer, createStatusAnnouncer } from "./captionProtocol.js";
import { confidenceTier, normalizeThresholds, safetyNetTriggered } from "./confidence.js";
import { defaultLog } from "./diagnostics.js";
import { createDucker } from "./ducker.js";
import { createEchoBreaker, createEchoFilter } from "./echoFilter.js";
import { NONE, canTranscribeLanguage, getLanguage, languageBase, localeForLanguage, voiceForLanguage } from "./languages.js";
import { createMicPipeline } from "./micPipeline.js";
import { createNoticeSender } from "./noticeSender.js";
import { createRecognizerController } from "./recognizerController.js";
import { QUIET_GAP_MS, SPEECH_LEVEL, STALL_MS, TICK_MS, UNCLEAR_HOLD_MS, VOICE_FAIL_HOLD_MS, WAITING_HOLD_MS, createElementMuter, createLevelMeter, evaluateGuard } from "./realVoiceGuard.js";
import { createTokenManager } from "./tokenManager.js";
import { createTranscriptUploader } from "./transcriptUploader.js";
import { createVoiceQueue } from "./voiceQueue.js";

const MAX_TRANSCRIPT_ROWS = 500;
const SUBTITLE_HOLD_MS = 6000;
const MIC_SPEECH_PEAK = 0.1; // my microphone is "clearly speaking" above this
const NO_MATCH_TRIGGER = 3; // this many loud no-match results...
const NO_MATCH_WINDOW_MS = 30000; // ...within this time switch to automatic language detection
const SILENT_RESULT_MS = 6000; // my microphone is loud but the recognizer has said nothing at all (not even "no match") for this long
const SUSPECT_TRIGGER = 2; // this many of my last 3 sentences heard as the LISTENER's language with low confidence: ask again without that language
const GARBAGE_TRIGGER = 2; // ...and give that language back after this many unclear sentences in a row of the second opinion
const NO_MATCH_STRETCH_END_MS = 5000; // a run of no-match results ends after this much without another
const SPEAK_NOTE_MS = 5000;

export function createTranscriptionEngine({
  role, // "doctor" | "patient"
  appointmentId,
  config = {}, // { mode, noticeVersion, thresholds } from GET /api/transcription/config
  http, // axios-like { get, post }
  socket, // Socket.IO client { emit, on, off }
  loadSdk,
  createAudioContext, // () => AudioContext (unlocked by a tap)
  getLocalStream, // () => the call's local MediaStream
  getRemoteElements = () => [], // the <audio>/<video> elements playing the other person
  browserLanguages = [],
  profileCountry = "",
  allowGainDucking = false,
  now = () => Date.now(),
  nowPerf = () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
  random = Math.random,
  doc = typeof document !== "undefined" ? document : null,
  log = defaultLog, // diagnostics: numbers and codes, NEVER any text
  getPeerLevel = null, // () => 0..1 | null: how loud the other person is (default: measured from the remote audio element's stream)
} = {}) {
  const thresholds = normalizeThresholds(config.thresholds);
  const diag = (what, data) => { try { log(`[tr-diag] ${what}`, data); } catch { /* never into the call */ } };
  let lastReannounceAt = -Infinity;
  const seenPartial = new Set(); // sentence ids whose first partial was already logged
  const listeners = new Set();
  let state = {
    phase: "idle", // idle | running | stopped | unavailable
    recognizerStatus: "idle",
    reconnecting: false, // true = show "Subtitles unavailable, reconnecting…"
    readLang: NONE,
    subtitlesEnabled: true,
    voiceEnabled: true,
    voiceBreakerTripped: false,
    peerReadLang: NONE,
    peerSpeechLang: "", // the language the other person's latest sentence was detected in (the real voice is muted per sentence from this)
    muted: false,
    subtitle: null,
    hint: null,
    transcript: [],
    unsupportedSpeech: false,
    fellBackToDetection: false,
    notice: "idle",
    // Only one voice is heard: the other person's real voice is muted while the translated voice does the talking (see realVoiceGuard.js).
    realVoiceMuted: false,
    translationStatus: "off", // off | ready | waiting | speaking | unavailable
    fallbackReason: null,
    listenNote: null, // "didnt_catch": a sentence of the other person was too unclear to translate
    speakNote: null, // "not_understood": my own speech was not understood
  };

  const emit = () => { for (const fn of [...listeners]) { try { fn(state); } catch { /* a bad subscriber must not break the call */ } } };
  const set = (patch) => { state = { ...state, ...patch }; emit(); refreshGuard(); };

  // ---- parts, created in start() ----
  let sdk = null;
  let ctx = null;
  let tokens = null;
  let pipeline = null;
  let recognizer = null;
  let synth = null;
  let currentSource = null;
  let sinkFn = null;
  let started = false;
  let stopped = false;
  let downSince = null; // when the engine could not run at all (SDK failed to load)
  let subtitleTimer = null;
  const recentConfidences = [];
  const offSocket = [];

  const echo = createEchoFilter({ now });
  const breaker = createEchoBreaker({ now, onTrip: () => { voiceQueue.setEnabled(false); set({ voiceBreakerTripped: true }); } });
  const muter = createElementMuter({ getElements: getRemoteElements });
  const meter = createLevelMeter({ getContext: () => ctx, getElements: getRemoteElements });
  const readPeerLevel = () => (getPeerLevel ? getPeerLevel() : meter.level());
  let guardTimer = null;
  let lastCaptionAt = -Infinity; // any caption from the other person: proof their recognizer is alive
  let speechStart = null; // the other person has been speaking since (null = quiet)
  let lastLoudAt = -Infinity;
  let waitingUntil = 0;
  let stalledLatch = false;
  let voiceFailedUntil = 0;
  let unclearUntil = 0;
  let lastLevelAvailable = false;
  let peerStatus = "ok"; // the other person's recognizer health, as they reported it
  let didntCatchUntil = 0;
  let speakNoteUntil = 0;
  let detectExcluded = []; // languages (base codes) left out of the detection list while asking for a second opinion
  const recentSuspect = []; // my last 3 finals in detection mode: heard as the listener's language with low confidence?
  let garbageRun = 0;
  let lastResultPerf = -Infinity; // the last time the recognizer said anything at all (partial, final or no-match)
  let loudSince = null; // my microphone has been loud since (perf time; null = quiet)
  let lastMicLoudPerf = -Infinity;
  const noMatchTimes = []; // loud no-match results of mine, for the wrong-language safety net
  let noMatchStretch = null; // { start, last } perf times of a run of no-match results, saved as ONE gap
  let myStall = null; // why my microphone stopped delivering sound (mic_stalled | backgrounded | interrupted)
  let statusReady = false;
  let noMatchStatusUntil = 0;
  const ducker = createDucker({ getElements: getRemoteElements, allowGain: allowGainDucking });

  const noticeSender = createNoticeSender({
    version: config.noticeVersion || "v1",
    post: (body) => http.post(`/api/appointments/${appointmentId}/transcript-notice`, body),
    now: () => new Date(now()), setTimer, clearTimer, random,
    onRecorded: () => set({ notice: "done" }),
    onStopped: () => set({ notice: "stopped" }),
  });

  const uploader = createTranscriptUploader({
    post: (items, { final }) => http.post(`/api/appointments/${appointmentId}/transcript`, { items }, final ? { keepalive: true } : undefined),
    nowPerf, setTimer, clearTimer, random,
  });

  const statusAnnouncer = createStatusAnnouncer({ send: (m) => socket.emit("tr-status", { appointmentId, status: m.status }) });
  const announcer = createLangAnnouncer({ send: (m) => socket.emit("lang-changed", { appointmentId, lang: m.lang }) });
  const captionSender = createCaptionSender({ send: (m) => socket.emit("caption", { appointmentId, ...m }), nowPerf, setTimer, clearTimer, prefix: `${role === "doctor" ? "d" : "p"}${Math.floor(random() * 1e6).toString(36)}` });

  const voiceQueue = createVoiceQueue({
    speak: (item) => playVoice(item),
    stop: () => { try { if (currentSource) currentSource.stop(); } catch { /* already stopped */ } },
    onStart: () => { waitingUntil = 0; refreshGuard(); },
    onEnd: () => { ducker.restore(); refreshGuard(); },
    onError: () => { ducker.restore(); voiceFailedUntil = now() + VOICE_FAIL_HOLD_MS; refreshGuard(); }, // the real voice comes back
  });

  const receiver = createCaptionReceiver({
    role,
    getMyLang: () => state.readLang,
    getMyBaseLanguage: () => languageBase((Array.isArray(browserLanguages) && browserLanguages[0]) || ""),
    getThresholds: () => thresholds,
    isVoiceOn: () => state.voiceEnabled && !state.voiceBreakerTripped,
    now,
    onTranscript: (e) => addTranscript({ who: "peer", ...e }),
    onTrace: (t) => {
      // Logged: every finished sentence, and the first partial of each sentence. The subtitle outcome says why one did or did not appear.
      if (!t.final && seenPartial.has(t.id)) return;
      if (!t.final) seenPartial.add(t.id); else seenPartial.delete(t.id);
      diag("caption received", { id: t.id, final: t.final, from: t.from, srcLang: t.srcLang, tier: t.tier, iHear: t.myLang, translationsInCaption: t.targets, subtitlesOn: state.subtitlesEnabled, outcome: t.outcome });
      // The speaker's caption has no translation in my language: it never learned my language (a lost lang-changed). Say it again, at most every 5 s.
      if (t.outcome === "no_translation_for_my_language" && t.final && now() - lastReannounceAt > 5000) {
        lastReannounceAt = now();
        announcer.announce(state.readLang);
        diag("language announced again (the caption had no translation for it)", { iHear: state.readLang });
      }
    },
    onSubtitle: (s) => showSubtitle(s),
    onVoice: (v) => { voiceQueue.enqueue(v); },
    onHint: (h) => set({ hint: h }),
    // A finished sentence that will not be spoken (unclear, or no translation): its real voice was muted, so give the real voice back for a while.
    onUnspoken: () => { unclearUntil = now() + UNCLEAR_HOLD_MS; didntCatchUntil = unclearUntil; refreshGuard(); },
  });

  // ---- one voice at a time -----------------------------------------------------------------------------------------------
  function guardInputs() {
    return {
      readLang: state.readLang, peerReadLang: state.peerReadLang, peerSpeechLang: state.peerSpeechLang, voiceEnabled: state.voiceEnabled, breakerTripped: state.voiceBreakerTripped,
      phase: state.phase, recognizerStatus: state.recognizerStatus, reconnecting: state.reconnecting,
      tokenFailed: Boolean(tokens && tokens.isPermanentlyFailed()),
      audioState: ctx ? ctx.state : "none", levelAvailable: lastLevelAvailable,
      peerStatus, stalled: stalledLatch, voiceFailed: now() < voiceFailedUntil, unclearHold: now() < unclearUntil,
    };
  }

  let guarding = false;
  function refreshGuard() {
    if (guarding) return;
    guarding = true;
    try {
      const verdict = stopped ? { expected: false, mute: false, reason: null, showMessage: false } : evaluateGuard(guardInputs());
      muter.apply(verdict.mute); // element.muted, every time: a re-created element or a new stream is covered too
      let status = "off";
      if (verdict.showMessage) status = "unavailable";
      else if (verdict.mute) status = voiceQueue.isSpeaking() ? "speaking" : now() < waitingUntil || voiceQueue.waitingCount() > 0 ? "waiting" : "ready";
      const listenNote = !stopped && now() < didntCatchUntil && state.readLang !== NONE ? "didnt_catch" : null;
      const speakNote = !stopped && now() < speakNoteUntil ? "not_understood" : null;
      if (state.realVoiceMuted !== verdict.mute || state.translationStatus !== status || state.fallbackReason !== verdict.reason || state.listenNote !== listenNote || state.speakNote !== speakNote) {
        state = { ...state, realVoiceMuted: verdict.mute, translationStatus: status, fallbackReason: verdict.reason, listenNote, speakNote };
        emit();
      }
    } catch { /* never into the call */ } finally { guarding = false; }
  }

  // ---- telling the other person how MY recognizer is doing -----------------------------------------------------------------
  function refreshMyStatus() {
    if (!statusReady || stopped) return;
    let status = "ok";
    if (myStall) status = myStall === "mic_stalled" ? "stalled" : myStall;
    else if (state.phase === "unavailable" || state.reconnecting || state.recognizerStatus === "unavailable") status = "down";
    else if (now() < noMatchStatusUntil) status = "no_match";
    statusAnnouncer.set(status);
  }

  function closeNoMatchStretch() {
    if (!noMatchStretch) return;
    const { start, last } = noMatchStretch;
    noMatchStretch = null;
    addGap({ reason: "not_recognised", startedPerf: start, durationMs: Math.max(1, last - start) }); // the proof never looks empty
  }

  // Speech that Azure could not turn into words. Only counted when this person is clearly speaking (the microphone is loud).
  function onNoMatch(r) {
    if (state.muted || !pipeline || pipeline.recentPeak(2000) < MIC_SPEECH_PEAK) return;
    const t = nowPerf();
    if (!noMatchStretch) noMatchStretch = { start: t - (r && r.durationMs ? r.durationMs : 0), last: t };
    else noMatchStretch.last = t;
    speakNoteUntil = now() + SPEAK_NOTE_MS;
    noMatchStatusUntil = now() + UNCLEAR_HOLD_MS;
    statusAnnouncer.set("no_match", { force: true }); // each one is an event for the listener
    noMatchTimes.push(t);
    while (noMatchTimes.length && t - noMatchTimes[0] > NO_MATCH_WINDOW_MS) noMatchTimes.shift();
    lastResultPerf = t;
    if (recognizer && noMatchTimes.length >= NO_MATCH_TRIGGER) {
      noMatchTimes.length = 0;
      if (recognizer.mode() === "fixed") fallBackToDetection();
      else rotateDetection("nothing understood", languageBase((Array.isArray(browserLanguages) && browserLanguages[0]) || "") || "en");
    }
    diag("speech not recognised", { empty: Boolean(r && r.empty), silent: Boolean(r && r.silent), mode: recognizer ? recognizer.mode() : null });
    refreshGuard();
  }

  // The picked language does not match what is spoken: listen with detection instead, at the next pause (and tell the person).
  function fallBackToDetection() {
    recentConfidences.length = 0;
    set({ fellBackToDetection: true });
    recognizer.requestRestart({ mode: "detect", locale: null, candidates: candidatesNow() });
  }

  const candidatesNow = () => buildCandidateLocales({ browserLanguages, profileCountry, excludeBases: detectExcluded });

  // Detection keeps hearing the wrong language (Hindi heard as English at low confidence, or nothing understood at all): ask again.
  // First without the language it keeps picking; if that gives nonsense too, with the normal list again.
  function rotateDetection(reason, heardBase) {
    if (!recognizer || recognizer.mode() !== "detect") return;
    if (detectExcluded.length) detectExcluded = [];
    else if (heardBase) detectExcluded = [heardBase];
    else return;
    recentSuspect.length = 0; recentConfidences.length = 0; noMatchTimes.length = 0; garbageRun = 0;
    diag("detection asked again", { why: reason, leftOut: [...detectExcluded] });
    recognizer.requestRestart({ mode: "detect", locale: null, candidates: candidatesNow() });
  }

  // The language(s) the listener hears / I myself would be assumed to speak: a low-confidence sentence heard as one of these is suspect.
  function ownBases() {
    const set = new Set();
    if (state.peerReadLang && state.peerReadLang !== NONE) set.add(languageBase(state.peerReadLang));
    const mine = languageBase((Array.isArray(browserLanguages) && browserLanguages[0]) || "");
    if (mine) set.add(mine);
    return set;
  }

  // Twice a second: is the other person speaking, and is anything arriving? (the 8-second rule)
  function guardTick() {
    guardTimer = null;
    if (stopped) return;
    try {
      const level = readPeerLevel();
      lastLevelAvailable = typeof level === "number";
      const t = now();
      if (lastLevelAvailable && level > SPEECH_LEVEL) {
        lastLoudAt = t;
        if (speechStart === null) speechStart = t;
        waitingUntil = t + WAITING_HOLD_MS;
      } else if (speechStart !== null && t - lastLoudAt > QUIET_GAP_MS) {
        speechStart = null;
      }
      if (noMatchStretch && nowPerf() - noMatchStretch.last > NO_MATCH_STRETCH_END_MS) closeNoMatchStretch();
      // My microphone is loud but the recognizer has said nothing at all (no sentence, no "no match"): count it as speech not recognised.
      if (pipeline && !state.muted && recognizer && recognizer.status() === "running") {
        const p = nowPerf();
        if (pipeline.recentPeak(1000) >= MIC_SPEECH_PEAK) { lastMicLoudPerf = p; if (loudSince === null) loudSince = p; }
        else if (p - lastMicLoudPerf > QUIET_GAP_MS) loudSince = null;
        if (loudSince !== null && p - Math.max(loudSince, lastResultPerf) > SILENT_RESULT_MS) { loudSince = p; onNoMatch({ durationMs: SILENT_RESULT_MS, silent: true }); }
      } else loudSince = null;
      if (state.realVoiceMuted && speechStart !== null && t - Math.max(speechStart, lastCaptionAt) > STALL_MS) stalledLatch = true; // latched until a caption arrives
    } catch { /* ignore */ }
    refreshMyStatus();
    refreshGuard();
    guardTimer = setTimer(guardTick, TICK_MS);
  }

  // ---- helpers ----------------------------------------------------------------------------------------------------------
  function addTranscript(entry) {
    if (!entry.final) return; // the transcript panel lists finished sentences; partials live in the subtitle
    const next = [...state.transcript, entry];
    set({ transcript: next.length > MAX_TRANSCRIPT_ROWS ? next.slice(next.length - MAX_TRANSCRIPT_ROWS) : next });
  }

  function showSubtitle(s) {
    if (!state.subtitlesEnabled) { diag("subtitle not shown", { id: s.id, why: "subtitles_switched_off" }); return; } // the person switched subtitles off (the transcript panel is unaffected)
    clearTimer(subtitleTimer);
    set({ subtitle: s });
    // A finished sentence stays on screen while its translated voice is still being spoken or is waiting its turn (up to 20 s more).
    let extensions = 0;
    const arm = (ms) => {
      subtitleTimer = setTimer(() => {
        if (!state.subtitle || state.subtitle.id !== s.id) return;
        if (s.final && extensions < 13 && (voiceQueue.isSpeaking() || voiceQueue.waitingCount() > 0)) { extensions += 1; arm(1500); return; }
        set({ subtitle: null });
      }, ms);
    };
    arm(SUBTITLE_HOLD_MS);
  }

  // The translation targets: English (the record) and the language the other person reads. Never more than two.
  function targetsFor(peerLang) {
    const list = ["en"];
    if (peerLang && peerLang !== NONE && languageBase(peerLang) !== "en") list.push(peerLang);
    return list;
  }

  function recognitionConfig() {
    const lang = state.readLang;
    const targets = targetsFor(state.peerReadLang);
    if (lang !== NONE && canTranscribeLanguage(lang)) return { mode: "fixed", locale: localeForLanguage(lang), candidates: [], targets };
    const candidates = candidatesNow();
    return { mode: "detect", locale: null, candidates, targets };
  }

  const addGap = ({ reason, startedPerf, durationMs }) => { uploader.addGap({ reason, startedPerf, durationMs }); };

  // ---- the translated voice ---------------------------------------------------------------------------------------------
  async function playVoice(item) {
    const language = getLanguage(item.lang);
    const voice = voiceForLanguage(item.lang);
    if (!language || !voice || !ctx || !sdk) return; // no voice for this language: the subtitle alone is shown
    const { token, region } = await tokens.getToken();
    if (!synth) {
      const sc = sdk.SpeechConfig.fromAuthorizationToken(token, region);
      sc.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm;
      synth = new sdk.SpeechSynthesizer(sc, null); // audio is returned to us and played through OUR unlocked audio context
    }
    synth.authorizationToken = token;
    const text = String(item.text).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const ssml = `<speak version='1.0' xml:lang='${language.locale}'><voice name='${voice}'>${text}</voice></speak>`;
    const audioData = await new Promise((resolve, reject) =>
      synth.speakSsmlAsync(ssml, (r) => (r && r.reason === sdk.ResultReason.SynthesizingAudioCompleted ? resolve(r.audioData) : reject(new Error("synthesis failed"))), reject)
    );
    if (stopped || !voiceQueue.isEnabled()) return;
    if (ctx.state !== "running" && ctx.resume) await ctx.resume().catch(() => {});
    const buffer = await ctx.decodeAudioData(audioData.slice(0));
    await new Promise((resolve) => {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      currentSource = source;
      const handle = echo.voiceStarted(item.text);
      ducker.duck();
      source.onended = () => { voiceFailedUntil = 0; echo.voiceEnded(handle); if (currentSource === source) currentSource = null; resolve(); };
      source.start();
    });
  }

  // ---- what my own recognizer produces ----------------------------------------------------------------------------------
  function onPartial(p) {
    lastResultPerf = nowPerf();
    if (state.muted) return;
    if (echo.check({ text: p.text, confidence: null, durationMs: 0 }).echo) return; // our own voice, not a caption
    captionSender.partial({ text: p.text, tr: p.tr, srcLang: p.srcLang });
  }

  function onFinal(f) {
    lastResultPerf = nowPerf();
    const tier = confidenceTier(f.confidence, thresholds);
    closeNoMatchStretch(); // words came out again
    noMatchStatusUntil = 0;
    if (tier === "unclear") speakNoteUntil = now() + SPEAK_NOTE_MS; // "Not understood - please repeat"
    const verdict = echo.check({ text: f.text, confidence: f.confidence, durationMs: f.durationMs });
    const unsupported = state.unsupportedSpeech;
    const languageSource = state.readLang !== NONE && canTranscribeLanguage(state.readLang) && !state.fellBackToDetection ? "declared" : "auto";

    // Always saved, flags and all (the transcript is our proof). Echo and unclear lines are saved but never shown live or sent on.
    uploader.addLine({
      original: f.text,
      translations: f.tr,
      sourceLang: f.srcLang,
      languageSource,
      confidence: f.confidence,
      flags: { suspectedEcho: verdict.echo, languageNotInList: unsupported },
    });
    addTranscript({ who: "me", from: role === "doctor" ? "doctor" : "patient", id: `me-${nowPerf()}`, final: true, text: f.text, tr: f.tr, srcLang: f.srcLang, conf: f.confidence, tier, at: now(), flags: { echo: verdict.echo } });

    if (verdict.echo) { breaker.record(); return; }
    // Always sent (echo excepted). An unclear sentence is not shown or spoken on the other side, but its arrival tells that device that a
    // sentence was not translated, so the real voice is not left muted.
    captionSender.final({ text: f.text, tr: f.tr, srcLang: f.srcLang, confidence: f.confidence });
    diag("caption sent", { srcLang: f.srcLang, confidence: f.confidence, translationsSent: Object.keys(f.tr || {}), recognizerTargets: recognizer ? recognizer.targets() : [] });

    // The wrong-language safety net (only when a language was picked): nonsense with low confidence means the pick does not match
    // what is spoken, so listen with detection instead, at the next pause.
    if (recognizer.mode() === "fixed") {
      recentConfidences.push(f.confidence);
      if (safetyNetTriggered(recentConfidences)) fallBackToDetection();
    } else if (typeof f.confidence === "number") {
      // Detection: a low-confidence sentence "heard" as the listener's own language (or mine) is probably another language forced into it.
      if (detectExcluded.length === 0) {
        recentSuspect.push(f.confidence < thresholds.lowBelow && ownBases().has(languageBase(f.srcLang)));
        while (recentSuspect.length > 3) recentSuspect.shift();
        if (recentSuspect.filter(Boolean).length >= SUSPECT_TRIGGER) rotateDetection("low confidence in the listener's language", languageBase(f.srcLang));
      } else {
        garbageRun = f.confidence < thresholds.unclearBelow ? garbageRun + 1 : 0;
        if (garbageRun >= GARBAGE_TRIGGER) rotateDetection("the second opinion was unclear too");
      }
    }
  }

  // ---- the socket -------------------------------------------------------------------------------------------------------
  function listen(event, handler) {
    socket.on(event, handler);
    offSocket.push(() => socket.off(event, handler));
  }
  function handleIncomingStatus(msg) {
    if (!mine(msg) || stopped || typeof msg.status !== "string") return;
    if (msg.status === "no_match") { // the other person is clearly speaking but nothing was understood: that sentence is lost
      unclearUntil = now() + UNCLEAR_HOLD_MS; didntCatchUntil = unclearUntil;
    } else {
      peerStatus = msg.status;
    }
    refreshGuard();
  }
  const mine = (msg) => msg && typeof msg === "object" && String(msg.appointmentId) === String(appointmentId);

  function handleIncomingLang(msg) {
    if (!mine(msg) || typeof msg.lang !== "string") return;
    set({ peerReadLang: msg.lang });
    if (recognizer) { const targetsNow = recognizer.setTargets(targetsFor(msg.lang)); diag("listener language received", { listenerHears: msg.lang, targetsNow }); } // on the RUNNING recognizer: no restart
    else diag("listener language received before the recognizer was up", { listenerHears: msg.lang });
  }
  function handleIncomingCaption(msg) {
    if (!mine(msg) || stopped) return;
    lastCaptionAt = now();
    if (stalledLatch) stalledLatch = false; // translation is arriving again: the real voice goes quiet again
    // Per sentence: what language did they just speak? Same as mine = real voice, different = muted and translated (see realVoiceGuard).
    // A low-confidence sentence "heard" as MY language is not trusted as the same language ("und" = uncertain: translated and muted anyway).
    if (typeof msg.srcLang === "string" && msg.srcLang) {
      const tier = confidenceTier(typeof msg.conf === "number" ? msg.conf : null, thresholds);
      const doubtful = Boolean(msg.final) && (tier === "low" || tier === "unclear") && state.readLang !== NONE && languageBase(msg.srcLang) === languageBase(state.readLang);
      const heard = doubtful ? "und" : msg.srcLang;
      if (heard !== state.peerSpeechLang) set({ peerSpeechLang: heard });
    }
    receiver.handle(msg);
  }

  // ---- public ----------------------------------------------------------------------------------------------------------
  const api = {
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    getState: () => state,

    // Creates the audio context. Must be called from a tap (the LANGUAGE button, START...) so the browser lets sound play later.
    unlockAudio() {
      try {
        if (!ctx) ctx = createAudioContext();
        if (ctx && ctx.resume) Promise.resolve(ctx.resume()).catch(() => {});
      } catch { /* no audio available: subtitles still work */ }
    },

    async start() {
      if (started || stopped) return;
      started = true;
      try {
        noticeSender.start();
        set({ phase: "running", notice: "sending" });
        listen("lang-changed", handleIncomingLang);
        listen("caption", handleIncomingCaption);
        listen("tr-status", handleIncomingStatus);
        listen("peer-joined", () => { announcer.resend(); statusAnnouncer.resend(); });
        // NOT on "connect" / the socket's "reconnect": the server refuses these until the room is joined again (not_in_room).
        // The server answers a confirmed join with "peer-joined" whenever the other person is there, and that resends them.
        announcer.announce(NONE);

        try {
          sdk = await loadSdk();
        } catch {
          downSince = nowPerf();
          set({ phase: "unavailable", recognizerStatus: "unavailable" });
          return; // the call goes on without live captions; the notice and the gap are still recorded
        }
        if (stopped) return;
        if (!ctx) api.unlockAudio();

        tokens = createTokenManager({
          fetchToken: async () => (await http.get("/api/speech-token", { params: { appointmentId } })).data,
          onToken: ({ token }) => { if (recognizer) recognizer.updateToken(token); if (synth) synth.authorizationToken = token; },
          now, setTimer, clearTimer, random,
        });

        pipeline = createMicPipeline({ ctx, stream: getLocalStream(), sink: (ab) => { if (sinkFn) sinkFn(ab); }, nowPerf, setTimer, clearTimer, doc, onGap: (g) => { addGap(g); if (g.reason !== "muted") { myStall = null; refreshMyStatus(); } }, onStall: ({ reason }) => { myStall = reason; refreshMyStatus(); } });
        recognizer = createRecognizerController({
          sdk,
          getToken: async (force) => { if (force) await tokens.refresh().catch(() => {}); return tokens.getToken(); },
          attachSink: (fn) => { sinkFn = fn; },
          onPartial, onFinal, onNoMatch,
          onSessionConfig: (c) => diag("recognizer listening", { mode: c.mode, locale: c.locale, candidates: c.candidates, targets: c.targets }),
          onStatus: (status) => { set({ recognizerStatus: status, reconnecting: status === "reconnecting" }); refreshMyStatus(); },
          onGap: addGap,
          nowPerf, setTimer, clearTimer, random,
          isUnavailable: () => tokens.isPermanentlyFailed(),
        });

        statusReady = true;
        if (guardTimer === null) guardTimer = setTimer(guardTick, TICK_MS);
        pipeline.start();
        pipeline.setMuted(state.muted);
        await recognizer.start(recognitionConfig());
        if (stopped) return;
      } catch {
        set({ phase: "unavailable" });
      }
    },

    // The LANGUAGE button. "none" = Real voice (no translation): the default.
    setReadLanguage(code) {
      const lang = code === NONE || getLanguage(code) ? code : NONE;
      if (lang === state.readLang) return;
      const unsupported = lang !== NONE && !canTranscribeLanguage(lang);
      recentConfidences.length = 0;
      set({ readLang: lang, unsupportedSpeech: unsupported, fellBackToDetection: false, subtitle: lang === NONE ? null : state.subtitle });
      if (lang === NONE) voiceQueue.clear();
      announcer.announce(lang);
      if (lang !== NONE && tokens && tokens.resetServerFailures()) { tokens.refresh().catch(() => {}); set({}); } // picking a language again = try once more
      if (recognizer) recognizer.requestRestart(recognitionConfig()); // my own language changed: applied at the next pause
    },

    setSubtitlesEnabled(on) {
      const value = Boolean(on);
      clearTimer(subtitleTimer);
      set({ subtitlesEnabled: value, subtitle: value ? state.subtitle : null });
    },

    setVoiceEnabled(on) {
      const value = Boolean(on);
      if (value && state.voiceBreakerTripped) breaker.reset();
      voiceQueue.setEnabled(value);
      set({ voiceEnabled: value, voiceBreakerTripped: value ? false : state.voiceBreakerTripped });
    },

    // The call's own MUTE state, passed on as it is. This engine never mutes or unmutes anyone.
    setMuted(on) {
      set({ muted: Boolean(on) });
      if (pipeline) pipeline.setMuted(on);
    },

    swapMicStream(stream) { if (pipeline) pipeline.swapStream(stream); },
    dismissHint() { set({ hint: null }); },
    onPeerJoined() { announcer.resend(); statusAnnouncer.resend(); },
    onSocketReconnected() { /* nothing to send yet: the room join is not confirmed; the "peer-joined" that follows it resends */ },
    handleIncomingCaption,
    handleIncomingLang,

    // Numbers for testing on a real device (never any text).
    diagnostics: () => ({ pipeline: pipeline ? pipeline.stats() : null, uploader: uploader.stats(), recognizerStatus: recognizer ? recognizer.status() : state.recognizerStatus, targets: recognizer ? recognizer.targets() : [], ducker: ducker.status(), noticeAttempts: noticeSender.attempts() }),

    async stop() {
      if (!started || stopped) return; // never started (React's development double-mount): nothing to stop, and it can still be started
      stopped = true;
      clearTimer(subtitleTimer);
      clearTimer(guardTimer); guardTimer = null;
      closeNoMatchStretch();
      captionSender.stop();
      voiceQueue.clear();
      ducker.restore();
      if (pipeline) pipeline.stop(); // reports an open mute / stall gap
      if (recognizer) recognizer.stop(); // reports an open outage
      if (downSince !== null) addGap({ reason: "recognizer_down", startedPerf: downSince, durationMs: nowPerf() - downSince });
      noticeSender.stop();
      if (tokens) tokens.stop();
      offSocket.forEach((off) => off());
      set({ phase: "stopped", subtitle: null });
      muter.apply(false); meter.release(); // the real voice is never left muted
      const result = await uploader.flush(); // everything that is left, now
      uploader.close();
      return result;
    },
  };
  return api;
}
