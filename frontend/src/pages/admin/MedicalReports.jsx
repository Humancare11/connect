import { useCallback, useEffect, useState } from "react";
import { FileText } from "lucide-react";
import api from "../../api";
import { useToast } from "../../components/ui/Toast";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import "./MedicalReports.css";

const DEFAULT_DOCTOR = "Issued by Humancare";

// Template sections (HCC Medical Report), in the order they print. Keys match the backend.
const SECTIONS = [
  ["chiefComplaint", "Chief complaint"],
  ["examination", "Clinical findings"],
  ["diagnosis", "Diagnosis"],
  ["treatment", "Plan / disposition / treatment (one item per line)"],
];

// Typed patient details (printed in the Patient Details table; "N/A" when left empty).
// There is no patient account behind the report, so these are entered by hand.
const PATIENT_FIELDS = [
  ["patientContact", "Contact number", "Optional"],
  ["patientLocation", "Patient location", "Optional"],
];
const REQUEST_TYPES = ["In-Clinic Consultation", "Video Consultation", "Home Visit", "Teleconsultation"];

// Labels for the detail view — includes fields used by older reports.
const DETAIL_FIELDS = [
  ["requestType", "Request type"],
  ["patientDob", "Date of birth"],
  ["patientContact", "Contact number"],
  ["patientLocation", "Patient location"],
  ["chiefComplaint", "Chief complaint"],
  ["examination", "Clinical findings"],
  ["history", "History"],
  ["investigations", "Investigations"],
  ["diagnosis", "Diagnosis"],
  ["treatment", "Plan / disposition / treatment"],
  ["followUp", "Follow-up"],
  ["remarks", "Remarks"],
];

const today = () => new Date().toISOString().slice(0, 10);

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const emptyForm = () => ({
  title: "",
  reportDate: today(),
  doctorName: "",
  requestType: "",
  patientName: "",
  patientDob: "",
  ...Object.fromEntries(SECTIONS.map(([key]) => [key, ""])),
  ...Object.fromEntries(PATIENT_FIELDS.map(([key]) => [key, ""])),
});

function StatusBadge({ report }) {
  if (report.isDeleted) return <span className="mrp-badge mrp-badge--deleted">Deleted</span>;
  if (report.status === "voided") return <span className="mrp-badge mrp-badge--voided">Voided</span>;
  return <span className="mrp-badge mrp-badge--active">Active</span>;
}

export default function MedicalReports() {
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState("issue");

  // ── Issue form ──
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  // ── History ──
  const [reports, setReports] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [detail, setDetail] = useState(null);
  const [voidTarget, setVoidTarget] = useState(null);
  const [voidReason, setVoidReason] = useState("");

  const loadReports = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await api.get("/api/admin/medical-reports", {
        params: { page, limit: 15, q: search || undefined, status: status || undefined, includeDeleted: includeDeleted ? 1 : undefined },
      });
      setReports(res.data.reports);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      toast.error(err.response?.data?.msg || "Failed to load medical reports.");
    } finally {
      setListLoading(false);
    }
  }, [page, search, status, includeDeleted, toast]);

  useEffect(() => {
    if (tab !== "history") return undefined;
    const timer = setTimeout(loadReports, 250);
    return () => clearTimeout(timer);
  }, [tab, loadReports]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.patientName.trim()) return setError("Enter the patient's name.");
    if (!form.title.trim()) return setError("Enter a report title.");
    if (!form.reportDate) return setError("Choose the report date.");
    if (!SECTIONS.some(([key]) => form[key].trim())) {
      return setError("Fill in at least one section of the report.");
    }

    const ok = await confirm({
      title: "Issue medical report?",
      message: `This report will be issued for ${form.patientName.trim()}. It is not linked to a patient account, so no notification is sent. Reports cannot be edited afterwards — only voided.`,
      confirmText: "Issue Report",
    });
    if (!ok) return;

    const fields = {
      reportType: "generated",
      patientName: form.patientName.trim(),
      patientDob: form.patientDob,
      title: form.title.trim(),
      reportDate: form.reportDate,
      doctorName: form.doctorName.trim(),
      requestType: form.requestType,
      ...Object.fromEntries(SECTIONS.map(([key]) => [key, form[key]])),
      ...Object.fromEntries(PATIENT_FIELDS.map(([key]) => [key, form[key]])),
    };

    setSubmitting(true);
    try {
      const res = await api.post("/api/admin/medical-reports", fields);
      toast.success(`Report ${res.data.report.reportNumber} issued for ${fields.patientName}.`);
      setForm(emptyForm());
      setTab("history");
      setPage(1);
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to issue the report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const download = async (report) => {
    setBusyId(report._id);
    try {
      const res = await api.get(`/api/admin/medical-reports/${report._id}/download`);
      if (res.data?.url) window.open(res.data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err.response?.data?.msg || "Failed to generate download link.");
    } finally {
      setBusyId("");
    }
  };

  const openDetail = async (report) => {
    setBusyId(report._id);
    try {
      const res = await api.get(`/api/admin/medical-reports/${report._id}`);
      setDetail(res.data.report);
    } catch (err) {
      toast.error(err.response?.data?.msg || "Failed to load the report.");
    } finally {
      setBusyId("");
    }
  };

  const submitVoid = async () => {
    if (voidReason.trim().length < 3) return toast.error("Enter a reason for voiding this report.");
    setBusyId(voidTarget._id);
    try {
      await api.post(`/api/admin/medical-reports/${voidTarget._id}/void`, { reason: voidReason.trim() });
      toast.success(`Report ${voidTarget.reportNumber} voided. Issue a new report to correct it.`);
      setVoidTarget(null);
      setVoidReason("");
      loadReports();
    } catch (err) {
      toast.error(err.response?.data?.msg || "Failed to void the report.");
    } finally {
      setBusyId("");
    }
  };

  const remove = async (report) => {
    const ok = await confirm({
      title: "Delete report?",
      message: `${report.reportNumber} will be hidden from ${report.patient?.linked === false ? "this list" : `${report.patient?.name || "the patient"} and from this list`}. The record is kept for audit.`,
      confirmText: "Delete",
    });
    if (!ok) return;
    setBusyId(report._id);
    try {
      await api.delete(`/api/admin/medical-reports/${report._id}`);
      toast.success(`Report ${report.reportNumber} deleted.`);
      loadReports();
    } catch (err) {
      toast.error(err.response?.data?.msg || "Failed to delete the report.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="mrp-page">
      <header className="mrp-header">
        <FileText size={22} aria-hidden="true" />
        <div>
          <h1 className="mrp-title">Medical Report</h1>
          <p className="mrp-sub">Issue a medical report by typing in the patient's details. The PDF is stored here; it is not added to any patient account.</p>
        </div>
      </header>

      <div className="mrp-tabs" role="tablist">
        {[["issue", "Issue report"], ["history", "Issued reports"]].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`mrp-tab${tab === key ? " is-active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "issue" && (
        <form className="mrp-card" onSubmit={submit} noValidate>
          <div className="mrp-row">
            <div>
              <label className="mrp-label" htmlFor="mrp-title">Report title</label>
              <input id="mrp-title" className="mrp-input" maxLength={150} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Annual health check-up" />
            </div>
            <div>
              <label className="mrp-label" htmlFor="mrp-date">Date of service</label>
              <input id="mrp-date" className="mrp-input" type="date" value={form.reportDate} onChange={(e) => set("reportDate", e.target.value)} />
            </div>
          </div>

          <label className="mrp-label" htmlFor="mrp-doctor">Assigned / attending doctor (optional)</label>
          <input id="mrp-doctor" className="mrp-input" maxLength={120} value={form.doctorName} onChange={(e) => set("doctorName", e.target.value)} placeholder={DEFAULT_DOCTOR} />

          <label className="mrp-label" htmlFor="mrp-requestType">Request type</label>
          <input id="mrp-requestType" className="mrp-input" maxLength={200} value={form.requestType} onChange={(e) => set("requestType", e.target.value)} placeholder="e.g. In-Clinic Consultation" list="mrp-request-types" />
          <datalist id="mrp-request-types">
            {REQUEST_TYPES.map((type) => <option key={type} value={type} />)}
          </datalist>

          <fieldset className="mrp-sections">
            <legend className="mrp-label">Patient details</legend>
            <div className="mrp-row">
              <div>
                <label className="mrp-sublabel" htmlFor="mrp-patientName">Patient name</label>
                <input id="mrp-patientName" className="mrp-input" maxLength={120} value={form.patientName} onChange={(e) => set("patientName", e.target.value)} required />
              </div>
              <div>
                <label className="mrp-sublabel" htmlFor="mrp-patientDob">Date of birth (optional)</label>
                <input id="mrp-patientDob" className="mrp-input" type="date" max={today()} value={form.patientDob} onChange={(e) => set("patientDob", e.target.value)} />
              </div>
            </div>
            {PATIENT_FIELDS.map(([key, label, placeholder]) => (
              <div key={key}>
                <label className="mrp-sublabel" htmlFor={`mrp-${key}`}>{label}</label>
                <input id={`mrp-${key}`} className="mrp-input" maxLength={200} value={form[key]} onChange={(e) => set(key, e.target.value)} placeholder={placeholder} />
              </div>
            ))}
          </fieldset>

          <fieldset className="mrp-sections">
            <legend className="mrp-label">Report content</legend>
            {SECTIONS.map(([key, label]) => (
              <div key={key}>
                <label className="mrp-sublabel" htmlFor={`mrp-${key}`}>{label}</label>
                <textarea id={`mrp-${key}`} className="mrp-input mrp-textarea" rows={3} maxLength={5000} value={form[key]} onChange={(e) => set(key, e.target.value)} />
              </div>
            ))}
            <p className="mrp-muted">Please use English. Hindi/Devanagari text is not supported in the PDF.</p>
          </fieldset>

          {error && <div className="mrp-error" role="alert">{error}</div>}

          <button type="submit" className="mrp-btn mrp-btn--primary" disabled={submitting}>
            {submitting ? "Issuing…" : "Issue report"}
          </button>
        </form>
      )}

      {tab === "history" && (
        <div className="mrp-card">
          <div className="mrp-filters">
            <input className="mrp-input" type="search" placeholder="Search report no., title, patient…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search reports" />
            <select className="mrp-input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status filter">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="voided">Voided</option>
            </select>
            <label className="mrp-check">
              <input type="checkbox" checked={includeDeleted} onChange={(e) => { setIncludeDeleted(e.target.checked); setPage(1); }} />
              Show deleted
            </label>
          </div>

          {listLoading && reports.length === 0 ? (
            <p className="mrp-empty">Loading…</p>
          ) : reports.length === 0 ? (
            <p className="mrp-empty">No reports found.</p>
          ) : (
            <div className="mrp-table-wrap">
              <table className="mrp-table">
                <thead>
                  <tr><th>Report</th><th>Patient</th><th>Date</th><th>Issued by</th><th>Status</th><th /></tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r._id} className={r.isDeleted ? "is-deleted" : ""}>
                      <td>
                        <strong>{r.reportNumber}</strong>
                        <div className="mrp-muted">{r.title} · {r.reportType === "uploaded" ? "Uploaded PDF" : "Template"}</div>
                      </td>
                      <td>{r.patient?.name || "—"}<div className="mrp-muted">{r.patient?.email || (r.patient?.linked === false ? "Not linked to an account" : "")}</div></td>
                      <td>{formatDate(r.reportDate)}</td>
                      <td>{r.doctorName}<div className="mrp-muted">{r.issuedBy?.name}</div></td>
                      <td>
                        <StatusBadge report={r} />
                        {r.voidReason && <div className="mrp-muted" title={r.voidReason}>Reason: {r.voidReason}</div>}
                      </td>
                      <td className="mrp-actions">
                        <button type="button" className="mrp-btn" disabled={busyId === r._id} onClick={() => openDetail(r)}>Details</button>
                        <button type="button" className="mrp-btn" disabled={busyId === r._id} onClick={() => download(r)}>
                          {busyId === r._id ? "…" : "View / Download"}
                        </button>
                        {!r.isDeleted && r.status === "active" && (
                          <button type="button" className="mrp-btn" disabled={busyId === r._id} onClick={() => { setVoidTarget(r); setVoidReason(""); }}>Void</button>
                        )}
                        {!r.isDeleted && (
                          <button type="button" className="mrp-btn mrp-btn--danger" disabled={busyId === r._id} onClick={() => remove(r)}>Delete</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mrp-pager">
            <span className="mrp-muted">{total} report{total === 1 ? "" : "s"}</span>
            <div>
              <button type="button" className="mrp-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <span className="mrp-muted"> Page {page} of {totalPages} </span>
              <button type="button" className="mrp-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="mrp-modal-overlay" role="dialog" aria-modal="true" aria-label={`Report ${detail.reportNumber}`} onClick={() => setDetail(null)}>
          <div className="mrp-modal mrp-modal--wide" onClick={(e) => e.stopPropagation()}>
            <h2 className="mrp-modal-title">{detail.reportNumber} — {detail.title}</h2>
            <p className="mrp-muted">
              {detail.patient?.name} · {formatDate(detail.reportDate)} · {detail.doctorName} · <StatusBadge report={detail} />
            </p>
            {detail.voidReason && <p className="mrp-muted">Void reason: {detail.voidReason}</p>}

            {DETAIL_FIELDS.filter(([key]) => detail.content?.[key]).map(([key, label]) => (
              <div key={key}>
                <div className="mrp-sublabel">{label}</div>
                <p className="mrp-detail-text">{detail.content[key]}</p>
              </div>
            ))}

            <div className="mrp-label">Access log (read-only)</div>
            {detail.accessLog?.length ? (
              <table className="mrp-table mrp-table--compact">
                <thead><tr><th>When</th><th>Role</th><th>Action</th><th>User</th></tr></thead>
                <tbody>
                  {[...detail.accessLog].reverse().map((e, i) => (
                    <tr key={i}>
                      <td>{new Date(e.at).toLocaleString("en-GB")}</td>
                      <td>{e.role === "user" ? "patient" : e.role}</td>
                      <td>{e.action}</td>
                      <td className="mrp-muted">{e.userId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mrp-muted">No downloads yet.</p>
            )}
            <p className="mrp-muted">Shows the newest 200 downloads.</p>

            <div className="mrp-modal-actions">
              <button type="button" className="mrp-btn" onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {voidTarget && (
        <div className="mrp-modal-overlay" role="dialog" aria-modal="true" aria-label={`Void report ${voidTarget.reportNumber}`}>
          <div className="mrp-modal">
            <h2 className="mrp-modal-title">Void {voidTarget.reportNumber}?</h2>
            <p className="mrp-muted">
              The patient will see this report as “Voided” and can no longer download it. Reports can’t be edited — issue a new report to correct it.
            </p>
            <label className="mrp-label" htmlFor="mrp-void-reason">Reason (internal)</label>
            <textarea id="mrp-void-reason" className="mrp-input mrp-textarea" rows={3} maxLength={500} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} autoFocus />
            <div className="mrp-modal-actions">
              <button type="button" className="mrp-btn" onClick={() => setVoidTarget(null)}>Cancel</button>
              <button type="button" className="mrp-btn mrp-btn--danger" disabled={busyId === voidTarget._id} onClick={submitVoid}>Void report</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
