import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import "./DoctorPatients.css";
import "./VisitNote.css";
import api from "../../api";
import { blobToDataUrl } from "../../utils/visitNote";

const VisitNoteSlip = lazy(() => import("../../components/VisitNoteSlip"));

const SLIP_WIDTH = 794;

// Same scale-to-fit approach as the Prescription Preview: the paper keeps its A4 width and the on-screen copy is
// scaled to the container. The PDF is captured from a separate, unscaled instance.
function ScaledSlip({ children }) {
  const measureRef = useRef(null);
  const innerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const measureEl = measureRef.current;
    const innerEl = innerRef.current;
    if (!measureEl || !innerEl) return undefined;
    const update = () => {
      const avail = measureEl.clientWidth;
      if (avail > 0) setScale(Math.min(1, avail / SLIP_WIDTH));
      setHeight(innerEl.offsetHeight);
    };
    update();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(measureEl);
    ro.observe(innerEl);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={measureRef} className="dp-rx-measure">
      <div className="dp-rx-box" style={{ width: SLIP_WIDTH * scale, height: height ? height * scale : undefined }}>
        <div ref={innerRef} className="dp-rx-inner" style={{ width: SLIP_WIDTH, transform: `scale(${scale})` }}>
          {children}
        </div>
      </div>
    </div>
  );
}

const ROLE_API = {
  doctor: { prefix: "/api/consultation-reports/doctor", authRole: "doctor" },
  user: { prefix: "/api/consultation-reports/mine", authRole: "user" },
  admin: { prefix: "/api/consultation-reports/admin", authRole: "admin" },
};

// "Visit Note Preview" - used by the doctor, the patient and the admin. `role` decides which API scope is called;
// the server enforces who may see what. Only the doctor can add amendments.
export default function VisitNotePreview({ role = "doctor" }) {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const slipRef = useRef(null);
  const { prefix, authRole } = ROLE_API[role] || ROLE_API.doctor;

  const [report, setReport] = useState(null);
  const [signatureUrl, setSignatureUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  const [searchParams] = useSearchParams();
  const [amending, setAmending] = useState(role === "doctor" && searchParams.get("amend") === "1");
  const [amend, setAmend] = useState({ reason: "", text: "" });
  const [amendError, setAmendError] = useState("");
  const [amendSaving, setAmendSaving] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`${prefix}/${reportId}`, { authRole })
      .then((res) => {
        if (cancelled) return;
        setReport(res.data.report);
        setNotFound(false);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [prefix, reportId, authRole, reloadKey]);

  // The signature is behind the same authentication as the report, so it is fetched through the API and handed to
  // the slip as a data: URL (blob: URLs cannot be captured into the PDF under the page CSP).
  useEffect(() => {
    if (!report) return undefined;
    let cancelled = false;
    api
      .get(`${prefix}/${reportId}/signature`, { authRole, responseType: "blob" })
      .then((res) => blobToDataUrl(res.data))
      .then((url) => {
        if (!cancelled) setSignatureUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // The signature never changes for a report, so fetch it once per report id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?._id, prefix, reportId, authRole]);

  const goBack = () => navigate(-1);

  const handleDownload = async () => {
    if (!slipRef.current || busy) return;
    setBusy(true);
    try {
      const { downloadPrescriptionPDF } = await import("../../components/RxSlip");
      await downloadPrescriptionPDF(slipRef.current, `visit-note_${report.reportNumber}.pdf`);
    } finally {
      setBusy(false);
    }
  };

  const submitAmendment = async (e) => {
    e.preventDefault();
    if (amendSaving) return;
    setAmendError("");
    if (!amend.reason.trim() || !amend.text.trim()) {
      setAmendError("Please enter both a reason and the correction.");
      return;
    }
    setAmendSaving(true);
    try {
      await api.post(`${prefix}/${reportId}/amendments`, amend, { authRole });
      setAmend({ reason: "", text: "" });
      setAmending(false);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setAmendError(err.response?.data?.msg || "Could not save the amendment.");
    } finally {
      setAmendSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="dp-root-mp">
        <div className="dp-panel-loading">
          <div className="dp-spinner" />
        </div>
      </div>
    );
  }

  if (notFound || !report) {
    return (
      <div className="dp-root-mp">
        <div className="dp-empty-state">
          <div className="dp-empty-icon">📋</div>
          <h3>Visit Note not found</h3>
          <p>It may not exist, or you may not have access to it.</p>
          <button className="dp-btn dp-btn--primary" onClick={goBack}>
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dp-root-mp">
      <div className="dp-modal dp-modal--slip dp-slip-modal-box">
        <div className="dp-slip-toolbar">
          <span className="dp-slip-toolbar-title">Visit Note Preview</span>
          <div className="dp-slip-toolbar-actions">
            <button className="dp-slip-download-btn" onClick={handleDownload} disabled={busy}>
              {busy ? "Generating…" : "⬇ Download PDF"}
            </button>
            <button className="dp-slip-close-btn" onClick={goBack}>
              ← Back
            </button>
          </div>
        </div>

        <div className="dp-slip-body">
          <div className="dp-slip-body-inner">
            {role === "doctor" && (
              <div className="vn-amend">
                {!amending ? (
                  <button type="button" className="dp-btn dp-btn--primary" onClick={() => setAmending(true)}>
                    + Add amendment
                  </button>
                ) : (
                  <form className="vn-amend-form" onSubmit={submitAmendment}>
                    <strong>Add amendment · {report.reportNumber}</strong>
                    <p className="vn-amend-hint">
                      The original Visit Note stays unchanged. Your correction is added below it with your name and the
                      time.
                    </p>
                    <label>
                      Reason
                      <input
                        type="text"
                        value={amend.reason}
                        maxLength={300}
                        onChange={(e) => setAmend((a) => ({ ...a, reason: e.target.value }))}
                        placeholder="Why is this being corrected?"
                      />
                    </label>
                    <label>
                      Correction
                      <textarea
                        rows={4}
                        value={amend.text}
                        maxLength={5000}
                        onChange={(e) => setAmend((a) => ({ ...a, text: e.target.value }))}
                        placeholder="The corrected information..."
                      />
                    </label>
                    {amendError && <div className="vn-error" role="alert">{amendError}</div>}
                    <div className="vn-amend-actions">
                      <button type="button" className="dp-btn" onClick={() => { setAmending(false); setAmendError(""); }}>
                        Cancel
                      </button>
                      <button type="submit" className="dp-btn dp-btn--primary" disabled={amendSaving}>
                        {amendSaving ? "Saving…" : "Save amendment"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
            <ScaledSlip>
              <Suspense fallback={null}>
                <VisitNoteSlip report={report} signatureUrl={signatureUrl} />
              </Suspense>
            </ScaledSlip>
          </div>
        </div>
      </div>

      {/* PDF source - offscreen and never scaled, so the capture ref stays valid and independent of the preview */}
      <div className="dp-rx-offscreen dp-rx-inner" aria-hidden="true">
        <Suspense fallback={null}>
          <VisitNoteSlip slipRef={slipRef} report={report} signatureUrl={signatureUrl} />
        </Suspense>
      </div>
    </div>
  );
}
