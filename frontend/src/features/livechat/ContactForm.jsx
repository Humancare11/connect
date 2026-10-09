import { useEffect, useRef, useState } from "react";
import { removeTurnstile, renderTurnstile, resetTurnstile, turnstileSiteKey } from "./turnstile";

// Step 1, shown before ANY chat (AI or live agent): name and email are required, phone is optional.
// Protected by Cloudflare Turnstile and a honeypot field that real people never see.
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

export default function ContactForm({ onSubmit }) {
  const [values, setValues] = useState({ name: "", email: "", phone: "" });
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const widgetRef = useRef(null);
  const widgetId = useRef(null);
  const siteKey = turnstileSiteKey();

  useEffect(() => {
    const container = widgetRef.current;
    if (!container) return undefined;
    // Each mount renders into its own holder, so a quick remount (React StrictMode in development, a re-render
    // while the Turnstile script is still loading) never hits "already rendered in this container".
    const holder = document.createElement("div");
    container.appendChild(holder);
    let cancelled = false;
    let id = null;
    renderTurnstile(holder, {
      onToken: (value) => {
        setToken(value);
        setErrors((e) => (e.captcha ? { ...e, captcha: undefined } : e));
      },
      onExpire: () => setToken(""),
      onError: () => setErrors((e) => ({ ...e, captcha: "Verification failed to load. Please reload the page." })),
    })
      .then((renderedId) => {
        id = renderedId;
        widgetId.current = renderedId;
        if (cancelled) removeTurnstile(renderedId);
      })
      .catch(() => {
        if (!cancelled) setErrors((e) => ({ ...e, captcha: "Verification could not be loaded. Please check your connection." }));
      });
    return () => {
      cancelled = true;
      removeTurnstile(id);
      holder.remove();
    };
  }, []);

  // Typing in a field clears that field's old error.
  const change = (field) => (event) => {
    setValues((v) => ({ ...v, [field]: event.target.value }));
    setErrors((e) => (e[field] || e.form ? { ...e, [field]: undefined, form: undefined } : e));
  };

  const submit = async (event) => {
    event.preventDefault();
    const found = validate(values);
    if (!token) found.captcha = "Please complete the verification.";
    setErrors(found);
    if (Object.keys(found).length) return;

    setBusy(true);
    const result = await onSubmit({
      name: values.name.trim(),
      email: values.email.trim(),
      phone: values.phone.trim(),
      turnstileToken: token,
      companyUrl: honeypot,
    });
    setBusy(false);
    if (!result.ok) {
      setErrors(result.errors || {});
      setToken("");
      resetTurnstile(widgetId.current); // a token can only be used once
    }
  };

  const firstError = errors.form || errors.captcha || errors.name || errors.email || errors.phone;

  return (
    <form className="lcw-cform" onSubmit={submit} noValidate>
      <h3>Welcome to Humancare 👋</h3>
      <p>Please share a few details so we can help you. You'll then chat with Humancare AI, or with a live agent anytime.</p>

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

      {/* Honeypot: hidden from people and from assistive tech; bots fill it in and are dropped by the server. */}
      <div className="lcw-hp" aria-hidden="true">
        <label>
          Company website
          <input tabIndex={-1} autoComplete="off" name="companyUrl" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
        </label>
      </div>

      {siteKey ? <div ref={widgetRef} className="lcw-captcha" /> : <span className="lcw-err">Chat is not available right now. Please try again later.</span>}

      {firstError && (
        <span className="lcw-err" role="alert">
          {firstError}
        </span>
      )}

      <small>
        Only the Humancare support team sees these details. By starting the chat you agree to our{" "}
        <a href="/privacy-policy" target="_blank" rel="noopener noreferrer">
          Privacy Policy
        </a>
        .
      </small>
      <button type="submit" disabled={busy || !siteKey}>
        {busy ? "Starting…" : "Start chat"}
      </button>
    </form>
  );
}
