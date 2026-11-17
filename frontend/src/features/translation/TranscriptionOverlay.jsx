// Everything that sits ON the call screen while the live transcript is running:
//   • the "Transcribing" badge (always visible)
//   • the notice "This call is being transcribed." (can be closed; closing it does not stop anything)
//   • the doctor hint, the "speech cannot be transcribed" banner for the doctor, and "Subtitles unavailable, reconnecting…"
//   • the subtitles
// Nothing is drawn unless the engine is running, so with the feature off the call screen is exactly as it was.
import { useMemo, useState } from "react";
import { FiVolume2, FiX } from "react-icons/fi";
import { LANGUAGE_LIST } from "./languages.js";
import { SPEAKING_TEXT, TRANSLATING_TEXT, TRANSLATION_UNAVAILABLE } from "./realVoiceGuard.js";
import { DIDNT_CATCH_TEXT, MACHINE_TRANSLATED, NOTICE_LINE_1, NOTICE_LINE_2, NOT_UNDERSTOOD_TEXT, RECONNECTING_TEXT, WRONG_LANGUAGE_HINT, peerUnsupportedNote } from "./uiModel.js";
import "./translation.css";

const SHOWN_PHASES = new Set(["running", "unavailable"]);

export function Subtitles({ subtitle }) {
  if (!subtitle || !subtitle.text) return null;
  return (
    <div className="hc-tr__subtitles" role="status" aria-live="polite">
      <p className={`hc-tr__subtitle ${subtitle.lighter ? "hc-tr__subtitle--lighter" : ""} ${subtitle.final ? "" : "hc-tr__subtitle--partial"}`} dir="auto">
        {subtitle.unclear && <em className="hc-tr__unclear">(unclear) </em>}{subtitle.text}
      </p>
      <span className="hc-tr__machine">{MACHINE_TRANSLATED}</span>
    </div>
  );
}

// "Which language will you speak?" - one tap at the start of the call, can be skipped. It decides what MY recognizer listens for; it is
// separate from the language I want to HEAR (the LANGUAGE button). The browser's language is highlighted as the suggestion.
export function SpeakPrompt({ state, onAnswer }) {
  const [other, setOther] = useState(false);
  const options = useMemo(() => LANGUAGE_LIST.filter((l) => l.canTranscribe && l.code !== "hi" && l.code !== "en"), []);
  if (!state || state.speakAsked || state.phase !== "running") return null;
  const suggested = state.speakSuggestion;
  const btn = (code, label) => (
    <button type="button" className={`hc-tr__small-btn ${suggested === code ? "hc-tr__small-btn--primary" : ""}`} onClick={() => onAnswer(code)} aria-pressed={suggested === code}>{label}</button>
  );
  return (
    <div className="hc-tr__hint" role="group" aria-label="Which language will you speak?">
      <span>Which language will you speak?</span>
      <span className="hc-tr__actions">
        {btn("hi", "Hindi")}
        {btn("en", "English")}
        {!other && <button type="button" className="hc-tr__small-btn" onClick={() => setOther(true)}>Other…</button>}
        {other && (
          <select className="hc-tr__small-btn" aria-label="Other language" defaultValue="" onChange={(e) => e.target.value && onAnswer(e.target.value)}>
            <option value="" disabled>Choose…</option>
            {options.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
        )}
        <button type="button" className="hc-tr__small-btn" onClick={() => onAnswer("none")}>Skip</button>
      </span>
    </div>
  );
}

export function TranscribingBadge() {
  return (
    <span className="hc-tr__badge" role="status" aria-label="This call is being transcribed">
      <span className="hc-tr__badge-dot" aria-hidden="true" />
      Transcribing
    </span>
  );
}

export function TranscribingNotice({ onDismiss }) {
  return (
    <div className="hc-tr__notice" role="region" aria-label="Transcription notice">
      <div className="hc-tr__notice-text">
        <strong>{NOTICE_LINE_1}</strong>
        <span>{NOTICE_LINE_2}</span>
      </div>
      <button type="button" className="hc-tr__close" onClick={onDismiss} aria-label="Close this notice">
        <FiX />
      </button>
    </div>
  );
}

export function ReconnectingNotice() {
  return (
    <div className="hc-tr__reconnect" role="status">
      {RECONNECTING_TEXT}
    </div>
  );
}

// Tells the listener what the translated voice is doing, or that they are hearing the original voice because translation cannot deliver.
export function TranslationStatus({ status }) {
  if (status === "unavailable") return <div className="hc-tr__reconnect" role="alert">{TRANSLATION_UNAVAILABLE}</div>;
  if (status === "waiting") return <div className="hc-tr__translating" role="status">{TRANSLATING_TEXT}</div>;
  if (status === "speaking") return <div className="hc-tr__translating" role="status"><FiVolume2 aria-hidden="true" /> {SPEAKING_TEXT}</div>;
  return null;
}

export function DoctorHint({ hint, onTurnOn, onDismiss }) {
  if (!hint) return null;
  return (
    <div className="hc-tr__hint" role="alert">
      <span>Patient is speaking {hint.name}. Turn on translation?</span>
      <span className="hc-tr__actions">
        <button type="button" className="hc-tr__small-btn hc-tr__small-btn--primary" onClick={onTurnOn}>Turn on</button>
        <button type="button" className="hc-tr__small-btn" onClick={onDismiss}>Not now</button>
      </span>
    </div>
  );
}

// state / actions come from useTranscription(); role is "doctor" or "patient"; ownLanguageCode is the language "Turn on" picks for the doctor.
export default function TranscriptionOverlay({ state, actions, role, ownLanguageCode = "en" }) {
  const [noticeClosed, setNoticeClosed] = useState(false);
  if (!state || !SHOWN_PHASES.has(state.phase)) return null;

  const banner = peerUnsupportedNote(role, state.peerSpeechLang);
  const turnOn = () => {
    actions.unlockAudio(); // inside the tap
    actions.setReadLanguage(ownLanguageCode);
    actions.dismissHint();
  };

  return (
    <>
      <div className="hc-tr__top">
        <TranscribingBadge />
        {!noticeClosed && <TranscribingNotice onDismiss={() => setNoticeClosed(true)} />}
        {state.reconnecting && <ReconnectingNotice />}
        {state.listenNote === "didnt_catch" && <div className="hc-tr__reconnect" role="alert">{DIDNT_CATCH_TEXT}</div>}
        {state.speakNote === "not_understood" && <div className="hc-tr__reconnect" role="alert">{NOT_UNDERSTOOD_TEXT}</div>}
        {state.fellBackToDetection && state.readLang !== "none" && <div className="hc-tr__banner" role="status">{WRONG_LANGUAGE_HINT}</div>}
        <TranslationStatus status={state.translationStatus} />
        {banner && <div className="hc-tr__banner" role="status">{banner}</div>}
        <SpeakPrompt state={state} onAnswer={(code) => actions.setSpeakLanguage(code)} />
        <DoctorHint hint={role === "doctor" ? state.hint : null} onTurnOn={turnOn} onDismiss={actions.dismissHint} />
      </div>
      <Subtitles subtitle={state.subtitle} />
    </>
  );
}
