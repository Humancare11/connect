import { useLocation, Link } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import "./Appointment.css";
import api from "../api";
import { notifyUserActivityUpdated } from "../utils/activityEvents";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || "";

const ELEMENTS_APPEARANCE = {
  theme: "stripe",
  variables: {
    colorPrimary: "#0c8b7a",
    colorBackground: "#ffffff",
    colorText: "#0f172a",
    colorDanger: "#dc2626",
    fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
    borderRadius: "10px",
    fontSizeBase: "15px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": { border: "1.5px solid #e2e8f0", boxShadow: "none", backgroundColor: "#f8fafc" },
    ".Input:focus": { border: "1.5px solid #0c8b7a", boxShadow: "0 0 0 3px rgba(12,139,122,.12)", backgroundColor: "#fff" },
    ".Label": { color: "#334155", fontWeight: "600", fontSize: "13px" },
    ".Tab": { border: "1.5px solid #e2e8f0", borderRadius: "10px" },
    ".Tab:hover": { border: "1.5px solid #0c8b7a" },
    ".Tab--selected": { border: "1.5px solid #0c8b7a", backgroundColor: "#f0fdf4" },
  },
};

/* ─── Helpers ─────────────────────────────────────────────── */

const ALL_SLOTS = [];
for (let h = 8; h < 20; h++) {
  ALL_SLOTS.push(`${String(h).padStart(2, "0")}:00`);
  ALL_SLOTS.push(`${String(h).padStart(2, "0")}:30`);
}

function formatSlot(time) {
  if (!time) return "—";
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function formatINR(paise) {
  return (paise / 100).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
}

const FILE_ICONS = { pdf: "📄", image: "🖼️", doc: "📝", default: "📎" };
function fileIcon(type = "") {
  if (type.includes("pdf")) return FILE_ICONS.pdf;
  if (type.startsWith("image/")) return FILE_ICONS.image;
  if (type.includes("word") || type.includes("doc")) return FILE_ICONS.doc;
  return FILE_ICONS.default;
}
function formatBytes(b) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

/* ─── Stripe payment form (must be inside <Elements>) ─────── */
function StripeForm({ clientSecret, amount, doctor, form, reports, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");
  const [ready, setReady] = useState(false);

  const handlePay = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setPaying(true);
    setPayError("");

    /* Save booking data so we can recover it after 3DS redirect */
    sessionStorage.setItem("ap_booking_pending", JSON.stringify({ doctor, form, reports, amount }));

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/book-appointment` },
      redirect: "if_required",
    });

    if (error) {
      sessionStorage.removeItem("ap_booking_pending");
      setPayError(error.message);
      setPaying(false);
    } else {
      const piId = clientSecret.match(/^(pi_\w+)_secret_/)?.[1];
      if (piId) onSuccess(piId);
    }
  };

  return (
    <form onSubmit={handlePay} className="ap-pay-form">
      <div className="ap-pay-element-wrap">
        <PaymentElement onReady={() => setReady(true)} options={{ layout: "tabs", paymentMethodOrder: ["card"] }} />
      </div>
      <div className="ap-pay-notice" style={{ fontSize: "12px", padding: "12px", background: "#f0fdf4", border: "1px solid #d1fae5", borderRadius: "8px", color: "#065f46", marginTop: "12px" }}>
        <strong>Test Mode:</strong> Use card number <code style={{ background: "#fff", padding: "2px 4px", borderRadius: "4px" }}>4242 4242 4242 4242</code> with any future date and any CVC.
      </div>

      {!ready && (
        <div className="ap-pay-element-loading">
          <span className="ap-spinner" /> Loading payment options…
        </div>
      )}

      {payError && <p className="ap-error">{payError}</p>}

      <div className="ap-pay-security">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Payments are secured and encrypted by Stripe
      </div>

      <button className="ap-submit" type="submit" disabled={!stripe || !ready || paying}>
        {paying
          ? <><span className="ap-spinner ap-spinner--white" /> Processing payment…</>
          : `Pay ${formatINR(amount)} →`}
      </button>
    </form>
  );
}

/* ─── Payment stage ───────────────────────────────────────── */
function PaymentStage({ amount, doctor, form, reports, onBack, onComplete }) {
  const [method, setMethod] = useState(null); // null | "stripe" | "paypal"
  const [clientSecret, setClientSecret] = useState("");
  const [stripeCreating, setStripeCreating] = useState(false);
  const [stripeError, setStripeError] = useState("");
  const [paypalLoading, setPaypalLoading] = useState(false);
  const [paypalError, setPaypalError] = useState("");

  const selectStripe = async () => {
    setStripeError("");
    if (clientSecret) { setMethod("stripe"); return; }
    setStripeCreating(true);
    try {
      const doctorId = doctor.doctorId || doctor.id;
      const res = await api.post("/api/payments/create-intent", { doctorId });
      setClientSecret(res.data.clientSecret);
      setMethod("stripe");
    } catch (err) {
      setStripeError(err.response?.data?.msg || "Failed to initialize payment. Please try again.");
    } finally {
      setStripeCreating(false);
    }
  };

  const createPaypalOrder = async () => {
    const doctorId = doctor.doctorId || doctor.id;
    const res = await api.post("/api/paypal/create-order", { doctorId });
    return res.data.orderId;
  };

  const onPaypalApprove = async (data) => {
    setPaypalLoading(true);
    setPaypalError("");
    try {
      const res = await api.post("/api/paypal/capture-order", { orderId: data.orderID });
      if (res.data.status === "COMPLETED") {
        onComplete(res.data.orderId, "paypal", res.data.amountPaise);
      }
    } catch (err) {
      setPaypalError(err.response?.data?.msg || "PayPal payment failed. Please try again.");
    } finally {
      setPaypalLoading(false);
    }
  };

  return (
    <PayPalScriptProvider options={{ "client-id": PAYPAL_CLIENT_ID, currency: "INR", intent: "capture" }}>
      <div className="ap-pay-root">
        <button className="ap-pay-back" type="button" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to details
        </button>

        {/* Appointment summary */}
        <div className="ap-pay-summary">
          <div className="ap-pay-summary-title">Appointment Summary</div>
          <div className="ap-pay-summary-row"><span>Doctor</span><strong>{doctor.name}</strong></div>
          <div className="ap-pay-summary-row"><span>Speciality</span><strong>{doctor.specialty || "General"}</strong></div>
          <div className="ap-pay-summary-row"><span>Date</span><strong>{formatDisplayDate(form.date)}</strong></div>
          <div className="ap-pay-summary-row"><span>Time</span><strong>{formatSlot(form.time)}</strong></div>
          <div className="ap-pay-summary-row ap-pay-summary-row--fee">
            <span>Consultation Fee</span>
            <strong className="ap-pay-fee-amount">{formatINR(amount)}</strong>
          </div>
        </div>

        {/* Payment method selector */}
        <div>
          <div className="ap-pay-method-label">Choose Payment Method</div>
          <div className="ap-pay-methods">
            <button
              type="button"
              className={`ap-pay-method-btn${method === "stripe" ? " ap-pay-method-btn--active" : ""}${stripeCreating ? " ap-pay-method-btn--loading" : ""}`}
              onClick={selectStripe}
              disabled={stripeCreating}
            >
              {stripeCreating
                ? <span className="ap-spinner" />
                : <span className="ap-pay-method-icon">💳</span>}
              <span>Credit / Debit Card</span>
              <span className="ap-pay-method-sub">Stripe · Secure</span>
            </button>

            <button
              type="button"
              className={`ap-pay-method-btn${method === "paypal" ? " ap-pay-method-btn--active" : ""}`}
              onClick={() => { setMethod("paypal"); setPaypalError(""); }}
              disabled={!PAYPAL_CLIENT_ID}
            >
              <span className="ap-pay-method-icon">
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
                  <path d="M19.5 7.5c.28 1.63-.1 3.14-1.1 4.3C17.4 13 15.88 13.75 14 13.75H12.3l-.9 5.25H8.5L10.5 7.5h9z" fill="#009cde" />
                  <path d="M21.5 5.5c.28 1.63-.1 3.14-1.1 4.3C19.4 11 17.88 11.75 16 11.75H14.3l-.9 5.25H10.5L12.5 5.5h9z" fill="#012169" opacity=".6" />
                </svg>
              </span>
              <span>PayPal</span>
              <span className="ap-pay-method-sub">Fast & Secure</span>
            </button>
          </div>
          {stripeError && <p className="ap-error" style={{ marginTop: 10 }}>{stripeError}</p>}
          {!PAYPAL_CLIENT_ID && (
            <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
              PayPal not configured (VITE_PAYPAL_CLIENT_ID missing)
            </p>
          )}
        </div>

        {/* Stripe form */}
        {method === "stripe" && clientSecret && (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: ELEMENTS_APPEARANCE }}>
            <StripeForm
              clientSecret={clientSecret}
              amount={amount}
              doctor={doctor}
              form={form}
              reports={reports}
              onSuccess={(piId) => onComplete(piId, "stripe")}
            />
          </Elements>
        )}

        {/* PayPal buttons */}
        {method === "paypal" && (
          <div className="ap-paypal-wrap">
            {paypalLoading ? (
              <div className="ap-paypal-loading">
                <span className="ap-spinner ap-spinner--lg" />
                <p>Confirming your payment…</p>
              </div>
            ) : (
              <PayPalButtons
                style={{ layout: "vertical", color: "blue", shape: "rect", label: "pay", height: 48 }}
                createOrder={createPaypalOrder}
                onApprove={onPaypalApprove}
                onError={(err) => setPaypalError(err.message || "PayPal encountered an error. Please try again.")}
              />
            )}
            {paypalError && <p className="ap-error" style={{ marginTop: 10 }}>{paypalError}</p>}
          </div>
        )}
      </div>
    </PayPalScriptProvider>
  );
}

/* ─── Main component ──────────────────────────────────────── */
export default function BookAppointment() {
  const { state } = useLocation();

  const [doctor, setDoctor] = useState(state?.doctor || null);
  const [form, setForm] = useState({ date: "", time: "", problem: "" });
  const [reports, setReports] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [stage, setStage] = useState("form"); // "form" | "payment" | "confirming" | "success"
  const [appointment, setAppointment] = useState(null);
  const [error, setError] = useState("");
  const [bookedSlots, setBookedSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [fetchingFee, setFetchingFee] = useState(false);
  const fileInputRef = useRef(null);
  const todayStr = new Date().toISOString().slice(0, 10);

  /* ── Handle Stripe redirect return (UPI / 3DS bank redirect) ── */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const piId = params.get("payment_intent");
    const redirectStatus = params.get("redirect_status");

    if (!piId) return;

    window.history.replaceState({}, "", window.location.pathname);

    const raw = sessionStorage.getItem("ap_booking_pending");
    const pending = raw ? JSON.parse(raw) : null;
    sessionStorage.removeItem("ap_booking_pending");

    if (redirectStatus === "succeeded" && pending) {
      setDoctor(pending.doctor);
      setForm(pending.form);
      setReports(pending.reports);
      setPaymentAmount(pending.amount);
      setStage("confirming");
      bookAppointment(piId, "stripe", pending.doctor, pending.form, pending.reports, pending.amount);
    } else {
      if (pending) { setDoctor(pending.doctor); setForm(pending.form); setReports(pending.reports); }
      setError("Payment was not completed. Please try again.");
      setStage("form");
    }
  }, []);

  /* ── Fetch booked slots when date changes ── */
  useEffect(() => {
    if (!form.date || !doctor) return;
    setLoadingSlots(true);
    const doctorId = doctor.doctorId || doctor.id;
    api.get(`/api/appointments/booked-slots?doctorId=${doctorId}&date=${form.date}`)
      .then((res) => setBookedSlots(res.data.slots || []))
      .catch(() => setBookedSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [form.date, doctor]);

  /* ── Slot helpers ── */
  const getEarliestAllowed = () => {
    if (form.date !== todayStr) return null;
    const d = new Date(); d.setMinutes(d.getMinutes() + 30);
    return d.toTimeString().slice(0, 5);
  };
  const slotStatus = (slot) => {
    if (bookedSlots.includes(slot)) return "booked";
    const e = getEarliestAllowed();
    if (e && slot < e) return "past";
    return "available";
  };

  /* ── Handlers ── */
  const handleDateChange = (e) => {
    setForm({ date: e.target.value, time: "", problem: form.problem });
    setBookedSlots([]);
  };
  const selectSlot = (slot) => { if (slotStatus(slot) === "available") setForm(f => ({ ...f, time: slot })); };

  const uploadFiles = async (fileList) => {
    setUploading(true);
    const results = [];
    for (const file of Array.from(fileList)) {
      const fd = new FormData(); fd.append("file", file);
      try {
        const res = await api.post("/api/upload", fd);
        results.push({ url: res.data.url, name: res.data.name, type: res.data.type, size: res.data.size });
      } catch { setError(`Failed to upload "${file.name}". Max 10 MB.`); }
    }
    setReports(prev => [...prev, ...results]);
    setUploading(false);
  };
  const handleFileChange = (e) => { if (e.target.files?.length) uploadFiles(e.target.files); e.target.value = ""; };
  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files); };
  const removeReport = (idx) => setReports(prev => prev.filter((_, i) => i !== idx));

  /* Fetch fee and move to payment stage */
  const handleProceedToPayment = async () => {
    setError("");
    setFetchingFee(true);
    try {
      const doctorId = doctor.doctorId || doctor.id;
      const res = await api.get(`/api/payments/fee?doctorId=${doctorId}`);
      setPaymentAmount(res.data.feePaise);
      setStage("payment");
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to load fee. Please try again.");
    } finally {
      setFetchingFee(false);
    }
  };

  /* Called after either Stripe or PayPal payment succeeds */
  const handlePaymentComplete = (paymentRef, gateway, amountPaise) => {
    if (amountPaise) setPaymentAmount(amountPaise);
    setStage("confirming");
    bookAppointment(paymentRef, gateway);
  };

  /* Shared appointment creation */
  const bookAppointment = async (paymentRef, gateway, doc, frm, reps, amt) => {
    setError("");
    try {
      const d = doc || doctor;
      const f = frm || form;
      const r = reps || reports;
      const doctorId = d.doctorId || d.id;

      const body = {
        doctorId, date: f.date, time: f.time,
        problem: f.problem, medicalReports: r,
      };
      if (gateway === "paypal") body.paypalOrderId = paymentRef;
      else body.paymentIntentId = paymentRef;

      const res = await api.post("/api/appointments", body);
      setAppointment(res.data.appointment);
      if (amt) setPaymentAmount(amt);
      setStage("success");
      notifyUserActivityUpdated({ source: "appointment", id: res.data?.appointment?._id });
    } catch (err) {
      setError(err.response?.data?.msg || "Appointment booking failed after payment. Please contact support.");
      setStage("form");
    }
  };

  /* ── Render helpers ── */
  const availableCount = form.date ? ALL_SLOTS.filter(s => slotStatus(s) === "available").length : 0;
  const stepBase = form.date ? 0 : -1;
  const canProceed = form.date && form.time && form.problem.trim() && !uploading;

  /* Confirming — spinner while booking is being created */
  if (stage === "confirming") {
    return (
      <div className="ap-page">
        <div className="ap-card">
          <div className="ap-confirming">
            <span className="ap-spinner ap-spinner--lg" />
            <p>Confirming your appointment…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!doctor) return <h2 style={{ padding: 40, textAlign: "center" }}>No Doctor Selected</h2>;

  const stageIndex = stage === "form" ? 0 : stage === "payment" ? 1 : 2;

  return (
    <div className="ap-page">
      <div className="ap-card">

        {/* ── Hero ── */}
        <div className="ap-hero">
          <div className="ap-hero-avatar" style={{ background: doctor.color || "#0c8b7a" }}>{doctor.initials}</div>
          <div className="ap-hero-body">
            <span className="ap-hero-eyebrow">Book Appointment</span>
            <h2 className="ap-hero-name">{doctor.name}</h2>
            <span className="ap-hero-spec">{doctor.specialty || "General"}</span>
          </div>
          {doctor.price > 0 && stage === "form" && (
            <div className="ap-hero-fee">
              <span className="ap-hero-fee-label">Fee</span>
              <span className="ap-hero-fee-amount">
                {doctor.price.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}
              </span>
            </div>
          )}
        </div>

        {/* ── Progress bar ── */}
        {stage !== "success" && (
          <div className="ap-progress">
            {["Details", "Payment", "Confirmed"].map((label, i) => (
              <div key={label} className={`ap-progress-step ${i <= stageIndex ? "ap-progress-step--done" : ""} ${i === stageIndex ? "ap-progress-step--active" : ""}`}>
                <div className="ap-progress-dot">{i < stageIndex ? "✓" : i + 1}</div>
                <span>{label}</span>
                {i < 2 && <div className={`ap-progress-line ${i < stageIndex ? "ap-progress-line--done" : ""}`} />}
              </div>
            ))}
          </div>
        )}

        {/* ── Stage: Form ── */}
        {stage === "form" && (
          <div className="ap-form">

            {/* Step 1 – Date */}
            <div className="ap-step">
              <div className="ap-step-header">
                <span className="ap-step-num">1</span>
                <div>
                  <div className="ap-step-title">Select a Date</div>
                  {form.date && <div className="ap-step-meta">{formatDisplayDate(form.date)}</div>}
                </div>
              </div>
              <input className="ap-date-input" type="date" value={form.date} min={todayStr} onChange={handleDateChange} required />
            </div>

            {/* Step 2 – Slots */}
            {form.date && (
              <div className="ap-step">
                <div className="ap-step-header">
                  <span className="ap-step-num">2</span>
                  <div>
                    <div className="ap-step-title">Choose a Time Slot</div>
                    <div className="ap-step-meta">{loadingSlots ? "Checking availability…" : `${availableCount} of ${ALL_SLOTS.length} slots available`}</div>
                  </div>
                </div>
                {loadingSlots ? (
                  <div className="ap-slots-loading"><span className="ap-spinner" /> Checking availability…</div>
                ) : (
                  <>
                    <div className="ap-slots-grid">
                      {ALL_SLOTS.map(slot => {
                        const status = slotStatus(slot);
                        return (
                          <button key={slot} type="button"
                            className={`ap-slot ap-slot--${status} ${form.time === slot ? "ap-slot--selected" : ""}`}
                            onClick={() => selectSlot(slot)} disabled={status !== "available"}>
                            {formatSlot(slot)}
                            {status === "booked" && <span className="ap-slot-tag">Booked</span>}
                            {status === "past" && <span className="ap-slot-tag">Passed</span>}
                          </button>
                        );
                      })}
                    </div>
                    <div className="ap-slots-legend">
                      <span className="ap-legend-item ap-legend--avail">Available</span>
                      <span className="ap-legend-item ap-legend--sel">Selected</span>
                      <span className="ap-legend-item ap-legend--na">Unavailable</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 3 – Problem */}
            <div className="ap-step">
              <div className="ap-step-header">
                <span className="ap-step-num">{stepBase + 3}</span>
                <div className="ap-step-title">Describe Your Problem</div>
              </div>
              <textarea className="ap-textarea" rows={4}
                placeholder="Briefly describe your symptoms or reason for visit…"
                value={form.problem} onChange={e => setForm(f => ({ ...f, problem: e.target.value }))} required />
            </div>

            {/* Step 4 – Reports */}
            <div className="ap-step">
              <div className="ap-step-header">
                <span className="ap-step-num">{stepBase + 4}</span>
                <div>
                  <div className="ap-step-title">Medical Reports</div>
                  <div className="ap-step-meta">Optional — PDF, Images, Word, Excel · max 10 MB each</div>
                </div>
              </div>
              <div className={`ap-upload-zone ${dragOver ? "ap-upload-zone--over" : ""} ${uploading ? "ap-upload-zone--busy" : ""}`}
                onClick={() => !uploading && fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)} onDrop={handleDrop}>
                <input ref={fileInputRef} type="file" multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt"
                  style={{ display: "none" }} onChange={handleFileChange} />
                {uploading ? (
                  <div className="ap-upload-busy"><span className="ap-spinner" /> Uploading…</div>
                ) : (
                  <><span className="ap-upload-icon">📂</span>
                    <p className="ap-upload-text">Drag & drop or <span className="ap-upload-link">browse files</span></p>
                    <p className="ap-upload-sub">Max 10 MB per file</p></>
                )}
              </div>
              {reports.length > 0 && (
                <div className="ap-report-list">
                  {reports.map((r, i) => (
                    <div key={i} className="ap-report-item">
                      <span className="ap-report-icon">{fileIcon(r.type)}</span>
                      <div className="ap-report-meta">
                        <span className="ap-report-name">{r.name}</span>
                        <span className="ap-report-size">{formatBytes(r.size)}</span>
                      </div>
                      <button type="button" className="ap-report-remove" onClick={() => removeReport(i)}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <p className="ap-error">{error}</p>}

            <button className="ap-submit" type="button" disabled={!canProceed || fetchingFee} onClick={handleProceedToPayment}>
              {fetchingFee
                ? <><span className="ap-spinner ap-spinner--white" /> Loading…</>
                : <>Proceed to Payment{doctor.price > 0 ? ` — ${doctor.price.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}` : ""} →</>}
            </button>
          </div>
        )}

        {/* ── Stage: Payment ── */}
        {stage === "payment" && (
          <PaymentStage
            amount={paymentAmount}
            doctor={doctor}
            form={form}
            reports={reports}
            onBack={() => setStage("form")}
            onComplete={handlePaymentComplete}
          />
        )}

        {/* ── Stage: Success ── */}
        {stage === "success" && (
          <div className="ap-success">
            <div className="ap-success-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 className="ap-success-title">Appointment Booked!</h3>
            <p className="ap-success-sub">Payment confirmed. Your doctor will review and confirm shortly.</p>
            {appointment && (
              <div className="ap-success-details">
                <div className="ap-success-row"><span className="ap-success-key">Doctor</span><span className="ap-success-val">{doctor.name}</span></div>
                <div className="ap-success-row"><span className="ap-success-key">Date</span><span className="ap-success-val">{formatDisplayDate(appointment.date)}</span></div>
                <div className="ap-success-row"><span className="ap-success-key">Time</span><span className="ap-success-val">{formatSlot(appointment.time)}</span></div>
                <div className="ap-success-row"><span className="ap-success-key">Amount Paid</span><span className="ap-success-val ap-success-val--green">{formatINR(paymentAmount)}</span></div>
                <div className="ap-success-row"><span className="ap-success-key">Status</span><span className="ap-badge ap-badge--pending">Pending Confirmation</span></div>
              </div>
            )}
            <Link to="/user/dashboard" className="ap-btn-outline">Back to Dashboard</Link>
          </div>
        )}

      </div>
    </div>
  );
}
