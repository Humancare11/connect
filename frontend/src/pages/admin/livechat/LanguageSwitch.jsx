// Original | English switch for a non-English chat (this admin only; the patient never sees it). Lives in the
// composer toolbar, and in the read-only bar on the Archive page. The choice is remembered per chat by the caller.
export default function LanguageSwitch({ view, onChoose, translating }) {
  return (
    <span className="cm-view">
      <span className="wk-seg" role="group" aria-label="Message language">
        <button type="button" aria-pressed={view === "original"} onClick={() => onChoose("original")}>
          Original
        </button>
        <button type="button" aria-pressed={view === "en"} onClick={() => onChoose("en")}>
          English
        </button>
      </span>
      {translating && <span className="wk-small wk-muted">Translating…</span>}
    </span>
  );
}
