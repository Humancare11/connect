// The LANGUAGE panel: "Real voice (no translation)" is the first and default choice; every other language is a search away.
//
// Picking a language is the tap that lets sound play later (iPhone), so the audio is unlocked inside the click, then the language is set.
// The two toggles only matter once a language is picked.
import { useEffect, useRef, useState } from "react";
import { FiSearch, FiX } from "react-icons/fi";
import { NONE } from "./languages.js";
import { LANGUAGE_HELP, MACHINE_TRANSLATED, buildLanguageRows, selectedNote } from "./uiModel.js";
import "./translation.css";

export default function LanguagePanel({ open, onClose, state, actions }) {
  const [query, setQuery] = useState("");
  const searchRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    searchRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const picked = state.readLang && state.readLang !== NONE;
  const { rows, noResults } = buildLanguageRows({ query, selected: state.readLang });

  const choose = (code) => {
    actions.unlockAudio(); // inside the tap, so the translated voice is allowed to play later
    actions.setReadLanguage(code);
  };

  return (
    <aside className="hc-tr__panel" role="dialog" aria-label="Language">
      <div className="hc-tr__panel-head">
        <h2 className="hc-tr__panel-title">Language</h2>
        <button type="button" className="hc-tr__close" onClick={onClose} aria-label="Close the language panel">
          <FiX />
        </button>
      </div>

      <div className="hc-tr__panel-body">
        <p className="hc-tr__help">{LANGUAGE_HELP}</p>

        <div style={{ position: "relative" }}>
          <input
            ref={searchRef}
            type="search"
            className="hc-tr__search"
            placeholder="Search languages"
            aria-label="Search languages"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <FiSearch aria-hidden="true" style={{ position: "absolute", right: 12, top: 11, color: "#5a7a96", pointerEvents: "none" }} />
        </div>

        {/* data-lenis-prevent: the page's smooth-scroll library would otherwise swallow the mouse wheel over this list */}
        <ul className="hc-tr__list" role="radiogroup" aria-label="Languages" data-lenis-prevent>
          {rows.map((row) => (
            <li key={row.code} role="presentation">
              <button
                type="button"
                role="radio"
                aria-checked={row.selected}
                className={`hc-tr__option ${row.selected ? "hc-tr__option--selected" : ""} ${row.isNone ? "hc-tr__option--none" : ""}`}
                onClick={() => choose(row.code)}
              >
                <span>{row.name}</span>
                {row.isNone && <span className="hc-tr__option-native">{row.help}</span>}
                {!row.isNone && row.nativeName && row.nativeName !== row.name && (
                  <span className="hc-tr__option-native" lang={row.code} dir={row.rtl ? "rtl" : "auto"}>{row.nativeName}</span>
                )}
                {row.note && <span className="hc-tr__option-note">{row.note}</span>}
              </button>
            </li>
          ))}
          {noResults && <li className="hc-tr__empty">No language matches “{query}”.</li>}
        </ul>

        <p className="hc-tr__help" aria-live="polite">{selectedNote(state.readLang)}</p>

        <div className="hc-tr__toggles">
          <label className={`hc-tr__toggle ${picked ? "" : "hc-tr__toggle--disabled"}`}>
            <input type="checkbox" checked={state.subtitlesEnabled} disabled={!picked} onChange={(e) => actions.setSubtitlesEnabled(e.target.checked)} />
            Show subtitles
          </label>
          <label className={`hc-tr__toggle ${picked ? "" : "hc-tr__toggle--disabled"}`}>
            <input type="checkbox" checked={state.voiceEnabled && !state.voiceBreakerTripped} disabled={!picked} onChange={(e) => actions.setVoiceEnabled(e.target.checked)} />
            Hear translated voice
          </label>
          {state.voiceBreakerTripped && (
            <p className="hc-tr__voice-off" role="status">The translated voice was switched off because it was being picked up by your microphone. You can switch it on again.</p>
          )}
        </div>
      </div>

      <div className="hc-tr__foot">{MACHINE_TRANSLATED}</div>
    </aside>
  );
}
