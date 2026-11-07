import { lazy, Suspense, useEffect, useRef, useState } from "react";
import api from "../api";
import { blobToDataUrl } from "../utils/visitNote";

const VisitNoteSlip = lazy(() => import("./VisitNoteSlip"));

const SCOPE = {
  doctor: { prefix: "/api/consultation-reports/doctor", authRole: "doctor" },
  user: { prefix: "/api/consultation-reports/mine", authRole: "user" },
  admin: { prefix: "/api/consultation-reports/admin", authRole: "admin" },
};

/**
 * "Download PDF" button for list rows. Renders the Visit Note paper off-screen, fetches its signature through the
 * authenticated API, and captures it with the same generator the Prescription Preview uses.
 */
export default function VisitNoteDownload({ report, role, className = "vn-btn", children = "Download PDF" }) {
  const slipRef = useRef(null);
  const [job, setJob] = useState(null); // { url } while a PDF is being produced
  const [error, setError] = useState("");
  const { prefix, authRole } = SCOPE[role];

  const start = async () => {
    setError("");
    let url = "";
    try {
      const res = await api.get(`${prefix}/${report._id}/signature`, { authRole, responseType: "blob" });
      url = await blobToDataUrl(res.data);
    } catch {
      /* a missing signature image must not block the download */
    }
    setJob({ url });
  };

  useEffect(() => {
    if (!job) return undefined;
    let cancelled = false;
    (async () => {
      try {
        // wait for the slip (lazy chunk) and its images
        for (let i = 0; i < 50 && !slipRef.current; i += 1) await new Promise((r) => setTimeout(r, 60));
        const el = slipRef.current;
        if (!el) throw new Error("slip not ready");
        await Promise.all([...el.querySelectorAll("img")].map((img) => (img.decode ? img.decode().catch(() => {}) : null)));
        const { downloadPrescriptionPDF } = await import("./RxSlip");
        await downloadPrescriptionPDF(el, `visit-note_${report.reportNumber}.pdf`);
      } catch {
        if (!cancelled) setError("Could not generate the PDF.");
      } finally {
        if (!cancelled) setJob(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [job, report.reportNumber]);

  return (
    <>
      <button type="button" className={className} onClick={start} disabled={!!job} title={error || undefined}>
        {job ? "Preparing…" : error ? "Retry download" : children}
      </button>
      {job && (
        <div className="dp-rx-offscreen dp-rx-inner" aria-hidden="true">
          <Suspense fallback={null}>
            <VisitNoteSlip slipRef={slipRef} report={report} signatureUrl={job.url} />
          </Suspense>
        </div>
      )}
    </>
  );
}
