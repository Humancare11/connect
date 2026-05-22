import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../api";
import { useAdmin } from "../../context/AdminContext";
import "./DoctorPayments.css";

const ICONS = {
  USD: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  PAID: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  PENDING: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  STRIPE: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M7 10h4" />
      <path d="M7 14h7" />
      <path d="M17 14h.01" />
    </svg>
  ),
  SEARCH: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  CHEVRON: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
};

function formatMoney(cents) {
  const value = Number(cents || 0) / 100;
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function shortId(value) {
  return String(value || "").slice(-8).toUpperCase() || "-";
}

function paymentMethodLabel(gateway) {
  if (gateway === "paypal") return "PayPal";
  if (gateway === "stripe") return "Stripe";
  return "Online";
}

function StatusBadge({ status }) {
  const paid = status === "paid";
  return (
    <span className={`dp-badge dp-badge--${paid ? "paid" : "pending"}`}>
      {paid ? "Paid" : "Pending"}
    </span>
  );
}

function ModalCloseButton({ onClose }) {
  return (
    <button className="dp-icon-btn" type="button" onClick={onClose} aria-label="Close modal">
      x
    </button>
  );
}

function PayoutEditModal({ record, isSuperAdmin, onClose, onSave }) {
  const [status, setStatus] = useState(record.doctorPayoutStatus || "pending");
  const [ref, setRef] = useState(record.doctorPayoutRef || "");
  const [date, setDate] = useState(
    record.doctorPayoutDate ? new Date(record.doctorPayoutDate).toISOString().split("T")[0] : ""
  );
  const [overrideUsd, setOverrideUsd] = useState(
    Number.isFinite(Number(record.doctorPayoutOverrideAmount))
      ? (Number(record.doctorPayoutOverrideAmount) / 100).toFixed(2)
      : ""
  );
  const [overrideError, setOverrideError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    let overridePayload = null;
    if (overrideUsd !== "") {
      const parsed = Number(overrideUsd);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setOverrideError("Enter a valid non-negative amount.");
        return;
      }
      overridePayload = Math.round(parsed * 100);
    }

    setOverrideError("");
    setSaving(true);
    try {
      await onSave(record._id, {
        doctorPayoutStatus: status,
        doctorPayoutRef: ref,
        doctorPayoutDate: date || undefined,
        doctorPayoutOverrideAmount: overridePayload,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dp-overlay" onClick={onClose}>
      <div className="dp-modal" onClick={(event) => event.stopPropagation()}>
        <div className="dp-modal-head">
          <div>
            <p className="dp-modal-kicker">Ledger control</p>
            <h3>Edit Payout</h3>
          </div>
          <ModalCloseButton onClose={onClose} />
        </div>

        <div className="dp-modal-body">
          <div className="dp-payment-card dp-payment-card--muted">
            <div>
              <span>Appointment</span>
              <strong className="dp-mono">{record._id}</strong>
            </div>
            <div>
              <span>Doctor</span>
              <strong>{record.doctorId?.name || "-"}</strong>
            </div>
            <div>
              <span>Patient</span>
              <strong>{record.patientId?.name || "-"}</strong>
            </div>
            <div className="dp-payment-split">
              <div>
                <span>Base payable</span>
                <strong>{formatMoney(record.baseDoctorPayable || 0)}</strong>
              </div>
              <div>
                <span>Current payable</span>
                <strong className="dp-green">{formatMoney(record.doctorPayable)}</strong>
              </div>
            </div>
          </div>

          <div className="dp-field">
            <label>Payout Status</label>
            <select value={status} onChange={(event) => setStatus(event.target.value)} disabled={!isSuperAdmin}>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
            </select>
          </div>

          <div className="dp-field">
            <label>Transaction Reference</label>
            <input
              type="text"
              placeholder="txn_123 or bank reference"
              value={ref}
              onChange={(event) => setRef(event.target.value)}
              disabled={!isSuperAdmin}
            />
          </div>

          <div className="dp-field">
            <label>Payout Date</label>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} disabled={!isSuperAdmin} />
          </div>

          <div className="dp-field">
            <label>Doctor Payable Override (USD)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={overrideUsd}
              onChange={(event) => setOverrideUsd(event.target.value)}
              placeholder="Leave blank to use system-calculated value"
              disabled={!isSuperAdmin}
            />
            {overrideError && <div className="dp-field-error">{overrideError}</div>}
          </div>
        </div>

        <div className="dp-modal-foot">
          <button className="dp-btn dp-btn--secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          {isSuperAdmin && (
            <button className="dp-btn dp-btn--primary" type="button" onClick={submit} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MarkPaidModal({ record, onClose, onConfirm }) {
  const [ref, setRef] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await onConfirm(record._id, ref);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dp-overlay" onClick={onClose}>
      <div className="dp-modal" onClick={(event) => event.stopPropagation()}>
        <div className="dp-modal-head">
          <div>
            <p className="dp-modal-kicker">Manual settlement</p>
            <h3>Mark Local Payment</h3>
          </div>
          <ModalCloseButton onClose={onClose} />
        </div>

        <div className="dp-modal-body">
          <div className="dp-payment-card dp-payment-card--success">
            <span>{record.doctorId?.name || "Doctor"}</span>
            <strong>{formatMoney(record.doctorPayable)}</strong>
            <p>Use this only after paying the doctor outside the platform.</p>
          </div>

          <div className="dp-field">
            <label>Transaction Reference (optional)</label>
            <input
              type="text"
              placeholder="Cash receipt, bank transfer, or note"
              value={ref}
              onChange={(event) => setRef(event.target.value)}
            />
          </div>
        </div>

        <div className="dp-modal-foot">
          <button className="dp-btn dp-btn--secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="dp-btn dp-btn--primary" type="button" onClick={submit} disabled={saving}>
            {saving ? "Confirming..." : "Confirm Manual Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProcessPayoutModal({ record, onClose, onProcess }) {
  const [method, setMethod] = useState("stripe");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setProcessing(true);
    setError("");
    try {
      await onProcess(record._id, method);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.msg || "Transaction failed. Please check payout credentials.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="dp-overlay" onClick={onClose}>
      <div className="dp-modal dp-modal--wide" onClick={(event) => event.stopPropagation()}>
        <div className="dp-modal-head">
          <div>
            <p className="dp-modal-kicker">Doctor payout</p>
            <h3>Pay Consultation Fee</h3>
          </div>
          <ModalCloseButton onClose={onClose} />
        </div>

        <div className="dp-modal-body">
          <div className="dp-stripe-panel">
            <div>
              <span className="dp-stripe-label">Doctor payable amount</span>
              <strong>{formatMoney(record.doctorPayable)}</strong>
              <p>{record.doctorId?.name || "Doctor"} - Appointment {shortId(record._id)}</p>
            </div>
            <div className="dp-stripe-mark">Stripe</div>
          </div>

          <div className="dp-payment-status-grid">
            <div>
              <span>Client payment</span>
              <StatusBadge status={record.paymentStatus} />
            </div>
            <div>
              <span>Payout status</span>
              <StatusBadge status={record.doctorPayoutStatus} />
            </div>
            <div>
              <span>Payment source</span>
              <strong>{paymentMethodLabel(record.paymentGateway)}</strong>
            </div>
          </div>

          <div className="dp-field">
            <label>Payment Option</label>
            <div className="dp-method-grid">
              <button
                className={`dp-method-card ${method === "stripe" ? "active" : ""}`}
                type="button"
                onClick={() => setMethod("stripe")}
              >
                <span>{ICONS.STRIPE}</span>
                <strong>Stripe Transfer</strong>
                <small>Send funds to the doctor's connected Stripe account.</small>
              </button>
              <button
                className={`dp-method-card ${method === "paypal" ? "active" : ""}`}
                type="button"
                onClick={() => setMethod("paypal")}
              >
                <span>{ICONS.USD}</span>
                <strong>PayPal Payout</strong>
                <small>Use PayPal Payouts when Stripe is not available.</small>
              </button>
            </div>
          </div>

          <div className="dp-info-note">
            {method === "stripe"
              ? "Stripe transfers use the connected account saved on the doctor's enrollment profile and mark the payout as paid after Stripe returns a transfer reference."
              : "PayPal payouts use the doctor's PayPal ID or payout email and mark the payout as paid after PayPal returns a batch reference."}
          </div>

          {error && <div className="dp-error-note">{error}</div>}
        </div>

        <div className="dp-modal-foot">
          <button className="dp-btn dp-btn--secondary" type="button" onClick={onClose} disabled={processing}>
            Cancel
          </button>
          <button className="dp-btn dp-btn--stripe" type="button" onClick={submit} disabled={processing}>
            {processing ? "Sending Funds..." : `Pay with ${method === "stripe" ? "Stripe" : "PayPal"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function DoctorGroup({ doctorName, doctorEmail, records, isSuperAdmin, onMarkPaid, onProcessPayout, onEdit }) {
  const [open, setOpen] = useState(false);

  const totalPayable = records.reduce((sum, row) => sum + (row.doctorPayable || 0), 0);
  const totalPaid = records
    .filter((row) => row.doctorPayoutStatus === "paid")
    .reduce((sum, row) => sum + (row.doctorPayable || 0), 0);
  const pendingCount = records.filter((row) => row.doctorPayoutStatus !== "paid").length;
  const balance = Math.max(0, totalPayable - totalPaid);

  return (
    <section className="dp-doctor-block">
      <button className="dp-doctor-header" type="button" onClick={() => setOpen((prev) => !prev)}>
        <div className="dp-doctor-info">
          <div className="dp-doc-avatar">{(doctorName || "D")[0].toUpperCase()}</div>
          <div>
            <div className="dp-doc-name">{doctorName || "Unknown Doctor"}</div>
            <div className="dp-doc-email">{doctorEmail || "No payout email on file"}</div>
          </div>
        </div>

        <div className="dp-doctor-meta">
          <div>
            <span>Balance</span>
            <strong>{formatMoney(balance)}</strong>
          </div>
          <div>
            <span>Pending</span>
            <strong>{pendingCount}</strong>
          </div>
          <span className={`dp-chev ${open ? "open" : ""}`}>{ICONS.CHEVRON}</span>
        </div>
      </button>

      {open && (
        <>
          <div className="dp-table-wrap">
            <table className="dp-table">
              <thead>
                <tr>
                  <th>Appointment</th>
                  <th>Patient</th>
                  <th>Date</th>
                  <th>Consultation</th>
                  <th>Platform Fee</th>
                  <th>Doctor Payable</th>
                  <th>Client Payment</th>
                  <th>Payout Tracking</th>
                  <th>Reference</th>
                  {isSuperAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {records.map((row) => (
                  <tr key={row._id}>
                    <td>
                      <span className="dp-mono">{shortId(row._id)}</span>
                      <small className="dp-cell-sub">{paymentMethodLabel(row.paymentGateway)}</small>
                    </td>
                    <td>
                      <strong className="dp-patient-name">{row.patientId?.name || "-"}</strong>
                    </td>
                    <td>{formatDate(row.date)}</td>
                    <td>
                      <span className="dp-amount dp-amount--consult">{formatMoney(row.consultationAmount)}</span>
                    </td>
                    <td>
                      <span className="dp-amount dp-amount--platform">-{formatMoney(row.platformFee)}</span>
                    </td>
                    <td>
                      <span className="dp-amount dp-amount--payable">{formatMoney(row.doctorPayable)}</span>
                    </td>
                    <td>
                      <StatusBadge status={row.paymentStatus} />
                    </td>
                    <td>
                      <div className="dp-status-stack">
                        <StatusBadge status={row.doctorPayoutStatus} />
                        <small>{formatDate(row.doctorPayoutDate)}</small>
                      </div>
                    </td>
                    <td>
                      <span className="dp-mono">{row.doctorPayoutRef || "-"}</span>
                    </td>

                    {isSuperAdmin && (
                      <td>
                        <div className="dp-row-actions">
                          {row.doctorPayoutStatus !== "paid" && (
                            <>
                              <button className="dp-btn dp-btn--stripe" type="button" onClick={() => onProcessPayout(row)}>
                                Pay Stripe
                              </button>
                              <button className="dp-btn dp-btn--secondary" type="button" onClick={() => onMarkPaid(row)}>
                                Mark Local
                              </button>
                            </>
                          )}
                          <button className="dp-btn dp-btn--ghost" type="button" onClick={() => onEdit(row)}>
                            Edit
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="dp-summary-bar">
            <div>Total payable <strong>{formatMoney(totalPayable)}</strong></div>
            <div>Settled <strong className="dp-green">{formatMoney(totalPaid)}</strong></div>
            <div>Balance <strong className="dp-amber">{formatMoney(balance)}</strong></div>
          </div>
        </>
      )}
    </section>
  );
}

export default function DoctorPayments() {
  const { admin } = useAdmin();
  const isSuperAdmin = admin?.role === "superadmin";

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const [toast, setToast] = useState(null);
  const [markPaidTarget, setMarkPaidTarget] = useState(null);
  const [processPayoutTarget, setProcessPayoutTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);

  const loadPayments = useCallback(async (withLoader = false) => {
    if (withLoader) setLoading(true);
    try {
      const res = await api.get("/api/admin/doctor-payments");
      setRecords(Array.isArray(res.data) ? res.data : []);
    } catch {
      setRecords([]);
    } finally {
      if (withLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayments(true);
  }, [loadPayments]);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    window.setTimeout(() => setToast(null), 4000);
  };

  const markPaid = async (id, payoutRef) => {
    try {
      await api.put(`/api/admin/doctor-payments/${id}/mark-paid`, { payoutRef });
      await loadPayments();
      showToast("Payment marked as paid locally.");
    } catch {
      showToast("Failed to update payment.", false);
      throw new Error("failed");
    }
  };

  const processPayout = async (id, method) => {
    try {
      const res = await api.post(`/api/admin/doctor-payments/${id}/process-payout`, { method });
      await loadPayments();
      const ref = res.data?.payoutRef ? ` Ref: ${String(res.data.payoutRef).slice(0, 12)}...` : "";
      showToast(`${method === "stripe" ? "Stripe" : "PayPal"} payout successful.${ref}`);
    } catch (err) {
      if (!err.response) showToast("Network error during payout.", false);
      throw err;
    }
  };

  const editPayout = async (id, data) => {
    try {
      await api.put(`/api/admin/doctor-payments/${id}`, data);
      await loadPayments();
      showToast("Payout updated successfully.");
    } catch {
      showToast("Failed to update payout.", false);
      throw new Error("failed");
    }
  };

  const summary = useMemo(() => {
    const totalPayable = records.reduce((sum, row) => sum + (row.doctorPayable || 0), 0);
    const totalPaid = records
      .filter((row) => row.doctorPayoutStatus === "paid")
      .reduce((sum, row) => sum + (row.doctorPayable || 0), 0);
    const stripeEligible = records.filter((row) => row.doctorPayoutStatus !== "paid").length;

    return {
      totalPayable,
      totalPaid,
      totalPending: Math.max(0, totalPayable - totalPaid),
      paidCount: records.filter((row) => row.doctorPayoutStatus === "paid").length,
      pendingCount: records.filter((row) => row.doctorPayoutStatus !== "paid").length,
      stripeEligible,
    };
  }, [records]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((row) => {
      const doctorName = (row.doctorId?.name || "").toLowerCase();
      const patientName = (row.patientId?.name || "").toLowerCase();
      const ref = (row.doctorPayoutRef || row.transactionReference || "").toLowerCase();
      const matchSearch = !q || doctorName.includes(q) || patientName.includes(q) || ref.includes(q);

      const matchStatus =
        statusTab === "all"
          ? true
          : statusTab === "paid"
            ? row.doctorPayoutStatus === "paid"
            : row.doctorPayoutStatus !== "paid";

      return matchSearch && matchStatus;
    });
  }, [records, search, statusTab]);

  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach((row) => {
      const key = row.doctorId?._id || row.doctorId?.doctorId || "unknown";
      if (!map[key]) {
        map[key] = {
          name: row.doctorId?.name,
          email: row.doctorId?.email,
          records: [],
        };
      }
      map[key].records.push(row);
    });
    return Object.values(map);
  }, [filtered]);

  return (
    <div className="dp-page">
      {toast && (
        <div className={`dp-toast dp-toast--${toast.ok ? "ok" : "err"}`}>
          <span>{toast.ok ? "OK" : "!"}</span> {toast.msg}
        </div>
      )}

      {markPaidTarget && (
        <MarkPaidModal record={markPaidTarget} onClose={() => setMarkPaidTarget(null)} onConfirm={markPaid} />
      )}

      {processPayoutTarget && (
        <ProcessPayoutModal
          record={processPayoutTarget}
          onClose={() => setProcessPayoutTarget(null)}
          onProcess={processPayout}
        />
      )}

      {editTarget && (
        <PayoutEditModal
          record={editTarget}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setEditTarget(null)}
          onSave={editPayout}
        />
      )}

      <header className="dp-header">
        <div>
          <span className="dp-eyebrow">Financial Dashboard</span>
          <h1 className="dp-title">Doctor Payouts</h1>
          <p className="dp-sub">Review consultation earnings, pay doctors through Stripe, and track payout status.</p>
        </div>
        <div className="dp-header-action">
          <span>Stripe payout queue</span>
          <strong>{summary.pendingCount} pending</strong>
        </div>
      </header>

      <section className="dp-stats">
        {[
          { label: "Doctor Payable", value: formatMoney(summary.totalPayable), mod: "blue", icon: "USD" },
          { label: "Settled Payouts", value: formatMoney(summary.totalPaid), mod: "green", icon: "PAID" },
          { label: "Pending Balance", value: formatMoney(summary.totalPending), mod: "amber", icon: "PENDING" },
          { label: "Stripe Ready Items", value: summary.stripeEligible, mod: "teal", icon: "STRIPE" },
        ].map((card) => (
          <div key={card.label} className={`dp-stat dp-stat--${card.mod}`}>
            <div className="dp-stat-icon">{ICONS[card.icon]}</div>
            <div>
              <div className="dp-stat-val">{card.value}</div>
              <div className="dp-stat-lbl">{card.label}</div>
            </div>
          </div>
        ))}
      </section>

      {!isSuperAdmin && (
        <div className="dp-readonly">
          <span>{ICONS.PENDING}</span>
          Read-only mode. Only super admins can process Stripe transfers or edit payout records.
        </div>
      )}

      <section className="dp-workspace">
        <aside className="dp-sidebar">
          <div className="dp-search">
            {ICONS.SEARCH}
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search doctor, patient, ref..." />
          </div>

          <div className="dp-tabs">
            {[
              ["all", "All Records", records.length],
              ["pending", "Pending", summary.pendingCount],
              ["paid", "Paid", summary.paidCount],
            ].map(([key, label, count]) => (
              <button key={key} className={`dp-tab ${statusTab === key ? "active" : ""}`} type="button" onClick={() => setStatusTab(key)}>
                <span>{label}</span>
                <strong>{count}</strong>
              </button>
            ))}
          </div>

          <div className="dp-sidebar-card">
            <span>Visible ledger</span>
            <strong>{grouped.length} doctors</strong>
            <p>{filtered.length} transactions match the current filter.</p>
          </div>
        </aside>

        <main className="dp-main">
          {loading ? (
            <div className="dp-state-wrap">
              <div className="dp-spinner" />
              <p>Syncing payout ledger...</p>
            </div>
          ) : grouped.length === 0 ? (
            <div className="dp-state-wrap">
              <div className="dp-state-icon">{ICONS.STRIPE}</div>
              <h3>No payments found</h3>
              <p>{search || statusTab !== "all" ? "Try adjusting your filters." : "No successful consultation payments are ready for payout."}</p>
            </div>
          ) : (
            grouped.map((group) => (
              <DoctorGroup
                key={`${group.email || group.name || "doctor"}-${group.records.length}`}
                doctorName={group.name}
                doctorEmail={group.email}
                records={group.records}
                isSuperAdmin={isSuperAdmin}
                onMarkPaid={setMarkPaidTarget}
                onProcessPayout={setProcessPayoutTarget}
                onEdit={setEditTarget}
              />
            ))
          )}
        </main>
      </section>
    </div>
  );
}
