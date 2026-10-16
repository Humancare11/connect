import { useState } from "react";

// Step 1, shown before ANY chat (AI or live agent): name and email are required, phone is optional.
// Protected by a honeypot field that real people never see.
const EMAIL_RE = /^\S+@\S+\.\S{2,}$/;

function validate({ name, email, phone }) {
  const errors = {};
  if (name.trim().length < 2) errors.name = "Please enter your full name.";
  if (!EMAIL_RE.test(email.trim())) errors.email = "Please enter a valid email, like you@example.com.";
  if (phone.trim()) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) {
      errors.phone = "That phone number doesn't look right. Include the country code, or leave it empty.";
    }
  }
  return errors;
}

// Where "Privacy Policy" points: the website-chat section of the policy.
const PRIVACY_URL = "/privacy-policy#website-chat";

export default function ContactForm({ onSubmit, aiName, reply = false, showNotice = false }) {
  const [values, setValues] = useState({ name: "", email: "", phone: "" });
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  // Typing in a field clears that field's old error.
  const change = (field) => (event) => {
    setValues((v) => ({ ...v, [field]: event.target.value }));
    setErrors((e) => (e[field] || e.form ? { ...e, [field]: undefined, form: undefined } : e));
  };

  const submit = async (event) => {
    event.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length) return;
    // The hidden field was filled (browser autofill or a bot): clear it and ask to try again. A second submit goes
    // through, because the field is empty now.
    if (honeypot.trim() !== "") {
      setHoneypot("");
      setErrors({ form: "Please try again." });
      return;
    }

    setBusy(true);
    const result = await onSubmit({
      name: values.name.trim(),
      email: values.email.trim(),
      phone: values.phone.trim(),
      hcRefNote: honeypot,
      aiNoticeAccepted: showNotice, // pressing Start chat is the acceptance: no checkbox
    });
    setBusy(false);
    if (!result.ok) {
      setHoneypot(""); // whatever happened, the next attempt starts with the hidden field empty
      setErrors(result.errors || {});
    }
  };

  const firstError = errors.form || errors.name || errors.email || errors.phone;

  return (
    <form className="lcw-cform" onSubmit={submit} noValidate>
      <h3>{reply ? "Reply to Humancare Connect" : "Welcome to Humancare Connect 👋"}</h3>
      <p>
        {reply
          ? "Please share a few details so we can pass your reply on. You'll then see the message from our team."
          : `Please share a few details so we can help you. You'll then chat with ${aiName}, or with a live agent anytime.`}
      </p>

      <label>
        Full name *
        <input value={values.name} onChange={change("name")} autoComplete="name" placeholder="e.g. Emma Wilson" maxLength={80} aria-invalid={Boolean(errors.name)} />
      </label>
      <label>
        Email *
        <input type="email" value={values.email} onChange={change("email")} autoComplete="email" placeholder="you@example.com" maxLength={254} aria-invalid={Boolean(errors.email)} />
      </label>
      <label>
        Phone <span>(optional)</span>
        <input type="tel" inputMode="tel" value={values.phone} onChange={change("phone")} autoComplete="tel" placeholder="+1 302 303 9993" maxLength={24} aria-invalid={Boolean(errors.phone)} />
      </label>

      {/* Honeypot: off-screen, hidden from assistive tech and out of the tab order. The name, id, label and autocomplete
          token are deliberately neutral so browsers and password managers have nothing to autofill. */}
      <div className="lcw-hp" aria-hidden="true">
        <label htmlFor="hc-ref-note">
          Leave this empty
          <input
            id="hc-ref-note"
            name="hc_ref_note"
            type="text"
            tabIndex={-1}
            autoComplete="hc-no-fill"
            data-lpignore="true"
            data-1p-ignore="true"
            data-form-type="other"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </label>
      </div>

      {firstError && (
        <span className="lcw-err" role="alert">
          {firstError}
        </span>
      )}

      {showNotice && (
        <div className="lcw-notice">
          <p>
            {aiName} is an automated assistant, not a doctor. It can't diagnose or give medical advice. Your messages may be processed by our service providers
            under HIPAA agreements. See our{" "}
            <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      )}

      <button type="submit" disabled={busy}>
        {busy ? "Starting…" : "Start chat"}
      </button>
      {showNotice && (
        <p className="lcw-notice-agree">
          By starting the chat, you agree to this notice and our{" "}
          <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </a>
          .
        </p>
      )}
    </form>
  );
}
