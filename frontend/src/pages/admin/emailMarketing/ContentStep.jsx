import { useRef, useState } from "react";
import { marketingApi } from "../../../api/emailMarketingApi";
import { insertAtCursor, tabSwitchPlan, errorMessage, MY_SIGNATURE_PATH } from "./marketingUtils";

const MAX_FILE_BYTES = 1_000_000;

// Step 2: subject and the design (typed text, pasted HTML or an uploaded file), the signature, placeholders with fallbacks.
export default function ContentStep({
  subject, setSubject, html, setHtml, cmode, setCmode, htmlName, setHtmlName, sourceText, setSourceText,
  signature, addSignature, setAddSignature,
  fallbackName, setFallbackName, fallbackCompany, setFallbackCompany, onFileError,
}) {
  const taRef = useRef(null);
  // A tab change that would lose something waits here for the admin's choice: { to, kind: "replace" | "choose" }.
  const [pending, setPending] = useState(null);
  const [converting, setConverting] = useState(false);

  const insert = (placeholder) => {
    if (cmode === "file") return setCmode("paste");
    const ta = taRef.current;
    const current = cmode === "text" ? sourceText : html;
    const { value, cursor } = insertAtCursor(current, ta?.selectionStart, ta?.selectionEnd, placeholder);
    (cmode === "text" ? setSourceText : setHtml)(value);
    requestAnimationFrame(() => {
      if (!taRef.current) return;
      taRef.current.focus();
      taRef.current.selectionStart = taRef.current.selectionEnd = cursor;
    });
  };

  const switchTo = (to) => {
    const kind = tabSwitchPlan({ from: cmode, to, html, sourceText });
    if (kind === "none") return setCmode(to);
    setPending({ to, kind });
  };
  const finishSwitch = (to, { clearHtml = false } = {}) => {
    if (clearHtml) setHtml("");
    setHtmlName("");
    setCmode(to);
    setPending(null);
  };
  // Write text -> an HTML tab: turn the typed text into HTML (the same conversion the server uses) and carry on from there.
  const convertThenSwitch = async (to) => {
    setConverting(true);
    try {
      const r = await marketingApi.textToHtml(sourceText);
      setHtml(r.html || "");
      setHtmlName("");
      setCmode(to);
      setPending(null);
    } catch (err) {
      onFileError(errorMessage(err, "The text could not be converted."));
      setPending(null);
    } finally {
      setConverting(false);
    }
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
            <button type="button" className={cmode === "paste" ? "on" : ""} onClick={() => switchTo("paste")}>Paste HTML</button>
            <button type="button" className={cmode === "file" ? "on" : ""} onClick={() => switchTo("file")}>Upload .html file</button>
            <button type="button" className={cmode === "text" ? "on" : ""} onClick={() => switchTo("text")}>Write text</button>
          </div>
          <span className="mk-sp" />
          <button type="button" className="mk-btn mk-btn-g mk-btn-s" onClick={() => insert("{{name}}")}>+ Insert <span className="mk-phchip">{"{{name}}"}</span></button>
          <button type="button" className="mk-btn mk-btn-g mk-btn-s" onClick={() => insert("{{company}}")}>+ Insert <span className="mk-phchip">{"{{company}}"}</span></button>
        </div>
        {pending && (
          <div className="mk-callout warn" role="alert" style={{ marginBottom: 8 }}>
            <div>
              {pending.kind === "replace" ? (
                <>
                  <b>Your HTML will be replaced.</b> The email will be made from the text you type instead.
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <button type="button" className="mk-btn mk-btn-p mk-btn-s" onClick={() => finishSwitch(pending.to, { clearHtml: true })}>Replace and write text</button>
                    <button type="button" className="mk-btn mk-btn-g mk-btn-s" onClick={() => setPending(null)}>Keep my HTML</button>
                  </div>
                </>
              ) : (
                <>
                  <b>You have written text.</b> What should happen to it?
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <button type="button" className="mk-btn mk-btn-p mk-btn-s" disabled={converting} onClick={() => convertThenSwitch(pending.to)}>{converting ? "Converting…" : "Convert my text to HTML first"}</button>
                    <button type="button" className="mk-btn mk-btn-g mk-btn-s" disabled={converting} onClick={() => finishSwitch(pending.to, { clearHtml: true })}>Start empty</button>
                    <button type="button" className="mk-btn mk-btn-g mk-btn-s" disabled={converting} onClick={() => setPending(null)}>Cancel</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        {cmode === "text" ? (
          <>
            <textarea
              ref={taRef} className="mk-ta" spellCheck="true" aria-label="Email text" value={sourceText} maxLength={50000}
              placeholder={"Hello {{name}},\n\nWrite your message here. A blank line starts a new paragraph.\n\nLinks such as https://humancareconnect.co become clickable."}
              onChange={(e) => setSourceText(e.target.value)}
            />
            <small>We turn this into a clean, simple email layout for you. Nothing you type is treated as code.</small>
          </>
        ) : cmode === "paste" ? (
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

      <div className="mk-field">
        <label className="mk-chk">
          <input type="checkbox" checked={addSignature} onChange={(e) => setAddSignature(e.target.checked)} />
          <span>Add my signature</span>
        </label>
        {addSignature && signature?.hasImage && signature.previewUrl && (
          <div style={{ marginTop: 6 }}>
            <img src={signature.previewUrl} alt="Your signature" style={{ width: Math.min(signature.displayWidth || 210, 210), height: "auto", display: "block", border: "1px solid var(--mk-line)", borderRadius: 6 }} />
            <small>Added after your message, before the unsubscribe footer. It is the signature of whoever presses Send.</small>
          </div>
        )}
        {addSignature && signature && !signature.hasImage && (
          <small>
            You have no signature yet, so none will be added.{" "}
            <a href={MY_SIGNATURE_PATH} target="_blank" rel="noopener noreferrer">My signature</a>
          </small>
        )}
        {!addSignature && <small>Your signature (from My signature on the Email page) is added after the message when this is ticked.</small>}
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
