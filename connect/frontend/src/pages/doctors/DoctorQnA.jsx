import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import "./DoctorQnA.css";
import api from "../../api";
import { useDoctorAuth } from "../../context/DoctorAuthContext";

const CATEGORY_META = {
  General: { bg: "#EEF2FF", text: "#4338CA" },
  Heart:   { bg: "#FEF2F2", text: "#DC2626" },
  Skin:    { bg: "#FFF7ED", text: "#C2410C" },
  Neuro:   { bg: "#F5F3FF", text: "#7C3AED" },
  Ortho:   { bg: "#F0FDF4", text: "#16A34A" },
  Dental:  { bg: "#ECFDF5", text: "#059669" },
  Eyes:    { bg: "#EFF6FF", text: "#2563EB" },
  Dizzy:   { bg: "#FEF9C3", text: "#B45309" },
  Mental:  { bg: "#FDF4FF", text: "#A21CAF" },
  Gut:     { bg: "#F0FDF4", text: "#15803D" },
};

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function AnswerModal({ question, doctorName, doctorSpec, onClose, onSubmit }) {
  const [answer, setAnswer] = useState(question.answer || "");
  const [submitting, setSubmitting] = useState(false);
  const isAlreadyAnswered = question.status === "answered";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!answer.trim()) return;
    setSubmitting(true);
    await onSubmit(question._id, answer.trim());
    setSubmitting(false);
  };

  return (
    <div className="dq-modal-overlay" onClick={onClose}>
      <div className="dq-modal" onClick={e => e.stopPropagation()}>
        <div className="dq-modal-header">
          <h3 className="dq-modal-title">
            {isAlreadyAnswered ? "Your Answer (Submitted)" : "Submit Answer"}
          </h3>
          <button className="dq-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="dq-modal-body">
          <div className="dq-modal-question">
            <div className="dq-modal-q-label">Patient's Question</div>
            <p className="dq-modal-q-text">{question.question}</p>
          </div>

          {isAlreadyAnswered && (
            <div className="dq-modal-status-note">
              <span>🔍</span>
              <p>Your answer is under admin review. It will be published once approved.</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <label className="dq-modal-label">
              {isAlreadyAnswered ? "Your submitted answer" : "Write your answer"}
            </label>
            <textarea
              className="dq-modal-textarea"
              rows={6}
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="Provide a clear, detailed answer based on the patient's description…"
              maxLength={3000}
              required
              readOnly={isAlreadyAnswered}
            />
            <div className="dq-modal-footer">
              <span className="dq-modal-charcount">{answer.length}/3000</span>
              {!isAlreadyAnswered && (
                <button
                  type="submit"
                  className="dq-modal-submit"
                  disabled={submitting || !answer.trim()}
                >
                  {submitting ? "Submitting…" : "Submit Answer →"}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function QuestionCard({ q, onAnswer, isFocused }) {
  const col = CATEGORY_META[q.category] || CATEGORY_META.General;
  const isAnswered = q.status === "answered";

  return (
    <div
      id={`qcard-${q._id}`}
      className={`dq-card ${isAnswered ? "dq-card--answered" : ""} ${isFocused ? "dq-card--focused" : ""}`}
    >
      <div className="dq-card-top">
        <span className="dq-cat-badge" style={{ background: col.bg, color: col.text }}>{q.category}</span>
        <span className={`dq-status-badge ${isAnswered ? "dq-status-badge--answered" : "dq-status-badge--assigned"}`}>
          {isAnswered ? "🔍 Under Review" : "⏳ Awaiting Answer"}
        </span>
        <span className="dq-date">{formatDate(q.createdAt)}</span>
      </div>

      <p className="dq-question-text">{q.question}</p>

      {q.user?.name && (
        <div className="dq-patient-info">
          <span className="dq-patient-icon">👤</span>
          <span className="dq-patient-name">Patient: {q.user.name}</span>
        </div>
      )}

      <div className="dq-card-footer">
        <button
          className={`dq-answer-btn ${isAnswered ? "dq-answer-btn--view" : ""}`}
          onClick={() => onAnswer(q)}
        >
          {isAnswered ? "View Submitted Answer" : "Write Answer →"}
        </button>
      </div>
    </div>
  );
}

export default function DoctorQnA() {
  const { doctor }  = useDoctorAuth();
  const location    = useLocation();
  const [questions, setQuestions] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState("all");
  const [selected,  setSelected]  = useState(null);
  const [focusedId, setFocusedId] = useState("");
  const [toast,     setToast]     = useState(null);

  useEffect(() => { fetchQuestions(); }, []);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/qna/doctor/assigned");
      setQuestions(res.data);
    } catch (err) {
      console.error("Failed to fetch assigned questions:", err);
    } finally {
      setLoading(false);
    }
  };

  /* Deep-link: ?activityId=<id> — scroll to card and open its modal */
  useEffect(() => {
    const activityId = new URLSearchParams(location.search).get("activityId");
    if (!activityId || questions.length === 0) { setFocusedId(""); return; }

    const target = questions.find((q) => q._id === activityId);
    if (!target) { setFocusedId(""); return; }

    setFocusedId(activityId);
    setFilter("all");
    setSelected(target);

    setTimeout(() => {
      document.getElementById(`qcard-${activityId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  }, [questions, location.search]);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  };

  const submitAnswer = async (qId, answer) => {
    try {
      await api.put(`/api/qna/${qId}/answer`, {
        answer,
        doctorName: doctor?.name || "",
        doctorSpec: doctor?.specialty || "",
      });
      showToast("Answer submitted! Admin will review and publish it.", true);
      setSelected(null);
      fetchQuestions();
    } catch (err) {
      showToast(err.response?.data?.msg || "Failed to submit answer.", false);
    }
  };

  const pending  = questions.filter(q => q.status === "assigned");
  const answered = questions.filter(q => q.status === "answered");
  const displayed = filter === "all" ? questions : filter === "pending" ? pending : answered;

  return (
    <div className="dq-root">
      {toast && (
        <div className={`dq-toast ${toast.ok ? "dq-toast--ok" : "dq-toast--err"}`}>
          <span>{toast.ok ? "✓" : "!"}</span> {toast.msg}
        </div>
      )}

      {selected && (
        <AnswerModal
          question={selected}
          doctorName={doctor?.name || ""}
          doctorSpec={doctor?.specialty || ""}
          onClose={() => setSelected(null)}
          onSubmit={submitAnswer}
        />
      )}

      <div className="dq-header">
        <span className="dq-eyebrow">Doctor Portal</span>
        <h1 className="dq-title">Medical Q&amp;A</h1>
        <p className="dq-sub">Answer patient questions assigned to you. Answers go to admin review before being published.</p>
      </div>

      {/* Stats */}
      <div className="dq-stats">
        <div className="dq-stat">
          <div className="dq-stat-value">{questions.length}</div>
          <div className="dq-stat-label">Total Assigned</div>
        </div>
        <div className="dq-stat dq-stat--warn">
          <div className="dq-stat-value">{pending.length}</div>
          <div className="dq-stat-label">Awaiting Answer</div>
        </div>
        <div className="dq-stat dq-stat--ok">
          <div className="dq-stat-value">{answered.length}</div>
          <div className="dq-stat-label">Under Review</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="dq-tabs">
        {[
          { key: "all",     label: "All",           count: questions.length },
          { key: "pending", label: "Needs Answer",   count: pending.length },
          { key: "answered",label: "Under Review",   count: answered.length },
        ].map(t => (
          <button
            key={t.key}
            className={`dq-tab ${filter === t.key ? "dq-tab--active" : ""}`}
            onClick={() => setFilter(t.key)}
          >
            {t.label}
            <span className="dq-tab-count">{t.count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="dq-loading"><div className="dq-spinner" /><p>Loading assigned questions…</p></div>
      ) : displayed.length === 0 ? (
        <div className="dq-empty">
          <div className="dq-empty-icon">🩺</div>
          <h3>{filter === "all" ? "No questions assigned yet" : `No ${filter === "pending" ? "unanswered" : "under-review"} questions`}</h3>
          <p>{filter === "all" ? "The admin will assign patient questions to you. Check back soon." : "Nothing in this category right now."}</p>
        </div>
      ) : (
        <div className="dq-list">
          {displayed.map(q => (
            <QuestionCard key={q._id} q={q} onAnswer={setSelected} isFocused={focusedId === q._id} />
          ))}
        </div>
      )}
    </div>
  );
}
