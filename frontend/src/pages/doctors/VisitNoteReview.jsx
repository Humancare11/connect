import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../api";
import { NOTE_FIELDS, missingRequired, pickFields, validateSignatureFile, fmtDate } from "../../utils/visitNote";
import "./DoctorPatients.css";
import "./VisitNote.css";

const REG_NUMBER_MESSAGE =
  "Please complete your profile (Medical Registration Number) before finalising a visit note";

// A small pen pad. Exports a PNG that goes through exactly the same checks and upload as a chosen file.
function DrawPad({ onDone, onCancel }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvasRef.current.width,
      y: ((e.clientY - rect.top) / rect.height) * canvasRef.current.height,
    };
  };
  const start = (e) => {
    drawing.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const p = pos(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0b1f4d";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    canvasRef.current.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current.getContext("2d");
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setEmpty(false);
  };
  const end = () => {
    drawing.current = false;
  };
  const clear = () => {
    const c = canvasRef.current;
    c.getContext("2d").clearRect(0, 0, c.width, c.height);
    setEmpty(true);
  };
  const use = () => {
    canvasRef.current.toBlob((blob) => {
      if (blob) onDone(new File([blob], "signature.png", { type: "image/png" }));
    }, "image/png");
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="vn-draw"
        width={520}
        height={160}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        aria-label="Draw your signature"
      />
      <div className="vn-sig-actions" style={{ marginTop: 8 }}>
        <button type="button" className="vn-btn" onClick={clear}>Clear</button>
        <button type="button" className="vn-btn vn-btn--primary" onClick={use} disabled={empty}>Use this signature</button>
        <button type="button" className="vn-btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default function VisitNoteReview() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState(null);
  const [fields, setFields] = useState(null);
  const [info, setInfo] = useState(null); // { physician, hasSignature }
  const [signatureUrl, setSignatureUrl] = useState("");
  const [sigError, setSigError] = useState("");
  const [sigBusy, setSigBusy] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null); // { msg, code }

  const loadSignature = useCallback(async () => {
    try {
      const res = await api.get("/api/doctor/signature/image", { authRole: "doctor", responseType: "blob" });
      setSignatureUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(res.data);
      });
    } catch {
      setSignatureUrl("");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [noteRes, infoRes] = await Promise.all([
          api.get(`/api/notes/appointment/${appointmentId}`, { authRole: "doctor" }),
          api.get("/api/consultation-reports/doctor/review-info", { authRole: "doctor" }),
        ]);
        if (cancelled) return;
        const loaded = noteRes.data?.note;
        if (loaded?.reportId) {
          navigate(`/doctor-dashboard/visit-notes/report/${loaded.reportId}`, { replace: true });
          return;
        }
        setNote(loaded);
        setFields(pickFields(loaded));
        setInfo(infoRes.data);
        if (infoRes.data?.hasSignature) loadSignature();
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.msg || "Could not load this note.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appointmentId, navigate, loadSignature]);

  useEffect(() => () => signatureUrl && URL.revokeObjectURL(signatureUrl), [signatureUrl]);

  const uploadSignature = async (file) => {
    setSigError("");
    const problem = await validateSignatureFile(file);
    if (problem) {
      setSigError(problem);
      return;
    }
    setSigBusy(true);
    try {
      const form = new FormData();
      form.append("signature", file);
      await api.put("/api/doctor/signature", form, { authRole: "doctor" });
      setInfo((i) => ({ ...i, hasSignature: true }));
      setDrawing(false);
      await loadSignature();
    } catch (err) {
      setSigError(err.response?.data?.msg || "Could not upload the signature.");
    } finally {
      setSigBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { data } = await api.post(
        "/api/consultation-reports",
        { noteId: note._id, confirm: true },
        { authRole: "doctor" },
      );
      navigate(`/doctor-dashboard/visit-notes/report/${data.report._id}`, { replace: true });
    } catch (err) {
      const body = err.response?.data || {};
      if (body.code === "ALREADY_FINALISED" && body.reportId) {
        navigate(`/doctor-dashboard/visit-notes/report/${body.reportId}`, { replace: true });
        return;
      }
      setSubmitError({ msg: body.msg || "Could not add to the Visit Note.", code: body.code });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="dp-root-mp"><div className="dp-panel-loading"><div className="dp-spinner" /></div></div>
    );
  }
  if (error || !note) {
    return (
      <div className="dp-root-mp">
        <div className="dp-empty-state">
          <h3>{error || "There is no note for this appointment yet."}</h3>
          <button className="dp-btn dp-btn--primary" onClick={() => navigate("/doctor-dashboard/notes")}>← Back to Notes</button>
        </div>
      </div>
    );
  }

  const missing = missingRequired(fields);
  const physician = info?.physician || {};
  const noReg = !String(physician.registrationNumber || "").trim();
  const canSubmit = !missing.length && !noReg && info?.hasSignature && confirmed && !submitting;
  const patientName = note.patientId?.name || "Patient";

  return (
    <div className="dp-root-mp">
      <div className="vn-review">
        <div>
          <h2 style={{ margin: 0, color: "#051a3d" }}>Review &amp; Finalise</h2>
          <p className="vn-sub" style={{ margin: "4px 0 0" }}>
            {patientName}
            {note.appointmentId?.date ? ` · ${fmtDate(note.appointmentId.date)}` : ""}
            {note.appointmentId?.time ? ` · ${note.appointmentId.time}` : ""}
          </p>
        </div>

        {missing.length > 0 && (
          <div className="vn-blocker" role="alert">
            Please fill in: {missing.map((k) => NOTE_FIELDS.find((f) => f.key === k).label).join(", ")} before finalising.{" "}
            <Link to="/doctor-dashboard/notes">Go back to the note</Link>
          </div>
        )}
        {noReg && (
          <div className="vn-blocker" role="alert">
            {REG_NUMBER_MESSAGE}. <Link to="/doctor-dashboard/profile">Go to your profile</Link>
          </div>
        )}

        <div className="vn-panel">
          <h3>Note</h3>
          {NOTE_FIELDS.map((f) =>
            f.key === "note" && !fields.note.trim() ? null : (
              <p key={f.key} className="vn-text">
                <b>{f.label}</b>
                {fields[f.key].trim() || "—"}
              </p>
            ),
          )}
        </div>

        <div className="vn-panel">
          <h3>Physician details</h3>
          <div className="vn-kv">
            <div><span>Doctor&apos;s Name</span><div>{physician.name || "—"}</div></div>
            <div><span>Medical Reg No</span><div>{physician.registrationNumber || "—"}</div></div>
            <div><span>Speciality</span><div>{physician.speciality || "—"}</div></div>
            <div><span>Country</span><div>{physician.country || "—"}</div></div>
          </div>
        </div>

        <div className="vn-panel">
          <h3>Digital signature</h3>
          {signatureUrl ? (
            <img className="vn-sig-img" src={signatureUrl} alt="Your saved signature" />
          ) : (
            <p className="vn-text">No signature saved yet. Upload a PNG (max 1 MB) or draw one.</p>
          )}
          {drawing ? (
            <DrawPad onDone={uploadSignature} onCancel={() => setDrawing(false)} />
          ) : (
            <div className="vn-sig-actions">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,.png"
                hidden
                onChange={(e) => e.target.files?.[0] && uploadSignature(e.target.files[0])}
              />
              <button type="button" className="vn-btn" disabled={sigBusy} onClick={() => fileRef.current?.click()}>
                {sigBusy ? "Uploading…" : info?.hasSignature ? "Change signature (PNG)" : "Upload signature (PNG)"}
              </button>
              <button type="button" className="vn-btn" disabled={sigBusy} onClick={() => setDrawing(true)}>
                Draw
              </button>
            </div>
          )}
          <p className="vn-text" style={{ fontSize: 12, color: "#64748b", margin: "8px 0 0" }}>
            Saved to your profile and reused for later reports. Changing it never alters Visit Notes already signed.
          </p>
          {sigError && <div className="vn-error" role="alert" style={{ marginTop: 8 }}>{sigError}</div>}
        </div>

        <label className="vn-check">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          <span>
            I confirm that the details above are correct and I want to digitally sign this Visit Note. Once added it
            cannot be edited; corrections can only be made as amendments.
          </span>
        </label>

        {submitError && (
          <div className="vn-blocker" role="alert">
            {submitError.msg}
            {submitError.code === "PROFILE_INCOMPLETE" && (
              <>
                {" "}<Link to="/doctor-dashboard/profile">Go to your profile</Link>
              </>
            )}
          </div>
        )}

        <div className="vn-sig-actions" style={{ justifyContent: "space-between" }}>
          <button type="button" className="vn-btn" onClick={() => navigate("/doctor-dashboard/notes")}>← Back</button>
          <button type="button" className="vn-btn vn-btn--primary vn-final" disabled={!canSubmit} onClick={submit}>
            {submitting ? "Adding…" : "Add to Visit Note"}
          </button>
        </div>
      </div>
    </div>
  );
}
