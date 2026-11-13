// React wrapper around the engine. Deliberately thin: all the behaviour is in engine.js, which is tested without React.
//
// With the feature OFF (`active` false) this hook creates nothing, loads nothing, subscribes to nothing and returns a fixed "off" state
// and no-op actions: a call screen that uses it behaves exactly as before.
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { createTranscriptionEngine } from "./engine.js";
import { loadSpeechSdk } from "./loadSpeechSdk.js";

export const OFF_STATE = Object.freeze({
  phase: "off",
  recognizerStatus: "idle",
  reconnecting: false,
  readLang: "none",
  subtitlesEnabled: true,
  voiceEnabled: true,
  voiceBreakerTripped: false,
  peerReadLang: "none",
  muted: false,
  subtitle: null,
  hint: null,
  transcript: Object.freeze([]),
  unsupportedSpeech: false,
  fellBackToDetection: false,
  notice: "idle",
  realVoiceMuted: false,
  translationStatus: "off",
  fallbackReason: null,
  listenNote: null, // "didnt_catch": a sentence of the other person was too unclear to translate
  speakNote: null, // "not_understood": my own speech was not understood
});

const noop = () => {};
export const OFF_ACTIONS = Object.freeze({
  start: noop, stop: noop, unlockAudio: noop, setReadLanguage: noop, setSubtitlesEnabled: noop, setVoiceEnabled: noop, setMuted: noop,
  swapMicStream: noop, dismissHint: noop, onPeerJoined: noop, onSocketReconnected: noop,
});

const offSubscribe = () => noop;
const offSnapshot = () => OFF_STATE;

// params: { active, role, appointmentId, config, http, socket, getLocalStream, getRemoteElements, browserLanguages, profileCountry }
// Returns { active, state, actions }. Call actions.start() once the call is connected and the local microphone exists.
export function useTranscription(params) {
  const { active, role, appointmentId, config, http, socket, getLocalStream, getRemoteElements, browserLanguages, profileCountry } = params || {};
  // Creating an engine only builds objects: no network, no timers, no listeners until start() is called. So it is safe to create it
  // while rendering, and the effect below only has to stop it when the call screen goes away.
  const engine = useMemo(() => {
    if (!active || !appointmentId || !socket || !http) return null;
    return createTranscriptionEngine({
      role,
      appointmentId,
      config,
      http,
      socket,
      loadSdk: loadSpeechSdk,
      createAudioContext: () => new (window.AudioContext || window.webkitAudioContext)(),
      getLocalStream,
      getRemoteElements,
      browserLanguages: browserLanguages || (typeof navigator !== "undefined" ? navigator.languages || [navigator.language] : []),
      profileCountry,
    });
    // The engine belongs to one call and one person; a changed config object alone must not replace it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, appointmentId, role, socket, http]);

  useEffect(() => {
    if (!engine) return undefined;
    return () => { engine.stop(); }; // sends whatever transcript is left and releases everything (a no-op if it never started)
  }, [engine]);

  const state = useSyncExternalStore(engine ? engine.subscribe : offSubscribe, engine ? engine.getState : offSnapshot, offSnapshot);

  return {
    active: Boolean(engine),
    state,
    actions: engine
      ? {
          start: () => engine.start(),
          stop: () => engine.stop(),
          unlockAudio: () => engine.unlockAudio(),
          setReadLanguage: (code) => engine.setReadLanguage(code),
          setSubtitlesEnabled: (on) => engine.setSubtitlesEnabled(on),
          setVoiceEnabled: (on) => engine.setVoiceEnabled(on),
          setMuted: (on) => engine.setMuted(on),
          swapMicStream: (stream) => engine.swapMicStream(stream),
          dismissHint: () => engine.dismissHint(),
          onPeerJoined: () => engine.onPeerJoined(),
          onSocketReconnected: () => engine.onSocketReconnected(),
        }
      : OFF_ACTIONS,
  };
}
