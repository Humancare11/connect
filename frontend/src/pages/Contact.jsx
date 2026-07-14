import { useState } from "react";
import "./contact.css";

const CONTACT_NOTE = {
  title: "Get in touch",
  body: "Use the form to send your message directly to the Humancare Connect team. We’ll reply by email as soon as possible.",
};

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

  const validate = () => {
    const validationErrors = {};

    if (!form.name.trim()) {
      validationErrors.name = "Full Name is required.";
    }

    if (!form.email.trim()) {
      validationErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      validationErrors.email = "Please enter a valid email address.";
    }

    if (!form.message.trim()) {
      validationErrors.message = "Message is required.";
    }

    return validationErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const validationErrors = validate();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    // Existing submit logic here
    setSent(true);
  };

  return (
    <div className="contact-page">
      <section className="page-hero">
        <div className="page-hero__inner">
          <p className="page-hero__eyebrow">Contact Us</p>
          <h1 className="page-hero__title">Let's start a conversation</h1>
          <p className="page-hero__desc">
            Whether you're looking to onboard your team or just want to learn
            more, we're ready to help.
          </p>
        </div>
      </section>

      <div className="page-body">
        <div className="contact-layout">
          <div className="contact-left">
            <div className="contact-detail contact-detail--note hc-card">
              <div>
                <p className="contact-detail__label">{CONTACT_NOTE.title}</p>
                <p className="contact-detail__value contact-detail__value--note">
                  {CONTACT_NOTE.body}
                </p>
              </div>
            </div>
          </div>

          <div className="contact-right">
            {sent ? (
              <div className="contact-success hc-card">
                <h3>Message received!</h3>
                <p>
                  Thank you for reaching out. Our team will get back to you
                  shortly.
                </p>
              </div>
            ) : (
              <form
                className="contact-form hc-card"
                onSubmit={handleSubmit}
                noValidate
              >
                <h2 className="contact-form__heading">
                  Send us a message
                </h2>

                <div className="contact-form__row">
                  <div className="contact-field">
                    <label htmlFor="name">
                      Full Name <span>*</span>
                    </label>

                    <input
                      id="name"
                      name="name"
                      type="text"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Jane Smith"
                      required
                    />

                    {errors.name && (
                      <span className="contact-field__error">
                        {errors.name}
                      </span>
                    )}
                  </div>

                  <div className="contact-field">
                    <label htmlFor="email">
                      Email Address <span>*</span>
                    </label>

                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="jane@company.com"
                      required
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
                    <label htmlFor="phone">
                      Phone Number
                    </label>

                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>

                  <div className="contact-field">
                    <label htmlFor="subject">
                      Subject
                    </label>

                    <input
                      id="subject"
                      name="subject"
                      type="text"
                      value={form.subject}
                      onChange={handleChange}
                      placeholder="How can we help?"
                    />
                  </div>
                </div>

                <div className="contact-field">
                  <label htmlFor="message">
                    Message <span>*</span>
                  </label>

                  <textarea
                    id="message"
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    placeholder="Tell us about your organisation..."
                    required
                  />

                  {errors.message && (
                    <span className="contact-field__error">
                      {errors.message}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn-primary contact-form__submit"
                >
                  Send Message
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}