import { useState } from "react";
import api from "../api";
import "./contact.css";
import SEO from "../components/Seo";

export default function Contact() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required.";
    if (!form.email.trim()) e.email = "Email is required.";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Enter a valid email.";
    if (!form.message.trim()) e.message = "Message is required.";
    return e;
  };

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    if (errors[e.target.name])
      setErrors((er) => ({ ...er, [e.target.name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const e2 = validate();
    if (Object.keys(e2).length) {
      setErrors(e2);
      return;
    }

    setSubmitError("");
    setSubmitting(true);
    try {
      const { data } = await api.post("/api/contact", {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        subject: form.subject.trim(),
        message: form.message.trim(),
      });

      if (data.success) {
        setSent(true);
      } else {
        setSubmitError(
          data.message || "Failed to send your message. Please try again.",
        );
      }
    } catch (error) {
      setSubmitError(
        error.response?.data?.message ||
          "Unable to send your message right now. Please try again shortly.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SEO
        title=" Telemedicine Services Support | Contact Humancare Connect"
        description="Telemedicine services support for online doctor appointments, virtual healthcare solutions, and general questions. Contact the Humancare Connect team 24/7."
        url="https://humancareconnect.co/contact-us"
      />
      <div className="contact-page">
        <section className="page-hero">
          <div className="page-hero__inner">
            <p className="page-hero__eyebrow">Contact Us</p>
            <h1 className="page-hero__title">Let’s Start a Conversation</h1>
            <p className="page-hero__desc">
              Whether you need help accessing our telemedicine services, have
              questions about an online doctor appointment, or want to explore
              virtual healthcare solutions for your organization, the Humancare
              Connect team is here to help.
            </p>
          </div>
        </section>

        <div className="page-body">
          <div className="contact-layout">
            <div className="contact-left">
              <div className="contact-detail contact-detail--note hc-card">
                <div>
                  <p className="contact-detail__label">Get in touch</p>
                  <p className="contact-detail__value contact-detail__value--note">
                    Use the form to send your message directly to the Humancare
                    Connect team. We’ll respond as soon as possible.
                  </p>
                </div>
              </div>
              <div className="contact-detail contact-detail--note hc-card">
                <div>
                  <p className="contact-detail__label">
                    Our team is available 24/7
                  </p>
                  <p className="contact-detail__value contact-detail__value--note">
                    For any life-threatening emergencies, please contact local
                    emergency services immediately.
                  </p>
                </div>
              </div>

              {/* ADDRESS / PHONE / EMAIL CARD */}
              <div className="contact-detail contact-info-card hc-card">
                <div className="contact-info-row">
                  <span className="contact-detail__icon">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </span>
                  <div>
                    <p className="contact-detail__label">Address</p>
                    <p className="contact-detail__value">
                      4 Peddlers Row, 1091 Newark,
                      <br />
                      DE 19702, USA
                    </p>
                  </div>
                </div>

                <div className="contact-info-row">
                  <span className="contact-detail__icon">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" />
                    </svg>
                  </span>
                  <div>
                    <p className="contact-detail__label">Phone</p>
                    <a
                      href="tel:+13023039993"
                      className="contact-detail__value"
                    >
                      +1 (302) 303-9993
                    </a>
                  </div>
                </div>

                <div className="contact-info-row">
                  <span className="contact-detail__icon">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="m22 6-10 7L2 6" />
                    </svg>
                  </span>
                  <div>
                    <p className="contact-detail__label">Email</p>
                    <a
                      href="mailto:support@humancareconnect.co"
                      className="contact-detail__value"
                    >
                      support@humancareconnect.co
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="contact-right">
              {sent ? (
                <div className="contact-success hc-card">
                  <div className="contact-success__icon">
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  </div>
                  <h3 className="contact-success__heading">
                    Message received!
                  </h3>
                  <p className="contact-success__body">
                    Thank you for reaching out. Our team will get back to you
                    within 2 business hours.
                  </p>
                  <button
                    className="btn-outline"
                    onClick={() => {
                      setSent(false);
                      setSubmitError("");
                      setForm({
                        name: "",
                        email: "",
                        phone: "",
                        subject: "",
                        message: "",
                      });
                    }}
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form
                  className="contact-form hc-card"
                  onSubmit={handleSubmit}
                  noValidate
                >
                  <h2 className="contact-form__heading">Send us a message</h2>
                  <p className="contact-form__sub">
                    Fill in the form and we'll be in touch shortly.
                  </p>

                  <div className="contact-form__row">
                    <div className="contact-field">
                      <label className="contact-field__label" htmlFor="name">
                        Full Name <span className="contact-field__req">*</span>
                      </label>
                      <input
                        className={`contact-field__input${errors.name ? " contact-field__input--error" : ""}`}
                        id="name"
                        name="name"
                        type="text"
                        placeholder="Jane Smith"
                        value={form.name}
                        onChange={handleChange}
                      />
                      {errors.name && (
                        <span className="contact-field__error">
                          {errors.name}
                        </span>
                      )}
                    </div>
                    <div className="contact-field">
                      <label className="contact-field__label" htmlFor="email">
                        Email Address{" "}
                        <span className="contact-field__req">*</span>
                      </label>
                      <input
                        className={`contact-field__input${errors.email ? " contact-field__input--error" : ""}`}
                        id="email"
                        name="email"
                        type="email"
                        placeholder="jane@company.com"
                        value={form.email}
                        onChange={handleChange}
                      />
                      {errors.email && (
                        <span className="contact-field__error">
                          {errors.email}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="contact-form__row">
                    <div className="contact-field">
                      <label className="contact-field__label" htmlFor="phone">
                        Phone Number
                      </label>
                      <input
                        className="contact-field__input"
                        id="phone"
                        name="phone"
                        type="tel"
                        placeholder="+1 (555) 000-0000"
                        value={form.phone}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="contact-field">
                      <label className="contact-field__label" htmlFor="subject">
                        Subject
                      </label>
                      <input
                        className="contact-field__input"
                        id="subject"
                        name="subject"
                        type="text"
                        placeholder="How can we help?"
                        value={form.subject}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div className="contact-field">
                    <label className="contact-field__label" htmlFor="message">
                      Message <span className="contact-field__req">*</span>
                    </label>
                    <textarea
                      className={`contact-field__input contact-field__textarea${
                        errors.message ? " contact-field__input--error" : ""
                      }`}
                      id="message"
                      name="message"
                      placeholder="Tell us about your organisation and what you're looking for…"
                      value={form.message}
                      onChange={handleChange}
                    />
                    {errors.message && (
                      <span className="contact-field__error">
                        {errors.message}
                      </span>
                    )}
                  </div>

                  {submitError && (
                    <span className="contact-field__error" role="alert">
                      {submitError}
                    </span>
                  )}

                  <button
                    type="submit"
                    className="btn-primary contact-form__submit"
                    disabled={submitting}
                  >
                    {submitting ? "Sending..." : "Send Message"}
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
