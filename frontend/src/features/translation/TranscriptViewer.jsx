// The saved transcript of one appointment, read-only, for the doctor's and the admin's dashboards.
//
// Nothing is requested until the button is pressed (every open is an audited read on the server). Admins and superadmins also get
// "Delete transcript": a reason (3 to 300 characters) and a second, explicit confirmation. The patient never sees this.
import { useCallback, useEffect, useRef, useState } from "react";
import { FiFileText, FiX } from "react-icons/fi";
import { MACHINE_TRANSLATED_NOTE, buildTranscriptView, deleteTranscript, fetchTranscript, summaryNotes } from "./transcriptViewModel.js";
import { formatClock } from "./uiModel.js";
import "./translation.css";

const fmtDay = (v) => { const d = new Date(v); return Number.isFinite(d.getTime()) ? d.toLocaleDateString() : ""; };

export function TranscriptBody({ view }) {
  const notes = summaryNotes(view);
  return (
    <>
      {notes.length > 0 && (
        <ul className="hc-tr__viewer-notes" aria-label="Things to know about this transcript">
          {notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}
      {view.isEmpty ? (
        <p className="hc-tr__empty">There is no saved transcript for this appointment.</p>
      ) : (
        <ol className="hc-tr__viewer-list" data-lenis-prevent>
          {view.items.map((it) =>
            it.type === "gap" ? (
              <li key={it.id} className="hc-tr__gap">
                <span>{it.speaker}: {it.label}</span>
                <time>{formatClock(new Date(it.at).getTime())}</time>
              </li>
            ) : (
              <li key={it.id} className={it.lighter ? "hc-tr__line--lighter" : ""}>
                <div className="hc-tr__line-meta">
                  <span className="hc-tr__line-who">{it.speaker}</span>
                  <time>{fmtDay(it.at)} {formatClock(new Date(it.at).getTime())}</time>
                  {it.language && <span>{it.language}</span>}
                </div>
                <p className="hc-tr__line-text" dir="auto">{it.text === null || it.text === undefined ? "(could not be read)" : it.text}</p>
                {it.english && <p className="hc-tr__line-translation" dir="auto">{it.english}</p>}
                {it.marks.length > 0 && (
                  <div className="hc-tr__marks">
                    {it.marks.map((m) => <span key={m.key} className={`hc-tr__mark hc-tr__mark--${m.tone}`}>{m.label}</span>)}
                  </div>
                )}
              </li>
            ),
          )}
        </ol>
      )}
    </>
  );
}

export default function TranscriptViewer({ appointmentId, http, canDelete = false, label = "Transcript" }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonMsg, setReasonMsg] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deletedCount, setDeletedCount] = useState(null);
  const closeRef = useRef(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await fetchTranscript(http, appointmentId);
    if (!alive.current) return;
    setView(result.view || null);
    setError(result.error || "");
    setLoading(false);
  }, [http, appointmentId]);

  const openIt = () => { setOpen(true); setDeletedCount(null); setConfirming(false); setReason(""); setReasonMsg(""); load(); };
  const close = useCallback(() => { setOpen(false); setView(null); setError(""); setConfirming(false); }, []);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape" && !deleting) close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close, deleting]);

  const doDelete = async () => {
    setDeleting(true);
    const result = await deleteTranscript(http, appointmentId, reason);
    if (!alive.current) return;
    setDeleting(false);
    if (result.error) { setReasonMsg(result.error); return; }
    setReasonMsg("");
    setDeletedCount(result.deleted);
    setConfirming(false);
    setView(buildTranscriptView({}));
  };

  return (
    <>
      <button type="button" className="da-btn hc-tr__viewer-open" onClick={(e) => { e.stopPropagation(); openIt(); }}>
        <FiFileText aria-hidden="true" /> {label}
      </button>
      {open && (
        <div className="hc-tr__viewer-backdrop" onClick={(e) => { e.stopPropagation(); if (!deleting) close(); }}>
          <div className="hc-tr__viewer" role="dialog" aria-modal="true" aria-label="Call transcript" onClick={(e) => e.stopPropagation()}>
            <div className="hc-tr__panel-head">
              <h2 className="hc-tr__panel-title">Call transcript</h2>
              <button type="button" ref={closeRef} className="hc-tr__close" onClick={close} aria-label="Close the transcript" disabled={deleting}>
                <FiX />
              </button>
            </div>
            <div className="hc-tr__viewer-body">
              {loading && <p className="hc-tr__empty" role="status">Loading…</p>}
              {error && <p className="hc-tr__viewer-error" role="alert">{error} <button type="button" className="hc-tr__small-btn" onClick={load}>Try again</button></p>}
              {deletedCount !== null && <p className="hc-tr__viewer-ok" role="status">Transcript deleted ({deletedCount} saved item{deletedCount === 1 ? "" : "s"} removed). The deletion and your reason are recorded.</p>}
              {view && !loading && deletedCount === null && <TranscriptBody view={view} />}
            </div>
            <div className="hc-tr__foot">
              <span>{MACHINE_TRANSLATED_NOTE}. Only the doctor of this appointment and administrators can read this transcript.</span>
              {canDelete && view && !view.isEmpty && deletedCount === null && !confirming && (
                <button type="button" className="hc-tr__small-btn hc-tr__small-btn--danger" onClick={() => setConfirming(true)}>Delete transcript…</button>
              )}
            </div>
            {confirming && (
              <div className="hc-tr__confirm" role="alertdialog" aria-label="Confirm deleting the transcript">
                <p><strong>Delete the whole saved transcript of this appointment?</strong> This cannot be undone. The deletion, your name and the reason are recorded.</p>
                <label htmlFor="hc-tr-reason">Reason (required)</label>
                <textarea id="hc-tr-reason" rows={3} maxLength={400} value={reason} onChange={(e) => { setReason(e.target.value); setReasonMsg(""); }} disabled={deleting} />
                {reasonMsg && <p className="hc-tr__viewer-error" role="alert">{reasonMsg}</p>}
                <div className="hc-tr__actions">
                  <button type="button" className="hc-tr__small-btn hc-tr__small-btn--danger" onClick={doDelete} disabled={deleting}>{deleting ? "Deleting…" : "Yes, delete it"}</button>
                  <button type="button" className="hc-tr__small-btn" onClick={() => { setConfirming(false); setReasonMsg(""); }} disabled={deleting}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
