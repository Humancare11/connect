// The live transcript: every finished sentence of the call, with who said it, the time, the original words and the translation.
// This is the call's live view. The saved transcript (the record) is shown in the doctor's and the admin's dashboards.
import { useEffect, useRef } from "react";
import { FiX } from "react-icons/fi";
import { MACHINE_TRANSLATED, formatClock, speakerLabel, translationFor, visibleTranscript } from "./uiModel.js";
import "./translation.css";

export default function TranscriptPanel({ open, onClose, state }) {
  const endRef = useRef(null);
  const lines = visibleTranscript(state.transcript);

  useEffect(() => {
    if (open && endRef.current && endRef.current.scrollIntoView) endRef.current.scrollIntoView({ block: "end" });
  }, [open, lines.length]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <aside className="hc-tr__panel" role="dialog" aria-label="Live transcript">
      <div className="hc-tr__panel-head">
        <h2 className="hc-tr__panel-title">Transcript</h2>
        <button type="button" className="hc-tr__close" onClick={onClose} aria-label="Close the transcript">
          <FiX />
        </button>
      </div>

      <div className="hc-tr__panel-body">
        {lines.length === 0 ? (
          <p className="hc-tr__empty">The conversation will appear here as people speak.</p>
        ) : (
          <ul className="hc-tr__lines" aria-live="polite" data-lenis-prevent>
            {lines.map((e, i) => {
              const translation = translationFor(e, state.readLang);
              return (
                <li key={`${e.id}-${i}`} className={e.tier === "low" ? "hc-tr__line--lighter" : ""}>
                  <div className="hc-tr__line-meta">
                    <span className={`hc-tr__line-who ${e.who === "me" ? "hc-tr__line-who--me" : ""}`}>{speakerLabel(e)}</span>
                    <time>{formatClock(e.at)}</time>
                  </div>
                  <p className="hc-tr__line-text" dir="auto">{e.text}</p>
                  {translation && <p className="hc-tr__line-translation" dir="auto">{translation}</p>}
                </li>
              );
            })}
            <li ref={endRef} aria-hidden="true" />
          </ul>
        )}
      </div>

      <div className="hc-tr__foot">{MACHINE_TRANSLATED}</div>
    </aside>
  );
}
