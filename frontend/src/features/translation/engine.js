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
import { createCaptionReceiver, createCaptionSender, createLangAnnouncer } from "./captionProtocol.js";
import { confidenceTier, normalizeThresholds, safetyNetTriggered, showLive } from "./confidence.js";
import { createDucker } from "./ducker.js";
import { createEchoBreaker, createEchoFilter } from "./echoFilter.js";
import { NONE, canTranscribeLanguage, getLanguage, languageBase, localeForLanguage, voiceForLanguage } from "./languages.js";
import { createMicPipeline } from "./micPipeline.js";
import { createNoticeSender } from "./noticeSender.js";
import { createRecognizerController } from "./recognizerController.js";
import { createTokenManager } from "./tokenManager.js";
import { createTranscriptUploader } from "./transcriptUploader.js";
import { createVoiceQueue } from "./voiceQueue.js";

const MAX_TRANSCRIPT_ROWS = 500;
const SUBTITLE_HOLD_MS = 6000;

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
} = {}) {
  const thresholds = normalizeThresholds(config.thresholds);
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
    muted: false,
    subtitle: null,
    hint: null,
    transcript: [],
    unsupportedSpeech: false,
    fellBackToDetection: false,
    notice: "idle",
  };

  const emit = () => { for (const fn of [...listeners]) { try { fn(state); } catch { /* a bad subscriber must not break the call */ } } };
  const set = (patch) => { state = { ...state, ...patch }; emit(); };

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

  const announcer = createLangAnnouncer({ send: (m) => socket.emit("lang-changed", { appointmentId, lang: m.lang }) });
  const captionSender = createCaptionSender({ send: (m) => socket.emit("caption", { appointmentId, ...m }), nowPerf, setTimer, clearTimer, prefix: `${role === "doctor" ? "d" : "p"}${Math.floor(random() * 1e6).toString(36)}` });

  const voiceQueue = createVoiceQueue({
    speak: (item) => playVoice(item),
    stop: () => { try { if (currentSource) currentSource.stop(); } catch { /* already stopped */ } },
    onEnd: () => { ducker.restore(); },
    onError: () => { ducker.restore(); },
  });

  const receiver = createCaptionReceiver({
    role,
    getMyLang: () => state.readLang,
    getMyBaseLanguage: () => languageBase((Array.isArray(browserLanguages) && browserLanguages[0]) || ""),
    getThresholds: () => thresholds,
    isVoiceOn: () => state.voiceEnabled && !state.voiceBreakerTripped,
    now,
    onTranscript: (e) => addTranscript({ who: "peer", ...e }),
    onSubtitle: (s) => showSubtitle(s),
    onVoice: (v) => { voiceQueue.enqueue(v); },
    onHint: (h) => set({ hint: h }),
  });

  // ---- helpers ----------------------------------------------------------------------------------------------------------
  function addTranscript(entry) {
    if (!entry.final) return; // the transcript panel lists finished sentences; partials live in the subtitle
    const next = [...state.transcript, entry];
    set({ transcript: next.length > MAX_TRANSCRIPT_ROWS ? next.slice(next.length - MAX_TRANSCRIPT_ROWS) : next });
  }

  function showSubtitle(s) {
    if (!state.subtitlesEnabled) return; // the person switched subtitles off (the transcript panel is unaffected)
    clearTimer(subtitleTimer);
    set({ subtitle: s });
    subtitleTimer = setTimer(() => { if (state.subtitle && state.subtitle.id === s.id) set({ subtitle: null }); }, SUBTITLE_HOLD_MS);
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
    const candidates = buildCandidateLocales({ browserLanguages, profileCountry });
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
      source.onended = () => { echo.voiceEnded(handle); if (currentSource === source) currentSource = null; resolve(); };
      source.start();
    });
  }

  // ---- what my own recognizer produces ----------------------------------------------------------------------------------
  function onPartial(p) {
    if (state.muted) return;
    if (echo.check({ text: p.text, confidence: null, durationMs: 0 }).echo) return; // our own voice, not a caption
    captionSender.partial({ text: p.text, tr: p.tr, srcLang: p.srcLang });
  }

  function onFinal(f) {
    const tier = confidenceTier(f.confidence, thresholds);
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
    if (showLive(tier)) captionSender.final({ text: f.text, tr: f.tr, srcLang: f.srcLang, confidence: f.confidence });
    else captionSender.abandon();

    // The wrong-language safety net (only when a language was picked): nonsense with low confidence means the pick does not match
    // what is spoken, so listen with detection instead, at the next pause.
    if (recognizer.mode() === "fixed") {
      recentConfidences.push(f.confidence);
      if (safetyNetTriggered(recentConfidences)) {
        recentConfidences.length = 0;
        set({ fellBackToDetection: true });
        recognizer.requestRestart({ mode: "detect", locale: null, candidates: buildCandidateLocales({ browserLanguages, profileCountry }) });
      }
    }
  }

  // ---- the socket -------------------------------------------------------------------------------------------------------
  function listen(event, handler) {
    socket.on(event, handler);
    offSocket.push(() => socket.off(event, handler));
  }
  const mine = (msg) => msg && typeof msg === "object" && String(msg.appointmentId) === String(appointmentId);

  function handleIncomingLang(msg) {
    if (!mine(msg) || typeof msg.lang !== "string") return;
    set({ peerReadLang: msg.lang });
    if (recognizer) recognizer.setTargets(targetsFor(msg.lang)); // on the RUNNING recognizer: no restart
  }
  function handleIncomingCaption(msg) {
    if (!mine(msg) || stopped) return;
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
        listen("peer-joined", () => announcer.resend());
        listen("connect", () => announcer.resend());
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

        pipeline = createMicPipeline({ ctx, stream: getLocalStream(), sink: (ab) => { if (sinkFn) sinkFn(ab); }, nowPerf, setTimer, clearTimer, doc, onGap: addGap });
        recognizer = createRecognizerController({
          sdk,
          getToken: async (force) => { if (force) await tokens.refresh().catch(() => {}); return tokens.getToken(); },
          attachSink: (fn) => { sinkFn = fn; },
          onPartial, onFinal,
          onStatus: (status) => set({ recognizerStatus: status, reconnecting: status === "reconnecting" }),
          onGap: addGap,
          nowPerf, setTimer, clearTimer, random,
          isUnavailable: () => tokens.isPermanentlyFailed(),
        });

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
    onPeerJoined() { announcer.resend(); },
    onSocketReconnected() { announcer.resend(); },
    handleIncomingCaption,
    handleIncomingLang,

    // Numbers for testing on a real device (never any text).
    diagnostics: () => ({ pipeline: pipeline ? pipeline.stats() : null, uploader: uploader.stats(), recognizerStatus: recognizer ? recognizer.status() : state.recognizerStatus, targets: recognizer ? recognizer.targets() : [], ducker: ducker.status(), noticeAttempts: noticeSender.attempts() }),

    async stop() {
      if (!started || stopped) return; // never started (React's development double-mount): nothing to stop, and it can still be started
      stopped = true;
      clearTimer(subtitleTimer);
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
      const result = await uploader.flush(); // everything that is left, now
      uploader.close();
      return result;
    },
  };
  return api;
}
