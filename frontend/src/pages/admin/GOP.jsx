import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ChevronDown, EllipsisVertical, FileText } from "lucide-react";
import api from "../../api";
import { useAdmin } from "../../context/AdminContext";
import "./GOP.css";
import { useToast } from "../../components/ui/Toast";
import { useConfirm } from "../../components/ui/ConfirmDialog";

// Replace this with the real asset path (or an imported file) later — same
// asset the Manual Invoice page uses.
const LOGO_SRC = "/humancare-logo.png";

const ISSUER = {
  footerAddress: "4 Peddlers Row, 1091 Newark, DE 19702, USA",
  phone: "+1 (302) 303-9993",
  email: "support@humancareconnect.co",
};

const CURRENCY_OPTIONS = [
  { code: "usd", label: "USD ($)", symbol: "$" },
  { code: "eur", label: "EUR (€)", symbol: "€" },
  { code: "gbp", label: "GBP (£)", symbol: "£" },
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

function formatMoney(amountCents, currency = "usd") {
  const code = String(currency || "usd").toUpperCase();
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

// Layout tier of the page, measured from the page's own width rather than the
// viewport: the admin shell reserves 252–288px for its sidebar on desktop, so
// the viewport alone says little about how much room this page really has.
//   wide   ≥ 960px   two column stacks, every section open
//   mid    ≥ 700px   and the desktop sidebar is showing (769px+ viewport):
//                    sections 1 and 4 side by side, sections 2 and 3 collapsible
//   narrow < 700px   single column, every section collapsible
//   xs     < 520px   narrow, with the label/value tables stacked
function useGopLayout(ref) {
  const [layout, setLayout] = useState("wide");

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const desktopShell = window.matchMedia("(min-width: 769px)");
    const measure = () => {
      const width = el.getBoundingClientRect().width;
      let next = "narrow";
      if (width >= 960) next = "wide";
      else if (width >= 700 && desktopShell.matches) next = "mid";
      else if (width < 520) next = "xs";
      setLayout((prev) => (prev === next ? prev : next));
    };
    measure();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    desktopShell.addEventListener("change", measure);
    return () => {
      observer?.disconnect();
      desktopShell.removeEventListener("change", measure);
    };
  }, [ref]);

  return layout;
}

// One numbered section of the form. When `collapsible` it is an accordion
// (button header with aria-expanded/aria-controls); otherwise a plain caption.
// The body stays mounted when collapsed (`hidden`), so values and validity
// state are never lost.
function GopSection({ n, title, collapsible, open, onToggle, children }) {
  const bodyId = `gop-section-${n}-body`;
  const expanded = !collapsible || open;
  return (
    <section
      className={`gop-doc__section${collapsible ? " gop-sec--acc" : ""}${expanded ? " is-open" : ""}`}
      data-gop-section={n}
    >
      {collapsible ? (
        <h2 className="gop-acc__heading">
          <button
            type="button"
            className="gop-acc__btn"
            aria-expanded={expanded}
            aria-controls={bodyId}
            onClick={() => onToggle(n)}
          >
            <span>
              {n}. {title}
            </span>
            <ChevronDown className="gop-acc__chevron" size={18} aria-hidden="true" />
          </button>
        </h2>
      ) : (
        <p className="gop-doc__caption">
          {n}. {title}
        </p>
      )}
      <div id={bodyId} className="gop-sec__body" hidden={!expanded}>
        {children}
      </div>
    </section>
  );
}

function EmailFlag({ gop, showReason }) {
  if (gop.emailed) {
    return (
      <span className="gop-email-flag gop-email-flag--sent" title={`Emailed to ${gop.providerEmail}`}>
        ✓ emailed {formatDate(gop.emailedAt)}
      </span>
    );
  }
  if (gop.emailError) {
    return (
      <span className="gop-email-flag" title={gop.emailError}>
        ⚠ email failed
        {showReason && <span className="gop-email-flag__reason">{gop.emailError}</span>}
      </span>
    );
  }
  return (
    <span className="gop-email-flag gop-email-flag--muted" title="Not emailed to the provider yet">
      not emailed
    </span>
  );
}

// ⋮ menu for a history card: Download and Send/Resend. Closes on outside
// press, Escape, Tab and after a choice; arrow keys move between items.
function RowMenu({ gop, open, setOpenId, onDownload, onSend, downloading, sendBusy }) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = `gop-menu-${gop._id}`;

  useEffect(() => {
    if (!open) return undefined;
    menuRef.current?.querySelector('[role="menuitem"]:not(:disabled)')?.focus();
    const onPointerDown = (event) => {
      if (menuRef.current?.contains(event.target) || triggerRef.current?.contains(event.target)) return;
      setOpenId("");
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, setOpenId]);

  const close = (restoreFocus) => {
    setOpenId("");
    if (restoreFocus) triggerRef.current?.focus();
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab") {
      setOpenId("");
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const items = Array.from(menuRef.current?.querySelectorAll('[role="menuitem"]:not(:disabled)') || []);
      if (!items.length) return;
      const index = items.indexOf(document.activeElement);
      const step = event.key === "ArrowDown" ? 1 : -1;
      items[(index + step + items.length) % items.length].focus();
    }
  };

  return (
    <div className="gop-menu-wrap">
      <button
        ref={triggerRef}
        type="button"
        className="gop-menu-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Actions for GOP ${gop.gopNumber}`}
        onClick={() => setOpenId(open ? "" : gop._id)}
      >
        <EllipsisVertical size={20} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={menuId}
          ref={menuRef}
          className="gop-menu"
          role="menu"
          aria-label={`GOP ${gop.gopNumber} actions`}
          onKeyDown={onKeyDown}
        >
          <button
            type="button"
            role="menuitem"
            className="gop-menu__item"
            disabled={downloading}
            onClick={() => {
              close(true);
              onDownload(gop._id);
            }}
          >
            {downloading ? "Preparing…" : "Download"}
          </button>
          <button
            type="button"
            role="menuitem"
            className="gop-menu__item"
            disabled={sendBusy}
            onClick={() => {
              close(true);
              onSend(gop);
            }}
          >
            {gop.emailed ? "Resend" : "Send Email"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function GOP() {
  const toast = useToast();
  const confirm = useConfirm();
  const { admin } = useAdmin();

  const pageRef = useRef(null);
  const layout = useGopLayout(pageRef);
  // Accordion state, keyed by section number. Patient Information starts open.
  const [openSections, setOpenSections] = useState({ 1: true });
  // History card ⋮ menu: the _id of the GOP whose menu is open.
  const [menuOpenId, setMenuOpenId] = useState("");

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
  const [currency, setCurrency] = useState("usd");
  // Prefilled from the logged-in admin's own name, but freely editable —
  // the person authorizing a case isn't always the one at the keyboard.
  const [authorizedByName, setAuthorizedByName] = useState(admin?.name || "");

  const [submitting, setSubmitting] = useState(false);
  // Synchronous guard: `submitting` state only updates on the next render, so
  // a fast double-click could otherwise fire two requests (two GOP numbers).
  const submitLock = useRef(false);
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
    setCurrency("usd");
    setAuthorizedByName(admin?.name || "");
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
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
      submitLock.current = false;
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
      toast.error(
        err.response?.data?.msg || "Failed to generate download link.",
      );
    } finally {
      setDownloadingId("");
    }
  };

  // Emails the stored GOP PDF as-is — no new GOP, no PDF regeneration. GOPs
  // are never emailed automatically at generation, so this is both the first
  // send and any later resend. Asks for confirmation first because an email
  // to an external provider can't be recalled. Returns true on success.
  const sendEmail = async (gop) => {
    if (resendingId) return false;
    setResendError("");

    if (!String(gop.providerEmail || "").trim()) {
      setResendError(
        `GOP ${gop.gopNumber} has no provider email address, so it cannot be sent.`,
      );
      return false;
    }

    const ok = await confirm({
      title: gop.emailed ? "Resend GOP email?" : "Send GOP email?",
      message: `GOP ${gop.gopNumber} will be emailed to ${gop.providerEmail}.`,
      confirmText: gop.emailed ? "Resend Email" : "Send Email",
    });
    if (!ok) return false;

    setResendingId(gop._id);
    try {
      await api.post(`/api/admin/gop/${gop._id}/resend-email`);
      toast.success(`GOP ${gop.gopNumber} emailed to ${gop.providerEmail}.`);
      fetchHistory();
      return true;
    } catch (err) {
      setResendError(err.response?.data?.msg || "Failed to send the email.");
      return false;
    } finally {
      setResendingId("");
    }
  };

  const issueDateLabel = formatDocDateLong(Date.now());
  const amountDisplayPreview = formatMoney(amountCentsPreview, currency);
  const providerNamePreview = providerName.trim() || "the provider";

  const isCompact = layout === "narrow" || layout === "xs";
  const collapsibleFor = (n) =>
    isCompact ? true : layout === "mid" ? n === 2 || n === 3 : false;
  const toggleSection = (n) => setOpenSections((prev) => ({ ...prev, [n]: !prev[n] }));
  const sectionProps = (n, title) => ({
    n,
    title,
    collapsible: collapsibleFor(n),
    open: Boolean(openSections[n]),
    onToggle: toggleSection,
  });

  // Browser validation can't focus a field inside a collapsed section, so
  // open the section holding the first invalid field before the browser runs
  // its own check (this click handler runs before the form's submit
  // validation). The field is then visible and gets the native focus/message.
  const revealFirstInvalidSection = (event) => {
    const invalid = event.currentTarget.form?.querySelector(":invalid");
    const sectionEl = invalid?.closest("[data-gop-section]");
    if (!sectionEl) return;
    const n = Number(sectionEl.dataset.gopSection);
    if (collapsibleFor(n) && !openSections[n]) {
      flushSync(() => setOpenSections((prev) => ({ ...prev, [n]: true })));
    }
  };

  return (
    <div
      ref={pageRef}
      className={`gop-page gop-page--${layout}${isCompact ? " gop-page--compact" : ""}`}
    >
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
          <img decoding="async"
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

        <div className="gop-doc__cols">
          <div className="gop-doc__col gop-doc__col--a">
            <GopSection {...sectionProps(1, "Patient Information")}>
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
                        aria-label="Patient name"
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
                        aria-label="Patient date of birth"
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
                        aria-label="Patient telephone"
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
                        aria-label="Patient location"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </GopSection>

            <GopSection {...sectionProps(2, "Patient Complaint")}>
              <textarea
                className="gop-input gop-textarea"
                rows={2}
                maxLength={1000}
                value={patientComplaint}
                onChange={(event) => setPatientComplaint(event.target.value)}
                placeholder="Describe the patient's complaint / reason for the visit."
                aria-label="Patient complaint"
              />
            </GopSection>

            <GopSection {...sectionProps(3, "Requested Service")}>
              <textarea
                className="gop-input gop-textarea"
                rows={2}
                maxLength={1000}
                value={requestedService}
                onChange={(event) => setRequestedService(event.target.value)}
                placeholder={DEFAULT_REQUESTED_SERVICE}
                aria-label="Requested service"
              />
            </GopSection>
          </div>

          <div className="gop-doc__col gop-doc__col--b">
            <GopSection {...sectionProps(4, "Service Provider")}>
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
                        aria-label="Provider name"
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
                        aria-label="Provider contact"
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
                        aria-label="Clinic address"
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
                        aria-label="Provider email"
                        required
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </GopSection>

            <GopSection {...sectionProps(5, "Payment Authorization")}>
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
                    aria-label="Agreed payment amount"
                    required
                  />
                </div>
                <select
                  className="gop-input gop-select gop-amount__currency"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  aria-label="Currency"
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
            </GopSection>

            <GopSection {...sectionProps(6, "Required Documentation for Payment Release")}>
              <ol className="gop-doclist">
                {REQUIRED_DOCS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </GopSection>
          </div>
        </div>

        <div className="gop-doc__bottom">
          <GopSection {...sectionProps(7, "Issuer")}>
            <p className="gop-doc__issuer-label">Authorized by:</p>
            <input
              type="text"
              className="gop-input gop-doc__issuer-input"
              maxLength={120}
              value={authorizedByName}
              onChange={(event) => setAuthorizedByName(event.target.value)}
              placeholder="Full name"
              aria-label="Authorized by"
              required
            />
            <p className="gop-doc__issuer-company">Humancare Connect, Inc.</p>
          </GopSection>

          <div className="gop-doc__actions">
            {error && (
              <div className="gop-alert" role="alert">
                {error}
              </div>
            )}
            <small className="gop-hint">
              The GOP is generated only — it is not emailed automatically. Use
              “Send Email” on the generated GOP to email it to the provider.
            </small>
            <button
              className="gop-btn gop-btn--generate"
              type="submit"
              disabled={!canSubmit}
              aria-busy={submitting}
              onClick={revealFirstInvalidSection}
            >
              {submitting ? (
                <span className="gop-spinner" aria-hidden="true" />
              ) : (
                <FileText size={16} aria-hidden="true" />
              )}
              {submitting ? "Generating…" : "Generate GOP"}
            </button>
          </div>
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
              {created.emailed
                ? "emailed to the provider"
                : "not emailed — send it when you're ready"}
            </span>
          </div>
          <div className="gop-banner__actions">
            {created._id && (
              <button
                className="gop-btn gop-btn--ghost gop-btn--sm gop-btn--accent"
                type="button"
                disabled={Boolean(resendingId)}
                onClick={async () => {
                  const ok = await sendEmail(created);
                  if (ok)
                    setCreated((prev) =>
                      prev && prev._id === created._id
                        ? { ...prev, emailed: true }
                        : prev,
                    );
                }}
              >
                {resendingId === created._id && (
                  <span className="gop-spinner gop-spinner--dark" aria-hidden="true" />
                )}
                {resendingId === created._id
                  ? "Sending…"
                  : created.emailed
                    ? "Resend Email"
                    : "Send Email"}
              </button>
            )}
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
              aria-label="Search GOPs"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </label>
          <button
            className="gop-btn gop-btn--outline gop-btn--sm gop-card__refresh"
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
                      {isCompact ? (
                        <div className="gop-card-actions">
                          <div className="gop-card-actions__status">
                            <EmailFlag gop={gop} showReason />
                          </div>
                          <RowMenu
                            gop={gop}
                            open={menuOpenId === gop._id}
                            setOpenId={setMenuOpenId}
                            onDownload={download}
                            onSend={sendEmail}
                            downloading={downloadingId === gop._id}
                            sendBusy={Boolean(resendingId)}
                          />
                        </div>
                      ) : (
                        <>
                          <div className="gop-actions">
                            <button
                              className="gop-btn gop-btn--link gop-btn--accent"
                              type="button"
                              disabled={downloadingId === gop._id}
                              onClick={() => download(gop._id)}
                            >
                              {downloadingId === gop._id && (
                                <span className="gop-spinner" aria-hidden="true" />
                              )}
                              Download
                            </button>
                            <button
                              className="gop-btn gop-btn--link gop-btn--accent"
                              type="button"
                              disabled={Boolean(resendingId)}
                              onClick={() => sendEmail(gop)}
                            >
                              {resendingId === gop._id && (
                                <span className="gop-spinner" aria-hidden="true" />
                              )}
                              {gop.emailed ? "Resend" : "Send Email"}
                            </button>
                          </div>
                          <EmailFlag gop={gop} />
                        </>
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
