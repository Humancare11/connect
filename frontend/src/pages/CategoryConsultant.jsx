import { useState, useRef, useEffect, Fragment } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api";
import "./CategoryConsultant.css";

const CATEGORY_MAP = {
  general: "General & Everyday Care",
  mental: "Mental Health",
  skin: "Skin & Hair",
  women: "Women's Health",
  men: "Men's Health",
  family: "Children & Family",
  weight: "Weight & Nutrition",
  chronic: "Chronic Care & Expert Opinion",
  eeb: "Eye, Ear & Bone",
  sexual: "Sexual Health",
  travel: "Travel & Global Care",
};

/* =====================================================================
   Static data — lives at module scope because it's data, not markup.
   Nothing below is a step/component function; every element gets
   rendered directly inside the default export's return.
   ===================================================================== */

const MAX_CHARS = 500;

const SEVERITY_OPTIONS = [
  { id: "mild", icon: "😊", title: "Mild — manageable" },
  { id: "moderate", icon: "😐", title: "Moderate — affecting me" },
  { id: "severe", icon: "😟", title: "Severe — significant impact" },
  { id: "urgent", icon: "🚨", title: "Urgent — need help now" },
];

const SUPPORT_OPTIONS = [
  { id: "diagnosis", icon: "🩺", title: "Diagnosis & Advice" },
  { id: "prescription", icon: "💊", title: "Prescription" },
  { id: "note", icon: "📄", title: "Doctor's Note" },
  { id: "plan", icon: "📋", title: "Treatment Plan" },
];

const URGENCY_OPTIONS = [
  {
    id: "next",
    icon: "⚡",
    title: "Next Availability",
    subtitle: "Match with an available physician as soon as possible.",
  },
  {
    id: "flexible",
    icon: "🌤️",
    title: "Flexible Timing",
    subtitle: "I'm available anytime during the selected period.",
  },
];

// Generates 30-minute slot labels between two times on a 12-hour clock.
function buildSlots(startHour, startMin, endHour, endMin) {
  const slots = [];
  let h = startHour;
  let m = startMin;
  while (h < endHour || (h === endHour && m <= endMin)) {
    const period = h >= 12 ? "PM" : "AM";
    const display = (h % 12 || 12).toString().padStart(2, "0");
    slots.push(`${display}:${m.toString().padStart(2, "0")} ${period}`);
    m += 30;
    if (m >= 60) {
      m = 0;
      h += 1;
    }
  }
  return slots;
}

const TIME_WINDOWS = [
  { id: "morning", label: "Morning", range: "6:00 AM – 12:00 PM", icon: "☀️", startHour: 6, endHour: 12, slots: buildSlots(6, 0, 11, 30) },
  { id: "afternoon", label: "Afternoon", range: "12:00 PM – 6:00 PM", icon: "🌤️", startHour: 12, endHour: 18, slots: buildSlots(12, 0, 17, 30) },
  { id: "evening", label: "Evening", range: "6:00 PM – 12:00 AM", icon: "🌆", startHour: 18, endHour: 24, slots: buildSlots(18, 0, 23, 30) },
  { id: "night", label: "Night", range: "12:00 AM – 6:00 AM", icon: "🌙", startHour: 0, endHour: 6, slots: buildSlots(0, 0, 5, 30) },
];

const STEPS = [1, 2];

const INITIAL_DATA = {
  concern: "",
  duration: "",
  severity: "",
  supportType: "",
  urgency: "",
  timeWindow: "",
  slot: "",
  date: "",
};

const CHECK_ICON = (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path
      d="M2.5 7.2L5.5 10.2L11.5 3.8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CHEVRON_ICON = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M4 6l4 4 4-4"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* =====================================================================
   Root — owns all state; every step is rendered inline below, not
   pulled out into separate step components.
   ===================================================================== */

export default function CategoryConsultant({ onComplete }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [data, setData] = useState(INITIAL_DATA);
  const [openWindow, setOpenWindow] = useState(null);
  const [price, setPrice] = useState(49);

  const queryParams = new URLSearchParams(location.search);
  const categoryId =
    queryParams.get("category") || location.state?.categoryId || "general";
  const categoryLabel = CATEGORY_MAP[categoryId] || "General & Everyday Care";

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const response = await api.get("/api/appointment-tree");
        const categoryName = CATEGORY_MAP[categoryId] || categoryId;
        const category = response.data.find((item) => item.name === categoryName);
        if (category && category.price !== undefined) {
          setPrice(category.price);
        }
      } catch (err) {
        console.error("Failed to fetch price in CategoryConsultant:", err);
      }
    };
    fetchPrice();
  }, [categoryId]);

  const textareaRef = useRef(null);

  const [dateError, setDateError] = useState("");
  const todayStr = new Date().toISOString().split("T")[0];
  const isToday = data.date === todayStr;

  // Is this window's slot range already over, for a "today" booking?
  const isWindowDisabled = (window) => {
    if (!data.date) return true; // no date picked yet → nothing selectable
    if (!isToday) return false;
    const now = new Date();
    const nowHour = now.getHours() + now.getMinutes() / 60;
    return nowHour >= window.endHour;
  };

  // Convert "01:30 PM" -> minutes since midnight, for comparison
  const slotToMinutes = (slot) => {
    const [time, period] = slot.split(" ");
    let [h, m] = time.split(":").map(Number);
    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return h * 60 + m;
  };

  const isSlotDisabled = (slot) => {
    if (!isToday) return false;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return slotToMinutes(slot) <= nowMinutes;
  };

  // Which window matches right now
  const getCurrentWindowId = () => {
    const nowHour = new Date().getHours();
    const match = TIME_WINDOWS.find((w) => nowHour >= w.startHour && nowHour < w.endHour);
    return match ? match.id : TIME_WINDOWS[0].id;
  };

  const handleDateChange = (e) => {
    const value = e.target.value;
    setDateError("");
    setData((prev) => ({
      ...prev,
      date: value,
      // reset downstream choices since availability depends on the date
      urgency: value ? "next" : "",
      timeWindow: "",
      slot: "",
    }));
    setOpenWindow(value === todayStr ? getCurrentWindowId() : null);
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
    }
  }, [data.concern]);

  // Keep the accordion in sync if a slot already exists when Step 2 mounts.
  useEffect(() => {
    if (step === 2 && !openWindow) {
      const match = TIME_WINDOWS.find((w) => w.slots.includes(data.slot));
      if (match) setOpenWindow(match.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const handleConcernChange = (e) => {
    const value = e.target.value.slice(0, MAX_CHARS);
    setData({ ...data, concern: value });
  };

  const toggleWindow = (id) => {
    const win = TIME_WINDOWS.find((w) => w.id === id);
    if (win && isWindowDisabled(win)) return;
    setOpenWindow((prev) => (prev === id ? null : id));
  };
  const selectSlot = (windowId, slot) => {
    setData({ ...data, timeWindow: windowId, slot });
  };

  const canContinueStep1 =
    data.concern.trim().length > 0 && data.severity && data.supportType;

  const canContinueStep2 = data.date && data.urgency && data.slot;

  const handleFinish = async () => {
    if (!data.date) {
      setDateError("Please select a date.");
      return;
    }
    try {
      const selection = {
        catId: categoryId,
        catLabel: categoryLabel,
        specName: "Category Consultation",
        specIco: "stethoscope",
        condName: "General Consultation Request",
        condIco: "activity",
        cost: price,
        currency: "USD",
        isCategoryBooking: true,
      };

      // Save raw data directly
      sessionStorage.setItem(
        "hcc_booking_pending",
        JSON.stringify({ selection, formData: data }),
      );

      if (user) {
        navigate("/appointment-booking/category-confirm");
      } else {
        navigate("/login", {
          state: { from: "/appointment-booking/category-confirm" },
        });
      }

      if (onComplete) {
        onComplete(data);
      }
    } catch (error) {
      console.error(error);
      alert("Error preparing booking");
    }
  };

  return (
    <div className="hc-form-shell">
      {/* ================= STEP 1 — Concern ================= */}
      {step === 1 && (
        <section
          className="hc-concern-step"
          aria-labelledby="hc-concern-heading"
        >
          <div className="hc-topbar">
            <button
              type="button"
              className="hc-back-link"
              onClick={() => setStep(1)}
              disabled={step === 1}
            >
              Steps
            </button>
            <div
              className="hc-stepper"
              role="img"
              aria-label={`Step ${step} of ${STEPS.length}`}
            >
              {STEPS.map((s, idx) => (
                <Fragment key={s}>
                  <div
                    className={`hc-stepper__circle ${step === s ? "is-active" : ""
                      } ${step > s ? "is-done" : ""}`}
                  >
                    {step > s ? CHECK_ICON : s}
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={`hc-stepper__line ${step > s ? "is-filled" : ""
                        }`}
                    />
                  )}
                </Fragment>
              ))}
            </div>
          </div>

          <header className="hc-concern-step__header">
            <h1 id="hc-concern-heading" className="hc-concern-step__title">
              Tell us about your concern
            </h1>
            <p className="hc-concern-step__subtitle">
              Help us understand what you're experiencing so we can match you
              with the right physician.
            </p>
          </header>

          <div className="hc-field">
            <label htmlFor="hc-concern-input" className="hc-field__label">
              What's your main concern today?
            </label>
            <div className="hc-textarea-wrap">
              <textarea
                id="hc-concern-input"
                ref={textareaRef}
                className="hc-textarea"
                placeholder="Describe your symptoms or what you'd like help with…"
                value={data.concern}
                onChange={handleConcernChange}
                maxLength={MAX_CHARS}
                rows={4}
              />
              <span
                className={`hc-char-counter ${data.concern.length >= MAX_CHARS ? "is-limit" : ""
                  }`}
              >
                {data.concern.length}/{MAX_CHARS}
              </span>
            </div>
          </div>

          <div className="hc-field">
            <span className="hc-field__label">
              Severity (how much does it affect your daily life?)
            </span>
            <div
              className="hc-card-grid hc-card-grid--2"
              role="radiogroup"
              aria-label="Severity"
            >
              {SEVERITY_OPTIONS.map((opt) => {
                const selected = data.severity === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`hc-option-card hc-option-card--light ${selected ? "is-selected" : ""
                      }`}
                    onClick={() => setData({ ...data, severity: opt.id })}
                  >
                    <span className="hc-option-card__icon" aria-hidden="true">
                      {opt.icon}
                    </span>
                    <span className="hc-option-card__text">
                      <span className="hc-option-card__title">{opt.title}</span>
                    </span>
                    {selected && (
                      <span
                        className="hc-option-card__check"
                        aria-hidden="true"
                      >
                        {CHECK_ICON}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hc-field">
            <span className="hc-field__label">
              What type of support are you looking for?
            </span>
            <div
              className="hc-card-grid hc-card-grid--2"
              role="radiogroup"
              aria-label="Support type"
            >
              {SUPPORT_OPTIONS.map((opt) => {
                const selected = data.supportType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`hc-option-card hc-option-card--light ${selected ? "is-selected" : ""
                      }`}
                    onClick={() => setData({ ...data, supportType: opt.id })}
                  >
                    <span className="hc-option-card__icon" aria-hidden="true">
                      {opt.icon}
                    </span>
                    <span className="hc-option-card__text">
                      <span className="hc-option-card__title">{opt.title}</span>
                    </span>
                    {selected && (
                      <span
                        className="hc-option-card__check"
                        aria-hidden="true"
                      >
                        {CHECK_ICON}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hc-step-nav" style={{ justifyContent: "flex-end" }}>
            <button
              type="button"
              className="hc-btn hc-btn--primary"
              disabled={!canContinueStep1}
              onClick={() => setStep(2)}
            >
              Continue →
            </button>
          </div>
        </section>
      )}

      {/* ================= STEP 2 — Timing ================= */}
      {step === 2 && (
        <section className="hc-timing-step" aria-labelledby="hc-timing-heading">
          <div className="hc-topbar">
            <button
              type="button"
              className="hc-back-link"
              onClick={() => setStep(1)}
              disabled={step === 1}
            >
              Steps
            </button>
            <div
              className="hc-stepper"
              role="img"
              aria-label={`Step ${step} of ${STEPS.length}`}
            >
              {STEPS.map((s, idx) => (
                <Fragment key={s}>
                  <div
                    className={`hc-stepper__circle ${step === s ? "is-active" : ""
                      } ${step > s ? "is-done" : ""}`}
                  >
                    {step > s ? CHECK_ICON : s}
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={`hc-stepper__line ${step > s ? "is-filled" : ""
                        }`}
                    />
                  )}
                </Fragment>
              ))}
            </div>
          </div>

          <div className="hc-timing-step__badge">
            ◆ Premium Timeline Scheduler
          </div>
          <h1 id="hc-timing-heading" className="hc-timing-step__title">
            When do you require care?
          </h1>
          <p className="hc-timing-step__subtitle">
            Skip standard calendars. Select your preferred consultation timing
            and we'll instantly match you with an available physician.
          </p>

          <div className="hc-timing-step__grid">
            <div className="hc-timing-col">
              <h2 className="hc-timing-col__heading">Choose Triage Urgency</h2>
              <div className="hc-field" style={{ marginBottom: 16 }}>
                <label htmlFor="hc-date-input" className="hc-field__label">
                  Select Date <span style={{ color: "#e11d48" }}>*</span>
                </label>
                <input
                  id="hc-date-input"
                  type="date"
                  className={`hc-date-input${dateError ? " hc-date-input--err" : ""}`}
                  value={data.date}
                  min={todayStr}
                  onChange={handleDateChange}
                />
                {dateError && <p className="hc-error">{dateError}</p>}
              </div>
              <div
                className="hc-card-grid hc-card-grid--1"
                role="radiogroup"
                aria-label="Triage urgency"
              >
                {URGENCY_OPTIONS.map((opt) => {
                  const selected = data.urgency === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={!data.date}
                      className={`hc-option-card hc-option-card--dark ${selected ? "is-selected" : ""} ${!data.date ? "is-disabled" : ""}`}
                      onClick={() => data.date && setData({ ...data, urgency: opt.id })}
                    >
                      <span className="hc-option-card__icon" aria-hidden="true">
                        {opt.icon}
                      </span>
                      <span className="hc-option-card__text">
                        <span className="hc-option-card__title">
                          {opt.title}
                        </span>
                        {opt.subtitle && (
                          <span className="hc-option-card__subtitle">
                            {opt.subtitle}
                          </span>
                        )}
                      </span>
                      {selected && (
                        <span
                          className="hc-option-card__check"
                          aria-hidden="true"
                        >
                          {CHECK_ICON}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="hc-timing-col">
              <h2 className="hc-timing-col__heading">Select Time Window</h2>
              <div
                className="hc-accordion"
                role="region"
                aria-label="Time windows"
              >
                {TIME_WINDOWS.map((window) => {
                  const isOpen = openWindow === window.id;
                  const hasSelection =
                    data.timeWindow === window.id && data.slot;
                  const disabled = isWindowDisabled(window);
                  return (
                    <div
                      key={window.id}
                      className={`hc-accordion-item ${isOpen ? "is-open" : ""} ${hasSelection ? "has-selection" : ""} ${disabled ? "is-disabled" : ""}`}
                    >
                      <button
                        type="button"
                        className="hc-accordion-item__header"
                        aria-expanded={isOpen}
                        onClick={() => !disabled && toggleWindow(window.id)}
                      >
                        <span
                          className="hc-accordion-item__icon"
                          aria-hidden="true"
                        >
                          {window.icon}
                        </span>
                        <span className="hc-accordion-item__text">
                          <span className="hc-accordion-item__label">
                            {window.label}
                          </span>
                          <span className="hc-accordion-item__range">
                            {window.range}
                          </span>
                        </span>
                        {hasSelection && (
                          <span className="hc-accordion-item__chip">
                            {data.slot}
                          </span>
                        )}
                        <span className="hc-accordion-item__chevron">
                          {CHEVRON_ICON}
                        </span>
                      </button>

                      <div
                        className="hc-accordion-item__panel"
                        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                      >
                        <div className="hc-accordion-item__panel-inner">
                          <div className="hc-slot-grid">
                            {window.slots.map((slot) => {
                              const active =
                                data.slot === slot &&
                                data.timeWindow === window.id;
                              const slotDisabled = isSlotDisabled(slot);
                              return (
                                <button
                                  key={slot}
                                  type="button"
                                  disabled={slotDisabled}
                                  className={`hc-slot ${active ? "is-active" : ""} ${slotDisabled ? "is-disabled" : ""}`}
                                  onClick={() => !slotDisabled && selectSlot(window.id, slot)}
                                  aria-pressed={active}
                                >
                                  {slot}
                                  {active && (
                                    <svg
                                      width="12"
                                      height="12"
                                      viewBox="0 0 14 14"
                                      fill="none"
                                      aria-hidden="true"
                                    >
                                      <path
                                        d="M2.5 7.2L5.5 10.2L11.5 3.8"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="hc-step-nav hc-step-nav--dark">
            <button
              type="button"
              className="hc-btn hc-btn--ghost-dark"
              onClick={() => setStep(1)}
            >
              ← Back
            </button>
            <button
              type="button"
              className="hc-btn hc-btn--primary-dark"
              disabled={!canContinueStep2}
              onClick={handleFinish}
            >
              Book Appointment
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
