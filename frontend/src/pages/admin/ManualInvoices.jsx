import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../api";
import "./ManualInvoices.css";

// Replace this with the real asset path (or an imported file) later.
const LOGO_SRC = "/humancare-logo.png";

// The issuer block is printed, not typed — it is the same on every invoice,
// and mirrors the FROM column drawn by backend/utils/invoicePdf.js.
const ISSUER = {
  name: "Humancare Connect, Inc.",
  lines: [
    "4 Peddlers Row, 1091 Newark,",
    "DE 19702, USA",
    "+1 (302) 303-9993",
    "support@humancareconnect.co",
  ],
  support: "support@humancareconnect.co",
  phone: "+1 (302) 303-9993",
  footerAddress: "4 Peddlers Row, 1091 Newark, DE 19702, USA",
};

const CURRENCY_OPTIONS = [
  { code: "USD", label: "USD ($)", symbol: "$" },
  { code: "EUR", label: "EUR (€)", symbol: "€" },
  { code: "GBP", label: "GBP (£)", symbol: "£" },
];

// value/days pairs drive the "Payment Terms" select below — picking one
// recomputes the Due Date field to today + days, while the Due Date itself
// stays freely editable afterward for a one-off exception.
const PAYMENT_TERMS_OPTIONS = [
  { value: "Due on Receipt", days: 0 },
  { value: "Net 15 Days", days: 15 },
  { value: "Net 30 Days", days: 30 },
  { value: "Net 60 Days", days: 60 },
];

// Recent Invoices list: how many rows load per page.
const HISTORY_PAGE_SIZE = 8;

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "due", label: "Due" },
  { value: "paid", label: "Paid" },
];

function toDateInputValue(date) {
  const d = new Date(date);
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function computeItemAmountCents(item) {
  const quantity = Number(item.quantity);
  const rate = Number(item.rate);
  if (
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !Number.isFinite(rate) ||
    rate < 0
  )
    return 0;
  const rateCents = Math.round(rate * 100);
  return Math.round(quantity * rateCents);
}

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

function currencySymbol(code) {
  return (
    CURRENCY_OPTIONS.find((option) => option.code === code)?.symbol || code
  );
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

// Printed the way the issued PDF prints it: "Sep 19, 2026".
function formatDocDate(value) {
  if (!value) return "—";
  const d =
    typeof value === "string" ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusLabel(status) {
  return status === "paid" ? "Paid" : "Due";
}

export default function ManualInvoices() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [paymentTerms, setPaymentTerms] = useState(
    PAYMENT_TERMS_OPTIONS[2].value,
  );
  const [dueDate, setDueDate] = useState(() =>
    toDateInputValue(Date.now() + PAYMENT_TERMS_OPTIONS[2].days * 86400000),
  );
  const nextItemId = useRef(2);
  const [items, setItems] = useState([
    { id: 1, description: "", quantity: "1", rate: "" },
  ]);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("due");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  // Global due/paid counts for the toolbar metrics — fetched independently
  // of the (now paginated, filterable) `history` list below, since that list
  // only ever holds one page's worth of rows and can't be summed for a
  // sitewide total.
  const [dueCount, setDueCount] = useState(0);
  const [paidCount, setPaidCount] = useState(0);

  const [markPaidRowId, setMarkPaidRowId] = useState("");
  const [markPaidBusy, setMarkPaidBusy] = useState(false);
  const [markPaidError, setMarkPaidError] = useState("");
  const [downloadingId, setDownloadingId] = useState("");
  const [resendingId, setResendingId] = useState("");
  const [resendError, setResendError] = useState("");

  // Overrides let a caller (a pagination click, the search/filter effect
  // below) request a specific page/status/query without waiting for a
  // state update to land first — reading historyPage/statusFilter/
  // searchInput directly here would otherwise use this render's (possibly
  // stale, about-to-change) values instead of the ones the caller intends.
  const fetchHistory = (overrides = {}) => {
    const page = overrides.page ?? historyPage;
    const status = overrides.status ?? statusFilter;
    const q = overrides.q ?? searchInput;

    setHistoryLoading(true);
    const params = { page, limit: HISTORY_PAGE_SIZE };
    if (status !== "all") params.status = status;
    if (q.trim()) params.q = q.trim();

    api
      .get("/api/admin/manual-invoices", { params })
      .then((res) => {
        setHistory(res.data.invoices || []);
        setHistoryPage(res.data.page || page);
        setHistoryTotalPages(res.data.totalPages || 1);
        setHistoryTotal(res.data.total ?? 0);
      })
      .catch(() => {
        setHistory([]);
        setHistoryTotalPages(1);
        setHistoryTotal(0);
      })
      .finally(() => setHistoryLoading(false));
  };

  // Cheap (limit: 1 — only the `total` count is read) sitewide totals,
  // independent of whatever page/filter/search the list below is on.
  const fetchCounts = () => {
    Promise.all([
      api.get("/api/admin/manual-invoices", { params: { status: "due", limit: 1 } }),
      api.get("/api/admin/manual-invoices", { params: { status: "paid", limit: 1 } }),
    ])
      .then(([dueRes, paidRes]) => {
        setDueCount(dueRes.data.total || 0);
        setPaidCount(paidRes.data.total || 0);
      })
      .catch(() => {});
  };

  const goToHistoryPage = (page) => {
    const target = Math.min(Math.max(1, page), historyTotalPages);
    if (target === historyPage || historyLoading) return;
    fetchHistory({ page: target });
  };

  const isFirstHistoryFetch = useRef(true);

  // Runs once immediately on mount, then re-runs (debounced, so typing a
  // search term doesn't fire a request per keystroke) whenever the search
  // text or status filter changes — always resetting back to page 1, since
  // the previous page number may no longer exist under the new filter.
  useEffect(() => {
    if (isFirstHistoryFetch.current) {
      isFirstHistoryFetch.current = false;
      fetchHistory({ page: 1 });
      fetchCounts();
      return undefined;
    }
    const timer = setTimeout(() => {
      fetchHistory({ page: 1 });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, statusFilter]);

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
    [history, markPaidRowId],
  );

  const totalCentsPreview = useMemo(
    () => items.reduce((sum, item) => sum + computeItemAmountCents(item), 0),
    [items],
  );

  const itemsValid = items.every(
    (item) =>
      item.description.trim() !== "" &&
      Number(item.quantity) > 0 &&
      item.rate !== "" &&
      Number(item.rate) >= 0,
  );

  const canSubmit =
    !submitting &&
    name.trim() !== "" &&
    email.trim() !== "" &&
    items.length > 0 &&
    itemsValid &&
    totalCentsPreview > 0;

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: nextItemId.current++, description: "", quantity: "1", rate: "" },
    ]);
  };

  const removeItem = (id) => {
    setItems((prev) =>
      prev.length > 1 ? prev.filter((item) => item.id !== id) : prev,
    );
  };

  const updateItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  // Picking a preset re-anchors Due Date to today + N days; the field stays
  // freely editable afterward for a one-off exception without losing the
  // chosen terms label.
  const applyPaymentTerms = (value) => {
    setPaymentTerms(value);
    const preset = PAYMENT_TERMS_OPTIONS.find(
      (option) => option.value === value,
    );
    if (preset)
      setDueDate(toDateInputValue(Date.now() + preset.days * 86400000));
  };

  const resetForm = () => {
    setName("");
    setEmail("");
    setCompanyName("");
    setAddress("");
    setCurrency("USD");
    setPaymentTerms(PAYMENT_TERMS_OPTIONS[2].value);
    setDueDate(
      toDateInputValue(Date.now() + PAYMENT_TERMS_OPTIONS[2].days * 86400000),
    );
    nextItemId.current = 2;
    setItems([{ id: 1, description: "", quantity: "1", rate: "" }]);
    setDescription("");
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
        companyName,
        address,
        currency,
        paymentTerms,
        dueDate,
        items: items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          rate: Number(item.rate),
        })),
        description,
        status,
      });
      setCreated(res.data.invoice);
      resetForm();
      // Back to page 1 so the just-created invoice (newest first) is visible.
      fetchHistory({ page: 1 });
      fetchCounts();
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
      if (res.data?.url)
        window.open(res.data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      window.alert(
        err.response?.data?.msg || "Failed to generate download link.",
      );
    } finally {
      setDownloadingId("");
    }
  };

  // Sends the invoice's email as-is — no new invoice, no PDF regeneration.
  // Invoices are never emailed automatically at creation, so this is how the
  // client gets the invoice: the admin picks which ones to send (and can
  // send again later for one that already went out).
  const resendEmail = async (id) => {
    setResendingId(id);
    setResendError("");
    try {
      await api.post(`/api/admin/manual-invoices/${id}/resend-email`);
      fetchHistory();
      return true;
    } catch (err) {
      setResendError(err.response?.data?.msg || "Failed to send the email.");
      return false;
    } finally {
      setResendingId("");
    }
  };

  const openMarkPaid = (id) => {
    setMarkPaidRowId(id);
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
      await api.patch(`/api/admin/manual-invoices/${id}/mark-paid`, {});
      setMarkPaidRowId("");
      fetchHistory();
      fetchCounts();
    } catch (err) {
      setMarkPaidError(err.response?.data?.msg || "Failed to update invoice.");
    } finally {
      setMarkPaidBusy(false);
    }
  };

  const isPaid = status === "paid";
  const issueDateLabel = formatDocDate(Date.now());
  const termsLine =
    paymentTerms === "Due on Receipt"
      ? "Payment is due immediately on receipt of this invoice. Please remit payment for the amount above without delay."
      : `Payment is due within ${paymentTerms.replace(/\D/g, "")} days from the invoice date (${paymentTerms.replace(
          " Days",
          "",
        )}). Please remit payment for the amount above by the due date indicated.`;

  return (
    <div className="mi-page">
      {/* Slim toolbar above the sheet — anything *about* the invoices rather
          than *on* one lives here, so the document below stays a faithful
          copy of what the client receives. */}
      <div className="mi-toolbar">
        <p className="mi-eyebrow">Billing · Manual Invoice</p>
        <div className="mi-metrics">
          <div className="mi-metric">
            <span>Awaiting payment</span>
            <strong className="mi-metric__value mi-metric__value--due">
              {dueCount}
            </strong>
          </div>
          <div className="mi-metric">
            <span>Paid</span>
            <strong className="mi-metric__value mi-metric__value--paid">
              {paidCount}
            </strong>
          </div>
        </div>
      </div>

      {/* The form *is* the invoice: same masthead, navy rule, FROM / BILL TO
          columns, meta strip, navy item table, total box, status band and
          TERMS footer as backend/utils/invoicePdf.js draws, with fields
          standing in for the printed values. */}
      <form onSubmit={submit} className="mi-doc">
        <header className="mi-doc__masthead">
          <div className="mi-doc__brand">
            <img
              className="mi-doc__logo"
              src={LOGO_SRC}
              alt="Humancare Connect"
              onError={(event) => {
                event.currentTarget.style.visibility = "hidden";
              }}
            />
          </div>
          <div className="mi-doc__meta">
            <h1 className="mi-doc__title">INVOICE</h1>
            <span
              className="mi-doc__number"
              title="Assigned when the invoice is generated"
            >
              # Draft
            </span>
          </div>
        </header>

        <div className="mi-doc__rule" aria-hidden="true" />

        <div className="mi-doc__parties">
          <section className="mi-doc__party">
            <p className="mi-doc__caption">From</p>
            <p className="mi-doc__issuer">{ISSUER.name}</p>
            {ISSUER.lines.map((line) => (
              <p className="mi-doc__issuer-line" key={line}>
                {line}
              </p>
            ))}
          </section>

          <section className="mi-doc__party">
            <p className="mi-doc__caption">Bill to</p>

            <label className="mi-line">
              <span className="mi-line__label">Company</span>
              <input
                type="text"
                className="mi-input mi-input--strong"
                maxLength={160}
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder={'BAR "Nova Assistance" LTD'}
              />
            </label>

            <label className="mi-line">
              <span className="mi-line__label">Contact name</span>
              <input
                type="text"
                className="mi-input"
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nova Assistance"
                required
              />
            </label>

            <label className="mi-line">
              <span className="mi-line__label">Email</span>
              <input
                type="email"
                className="mi-input"
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="accounts@example.com"
                required
              />
            </label>

            <label className="mi-line">
              <span className="mi-line__label">Address</span>
              <input
                type="text"
                className="mi-input"
                maxLength={200}
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Chisinau, 10th Bucuresti Street"
              />
            </label>
          </section>
        </div>

        {/* Meta strip — the four printed columns above the item table. */}
        <div className="mi-meta">
          <div className="mi-meta__cell">
            <span className="mi-meta__key">Issue Date</span>
            {/* Stamped server-side at generation time, so it is shown, not typed. */}
            <span className="mi-meta__value">{issueDateLabel}</span>
          </div>
          <div className="mi-meta__cell">
            <span className="mi-meta__key">Due Date</span>
            <input
              type="date"
              className="mi-input mi-input--flush mi-input--accent"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </div>
          <div className="mi-meta__cell">
            <span className="mi-meta__key">Payment Terms</span>
            <select
              className="mi-input mi-input--flush mi-select"
              value={paymentTerms}
              onChange={(event) => applyPaymentTerms(event.target.value)}
            >
              {PAYMENT_TERMS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value}
                </option>
              ))}
            </select>
          </div>
          <div className="mi-meta__cell">
            <span className="mi-meta__key">Currency</span>
            <select
              className="mi-input mi-input--flush mi-select"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
            >
              {CURRENCY_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Item table — navy header band, one row per billed line. */}
        <div className="mi-items">
          <div className="mi-items__head">
            <span>Description</span>
            <span className="mi-items__center">Qty</span>
            <span className="mi-items__right">Rate</span>
            <span className="mi-items__right">Amount</span>
            <span aria-hidden="true" />
          </div>
          {items.map((item) => (
            <div className="mi-items__row" key={item.id}>
              <span className="mi-items__mlabel">Description</span>
              <input
                type="text"
                className="mi-input mi-input--flush"
                maxLength={200}
                value={item.description}
                onChange={(event) =>
                  updateItem(item.id, "description", event.target.value)
                }
                placeholder="House Call Visit — Germany"
                required
              />

              <span className="mi-items__mlabel">Qty</span>
              <input
                type="number"
                className="mi-input mi-input--flush mi-input--center"
                min="0.01"
                step="0.01"
                value={item.quantity}
                onChange={(event) =>
                  updateItem(item.id, "quantity", event.target.value)
                }
                required
              />

              <span className="mi-items__mlabel">Rate</span>
              <div className="mi-amount">
                <span className="mi-amount__prefix">
                  {currencySymbol(currency)}
                </span>
                <input
                  type="number"
                  className="mi-input mi-input--flush mi-input--num mi-amount__input"
                  min="0"
                  step="0.01"
                  value={item.rate}
                  onChange={(event) =>
                    updateItem(item.id, "rate", event.target.value)
                  }
                  placeholder="0.00"
                  required
                />
              </div>

              <span className="mi-items__mlabel">Amount</span>
              <span className="mi-items__amount">
                {formatMoney(computeItemAmountCents(item), currency)}
              </span>

              <button
                type="button"
                className="mi-icon-btn"
                onClick={() => removeItem(item.id)}
                disabled={items.length === 1}
                aria-label="Remove line"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="mi-btn mi-btn--ghost mi-btn--sm mi-items__add"
          onClick={addItem}
        >
          + Add line
        </button>

        <div className="mi-total">
          <div className="mi-total__box">
            <span>{isPaid ? "Total Paid:" : "Total Due:"}</span>
            <strong>{formatMoney(totalCentsPreview, currency)}</strong>
          </div>
        </div>

        {/* Status band — the same red/green bar the PDF prints, with the
            issue-as control sitting inside the thing it changes. */}
        <div className={`mi-statusbar mi-statusbar--${status}`}>
          <p className="mi-statusbar__text">
            {isPaid
              ? "STATUS: PAID — Payment received in full. No balance outstanding."
              : "STATUS: UNPAID — Payment is outstanding and due."}
          </p>
          <label className="mi-statusbar__control">
            <span>Issue as</span>
            <select
              className="mi-input mi-input--flush mi-select"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="due">Bill — not yet paid</option>
              <option value="paid">Receipt — already paid</option>
            </select>
          </label>
        </div>

        <section className="mi-doc__block">
          <p className="mi-doc__caption">Terms</p>
          <p className="mi-doc__terms">{termsLine}</p>
          <p className="mi-doc__terms-pair">
            <strong>Payment Due Date:</strong> {formatDocDate(dueDate)}
          </p>
          <p className="mi-doc__terms-pair">
            <strong>Payment Terms:</strong> {paymentTerms}
          </p>
        </section>

        <section className="mi-doc__block">
          <p className="mi-doc__caption">Closing note</p>
          <textarea
            className="mi-input mi-textarea"
            rows={2}
            maxLength={500}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Thank you for your business."
          />
        </section>

        {error && (
          <div className="mi-alert" role="alert">
            {error}
          </div>
        )}

        <div className="mi-doc__actions">
          <small className="mi-hint">
            The invoice is generated only — it is not emailed automatically.
            Use “Send Invoice Email” in Recent Invoices below to email it to
            the client.
          </small>
          <button
            className="mi-btn mi-btn--primary"
            type="submit"
            disabled={!canSubmit}
          >
            {submitting && <span className="mi-spinner" aria-hidden="true" />}
            {submitting ? "Generating…" : "Generate Invoice"}
          </button>
        </div>

        <footer className="mi-doc__foot">
          Humancare Connect &nbsp;|&nbsp; 24/7 Support: {ISSUER.support}{" "}
          &nbsp;|&nbsp; {ISSUER.footerAddress} &nbsp;|&nbsp; {ISSUER.phone}
        </footer>
      </form>

      {created && (
        <div className="mi-banner" role="status">
          <span className="mi-banner__icon" aria-hidden="true">
            ✓
          </span>
          <div className="mi-banner__body">
            <strong className="mi-banner__title">
              Invoice {created.invoiceNumber} created
            </strong>
            <span className="mi-banner__meta">
              {formatMoney(created.amountCents, created.currency)} ·{" "}
              {statusLabel(created.status)} ·{" "}
              {created.emailed
                ? "emailed to the client"
                : "not emailed — send it when you're ready"}
            </span>
          </div>
          <div className="mi-banner__actions">
            {created._id && !created.emailed && (
              <button
                className="mi-btn mi-btn--ghost mi-btn--sm mi-btn--accent"
                type="button"
                disabled={resendingId === created._id}
                onClick={async () => {
                  const ok = await resendEmail(created._id);
                  if (ok)
                    setCreated((prev) =>
                      prev && prev._id === created._id
                        ? { ...prev, emailed: true }
                        : prev,
                    );
                }}
              >
                {resendingId === created._id ? "Sending…" : "Send Invoice Email"}
              </button>
            )}
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
            <button
              className="mi-icon-btn"
              type="button"
              onClick={() => setCreated(null)}
              aria-label="Dismiss"
            >
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
            onClick={() => fetchHistory()}
            disabled={historyLoading}
          >
            {historyLoading && (
              <span
                className="mi-spinner mi-spinner--dark"
                aria-hidden="true"
              />
            )}
            {historyLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div className="mi-history-controls">
          <label className="mi-search" htmlFor="mi-history-search">
            <svg
              className="mi-search__icon"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              id="mi-history-search"
              type="search"
              className="mi-search__input"
              placeholder="Search by client, email, or invoice #"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </label>

          <label className="mi-filter" htmlFor="mi-history-status">
            <span>Status</span>
            <select
              id="mi-history-status"
              className="mi-input mi-select mi-filter__select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {resendError && (
          <div className="mi-alert" role="alert">
            {resendError}
          </div>
        )}

        {historyLoading ? (
          // Skeleton rows rather than a "Loading..." line: the list keeps its
          // shape while it loads, so the page doesn't jump once rows arrive.
          <div
            className="mi-skeleton"
            aria-busy="true"
            aria-label="Loading invoices"
          >
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
            {searchInput.trim() || statusFilter !== "all" ? (
              <>
                <strong>No invoices match your search</strong>
                <span>Try a different name, email, invoice number, or status filter.</span>
              </>
            ) : (
              <>
                <strong>No manual invoices yet</strong>
                <span>
                  Invoices you generate above will appear here, newest first.
                </span>
              </>
            )}
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
                        <span title={invoice.clientEmail}>
                          {invoice.clientEmail}
                        </span>
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
                    <td
                      data-label="Amount"
                      className="mi-col-amount mi-cell-amount"
                    >
                      {formatMoney(invoice.amountCents, invoice.currency)}
                    </td>
                    <td data-label="Status">
                      <span
                        className={`mi-status mi-status--${invoice.status === "paid" ? "paid" : "due"}`}
                      >
                        {statusLabel(invoice.status)}
                      </span>
                      {invoice.emailed ? (
                        <span
                          className="mi-email-flag mi-email-flag--sent"
                          title={`Emailed to ${invoice.clientEmail}`}
                        >
                          ✓ emailed
                        </span>
                      ) : invoice.emailError ? (
                        <span
                          className="mi-email-flag"
                          title={invoice.emailError}
                        >
                          ⚠ email failed
                        </span>
                      ) : (
                        <span
                          className="mi-email-flag mi-email-flag--muted"
                          title="Not emailed to the client yet"
                        >
                          not emailed
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
                          {downloadingId === invoice._id && (
                            <span className="mi-spinner" aria-hidden="true" />
                          )}
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
                        <button
                          className="mi-btn mi-btn--link mi-btn--accent"
                          type="button"
                          disabled={resendingId === invoice._id}
                          onClick={() => resendEmail(invoice._id)}
                        >
                          {resendingId === invoice._id && (
                            <span className="mi-spinner" aria-hidden="true" />
                          )}
                          {invoice.emailed ? "Resend Email" : "Send Invoice Email"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!historyLoading && history.length > 0 && (
          <div className="mi-pagination">
            <span className="mi-pagination__info">
              Page {historyPage} of {historyTotalPages} · {historyTotal}{" "}
              invoice{historyTotal === 1 ? "" : "s"}
            </span>
            <div className="mi-pagination__controls">
              <button
                type="button"
                className="mi-btn mi-btn--ghost mi-btn--sm"
                onClick={() => goToHistoryPage(historyPage - 1)}
                disabled={historyPage <= 1}
              >
                ← Previous
              </button>
              <button
                type="button"
                className="mi-btn mi-btn--ghost mi-btn--sm"
                onClick={() => goToHistoryPage(historyPage + 1)}
                disabled={historyPage >= historyTotalPages}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Lifted out of the table into a modal. Inside a <td colSpan={7}> it
          inherited the table's width and horizontal scroll, so on a narrow
          screen the form sat off-canvas next to the row it belonged to. */}
      {markPaidInvoice && (
        <div
          className="mi-modal"
          role="presentation"
          onMouseDown={closeMarkPaid}
        >
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
                  {formatMoney(
                    markPaidInvoice.amountCents,
                    markPaidInvoice.currency,
                  )}
                </dd>
              </div>
            </dl>

            <p className="mi-modal__note">
              The invoice PDF is regenerated as a paid receipt. No email is
              sent — use “Send Invoice Email” on the invoice afterward to send
              the updated receipt to {markPaidInvoice.clientEmail}.
            </p>

            {markPaidError && (
              <div className="mi-alert" role="alert">
                {markPaidError}
              </div>
            )}

            <div className="mi-modal__buttons">
              <button
                className="mi-btn mi-btn--ghost"
                type="button"
                onClick={closeMarkPaid}
                disabled={markPaidBusy}
              >
                Cancel
              </button>
              <button
                className="mi-btn mi-btn--primary"
                type="button"
                disabled={markPaidBusy}
                onClick={() => confirmMarkPaid(markPaidInvoice._id)}
              >
                {markPaidBusy && (
                  <span className="mi-spinner" aria-hidden="true" />
                )}
                {markPaidBusy ? "Saving…" : "Confirm Paid"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
