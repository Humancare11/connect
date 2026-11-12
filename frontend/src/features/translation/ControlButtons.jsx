// The two buttons for the call's control bar (and its mobile drawer). They reuse the call screen's own button classes (hc-vc__btn...), so
// they look exactly like MUTE, CAM OFF, SHARE and the rest.
import { FiFileText, FiGlobe } from "react-icons/fi";
import { NONE } from "./languages.js";
import { languageBadge } from "./uiModel.js";
import "./translation.css";

export function LanguageButton({ language = NONE, open = false, onClick, disabled = false }) {
  const picked = language && language !== NONE;
  const badge = languageBadge(language);
  return (
    <button
      type="button"
      className={`hc-vc__btn ${picked || open ? "hc-vc__btn--active" : ""}`}
      onClick={onClick}
      disabled={disabled}
      title="Language: read and hear the other person in your language"
      aria-haspopup="dialog"
      aria-expanded={open}
    >
      <span className="hc-vc__btn-icon">
        <FiGlobe />
      </span>
      <span className="hc-vc__btn-label">Language</span>
      {badge && (
        <span className="hc-vc__badge" aria-label={`Language ${badge}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

export function TranscriptButton({ open = false, onClick, disabled = false }) {
  return (
    <button
      type="button"
      className={`hc-vc__btn ${open ? "hc-vc__btn--chat-on" : ""}`}
      onClick={onClick}
      disabled={disabled}
      title="Live transcript of this call"
      aria-haspopup="dialog"
      aria-expanded={open}
    >
      <span className="hc-vc__btn-icon">
        <FiFileText />
      </span>
      <span className="hc-vc__btn-label">Transcript</span>
    </button>
  );
}
