import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import emailApi, { apiMessage } from "../../../api/emailApi";
import { AttachmentList, Icon, TrackOpensToggle } from "./EmailParts";
import { ACCEPT_ATTR, EMAIL_RE, addFiles, newRequestId } from "./emailUtils";

// Gmail-style compose window: docked bottom-right, with a full-view toggle.
// Mounted by EmailLayout so a half-written mail survives moving between folders.
// "Sent by <admin>" is shown for information only — the server always records
// the logged-in admin, never anything sent from here.
export default function EmailComposer({ mailboxes, tracking, defaultMailboxId, adminName, onClose, onSent }) {
  const [from, setFrom] = useState(defaultMailboxId || mailboxes[0]?.id || "");
  // "Track opens" starts as the chosen mailbox's default until the admin touches the box.
  const [trackChoice, setTrackChoice] = useState(null);
  const mailboxDefault = mailboxes.find((m) => m.id === from)?.trackOpensDefault !== false;
  const trackOpens = trackChoice ?? mailboxDefault;
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState([]);
  const [full, setFull] = useState(false);
  const [error, setError] = useState("");
  // One idempotency key per compose window: a double-click or retry never sends twice.
  const requestId = useRef(newRequestId());
  const toRef = useRef(null);

  useEffect(() => {
    toRef.current?.focus();
  }, []);

  const dirty = Boolean(to || cc || subject || body || files.length);

  const close = () => {
    if (dirty && !window.confirm("Discard this message?")) return;
    onClose();
  };

  // Escape leaves full view first, then closes.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (full) setFull(false);
      else if (!dirty || window.confirm("Discard this message?")) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [full, dirty, onClose]);

  const send = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("from", from);
      fd.append("to", to.trim());
      fd.append("cc", cc.trim());
      fd.append("subject", subject.trim());
      fd.append("body", body.trim());
      fd.append("clientRequestId", requestId.current);
      if (tracking?.available) fd.append("trackOpens", trackOpens ? "1" : "0");
      files.forEach((f) => fd.append("files", f));
      return emailApi.send(fd);
    },
    onSuccess: (res) => onSent(res.message),
    onError: (err) => setError(apiMessage(err)),
  });

  const submit = (e) => {
    e.preventDefault();
    if (send.isPending) return;
    const recipients = to.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    if (!recipients.length || !recipients.every((r) => EMAIL_RE.test(r))) return setError("Enter a valid email address.");
    if (cc.trim() && !cc.split(/[,;]/).map((s) => s.trim()).filter(Boolean).every((r) => EMAIL_RE.test(r))) {
      return setError("One of the Cc addresses is not valid.");
    }
    if (!subject.trim() || !body.trim()) return setError("Subject and message are both required.");
    setError("");
    send.mutate();
  };

  const onFiles = (e) => {
    const result = addFiles(files, Array.from(e.target.files));
    setFiles(result.files);
    setError(result.error);
    e.target.value = "";
  };

  return (
    <>
      {full && <div className="em-c-scrim" onClick={() => setFull(false)} />}
      <div className={`em-compose${full ? " full" : ""}`} role="dialog" aria-labelledby="em-c-title">
        <div className="em-c-head">
          <span id="em-c-title">New Message</span>
          <span className="em-c-btns">
            <button type="button" onClick={() => setFull(!full)} aria-label={full ? "Exit full view" : "Full view"} title={full ? "Exit full view" : "Full view"}>
              <Icon name="expand" size={16} />
            </button>
            <button type="button" onClick={close} aria-label="Close" title="Close">
              ×
            </button>
          </span>
        </div>
        <form onSubmit={submit} noValidate>
          <div className="em-c-row">
            <label htmlFor="em-c-from">From</label>
            <select id="em-c-from" value={from} onChange={(e) => setFrom(e.target.value)}>
              {mailboxes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName} — {m.address}
                </option>
              ))}
            </select>
          </div>
          <div className="em-c-row">
            <label htmlFor="em-c-to">To</label>
            <input id="em-c-to" ref={toRef} type="text" inputMode="email" placeholder="client@example.com" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="em-c-row">
            <label htmlFor="em-c-cc">Cc</label>
            <input id="em-c-cc" type="text" inputMode="email" value={cc} onChange={(e) => setCc(e.target.value)} />
          </div>
          <div className="em-c-row">
            <input type="text" placeholder="Subject" aria-label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <textarea aria-label="Message" value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="em-c-foot">
            <AttachmentList items={files} onRemove={(i) => setFiles(files.filter((_, idx) => idx !== i))} />
            <button type="submit" className="em-btn em-btn-primary" disabled={send.isPending || !mailboxes.length}>
              {send.isPending ? "Sending…" : "Send"}
            </button>
            <label className="em-attach-lbl" title="Attach files">
              <input type="file" multiple accept={ACCEPT_ATTR} onChange={onFiles} aria-label="Attach files" />
              <Icon name="clip" />
            </label>
            <span className="em-hint">
              Sent by <b>{adminName}</b>
            </span>
            {tracking?.available && <TrackOpensToggle checked={trackOpens} onChange={setTrackChoice} disclosure={tracking.disclosure} />}
            {error && <div className="em-errtext" role="alert">{error}</div>}
          </div>
        </form>
      </div>
    </>
  );
}
