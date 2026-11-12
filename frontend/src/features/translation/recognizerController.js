// Runs the Azure speech recognizer for THIS person's own microphone, for the whole call.
//
//   mode "detect"  continuous language detection among a list of candidate locales (the default: nobody has said what they speak)
//   mode "fixed"   listen for one locale (the person picked a language)
// Either way it also TRANSLATES: the targets are English (the record) plus the language the other person reads, and they are added and
// removed on the RUNNING recognizer, with no restart, whenever the other person changes language.
//
// Rules:
//   • It is never restarted in the middle of a sentence. A change of this person's own language, or the wrong-language safety net,
//     is queued and applied at the next pause (right after a finished sentence, or after 1.5 s of quiet). The new session starts and is
//     given the audio BEFORE the old one is stopped, so nothing is lost in between.
//   • Azure dropping the connection is not the end of the call: status becomes "reconnecting", it retries with backoff (a fresh token
//     first), and the stretch without transcription is reported as a "recognizer_down" gap.
//   • The token is refreshed by the token manager; updateToken() hands the new one to the running recognizer.
//   • Words are only ever passed to the callbacks. Nothing here logs.
import { backoffDelay } from "./backoff.js";

export const IDLE_BEFORE_RESTART_MS = 1500;

export function createRecognizerController({
  sdk,
  getToken, // async (force) => { token, region }
  attachSink, // (write | null) => void: where the microphone audio goes
  onPartial = () => {},
  onFinal = () => {},
  onStatus = () => {},
  onGap = () => {}, // ({ reason: "recognizer_down", startedPerf, durationMs })
  onSessionStarted = () => {},
  nowPerf = () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
  random = Math.random,
  isUnavailable = () => false, // true once the token manager has been refused for good (no point retrying)
} = {}) {
  let status = "idle";
  let session = null; // { rec, push }
  let config = null; // { mode, locale, candidates, targets:Set }
  let pendingConfig = null;
  let stopped = false;
  let downSince = null;
  let retryTimer = null;
  let idleTimer = null;
  let attempts = 0;
  let building = null;
  const targets = new Set();

  function setStatus(next) {
    if (status === next) return;
    status = next;
    onStatus(next);
  }

  // ---- reading a result ------------------------------------------------------------------------------------------------------
  function extract(result, cfg) {
    const tr = {};
    try {
      for (const lang of result.translations.languages) tr[String(lang).toLowerCase()] = String(result.translations.get(lang) || "");
    } catch { /* no translations on this result */ }
    let srcLang = "";
    try {
      srcLang = cfg.mode === "detect" ? sdk.AutoDetectSourceLanguageResult.fromResult(result).language || "" : cfg.locale;
    } catch { srcLang = cfg.mode === "fixed" ? cfg.locale : ""; }
    let confidence = null;
    try {
      const c = JSON.parse(result.properties.getProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult)).NBest[0].Confidence;
      if (typeof c === "number" && Number.isFinite(c)) confidence = c;
    } catch { /* no confidence on this result */ }
    return { text: String(result.text || ""), tr, srcLang, confidence, durationMs: Math.round((Number(result.duration) || 0) / 10000) };
  }

  // ---- building a session -----------------------------------------------------------------------------------------------------
  async function buildSession(cfg, { forceToken = false } = {}) {
    const { token, region } = await getToken(forceToken);
    const sc = sdk.SpeechTranslationConfig.fromAuthorizationToken(token, region);
    sc.outputFormat = sdk.OutputFormat.Detailed; // needed to read the confidence
    for (const t of cfg.targets) sc.addTargetLanguage(t);
    const push = sdk.AudioInputStream.createPushStream(sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1));
    const audio = sdk.AudioConfig.fromStreamInput(push);
    let rec;
    if (cfg.mode === "detect") {
      sc.setProperty(sdk.PropertyId.SpeechServiceConnection_LanguageIdMode, "Continuous");
      rec = sdk.TranslationRecognizer.FromConfig(sc, sdk.AutoDetectSourceLanguageConfig.fromLanguages(cfg.candidates), audio);
    } else {
      sc.speechRecognitionLanguage = cfg.locale;
      rec = new sdk.TranslationRecognizer(sc, audio);
    }
    const mine = { rec, push, cfg, closed: false };
    rec.recognizing = (s, e) => {
      if (session !== mine && !(building && building.target === mine)) return;
      const r = extract(e.result, cfg);
      if (r.text) { onPartial({ text: r.text, tr: r.tr, srcLang: r.srcLang }); resetIdle(); }
    };
    rec.recognized = (s, e) => {
      if (session !== mine) return;
      const reason = e.result && e.result.reason;
      if (reason !== sdk.ResultReason.TranslatedSpeech) return;
      const r = extract(e.result, cfg);
      if (!r.text) return;
      onFinal(r);
      maybeApplyPending();
    };
    rec.sessionStarted = () => { if (session === mine) { attempts = 0; onSessionStarted(); } };
    rec.canceled = (s, e) => {
      if (mine.closed) return;
      const endOfStream = sdk.CancellationReason && e && e.reason === sdk.CancellationReason.EndOfStream;
      if (endOfStream) return;
      handleFailure(mine);
    };
    await new Promise((resolve, reject) => rec.startContinuousRecognitionAsync(resolve, (err) => reject(new Error(String(err)))));
    return mine;
  }

  function closeSession(s) {
    if (!s || s.closed) return;
    s.closed = true;
    try { s.rec.stopContinuousRecognitionAsync(() => { try { s.rec.close(); } catch { /* closed */ } }, () => { try { s.rec.close(); } catch { /* closed */ } }); } catch { /* already stopped */ }
    try { s.push.close(); } catch { /* already closed */ }
  }

  function adoptSession(s) {
    session = s;
    attachSink((ab) => { try { s.push.write(ab); } catch { /* the stream was closed under us */ } });
  }

  // ---- failure and reconnect --------------------------------------------------------------------------------------------------
  function handleFailure(failed) {
    if (stopped || session !== failed) return;
    if (downSince === null) downSince = nowPerf();
    attachSink(null);
    session = null;
    closeSession(failed);
    setStatus("reconnecting");
    scheduleRetry();
  }

  function scheduleRetry() {
    if (stopped || retryTimer !== null) return;
    const wait = backoffDelay(attempts, { random });
    attempts += 1;
    retryTimer = setTimer(async () => {
      retryTimer = null;
      if (stopped) return;
      try {
        const s = await buildSession(config, { forceToken: attempts > 1 });
        if (stopped) { closeSession(s); return; }
        adoptSession(s);
        if (downSince !== null) {
          onGap({ reason: "recognizer_down", startedPerf: downSince, durationMs: Math.max(0, Math.round(nowPerf() - downSince)) });
          downSince = null;
        }
        setStatus("running");
      } catch {
        if (isUnavailable()) { setStatus("unavailable"); return; }
        scheduleRetry();
      }
    }, wait);
  }

  // ---- restarts only at a pause -----------------------------------------------------------------------------------------------
  function resetIdle() {
    clearTimer(idleTimer);
    idleTimer = null;
    if (pendingConfig) idleTimer = setTimer(() => { idleTimer = null; maybeApplyPending(true); }, IDLE_BEFORE_RESTART_MS);
  }

  async function maybeApplyPending() {
    if (!pendingConfig || stopped || building || status !== "running") return;
    const next = pendingConfig;
    pendingConfig = null;
    clearTimer(idleTimer);
    idleTimer = null;
    building = { target: null };
    try {
      const fresh = await buildSession({ ...next, targets: new Set(targets) });
      building.target = fresh;
      if (stopped) { closeSession(fresh); return; }
      const old = session;
      config = { ...next, targets: new Set(targets) };
      adoptSession(fresh); // the new session gets the audio first...
      closeSession(old); // ...then the old one is let go
    } catch {
      pendingConfig = next; // try again at the next pause
    } finally {
      building = null;
    }
  }

  return {
    async start({ mode, locale = null, candidates = [], targets: initial = ["en"] } = {}) {
      stopped = false;
      targets.clear();
      for (const t of initial) targets.add(t);
      config = { mode, locale, candidates, targets: new Set(targets) };
      setStatus("starting");
      try {
        const s = await buildSession(config);
        if (stopped) { closeSession(s); return; }
        adoptSession(s);
        setStatus("running");
      } catch {
        if (isUnavailable()) { setStatus("unavailable"); return; }
        setStatus("reconnecting");
        downSince = nowPerf();
        scheduleRetry();
      }
    },

    // The other person reads a different language now: add / remove translation targets on the RUNNING recognizer. No restart.
    setTargets(list) {
      const want = new Set(list);
      const rec = session && session.rec;
      for (const t of want) if (!targets.has(t)) { targets.add(t); try { if (rec) rec.addTargetLanguage(t); } catch { /* applied at the next session */ } }
      for (const t of [...targets]) if (!want.has(t)) { targets.delete(t); try { if (rec) rec.removeTargetLanguage(t); } catch { /* applied at the next session */ } }
      if (config) config.targets = new Set(targets);
      return [...targets];
    },

    // This person's own language changed (or the safety net fired): applied at the next pause, never mid-sentence.
    requestRestart(next) {
      pendingConfig = next;
      resetIdle();
    },

    updateToken(token) {
      try { if (session) session.rec.authorizationToken = token; } catch { /* the next session picks it up */ }
    },

    stop() {
      stopped = true;
      clearTimer(retryTimer); retryTimer = null;
      clearTimer(idleTimer); idleTimer = null;
      attachSink(null);
      closeSession(session);
      session = null;
      if (downSince !== null) { onGap({ reason: "recognizer_down", startedPerf: downSince, durationMs: Math.max(0, Math.round(nowPerf() - downSince)) }); downSince = null; }
      setStatus("stopped");
    },

    status: () => status,
    targets: () => [...targets],
    mode: () => (config ? config.mode : null),
    hasPendingRestart: () => pendingConfig !== null,
  };
}
