import { useState } from "react";
import "./contact.css";

const CONTACT_NOTE = {
  title: "Get in touch",
  body: "Use the form to send your message directly to the HumaniCare Connect team. We’ll reply by email as soon as possible.",
};

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState({});

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
    if (errors[e.target.name]) setErrors((er) => ({ ...er, [e.target.name]: undefined }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const e2 = validate();
    if (Object.keys(e2).length) { setErrors(e2); return; }
    setSent(true);
  };

  return (
    <div className="contact-page">
      <section className="page-hero">
        <div className="page-hero__inner">
          <p className="page-hero__eyebrow">Contact Us</p>
          <h1 className="page-hero__title">Let's start a conversation</h1>
          <p className="page-hero__desc">Whether you're looking to onboard your team or just want to learn more, we're ready to help.</p>
        </div>
      </section>

      <div className="page-body">
        <div className="contact-layout">
          <div className="contact-left">
            <div className="contact-detail hc-card" style={{ flexDirection: "column", gap: 16, padding: 28 }}>
              <div>
                <p className="contact-detail__label">{CONTACT_NOTE.title}</p>
                <p className="contact-detail__value" style={{ fontSize: 18, lineHeight: 1.6, marginBottom: 0 }}>{CONTACT_NOTE.body}</p>
              </div>
            </div>
            <div className="contact-badge hc-card">
              <div className="contact-badge__row">
                <span className="contact-badge__dot" />
                <span className="contact-badge__text">Average response time: <strong>under 2 hours</strong></span>
              </div>
              <p className="contact-badge__note">Our team is available Monday–Friday, 9am–6pm IST. For medical emergencies, please contact local emergency services immediately.</p>
            </div>
          </div>

          <div className="contact-right">
            {sent ? (
              <div className="contact-success hc-card">
                <div className="contact-success__icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <h3 className="contact-success__heading">Message received!</h3>
                <p className="contact-success__body">Thank you for reaching out. Our team will get back to you within 2 business hours.</p>
                <button className="btn-outline" onClick={() => { setSent(false); setForm({ name: "", email: "", phone: "", subject: "", message: "" }); }}>Send another message</button>
              </div>
            ) : (
              <form className="contact-form hc-card" onSubmit={handleSubmit} noValidate>
                <h2 className="contact-form__heading">Send us a message</h2>
                <p className="contact-form__sub">Fill in the form and we'll be in touch shortly.</p>

                <div className="contact-form__row">
                  <div className="contact-field">
                    <label className="contact-field__label" htmlFor="name">Full Name <span className="contact-field__req">*</span></label>
                    <input className={`contact-field__input${errors.name ? " contact-field__input--error" : ""}`} id="name" name="name" type="text" placeholder="Jane Smith" value={form.name} onChange={handleChange} />
                    {errors.name && <span className="contact-field__error">{errors.name}</span>}
                  </div>
                  <div className="contact-field">
                    <label className="contact-field__label" htmlFor="email">Email Address <span className="contact-field__req">*</span></label>
                    <input className={`contact-field__input${errors.email ? " contact-field__input--error" : ""}`} id="email" name="email" type="email" placeholder="jane@company.com" value={form.email} onChange={handleChange} />
                    {errors.email && <span className="contact-field__error">{errors.email}</span>}
                  </div>
                </div>

                <div className="contact-form__row">
                  <div className="contact-field">
                    <label className="contact-field__label" htmlFor="phone">Phone Number</label>
                    <input className="contact-field__input" id="phone" name="phone" type="tel" placeholder="+1 (555) 000-0000" value={form.phone} onChange={handleChange} />
                  </div>
                  <div className="contact-field">
                    <label className="contact-field__label" htmlFor="subject">Subject</label>
                    <input className="contact-field__input" id="subject" name="subject" type="text" placeholder="How can we help?" value={form.subject} onChange={handleChange} />
                  </div>
                </div>

                <div className="contact-field">
                  <label className="contact-field__label" htmlFor="message">Message <span className="contact-field__req">*</span></label>
                  <textarea className={`contact-field__input contact-field__textarea${errors.message ? " contact-field__input--error" : ""}`} id="message" name="message" placeholder="Tell us about your organisation and what you're looking for…" value={form.message} onChange={handleChange} />
                  {errors.message && <span className="contact-field__error">{errors.message}</span>}
                </div>

                <button type="submit" className="btn-primary contact-form__submit">Send Message
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}