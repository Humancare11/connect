import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import { useDoctorAuth } from "../../context/DoctorAuthContext";

export default function DoctorPendingApproval() {
  const navigate = useNavigate();
  const { doctor, loading, logout: contextLogout } = useDoctorAuth();
  const [enrollment, setEnrollment] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [checking, setChecking] = useState(false);

  const fetchEnrollment = async (showSpinner = false) => {
    if (!doctor) return;
    if (showSpinner) setChecking(true);
    try {
      const res = await api.get(`/api/doctor/enrollment/${doctor._id || doctor.id}`);
      const data = res.data;
      setEnrollment(data);

      if (data?.approvalStatus === "approved") {
        navigate("/doctor-dashboard", { replace: true });
      } else if (!data?.formCompleted) {
        navigate("/doctor-dashboard/enrollments", { replace: true });
      }
    } catch {
      /* ignore */
    } finally {
      setFetching(false);
      if (showSpinner) setChecking(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!doctor) {
      navigate("/doctor-login", { replace: true });
      return;
    }
    fetchEnrollment();
  }, [doctor, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = async () => {
    await contextLogout();
    navigate("/doctor-login");
  };

  if (loading || fetching) {
    return (
      <div style={styles.loadingPage}>
        <div style={styles.spinner} />
        <style>{spinCss}</style>
      </div>
    );
  }

  const status = enrollment?.approvalStatus || "pending";
  const isRejected = status === "rejected";
  const firstName = doctor?.name?.split(" ")[0] || "Doctor";

  const statusMap = {
    pending:  { icon: "⏳", color: "#d97706", bg: "#fffbeb", border: "#fde68a", title: "Application Under Review",     msg: "Your enrollment request has been received and is currently being reviewed by our team. This usually takes 1–3 business days." },
    rejected: { icon: "❌", color: "#dc2626", bg: "#fef2f2", border: "#fecaca", title: "Application Needs Attention",  msg: "Your enrollment request was not approved. Please review the information you submitted, make any necessary corrections, and resubmit." },
  };
  const info = statusMap[status] || statusMap.pending;

  return (
    <>
      <style>{pageStyles}</style>
      <div className="dp-root">

        {/* Top bar */}
        <header className="dp-topbar">
          <div className="dp-brand">Humancare<span>Connect</span></div>
          <button className="dp-logout" onClick={handleLogout}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
          </button>
        </header>

        {/* Card */}
        <main className="dp-main">
          <div className="dp-card">

            {/* Status icon circle */}
            <div className="dp-icon-wrap" style={{ background: info.bg, border: `2px solid ${info.border}` }}>
              <span className="dp-icon">{info.icon}</span>
            </div>

            <p className="dp-greeting">Hello, Dr. {firstName}</p>
            <h1 className="dp-title">{info.title}</h1>
            <p className="dp-desc">{info.msg}</p>

            {/* Status badge */}
            <div className="dp-badge" style={{ background: info.bg, color: info.color, border: `1px solid ${info.border}` }}>
              <span className="dp-badge-dot" style={{ background: info.color }} />
              {status === "pending" ? "Pending Admin Approval" : "Rejected — Action Required"}
            </div>

            {/* What happens next (pending only) */}
            {!isRejected && (
              <div className="dp-steps">
                <p className="dp-steps-title">What happens next?</p>
                <ol className="dp-steps-list">
                  <li>Our admin team reviews your credentials and documents.</li>
                  <li>Once approved, you'll be able to access the full doctor dashboard.</li>
                  <li>Your profile will become visible to patients on the platform.</li>
                </ol>
              </div>
            )}

            {/* Actions */}
            <div className="dp-actions">
              <button
                className="dp-btn dp-btn--outline"
                onClick={() => fetchEnrollment(true)}
                disabled={checking}
              >
                {checking ? (
                  <>
                    <span className="dp-btn-spinner" /> Checking…
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                    Refresh Status
                  </>
                )}
              </button>

              {isRejected && (
                <button
                  className="dp-btn dp-btn--primary"
                  onClick={() => navigate("/doctor-dashboard/enrollments")}
                >
                  Edit &amp; Resubmit →
                </button>
              )}
            </div>

          </div>

          <p className="dp-footer-note">
            Questions? Contact us at{" "}
            <a href="mailto:support@humancareworldwide.com">support@humancareworldwide.com</a>
          </p>
        </main>
      </div>
    </>
  );
}

const spinCss = `
@keyframes dp-spin { to { transform: rotate(360deg); } }
`;

const pageStyles = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Outfit:wght@600;700;800&display=swap');
@keyframes dp-spin  { to { transform: rotate(360deg); } }
@keyframes dp-fadein { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.dp-root {
  min-height: 100vh;
  background: linear-gradient(160deg, #f4f7fb 0%, #e8f0f9 100%);
  font-family: 'DM Sans', sans-serif;
  display: flex;
  flex-direction: column;
}

/* ── Top bar ── */
.dp-topbar {
  padding: 14px 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #223a5e;
}
.dp-brand {
  font-family: 'Outfit', sans-serif;
  font-weight: 800;
  font-size: 18px;
  color: #fff;
  letter-spacing: -0.03em;
}
.dp-brand span { color: #0c8b7a; }
.dp-logout {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255,255,255,0.1);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 50px;
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  font-family: 'DM Sans', sans-serif;
}
.dp-logout:hover { background: rgba(255,255,255,0.2); }

/* ── Main ── */
.dp-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
}

/* ── Card ── */
.dp-card {
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 8px 40px rgba(34,58,94,0.12);
  border: 1px solid rgba(34,58,94,0.06);
  padding: 48px 40px;
  max-width: 520px;
  width: 100%;
  text-align: center;
  animation: dp-fadein 0.4s ease forwards;
}

.dp-icon-wrap {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 24px;
}
.dp-icon { font-size: 36px; }

.dp-greeting {
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.dp-title {
  font-family: 'Outfit', sans-serif;
  font-size: 24px;
  font-weight: 800;
  color: #223a5e;
  margin-bottom: 12px;
  line-height: 1.2;
}
.dp-desc {
  font-size: 14px;
  color: #475569;
  line-height: 1.7;
  margin-bottom: 24px;
}

/* Badge */
.dp-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  border-radius: 50px;
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 28px;
}
.dp-badge-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Steps */
.dp-steps {
  background: #f8fafc;
  border-radius: 12px;
  padding: 16px 20px;
  text-align: left;
  margin-bottom: 28px;
  border: 1px solid #e2e8f0;
}
.dp-steps-title {
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 10px;
}
.dp-steps-list {
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dp-steps-list li {
  font-size: 13px;
  color: #334155;
  line-height: 1.5;
}

/* Actions */
.dp-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}
.dp-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 11px 24px;
  border-radius: 50px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  font-family: 'DM Sans', sans-serif;
}
.dp-btn--outline {
  background: #fff;
  color: #223a5e;
  border: 1.5px solid #e2e8f0;
}
.dp-btn--outline:hover:not(:disabled) { border-color: #0c8b7a; color: #0c8b7a; }
.dp-btn--outline:disabled { opacity: 0.55; cursor: not-allowed; }
.dp-btn--primary {
  background: #0c8b7a;
  color: #fff;
}
.dp-btn--primary:hover { background: #0a7a6b; transform: translateY(-1px); box-shadow: 0 4px 14px rgba(12,139,122,0.3); }

.dp-btn-spinner {
  display: inline-block;
  width: 13px;
  height: 13px;
  border: 2px solid rgba(34,58,94,0.2);
  border-top-color: #223a5e;
  border-radius: 50%;
  animation: dp-spin 0.75s linear infinite;
}

/* Footer note */
.dp-footer-note {
  margin-top: 28px;
  font-size: 12px;
  color: #94a3b8;
  text-align: center;
}
.dp-footer-note a { color: #0c8b7a; text-decoration: none; font-weight: 600; }
.dp-footer-note a:hover { text-decoration: underline; }

/* Loading */
.dp-loading-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f4f7fb;
}

@media (max-width: 540px) {
  .dp-card { padding: 32px 20px; }
  .dp-topbar { padding: 12px 16px; }
  .dp-title { font-size: 20px; }
}
`;

const styles = {
  loadingPage: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f4f7fb",
  },
  spinner: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    border: "3px solid #e2e8f0",
    borderTopColor: "#0c8b7a",
    animation: "dp-spin 0.75s linear infinite",
  },
};
