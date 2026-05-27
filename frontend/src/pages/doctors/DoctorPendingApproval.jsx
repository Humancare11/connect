import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import { useDoctorAuth } from "../../context/DoctorAuthContext";

/* ─────────────────────────────────────────────────────────────
   Satoshi font + global resets injected once
───────────────────────────────────────────────────────────── */
const GLOBAL_CSS = `
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700,800,900&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body, html { font-family: 'Satoshi', sans-serif; }

@keyframes spin   { to { transform: rotate(360deg); } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pulse  { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
@keyframes shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}

.hc-root {
  min-height: 100vh;
  background: #01164a;
  background-image:
    radial-gradient(ellipse 80% 50% at 50% -10%, rgba(14, 165, 148, 0.12) 0%, transparent 70%),
    radial-gradient(ellipse 60% 40% at 90% 90%,  rgba(29, 78, 216, 0.08) 0%, transparent 60%);
  font-family: 'Satoshi', sans-serif;
  display: flex;
  flex-direction: column;
  padding-top: 64px;
}

/* ── Top bar ── */
.hc-topbar {
  padding: 0 40px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(12px);
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(11, 22, 40, 0.85);
}

.hc-brand {
  font-size: 18px;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.04em;
  display: flex;
  align-items: center;
  gap: 8px;
}

.hc-brand-icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: linear-gradient(135deg, #0ea594 0%, #0d9488 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.hc-brand span { color: #0ea594; }

.hc-nav-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255,255,255,0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 100px;
  padding: 7px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'Satoshi', sans-serif;
  letter-spacing: -0.01em;
}
.hc-nav-pill:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border-color: rgba(255,255,255,0.15);
}
.hc-btn hc-btn--teal {
  background: #0d9488;
  color: #fff;
}
/* ── Main ── */
.hc-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 24px 80px;
}

/* ── Card ── */
.hc-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 24px;
  backdrop-filter: blur(20px);
  padding: 52px 48px;
  max-width: 520px;
  width: 100%;
  text-align: center;
  animation: fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  position: relative;
  overflow: hidden;
}

.hc-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(14,165,148,0.04) 0%, transparent 50%);
  pointer-events: none;
}

/* Status icon */
.hc-status-ring {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  margin: 0 auto 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.hc-status-ring::before {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  padding: 3px;
  background: conic-gradient(from 0deg, transparent 30%, var(--ring-color, #0ea594) 70%, transparent 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  animation: spin 3s linear infinite;
}
.hc-status-icon {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
}

.hc-greeting {
  font-size: 11px;
  font-weight: 700;
  color: #0ea594;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: 10px;
}

.hc-title {
  font-size: 26px;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.03em;
  line-height: 1.2;
  margin-bottom: 14px;
}

.hc-desc {
  font-size: 14px;
  color: rgba(255,255,255,0.5);
  line-height: 1.75;
  margin-bottom: 28px;
  font-weight: 400;
}

/* Status badge */
.hc-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 18px;
  border-radius: 100px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  margin-bottom: 32px;
}
.hc-badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  animation: pulse 2s ease-in-out infinite;
}

/* Steps */
.hc-steps {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 16px;
  padding: 20px 24px;
  text-align: left;
  margin-bottom: 32px;
}
.hc-steps-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.hc-steps-title {
  font-size: 11px;
  font-weight: 700;
  color: rgba(255,255,255,0.35);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.hc-steps-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  list-style: none;
  padding: 0;
}
.hc-step-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.hc-step-num {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(14, 165, 148, 0.15);
  border: 1px solid rgba(14, 165, 148, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #0ea594;
  flex-shrink: 0;
  margin-top: 1px;
}
.hc-step-text {
  font-size: 13.5px;
  color: rgba(255,255,255,0.55);
  line-height: 1.55;
  font-weight: 400;
}

/* Divider */
.hc-divider {
  height: 1px;
  background: rgba(255,255,255,0.07);
  margin: 0 -48px 32px;
}

/* Actions */
.hc-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}

.hc-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 22px;
  border-radius: 100px;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  font-family: 'Satoshi', sans-serif;
  letter-spacing: -0.01em;
  text-decoration: none;
  position: relative;
  overflow: hidden;
}

.hc-btn--ghost {
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.6);
  border: 1px solid rgba(255,255,255,0.1);
}
.hc-btn--ghost:hover:not(:disabled) {
  background: rgba(255,255,255,0.09);
  color: #fff;
  border-color: rgba(255,255,255,0.18);
  transform: translateY(-1px);
}
.hc-btn--ghost:disabled { opacity: 0.4; cursor: not-allowed; }

.hc-btn--teal {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  border: 1px solid #fff;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.hc-btn--teal::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
}
.hc-btn--teal:hover {
  transform: translateY(-2px);
}
.hc-btn--teal:active { transform: translateY(0); }

/* Spinner */
.hc-spin {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.2);
  border-top-color: rgba(255,255,255,0.7);
  animation: spin 0.7s linear infinite;
}

/* Footer note */
.hc-footer {
  margin-top: 32px;
  font-size: 12px;
  color: rgba(255,255,255,0.25);
  text-align: center;
  letter-spacing: -0.01em;
}
.hc-footer a {
  color: #0ea594;
  text-decoration: none;
  font-weight: 600;
}
.hc-footer a:hover { text-decoration: underline; }

/* Loading screen */
.hc-loading {
  min-height: 100vh;
  background: #0b1628;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
}
.hc-loading-spinner {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 3px solid rgba(255,255,255,0.08);
  border-top-color: #0ea594;
  animation: spin 0.8s linear infinite;
}
.hc-loading-text {
  font-family: 'Satoshi', sans-serif;
  font-size: 13px;
  color: rgba(255,255,255,0.3);
  font-weight: 500;
}

/* Responsive */
@media (max-width: 560px) {
  .hc-card    { padding: 36px 24px; }
  .hc-divider { margin: 0 -24px 28px; }
  .hc-topbar  { padding: 0 20px; }
  .hc-title   { font-size: 22px; }
  .hc-actions { flex-direction: column; }
  .hc-btn     { justify-content: center; }
}
`;

/* ─────────────────────────────────────────────────────────────
   Status configurations
───────────────────────────────────────────────────────────── */
const STATUS_CONFIG = {
  pending: {
    iconBg: "rgba(14, 165, 148, 0.1)",
    iconBorder: "rgba(14, 165, 148, 0.2)",
    ringColor: "#0ea594",
    badgeBg: "rgba(14, 165, 148, 0.1)",
    badgeColor: "#0ea594",
    badgeBorder: "rgba(14, 165, 148, 0.2)",
    badgeLabel: "Pending Admin Approval",
    title: "Application Under Review",
    message:
      "Your enrollment request has been received and is currently under review by our administrative team. This typically takes 1–3 business days.",
    icon: (
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#0ea594" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  rejected: {
    iconBg: "rgba(239, 68, 68, 0.1)",
    iconBorder: "rgba(239, 68, 68, 0.2)",
    ringColor: "#ef4444",
    badgeBg: "rgba(239, 68, 68, 0.1)",
    badgeColor: "#ef4444",
    badgeBorder: "rgba(239, 68, 68, 0.2)",
    badgeLabel: "Action Required",
    title: "Application Needs Attention",
    message:
      "Your enrollment application was not approved at this time. Please review your submitted details, make the necessary corrections, and resubmit for another review.",
    icon: (
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
};

const STEPS = [
  "Our admin team verifies your credentials and supporting documents.",
  "Once approved, you'll gain full access to the doctor dashboard.",
  "Your profile becomes visible to patients on the platform.",
];

/* ─────────────────────────────────────────────────────────────
   Component
───────────────────────────────────────────────────────────── */
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

  /* Loading state */
  if (loading || fetching) {
    return (
      <>
        <style>{GLOBAL_CSS}</style>
        <div className="hc-loading">
          <div className="hc-loading-spinner" />
          <p className="hc-loading-text">Loading your profile…</p>
        </div>
      </>
    );
  }

  const status = enrollment?.approvalStatus || "pending";
  const isRejected = status === "rejected";
  const firstName = doctor?.name?.split(" ")[0] || "Doctor";
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div className="hc-root">

        {/* ── Top bar ── */}


        {/* ── Main ── */}
        <main className="hc-main">
          <div className="hc-card">

            {/* Status ring + icon */}
            <div
              className="hc-status-ring"
              style={{ "--ring-color": cfg.ringColor }}
            >
              <div
                className="hc-status-icon"
                style={{
                  background: cfg.iconBg,
                  border: `1px solid ${cfg.iconBorder}`,
                }}
              >
                {cfg.icon}
              </div>
            </div>

            {/* Greeting & title */}
            <p className="hc-greeting">Dr. {firstName}</p>
            <h1 className="hc-title">{cfg.title}</h1>
            <p className="hc-desc">{cfg.message}</p>

            {/* Badge */}
            <div>
              <span
                className="hc-badge"
                style={{
                  background: cfg.badgeBg,
                  color: cfg.badgeColor,
                  border: `1px solid ${cfg.badgeBorder}`,
                }}
              >
                <span className="hc-badge-dot" style={{ background: cfg.badgeColor }} />
                {cfg.badgeLabel}
              </span>
            </div>

            <div className="hc-divider" />

            {/* Next steps — pending only */}
            {!isRejected && (
              <div className="hc-steps">
                <div className="hc-steps-header">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="9 11 12 14 22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  <span className="hc-steps-title">What happens next</span>
                </div>
                <ol className="hc-steps-list">
                  {STEPS.map((step, i) => (
                    <li key={i} className="hc-step-item">
                      <span className="hc-step-num">{i + 1}</span>
                      <span className="hc-step-text">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Actions */}
            <div className="hc-actions">
              <button
                className="hc-btn hc-btn--ghost"
                onClick={() => fetchEnrollment(true)}
                disabled={checking}
                aria-live="polite"
              >
                {checking ? (
                  <>
                    <span className="hc-spin" aria-hidden="true" />
                    Checking…
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="23 4 23 10 17 10" />
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>
                    Refresh status
                  </>
                )}
              </button>

              {isRejected && (
                <button
                  className="hc-btn hc-btn--teal"
                  onClick={() => navigate("/doctor-dashboard/enrollments")}
                >
                  Edit &amp; resubmit
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              )}
            </div>

          </div>

          {/* Footer note */}
          <p className="hc-footer">
            Questions? Reach us at{" "}
            <a href="mailto:support@humancareworldwide.com">
              support@humancareworldwide.com
            </a>
          </p>
        </main>
      </div>
    </>
  );
}