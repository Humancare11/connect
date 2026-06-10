import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, useNavigate, Navigate, Link } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import "./Appointment.css";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || "";

function getClientTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function toAppointmentUtc(date, time) {
  if (!date || !time) return "";
  const match = String(time).trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  if (!match) return "";
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  const localDate = new Date(`${date}T00:00:00`);
  if (Number.isNaN(localDate.getTime())) return "";
  localDate.setHours(hours, minutes, 0, 0);
  return localDate.toISOString();
}

const ELEMENTS_APPEARANCE = {
  theme: "stripe",
  variables: {
    colorPrimary: "#223a5e",
    colorBackground: "#ffffff",
    colorText: "#0f172a",
    colorDanger: "#dc2626",
    fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
    borderRadius: "10px",
    fontSizeBase: "15px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": {
      border: "1.5px solid #e2e8f0",
      boxShadow: "none",
      backgroundColor: "#f8fafc",
    },
    ".Input:focus": {
      border: "1.5px solid #223a5e",
      boxShadow: "0 0 0 3px rgba(34,58,94,.12)",
      backgroundColor: "#fff",
    },
    ".Label": { color: "#334155", fontWeight: "600", fontSize: "13px" },
    ".Tab": { border: "1.5px solid #e2e8f0", borderRadius: "10px" },
    ".Tab:hover": { border: "1.5px solid #223a5e" },
    ".Tab--selected": {
      border: "1.5px solid #223a5e",
      backgroundColor: "#eef4fb",
    },
  },
};

// ─── Time slots ───────────────────────────────────────────────────────────────
const ALL_TIME_SLOTS = [
  "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM",
  "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM",
  "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM",
  "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM",
  "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM",
];

function isSlotPassed(dateStr, slot) {
  const today = new Date().toISOString().split("T")[0];
  if (dateStr !== today) return false;
  const now = new Date();
  const [time, ampm] = slot.split(" ");
  let [h, m] = time.split(":").map(Number);
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ─── Stripe form (inside <Elements>) ─────────────────────────────────────────
function StripeForm({ clientSecret, amount, selection, formData, uploadedReports, onSuccess }) {
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

    // Save state for 3DS redirect recovery
    sessionStorage.setItem(
      "hcc_booking_pending",
      JSON.stringify({ selection, formData, uploadedReports }),
    );

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/appointment-booking/form`,
      },
      redirect: "if_required",
    });

    if (error) {
      sessionStorage.removeItem("hcc_booking_pending");
      setPayError(error.message);
      setPaying(false);
    } else if (paymentIntent?.status === "succeeded") {
      sessionStorage.removeItem("hcc_booking_pending");
      onSuccess(paymentIntent.id);
    }
  };

  return (
    <form onSubmit={handlePay} className="ap-pay-form">
      <div className="ap-pay-element-wrap">
        <PaymentElement
          onReady={() => setReady(true)}
          options={{ layout: "tabs", paymentMethodOrder: ["card"] }}
        />
      </div>
      <div
        className="ap-pay-notice"
        style={{
          fontSize: "12px",
          padding: "12px",
          background: "#eef4fb",
          border: "1px solid #cbd9ea",
          borderRadius: "8px",
          color: "#223a5e",
          marginTop: "12px",
        }}
      >
        <strong>Test Mode:</strong> Use card{" "}
        <code
          style={{
            background: "#fff",
            padding: "2px 4px",
            borderRadius: "4px",
          }}
        >
          4242 4242 4242 4242
        </code>{" "}
        with any future date and any CVC.
      </div>

      {!ready && (
        <div className="ap-pay-element-loading">
          <span className="ap-spinner" /> Loading payment options…
        </div>
      )}

      {payError && <p className="ap-error">{payError}</p>}

      <div className="ap-pay-security">
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Payments are secured and encrypted by Stripe
      </div>

      <button
        className="ap-submit"
        type="submit"
        disabled={!stripe || !ready || paying}
      >
        {paying ? (
          <>
            <span className="ap-spinner ap-spinner--white" /> Processing…
          </>
        ) : (
          `Pay ₹${amount?.toLocaleString("en-IN")} →`
        )}
      </button>
    </form>
  );
}

// ─── Payment stage ────────────────────────────────────────────────────────────
function PaymentStage({ amount, selection, formData, uploadedReports, onBack, onComplete }) {
  const [method, setMethod] = useState(null);
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
      const res = await api.post("/api/payments/create-intent-by-amount", {
        amountInr: amount,
      });
      setClientSecret(res.data.clientSecret);
      setMethod("stripe");
    } catch (err) {
      setStripeError(
        err.response?.data?.msg || "Failed to initialize payment. Please try again.",
      );
    } finally {
      setStripeCreating(false);
    }
  };

  const createPaypalOrder = async () => {
    const res = await api.post("/api/paypal/create-order-by-amount", {
      amountInr: amount,
    });
    return res.data.orderId;
  };

  const onPaypalApprove = async (data) => {
    setPaypalLoading(true);
    setPaypalError("");
    try {
      const res = await api.post("/api/paypal/capture-order", {
        orderId: data.orderID,
      });
      if (res.data.status === "COMPLETED") {
        onComplete(res.data.orderId, "paypal");
      }
    } catch (err) {
      setPaypalError(
        err.response?.data?.msg || "PayPal payment failed. Please try again.",
      );
    } finally {
      setPaypalLoading(false);
    }
  };

  return (
    <PayPalScriptProvider
      options={{ "client-id": PAYPAL_CLIENT_ID, currency: "INR", intent: "capture" }}
    >
      <div className="ap-pay-root">
        <button className="ap-pay-back" type="button" onClick={onBack}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to details
        </button>

        {/* Appointment summary */}
        <div className="ap-pay-summary">
          <div className="ap-pay-summary-title">Appointment Summary</div>
          <div className="ap-pay-summary-row">
            <span>Category</span>
            <strong>{selection.catLabel}</strong>
          </div>
          <div className="ap-pay-summary-row">
            <span>Specialty</span>
            <strong>{selection.specName}</strong>
          </div>
          <div className="ap-pay-summary-row">
            <span>Condition</span>
            <strong>
              {selection.condIco} {selection.condName}
            </strong>
          </div>
          <div className="ap-pay-summary-row">
            <span>Date</span>
            <strong>{formatDisplayDate(formData.date)}</strong>
          </div>
          <div className="ap-pay-summary-row">
            <span>Time</span>
            <strong>{formData.time}</strong>
          </div>
          <div className="ap-pay-summary-row ap-pay-summary-row--fee">
            <span>Consultation Fee</span>
            <strong className="ap-pay-fee-amount">
              ₹{amount?.toLocaleString("en-IN")}
            </strong>
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
              {stripeCreating ? (
                <span className="ap-spinner" />
              ) : (
                <span className="ap-pay-method-icon">💳</span>
              )}
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
                  <path
                    d="M19.5 7.5c.28 1.63-.1 3.14-1.1 4.3C17.4 13 15.88 13.75 14 13.75H12.3l-.9 5.25H8.5L10.5 7.5h9z"
                    fill="#009cde"
                  />
                  <path
                    d="M21.5 5.5c.28 1.63-.1 3.14-1.1 4.3C19.4 11 17.88 11.75 16 11.75H14.3l-.9 5.25H10.5L12.5 5.5h9z"
                    fill="#012169"
                    opacity=".6"
                  />
                </svg>
              </span>
              <span>PayPal</span>
              <span className="ap-pay-method-sub">Fast &amp; Secure</span>
            </button>
          </div>
          {stripeError && (
            <p className="ap-error" style={{ marginTop: 10 }}>
              {stripeError}
            </p>
          )}
          {!PAYPAL_CLIENT_ID && (
            <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
              PayPal not configured
            </p>
          )}
        </div>

        {/* Stripe form */}
        {method === "stripe" && clientSecret && (
          <Elements
            stripe={stripePromise}
            options={{ clientSecret, appearance: ELEMENTS_APPEARANCE }}
          >
            <StripeForm
              clientSecret={clientSecret}
              amount={amount}
              selection={selection}
              formData={formData}
              uploadedReports={uploadedReports}
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
                style={{
                  layout: "vertical",
                  color: "blue",
                  shape: "rect",
                  label: "pay",
                  height: 48,
                }}
                createOrder={createPaypalOrder}
                onApprove={onPaypalApprove}
                onError={(err) =>
                  setPaypalError(
                    err.message || "PayPal encountered an error. Please try again.",
                  )
                }
              />
            )}
            {paypalError && (
              <p className="ap-error" style={{ marginTop: 10 }}>
                {paypalError}
              </p>
            )}
          </div>
        )}
      </div>
    </PayPalScriptProvider>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AppointmentBookingForm() {
  const { state } = useLocation();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Recover selection from route state or sessionStorage (after 3DS redirect)
  const [selection, setSelection] = useState(() => {
    if (state?.selection) return state.selection;
    const raw = sessionStorage.getItem("hcc_booking_pending");
    if (raw) {
      try { return JSON.parse(raw).selection || null; } catch { return null; }
    }
    return null;
  });

  // stage: "form" | "payment" | "confirming" | "success"
  const [stage, setStage] = useState("form");
  const [form, setForm] = useState({ notes: "", date: "", time: "", files: [] });
  const [errors, setErrors] = useState({});
  const [proceedErr, setProceedErr] = useState("");
  const [proceeding, setProceeding] = useState(false);
  const [uploadedReports, setUploadedReports] = useState([]);
  const [confirmErr, setConfirmErr] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const availableSlots = useMemo(
    () => ALL_TIME_SLOTS.filter((t) => !isSlotPassed(form.date, t)),
    [form.date],
  );

  // Handle Stripe 3DS redirect return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const piId = params.get("payment_intent");
    const redirectStatus = params.get("redirect_status");
    if (!piId) return;

    window.history.replaceState({}, "", window.location.pathname);

    const raw = sessionStorage.getItem("hcc_booking_pending");
    const pending = raw ? JSON.parse(raw) : null;
    sessionStorage.removeItem("hcc_booking_pending");

    if (redirectStatus === "succeeded" && pending) {
      setSelection(pending.selection);
      createAppointment(piId, "stripe", pending.formData, pending.uploadedReports || []);
    } else {
      if (pending?.selection) setSelection(pending.selection);
      setProceedErr("Payment was not completed. Please try again.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validate = () => {
    const e = {};
    if (!form.date) e.date = "Please select a date.";
    if (!form.time) e.time = "Please choose a time slot.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleDateChange = (val) => {
    setForm((f) => ({ ...f, date: val, time: "" }));
    setErrors((e) => { const n = { ...e }; delete n.date; delete n.time; return n; });
  };

  const selectTime = (t) => {
    setForm((f) => ({ ...f, time: t }));
    setErrors((e) => { const n = { ...e }; delete n.time; return n; });
  };

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList).filter((f) => f.size <= 10 * 1024 * 1024);
    setForm((prev) => ({
      ...prev,
      files: [
        ...prev.files,
        ...incoming.filter((f) => !prev.files.find((x) => x.name === f.name)),
      ],
    }));
  };

  const removeFile = (i) =>
    setForm((prev) => ({ ...prev, files: prev.files.filter((_, idx) => idx !== i) }));

  const handleProceedToPayment = async () => {
    if (!validate()) return;
    if (!user) {
      setProceedErr("Please log in to continue booking.");
      return;
    }
    setProceeding(true);
    setProceedErr("");
    try {
      // Upload files upfront so URLs survive any 3DS page redirect
      const reports = [];
      for (const file of form.files) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await api.post("/api/upload", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        reports.push(res.data);
      }
      setUploadedReports(reports);
      setStage("payment");
    } catch (err) {
      setProceedErr(
        err?.response?.data?.msg || "Failed to upload reports. Please try again.",
      );
    } finally {
      setProceeding(false);
    }
  };

  const createAppointment = async (paymentRef, gateway, formData, reports) => {
    setStage("confirming");
    setConfirmErr("");
    try {
      const body = {
        category: selection.catLabel,
        specialty: selection.specName,
        condition: selection.condName,
        consultationPrice: selection.cost || 0,
        date: formData.date,
        time: formData.time,
        appointmentDateTimeUtc: toAppointmentUtc(formData.date, formData.time),
        patientTimezone: getClientTimezone(),
        problem: formData.notes,
        medicalReports: reports,
      };
      if (gateway === "paypal") body.paypalOrderId = paymentRef;
      else body.paymentIntentId = paymentRef;

      await api.post("/api/appointments", body);
      setStage("success");
    } catch (err) {
      setConfirmErr(
        err?.response?.data?.msg ||
          "Appointment creation failed after payment. Please contact support.",
      );
      setStage("payment");
    }
  };

  const handlePaymentComplete = (paymentRef, gateway) => {
    createAppointment(paymentRef, gateway, form, uploadedReports);
  };

  // ─── Guard: auth loading ───────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="ap-page">
        <div className="ap-card">
          <div className="ap-confirming">
            <span className="ap-spinner ap-spinner--lg" />
            <p>Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Guard: no selection ───────────────────────────────────────────────────
  if (!selection) return <Navigate to="/appointment-booking" replace />;

  // ─── Guard: auth required for payment ─────────────────────────────────────
  if (!user && stage !== "form") {
    return <Navigate to="/login" state={{ from: "/appointment-booking/form" }} replace />;
  }

  const stageIndex = stage === "form" ? 0 : stage === "payment" ? 1 : 2;

  return (
    <div className="ap-page">
      <div className="ap-card">

        {/* ── Hero: selection badge ── */}
        <div className="ap-hero">
          <div
            className="ap-hero-avatar"
            style={{ background: "#223a5e", fontSize: "24px", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {selection.specIco}
          </div>
          <div className="ap-hero-body">
            <span className="ap-hero-eyebrow">{selection.catLabel}</span>
            <h2 className="ap-hero-name">{selection.specName}</h2>
            <span className="ap-hero-spec">
              {selection.condIco} {selection.condName}
            </span>
          </div>
          {selection.cost > 0 && stage === "form" && (
            <div className="ap-hero-fee">
              <span className="ap-hero-fee-label">Fee</span>
              <span className="ap-hero-fee-amount">
                ₹{selection.cost.toLocaleString("en-IN")}
              </span>
            </div>
          )}
        </div>

        {/* ── Progress bar ── */}
        {stage !== "success" && (
          <div className="ap-progress">
            {["Details", "Payment", "Confirmed"].map((label, i) => (
              <div
                key={label}
                className={`ap-progress-step ${i <= stageIndex ? "ap-progress-step--done" : ""} ${i === stageIndex ? "ap-progress-step--active" : ""}`}
              >
                <div className="ap-progress-dot">
                  {i < stageIndex ? "✓" : i + 1}
                </div>
                <span>{label}</span>
                {i < 2 && (
                  <div
                    className={`ap-progress-line ${i < stageIndex ? "ap-progress-line--done" : ""}`}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Stage: form ── */}
        {stage === "form" && (
          <div className="ap-form">

            {/* Step 1 – Date */}
            <div className="ap-step">
              <div className="ap-step-header">
                <span className="ap-step-num">1</span>
                <div>
                  <div className="ap-step-title">Select a Date</div>
                  {form.date && (
                    <div className="ap-step-meta">{formatDisplayDate(form.date)}</div>
                  )}
                </div>
              </div>
              <input
                className={`ap-date-input${errors.date ? " ap-date-input--err" : ""}`}
                type="date"
                value={form.date}
                min={today}
                onChange={(e) => handleDateChange(e.target.value)}
              />
              {errors.date && <p className="ap-error">{errors.date}</p>}
            </div>

            {/* Step 2 – Time slots: only rendered after date is chosen */}
            {form.date ? (
              <div className="ap-step">
                <div className="ap-step-header">
                  <span className="ap-step-num">2</span>
                  <div>
                    <div className="ap-step-title">Choose a Time Slot</div>
                    <div className="ap-step-meta">
                      {availableSlots.length} of {ALL_TIME_SLOTS.length} slots available
                    </div>
                  </div>
                </div>

                <div className="ap-slots-grid">
                  {ALL_TIME_SLOTS.map((slot) => {
                    const passed = isSlotPassed(form.date, slot);
                    const selected = form.time === slot;
                    const status = passed ? "past" : selected ? "selected" : "available";
                    return (
                      <button
                        key={slot}
                        type="button"
                        className={`ap-slot ap-slot--${passed ? "past" : "available"} ${selected ? "ap-slot--selected" : ""}`}
                        onClick={() => !passed && selectTime(slot)}
                        disabled={passed}
                      >
                        {slot}
                        {passed && <span className="ap-slot-tag">Passed</span>}
                      </button>
                    );
                  })}
                </div>

                <div className="ap-slots-legend">
                  <span className="ap-legend-item ap-legend--avail">Available</span>
                  <span className="ap-legend-item ap-legend--sel">Selected</span>
                  <span className="ap-legend-item ap-legend--na">Unavailable</span>
                </div>
                {errors.time && <p className="ap-error">{errors.time}</p>}
              </div>
            ) : (
              /* Placeholder shown before date is selected */
              <div className="ap-step ap-step--locked">
                <div className="ap-step-header">
                  <span className="ap-step-num ap-step-num--inactive">2</span>
                  <div>
                    <div className="ap-step-title" style={{ color: "#94a3b8" }}>
                      Choose a Time Slot
                    </div>
                    <div className="ap-step-meta" style={{ color: "#f59e0b" }}>
                      ⚠ Select a date above to see available slots
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3 – Problem */}
            <div className="ap-step">
              <div className="ap-step-header">
                <span className="ap-step-num">3</span>
                <div className="ap-step-title">Describe Your Problem</div>
              </div>
              <textarea
                className="ap-textarea"
                rows={4}
                placeholder="Briefly describe your symptoms or reason for visit…"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {/* Step 4 – Reports */}
            <div className="ap-step">
              <div className="ap-step-header">
                <span className="ap-step-num">4</span>
                <div>
                  <div className="ap-step-title">Medical Reports</div>
                  <div className="ap-step-meta">
                    Optional — PDF, Images, Word, Excel · max 10 MB each
                  </div>
                </div>
              </div>
              <div
                className={`ap-upload-zone ${dragOver ? "ap-upload-zone--over" : ""}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    if (e.target.files?.length) addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <span className="ap-upload-icon">📂</span>
                <p className="ap-upload-text">
                  Drag &amp; drop or{" "}
                  <span className="ap-upload-link">browse files</span>
                </p>
                <p className="ap-upload-sub">Max 10 MB per file</p>
              </div>
              {form.files.length > 0 && (
                <div className="ap-report-list">
                  {form.files.map((f, i) => (
                    <div key={i} className="ap-report-item">
                      <span className="ap-report-icon">📄</span>
                      <div className="ap-report-meta">
                        <span className="ap-report-name">{f.name}</span>
                        <span className="ap-report-size">
                          {(f.size / 1048576).toFixed(1)} MB
                        </span>
                      </div>
                      <button
                        type="button"
                        className="ap-report-remove"
                        onClick={() => removeFile(i)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {proceedErr && <p className="ap-error">{proceedErr}</p>}

            <button
              className="ap-submit"
              type="button"
              disabled={proceeding}
              onClick={handleProceedToPayment}
            >
              {proceeding ? (
                <>
                  <span className="ap-spinner ap-spinner--white" /> Preparing…
                </>
              ) : (
                `Proceed to Payment${selection.cost ? ` — ₹${selection.cost.toLocaleString("en-IN")}` : ""} →`
              )}
            </button>
          </div>
        )}

        {/* ── Stage: confirming ── */}
        {stage === "confirming" && (
          <div className="ap-confirming">
            <span className="ap-spinner ap-spinner--lg" />
            <p>Creating your appointment…</p>
          </div>
        )}

        {/* ── Stage: payment ── */}
        {stage === "payment" && (
          <PaymentStage
            amount={selection.cost}
            selection={selection}
            formData={form}
            uploadedReports={uploadedReports}
            onBack={() => { setStage("form"); setConfirmErr(""); }}
            onComplete={handlePaymentComplete}
          />
        )}

        {confirmErr && stage !== "form" && (
          <p className="ap-error" style={{ marginTop: 12 }}>
            {confirmErr}
          </p>
        )}

        {/* ── Stage: success ── */}
        {stage === "success" && (
          <div className="ap-success">
            <div className="ap-success-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 className="ap-success-title">Appointment Requested!</h3>
            <p className="ap-success-sub">
              Payment confirmed. Our team will review and assign a doctor shortly.
              You'll receive an email once a doctor is assigned.
            </p>
            <div className="ap-success-details">
              <div className="ap-success-row">
                <span className="ap-success-key">Specialty</span>
                <span className="ap-success-val">{selection.specName}</span>
              </div>
              <div className="ap-success-row">
                <span className="ap-success-key">Condition</span>
                <span className="ap-success-val">
                  {selection.condIco} {selection.condName}
                </span>
              </div>
              <div className="ap-success-row">
                <span className="ap-success-key">Date</span>
                <span className="ap-success-val">{formatDisplayDate(form.date)}</span>
              </div>
              <div className="ap-success-row">
                <span className="ap-success-key">Time</span>
                <span className="ap-success-val">{form.time}</span>
              </div>
              <div className="ap-success-row">
                <span className="ap-success-key">Amount Paid</span>
                <span className="ap-success-val ap-success-val--green">
                  ₹{selection.cost?.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="ap-success-row">
                <span className="ap-success-key">Status</span>
                <span className="ap-badge ap-badge--pending">Awaiting Doctor Assignment</span>
              </div>
            </div>
            <Link to="/user/appointments" className="ap-submit" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
              View My Appointments
            </Link>
            <button
              type="button"
              className="ap-btn-outline"
              style={{ marginTop: 12 }}
              onClick={() => navigate("/appointment-booking")}
            >
              Book Another Appointment
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
