import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { getUserAuthToken } from "../api";
import { NOTE_FIELDS, emptyFields, fmtTime, missingRequired, pickFields } from "../utils/visitNote";
import { backupOwner, clearBackup, diffFields, isFinalisedLockError, isPermanentLoadError, mergeLoaded, readBackup, writeBackup } from "../utils/visitNoteDraft";
import "./VisitNoteEditor.css";

const DEBOUNCE_MS = 900;
const LOAD_TIMEOUT_MS = 15000;
const LOAD_RETRY_MS = [1500, 3000, 6000, 10000];
const API_BASE = import.meta.env.VITE_API_URL || "";

/**
 * Structured consultation note (Symptoms, Clinical Findings, Plan / Treatment, Note) with auto-save.
 * Used on the doctor's Notes page (variant "page") and in the video-call notes panel (variant "panel").
 *
 * Every field auto-saves (debounced); only the changed fields are sent, the server merges them. Unsaved text is
 * flushed when the editor unmounts (call disconnect / navigation) and when the tab is hidden or closed.
 * A note that has been added to a Visit Note is read-only; every other draft is always editable.
 *
 * The form never waits for, or depends on, the load: if the note cannot be loaded (network drop, slow server) the
 * fields stay editable, the load is retried in the background and, once it arrives, the saved text is merged with
 * whatever was typed meanwhile (nothing is dropped). Nothing is saved before the saved text has loaded, so a stale
 * copy can never overwrite newer text. Unsaved text is also backed up in sessionStorage. All of this stays inside this
 * component: it never touches the call, and a failed or slow save only changes the panel's own status line.
 */
export default function VisitNoteEditor({ appointmentId, variant = "page", onNoteChange, onDelete, showBadge = true }) {
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(""); // permanent: this note cannot be opened at all
  const [loadIssue, setLoadIssue] = useState(""); // temporary: retrying in the background
  const [note, setNote] = useState(null); // server copy (id, status, reportId, updatedAt)
  const [fields, setFields] = useState(emptyFields());
  const [savedFields, setSavedFields] = useState(emptyFields()); // render copy of savedRef (what the server has)
  const [saveState, setSaveState] = useState({ phase: "idle", at: null, error: "" });
  const [highlight, setHighlight] = useState([]);
  const [reviewError, setReviewError] = useState("");

  const savedRef = useRef(emptyFields()); // what the server has
  const fieldsRef = useRef(fields);
  const inFlightRef = useRef(null);
  const timerRef = useRef(null);
  const lockedRef = useRef(false);
  const onChangeRef = useRef(onNoteChange);
  const loadedRef = useRef(false);
  const touchedRef = useRef(new Set()); // fields edited before the saved text arrived
  const reloadRef = useRef(() => {});

  const finalised = !!note?.reportId;

  // Mirror render values into refs for the save / flush callbacks (which must not re-create on every keystroke).
  useEffect(() => {
    onChangeRef.current = onNoteChange;
    fieldsRef.current = fields;
    lockedRef.current = finalised;
  });

  // ── load (retried in the background; the form is usable meanwhile) ──────────
  useEffect(() => {
    // Callers give this component a key per appointment, so it always starts unloaded.
    let cancelled = false;
    let timer = null;
    let attempt = 0;
    const run = () => {
      clearTimeout(timer);
      api
        .get(`/api/notes/appointment/${appointmentId}`, { authRole: "doctor", timeout: LOAD_TIMEOUT_MS })
        .then((res) => {
          if (cancelled) return;
          const loadedNote = res.data?.note || null;
          const server = pickFields(loadedNote);
          const merged = mergeLoaded(server, fieldsRef.current, touchedRef.current, readBackup(backupOwner(getUserAuthToken("doctor")), appointmentId));
          savedRef.current = server;
          setSavedFields(server);
          fieldsRef.current = merged;
          loadedRef.current = true;
          touchedRef.current = new Set();
          setNote(loadedNote);
          setFields(merged);
          setSaveState((s) =>
            s.phase === "saving" ? s : { phase: loadedNote?.updatedAt ? "saved" : "idle", at: loadedNote?.updatedAt || null, error: "" },
          );
          setLoadIssue("");
          setLoadError("");
          setLoaded(true);
        })
        .catch((err) => {
          if (cancelled) return;
          if (isPermanentLoadError(err)) {
            setLoadError(err.response?.data?.msg || "Could not load this note.");
            return;
          }
          setLoadIssue("Could not load your saved note. Retrying…");
          const wait = LOAD_RETRY_MS[Math.min(attempt, LOAD_RETRY_MS.length - 1)];
          attempt += 1;
          timer = setTimeout(run, wait);
        });
    };
    reloadRef.current = () => {
      attempt = 0;
      run();
    };
    const onOnline = () => {
      if (!loadedRef.current) reloadRef.current();
    };
    window.addEventListener("online", onOnline);
    run();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("online", onOnline);
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
    if (lockedRef.current || !loadedRef.current) return;
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
        setSavedFields(savedRef.current);
        setNote(saved);
        setSaveState({ phase: "saved", at: saved?.updatedAt || new Date().toISOString(), error: "" });
        onChangeRef.current?.(saved);
      })
      .catch((err) => {
        const msg = err.response?.data?.msg || "Could not save. Your text is kept here and will be retried automatically.";
        if (isFinalisedLockError(err)) {
          lockedRef.current = true;
          reloadRef.current(); // pick up the finalised copy so the panel shows it as read-only
        }
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
    if (!loaded || finalised) return undefined;
    if (Object.keys(changedFields()).length === 0) return undefined;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(save, DEBOUNCE_MS);
    return () => clearTimeout(timerRef.current);
  }, [fields, loaded, finalised, save, changedFields]);

  // Local backup of text that has not reached the server yet (cleared as soon as everything is saved).
  useEffect(() => {
    const owner = backupOwner(getUserAuthToken("doctor"));
    if (finalised) {
      clearBackup(owner, appointmentId); // signed into a Visit Note: nothing left to protect
      return;
    }
    if (!loaded) return;
    writeBackup(owner, appointmentId, savedRef.current, fields);
  }, [appointmentId, fields, loaded, finalised, saveState.at]);

  // A failed save (network drop) is retried on its own: when the browser comes back online and every few seconds
  // while the error stands, so text typed during an outage is saved without needing another keystroke.
  useEffect(() => {
    if (finalised || !loaded) return undefined;
    const retry = () => {
      if (Object.keys(changedFields()).length > 0) save();
    };
    window.addEventListener("online", retry);
    const timer = saveState.phase === "error" ? setInterval(retry, 4000) : null;
    return () => {
      window.removeEventListener("online", retry);
      if (timer) clearInterval(timer);
    };
  }, [finalised, loaded, saveState.phase, save, changedFields]);

  // Flush when the tab is hidden / closed (keepalive fetch survives unload) and when this editor unmounts
  // (e.g. the call is disconnected and the panel disappears).
  useEffect(() => {
    const flushWithKeepalive = () => {
      if (lockedRef.current || !loadedRef.current) return;
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
        }).catch(() => {}); // offline: the local backup restores this text when the panel opens again
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
    if (!loadedRef.current) touchedRef.current.add(key);
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

  const isPage = variant === "page";
  const savingNow = saveState.phase === "saving";
  const dirty = loaded && Object.keys(diffFields(fields, savedFields)).length > 0;

  // Save button (call panel): save now instead of waiting for the debounce; the result shows in the status line only.
  const saveNow = async () => {
    clearTimeout(timerRef.current);
    if (!loadedRef.current) {
      reloadRef.current();
      return;
    }
    await save();
  };

  const savedLabel = isPage ? "Auto-saved" : "Saved";
  const statusText =
    saveState.phase === "saving"
      ? "Saving…"
      : saveState.phase === "error"
        ? saveState.error
        : !loaded
          ? loadIssue || "Loading your saved note…"
          : dirty
            ? "Unsaved changes"
            : saveState.at
              ? `${savedLabel} · ${fmtTime(saveState.at)}`
              : "Not saved yet";

  if (loadError) return <div className={`vne vne--${variant} vne-msg vne-msg--error`}>{loadError}</div>;

  return (
    <div className={`vne vne--${variant}`} {...(isPage ? {} : { "data-lenis-prevent": true })}>
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
      {!loaded && loadIssue && !isPage && (
        <div className="vne-msg" role="status">
          {loadIssue} You can keep typing; your text is kept and merged when the note loads.
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
              {isPage && (f.required ? <em title="Required to finalise"> *</em> : <span className="vne-opt"> (optional)</span>)}
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
            <>
              <span className="vne-hint">Review &amp; Finalise from Appointments or Notes after the call.</span>
              <button type="button" className="vne-btn vne-btn--save vne-btn--panel-save" disabled={savingNow} onClick={saveNow}>
                {savingNow ? "Saving…" : "Save"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
