import { useEffect, useMemo, useState } from "react";
// B2B: disabled for now, re-enable later. Do not delete. (B2B code below also used useRef.)
import api from "../../api";
// B2B: disabled for now, re-enable later. Do not delete.
// import { computeItemAmountCents } from "./invoiceForm";
// B2B: disabled for now, re-enable later. Do not delete.
// import {
//   PAYMENT_TERMS_OPTIONS,
//   DEFAULT_PAYMENT_TERMS,
//   dueDateForTerms,
//   termsLine,
// } from "./invoiceForm";
import { InvoiceStatusPill } from "./PaymentLinkInvoice";
import { personOf, splitDateTime } from "./recentPayments";
import B2cInvoiceFields from "./B2cInvoiceFields";
import { useB2cServices } from "./useB2cServices";
import { emailStatusLabel, useInvoiceActions } from "./paymentLinkInvoiceActions";
import "./PaymentLinks.css";

const ZERO_DECIMAL_CURRENCIES = new Set(["JPY"]);
const CURRENCY = "USD";

const B2B_ENABLED = false; // TODO: enable B2B later
// While B2B is off, every link this page creates is an individual (B2C) one.
const CUSTOMER_TYPE = "b2c";

// B2B: disabled for now, re-enable later. Do not delete.
// const EMPTY_CLIENT = {
//   name: "",
//   email: "",
//   companyName: "",
//   registrationNumber: "",
//   country: "",
//   postalCode: "",
//   address: "",
// };

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

// B2B: disabled for now, re-enable later. Do not delete.
// // "Sep 19, 2026" from a "YYYY-MM-DD" date-input value.
// function formatDueDate(value) {
//   const d = new Date(`${value}T00:00:00`);
//   return value && !Number.isNaN(d.getTime())
//     ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
//     : "-";
// }

// YYMM, the suffix of every invoice number (HCnn-YYMM).
const invoicePeriod = `${String(new Date().getFullYear()).slice(-2)}${String(new Date().getMonth() + 1).padStart(2, "0")}`;

// B2B: disabled for now, re-enable later. Do not delete.
// const newItem = (id) => ({ id, description: "", quantity: "1", rate: "" });
// (The B2C service lines live in useB2cServices.js, shared with the Manual Invoices page.)

function statusLabel(status) {
  return status === "paid" ? "Paid" : status === "expired" ? "Expired" : "Pending";
}

// The Invoice column of the Recent Payments table: just the e-mail state and the
// invoice buttons (the invoice number is the "Case Number" column, the payment
// status is the "Status" column, the customer is the "Name" column). Same
// actions as everywhere else on this page; nothing is emailed unless Send Email
// is pressed.
function RecentInvoiceCell({ link, actions }) {
  const invoice = link.invoice;
  if (!invoice) {
    // An older link with no invoice: the existing retry button stays when the
    // invoice step had failed, otherwise there is nothing to show.
    return link.invoiceError ? (
      <div className="pl-recent__inv">
        <span className="pl-recent__mail pl-recent__mail--bad" title={link.invoiceError}>Invoice failed</span>
        <div className="pl-inline-actions">
          <button className="pl-link-btn" type="button" disabled={Boolean(actions.busy)} onClick={() => actions.retryInvoice(link)}>
            {actions.busy === `retry:${link._id}` ? "Retrying…" : "Retry invoice"}
          </button>
        </div>
      </div>
    ) : (
      "-"
    );
  }

  const mailClass = invoice.emailed ? "yes" : invoice.emailError ? "bad" : "no";
  return (
    <div className="pl-recent__inv">
      <span className={`pl-recent__mail pl-recent__mail--${mailClass}`} title={invoice.emailError || undefined}>
        {invoice.emailed ? "✓ Email sent" : invoice.emailError ? "Email failed — try again" : "Email not sent"}
      </span>
      {link.invoiceError && (
        <span className="pl-recent__mail pl-recent__mail--bad" title={link.invoiceError}>Receipt not generated</span>
      )}
      <div className="pl-inline-actions">
        <button className="pl-link-btn" type="button" disabled={Boolean(actions.busy)} onClick={() => actions.download(invoice)}>
          {actions.busy === `dl:${invoice._id}` ? "Preparing…" : "Download"}
        </button>
        <button className="pl-link-btn pl-recent__send" type="button" disabled={Boolean(actions.busy)} onClick={() => actions.sendEmail(link)}>
          {actions.busy === `mail:${link._id}` ? "Sending…" : invoice.emailed ? "Resend Email" : "Send Email"}
        </button>
        {link.invoiceError && (
          <button className="pl-link-btn" type="button" disabled={Boolean(actions.busy)} onClick={() => actions.retryInvoice(link)}>
            {actions.busy === `retry:${link._id}` ? "Retrying…" : "Retry receipt"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function PaymentLinks() {
  // B2B: disabled for now, re-enable later. Do not delete.
  // "b2c" = an individual (name, email, services); "b2b" = the full business
  // form. Each kept its own state, so switching back and forth lost nothing.
  // const [customerType, setCustomerType] = useState("b2c");
  // const isB2c = customerType === "b2c";
  const [person, setPerson] = useState({ name: "", email: "" });
  const serviceState = useB2cServices();
  const { subtotal, count: itemCount } = serviceState;
  // B2B: disabled for now, re-enable later. Do not delete.
  // const [client, setClient] = useState(EMPTY_CLIENT);
  // const [paymentTerms, setPaymentTerms] = useState(DEFAULT_PAYMENT_TERMS.value);
  // const [dueDate, setDueDate] = useState(() => dueDateForTerms(DEFAULT_PAYMENT_TERMS.value));
  // const [items, setItems] = useState([newItem(1)]);
  // const nextItemId = useRef(2);
  // const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [created, setCreated] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // B2B: disabled for now, re-enable later. Do not delete.
  // const setClientField = (key) => (event) => setClient((prev) => ({ ...prev, [key]: event.target.value }));

  // The payer is charged the invoice total — there is no separate amount.
  // (subtotal and itemCount come from useB2cServices above.)
  // B2B: disabled for now, re-enable later. Do not delete.
  // (with B2B on, subtotal/itemCount also depended on the customer type:)
  // const subtotal = useMemo(
  //   () => (isB2c ? services.reduce((sum, service) => sum + serviceCents(service), 0) : items.reduce((sum, item) => sum + computeItemAmountCents(item), 0)),
  //   [isB2c, services, items],
  // );
  // const itemCount = isB2c
  //   ? services.filter((service) => serviceCents(service) > 0).length
  //   : items.filter((item) => computeItemAmountCents(item) > 0).length;
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

  // B2B: disabled for now, re-enable later. Do not delete.
  // // Picking terms re-anchors Due Date to today + N days; the field stays
  // // editable afterward for a one-off exception.
  // const applyPaymentTerms = (value) => {
  //   setPaymentTerms(value);
  //   const due = dueDateForTerms(value);
  //   if (due) setDueDate(due);
  // };
  //
  // const updateItem = (id, key, value) =>
  //   setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  // const addItem = () => setItems((prev) => [...prev, newItem(nextItemId.current++)]);
  // const removeItem = (id) => setItems((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev));

  const resetForm = () => {
    setPerson({ name: "", email: "" });
    serviceState.resetServices();
    // B2B: disabled for now, re-enable later. Do not delete.
    // setClient(EMPTY_CLIENT);
    // setPaymentTerms(DEFAULT_PAYMENT_TERMS.value);
    // setDueDate(dueDateForTerms(DEFAULT_PAYMENT_TERMS.value));
    // nextItemId.current = 2;
    // setItems([newItem(1)]);
    // setDescription("");
    setNote("");
  };

  const createLink = async (event) => {
    event.preventDefault();
    setError("");
    setCopied(false);
    setCreated(null);
    setLoading(true);
    try {
      // A B2C service has no quantity field, so it is always 1 — sent explicitly
      // (the server also forces it).
      const payload = {
        customerType: CUSTOMER_TYPE,
        ...person,
        note,
        currency: CURRENCY,
        items: serviceState.toPayload(),
      };
      // B2B: disabled for now, re-enable later. Do not delete.
      // const payload = isB2c
      //   ? { ...the B2C payload above, with customerType }
      //   : {
      //       customerType,
      //       ...client,
      //       paymentTerms,
      //       dueDate,
      //       description,
      //       note,
      //       currency: CURRENCY,
      //       items: items.map((item) => ({
      //         description: item.description,
      //         quantity: Number(item.quantity),
      //         rate: Number(item.rate),
      //       })),
      //     };
      const res = await api.post("/api/payments/admin/payment-links", payload);
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

          {/* // B2B: disabled for now, re-enable later. Do not delete.
          <div className="pl-ctype" role="radiogroup" aria-label="Customer type">
            <span className="pl-ctype__label">Customer type</span>
            <div className="pl-seg">
              <label className={isB2c ? "is-on" : ""}>
                <input type="radio" name="customerType" value="b2c" checked={isB2c} onChange={() => setCustomerType("b2c")} />
                <span>Individual (B2C)</span>
              </label>
              <label className={!isB2c ? "is-on" : ""}>
                <input type="radio" name="customerType" value="b2b" checked={!isB2c} onChange={() => setCustomerType("b2b")} />
                <span>Business (B2B)</span>
              </label>
            </div>
          </div>
          */}

          <B2cInvoiceFields
            person={person}
            onPersonChange={(field, value) => setPerson((prev) => ({ ...prev, [field]: value }))}
            serviceState={serviceState}
            currency={CURRENCY}
            totalText={formatMoney(subtotal, CURRENCY)}
          >
            <section className="pl-section">
              <h3 className="pl-section__title">Payment</h3>
              <p className="pl-terms">Due on Receipt: customer link khulte hi pay karega. Invoice pe &quot;Payment due immediately on receipt&quot; chhapega.</p>
            </section>
          </B2cInvoiceFields>

          {/* // B2B: disabled for now, re-enable later. Do not delete.
          [ the else-branch of `isB2c ? (...B2C...) : (...)`: ]
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
          */}

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
            <div><dt>Name</dt><dd>{person.name || "-"}</dd></div>
            <div><dt>Email</dt><dd className="pl-invoice-preview__wrap">{person.email || "-"}</dd></div>
            <div><dt>Services</dt><dd>{itemCount}</dd></div>
            {/* // B2B: disabled for now, re-enable later. Do not delete.
            <div><dt>Bill to</dt><dd>{client.name || "-"}</dd></div>
            <div><dt>Items</dt><dd>{itemCount}</dd></div>
            <div><dt>Due date</dt><dd>{formatDueDate(dueDate)}</dd></div>
            <div><dt>Subtotal</dt><dd>{formatMoney(subtotal, CURRENCY)}</dd></div>
            <div><dt>Tax (0%)</dt><dd>{formatMoney(0, CURRENCY)}</dd></div>
            */}
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
            <table className="pl-table pl-table--recent">
              <thead>
                <tr>
                  <th>Sr No</th>
                  <th>Case Number</th>
                  <th>Name</th>
                  <th>Created</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Note</th>
                  <th>Invoice</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 8).map((link, index) => {
                  const person = personOf(link);
                  const created = splitDateTime(formatDate(link.createdAt));
                  return (
                    <tr key={link._id || link.token}>
                      <td className="pl-recent__sr">{index + 1}</td>
                      <td className="pl-recent__case">{link.invoice?.invoiceNumber || "-"}</td>
                      <td>
                        <div className="pl-recent__name">{person.name}</div>
                        {person.email && <div className="pl-recent__email">{person.email}</div>}
                      </td>
                      <td className="pl-recent__date">
                        <div>{created.date}</div>
                        {created.time && <div className="pl-recent__time">{created.time}</div>}
                      </td>
                      <td className="pl-strong pl-recent__amount">{formatMoney(link.amountPaise, link.currency)}</td>
                      <td><span className={`pl-status pl-status--${link.status}`}>{statusLabel(link.status)}</span></td>
                      <td className="pl-recent__note">{link.note || "-"}</td>
                      <td><RecentInvoiceCell link={link} actions={actions} /></td>
                      <td>
                        <button className="pl-link-btn" type="button" onClick={() => copyHistoryLink(link.url)}>
                          Copy
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
