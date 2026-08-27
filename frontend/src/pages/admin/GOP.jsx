import { useEffect, useRef, useState } from "react";
import api from "../../api";
import { useAdmin } from "../../context/AdminContext";
import "./GOP.css";

// Replace this with the real asset path (or an imported file) later — same
// asset the Manual Invoice page uses.
const LOGO_SRC = "/humancare-logo.png";

const ISSUER = {
  footerAddress: "4 Peddlers Row, 1091 Newark, DE 19702, USA",
  phone: "+1 (302) 303-9993",
  email: "support@humancareconnect.co",
};

const CURRENCY_OPTIONS = [
  { code: "eur", label: "EUR (€)", symbol: "€" },
  { code: "usd", label: "USD ($)", symbol: "$" },
  { code: "gbp", label: "GBP (£)", symbol: "£" },
  { code: "inr", label: "INR (₹)", symbol: "₹" },
];

const CASE_TYPE_OPTIONS = ["House Call Visit", "Teleconsultation", "In-Clinic"];
const DEFAULT_CASE_TYPE = CASE_TYPE_OPTIONS[0];
const DEFAULT_REQUESTED_SERVICE =
  "House call visit by a General Practitioner (GP) doctor to examine the patient at the location indicated above.";

const REQUIRED_DOCS = [
  "Medical report confirming examination of the patient and services rendered.",
  "Copy of any prescription issued to the patient (if applicable).",
];

// Recent GOPs list: how many rows load per page.
const HISTORY_PAGE_SIZE = 8;

function currencySymbol(code) {
  return (
    CURRENCY_OPTIONS.find((option) => option.code === code)?.symbol ||
    String(code || "").toUpperCase()
  );
}

function formatMoney(amountCents, currency = "eur") {
  const code = String(currency || "eur").toUpperCase();
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

// Printed the way the issued PDF prints it: "August 22, 2026".
function formatDocDateLong(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// "03.08.1988" — matches the printed document's DD.MM.YYYY convention.
// Always fed the server's ISO datetime (gop.patientDob), so this reads it
// with UTC getters — same convention as the PDF's own formatDob (see
// backend/utils/gopPdf.js) — rather than the viewer's local timezone,
// which could otherwise roll a UTC-midnight date back a day.
function formatDob(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getUTCFullYear()}`;
}

export default function GOP() {
  const { admin } = useAdmin();

  const [caseType, setCaseType] = useState(DEFAULT_CASE_TYPE);
  const [patientName, setPatientName] = useState("");
  const [patientDob, setPatientDob] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientLocation, setPatientLocation] = useState("");
  const [patientComplaint, setPatientComplaint] = useState("");
  const [requestedService, setRequestedService] = useState(DEFAULT_REQUESTED_SERVICE);
  const [providerName, setProviderName] = useState("");
  const [providerContact, setProviderContact] = useState("");
  const [providerAddress, setProviderAddress] = useState("");
  const [providerEmail, setProviderEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("eur");
  // Prefilled from the logged-in admin's own name, but freely editable —
  // the person authorizing a case isn't always the one at the keyboard.
  const [authorizedByName, setAuthorizedByName] = useState(admin?.name || "");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  // Sitewide total for the toolbar metric — fetched independently of
  // `historyTotal` above, which reflects whatever search is currently
  // active and would otherwise make the metric fluctuate while typing.
  const [totalGenerated, setTotalGenerated] = useState(0);

  const [downloadingId, setDownloadingId] = useState("");
  const [resendingId, setResendingId] = useState("");
  const [resendError, setResendError] = useState("");

  const fetchHistory = (overrides = {}) => {
    const page = overrides.page ?? historyPage;
    const q = overrides.q ?? searchInput;

    setHistoryLoading(true);
    const params = { page, limit: HISTORY_PAGE_SIZE };
    if (q.trim()) params.q = q.trim();

    api
      .get("/api/admin/gop", { params })
      .then((res) => {
        setHistory(res.data.gops || []);
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

  const goToHistoryPage = (page) => {
    const target = Math.min(Math.max(1, page), historyTotalPages);
    if (target === historyPage || historyLoading) return;
    fetchHistory({ page: target });
  };

  const fetchTotalGenerated = () => {
    api
      .get("/api/admin/gop", { params: { limit: 1 } })
      .then((res) => setTotalGenerated(res.data.total || 0))
      .catch(() => {});
  };

  const isFirstHistoryFetch = useRef(true);

  // Immediate fetch on mount, then debounced re-fetch (back to page 1)
  // whenever the search text changes — same pattern as Manual Invoices.
  useEffect(() => {
    if (isFirstHistoryFetch.current) {
      isFirstHistoryFetch.current = false;
      fetchHistory({ page: 1 });
      fetchTotalGenerated();
      return undefined;
    }
    const timer = setTimeout(() => {
      fetchHistory({ page: 1 });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const amountCentsPreview = (() => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.round(value * 100);
  })();

  const canSubmit =
    !submitting &&
    patientName.trim() !== "" &&
    providerName.trim() !== "" &&
    providerEmail.trim() !== "" &&
    authorizedByName.trim() !== "" &&
    amountCentsPreview > 0;

  const resetForm = () => {
    setCaseType(DEFAULT_CASE_TYPE);
    setPatientName("");
    setPatientDob("");
    setPatientPhone("");
    setPatientLocation("");
    setPatientComplaint("");
    setRequestedService(DEFAULT_REQUESTED_SERVICE);
    setProviderName("");
    setProviderContact("");
    setProviderAddress("");
    setProviderEmail("");
    setAmount("");
    setCurrency("eur");
    setAuthorizedByName(admin?.name || "");
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setCreated(null);
    setSubmitting(true);
    try {
      const res = await api.post("/api/admin/gop", {
        caseType,
        patientName,
        patientDob,
        patientPhone,
        patientLocation,
        patientComplaint,
        requestedService,
        providerName,
        providerContact,
        providerAddress,
        providerEmail,
        amount,
        currency,
        authorizedByName,
      });
      setCreated(res.data.gop);
      resetForm();
      // Back to page 1 so the just-created GOP (newest first) is visible.
      fetchHistory({ page: 1 });
      fetchTotalGenerated();
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to generate the Guarantee of Payment.");
    } finally {
      setSubmitting(false);
    }
  };

  const download = async (id) => {
    setDownloadingId(id);
    try {
      const res = await api.get(`/api/admin/gop/${id}/download`);
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

  const resendEmail = async (id) => {
    setResendingId(id);
    setResendError("");
    try {
      await api.post(`/api/admin/gop/${id}/resend-email`);
      fetchHistory();
    } catch (err) {
      setResendError(err.response?.data?.msg || "Failed to resend the email.");
    } finally {
      setResendingId("");
    }
  };

  const issueDateLabel = formatDocDateLong(Date.now());
  const amountDisplayPreview = formatMoney(amountCentsPreview, currency);
  const providerNamePreview = providerName.trim() || "the provider";

  return (
    <div className="gop-page">
      <div className="gop-toolbar">
        <p className="gop-eyebrow">Cases · Guarantee of Payment</p>
        <div className="gop-metrics">
          <div className="gop-metric">
            <span>Total Generated</span>
            <strong className="gop-metric__value">{totalGenerated}</strong>
          </div>
        </div>
      </div>

      {/* The form *is* the document — logo, navy title, meta table, numbered
          sections, and signature block, matching backend/utils/gopPdf.js. */}
      <form onSubmit={submit} className="gop-doc">
        <header className="gop-doc__masthead">
          <img
            className="gop-doc__logo"
            src={LOGO_SRC}
            alt="Humancare Connect"
            onError={(event) => {
              event.currentTarget.style.visibility = "hidden";
            }}
          />
          <h1 className="gop-doc__title">CASE INITIATION &amp; PAYMENT AUTHORIZATION</h1>
          <p className="gop-doc__subtitle">
            <select
              className="gop-input gop-select gop-input--inline"
              value={caseType}
              onChange={(event) => setCaseType(event.target.value)}
              aria-label="Case type"
            >
              {CASE_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <span> — Authorization to Proceed</span>
          </p>
        </header>

        <div className="gop-doc__rule" aria-hidden="true" />

        <table className="gop-table">
          <tbody>
            <tr>
              <th>Date Issued</th>
              <td className="gop-cell-printed">{issueDateLabel}</td>
            </tr>
            <tr>
              <th>Case Type</th>
              <td className="gop-cell-printed">{caseType || DEFAULT_CASE_TYPE}</td>
            </tr>
            <tr>
              <th>Status</th>
              <td className="gop-cell-printed">
                <span className="gop-status">AUTHORIZED</span>
              </td>
            </tr>
          </tbody>
        </table>

        <section className="gop-doc__section">
          <p className="gop-doc__caption">1. Patient Information</p>
          <table className="gop-table">
            <tbody>
              <tr>
                <th>Name</th>
                <td>
                  <input
                    type="text"
                    className="gop-input"
                    maxLength={120}
                    value={patientName}
                    onChange={(event) => setPatientName(event.target.value)}
                    placeholder="Full name"
                    required
                  />
                </td>
              </tr>
              <tr>
                <th>Date of Birth</th>
                <td>
                  <input
                    type="date"
                    className="gop-input"
                    value={patientDob}
                    onChange={(event) => setPatientDob(event.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <th>Telephone</th>
                <td>
                  <input
                    type="tel"
                    className="gop-input"
                    maxLength={40}
                    value={patientPhone}
                    onChange={(event) => setPatientPhone(event.target.value)}
                    placeholder="+1 555 000 0000"
                  />
                </td>
              </tr>
              <tr>
                <th>Patient Location</th>
                <td>
                  <input
                    type="text"
                    className="gop-input"
                    maxLength={200}
                    value={patientLocation}
                    onChange={(event) => setPatientLocation(event.target.value)}
                    placeholder="Hotel, address, or resort name"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="gop-doc__section">
          <p className="gop-doc__caption">2. Patient Complaint</p>
          <textarea
            className="gop-input gop-textarea"
            rows={2}
            maxLength={1000}
            value={patientComplaint}
            onChange={(event) => setPatientComplaint(event.target.value)}
            placeholder="Describe the patient's complaint / reason for the visit."
          />
        </section>

        <section className="gop-doc__section">
          <p className="gop-doc__caption">3. Requested Service</p>
          <textarea
            className="gop-input gop-textarea"
            rows={2}
            maxLength={1000}
            value={requestedService}
            onChange={(event) => setRequestedService(event.target.value)}
            placeholder={DEFAULT_REQUESTED_SERVICE}
          />
        </section>

        <section className="gop-doc__section">
          <p className="gop-doc__caption">4. Service Provider</p>
          <table className="gop-table">
            <tbody>
              <tr>
                <th>Provider</th>
                <td>
                  <input
                    type="text"
                    className="gop-input"
                    maxLength={120}
                    value={providerName}
                    onChange={(event) => setProviderName(event.target.value)}
                    placeholder="Doctor / clinic name"
                    required
                  />
                </td>
              </tr>
              <tr>
                <th>Contact</th>
                <td>
                  <input
                    type="tel"
                    className="gop-input"
                    maxLength={60}
                    value={providerContact}
                    onChange={(event) => setProviderContact(event.target.value)}
                    placeholder="+1 555 000 0000"
                  />
                </td>
              </tr>
              <tr>
                <th>Clinic Address</th>
                <td>
                  <input
                    type="text"
                    className="gop-input"
                    maxLength={200}
                    value={providerAddress}
                    onChange={(event) => setProviderAddress(event.target.value)}
                    placeholder="Clinic street address"
                  />
                </td>
              </tr>
              <tr>
                <th>Email</th>
                <td>
                  <input
                    type="email"
                    className="gop-input"
                    maxLength={254}
                    value={providerEmail}
                    onChange={(event) => setProviderEmail(event.target.value)}
                    placeholder="provider@example.com"
                    required
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="gop-doc__section">
          <p className="gop-doc__caption">5. Payment Authorization</p>

          <div className="gop-amount-row">
            <span className="gop-amount-row__label">
              Agreed Payment for {caseType || DEFAULT_CASE_TYPE}:
            </span>
            <div className="gop-amount">
              <span className="gop-amount__prefix">{currencySymbol(currency)}</span>
              <input
                type="number"
                className="gop-input gop-input--flush gop-amount__input"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <select
              className="gop-input gop-select gop-amount__currency"
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

          <p className="gop-doc__terms">
            Humancare Connect, Inc. is authorized to pay {providerNamePreview} only for the
            service described above, at the agreed amount of {amountDisplayPreview}. No
            additional or extra payment is authorized without prior written pre-approval
            from Humancare Connect, Inc.
          </p>
          <p className="gop-doc__terms">
            Payment of {amountDisplayPreview} will be made to {providerNamePreview}{" "}
            immediately upon completion of the service, via payment link, once the
            required documentation described below has been received.
          </p>
        </section>

        <section className="gop-doc__section">
          <p className="gop-doc__caption">6. Required Documentation for Payment Release</p>
          <ol className="gop-doclist">
            {REQUIRED_DOCS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>

        <section className="gop-doc__section">
          <p className="gop-doc__caption">7. Issuer</p>
          <p className="gop-doc__issuer-label">Authorized by:</p>
          <input
            type="text"
            className="gop-input gop-doc__issuer-input"
            maxLength={120}
            value={authorizedByName}
            onChange={(event) => setAuthorizedByName(event.target.value)}
            placeholder="Full name"
            required
          />
          <p className="gop-doc__issuer-company">Humancare Connect, Inc.</p>
        </section>

        {error && (
          <div className="gop-alert" role="alert">
            {error}
          </div>
        )}

        <div className="gop-doc__actions">
          <small className="gop-hint">
            The GOP is emailed to the service provider as soon as it is generated.
          </small>
          <button className="gop-btn gop-btn--primary" type="submit" disabled={!canSubmit}>
            {submitting && <span className="gop-spinner" aria-hidden="true" />}
            {submitting ? "Generating…" : "Generate & Send GOP"}
          </button>
        </div>

        <footer className="gop-doc__foot">
          Humancare Connect &nbsp;|&nbsp; 24/7 Support: {ISSUER.email}{" "}
          &nbsp;|&nbsp; {ISSUER.footerAddress} &nbsp;|&nbsp; {ISSUER.phone}
        </footer>
      </form>

      {created && (
        <div className="gop-banner" role="status">
          <span className="gop-banner__icon" aria-hidden="true">
            ✓
          </span>
          <div className="gop-banner__body">
            <strong className="gop-banner__title">GOP {created.gopNumber} created</strong>
            <span className="gop-banner__meta">
              {formatMoney(created.amountCents, created.currency)} ·{" "}
              {created.emailed ? (
                "emailed to the provider"
              ) : (
                <em className="gop-banner__warn">
                  email failed — retry from the history below
                </em>
              )}
            </span>
          </div>
          <div className="gop-banner__actions">
            {created._id && (
              <button
                className="gop-btn gop-btn--ghost gop-btn--sm"
                type="button"
                disabled={downloadingId === created._id}
                onClick={() => download(created._id)}
              >
                {downloadingId === created._id ? "Preparing…" : "Download PDF"}
              </button>
            )}
            <button
              className="gop-icon-btn"
              type="button"
              onClick={() => setCreated(null)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <section className="gop-card">
        <div className="gop-card__head">
          <div className="gop-card__title">
            <p className="gop-eyebrow">History</p>
            <h2>Recent GOPs</h2>
          </div>
          <button
            className="gop-btn gop-btn--ghost gop-btn--sm"
            type="button"
            onClick={() => fetchHistory()}
            disabled={historyLoading}
          >
            {historyLoading && (
              <span className="gop-spinner gop-spinner--dark" aria-hidden="true" />
            )}
            {historyLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div className="gop-history-controls">
          <label className="gop-search" htmlFor="gop-history-search">
            <svg
              className="gop-search__icon"
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
              id="gop-history-search"
              type="search"
              className="gop-search__input"
              placeholder="Search by patient, provider, email, or GOP #"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </label>
        </div>

        {resendError && (
          <div className="gop-alert" role="alert">
            {resendError}
          </div>
        )}

        {historyLoading ? (
          <div className="gop-skeleton" aria-busy="true" aria-label="Loading GOPs">
            {[0, 1, 2, 3].map((row) => (
              <div className="gop-skeleton__row" key={row}>
                <span className="gop-skeleton__bar" style={{ width: "16%" }} />
                <span className="gop-skeleton__bar" style={{ width: "14%" }} />
                <span className="gop-skeleton__bar" style={{ width: "22%" }} />
                <span className="gop-skeleton__bar" style={{ width: "20%" }} />
                <span className="gop-skeleton__bar" style={{ width: "10%" }} />
              </div>
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="gop-empty">
            <div className="gop-empty__icon" aria-hidden="true">
              🛡️
            </div>
            {searchInput.trim() ? (
              <>
                <strong>No GOPs match your search</strong>
                <span>Try a different patient, provider, email, or GOP number.</span>
              </>
            ) : (
              <>
                <strong>No GOPs generated yet</strong>
                <span>GOPs you generate above will appear here, newest first.</span>
              </>
            )}
          </div>
        ) : (
          <div className="gop-table-wrap">
            <table className="gop-history-table">
              <thead>
                <tr>
                  <th>Created</th>
                  <th>GOP #</th>
                  <th>Patient</th>
                  <th>Provider</th>
                  <th className="gop-col-amount">Amount</th>
                  <th className="gop-col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map((gop) => (
                  <tr key={gop._id}>
                    <td data-label="Created" className="gop-cell-muted">
                      {formatDate(gop.createdAt)}
                    </td>
                    <td data-label="GOP #" className="gop-cell-number">
                      {gop.gopNumber}
                    </td>
                    <td data-label="Patient">
                      <div className="gop-person">
                        <strong>{gop.patientName}</strong>
                        {gop.patientDob && <span>DOB {formatDob(gop.patientDob)}</span>}
                      </div>
                    </td>
                    <td data-label="Provider">
                      <div className="gop-person">
                        <strong>{gop.providerName}</strong>
                        <span title={gop.providerEmail}>{gop.providerEmail}</span>
                      </div>
                    </td>
                    <td data-label="Amount" className="gop-col-amount gop-cell-amount">
                      {formatMoney(gop.amountCents, gop.currency)}
                    </td>
                    <td data-label="Actions" className="gop-col-actions">
                      <div className="gop-actions">
                        <button
                          className="gop-btn gop-btn--link"
                          type="button"
                          disabled={downloadingId === gop._id}
                          onClick={() => download(gop._id)}
                        >
                          {downloadingId === gop._id && (
                            <span className="gop-spinner" aria-hidden="true" />
                          )}
                          Download
                        </button>
                        {!gop.emailed && (
                          <button
                            className="gop-btn gop-btn--link gop-btn--accent"
                            type="button"
                            disabled={resendingId === gop._id}
                            onClick={() => resendEmail(gop._id)}
                          >
                            {resendingId === gop._id && (
                              <span className="gop-spinner" aria-hidden="true" />
                            )}
                            Resend Email
                          </button>
                        )}
                      </div>
                      {!gop.emailed && (
                        <span
                          className="gop-email-flag"
                          title={gop.emailError || "Email not yet sent"}
                        >
                          ⚠ not emailed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!historyLoading && history.length > 0 && (
          <div className="gop-pagination">
            <span className="gop-pagination__info">
              Page {historyPage} of {historyTotalPages} · {historyTotal}{" "}
              GOP{historyTotal === 1 ? "" : "s"}
            </span>
            <div className="gop-pagination__controls">
              <button
                type="button"
                className="gop-btn gop-btn--ghost gop-btn--sm"
                onClick={() => goToHistoryPage(historyPage - 1)}
                disabled={historyPage <= 1}
              >
                ← Previous
              </button>
              <button
                type="button"
                className="gop-btn gop-btn--ghost gop-btn--sm"
                onClick={() => goToHistoryPage(historyPage + 1)}
                disabled={historyPage >= historyTotalPages}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
