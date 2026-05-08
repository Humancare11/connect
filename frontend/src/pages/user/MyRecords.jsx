import { useState, useEffect } from "react";
import "./MyRecords.css";
import api from "../../api";

function formatDate(d) {
  if (!d) return "—";
  const parsed = new Date(d);
  if (isNaN(parsed)) return d;
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function PrescriptionCard({ rx }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mr-card mr-card--rx">
      <div className="mr-card-top" onClick={() => setOpen((p) => !p)}>
        <div className="mr-card-icon">💊</div>
        <div className="mr-card-meta">
          <h3 className="mr-card-title">{rx.diagnosis}</h3>
          <p className="mr-card-sub">
            Dr. {rx.doctorId?.name || "—"} &nbsp;·&nbsp; {formatDate(rx.createdAt)}
            {rx.appointmentId?.date && ` &nbsp;·&nbsp; Appt: ${formatDate(rx.appointmentId.date)}`}
          </p>
        </div>
        <span className={`mr-chevron ${open ? "mr-chevron--open" : ""}`}>›</span>
      </div>

      {open && (
        <div className="mr-card-body">
          {rx.medicines?.length > 0 && (
            <>
              <h4 className="mr-section-label">Medicines</h4>
              <div className="mr-med-table-wrap">
                <table className="mr-med-table">
                  <thead>
                    <tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th></tr>
                  </thead>
                  <tbody>
                    {rx.medicines.map((m, i) => (
                      <tr key={i}>
                        <td><strong>{m.name}</strong></td>
                        <td>{m.dosage || "—"}</td>
                        <td>{m.frequency || "—"}</td>
                        <td>{m.duration || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rx.medicines.some((m) => m.notes) && (
                rx.medicines.filter((m) => m.notes).map((m, i) => (
                  <p key={i} className="mr-note">📋 {m.name}: {m.notes}</p>
                ))
              )}
            </>
          )}
          {rx.instructions && (
            <div className="mr-info-block">
              <span className="mr-info-label">Instructions</span>
              <p className="mr-info-value">{rx.instructions}</p>
            </div>
          )}
          {rx.followUpDate && (
            <div className="mr-info-block">
              <span className="mr-info-label">Follow-up Date</span>
              <p className="mr-info-value">🗓 {formatDate(rx.followUpDate)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CertificateCard({ cert }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mr-card mr-card--cert">
      <div className="mr-card-top" onClick={() => setOpen((p) => !p)}>
        <div className="mr-card-icon">📄</div>
        <div className="mr-card-meta">
          <h3 className="mr-card-title">{cert.diagnosis}</h3>
          <p className="mr-card-sub">
            Dr. {cert.doctorId?.name || "—"} &nbsp;·&nbsp; Issued: {formatDate(cert.issuedDate)}
          </p>
        </div>
        <span className={`mr-chevron ${open ? "mr-chevron--open" : ""}`}>›</span>
      </div>

      {open && (
        <div className="mr-card-body">
          {cert.recommendation && (
            <div className="mr-info-block">
              <span className="mr-info-label">Recommendation</span>
              <p className="mr-info-value">{cert.recommendation}</p>
            </div>
          )}
          {(cert.restFromDate || cert.restToDate) && (
            <div className="mr-info-block">
              <span className="mr-info-label">Rest Period</span>
              <p className="mr-info-value">
                {formatDate(cert.restFromDate)} → {formatDate(cert.restToDate)}
              </p>
            </div>
          )}
          {cert.notes && (
            <div className="mr-info-block">
              <span className="mr-info-label">Notes</span>
              <p className="mr-info-value">{cert.notes}</p>
            </div>
          )}
          <div className="mr-info-block">
            <span className="mr-info-label">Doctor</span>
            <p className="mr-info-value">{cert.doctorId?.name} &lt;{cert.doctorId?.email}&gt;</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MyRecords() {
  const [prescriptions,  setPrescriptions]  = useState([]);
  const [certificates,   setCertificates]   = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [activeTab,      setActiveTab]      = useState("prescriptions");

  useEffect(() => {
    Promise.all([
      api.get("/api/medical/my-prescriptions"),
      api.get("/api/medical/my-certificates"),
    ])
      .then(([rxRes, certRes]) => {
        setPrescriptions(rxRes.data);
        setCertificates(certRes.data);
      })
      .catch((err) => console.error("Failed to load records", err))
      .finally(() => setLoading(false));
  }, []);

  const tabs = [
    { key: "prescriptions", label: "Prescriptions",       icon: "💊", count: prescriptions.length  },
    { key: "certificates",  label: "Medical Certificates", icon: "📄", count: certificates.length  },
  ];

  return (
    <div className="mr-root">
      <header className="mr-header">
        <span className="mr-eyebrow">HumaniCare</span>
        <h1 className="mr-title">My Medical Records</h1>
        <p className="mr-sub">Prescriptions and certificates from your consultations</p>
      </header>

      {/* Summary */}
      <div className="mr-summary">
        <div className="mr-summary-card">
          <span className="mr-summary-icon">💊</span>
          <div>
            <div className="mr-summary-num">{prescriptions.length}</div>
            <div className="mr-summary-label">Prescriptions</div>
          </div>
        </div>
        <div className="mr-summary-card">
          <span className="mr-summary-icon">📄</span>
          <div>
            <div className="mr-summary-num">{certificates.length}</div>
            <div className="mr-summary-label">Certificates</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mr-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`mr-tab ${activeTab === t.key ? "mr-tab--active" : ""}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.icon} {t.label}
            <span className="mr-tab-count">{t.count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mr-loading"><div className="mr-spinner" /><p>Loading records…</p></div>
      ) : activeTab === "prescriptions" ? (
        prescriptions.length === 0 ? (
          <div className="mr-empty">
            <div className="mr-empty-icon">💊</div>
            <h3>No prescriptions yet</h3>
            <p>Prescriptions from your doctors will appear here after a completed consultation.</p>
          </div>
        ) : (
          <div className="mr-list">
            {prescriptions.map((rx) => <PrescriptionCard key={rx._id} rx={rx} />)}
          </div>
        )
      ) : (
        certificates.length === 0 ? (
          <div className="mr-empty">
            <div className="mr-empty-icon">📄</div>
            <h3>No certificates yet</h3>
            <p>Medical certificates issued by your doctors will appear here.</p>
          </div>
        ) : (
          <div className="mr-list">
            {certificates.map((cert) => <CertificateCard key={cert._id} cert={cert} />)}
          </div>
        )
      )}
    </div>
  );
}
