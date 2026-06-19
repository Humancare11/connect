// src/pages/AskDoctor.jsx
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./AskDoctor.css";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { uploadFileDirectToS3 } from "../utils/directUpload";

const CATEGORIES = [
  "General", "Heart", "Skin", "Neuro", "Ortho",
  "Dental", "Eyes", "Dizzy", "Mental", "Gut",
];

const MAX_CHARS = 2000;
const QNA_PENDING_KEY = "hcc_qna_pending";
const QNA_RESUME_KEY  = "hcc_qna_submit_after_login";

function readPending() {
  try { return JSON.parse(sessionStorage.getItem(QNA_PENDING_KEY) || "null"); }
  catch { return null; }
}

export default function AskDoctor() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [text, setText]             = useState("");
  const [file, setFile]             = useState(null);
  const [agreed, setAgreed]         = useState(false);
  const [errors, setErrors]         = useState({});
  const [category, setCategory]     = useState("General");
  const [submitted, setSubmitted]   = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [submitStatus, setSubmitStatus] = useState(""); // "uploading" | "submitting"
  const [dragOver, setDragOver]         = useState(false);
  const fileRef = useRef();

  const validate = () => {
    const e = {};
    if (!text.trim()) e.text = "Please describe your question.";
    else if (text.length > MAX_CHARS) e.text = `Maximum ${MAX_CHARS} characters allowed.`;
    if (file && text.trim().split(/\s+/).filter(Boolean).length < 20)
      e.file = "Please write at least 20 words before uploading a file.";
    if (!agreed) e.agreed = "Please accept the Terms and Conditions.";
    return e;
  };

  // questionFile is null when auto-submitting after login (file can't survive redirect)
  const doSubmit = useCallback(async (questionText, questionCategory, questionFile = null) => {
    setSubmitting(true);
    setErrors({});

    let attachments = [];

    if (questionFile) {
      setSubmitStatus("uploading");
      try {
        const uploaded = await uploadFileDirectToS3(questionFile);
        attachments = [{
          key:  uploaded.key,
          url:  uploaded.url || uploaded.key,
          name: uploaded.name || questionFile.name,
          type: uploaded.type || questionFile.type,
          size: uploaded.size || questionFile.size,
        }];
      } catch (uploadErr) {
        setErrors({ file: uploadErr.message || "File upload failed. Please try again." });
        setSubmitting(false);
        setSubmitStatus("");
        return;
      }
    }

    setSubmitStatus("submitting");
    try {
      await api.post("/api/qna/ask", { question: questionText, category: questionCategory, attachments });
      setText("");
      setFile(null);
      setAgreed(false);
      setCategory("General");
      setSubmitted(true);
    } catch (err) {
      setErrors({ text: err.response?.data?.msg || err.message || "Failed to submit. Please try again." });
    } finally {
      setSubmitting(false);
      setSubmitStatus("");
    }
  }, []);

  // Auto-submit after returning from login (file is lost across redirect — text+category only)
  useEffect(() => {
    if (authLoading || !user) return;
    if (sessionStorage.getItem(QNA_RESUME_KEY) !== "1") return;

    const pending = readPending();
    sessionStorage.removeItem(QNA_RESUME_KEY);
    sessionStorage.removeItem(QNA_PENDING_KEY);
    if (!pending?.text) return;

    setText(pending.text);
    setCategory(pending.category || "General");
    setAgreed(true);
    doSubmit(pending.text, pending.category || "General", null);
  }, [authLoading, user, doSubmit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    if (!user) {
      // Save text+category (file cannot be serialised to sessionStorage)
      sessionStorage.setItem(QNA_PENDING_KEY, JSON.stringify({ text, category }));
      sessionStorage.setItem(QNA_RESUME_KEY, "1");
      navigate("/login", { state: { from: "/ask-a-question" } });
      return;
    }

    await doSubmit(text, category, file);
  };

  const addFile = (f) => {
    setFile(f);
    setErrors((p) => ({ ...p, file: undefined }));
  };

  // ── Hero (shared between states) ──────────────────────────────────────────
  const Hero = (
    <div className="ad-hero">
      <div className="ad-hero-inner">
        <span className="ad-hero-badge">Free · Confidential · Fast</span>
        <h1>Ask a Doctor Online</h1>
        <p>Get expert medical answers from verified specialists, delivered within 12 hours.</p>
      </div>
    </div>
  );

  // ── Success screen ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="ad-page">
        {Hero}
        <div className="ad-wrap">
          <div className="ad-success-card">
            <div className="ad-success-check">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="ad-success-title">Question Submitted!</h2>
            <p className="ad-success-body">
              Your question has been received and will be reviewed by a verified doctor within{" "}
              <strong>12 hours</strong>. You'll be notified once an answer is ready.
            </p>
            <Link to="/user/medical-questions" className="ad-success-cta">
              View My Questions →
            </Link>
            <button className="ad-success-again" onClick={() => setSubmitted(false)}>
              Ask Another Question
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <div className="ad-page">
      {Hero}

      {/* Feature highlights */}
      <div className="ad-features">
        {[
          { icon: "🔒", title: "100% Confidential", desc: "Your health data stays private" },
          { icon: "👨‍⚕️", title: "Verified Specialists", desc: "Experts across 20+ departments" },
          { icon: "⚡", title: "12-Hour Response", desc: "Fast answers when you need them" },
        ].map(({ icon, title, desc }) => (
          <div className="ad-feature" key={title}>
            <span className="ad-feature-icon">{icon}</span>
            <div>
              <div className="ad-feature-title">{title}</div>
              <div className="ad-feature-desc">{desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Form */}
      <div className="ad-wrap">
        <div className="ad-form-card">
          <div className="ad-form-header">
            <h2>Describe Your Concern</h2>
            <p>The more detail you provide, the more accurate the medical advice you'll receive.</p>
          </div>

          <form onSubmit={handleSubmit} noValidate>

            {/* Category */}
            <div className="ad-field">
              <label className="ad-label">Category</label>
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

            {/* Question */}
            <div className="ad-field">
              <label className="ad-label">
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
                  placeholder="Describe your symptoms, how long you've had them, any medications you're taking, and relevant medical history…"
                  rows={7}
                />
                <div className={`ad-counter${text.length > MAX_CHARS * 0.9 ? " warn" : ""}`}>
                  {text.length} / {MAX_CHARS}
                </div>
              </div>
              {errors.text && <span className="ad-err-msg">{errors.text}</span>}
            </div>

            {/* File upload */}
            <div className="ad-field">
              <label className="ad-label">
                Upload Medical Reports <span className="ad-opt">(optional)</span>
              </label>
              <div
                className={`ad-upload-box${errors.file ? " err" : ""}${dragOver ? " over" : ""}${file ? " has-file" : ""}`}
                onClick={() => fileRef.current.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files[0]) addFile(e.dataTransfer.files[0]);
                }}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  style={{ display: "none" }}
                  onChange={(e) => { if (e.target.files[0]) addFile(e.target.files[0]); }}
                />
                {file ? (
                  <div className="ad-file-info">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0C8B7A" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span>{file.name}</span>
                    <button
                      type="button"
                      className="ad-file-remove"
                      onClick={(ev) => { ev.stopPropagation(); setFile(null); }}
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="ad-upload-icon-svg">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span className="ad-upload-main">Drag & drop or <em>browse</em></span>
                    <span className="ad-upload-sub">JPG, PNG, PDF · Max 10 MB</span>
                  </>
                )}
              </div>
              {errors.file && <span className="ad-err-msg">{errors.file}</span>}
            </div>

            {/* Terms */}
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
                <span className="ad-checkmark" />
                I agree to the{" "}
                <Link to="/terms" target="_blank" rel="noreferrer">Terms and Conditions</Link>
                {" "}and{" "}
                <Link to="/privacy" target="_blank" rel="noreferrer">Privacy Policy</Link>
              </label>
              {errors.agreed && <span className="ad-err-msg">{errors.agreed}</span>}
            </div>

            {/* Login notice for guests */}
            {!user && (
              <div className="ad-login-notice">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                You're not signed in — you'll be asked to log in before your question is submitted.
              </div>
            )}

            <button type="submit" className="ad-submit-btn" disabled={submitting}>
              {submitting ? (
                <>
                  <span className="ad-spinner" />
                  {submitStatus === "uploading" ? "Uploading file…" : "Submitting…"}
                </>
              ) : (
                "Submit Your Question →"
              )}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}
