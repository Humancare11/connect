import { useCallback, useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import api from "../../api";
import { useToast } from "../../components/ui/Toast";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import "./MedicalReports.css";

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const DEFAULT_DOCTOR = "Issued by Humancare";

// Template sections, in the order they print. Keys match the backend.
const SECTIONS = [
  ["chiefComplaint", "Chief complaint"],
  ["history", "History"],
  ["examination", "Examination findings"],
  ["investigations", "Investigations"],
  ["diagnosis", "Diagnosis"],
  ["treatment", "Treatment & recommendations"],
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
  reportType: "generated",
  title: "",
  reportDate: today(),
  doctorName: "",
  notify: true,
  file: null,
  ...Object.fromEntries(SECTIONS.map(([key]) => [key, ""])),
});

// Searchable, server-paged patient list (patient accounts only).
function PatientPicker({ value, onChange }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const load = useCallback(async (query, nextPage) => {
    setLoading(true);
    try {
      const res = await api.get("/api/admin/users", { params: { q: query, page: nextPage, limit: 10 } });
      setResults((prev) => (nextPage === 1 ? res.data.users : [...prev, ...res.data.users]));
      setTotalPages(res.data.totalPages || 1);
      setPage(nextPage);
    } catch {
      if (nextPage === 1) setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced server-side search whenever the box is open and the text changes.
  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => load(q.trim(), 1), 250);
    return () => clearTimeout(timer);
  }, [q, open, load]);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  if (value) {
    return (
      <div className="mrp-picked">
        <div>
          <strong>{value.name}</strong>
          <span className="mrp-muted"> · {value.email}{value.patientId ? ` · ID ${value.patientId}` : ""}</span>
        </div>
        <button type="button" className="mrp-link" onClick={() => onChange(null)}>
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="mrp-picker" ref={wrapRef}>
      <input
        className="mrp-input"
        type="search"
        placeholder="Search patient by name, email, phone or patient ID…"
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        aria-label="Search patients"
      />
      {open && (
        <div className="mrp-dropdown" role="listbox">
          {results.map((p) => (
            <button
              type="button"
              role="option"
              key={p._id}
              className="mrp-option"
              onClick={() => {
                onChange(p);
                setOpen(false);
              }}
            >
              <strong>{p.name}</strong>
              <span className="mrp-muted">{p.email}{p.patientId ? ` · ID ${p.patientId}` : ""}</span>
            </button>
          ))}
          {!loading && results.length === 0 && <div className="mrp-empty">No patients found.</div>}
          {loading && <div className="mrp-empty">Searching…</div>}
          {!loading && page < totalPages && (
            <button type="button" className="mrp-more" onClick={() => load(q.trim(), page + 1)}>
              Load more
            </button>
          )}
        </div>
      )}
    </div>
  );
}

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
  const [patient, setPatient] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
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
    if (!patient) return setError("Select a patient.");
    if (!form.title.trim()) return setError("Enter a report title.");
    if (!form.reportDate) return setError("Choose the report date.");
    const uploaded = form.reportType === "uploaded";
    if (uploaded) {
      if (!form.file) return setError("Choose a PDF file.");
      if (form.file.type !== "application/pdf") return setError("Only PDF files are allowed.");
      if (form.file.size > MAX_PDF_BYTES) return setError("The PDF must be 10 MB or smaller.");
    } else if (!SECTIONS.some(([key]) => form[key].trim())) {
      return setError("Fill in at least one section of the report.");
    }

    const ok = await confirm({
      title: "Issue medical report?",
      message: `This report will be issued to ${patient.name}${form.notify ? " and they will be notified" : ""}. Reports cannot be edited afterwards — only voided.`,
      confirmText: "Issue Report",
    });
    if (!ok) return;

    const fields = {
      reportType: form.reportType,
      patientId: patient._id,
      title: form.title.trim(),
      reportDate: form.reportDate,
      doctorName: form.doctorName.trim(),
      notify: form.notify ? "1" : "0",
      ...Object.fromEntries(SECTIONS.map(([key]) => [key, form[key]])),
    };

    setSubmitting(true);
    try {
      let res;
      if (uploaded) {
        const fd = new FormData();
        Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
        fd.append("file", form.file);
        res = await api.post("/api/admin/medical-reports", fd);
      } else {
        res = await api.post("/api/admin/medical-reports", { ...fields, notify: form.notify });
      }
      toast.success(`Report ${res.data.report.reportNumber} issued to ${patient.name}.`);
      setForm(emptyForm());
      setPatient(null);
      if (fileRef.current) fileRef.current.value = "";
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
      message: `${report.reportNumber} will be hidden from ${report.patient?.name || "the patient"} and from this list. The record is kept for audit.`,
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

  const uploaded = form.reportType === "uploaded";

  return (
    <div className="mrp-page">
      <header className="mrp-header">
        <FileText size={22} aria-hidden="true" />
        <div>
          <h1 className="mrp-title">Medical Report</h1>
          <p className="mrp-sub">Issue a medical report to a patient. It appears in their Medical Records.</p>
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
          <label className="mrp-label">Patient</label>
          <PatientPicker value={patient} onChange={setPatient} />

          <div className="mrp-modes" role="radiogroup" aria-label="Report type">
            {[["generated", "Fill in template (PDF generated)"], ["uploaded", "Upload existing PDF"]].map(([key, label]) => (
              <label key={key} className={`mrp-mode${form.reportType === key ? " is-active" : ""}`}>
                <input type="radio" name="reportType" checked={form.reportType === key} onChange={() => set("reportType", key)} />
                {label}
              </label>
            ))}
          </div>

          <div className="mrp-row">
            <div>
              <label className="mrp-label" htmlFor="mrp-title">Report title</label>
              <input id="mrp-title" className="mrp-input" maxLength={150} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Annual health check-up" />
            </div>
            <div>
              <label className="mrp-label" htmlFor="mrp-date">Report date</label>
              <input id="mrp-date" className="mrp-input" type="date" value={form.reportDate} onChange={(e) => set("reportDate", e.target.value)} />
            </div>
          </div>

          <label className="mrp-label" htmlFor="mrp-doctor">Doctor name (optional)</label>
          <input id="mrp-doctor" className="mrp-input" maxLength={120} value={form.doctorName} onChange={(e) => set("doctorName", e.target.value)} placeholder={DEFAULT_DOCTOR} />

          {uploaded && (
            <>
              <label className="mrp-label" htmlFor="mrp-file">PDF file (max 10 MB)</label>
              <input id="mrp-file" ref={fileRef} className="mrp-input" type="file" accept="application/pdf,.pdf" onChange={(e) => set("file", e.target.files?.[0] || null)} />
            </>
          )}

          <fieldset className="mrp-sections">
            <legend className="mrp-label">{uploaded ? "Clinical notes (optional, stored encrypted)" : "Report content"}</legend>
            {SECTIONS.map(([key, label]) => (
              <div key={key}>
                <label className="mrp-sublabel" htmlFor={`mrp-${key}`}>{label}</label>
                <textarea id={`mrp-${key}`} className="mrp-input mrp-textarea" rows={3} maxLength={5000} value={form[key]} onChange={(e) => set(key, e.target.value)} />
              </div>
            ))}
          </fieldset>

          <label className="mrp-check">
            <input type="checkbox" checked={form.notify} onChange={(e) => set("notify", e.target.checked)} />
            Notify the patient (push: “A new medical report is available”)
          </label>

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
                      <td>{r.patient?.name || "—"}<div className="mrp-muted">{r.patient?.email}</div></td>
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

            {SECTIONS.filter(([key]) => detail.content?.[key]).map(([key, label]) => (
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
