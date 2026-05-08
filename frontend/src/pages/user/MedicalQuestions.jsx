import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import "./MedicalQuestions.css";
import api from "../../api";
import { notifyUserActivityUpdated } from "../../utils/activityEvents";

const CATEGORY_META = {
  General:      { bg: "#EEF2FF", text: "#4338CA" },
  Heart:        { bg: "#FEF2F2", text: "#DC2626" },
  Skin:         { bg: "#FFF7ED", text: "#C2410C" },
  Neuro:        { bg: "#F5F3FF", text: "#7C3AED" },
  Ortho:        { bg: "#F0FDF4", text: "#16A34A" },
  Dental:       { bg: "#ECFDF5", text: "#059669" },
  Eyes:         { bg: "#EFF6FF", text: "#2563EB" },
  Mental:       { bg: "#FDF4FF", text: "#A21CAF" },
  Gut:          { bg: "#F0FDF4", text: "#15803D" },
  Lungs:        { bg: "#F0F9FF", text: "#0369A1" },
  Kidney:       { bg: "#FFF1F2", text: "#BE123C" },
  Liver:        { bg: "#FEFCE8", text: "#A16207" },
  ENT:          { bg: "#F0FDFA", text: "#0F766E" },
  Diabetes:     { bg: "#FFF7ED", text: "#EA580C" },
  Pediatrics:   { bg: "#FDF4FF", text: "#9333EA" },
  Gynecology:   { bg: "#FFF0F3", text: "#E11D48" },
  Urology:      { bg: "#F0F4FF", text: "#3730A3" },
  Oncology:     { bg: "#F8F4FF", text: "#4F46E5" },
  Allergy:      { bg: "#FFF9F0", text: "#D97706" },
  Rheumatology: { bg: "#F9F0FF", text: "#7E22CE" },
  Endocrine:    { bg: "#F0FFF4", text: "#065F46" },
  Dizzy:        { bg: "#FEF9C3", text: "#B45309" },
  Vascular:     { bg: "#FFF5F5", text: "#9F1239" },
};

const ALL_CATEGORIES = [
  "General", "Heart", "Skin", "Neuro", "Ortho", "Dental", "Eyes", "Mental",
  "Gut", "Lungs", "Kidney", "Liver", "ENT", "Diabetes", "Pediatrics",
  "Gynecology", "Urology", "Oncology", "Allergy", "Rheumatology", "Endocrine", "Dizzy", "Vascular",
];
const PRIMARY_COUNT = 8;

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function AttachmentChip({ file, onRemove }) {
  const isImage = file.type?.startsWith("image/");
  return (
    <div className="mq-attach-chip">
      <span>{isImage ? "🖼" : "📄"}</span>
      <span className="mq-attach-name" title={file.name}>{file.name}</span>
      {file.size > 0 && <span className="mq-attach-size">{formatFileSize(file.size)}</span>}
      {onRemove && (
        <button type="button" className="mq-attach-remove" onClick={onRemove} title="Remove">×</button>
      )}
    </div>
  );
}

function QuestionCard({ q, isFocused }) {
  const col       = CATEGORY_META[q.category] || CATEGORY_META.General;
  const hasAnswer = (q.status === "approved" || q.status === "answered") && q.answer;

  return (
    <div id={`question-${q._id}`} className={`mq-card ${isFocused ? "mq-card--focused" : ""}`}>
      {/* Card meta row */}
      <div className="mq-card-header">
        <div className="mq-card-top-row">
          <span className="mq-cat-badge" style={{ background: col.bg, color: col.text }}>{q.category}</span>
          <span className="mq-date">{formatDate(q.createdAt)}</span>
        </div>
        <p className="mq-question-text">{q.question}</p>
      </div>

      <div className="mq-card-body">
     

        {/* Attachments */}
        {q.attachments?.length > 0 && (
          <div className="mq-attach-list mq-attach-list--display">
            <span className="mq-attach-list-label">📎 Attached files</span>
            {q.attachments.map((f, i) => (
              <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className="mq-attach-chip mq-attach-chip--link">
                <span>{f.type?.startsWith("image/") ? "🖼" : "📄"}</span>
                <span className="mq-attach-name" title={f.name}>{f.name}</span>
              </a>
            ))}
          </div>
        )}

        {/* Answer */}
        {hasAnswer && (
          <div className="mq-answer-block">
            <div className="mq-answer-label">
              {q.doctor?.name && (
                <span className="mq-answer-doctor">
                  Dr. {q.doctor.name}{q.doctor.specialization ? `, ${q.doctor.specialization}` : ""}
                </span>
              )}
              <span>Doctor's Answer</span>
            </div>
            <p className="mq-answer-text">{q.answer}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MedicalQuestions() {
  const location     = useLocation();
  const textareaRef  = useRef(null);
  const fileInputRef = useRef(null);

  const [questions,    setQuestions]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [text,         setText]         = useState("");
  const [category,     setCategory]     = useState("General");
  const [showMoreCats, setShowMoreCats] = useState(false);
  const [attachments,  setAttachments]  = useState([]);
  const [uploading,    setUploading]    = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [toast,        setToast]        = useState(null);
  const [filter,       setFilter]       = useState("all");
  const [focusedQuestionId, setFocusedQuestionId] = useState("");

  const visibleCategories = showMoreCats ? ALL_CATEGORIES : ALL_CATEGORIES.slice(0, PRIMARY_COUNT);

  useEffect(() => { fetchQuestions(); }, []);

  const fetchQuestions = async () => {
    try {
      const res = await api.get("/api/qna/user-questions");
      setQuestions(res.data);
    } catch (err) {
      console.error("Failed to fetch questions:", err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  };

  const autoResize = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 420) + "px";
    }
  };

  const handleTextChange = (e) => {
    setText(e.target.value);
    autoResize();
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (attachments.length >= 3) {
      showToast("Maximum 3 attachments allowed.", false);
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/api/upload", formData);
      setAttachments(prev => [...prev, res.data]);
    } catch (err) {
      showToast(err.response?.data?.msg || "Failed to upload file.", false);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const submitQuestion = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post("/api/qna/ask", { question: text, category, attachments });
      setText("");
      setCategory("General");
      setAttachments([]);
      setShowMoreCats(false);
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      showToast("Question submitted! A doctor will answer within 12 hours.", true);
      notifyUserActivityUpdated({ source: "question", id: res.data?._id });
      fetchQuestions();
    } catch (err) {
      showToast(err.response?.data?.msg || "Failed to submit. Please try again.", false);
    } finally {
      setSubmitting(false);
    }
  };

  const counts = {
    all:      questions.length,
    pending:  questions.filter(q => q.status === "pending").length,
    // assigned: questions.filter(q => q.status === "assigned").length,
    answered: questions.filter(q => q.status === "answered" || q.status === "approved").length,
  };

  useEffect(() => {
    const params     = new URLSearchParams(location.search);
    const activityId = params.get("activityId");

    if (!activityId || questions.length === 0) { setFocusedQuestionId(""); return; }

    const target = questions.find((q) => q._id === activityId);
    if (!target) { setFocusedQuestionId(""); return; }

    setFocusedQuestionId(activityId);
    const statusFilter = (target.status === "approved" || target.status === "answered") ? "answered" : target.status;
    setFilter(statusFilter);

    setTimeout(() => {
      document.getElementById(`question-${activityId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 40);
  }, [questions, location.search]);

  const displayed =
    filter === "all"      ? questions :
    filter === "answered" ? questions.filter(q => q.status === "answered" || q.status === "approved") :
                            questions.filter(q => q.status === filter);

  return (
    <div className="mq-root">
      {toast && (
        <div className={`mq-toast ${toast.ok ? "mq-toast--ok" : "mq-toast--err"}`}>
          <span>{toast.ok ? "✓" : "!"}</span> {toast.msg}
        </div>
      )}

      <div className="mq-header">
        <span className="mq-eyebrow">HumaniCare</span>
        <h1 className="mq-title">Medical Questions</h1>
        <p className="mq-sub">Ask a question and get a verified doctor's answer within 12 hours.</p>
      </div>

      <div className="mq-body">
        {/* ── Left column: Ask form ── */}
        <div className="mq-left-col">
          <div className="mq-form-card">
            <h2 className="mq-form-title">Ask a New Question</h2>
            <form onSubmit={submitQuestion}>

              {/* Specialty selector */}
              <div className="mq-cat-section">
                <div className="mq-cat-label">Select Specialty</div>
                <div className="mq-cat-row">
                  {visibleCategories.map(c => {
                    const col = CATEGORY_META[c] || CATEGORY_META.General;
                    return (
                      <button
                        key={c} type="button"
                        className={`mq-cat-chip ${category === c ? "mq-cat-chip--active" : ""}`}
                        style={category === c ? { background: col.text, color: "#fff", borderColor: col.text } : {}}
                        onClick={() => setCategory(c)}
                      >{c}</button>
                    );
                  })}
                  <button
                    type="button"
                    className="mq-cat-more-btn"
                    onClick={() => setShowMoreCats(p => !p)}
                  >
                    {showMoreCats ? "Show Less ↑" : `More +${ALL_CATEGORIES.length - PRIMARY_COUNT}`}
                  </button>
                </div>
              </div>

              {/* Auto-resizing textarea */}
              <textarea
                ref={textareaRef}
                className="mq-textarea"
                placeholder="Describe your symptoms, medical history, and what you'd like to know…"
                value={text}
                onChange={handleTextChange}
                maxLength={2000}
                required
              />

              {/* Attachment */}
              <div className="mq-attach-area">
                <input
                  ref={fileInputRef}
                  type="file"
                  id="mq-file-input"
                  className="mq-file-input"
                  accept="image/*,.pdf,.doc,.docx,.txt"
                  onChange={handleFileSelect}
                  disabled={uploading || attachments.length >= 3}
                />
                <label
                  htmlFor="mq-file-input"
                  className={`mq-attach-zone${uploading ? " mq-attach-zone--uploading" : ""}${attachments.length >= 3 ? " mq-attach-zone--disabled" : ""}`}
                >
                  <span className="mq-attach-icon">{uploading ? "⏳" : "📎"}</span>
                  <div className="mq-attach-text">
                    <span className="mq-attach-main">{uploading ? "Uploading…" : "Attach a file"}</span>
                    <span className="mq-attach-hint">Images, PDF, Word · max 10 MB · up to 3 files</span>
                  </div>
                </label>
                {attachments.length > 0 && (
                  <div className="mq-attach-list">
                    {attachments.map((f, i) => (
                      <AttachmentChip key={i} file={f} onRemove={() => removeAttachment(i)} />
                    ))}
                  </div>
                )}
              </div>

              <div className="mq-form-footer">
                <span className="mq-char-count">{text.length}/2000</span>
                <button
                  className="mq-submit-btn"
                  type="submit"
                  disabled={submitting || !text.trim() || uploading}
                >
                  {submitting ? "Submitting…" : "Submit Question →"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ── Right column: Questions list ── */}
        <div className="mq-right-col">
          <div className="mq-tabs">
            {[
              { key: "all",      label: "All" },
              { key: "pending",  label: "Pending" },
              // { key: "assigned", label: "Assigned" },
              { key: "answered", label: "Answered" },
            ].map(t => (
              <button
                key={t.key}
                className={`mq-tab ${filter === t.key ? "mq-tab--active" : ""}`}
                onClick={() => setFilter(t.key)}
              >
                {t.label}
                <span className="mq-tab-count">{counts[t.key]}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="mq-loading"><div className="mq-spinner" /><p>Loading your questions…</p></div>
          ) : displayed.length === 0 ? (
            <div className="mq-empty">
              <div className="mq-empty-icon">❓</div>
              <h3>{filter === "all" ? "No questions yet" : `No ${filter} questions`}</h3>
              <p>{filter === "all" ? "Submit your first question — a verified doctor will answer within 12 hours." : "No questions with this status."}</p>
            </div>
          ) : (
            <div className="mq-list">
              {displayed.map((q) => (
                <QuestionCard
                  key={q._id}
                  q={q}
                  isFocused={q._id === focusedQuestionId}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
