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
import HealthcareIcon from "../components/HealthcareIcon";
import { useAuth } from "../context/AuthContext";
import { usePrices, usePricingMeta } from "../context/PricingContext";
import { uploadFileDirectToS3 } from "../utils/directUpload";
import "./Appointment.css";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || "";
const BOOKING_PENDING_KEY = "hcc_booking_pending";
const BOOKING_RESUME_KEY = "hcc_booking_resume_after_login";

function readPendingBooking() {
  const raw = sessionStorage.getItem(BOOKING_PENDING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function savePendingBooking(payload) {
  sessionStorage.setItem(BOOKING_PENDING_KEY, JSON.stringify(payload));
}

function getClientTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function toAppointmentUtc(date, time) {
  if (!date || !time) return "";
  const match = String(time)
    .trim()
    .match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
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
    colorPrimary: "#1a3a5c",
    colorBackground: "#ffffff",
    colorText: "#111827",
    colorDanger: "#dc2626",
    fontFamily: "'Inter', system-ui, sans-serif",
    borderRadius: "8px",
    fontSizeBase: "14px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": {
      border: "1px solid #d1d5db",
      boxShadow: "none",
      backgroundColor: "#f9fafb",
    },
    ".Input:focus": {
      border: "1px solid #1a3a5c",
      boxShadow: "0 0 0 3px rgba(26,58,92,.1)",
      backgroundColor: "#fff",
    },
    ".Label": { color: "#374151", fontWeight: "600", fontSize: "13px" },
    ".Tab": { border: "1px solid #d1d5db", borderRadius: "8px" },
    ".Tab:hover": { border: "1px solid #1a3a5c" },
    ".Tab--selected": {
      border: "1px solid #1a3a5c",
      backgroundColor: "#eef4fb",
    },
  },
};

// const ALL_TIME_SLOTS = [
//   "12:00 AM",
//   "12:30 AM",
//   "1:00 AM",
//   "1:30 AM",
//   "2:00 AM",
//   "2:30 AM",
//   "3:00 AM",
//   "3:30 AM",
//   "4:00 AM",
//   "4:30 AM",
//   "5:00 AM",
//   "5:30 AM",
//   "6:00 AM",
//   "6:30 AM",
//   "7:00 AM",
//   "7:30 AM",
//   "8:00 AM",
//   "8:30 AM",
//   "9:00 AM",
//   "9:30 AM",
//   "10:00 AM",
//   "10:30 AM",
//   "11:00 AM",
//   "11:30 AM",
//   "12:00 PM",
//   "12:30 PM",
//   "1:00 PM",
//   "1:30 PM",
//   "2:00 PM",
//   "2:30 PM",
//   "3:00 PM",
//   "3:30 PM",
//   "4:00 PM",
//   "4:30 PM",
//   "5:00 PM",
//   "5:30 PM",
//   "6:00 PM",
//   "6:30 PM",
//   "7:00 PM",
//   "7:30 PM",
//   "8:00 PM",
//   "8:30 PM",
//   "9:00 PM",
//   "9:30 PM",
//   "10:00 PM",
//   "10:30 PM",
//   "11:00 PM",
//   "11:30 PM",
// ];
const ALL_TIME_SLOTS = [];

for (let hour = 0; hour < 24; hour++) {
  for (let minute = 0; minute < 60; minute += 30) {
    const date = new Date();
    date.setHours(hour, minute, 0, 0);

    ALL_TIME_SLOTS.push(
      date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    );
  }
}

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
  const [year, month, day] = dateStr.split("-");
  if (!year || !month || !day) return dateStr;
  return `${month}/${day}/${year}`;
}

function formatPrice(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "";
  return `$${value.toLocaleString("en-US", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  })}`;
}

// ─── Stripe form (inside <Elements>) ─────────────────────────────────────────
function StripeForm({
  clientSecret,
  amount,
  selection,
  formData,
  uploadedReports,
  onSuccess,
}) {
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

    savePendingBooking({ selection, formData, uploadedReports });

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/appointment-booking/form`,
      },
      redirect: "if_required",
    });

    if (error) {
      sessionStorage.removeItem(BOOKING_PENDING_KEY);
      setPayError(error.message);
      setPaying(false);
    } else if (paymentIntent?.status === "succeeded") {
      sessionStorage.removeItem(BOOKING_PENDING_KEY);
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

      {/* Test mode notice */}
      {/* <div
        style={{
          fontSize: "12px",
          padding: "10px 12px",
          background: "#eef4fb",
          border: "1px solid #c8d9ec",
          borderRadius: "8px",
          color: "#1a3a5c",
        }}
      >
        <strong>Test Mode:</strong> Use card{" "}
        <code
          style={{
            background: "#fff",
            padding: "2px 5px",
            borderRadius: "4px",
            fontSize: "11px",
          }}
        >
          4242 4242 4242 4242
        </code>{" "}
        with any future date and any CVC.
      </div> */}

      {!ready && (
        <div className="ap-pay-element-loading">
          <span className="ap-spinner" /> Loading payment options…
        </div>
      )}

      {payError && <p className="ap-error">{payError}</p>}

      <div className="ap-pay-security">
        <svg
          width="12"
          height="12"
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
          `Pay ${formatPrice(amount)} ->`
        )}
      </button>
    </form>
  );
}

// ─── Payment stage ────────────────────────────────────────────────────────────
export function PaymentStage({
  amount,
  selection,
  formData,
  uploadedReports,
  onBack,
  onComplete,
}) {
  const [method, setMethod] = useState(null);
  const [clientSecret, setClientSecret] = useState("");
  const [stripeCreating, setStripeCreating] = useState(false);
  const [stripeError, setStripeError] = useState("");
  const [paypalLoading, setPaypalLoading] = useState(false);
  const [paypalError, setPaypalError] = useState("");
  const selectStripe = async () => {
    setStripeError("");
    if (clientSecret) {
      setMethod("stripe");
      return;
    }
    setStripeCreating(true);
    try {
      const res = await api.post("/api/payments/create-intent-by-amount", {
        amountUsd: amount,
      });
      setClientSecret(res.data.clientSecret);
      setMethod("stripe");
    } catch (err) {
      setStripeError(
        err.response?.data?.msg ||
        "Failed to initialize payment. Please try again.",
      );
    } finally {
      setStripeCreating(false);
    }
  };

  const createPaypalOrder = async () => {
    const res = await api.post("/api/paypal/create-order-by-amount", {
      amountUsd: amount,
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
      if (res.data.status === "COMPLETED")
        onComplete(res.data.orderId, "paypal");
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
      options={{
        "client-id": PAYPAL_CLIENT_ID,
        currency: "USD",
        intent: "capture",
      }}
    >
      <div className="ap-pay-root">
        <button className="ap-pay-back" type="button" onClick={onBack}>
          <svg
            width="15"
            height="15"
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
          {selection.specName && (
            <div className="ap-pay-summary-row">
              <span>Specialty</span>
              <strong>{selection.specName}</strong>
            </div>
          )}
          {selection.condName && (
            <div className="ap-pay-summary-row">
              <span>Condition</span>
              <strong>
                <HealthcareIcon name={selection.condIco} size={16} />{" "}
                {selection.condName}
              </strong>
            </div>
          )}
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
            <strong className="ap-pay-fee-amount">{formatPrice(amount)}</strong>
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
              onClick={() => {
                setMethod("paypal");
                setPaypalError("");
              }}
              disabled={!PAYPAL_CLIENT_ID}
            >
              <span className="ap-pay-method-icon">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
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
            <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>
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
                  height: 46,
                }}
                createOrder={createPaypalOrder}
                onApprove={onPaypalApprove}
                onError={(err) =>
                  setPaypalError(err.message || "PayPal encountered an error.")
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
  const categoryPrices = usePrices();
  const pricingMeta = usePricingMeta();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [selection, setSelection] = useState(() => {
    if (state?.selection) return state.selection;
    return readPendingBooking()?.selection || null;
  });

  const [stage, setStage] = useState("form");
  const [form, setForm] = useState(() => {
    const formData = readPendingBooking()?.formData;
    return {
      notes: formData?.notes || "",
      date: formData?.date || "",
      time: formData?.time || "",
      files: [],
    };
  });
  const [errors, setErrors] = useState({});
  const [proceedErr, setProceedErr] = useState("");
  const [proceeding, setProceeding] = useState(false);
  const [uploadedReports, setUploadedReports] = useState([]);
  const [confirmErr, setConfirmErr] = useState("");
  const [dragOver, setDragOver] = useState(false);

  // ── Consent modal state ──────────────────────────────────────────────────────
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consents, setConsents] = useState({
    telehealth: false,
    terms: true,
    hipaa: true,
    age: true,
  });
  const allConsentsChecked = Object.values(consents).every(Boolean);
  const toggleConsent = (key) =>
    setConsents((prev) => ({ ...prev, [key]: !prev[key] }));

  const today = new Date().toISOString().split("T")[0];
  const pricingRecord = selection?.catId
    ? categoryPrices?.[selection.catId]
    : null;
  const pricingAmount = Number(pricingRecord?.price);
  const selectionAmount = Number(selection?.cost);
  const hasDbPrice =
    !!selection?.catId &&
    !!pricingRecord &&
    Number.isFinite(pricingAmount) &&
    pricingAmount > 0;
  const hasSelectionPrice =
    Number.isFinite(selectionAmount) && selectionAmount > 0;
  const hasAppointmentPrice = hasDbPrice || hasSelectionPrice;
  const effectivePrice = hasDbPrice ? pricingAmount : selectionAmount;
  const effectiveCurrency = hasDbPrice
    ? pricingRecord.currency || "USD"
    : selection?.currency || "USD";
  const pricingIssue = !selection?.catId
    ? "Please reselect your appointment category so the current database price can be loaded."
    : pricingMeta.loading && !hasSelectionPrice
      ? "Loading the latest appointment price. Please wait."
      : pricingMeta.error && !hasSelectionPrice
        ? "Pricing could not be loaded. Please try again shortly."
        : !hasAppointmentPrice
          ? "No valid database price is configured for this category."
          : "";
  useEffect(() => {
    if (!hasAppointmentPrice) return;
    setSelection((prev) => {
      if (
        !prev ||
        (prev.cost === effectivePrice && prev.currency === effectiveCurrency)
      ) {
        return prev;
      }
      return {
        ...prev,
        cost: effectivePrice,
        currency: effectiveCurrency,
      };
    });
  }, [hasAppointmentPrice, effectivePrice, effectiveCurrency]);

  const availableSlots = useMemo(
    () => ALL_TIME_SLOTS.filter((t) => !isSlotPassed(form.date, t)),
    [form.date],
  );

  const continueToPayment = async ({
    formData = form,
    reports = uploadedReports,
  } = {}) => {
    setProceeding(true);
    setProceedErr("");
    try {
      const uploaded = reports?.length ? reports : [];
      if (!uploaded.length && formData.files?.length) {
        for (const file of formData.files) {
          uploaded.push(await uploadFileDirectToS3(file));
        }
      }
      setUploadedReports(uploaded);
      setForm((prev) => ({
        ...prev,
        notes: formData.notes || "",
        date: formData.date || "",
        time: formData.time || "",
        files: formData.files || [],
      }));
      setStage("payment");
    } catch (err) {
      setProceedErr(
        err?.response?.data?.msg ||
        "Failed to upload reports. Please try again.",
      );
    } finally {
      setProceeding(false);
    }
  };

  // Handle Stripe 3DS redirect return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const piId = params.get("payment_intent");
    const redirectStatus = params.get("redirect_status");
    if (!piId) return;

    window.history.replaceState({}, "", window.location.pathname);

    const pending = readPendingBooking();
    sessionStorage.removeItem(BOOKING_PENDING_KEY);

    if (redirectStatus === "succeeded" && pending) {
      setSelection(pending.selection);
      createAppointment(
        piId,
        "stripe",
        pending.formData,
        pending.uploadedReports || [],
      );
    } else {
      if (pending?.selection) setSelection(pending.selection);
      setProceedErr("Payment was not completed. Please try again.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    if (sessionStorage.getItem(BOOKING_RESUME_KEY) !== "1") return;

    const pending = readPendingBooking();
    sessionStorage.removeItem(BOOKING_RESUME_KEY);
    if (!pending?.selection || !pending?.formData) return;

    setSelection(pending.selection);
    setForm({
      notes: pending.formData.notes || "",
      date: pending.formData.date || "",
      time: pending.formData.time || "",
      files: [],
    });
    setUploadedReports(pending.uploadedReports || []);
    continueToPayment({
      formData: {
        notes: pending.formData.notes || "",
        date: pending.formData.date || "",
        time: pending.formData.time || "",
        files: [],
      },
      reports: pending.uploadedReports || [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const validate = () => {
    const e = {};
    if (!form.date) e.date = "Please select a date.";
    if (!form.time) e.time = "Please choose a time slot.";
    if (!form.notes.trim()) {
      e.notes = "Please describe your problem.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleDateChange = (val) => {
    setForm((f) => ({ ...f, date: val, time: "" }));
    setErrors((e) => {
      const n = { ...e };
      delete n.date;
      delete n.time;
      return n;
    });
  };

  const selectTime = (t) => {
    setForm((f) => ({ ...f, time: t }));
    setErrors((e) => {
      const n = { ...e };
      delete n.time;
      return n;
    });
  };

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList).filter(
      (f) => f.size <= 10 * 1024 * 1024,
    );
    setForm((prev) => ({
      ...prev,
      files: [
        ...prev.files,
        ...incoming.filter((f) => !prev.files.find((x) => x.name === f.name)),
      ],
    }));
  };

  const removeFile = (i) =>
    setForm((prev) => ({
      ...prev,
      files: prev.files.filter((_, idx) => idx !== i),
    }));

  // ── Opens consent modal (validates date/time first) ──────────────────────────
  // const handleProceedClick = () => {
  //   if (!validate()) return;
  //   setShowConsentModal(true);
  // };
  const handleProceedClick = () => {
    if (!validate()) return;
    if (pricingIssue) {
      setProceedErr(pricingIssue);
      return;
    }
    setConsents({ telehealth: false, terms: false, hipaa: false, age: false }); // reset
    setShowConsentModal(true);
  };

  // ── Called after user confirms consent in modal ──────────────────────────────
  const handleConsentConfirm = () => {
    setShowConsentModal(false);
    handleProceedToPayment();
  };

  const handleProceedToPayment = async () => {
    if (!user) {
      savePendingBooking({
        selection,
        formData: {
          notes: form.notes,
          date: form.date,
          time: form.time,
        },
        uploadedReports: [],
      });
      sessionStorage.setItem(BOOKING_RESUME_KEY, "1");
      navigate("/login", {
        state: {
          from: "/appointment-booking/form",
          resumeBooking: true,
        },
        replace: true,
      });
      return;
    }
    continueToPayment();
  };

  const createAppointment = async (paymentRef, gateway, formData, reports) => {
    setStage("confirming");
    setConfirmErr("");
    try {
      const body = {
        category: selection.catLabel,
        specialty: selection.specName,
        condition: selection.condName,
        consultationPrice: Number(selection.cost),
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
      sessionStorage.removeItem(BOOKING_PENDING_KEY);
      sessionStorage.removeItem(BOOKING_RESUME_KEY);
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

  // ─── Guards ────────────────────────────────────────────────────────────────
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

  if (!selection) return <Navigate to="/appointment-booking" replace />;

  if (!user && stage !== "form") {
    return (
      <Navigate
        to="/login"
        state={{ from: "/appointment-booking/form" }}
        replace
      />
    );
  }

  const stageIndex = stage === "form" ? 0 : stage === "payment" ? 1 : 2;

  return (
    <div className="ap-page">
      {/* Page-level heading */}
      {stage === "form" && (
        <div className="ap-page-title">
          <h1>Book an Appointment</h1>
          <p>Select your preferred date and time, then proceed to payment.</p>
        </div>
      )}

      <div className="ap-card">
        {/* ── Hero: selection badge ── */}
        <div className="ap-hero">
          <div className="ap-hero-avatar">
            <HealthcareIcon name={selection.specIco} size={30} />
          </div>
          <div className="ap-hero-body">
            <span className="ap-hero-eyebrow">{selection.catLabel}</span>
            <h2 className="ap-hero-name">{selection.specName}</h2>
            <span className="ap-hero-spec">
              <HealthcareIcon name={selection.condIco} size={16} />{" "}
              {selection.condName}
            </span>
          </div>
          {hasAppointmentPrice && stage === "form" && (
            <div className="ap-hero-fee">
              <span className="ap-hero-fee-label">Fee</span>
              <span className="ap-hero-fee-amount">
                {formatPrice(selection.cost)}
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
                className={`ap-progress-step ${i < stageIndex ? "ap-progress-step--done" : ""} ${i === stageIndex ? "ap-progress-step--active" : ""}`}
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

        {/* ══════════════════════════════════════
            Stage: form
        ══════════════════════════════════════ */}
        {stage === "form" && (
          <div className="ap-form">
            {/* ── Step 1: Date ── */}
            <div className="ap-step">
              <div className="ap-step-header">
                <span className="ap-step-num">1</span>
                <div>
                  <div className="ap-step-title">
                    Appointment Date <span style={{ color: "#e11d48" }}>*</span>
                  </div>
                  {form.date && (
                    <div className="ap-step-meta">
                      {formatDisplayDate(form.date)}
                    </div>
                  )}
                </div>
              </div>
              <input
                className={`ap-date-input${errors.date ? " ap-date-input--err" : ""}`}
                type="date"
                lang="en-US"
                value={form.date}
                min={today}
                onChange={(e) => handleDateChange(e.target.value)}
                placeholder="MM/DD/YYYY"
              />
              {errors.date && <p className="ap-error">{errors.date}</p>}
            </div>

            {/* ── Step 2: Time slots ── */}
            {form.date ? (
              <div className="ap-step">
                <div className="ap-step-header">
                  <span className="ap-step-num">2</span>
                  <div>
                    <div className="ap-step-title">
                      Preferred Time Slot{" "}
                      <span style={{ color: "#e11d48" }}>*</span>
                    </div>
                    <div className="ap-step-meta">
                      {availableSlots.length} of {ALL_TIME_SLOTS.length} slots
                      available
                    </div>
                  </div>
                </div>

                <div className="ap-slots-grid">
                  {ALL_TIME_SLOTS.map((slot) => {
                    const passed = isSlotPassed(form.date, slot);
                    const selected = form.time === slot;
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
                  <span className="ap-legend-item ap-legend--avail">
                    Available
                  </span>
                  <span className="ap-legend-item ap-legend--sel">
                    Selected
                  </span>
                  <span className="ap-legend-item ap-legend--na">
                    Unavailable
                  </span>
                </div>
                {errors.time && <p className="ap-error">{errors.time}</p>}
              </div>
            ) : (
              <div className="ap-step ap-step--locked">
                <div className="ap-step-header">
                  <span className="ap-step-num ap-step-num--inactive">2</span>
                  <div>
                    <div className="ap-step-title" style={{ color: "#9ca3af" }}>
                      Preferred Time Slot
                    </div>
                    <div className="ap-step-meta" style={{ color: "#f59e0b" }}>
                      ⚠ Select a date above to see available slots
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Divider ── */}
            <div className="ap-divider" />

            {/* ── Step 3: Problem description ── */}
            {/* <div className="ap-step">
              <div className="ap-step-header">
                <span className="ap-step-num">3</span>
                <div className="ap-step-title">Describe Your Problem</div>
              </div>
              <textarea
                className="ap-textarea"
                rows={4}
                placeholder="Briefly describe your symptoms or reason for visit…"
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </div> */}
            <div className="ap-step">
              <div className="ap-step-header">
                <span className="ap-step-num">3</span>

                <div className="ap-step-title">
                  Describe Your Problem{" "}
                  <span style={{ color: "#e11d48" }}>*</span>
                </div>
                {/* <div className="ap-step-title">Describe Your Problem</div> */}

                {/* <span style={{ color: "#e11d48" }}>*</span> */}
              </div>

              <textarea
                className="ap-textarea"
                rows={4}
                placeholder="Briefly describe your symptoms or reason for visit…"
                value={form.notes}
                required
                maxLength={1000}
                onChange={(e) => {
                  setForm((f) => ({ ...f, notes: e.target.value }));

                  if (errors.notes) {
                    setErrors((prev) => ({
                      ...prev,
                      notes: "",
                    }));
                  }
                }}
              />

              <div className="ap-char-count">
                {form.notes.length}/1000 characters
              </div>
              {errors.notes && <p className="ap-error">{errors.notes}</p>}
            </div>

            {/* ── Step 4: Medical reports ── */}
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
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files?.length)
                    addFiles(e.dataTransfer.files);
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

            {(pricingIssue || proceedErr) && (
              <p className="ap-error">{proceedErr || pricingIssue}</p>
            )}

            {/* ── CTA — now opens consent modal ── */}
            <button
              className="ap-submit"
              type="button"
              disabled={proceeding || !!pricingIssue}
              onClick={handleProceedClick}
            >
              {proceeding ? (
                <>
                  <span className="ap-spinner ap-spinner--white" /> Preparing…
                </>
              ) : (
                `Proceed to Payment${hasAppointmentPrice ? ` - ${formatPrice(selection.cost)}` : ""} ->`
              )}
            </button>

            {/* {!user && (
              <p className="ap-submit-helper">
                Already have an account? <Link to="/login">Log in</Link>
              </p>
            )} */}
          </div>
        )}

        {/* ══════════════════════════════════════
            Stage: confirming
        ══════════════════════════════════════ */}
        {stage === "confirming" && (
          <div className="ap-confirming">
            <span className="ap-spinner ap-spinner--lg" />
            <p>Creating your appointment…</p>
          </div>
        )}

        {/* ══════════════════════════════════════
            Stage: payment
        ══════════════════════════════════════ */}
        {stage === "payment" && (
          <PaymentStage
            amount={selection.cost}
            selection={selection}
            formData={form}
            uploadedReports={uploadedReports}
            onBack={() => {
              setStage("form");
              setConfirmErr("");
            }}
            onComplete={handlePaymentComplete}
          />
        )}

        {confirmErr && stage !== "form" && (
          <p className="ap-error" style={{ margin: "0 28px 20px" }}>
            {confirmErr}
          </p>
        )}

        {/* ══════════════════════════════════════
            Stage: success
        ══════════════════════════════════════ */}
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
              Payment confirmed. Our team will review and assign a doctor
              shortly. You'll receive an email once a doctor is assigned.
            </p>
            <div className="ap-success-details">
              <div className="ap-success-row">
                <span className="ap-success-key">Specialty</span>
                <span className="ap-success-val">{selection.specName}</span>
              </div>
              <div className="ap-success-row">
                <span className="ap-success-key">Condition</span>
                <span className="ap-success-val">
                  {selection.condName}
                </span>
              </div>
              <div className="ap-success-row">
                <span className="ap-success-key">Date</span>
                <span className="ap-success-val">
                  {formatDisplayDate(form.date)}
                </span>
              </div>
              <div className="ap-success-row">
                <span className="ap-success-key">Time</span>
                <span className="ap-success-val">{form.time}</span>
              </div>
              <div className="ap-success-row">
                <span className="ap-success-key">Amount Paid</span>
                <span className="ap-success-val ap-success-val--green">
                  {formatPrice(selection.cost)}
                </span>
              </div>
              <div className="ap-success-row">
                <span className="ap-success-key">Status</span>
                <span className="ap-badge ap-badge--pending">
                  Awaiting Doctor Assignment
                </span>
              </div>
            </div>
            <Link
              to="/user/appointments"
              className="ap-submit"
              style={{
                display: "block",
                textAlign: "center",
                textDecoration: "none",
              }}
            >
              View My Appointments
            </Link>
            <button
              type="button"
              className="ap-btn-outline"
              style={{ marginTop: 10 }}
              onClick={() => navigate("/appointment-booking")}
            >
              Book Another Appointment
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════
            Consent Modal
        ══════════════════════════════════════ */}
        {showConsentModal && (
          <div
            className="ap-modal-overlay"
            onClick={() => setShowConsentModal(false)}
          >
            <div className="ap-modal" onClick={(e) => e.stopPropagation()}>
              {/* Modal header */}
              <div className="ap-modal-header">
                <div className="ap-modal-title">Patient Informed Consent</div>
                <button
                  type="button"
                  className="ap-modal-close"
                  onClick={() => setShowConsentModal(false)}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              {/* Modal body */}
              <div className="ap-modal-body">
                <div className="ap-consent-scroll">
                  <p className="ap-consent-text">
                    <strong>Patient Informed Consent:</strong> By booking this
                    appointment, you consent to receive telehealth services from
                    licensed physicians through Humancare Connect. You
                    understand that (1) telehealth is not a substitute for
                    in-person care in all situations; (2) physicians on this
                    platform are independent contractors; (3) in a medical
                    emergency, call 911 immediately. You have read and agree to
                    our Telehealth Informed Consent policy.
                  </p>
                </div>
                <div className="ap-consent-checks" style={{ marginTop: 12 }}>
                  {[
                    {
                      key: "telehealth",
                      label: "I have read and agree to the ",
                      linkText: "Telehealth Informed Consent",
                      href: "/tele-health-informed-consent",
                    },
                    {
                      key: "terms",
                      label: "I agree to the ",
                      linkText: "Terms of Service",
                      href: "/terms-of-service",
                      extra: " and ",
                      linkText2: "Privacy Policy",
                      href2: "/privacy-policy",
                    },
                    {
                      key: "hipaa",
                      label: "I have read the ",
                      linkText: "HIPAA Notice of Privacy Practices",
                      href: "/notice-of-privacy-practices",
                    },
                    { key: "age", label: "I am 18 years of age or older" },
                  ].map(
                    ({
                      key,
                      label,
                      linkText,
                      href,
                      extra,
                      linkText2,
                      href2,
                    }) => (
                      <label
                        key={key}
                        htmlFor={`consent-${key}`}
                        className="ap-consent-row"
                      >
                        <input
                          type="checkbox"
                          id={`consent-${key}`}
                          name={`consent-${key}`}
                          className="ap-consent-checkbox"
                          checked={consents[key]}
                          onChange={() => toggleConsent(key)}
                        />

                        <span className="ap-consent-label">
                          {label}
                          {linkText && href && (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ap-consent-link"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {linkText}
                            </a>
                          )}
                          {extra}
                          {linkText2 && href2 && (
                            <a
                              href={href2}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ap-consent-link"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {linkText2}
                            </a>
                          )}
                        </span>
                      </label>
                    ),
                  )}
                </div>
              </div>

              {/* Modal footer */}
              <div className="ap-modal-footer">
                <button
                  type="button"
                  className="ap-btn-outline"
                  onClick={() => setShowConsentModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="ap-submit"
                  style={{ marginTop: 0, flex: 1 }}
                  disabled={!allConsentsChecked || proceeding}
                  onClick={handleConsentConfirm}
                >
                  {proceeding ? (
                    <>
                      <span className="ap-spinner ap-spinner--white" />{" "}
                      Preparing…
                    </>
                  ) : (
                    "Confirm & Continue →"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
