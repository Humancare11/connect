import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { getUserAuthToken } from "../api";
import { NOTE_FIELDS, emptyFields, fmtTime, missingRequired, pickFields } from "../utils/visitNote";
import "./VisitNoteEditor.css";

const DEBOUNCE_MS = 900;
const API_BASE = import.meta.env.VITE_API_URL || "";

/**
 * Structured consultation note (Symptoms, Clinical Findings, Plan / Treatment, Note) with auto-save.
 * Used on the doctor's Notes page (variant "page") and in the video-call notes panel (variant "panel").
 *
 * Every field auto-saves (debounced); only the changed fields are sent, the server merges them. Unsaved text is
 * flushed when the editor unmounts (call disconnect / navigation) and when the tab is hidden or closed.
 * A note that has been added to a Visit Note is read-only.
 */
export default function VisitNoteEditor({ appointmentId, variant = "page", onNoteChange, onDelete, showBadge = true }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [note, setNote] = useState(null); // server copy (id, status, reportId, updatedAt)
  const [fields, setFields] = useState(emptyFields());
  const [saveState, setSaveState] = useState({ phase: "idle", at: null, error: "" });
  const [highlight, setHighlight] = useState([]);
  const [reviewError, setReviewError] = useState("");

  const savedRef = useRef(emptyFields()); // what the server has
  const fieldsRef = useRef(fields);
  const inFlightRef = useRef(null);
  const timerRef = useRef(null);
  const lockedRef = useRef(false);
  const onChangeRef = useRef(onNoteChange);

  const finalised = !!note?.reportId;

  // Mirror render values into refs for the save / flush callbacks (which must not re-create on every keystroke).
  useEffect(() => {
    onChangeRef.current = onNoteChange;
    fieldsRef.current = fields;
    lockedRef.current = finalised;
  });

  // ── load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Callers give this component a key per appointment, so it always starts in the loading state.
    let cancelled = false;
    api
      .get(`/api/notes/appointment/${appointmentId}`, { authRole: "doctor" })
      .then((res) => {
        if (cancelled) return;
        const loaded = res.data?.note || null;
        const next = pickFields(loaded);
        setNote(loaded);
        setFields(next);
        savedRef.current = next;
        setSaveState({ phase: loaded?.updatedAt ? "saved" : "idle", at: loaded?.updatedAt || null, error: "" });
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.response?.data?.msg || "Could not load this note.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  // ── save ───────────────────────────────────────────────────────────────────
  const changedFields = useCallback(() => {
    const diff = {};
    for (const key of Object.keys(savedRef.current)) {
      if (fieldsRef.current[key] !== savedRef.current[key]) diff[key] = fieldsRef.current[key];
    }
    return diff;
  }, []);

  const save = useCallback(async () => {
    if (lockedRef.current) return;
    if (inFlightRef.current) {
      await inFlightRef.current;
      if (Object.keys(changedFields()).length === 0) return;
    }
    const diff = changedFields();
    if (Object.keys(diff).length === 0) return;
    setSaveState((s) => ({ ...s, phase: "saving", error: "" }));
    const request = api
      .put(`/api/notes/appointment/${appointmentId}`, diff, { authRole: "doctor" })
      .then((res) => {
        const saved = res.data?.note;
        savedRef.current = { ...savedRef.current, ...diff };
        setNote(saved);
        setSaveState({ phase: "saved", at: saved?.updatedAt || new Date().toISOString(), error: "" });
        onChangeRef.current?.(saved);
      })
      .catch((err) => {
        const msg = err.response?.data?.msg || "Could not save. Your text is kept here and will be retried automatically.";
        if (err.response?.status === 409) lockedRef.current = true;
        setSaveState((s) => ({ ...s, phase: "error", error: msg }));
      })
      .finally(() => {
        inFlightRef.current = null;
      });
    inFlightRef.current = request;
    await request;
  }, [appointmentId, changedFields]);

  // debounce on every change
  useEffect(() => {
    if (loading || finalised) return undefined;
    if (Object.keys(changedFields()).length === 0) return undefined;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(save, DEBOUNCE_MS);
    return () => clearTimeout(timerRef.current);
  }, [fields, loading, finalised, save, changedFields]);

  // A failed save (network drop) is retried on its own: when the browser comes back online and every few seconds
  // while the error stands, so text typed during an outage is saved without needing another keystroke.
  useEffect(() => {
    if (finalised) return undefined;
    const retry = () => {
      if (Object.keys(changedFields()).length > 0) save();
    };
    window.addEventListener("online", retry);
    const timer = saveState.phase === "error" ? setInterval(retry, 4000) : null;
    return () => {
      window.removeEventListener("online", retry);
      if (timer) clearInterval(timer);
    };
  }, [finalised, saveState.phase, save, changedFields]);

  // Flush when the tab is hidden / closed (keepalive fetch survives unload) and when this editor unmounts
  // (e.g. the call is disconnected and the panel disappears).
  useEffect(() => {
    const flushWithKeepalive = () => {
      if (lockedRef.current) return;
      const diff = changedFields();
      if (Object.keys(diff).length === 0) return;
      const token = getUserAuthToken("doctor");
      try {
        fetch(`${API_BASE}/api/notes/appointment/${appointmentId}`, {
          method: "PUT",
          keepalive: true,
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-Auth-Role": "doctor",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(diff),
        });
      } catch {
        /* best effort */
      }
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flushWithKeepalive();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushWithKeepalive);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushWithKeepalive);
      flushWithKeepalive();
    };
  }, [appointmentId, changedFields]);

  // ── actions ────────────────────────────────────────────────────────────────
  const setField = (key, value) => {
    setFields((f) => ({ ...f, [key]: value }));
    if (highlight.includes(key) && value.trim()) setHighlight((h) => h.filter((k) => k !== key));
    setReviewError("");
  };

  const reviewAndFinalise = async () => {
    const missing = missingRequired(fieldsRef.current);
    if (missing.length) {
      setHighlight(missing);
      setReviewError(
        `Please fill in: ${missing.map((k) => NOTE_FIELDS.find((f) => f.key === k).label).join(", ")}.`,
      );
      return;
    }
    clearTimeout(timerRef.current);
    await save();
    if (Object.keys(changedFields()).length > 0) {
      setReviewError("Your latest changes could not be saved yet. Please try again.");
      return;
    }
    navigate(`/doctor-dashboard/visit-notes/${appointmentId}/review`);
  };

  const statusText =
    saveState.phase === "saving"
      ? "Saving…"
      : saveState.phase === "error"
        ? saveState.error
        : saveState.at
          ? `Auto-saved · ${fmtTime(saveState.at)}`
          : "Not saved yet";

  if (loading) return <div className={`vne vne--${variant} vne-msg`}>Loading note…</div>;
  if (loadError) return <div className={`vne vne--${variant} vne-msg vne-msg--error`}>{loadError}</div>;

  const isPage = variant === "page";
  const savingNow = saveState.phase === "saving";

  return (
    <div className={`vne vne--${variant}`}>
      {(showBadge || !isPage) && (
        <div className="vne-bar">
          <span className={`vne-badge ${finalised ? "vne-badge--final" : "vne-badge--draft"}`}>
            {finalised ? "Finalised" : "Draft"}
          </span>
          {!isPage && !finalised && (
            <span className={`vne-save vne-save--${saveState.phase}`} role="status" aria-live="polite">
              {statusText}
            </span>
          )}
        </div>
      )}

      {isPage && !finalised && (
        <div className="vne-info">
          Notes from the video call save automatically. When ready, review and sign them to create the
          patient&apos;s Visit Note.
        </div>
      )}
      {finalised && (
        <div className="vne-info vne-info--ok">
          This note has been added to a Visit Note and is read-only. Use Add amendment for any correction; the
          original stays in the record.
        </div>
      )}

      {NOTE_FIELDS.map((f) => {
        const bad = highlight.includes(f.key);
        return (
          <label key={f.key} className={`vne-field${bad ? " vne-field--bad" : ""}`}>
            <span className="vne-label">
              {f.label}
              {f.required ? <em title="Required to finalise"> *</em> : <span className="vne-opt"> (optional)</span>}
            </span>
            <textarea
              className="vne-input"
              rows={f.rows}
              value={fields[f.key]}
              maxLength={f.max}
              readOnly={finalised}
              aria-invalid={bad || undefined}
              placeholder={f.placeholder}
              onChange={(e) => setField(f.key, e.target.value)}
            />
            {bad && <span className="vne-field-error">{f.label} is required before finalising.</span>}
          </label>
        );
      })}

      {isPage && (
        <div className="vne-foot">
          <span>
            Note: {fields.note.length}/20000 · <em>*</em> required before finalising
          </span>
          {!finalised && (
            <span className={`vne-save vne-save--${saveState.phase}`} role="status" aria-live="polite">
              <i aria-hidden="true" />
              {statusText}
            </span>
          )}
        </div>
      )}

      {reviewError && <div className="vne-msg vne-msg--error" role="alert">{reviewError}</div>}

      {finalised ? (
        isPage && (
          <div className="vne-actions">
            <button
              type="button"
              className="vne-btn vne-btn--ghost"
              onClick={() => navigate(`/doctor-dashboard/visit-notes/report/${note.reportId}?amend=1`)}
            >
              Add amendment
            </button>
            <button
              type="button"
              className="vne-btn vne-btn--navy"
              onClick={() => navigate(`/doctor-dashboard/visit-notes/report/${note.reportId}`)}
            >
              View Visit Note
            </button>
          </div>
        )
      ) : (
        <div className="vne-actions">
          {onDelete && note?._id && (
            <button type="button" className="vne-btn vne-btn--danger" onClick={() => onDelete(note)}>
              Delete
            </button>
          )}
          {isPage ? (
            <>
              <button type="button" className="vne-btn vne-btn--save" disabled={savingNow} onClick={() => save()}>
                {savingNow ? "Saving…" : "Save Changes"}
              </button>
              <button type="button" className="vne-btn vne-btn--outline" onClick={reviewAndFinalise}>
                Review &amp; Finalise
              </button>
            </>
          ) : (
            <span className="vne-hint">Review &amp; Finalise from Appointments or Notes after the call.</span>
          )}
        </div>
      )}
    </div>
  );
}
