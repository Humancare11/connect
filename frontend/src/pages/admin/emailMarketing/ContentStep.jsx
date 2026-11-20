import { useRef } from "react";
import { insertAtCursor } from "./marketingUtils";

const MAX_FILE_BYTES = 1_000_000;

// Step 2: subject and the HTML design (pasted or uploaded), placeholders with their fallbacks.
export default function ContentStep({
  subject, setSubject, html, setHtml, cmode, setCmode, htmlName, setHtmlName,
  fallbackName, setFallbackName, fallbackCompany, setFallbackCompany, onFileError,
}) {
  const taRef = useRef(null);

  const insert = (placeholder) => {
    if (cmode !== "paste") return setCmode("paste");
    const ta = taRef.current;
    const { value, cursor } = insertAtCursor(html, ta?.selectionStart, ta?.selectionEnd, placeholder);
    setHtml(value);
    requestAnimationFrame(() => {
      if (!taRef.current) return;
      taRef.current.focus();
      taRef.current.selectionStart = taRef.current.selectionEnd = cursor;
    });
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return onFileError("That file is too large (limit 1 MB).");
    const reader = new FileReader();
    reader.onload = () => {
      setHtml(String(reader.result || ""));
      setHtmlName(file.name);
    };
    reader.readAsText(file);
  };

  return (
    <>
      <div className="mk-field">
        <label htmlFor="mk-subject">Subject</label>
        <input className="mk-inp" id="mk-subject" value={subject} maxLength={300} onChange={(e) => setSubject(e.target.value)} />
        <small>You can use <span className="mk-phchip">{"{{name}}"}</span> in the subject too.</small>
      </div>

      <div className="mk-field">
        <span className="mk-flabel">Email design (HTML)</span>
        <div className="mk-ph">
          <div className="mk-tabs">
            <button type="button" className={cmode === "paste" ? "on" : ""} onClick={() => setCmode("paste")}>Paste HTML</button>
            <button type="button" className={cmode === "file" ? "on" : ""} onClick={() => setCmode("file")}>Upload .html file</button>
          </div>
          <span className="mk-sp" />
          <button type="button" className="mk-btn mk-btn-g mk-btn-s" onClick={() => insert("{{name}}")}>+ Insert <span className="mk-phchip">{"{{name}}"}</span></button>
          <button type="button" className="mk-btn mk-btn-g mk-btn-s" onClick={() => insert("{{company}}")}>+ Insert <span className="mk-phchip">{"{{company}}"}</span></button>
        </div>
        {cmode === "paste" ? (
          <textarea ref={taRef} className="mk-ta code" spellCheck="false" aria-label="Email design (HTML)" value={html} onChange={(e) => setHtml(e.target.value)} />
        ) : (
          <div className="mk-drop">
            <input type="file" accept=".html,.htm,text/html" aria-label="Upload HTML file" onChange={onFile} />
            <svg className="mk-ico" viewBox="0 0 24 24" style={{ width: 26, height: 26 }} aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
            <div><b>{htmlName || "Drop an .html file here or click to choose"}</b></div>
            <small>An HTML file exported from Mailchimp, Canva or any email editor.</small>
          </div>
        )}
        <small>Scripts and anything else email apps do not run are removed automatically when you continue.</small>
      </div>

      <div className="mk-grid2">
        <div className="mk-field">
          <label htmlFor="mk-fb-name">If a name is missing, use</label>
          <input className="mk-inp" id="mk-fb-name" value={fallbackName} maxLength={60} onChange={(e) => setFallbackName(e.target.value)} placeholder="there" />
          <small>For example "Hello there," when the list has no name.</small>
          <label htmlFor="mk-fb-company" style={{ marginTop: 8 }}>If a company is missing, use</label>
          <input className="mk-inp" id="mk-fb-company" value={fallbackCompany} maxLength={60} onChange={(e) => setFallbackCompany(e.target.value)} placeholder="(leave empty for nothing)" />
        </div>
        <div className="mk-field">
          <span className="mk-flabel">Added automatically</span>
          <div className="mk-checks">
            <div><span className="mk-ok-i">✓</span>An unsubscribe link at the bottom of every email</div>
            <div><span className="mk-ok-i">✓</span>Hidden tracking of opens and link clicks</div>
            <div><span className="mk-ok-i">✓</span>Replies go to this Mail ID’s Gmail inbox</div>
          </div>
        </div>
      </div>
    </>
  );
}
