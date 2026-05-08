// src/pages/AskDoctor.jsx
import { useState, useRef, useEffect, useCallback } from "react";
import "./AskDoctor.css";
import api from "../api";
import { useAuth } from "../context/AuthContext";

const CATEGORIES = [
  "General",
  "Heart",
  "Skin",
  "Neuro",
  "Ortho",
  "Dental",
  "Eyes",
  "Dizzy",
  "Mental",
  "Gut",
];

const CATEGORY_META = {
  General: { bg: "#EEF2FF", text: "#4338CA" },
  Heart: { bg: "#FEF2F2", text: "#DC2626" },
  Skin: { bg: "#FFF7ED", text: "#C2410C" },
  Neuro: { bg: "#F5F3FF", text: "#7C3AED" },
  Ortho: { bg: "#F0FDF4", text: "#16A34A" },
  Dental: { bg: "#ECFDF5", text: "#059669" },
  Eyes: { bg: "#EFF6FF", text: "#2563EB" },
  Dizzy: { bg: "#FEF9C3", text: "#B45309" },
  Mental: { bg: "#FDF4FF", text: "#A21CAF" },
  Gut: { bg: "#F0FDF4", text: "#15803D" },
};

const PER_PAGE = 4;
const MAX_CHARS = 2000;

const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/* ── icons ── */
const IconClock = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" strokeLinecap="round" />
  </svg>
);
const IconCheckWhite = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="white"
    strokeWidth="3"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconDoc = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const IconCal = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IconUpload = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);
const IconChevLeft = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
  >
    <path d="M15 18l-6-6 6-6" strokeLinecap="round" />
  </svg>
);
const IconChevRight = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
  >
    <path d="M9 18l6-6-6-6" strokeLinecap="round" />
  </svg>
);

export default function AskDoctor() {
  const { user } = useAuth();
  const isLoggedIn = !!user;

  const [questions, setQuestions] = useState([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState({});
  const [category, setCategory] = useState("General");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const fileRef = useRef();

  // ── fetch questions ──
  const fetchQuestions = useCallback(() => {
    api
      .get("/api/qna")
      .then((res) => {
        const data = res.data;
        setQuestions(
          Array.isArray(data) ? data : (data.questions ?? data.data ?? []),
        );
      })
      .catch((err) => console.error("Failed to fetch questions:", err));
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // ── validation ──
  const validate = () => {
    const e = {};
    if (!text.trim()) e.text = "Please enter your question.";
    else if (text.length > MAX_CHARS)
      e.text = `Maximum ${MAX_CHARS} characters allowed.`;
    if (file && text.trim().split(/\s+/).filter(Boolean).length < 20)
      e.file =
        "Please describe your problem in at least 20 words before uploading a file.";
    if (!agreed) e.agreed = "Please agree to the Terms and Conditions.";
    return e;
  };

  // ── submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLoggedIn) {
      setErrors({ text: "You must be logged in to ask a question." });
      return;
    }
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post("/api/qna/ask", { question: text, category });
      setQuestions((prev) => [res.data, ...prev]);
      setText("");
      setFile(null);
      setAgreed(false);
      setErrors({});
      setCategory("General");
      setCurrentPage(1);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 8000);
    } catch (err) {
      setErrors({
        text: err.response?.data?.msg || "Failed to submit. Please try again.",
      });
    }
    setSubmitting(false);
  };

  // ── pagination ──
  const totalPages = Math.max(1, Math.ceil(questions.length / PER_PAGE));
  const visible = questions.slice(
    (currentPage - 1) * PER_PAGE,
    currentPage * PER_PAGE,
  );
  const goPage = (p) => {
    if (p >= 1 && p <= totalPages) setCurrentPage(p);
  };
  const pageNumbers = () => {
    if (totalPages <= 5)
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    const arr = [1];
    if (currentPage > 3) arr.push("…");
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    )
      arr.push(i);
    if (currentPage < totalPages - 2) arr.push("…");
    arr.push(totalPages);
    return arr;
  };

  return (
    <div className="ad-page">
      {/* hero */}
      <div className="ad-hero">
        <div className="ad-hero-inner">
          <h1>Ask a Doctor Online</h1>
          <p>
            Get answers from verified specialists across 20+ departments — free,
            fast, confidential.
          </p>
        </div>
      </div>

      <div className="ad-layout">
        {/* ══ LEFT ══ */}
        <div className="ad-left">
          <div className="ad-form-card">
            <div className="ad-form-header">
              <h2>Ask Free Doctor Online</h2>
              <p>Describe your problem clearly for the best medical advice</p>
            </div>

            {/* success banner */}
            {submitted && (
              <div className="ad-success-banner">
                <div className="ad-success-icon">
                  <IconCheckWhite />
                </div>
                <div>
                  <div className="ad-success-title">
                    Question submitted successfully!
                  </div>
                  <div className="ad-success-sub">
                    Your question has been received. A verified doctor will
                    answer it within <strong>12 hours</strong>. Track the status
                    in your{" "}
                    <a
                      href="/user/medical-questions"
                      style={{ color: "#fff", textDecoration: "underline" }}
                    >
                      Medical Questions
                    </a>{" "}
                    dashboard.
                  </div>
                </div>
              </div>
            )}

            {/* login gate */}
            {!isLoggedIn && (
              <div
                style={{
                  background: "#fef3c7",
                  border: "1px solid #fcd34d",
                  borderRadius: 10,
                  padding: "12px 16px",
                  marginBottom: 16,
                  fontSize: 14,
                  color: "#92400e",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 18 }}>🔒</span>
                <span>
                  You must{" "}
                  <a
                    href="/login"
                    style={{ color: "#b45309", fontWeight: 600 }}
                  >
                    log in
                  </a>{" "}
                  to ask a question.
                </span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              {/* category */}
              <div className="ad-field">
                <label>Category</label>
                <div className="ad-cat-grid">
                  {CATEGORIES.map((c) => (
                    <button
                      type="button"
                      key={c}
                      className={`ad-cat-chip${category === c ? " active" : ""}`}
                      onClick={() => setCategory(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* question */}
              <div className="ad-field">
                <label>
                  Your Question <span className="ad-req">*</span>
                </label>
                <div className={`ad-textarea-wrap${errors.text ? " err" : ""}`}>
                  <textarea
                    value={text}
                    onChange={(e) => {
                      if (e.target.value.length <= MAX_CHARS) {
                        setText(e.target.value);
                        setErrors((p) => ({ ...p, text: undefined }));
                      }
                    }}
                    placeholder="Describe your symptoms, duration, and any relevant medical history…"
                    rows={6}
                  />
                  <div
                    className={`ad-counter${text.length > MAX_CHARS * 0.9 ? " warn" : ""}`}
                  >
                    {text.length}/{MAX_CHARS}
                  </div>
                </div>
                {errors.text && (
                  <span className="ad-err-msg">{errors.text}</span>
                )}
              </div>

              {/* file upload */}
              <div className="ad-field">
                <label>
                  Upload Medical Reports{" "}
                  <span className="ad-opt">(optional)</span>
                </label>
                <div
                  className={`ad-upload-box${errors.file ? " err" : ""}${file ? " has-file" : ""}`}
                  onClick={() => fileRef.current.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files[0];
                    if (f) {
                      setFile(f);
                      setErrors((p) => ({ ...p, file: undefined }));
                    }
                  }}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (e.target.files[0]) {
                        setFile(e.target.files[0]);
                        setErrors((p) => ({ ...p, file: undefined }));
                      }
                    }}
                  />
                  {file ? (
                    <div className="ad-file-info">
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#0C8B7A"
                        strokeWidth="2"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span>{file.name}</span>
                      <button
                        type="button"
                        className="ad-file-remove"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setFile(null);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <>
                      <IconUpload />
                      <span className="ad-upload-main">
                        Drag & drop or <em>browse</em>
                      </span>
                      <span className="ad-upload-sub">
                        JPG, PNG, PDF · Max 10MB · Min 20 words required
                      </span>
                    </>
                  )}
                </div>
                {errors.file && (
                  <span className="ad-err-msg">{errors.file}</span>
                )}
              </div>

              {/* checkbox */}
              <div className={`ad-checkbox-wrap${errors.agreed ? " err" : ""}`}>
                <label className="ad-checkbox">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => {
                      setAgreed(e.target.checked);
                      setErrors((p) => ({ ...p, agreed: undefined }));
                    }}
                  />
                  <span className="ad-checkmark" />I agree to the{" "}
                  <a href="#">Terms and Conditions</a>
                </label>
                {errors.agreed && (
                  <span className="ad-err-msg">{errors.agreed}</span>
                )}
              </div>

              {/* submit button */}
              <button
                type="submit"
                className="ad-submit-btn"
                disabled={submitting || !isLoggedIn}
              >
                {submitting
                  ? "Submitting…"
                  : !isLoggedIn
                    ? "Log in to Ask →"
                    : "Ask Doctor Now →"}
              </button>
            </form>
          </div>

          {/* trust bar */}
          <div className="ad-trust">
            {[
              ["🔒", "100% Confidential"],
              ["✅", "Verified Doctors"],
              ["⚡", "Fast Response"],
            ].map(([icon, label]) => (
              <div className="ad-trust-item" key={label}>
                <span>{icon}</span>
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* ══ RIGHT — questions list ══ */}
        <div className="ad-right">
          <div className="ad-right-header">
            <h2>Recent Questions</h2>
            <span className="ad-count">{questions.length} questions</span>
          </div>

          <div className="ad-qlist">
            {visible.length === 0 && (
              <div className="ad-empty">
                No questions yet. Be the first to ask!
              </div>
            )}
            {visible.map((q, i) => {
              const col = CATEGORY_META[q.category] || CATEGORY_META.General;
              const expanded = expandedId === q._id;
              return (
                <div
                  className="ad-qcard"
                  key={q._id}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="ad-qcard-top">
                    <span
                      className="ad-cat-badge"
                      style={{ background: col.bg, color: col.text }}
                    >
                      {q.category}
                    </span>
                    <span
                      className={`ad-status-badge ${q.answered ? "answered" : "pending"}`}
                    >
                      {q.answered ? "Answered" : "Pending"}
                    </span>
                    <span className="ad-qdate">
                      <IconCal /> {formatDate(q.createdAt)}
                    </span>
                  </div>

                  <p className="ad-qtext">
                    {expanded
                      ? q.question
                      : q.question.slice(0, 130) +
                        (q.question.length > 130 ? "…" : "")}
                  </p>

                  {q.answered && q.doctor?.name && (
                    <div className="ad-doctor-row">
                      <div
                        className="ad-doctor-avatar"
                        style={{ background: col.bg, color: col.text }}
                      >
                        {q.doctor.name.split(" ").pop()[0]}
                      </div>
                      <div>
                        <div className="ad-doctor-name">
                          <IconDoc /> {q.doctor.name}
                        </div>
                        <div className="ad-doctor-spec">
                          {q.doctor.specialization}
                        </div>
                      </div>
                    </div>
                  )}

                  {q.answered && q.answer ? (
                    <div className="ad-answer">
                      <div className="ad-answer-label">Doctor's Answer</div>
                      <p>
                        {expanded
                          ? q.answer
                          : q.answer.slice(0, 100) +
                            (q.answer.length > 100 ? "…" : "")}
                      </p>
                    </div>
                  ) : (
                    <div className="ad-pending">
                      <IconClock /> Our experts will respond within 12 hours
                    </div>
                  )}

                  <div className="ad-qcard-actions">
                    <button
                      className="ad-read-btn"
                      onClick={() => setExpandedId(expanded ? null : q._id)}
                    >
                      {expanded ? "Show Less" : "Read More"}
                    </button>
                    <button className="ad-consult-btn">Consult Now</button>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="ad-pagination">
              <button
                className="ad-pg-btn ad-pg-nav"
                onClick={() => goPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <IconChevLeft /> Prev
              </button>
              {pageNumbers().map((p, i) =>
                p === "…" ? (
                  <span key={`e${i}`} className="ad-pg-ellipsis">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    className={`ad-pg-btn${currentPage === p ? " active" : ""}`}
                    onClick={() => goPage(p)}
                  >
                    {p}
                  </button>
                ),
              )}
              <button
                className="ad-pg-btn ad-pg-nav"
                onClick={() => goPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next <IconChevRight />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
