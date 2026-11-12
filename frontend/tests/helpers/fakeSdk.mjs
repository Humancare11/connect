// A stand-in for the Azure Speech SDK, just big enough for the engine's tests: it records what the code asked for and lets the test
// "make Azure say" something (a partial, a final, an error).
export function createFakeSdk() {
  const log = { recognizers: [], pushes: [], synths: [] };
  const sdk = { failStart: false, failNextStarts: 0, log };

  sdk.ResultReason = { TranslatedSpeech: 7, NoMatch: 0, SynthesizingAudioCompleted: 9 };
  sdk.CancellationReason = { Error: 1, EndOfStream: 2 };
  sdk.OutputFormat = { Detailed: "Detailed" };
  sdk.PropertyId = { SpeechServiceConnection_LanguageIdMode: "LIDMODE", SpeechServiceResponse_JsonResult: "JSONRESULT" };
  sdk.AudioStreamFormat = { getWaveFormatPCM: (rate, bits, channels) => ({ rate, bits, channels }) };
  sdk.AudioConfig = { fromStreamInput: (push) => ({ push }) };
  sdk.AutoDetectSourceLanguageConfig = { fromLanguages: (languages) => ({ languages: [...languages] }) };
  sdk.AutoDetectSourceLanguageResult = { fromResult: (r) => ({ language: r.__lang }) };
  sdk.AudioInputStream = {
    createPushStream() {
      const p = { written: [], closed: false, write(ab) { if (p.closed) throw new Error("push stream is closed"); p.written.push(ab); }, close() { p.closed = true; } };
      log.pushes.push(p);
      return p;
    },
  };
  sdk.SpeechTranslationConfig = {
    fromAuthorizationToken(token, region) {
      return { token, region, targets: [], props: {}, speechRecognitionLanguage: null, outputFormat: null, addTargetLanguage(t) { this.targets.push(t); }, setProperty(k, v) { this.props[k] = v; } };
    },
  };

  const resultOf = (text, tr, { lang = "", conf = null, durationMs = 0, reason = sdk.ResultReason.TranslatedSpeech } = {}) => ({
    text, reason, duration: durationMs * 10000, __lang: lang,
    translations: { languages: Object.keys(tr || {}), get: (l) => tr[l] },
    properties: { getProperty: () => (conf === null ? "" : JSON.stringify({ NBest: [{ Confidence: conf }] })) },
  });

  class FakeRecognizer {
    constructor(cfg, audio, auto) {
      this.cfg = cfg; this.audio = audio; this.auto = auto;
      this.targetLanguages = [...cfg.targets];
      this.started = false; this.stopped = false; this.closed = false; this.authorizationToken = cfg.token;
      this.added = []; this.removed = [];
      log.recognizers.push(this);
    }
    startContinuousRecognitionAsync(ok, fail) {
      if (sdk.failStart || sdk.failNextStarts > 0) { if (sdk.failNextStarts > 0) sdk.failNextStarts -= 1; fail("could not start"); return; }
      this.started = true; ok();
    }
    stopContinuousRecognitionAsync(ok) { this.stopped = true; if (ok) ok(); }
    close() { this.closed = true; }
    addTargetLanguage(l) { this.added.push(l); this.targetLanguages.push(l); }
    removeTargetLanguage(l) { this.removed.push(l); this.targetLanguages = this.targetLanguages.filter((x) => x !== l); }
    // ---- what the test can make Azure do ----
    say(text, tr, extra) { this.recognizing && this.recognizing(null, { result: resultOf(text, tr, extra) }); }
    finish(text, tr, extra) { this.recognized && this.recognized(null, { result: resultOf(text, tr, extra) }); }
    nothing() { this.recognized && this.recognized(null, { result: resultOf("", {}, { reason: sdk.ResultReason.NoMatch }) }); }
    fail() { this.canceled && this.canceled(null, { reason: sdk.CancellationReason.Error, errorDetails: "x" }); }
    endOfStream() { this.canceled && this.canceled(null, { reason: sdk.CancellationReason.EndOfStream }); }
    begin() { this.sessionStarted && this.sessionStarted(); }
  }
  sdk.TranslationRecognizer = class {
    static FromConfig(cfg, auto, audio) { return new FakeRecognizer(cfg, audio, auto); }
    constructor(cfg, audio) { return new FakeRecognizer(cfg, audio, null); }
  };

  // ---- speech synthesis (the translated voice) ----
  sdk.SpeechConfig = { fromAuthorizationToken: (token, region) => ({ token, region, speechSynthesisOutputFormat: null }) };
  sdk.SpeechSynthesisOutputFormat = { Riff24Khz16BitMonoPcm: "Riff24Khz16BitMonoPcm" };
  sdk.SpeechSynthesizer = class {
    constructor(cfg, audioConfig) { this.cfg = cfg; this.audioConfig = audioConfig; this.requests = []; this.fail = false; this.closed = false; log.synths.push(this); }
    speakSsmlAsync(ssml, ok, fail) {
      this.requests.push(ssml);
      if (this.fail) { ok({ reason: 1, errorDetails: "synthesis failed" }); return; }
      ok({ reason: sdk.ResultReason.SynthesizingAudioCompleted, audioData: new ArrayBuffer(8) });
    }
    close() { this.closed = true; }
  };
  return sdk;
}
