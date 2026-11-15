import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../api";
import { NOTE_FIELDS, missingRequired, pickFields, fmtDate } from "../../utils/visitNote";
import SignaturePanel from "../../components/SignaturePanel";
import useDoctorSignature from "../../hooks/useDoctorSignature";
import "./DoctorPatients.css";
import "./VisitNote.css";

const REG_NUMBER_MESSAGE =
  "Please complete your profile (Medical Registration Number) before finalising a visit note";

export default function VisitNoteReview() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState(null);
  const [fields, setFields] = useState(null);
  const [info, setInfo] = useState(null); // { physician }
  const signature = useDoctorSignature(); // the shared signature component/logic (also used by Prescription + Certificate)
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null); // { msg, code }

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
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.msg || "Could not load this note.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appointmentId, navigate]);

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
  const canSubmit = !missing.length && !noReg && signature.hasSignature && confirmed && !submitting;
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
          <SignaturePanel sig={signature} prompt="No signature saved yet. Upload a PNG or JPG (max 2 MB) or draw one." />
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
