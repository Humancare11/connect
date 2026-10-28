import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../api";
import {
  PAYMENT_TERMS_OPTIONS,
  DEFAULT_PAYMENT_TERMS,
  computeItemAmountCents,
  dueDateForTerms,
  termsLine,
} from "./invoiceForm";
import { InvoiceCell, InvoiceStatusPill } from "./PaymentLinkInvoice";
import { emailStatusLabel, useInvoiceActions } from "./paymentLinkInvoiceActions";
import "./PaymentLinks.css";

const ZERO_DECIMAL_CURRENCIES = new Set(["JPY"]);
const CURRENCY = "USD";

const EMPTY_CLIENT = {
  name: "",
  email: "",
  companyName: "",
  registrationNumber: "",
  country: "",
  postalCode: "",
  address: "",
};

function currencyFactor(currency) {
  return ZERO_DECIMAL_CURRENCIES.has(String(currency).toUpperCase()) ? 1 : 100;
}

function formatMoney(amountMinor, currency = "USD") {
  const code = String(currency || "USD").toUpperCase();
  return (amountMinor / currencyFactor(code)).toLocaleString("en-US", {
    style: "currency",
    currency: code,
    maximumFractionDigits: ZERO_DECIMAL_CURRENCIES.has(code) ? 0 : 2,
  });
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

// "Sep 19, 2026" from a "YYYY-MM-DD" date-input value.
function formatDueDate(value) {
  const d = new Date(`${value}T00:00:00`);
  return value && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "-";
}

// YYMM, the suffix of every invoice number (HCnn-YYMM).
const invoicePeriod = `${String(new Date().getFullYear()).slice(-2)}${String(new Date().getMonth() + 1).padStart(2, "0")}`;

const newItem = (id) => ({ id, description: "", quantity: "1", rate: "" });

function statusLabel(status) {
  return status === "paid" ? "Paid" : status === "expired" ? "Expired" : "Pending";
}

export default function PaymentLinks() {
  const [client, setClient] = useState(EMPTY_CLIENT);
  const [paymentTerms, setPaymentTerms] = useState(DEFAULT_PAYMENT_TERMS.value);
  const [dueDate, setDueDate] = useState(() => dueDateForTerms(DEFAULT_PAYMENT_TERMS.value));
  const [items, setItems] = useState([newItem(1)]);
  const nextItemId = useRef(2);
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [created, setCreated] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const setClientField = (key) => (event) => setClient((prev) => ({ ...prev, [key]: event.target.value }));

  // The payer is charged the invoice total — there is no separate amount.
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + computeItemAmountCents(item), 0), [items]);
  const itemCount = items.filter((item) => computeItemAmountCents(item) > 0).length;
  const awaitingPayment = useMemo(
    () => history.filter((link) => link.invoice?.status === "due").length,
    [history],
  );

  const generatedUrl = created?.url || (created ? `${window.location.origin}/pay/${created.token}` : "");

  const fetchHistory = () => {
    setHistoryLoading(true);
    api.get("/api/payments/admin/payment-links")
      .then((res) => setHistory(res.data.links || []))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const actions = useInvoiceActions((invoice, link) => {
    if (invoice) setCreated((prev) => (prev && prev._id === link._id ? { ...prev, invoice } : prev));
    fetchHistory();
  });

  // Picking terms re-anchors Due Date to today + N days; the field stays
  // editable afterward for a one-off exception.
  const applyPaymentTerms = (value) => {
    setPaymentTerms(value);
    const due = dueDateForTerms(value);
    if (due) setDueDate(due);
  };

  const updateItem = (id, key, value) =>
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  const addItem = () => setItems((prev) => [...prev, newItem(nextItemId.current++)]);
  const removeItem = (id) => setItems((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev));

  const resetForm = () => {
    setClient(EMPTY_CLIENT);
    setPaymentTerms(DEFAULT_PAYMENT_TERMS.value);
    setDueDate(dueDateForTerms(DEFAULT_PAYMENT_TERMS.value));
    nextItemId.current = 2;
    setItems([newItem(1)]);
    setDescription("");
    setNote("");
  };

  const createLink = async (event) => {
    event.preventDefault();
    setError("");
    setCopied(false);
    setCreated(null);
    setLoading(true);
    try {
      const res = await api.post("/api/payments/admin/payment-links", {
        ...client,
        paymentTerms,
        dueDate,
        description,
        note,
        currency: CURRENCY,
        items: items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          rate: Number(item.rate),
        })),
      });
      setCreated(res.data);
      resetForm();
      fetchHistory();
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to generate payment link.");
    } finally {
      setLoading(false);
    }
  };

  const copyHistoryLink = async (url) => {
    await navigator.clipboard.writeText(url);
  };

  const copyLink = async () => {
    if (!generatedUrl) return;
    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="pl-admin pl-admin--wide">
      <div className="pl-admin__header pl-admin__header--surface">
        <div>
          <p className="pl-admin__eyebrow">Payment Admin</p>
          <h1>Generate Payment Link</h1>
          <p>Create a fixed-amount payment page and send the link to a client.</p>
        </div>
        <div className="pl-header-metrics">
          <div className="pl-header-metric">
            <span>Awaiting payment</span>
            <strong>{awaitingPayment}</strong>
          </div>
          <div className="pl-header-metric">
            <span>Recent activity</span>
            <strong>{history.length}</strong>
          </div>
        </div>
      </div>

      <div className="pl-admin__grid">
        <form className="pl-card pl-form" onSubmit={createLink}>
          <div className="pl-form__title">
            <h2>Payment Details</h2>
            <p>Invoice ke items ka Total hi customer ka payment amount banega ({CURRENCY}).</p>
          </div>

          <section className="pl-section">
            <h3 className="pl-section__title">Bill to</h3>
            <div className="pl-form-grid pl-form-grid--2">
              <label className="pl-field">
                <span>Client name *</span>
                <input className="pl-input" type="text" maxLength={120} required value={client.name}
                  onChange={setClientField("name")} placeholder="Nova Assistance" />
              </label>
              <label className="pl-field">
                <span>Client email *</span>
                <input className="pl-input" type="email" maxLength={254} required value={client.email}
                  onChange={setClientField("email")} placeholder="accounts@example.com" />
              </label>
              <label className="pl-field">
                <span>Company</span>
                <input className="pl-input" type="text" maxLength={160} value={client.companyName}
                  onChange={setClientField("companyName")} placeholder={'BAR "Nova Assistance" LTD'} />
              </label>
              <label className="pl-field">
                <span>Personal number</span>
                <input className="pl-input" type="text" maxLength={60} value={client.registrationNumber}
                  onChange={setClientField("registrationNumber")} />
              </label>
              <label className="pl-field">
                <span>Country</span>
                <input className="pl-input" type="text" maxLength={100} value={client.country}
                  onChange={setClientField("country")} />
              </label>
              <label className="pl-field">
                <span>Postal code</span>
                <input className="pl-input" type="text" maxLength={30} value={client.postalCode}
                  onChange={setClientField("postalCode")} />
              </label>
            </div>
            <label className="pl-field">
              <span>Address</span>
              <input className="pl-input" type="text" maxLength={200} value={client.address}
                onChange={setClientField("address")} placeholder="Chisinau, 10th Bucuresti Street" />
            </label>
          </section>

          <section className="pl-section">
            <h3 className="pl-section__title">Payment</h3>
            <div className="pl-form-grid pl-form-grid--3">
              <label className="pl-field">
                <span>Payment terms</span>
                <select className="pl-select" value={paymentTerms} onChange={(event) => applyPaymentTerms(event.target.value)}>
                  {PAYMENT_TERMS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.value}</option>
                  ))}
                </select>
              </label>
              <label className="pl-field">
                <span>Due date</span>
                <input className="pl-input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </label>
              <label className="pl-field">
                <span>Issue as</span>
                <select className="pl-select" value="due" disabled>
                  <option value="due">Bill — not yet paid</option>
                </select>
                <span className="pl-hint">Payment link ke saath hamesha "Bill" banega. Customer pay karega to apne aap "Paid" ho jayega.</span>
              </label>
            </div>
          </section>

          <section className="pl-section">
            <h3 className="pl-section__title">Items</h3>
            <div className="pl-items">
              <div className="pl-item-row pl-item-row--head" aria-hidden="true">
                <span>Item</span><span>Quantity</span><span>Rate ({CURRENCY})</span><span>Amount</span><span />
              </div>
              {items.map((item) => (
                <div className="pl-item-row" key={item.id}>
                  <input className="pl-input" type="text" maxLength={200} required value={item.description}
                    onChange={(event) => updateItem(item.id, "description", event.target.value)}
                    placeholder="House Call Visit — Germany" aria-label="Item" />
                  <input className="pl-input" type="number" min="0.01" step="any" required value={item.quantity}
                    onChange={(event) => updateItem(item.id, "quantity", event.target.value)} aria-label="Quantity" />
                  <input className="pl-input" type="number" min="0" step="0.01" required value={item.rate}
                    onChange={(event) => updateItem(item.id, "rate", event.target.value)}
                    placeholder="0.00" aria-label="Rate" />
                  <span className="pl-item-row__amount">{formatMoney(computeItemAmountCents(item), CURRENCY)}</span>
                  <button className="pl-item-row__remove" type="button" disabled={items.length === 1}
                    onClick={() => removeItem(item.id)} aria-label="Remove item">×</button>
                </div>
              ))}
              <button className="pl-link-btn pl-items__add" type="button" onClick={addItem}>+ Add Item</button>
            </div>
            <dl className="pl-totals">
              <div><dt>Subtotal</dt><dd>{formatMoney(subtotal, CURRENCY)}</dd></div>
              <div><dt>Tax (0%)</dt><dd>{formatMoney(0, CURRENCY)}</dd></div>
              <div className="pl-totals__total"><dt>Total</dt><dd>{formatMoney(subtotal, CURRENCY)}</dd></div>
            </dl>
          </section>

          <section className="pl-section">
            <h3 className="pl-section__title">Notes &amp; Terms</h3>
            <label className="pl-field">
              <span>Notes (printed on the invoice)</span>
              <textarea rows={3} maxLength={500} value={description}
                onChange={(event) => setDescription(event.target.value)} placeholder="Thank you for your business." />
            </label>
            <p className="pl-terms">{termsLine(paymentTerms)}</p>
          </section>

          <label className="pl-field">
            <span>Note</span>
            <textarea rows={2} maxLength={250} value={note}
              onChange={(event) => setNote(event.target.value)} placeholder="Optional internal note" />
          </label>

          {error && <div className="pl-error">{error}</div>}

          <button className="pl-primary" type="submit" disabled={loading || !subtotal}>
            {loading ? "Generating..." : "Generate Link & Invoice"}
          </button>
          <p className="pl-hint">Email apne aap nahi jayega. Link banne ke baad Send Email button se bhejiye.</p>
        </form>

        <div className="pl-card pl-preview">
          <span className="pl-preview__label">Client will pay</span>
          <strong>{formatMoney(subtotal, CURRENCY)}</strong>
          <p>This exact amount and currency will appear on the customer payment page.</p>
          <span className="pl-preview__from">Amount = invoice Total</span>
          <span className="pl-preview__label pl-preview__label--invoice">Invoice preview</span>
          <dl className="pl-invoice-preview">
            <div><dt>Invoice no.</dt><dd>Auto (HCnn-{invoicePeriod})</dd></div>
            <div><dt>Bill to</dt><dd>{client.name || "-"}</dd></div>
            <div><dt>Items</dt><dd>{itemCount}</dd></div>
            <div><dt>Due date</dt><dd>{formatDueDate(dueDate)}</dd></div>
            <div><dt>Subtotal</dt><dd>{formatMoney(subtotal, CURRENCY)}</dd></div>
            <div><dt>Tax (0%)</dt><dd>{formatMoney(0, CURRENCY)}</dd></div>
            <div className="pl-invoice-preview__total"><dt>Total</dt><dd>{formatMoney(subtotal, CURRENCY)}</dd></div>
          </dl>
        </div>
      </div>

      {created && (
        <div className="pl-card pl-result pl-result--stack">
          <div className="pl-result__row">
            <div>
              <span className="pl-result__label">Generated payment link</span>
              <a href={generatedUrl} target="_blank" rel="noreferrer">{generatedUrl}</a>
              <span className="pl-result__amount">{formatMoney(created.amountPaise, created.currency)}</span>
            </div>
            <button className="pl-secondary" type="button" onClick={copyLink}>
              {copied ? "Copied" : "Copy Link"}
            </button>
          </div>
          {created.invoice && (
            <div className="pl-invoice-box">
              <div>
                <span className="pl-result__label">Invoice</span>
                <div className="pl-invoice-cell__top">
                  <strong className="pl-strong">{created.invoice.invoiceNumber}</strong>
                  <InvoiceStatusPill status={created.invoice.status} />
                </div>
                <span className={`pl-email-flag${created.invoice.emailed ? " pl-email-flag--sent" : ""}`}>
                  {created.invoice.emailed || created.invoice.emailError
                    ? emailStatusLabel(created.invoice)
                    : "Email abhi nahi bheja gaya"}
                </span>
              </div>
              <div className="pl-inline-actions">
                <button className="pl-secondary" type="button" disabled={Boolean(actions.busy)}
                  onClick={() => actions.download(created.invoice)}>
                  {actions.busy === `dl:${created.invoice._id}` ? "Preparing…" : "Download PDF"}
                </button>
                <button className="pl-secondary" type="button" disabled={Boolean(actions.busy)}
                  onClick={() => actions.sendEmail(created)}>
                  {actions.busy === `mail:${created._id}` ? "Sending…" : created.invoice.emailed ? "Resend Email" : "Send Email"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="pl-card pl-history">
        <div className="pl-history__head">
          <div>
            <span className="pl-result__label">History</span>
            <h2>Recent Payments</h2>
          </div>
          <button className="pl-secondary" type="button" onClick={fetchHistory}>Refresh</button>
        </div>

        {historyLoading ? (
          <div className="pl-empty">Loading history...</div>
        ) : history.length === 0 ? (
          <div className="pl-empty">No payment links generated yet.</div>
        ) : (
          <div className="pl-table-wrap">
            <table className="pl-table">
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Note</th>
                  <th>Invoice</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 8).map((link) => (
                  <tr key={link._id || link.token}>
                    <td>{formatDate(link.createdAt)}</td>
                    <td className="pl-strong">{formatMoney(link.amountPaise, link.currency)}</td>
                    <td><span className={`pl-status pl-status--${link.status}`}>{statusLabel(link.status)}</span></td>
                    <td>{link.note || "-"}</td>
                    <td><InvoiceCell link={link} actions={actions} /></td>
                    <td>
                      <button className="pl-link-btn" type="button" onClick={() => copyHistoryLink(link.url)}>
                        Copy
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
