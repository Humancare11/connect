import { useEffect, useMemo, useState } from "react";
import api from "../../api";
import "./ManualInvoices.css";

function formatMoney(amountCents, currency = "USD") {
  const code = String(currency || "USD").toUpperCase();
  try {
    return ((amountCents || 0) / 100).toLocaleString("en-US", {
      style: "currency",
      currency: code,
    });
  } catch {
    return `${code} ${((amountCents || 0) / 100).toFixed(2)}`;
  }
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status) {
  return status === "paid" ? "Paid" : "Due";
}

export default function ManualInvoices() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("due");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [markPaidRowId, setMarkPaidRowId] = useState("");
  const [markPaidResend, setMarkPaidResend] = useState(true);
  const [markPaidBusy, setMarkPaidBusy] = useState(false);
  const [markPaidError, setMarkPaidError] = useState("");
  const [downloadingId, setDownloadingId] = useState("");
  const [resendingId, setResendingId] = useState("");
  const [resendError, setResendError] = useState("");

  const fetchHistory = () => {
    setHistoryLoading(true);
    api
      .get("/api/admin/manual-invoices")
      .then((res) => setHistory(res.data.invoices || []))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // The mark-paid editor is a modal now, so it owns the page while open:
  // Escape closes it (unless a save is in flight, where closing would hide
  // the spinner on a request that is still running) and the page behind it
  // is locked so scrolling the backdrop doesn't move the list underneath.
  useEffect(() => {
    if (!markPaidRowId) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape" && !markPaidBusy) setMarkPaidRowId("");
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [markPaidRowId, markPaidBusy]);

  const markPaidInvoice = useMemo(
    () => history.find((invoice) => invoice._id === markPaidRowId) || null,
    [history, markPaidRowId]
  );

  const amountCentsPreview = useMemo(() => {
    const parsed = Number(amount);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0;
  }, [amount]);

  const canSubmit =
    !submitting &&
    name.trim() !== "" &&
    email.trim() !== "" &&
    description.trim() !== "" &&
    amountCentsPreview > 0;

  const resetForm = () => {
    setName("");
    setEmail("");
    setDescription("");
    setAmount("");
    setStatus("due");
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setCreated(null);
    setSubmitting(true);
    try {
      const res = await api.post("/api/admin/manual-invoices", {
        name,
        email,
        description,
        amount,
        status,
      });
      setCreated(res.data.invoice);
      resetForm();
      fetchHistory();
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to generate invoice.");
    } finally {
      setSubmitting(false);
    }
  };

  const download = async (id) => {
    setDownloadingId(id);
    try {
      const res = await api.get(`/api/admin/manual-invoices/${id}/download`);
      if (res.data?.url) window.open(res.data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      window.alert(err.response?.data?.msg || "Failed to generate download link.");
    } finally {
      setDownloadingId("");
    }
  };

  // Re-sends the existing invoice's email as-is — no new invoice, no PDF
  // regeneration. For one whose original send failed (see its emailError)
  // or was never attempted.
  const resendEmail = async (id) => {
    setResendingId(id);
    setResendError("");
    try {
      await api.post(`/api/admin/manual-invoices/${id}/resend-email`);
      fetchHistory();
    } catch (err) {
      setResendError(err.response?.data?.msg || "Failed to resend the email.");
    } finally {
      setResendingId("");
    }
  };

  const openMarkPaid = (id) => {
    setMarkPaidRowId(id);
    setMarkPaidResend(true);
    setMarkPaidError("");
  };

  const closeMarkPaid = () => {
    if (markPaidBusy) return;
    setMarkPaidRowId("");
  };

  const confirmMarkPaid = async (id) => {
    setMarkPaidBusy(true);
    setMarkPaidError("");
    try {
      await api.patch(`/api/admin/manual-invoices/${id}/mark-paid`, {
        resendEmail: markPaidResend,
      });
      setMarkPaidRowId("");
      fetchHistory();
    } catch (err) {
      setMarkPaidError(err.response?.data?.msg || "Failed to update invoice.");
    } finally {
      setMarkPaidBusy(false);
    }
  };

  const paidCount = history.filter((invoice) => invoice.status === "paid").length;
  const dueCount = history.length - paidCount;

  return (
    <div className="mi-page">
      <header className="mi-header">
        <div className="mi-header__text">
          <p className="mi-eyebrow">Billing</p>
          <h1>Manual Invoice</h1>
          <p className="mi-header__sub">
            Create and email a B2B invoice — as a bill still due, or a receipt for payment already received.
          </p>
        </div>
        {/* Two counts instead of one raw total: "12 invoices" says much less
            than how many are still unpaid, which is the number an admin is
            actually scanning this page for. */}
        <div className="mi-metrics">
          <div className="mi-metric">
            <span>Awaiting payment</span>
            <strong className="mi-metric__value mi-metric__value--due">{dueCount}</strong>
          </div>
          <div className="mi-metric">
            <span>Paid</span>
            <strong className="mi-metric__value mi-metric__value--paid">{paidCount}</strong>
          </div>
        </div>
      </header>

      <section className="mi-card">
        <form onSubmit={submit} className="mi-form">
          <div className="mi-card__title">
            <h2>Invoice Details</h2>
            <p>Amount is always in USD. The client receives the invoice PDF by email.</p>
          </div>

          <div className="mi-grid">
            <label className="mi-field">
              <span className="mi-field__label">Client Name</span>
              <input
                type="text"
                className="mi-input"
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Acme Corp Pvt Ltd"
                required
              />
            </label>
            <label className="mi-field">
              <span className="mi-field__label">Client Email</span>
              <input
                type="email"
                className="mi-input"
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="accounts@acmecorp.example"
                required
              />
            </label>
          </div>

          <label className="mi-field">
            <span className="mi-field__label">Description</span>
            <textarea
              className="mi-input mi-textarea"
              rows={2}
              maxLength={500}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Corporate wellness consultation package (Aug 2026)"
              required
            />
            {/* Counter only appears near the ceiling — an always-on counter
                reads as a warning about a limit nobody is close to. */}
            {description.length > 400 && (
              <small className="mi-hint mi-hint--count">{500 - description.length} characters left</small>
            )}
          </label>

          <div className="mi-grid">
            <label className="mi-field">
              <span className="mi-field__label">Amount</span>
              <div className="mi-amount">
                <span className="mi-amount__prefix">USD</span>
                <input
                  type="number"
                  className="mi-input mi-amount__input"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="2500.00"
                  required
                />
              </div>
              <small className="mi-hint">
                {amountCentsPreview > 0
                  ? `Client will be billed ${formatMoney(amountCentsPreview, "USD")}`
                  : "Enter the total payable amount."}
              </small>
            </label>

            <label className="mi-field">
              <span className="mi-field__label">Status</span>
              <select
                className="mi-input mi-select"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="due">Due — bill the client (not yet paid)</option>
                <option value="paid">Paid — issue a receipt (payment already received)</option>
              </select>
              <small className="mi-hint">
                {status === "paid"
                  ? "The PDF will be issued as a paid receipt."
                  : "The PDF will show an outstanding balance."}
              </small>
            </label>
          </div>

          {error && (
            <div className="mi-alert" role="alert">
              {error}
            </div>
          )}

          <div className="mi-form__actions">
            <button className="mi-btn mi-btn--primary" type="submit" disabled={!canSubmit}>
              {submitting && <span className="mi-spinner" aria-hidden="true" />}
              {submitting ? "Generating…" : "Generate & Send Invoice"}
            </button>
            <small className="mi-hint">The invoice is emailed to the client as soon as it is generated.</small>
          </div>
        </form>
      </section>

      {created && (
        <div className="mi-banner" role="status">
          <span className="mi-banner__icon" aria-hidden="true">
            ✓
          </span>
          <div className="mi-banner__body">
            <strong className="mi-banner__title">Invoice {created.invoiceNumber} created</strong>
            <span className="mi-banner__meta">
              {formatMoney(created.amountCents, created.currency)} · {statusLabel(created.status)} ·{" "}
              {created.emailed ? (
                "emailed to the client"
              ) : (
                <em className="mi-banner__warn">email failed — retry from the history below</em>
              )}
            </span>
          </div>
          <div className="mi-banner__actions">
            {created._id && (
              <button
                className="mi-btn mi-btn--ghost mi-btn--sm"
                type="button"
                disabled={downloadingId === created._id}
                onClick={() => download(created._id)}
              >
                {downloadingId === created._id ? "Preparing…" : "Download PDF"}
              </button>
            )}
            <button className="mi-icon-btn" type="button" onClick={() => setCreated(null)} aria-label="Dismiss">
              ×
            </button>
          </div>
        </div>
      )}

      <section className="mi-card">
        <div className="mi-card__head">
          <div className="mi-card__title">
            <p className="mi-eyebrow">History</p>
            <h2>Recent Invoices</h2>
          </div>
          <button
            className="mi-btn mi-btn--ghost mi-btn--sm"
            type="button"
            onClick={fetchHistory}
            disabled={historyLoading}
          >
            {historyLoading && <span className="mi-spinner mi-spinner--dark" aria-hidden="true" />}
            {historyLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {resendError && (
          <div className="mi-alert" role="alert">
            {resendError}
          </div>
        )}

        {historyLoading ? (
          // Skeleton rows rather than a "Loading..." line: the list keeps its
          // shape while it loads, so the page doesn't jump once rows arrive.
          <div className="mi-skeleton" aria-busy="true" aria-label="Loading invoices">
            {[0, 1, 2, 3].map((row) => (
              <div className="mi-skeleton__row" key={row}>
                <span className="mi-skeleton__bar" style={{ width: "16%" }} />
                <span className="mi-skeleton__bar" style={{ width: "12%" }} />
                <span className="mi-skeleton__bar" style={{ width: "24%" }} />
                <span className="mi-skeleton__bar" style={{ width: "20%" }} />
                <span className="mi-skeleton__bar" style={{ width: "10%" }} />
              </div>
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="mi-empty">
            <div className="mi-empty__icon" aria-hidden="true">
              🧾
            </div>
            <strong>No manual invoices yet</strong>
            <span>Invoices you generate above will appear here, newest first.</span>
          </div>
        ) : (
          <div className="mi-table-wrap">
            <table className="mi-table">
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Invoice #</th>
                  <th>Client</th>
                  <th>Description</th>
                  <th className="mi-col-amount">Amount</th>
                  <th>Status</th>
                  <th className="mi-col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map((invoice) => (
                  // data-label drives the stacked card layout under 820px —
                  // each cell prints its own header, so a 7-column table
                  // doesn't force a horizontal scroll on a phone.
                  <tr key={invoice._id}>
                    <td data-label="Created" className="mi-cell-muted">
                      {formatDate(invoice.createdAt)}
                    </td>
                    <td data-label="Invoice #" className="mi-cell-number">
                      {invoice.invoiceNumber}
                    </td>
                    <td data-label="Client">
                      <div className="mi-person">
                        <strong>{invoice.clientName}</strong>
                        <span title={invoice.clientEmail}>{invoice.clientEmail}</span>
                      </div>
                    </td>
                    <td data-label="Description">
                      {/* Clamped to two lines with the full text on hover: one
                          long package description would otherwise stretch this
                          column and squeeze every other one. */}
                      <span className="mi-desc" title={invoice.description}>
                        {invoice.description}
                      </span>
                    </td>
                    <td data-label="Amount" className="mi-col-amount mi-cell-amount">
                      {formatMoney(invoice.amountCents, invoice.currency)}
                    </td>
                    <td data-label="Status">
                      <span className={`mi-status mi-status--${invoice.status === "paid" ? "paid" : "due"}`}>
                        {statusLabel(invoice.status)}
                      </span>
                      {!invoice.emailed && (
                        <span className="mi-email-flag" title={invoice.emailError || "Email not yet sent"}>
                          ⚠ not emailed
                        </span>
                      )}
                    </td>
                    <td data-label="Actions" className="mi-col-actions">
                      <div className="mi-actions">
                        <button
                          className="mi-btn mi-btn--link"
                          type="button"
                          disabled={downloadingId === invoice._id}
                          onClick={() => download(invoice._id)}
                        >
                          {downloadingId === invoice._id && <span className="mi-spinner" aria-hidden="true" />}
                          Download
                        </button>
                        {invoice.status === "due" && (
                          <button
                            className="mi-btn mi-btn--link mi-btn--accent"
                            type="button"
                            onClick={() => openMarkPaid(invoice._id)}
                          >
                            Mark as Paid
                          </button>
                        )}
                        {!invoice.emailed && (
                          <button
                            className="mi-btn mi-btn--link mi-btn--accent"
                            type="button"
                            disabled={resendingId === invoice._id}
                            onClick={() => resendEmail(invoice._id)}
                          >
                            {resendingId === invoice._id && <span className="mi-spinner" aria-hidden="true" />}
                            Resend Email
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Lifted out of the table into a modal. Inside a <td colSpan={7}> it
          inherited the table's width and horizontal scroll, so on a narrow
          screen the form sat off-canvas next to the row it belonged to. */}
      {markPaidInvoice && (
        <div className="mi-modal" role="presentation" onMouseDown={closeMarkPaid}>
          <div
            className="mi-modal__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mi-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mi-modal__head">
              <div>
                <p className="mi-eyebrow">Mark as paid</p>
                <h3 id="mi-modal-title">{markPaidInvoice.invoiceNumber}</h3>
              </div>
              <button
                className="mi-icon-btn"
                type="button"
                onClick={closeMarkPaid}
                disabled={markPaidBusy}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <dl className="mi-summary">
              <div>
                <dt>Client</dt>
                <dd>{markPaidInvoice.clientName}</dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd className="mi-cell-amount">
                  {formatMoney(markPaidInvoice.amountCents, markPaidInvoice.currency)}
                </dd>
              </div>
            </dl>

            <label className="mi-check">
              <input
                type="checkbox"
                checked={markPaidResend}
                onChange={(event) => setMarkPaidResend(event.target.checked)}
              />
              <span>
                Email the updated receipt to the client
                <small>Sends a fresh PDF marked as paid to {markPaidInvoice.clientEmail}.</small>
              </span>
            </label>

            {markPaidError && (
              <div className="mi-alert" role="alert">
                {markPaidError}
              </div>
            )}

            <div className="mi-modal__buttons">
              <button className="mi-btn mi-btn--ghost" type="button" onClick={closeMarkPaid} disabled={markPaidBusy}>
                Cancel
              </button>
              <button
                className="mi-btn mi-btn--primary"
                type="button"
                disabled={markPaidBusy}
                onClick={() => confirmMarkPaid(markPaidInvoice._id)}
              >
                {markPaidBusy && <span className="mi-spinner" aria-hidden="true" />}
                {markPaidBusy ? "Saving…" : "Confirm Paid"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}